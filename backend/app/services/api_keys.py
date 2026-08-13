from __future__ import annotations
import logging
import secrets
import time

from app.services.history_db import history_db

logger = logging.getLogger(__name__)

KEY_PREFIX = "xira_"
KEY_LENGTH = 32


class ApiKeys:
    def __init__(self):
        self._init_table()

    def _connect(self):
        return history_db._connect()

    def _init_table(self):
        with self._connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS api_keys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    key_hash TEXT NOT NULL UNIQUE,
                    prefix TEXT NOT NULL,
                    enabled INTEGER DEFAULT 1,
                    created_at INTEGER NOT NULL,
                    last_used_at INTEGER
                )
            """)

    @staticmethod
    def _hash(key: str) -> str:
        import hashlib

        return hashlib.sha256(key.encode()).hexdigest()

    def issue(self, name: str) -> dict:
        """Create a key and return the plaintext once. The stored record
        keeps only a SHA-256 hash plus a display prefix."""
        plaintext = KEY_PREFIX + secrets.token_urlsafe(KEY_LENGTH)
        prefix = plaintext[:18]
        now = int(time.time())
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO api_keys (name, key_hash, prefix, enabled, created_at) "
                "VALUES (?, ?, ?, 1, ?)",
                (name.strip() or "unnamed", self._hash(plaintext), prefix, now),
            )
        logger.info(f"API key issued: prefix={prefix}")
        return {"key": plaintext, "prefix": prefix, "name": name.strip() or "unnamed"}

    def validate(self, key: str) -> bool:
        """Return True when the key exists, is enabled, and matches. Updates
        last_used_at on success."""
        if not key:
            return False
        digest = self._hash(key)
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, enabled FROM api_keys WHERE key_hash = ?", (digest,)
            ).fetchone()
            if not row:
                return False
            if not row[1]:
                return False
            conn.execute(
                "UPDATE api_keys SET last_used_at = ? WHERE id = ?",
                (int(time.time()), row[0]),
            )
        return True

    def revoke(self, prefix: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM api_keys WHERE prefix = ?", (prefix,))
        return cur.rowcount > 0

    def list_keys(self) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT name, prefix, enabled, created_at, last_used_at "
                "FROM api_keys ORDER BY created_at DESC"
            ).fetchall()
        return [
            {
                "name": r[0],
                "prefix": r[1],
                "enabled": bool(r[2]),
                "created_at": r[3],
                "last_used_at": r[4],
            }
            for r in rows
        ]


api_keys = ApiKeys()
