from __future__ import annotations
import os
import tempfile
import time
from app.services.history_db import HistoryDB


def test_leader_lock_lifecycle():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    try:
        db = HistoryDB(db_path=db_path)

        # 1. Instance A acquires lock
        acquired_a = db.try_acquire_leader("instance-a", stale_after_s=60)
        assert acquired_a is True

        # 2. Instance B tries to acquire while A is fresh -> should fail
        acquired_b = db.try_acquire_leader("instance-b", stale_after_s=60)
        assert acquired_b is False

        # 3. Instance A renews -> succeeds
        renewed_a = db.try_acquire_leader("instance-a", stale_after_s=60)
        assert renewed_a is True

        # 4. Instance A releases lock on clean shutdown
        db.release_leader("instance-a")

        # 5. Instance B can now acquire immediately
        acquired_b_now = db.try_acquire_leader("instance-b", stale_after_s=60)
        assert acquired_b_now is True

    finally:
        if os.path.exists(db_path):
            try:
                os.unlink(db_path)
            except Exception:
                pass
