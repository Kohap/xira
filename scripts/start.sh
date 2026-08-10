#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "   XIRA — X-Layer Intelligence & Risk Analytics"
echo "   ============================================="
echo ""

cleanup() { kill 0; }
trap cleanup EXIT

echo "[1/2] Starting backend on http://localhost:8000 ..."
cd "$ROOT_DIR/backend"
source venv/bin/activate 2>/dev/null || { echo "Run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"; exit 1; }
uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level warning &
sleep 2

echo "[2/2] Starting frontend on http://localhost:3000 ..."
cd "$ROOT_DIR/frontend"
npm run dev -- -p 3000 &
sleep 3

echo ""
echo "   ============================================="
echo "   Frontend:  http://localhost:3000"
echo "   API:       http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo "   ============================================="
echo ""

wait
