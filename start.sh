#!/usr/bin/env bash
#
# Spins up the whole Portfolio Tracker stack locally:
#   1. Postgres in Docker (creates the container on first run, reuses it after)
#   2. Backend (FastAPI via `uv`)
#   3. A test user + T212 broker account (seeded once, skipped if already there)
#   4. Frontend (Next.js via npm)
#
# Usage:
#   chmod +x start.sh
#   ./start.sh
#
# Ctrl+C stops backend + frontend. Postgres container keeps running
# (so your data survives) — stop it yourself with `docker stop pg-portfolio`.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

PG_CONTAINER="pg-portfolio"
PG_PASSWORD="password"
PG_DB="portfolio_tracker"
PG_PORT="5432"
DATABASE_URL="postgresql://postgres:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}"

TEST_USER_ID="11111111-1111-1111-1111-111111111111"
TEST_BROKER_ACCOUNT_ID="22222222-2222-2222-2222-222222222222"

BACKEND_LOG="$ROOT_DIR/backend.dev.log"
FRONTEND_LOG="$ROOT_DIR/frontend.dev.log"

PIDS=()
cleanup() {
  echo ""
  echo "Stopping backend + frontend..."
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  echo "Postgres container '${PG_CONTAINER}' is still running — stop it with: docker stop ${PG_CONTAINER}"
}
trap cleanup EXIT INT TERM

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1 (needed for this script)"; exit 1; }
}

echo "== 1/4 Checking required tools =="
require docker
require uv
require npm
require curl

echo "== 2/4 Postgres =="
if [ "$(docker ps -aq -f name=^${PG_CONTAINER}$)" ]; then
  if [ -z "$(docker ps -q -f name=^${PG_CONTAINER}$)" ]; then
    echo "Starting existing container ${PG_CONTAINER}..."
    docker start "$PG_CONTAINER" >/dev/null
  else
    echo "Container ${PG_CONTAINER} already running."
  fi
else
  echo "Creating container ${PG_CONTAINER}..."
  docker run --name "$PG_CONTAINER" \
    -e POSTGRES_PASSWORD="$PG_PASSWORD" \
    -e POSTGRES_DB="$PG_DB" \
    -p "${PG_PORT}:5432" \
    -d postgres:16 >/dev/null
fi

echo -n "Waiting for Postgres to accept connections"
until docker exec "$PG_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do
  echo -n "."
  sleep 1
done
echo " ready."

echo "== 3/4 Backend =="
cd "$BACKEND_DIR"
[ -f .env ] || echo "DATABASE_URL=${DATABASE_URL}" > .env
uv sync

echo "Starting backend (uv run uvicorn)..."
uv run uvicorn app.main:app --reload --port 8000 > "$BACKEND_LOG" 2>&1 &
PIDS+=($!)

echo -n "Waiting for backend on :8000"
until curl -sf http://localhost:8000/health >/dev/null 2>&1; do
  echo -n "."
  sleep 1
done
echo " ready."

echo "Seeding test user + T212 broker account (safe to re-run)..."
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" >/dev/null <<SQL
INSERT INTO users (id, email)
VALUES ('${TEST_USER_ID}', 'test@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO broker_accounts (id, user_id, broker_type, display_name)
VALUES ('${TEST_BROKER_ACCOUNT_ID}', '${TEST_USER_ID}', 'T212', 'T212 main')
ON CONFLICT (id) DO NOTHING;
SQL
echo "Test broker_account_id for CSV uploads: ${TEST_BROKER_ACCOUNT_ID}"

echo "== 4/4 Frontend =="
cd "$FRONTEND_DIR"
[ -d node_modules ] || npm install

echo "Starting frontend (npm run dev)..."
npm run dev > "$FRONTEND_LOG" 2>&1 &
PIDS+=($!)

echo ""
echo "-------------------------------------------------"
echo " Backend:   http://localhost:8000/docs"
echo " Frontend:  http://localhost:3000"
echo " Logs:      ${BACKEND_LOG} / ${FRONTEND_LOG}"
echo " Broker id: ${TEST_BROKER_ACCOUNT_ID}"
echo "-------------------------------------------------"
echo "Press Ctrl+C to stop backend + frontend."
echo ""

wait