import os
import sys
import tempfile
import pytest

# Ensure backend root is on sys.path
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

# Isolate SQLite database for tests to prevent mutating dev database
TEST_DB_DIR = tempfile.mkdtemp()
TEST_DB_PATH = os.path.join(TEST_DB_DIR, "test_xira_history.db")
os.environ["XIRA_DB_PATH"] = TEST_DB_PATH
os.environ["USE_LIVE_DATA"] = "false"
os.environ["PRIVATE_KEY"] = ""
os.environ["XIRA_CONTRACT_ADDRESS"] = "0x0000000000000000000000000000000000000000"
