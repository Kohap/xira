from __future__ import annotations
import os
import sqlite3
import json
import time
import logging
from typing import List, Optional
from contextlib import contextmanager
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path(
    os.getenv("XIRA_DB_PATH", str(Path(__file__).parent / "xira_history.db"))
)


class HistoryDB:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    risk_score INTEGER NOT NULL,
                    risk_level TEXT NOT NULL,
                    confidence INTEGER NOT NULL,
                    anomaly INTEGER NOT NULL,
                    anomaly_reason TEXT,
                    explanation TEXT,
                    evidence_hash TEXT,
                    model_version TEXT,
                    data_source TEXT,
                    factors_json TEXT,
                    UNIQUE(symbol, timestamp)
                )
            """)
            cols = [r[1] for r in conn.execute("PRAGMA table_info(scores)")]
            if "published" not in cols:
                conn.execute("ALTER TABLE scores ADD COLUMN published INTEGER DEFAULT 0")
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_scores_symbol 
                ON scores(symbol, timestamp DESC)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_scores_timestamp 
                ON scores(timestamp DESC)
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS thresholds (
                    symbol TEXT PRIMARY KEY,
                    threshold INTEGER,
                    enabled INTEGER DEFAULT 1
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS publish_attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    confidence INTEGER NOT NULL,
                    evidence_hash TEXT NOT NULL,
                    model_version TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    tx_hash TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_publish_attempts
                ON publish_attempts(symbol, evidence_hash, status)
            """)
            # Single-instance scheduler guard: replicas sharing the volume
            # contend here so only one of them publishes on-chain.
            conn.execute("""
                CREATE TABLE IF NOT EXISTS scheduler_lock (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    owner TEXT NOT NULL,
                    heartbeat_at INTEGER NOT NULL
                )
            """)
        logger.info(f"History DB initialized at {self.db_path}")

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.execute("PRAGMA journal_mode=WAL")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def store_score(self, symbol: str, attestation: dict, published: bool = False) -> bool:
        try:
            with self._connect() as conn:
                # ON CONFLICT keeps the row but never demotes published=1
                # (a same-second rescore write must not clobber the record
                # of an on-chain attestation).
                conn.execute("""
                    INSERT INTO scores
                    (symbol, timestamp, risk_score, risk_level, confidence,
                     anomaly, anomaly_reason, explanation, evidence_hash,
                     model_version, data_source, factors_json, published)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(symbol, timestamp) DO UPDATE SET
                        risk_score = excluded.risk_score,
                        risk_level = excluded.risk_level,
                        confidence = excluded.confidence,
                        anomaly = excluded.anomaly,
                        anomaly_reason = excluded.anomaly_reason,
                        explanation = excluded.explanation,
                        evidence_hash = excluded.evidence_hash,
                        model_version = excluded.model_version,
                        data_source = excluded.data_source,
                        factors_json = excluded.factors_json,
                        published = max(scores.published, excluded.published)
                """, (
                    symbol,
                    attestation.get("timestamp", int(time.time())),
                    attestation.get("risk_score", 0),
                    attestation.get("risk_level", "MODERATE"),
                    attestation.get("confidence", 0),
                    1 if attestation.get("anomaly") else 0,
                    attestation.get("anomaly_reason", ""),
                    attestation.get("explanation", ""),
                    attestation.get("evidence_hash", ""),
                    attestation.get("model_version", ""),
                    attestation.get("data_source", "mock"),
                    json.dumps(attestation.get("factors", [])),
                    1 if published else 0,
                ))
            return True
        except Exception as e:
            logger.error(f"Failed to store score for {symbol}: {e}")
            return False

    def store_published_from_chain(self, symbol: str, entry: dict) -> bool:
        """Store a published record keyed by its evidence hash.

        Same-attestation rows signed earlier (e.g. imported before the chain
        block time was known) are healed in place so the verify page sees one
        consistent timestamp. Inserts the row when no published record with
        this evidence hash exists yet.
        """
        evidence_hash = entry.get("evidence_hash", "")
        ts = entry.get("timestamp", int(time.time()))
        try:
            with self._connect() as conn:
                cur = conn.execute(
                    """
                    UPDATE scores SET timestamp = ?, risk_score = ?,
                        confidence = ?, published = 1
                    WHERE symbol = ? AND evidence_hash = ? AND published = 1
                      AND timestamp != ?
                    """,
                    (
                        ts,
                        entry.get("risk_score", 0),
                        entry.get("confidence", 0),
                        symbol,
                        evidence_hash,
                        ts,
                    ),
                )
                if cur.rowcount == 0 and not conn.execute(
                    "SELECT 1 FROM scores WHERE symbol = ? AND evidence_hash = ? AND published = 1",
                    (symbol, evidence_hash),
                ).fetchone():
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO scores
                        (symbol, timestamp, risk_score, risk_level, confidence,
                         anomaly, anomaly_reason, explanation, evidence_hash,
                         model_version, data_source, factors_json, published)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                        """,
                        (
                            symbol,
                            ts,
                            entry.get("risk_score", 0),
                            entry.get("risk_level", "MODERATE"),
                            entry.get("confidence", 0),
                            1 if entry.get("anomaly") else 0,
                            entry.get("anomaly_reason", ""),
                            entry.get("explanation", ""),
                            evidence_hash,
                            entry.get("model_version", ""),
                            entry.get("data_source", "onchain"),
                            json.dumps(entry.get("factors", [])),
                        ),
                    )
            return True
        except Exception as e:
            logger.error(f"Failed to store published-from-chain for {symbol}: {e}")
            return False

    def get_history(self, symbol: str, limit: int = 50) -> List[dict]:
        try:
            with self._connect() as conn:
                cursor = conn.execute("""
                    SELECT timestamp, risk_score, risk_level, confidence,
                           anomaly, anomaly_reason, explanation, factors_json,
                           evidence_hash, model_version, data_source, published
                    FROM scores
                    WHERE symbol = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                """, (symbol, limit))

                results = []
                for row in cursor.fetchall():
                    results.append({
                        "timestamp": row[0],
                        "risk_score": row[1],
                        "risk_level": row[2],
                        "confidence": row[3],
                        "anomaly": bool(row[4]),
                        "anomaly_reason": row[5],
                        "explanation": row[6],
                        "factors": json.loads(row[7]) if row[7] else [],
                        "evidence_hash": row[8] or "",
                        "model_version": row[9] or "",
                        "data_source": row[10] or "",
                        "published": bool(row[11]),
                    })
                return results
        except Exception as e:
            logger.error(f"Failed to get history for {symbol}: {e}")
            return []

    def get_latest(self, symbol: str) -> Optional[dict]:
        """Most recent stored attestation (the last one the oracle signed)."""
        try:
            with self._connect() as conn:
                cursor = conn.execute("""
                    SELECT timestamp, risk_score, risk_level, confidence,
                           anomaly, anomaly_reason, explanation, evidence_hash,
                           model_version, data_source, factors_json
                    FROM scores
                    WHERE symbol = ? AND published = 1
                    ORDER BY timestamp DESC
                    LIMIT 1
                """, (symbol,))
                row = cursor.fetchone()
                if not row:
                    return None
                return {
                    "symbol": symbol,
                    "timestamp": row[0],
                    "risk_score": row[1],
                    "risk_level": row[2],
                    "confidence": row[3],
                    "anomaly": bool(row[4]),
                    "anomaly_reason": row[5],
                    "explanation": row[6],
                    "evidence_hash": row[7],
                    "model_version": row[8],
                    "data_source": row[9],
                    "factors": json.loads(row[10]) if row[10] else [],
                }
        except Exception as e:
            logger.error(f"Failed to get latest score for {symbol}: {e}")
            return None

    def get_stats(self) -> dict:
        try:
            with self._connect() as conn:
                cursor = conn.execute("""
                    SELECT 
                        COUNT(DISTINCT symbol) as total_symbols,
                        COUNT(*) as total_records,
                        MIN(timestamp) as oldest,
                        MAX(timestamp) as newest
                    FROM scores
                """)
                row = cursor.fetchone()
                return {
                    "total_symbols": row[0],
                    "total_records": row[1],
                    "oldest_record": row[2],
                    "newest_record": row[3],
                }
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {}

    def get_market_history(self, cutoff_ts: int) -> list[dict]:
        """All (timestamp, risk_score) rows at or after cutoff, for market-level aggregation."""
        try:
            with self._connect() as conn:
                cursor = conn.execute("""
                    SELECT timestamp, risk_score
                    FROM scores
                    WHERE timestamp >= ?
                    ORDER BY timestamp ASC
                """, (cutoff_ts,))
                return [
                    {"ts": row[0], "risk_score": row[1]}
                    for row in cursor.fetchall()
                ]
        except Exception as e:
            logger.error(f"Failed to get market history: {e}")
            return []

    def get_thresholds(self) -> dict[str, dict]:
        try:
            with self._connect() as conn:
                cursor = conn.execute("SELECT symbol, threshold, enabled FROM thresholds")
                return {
                    row[0]: {"threshold": row[1], "enabled": bool(row[2])}
                    for row in cursor.fetchall()
                }
        except Exception as e:
            logger.error(f"Failed to get thresholds: {e}")
            return {}

    def set_threshold(self, symbol: str, threshold: int, enabled: bool = True) -> bool:
        try:
            with self._connect() as conn:
                conn.execute("""
                    INSERT INTO thresholds (symbol, threshold, enabled)
                    VALUES (?, ?, ?)
                    ON CONFLICT(symbol) DO UPDATE SET
                        threshold = excluded.threshold,
                        enabled = excluded.enabled
                """, (symbol, threshold, 1 if enabled else 0))
            return True
        except Exception as e:
            logger.error(f"Failed to set threshold for {symbol}: {e}")
            return False

    # ------------------------------------------------------------------
    # Publish-attempt ledger (idempotent on-chain publishing)
    # ------------------------------------------------------------------

    PENDING_TTL_S = float(os.getenv("XIRA_PENDING_ATTEMPT_TTL", "1800"))

    def record_publish_attempt(
        self,
        symbol: str,
        score: int,
        confidence: int,
        evidence_hash: str,
        model_version: str,
    ) -> dict:
        """Record an intent to publish; the ledger is the idempotency key.

        Returns the current ledger row with an extra "created" key: True
        only when THIS call inserted a fresh row. Behavior:
          - identical (symbol, evidence_hash, model_version) with status
            pending|confirmed  -> returned as-is, created=False (callers
            must NOT broadcast again)
          - identical row that failed -> re-armed to pending (retry),
            created=False but status 'pending' with no tx_hash: retryable
          - pending older than PENDING_TTL_S -> re-armed to pending (the
            orphaned tx either confirmed on-chain (hash check will catch it)
            or died, so re-publishing is safe)
          - otherwise a fresh pending row is inserted, created=True
        """
        now = int(time.time())
        try:
            with self._connect() as conn:
                rows = conn.execute(
                    """
                    SELECT id, status, created_at FROM publish_attempts
                    WHERE symbol = ? AND evidence_hash = ? AND model_version = ?
                    ORDER BY id DESC LIMIT 1
                    """,
                    (symbol, evidence_hash, model_version),
                ).fetchall()

                def _existing(row_id: int) -> Optional[dict]:
                    row = conn.execute(
                        """
                        SELECT id, symbol, score, confidence, evidence_hash,
                               model_version, status, tx_hash, created_at, updated_at
                        FROM publish_attempts WHERE id = ?
                        """,
                        (row_id,),
                    ).fetchone()
                    if not row:
                        return None
                    d = self._attempt_dict(row)
                    d["created"] = False
                    return d

                for row in rows:
                    row_id, status, created_at = row
                    if status in ("pending", "confirmed"):
                        if status == "confirmed":
                            return _existing(row_id) or {}
                        age = now - created_at
                        if age < self.PENDING_TTL_S:
                            return _existing(row_id) or {}
                        conn.execute(
                            "UPDATE publish_attempts SET status='pending', updated_at=? WHERE id=?",
                            (now, row_id),
                        )
                        attempt = _existing(row_id) or {}
                        attempt["rearmed"] = True
                        return attempt
                    if status == "failed":
                        conn.execute(
                            "UPDATE publish_attempts SET status='pending', updated_at=? WHERE id=?",
                            (now, row_id),
                        )
                        attempt = _existing(row_id) or {}
                        attempt["rearmed"] = True
                        return attempt
                    # status == 'replaced': fall through and insert anew.
                cur = conn.execute(
                    """
                    INSERT INTO publish_attempts
                    (symbol, score, confidence, evidence_hash, model_version,
                     status, tx_hash, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
                    """,
                    (symbol, score, confidence, evidence_hash, model_version, now, now),
                )
                attempt = _existing(cur.lastrowid) or {}
                attempt["created"] = True
                return attempt
        except Exception as e:
            logger.error(f"Failed to record publish attempt for {symbol}: {e}")
            return {}

    @staticmethod
    def _attempt_dict(row) -> dict:
        return {
            "id": row[0],
            "symbol": row[1],
            "score": row[2],
            "confidence": row[3],
            "evidence_hash": row[4],
            "model_version": row[5],
            "status": row[6],
            "tx_hash": row[7],
            "created_at": row[8],
            "updated_at": row[9],
        }

    def get_publish_attempt(self, attempt_id: int) -> Optional[dict]:
        try:
            with self._connect() as conn:
                row = conn.execute(
                    """
                    SELECT id, symbol, score, confidence, evidence_hash,
                           model_version, status, tx_hash, created_at, updated_at
                    FROM publish_attempts WHERE id = ?
                    """,
                    (attempt_id,),
                ).fetchone()
                if not row:
                    return None
                return self._attempt_dict(row)
        except Exception as e:
            logger.error(f"Failed to read publish attempt {attempt_id}: {e}")
            return None

    def mark_publish_result(
        self,
        symbol: str,
        evidence_hash: str,
        model_version: str,
        status: str,
        tx_hash: Optional[str] = None,
        replaced: bool = False,
    ) -> None:
        """Move the ledger row(s) for an attestation to a terminal state.

        confirmed: the tx mined successfully (tx_hash recorded).
        failed:    the broadcast errored or the tx reverted.
        replaced:  a newer attestation superseded it; also flips any
                   sibling pending rows for the same symbol so an old
                   attempt can never re-broadcast later.
        """
        now = int(time.time())
        try:
            with self._connect() as conn:
                conn.execute(
                    """
                    UPDATE publish_attempts
                    SET status = ?, tx_hash = COALESCE(?, tx_hash), updated_at = ?
                    WHERE symbol = ? AND evidence_hash = ? AND model_version = ?
                    """,
                    (status, tx_hash, now, symbol, evidence_hash, model_version),
                )
                if replaced:
                    conn.execute(
                        """
                        UPDATE publish_attempts SET status = 'replaced', updated_at = ?
                        WHERE symbol = ? AND status = 'pending'
                        """,
                        (now, symbol),
                    )
        except Exception as e:
            logger.error(f"Failed to mark publish result for {symbol}: {e}")

    def pending_publish_count(self) -> int:
        try:
            with self._connect() as conn:
                row = conn.execute(
                    "SELECT COUNT(*) FROM publish_attempts WHERE status = 'pending'"
                ).fetchone()
                return row[0] if row else 0
        except Exception as e:
            logger.error(f"Failed to count pending publishes: {e}")
            return 0

    # ------------------------------------------------------------------
    # Scheduler leader lock (single-publisher guarantee across replicas)
    # ------------------------------------------------------------------

    def try_acquire_leader(self, owner: str, stale_after_s: float) -> bool:
        """Acquire or renew the scheduler leadership lease.

        Returns True when `owner` holds the lock afterwards. A lock whose
        heartbeat is older than stale_after_s is presumed dead and may be
        taken over. On any DB error we fail OPEN (return True) so a lock
        table problem never halts publishing on a healthy single instance.
        """
        now = int(time.time())
        try:
            with self._connect() as conn:
                row = conn.execute(
                    "SELECT owner, heartbeat_at FROM scheduler_lock WHERE id = 1"
                ).fetchone()
                if row is None:
                    conn.execute(
                        "INSERT INTO scheduler_lock (id, owner, heartbeat_at) VALUES (1, ?, ?)",
                        (owner, now),
                    )
                    return True
                held_by, heartbeat_at = row[0], row[1]
                if held_by == owner or (now - heartbeat_at) > stale_after_s:
                    conn.execute(
                        "UPDATE scheduler_lock SET owner = ?, heartbeat_at = ? WHERE id = 1",
                        (owner, now),
                    )
                    return True
                return False
        except Exception as e:
            logger.error(f"Leader lock check failed ({e}); proceeding as leader.")
            return True

    def release_leader(self, owner: str) -> None:
        """Drop the lease on clean shutdown so a replica replacement can
        take over immediately instead of waiting out the stale window."""
        try:
            with self._connect() as conn:
                conn.execute(
                    "DELETE FROM scheduler_lock WHERE id = 1 AND owner = ?",
                    (owner,),
                )
        except Exception as e:
            logger.error(f"Leader lock release failed: {e}")


# Singleton instance
history_db = HistoryDB()
