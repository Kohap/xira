from __future__ import annotations
import sqlite3
import json
import time
import logging
from typing import Optional, List
from contextlib import contextmanager
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "xira_history.db"


class HistoryDB:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
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

    def store_score(self, symbol: str, attestation: dict) -> bool:
        try:
            with self._connect() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO scores 
                    (symbol, timestamp, risk_score, risk_level, confidence, 
                     anomaly, anomaly_reason, explanation, evidence_hash,
                     model_version, data_source, factors_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                ))
            return True
        except Exception as e:
            logger.error(f"Failed to store score for {symbol}: {e}")
            return False

    def get_history(self, symbol: str, limit: int = 50) -> List[dict]:
        try:
            with self._connect() as conn:
                cursor = conn.execute("""
                    SELECT timestamp, risk_score, risk_level, confidence, 
                           anomaly, anomaly_reason, explanation, factors_json
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
                    })
                return results
        except Exception as e:
            logger.error(f"Failed to get history for {symbol}: {e}")
            return []

    def get_all_latest(self) -> List[dict]:
        try:
            with self._connect() as conn:
                cursor = conn.execute("""
                    SELECT s1.*
                    FROM scores s1
                    INNER JOIN (
                        SELECT symbol, MAX(timestamp) as max_ts
                        FROM scores
                        GROUP BY symbol
                    ) s2 ON s1.symbol = s2.symbol AND s1.timestamp = s2.max_ts
                    ORDER BY s1.symbol
                """)
                
                results = []
                for row in cursor.fetchall():
                    results.append({
                        "symbol": row[1],
                        "timestamp": row[2],
                        "risk_score": row[3],
                        "risk_level": row[4],
                        "confidence": row[5],
                        "anomaly": bool(row[6]),
                        "anomaly_reason": row[7],
                        "explanation": row[8],
                        "factors": json.loads(row[11]) if row[11] else [],
                    })
                return results
        except Exception as e:
            logger.error(f"Failed to get all latest scores: {e}")
            return []

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


# Singleton instance
history_db = HistoryDB()
