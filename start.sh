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
# (so your data survives) - stop it yourself with `docker stop pg-portfolio`.

set -euo pipefail
[ "${DEBUG:-0}" = "1" ] && set -x || true   # DEBUG=1 ./start.sh  -> trace every command

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

# ---------------------------------------------------------------------------
# PATH fix: this script runs in a fresh bash, which does NOT load your
# ~/.zshrc / ~/.bashrc. Tools installed into user directories (uv, or node
# via nvm) therefore work in your terminal but are invisible in here.
# ---------------------------------------------------------------------------
#
# Works with `sudo ./start.sh` too: under sudo, $HOME is root's home, so we
# look for uv / node in the home of the user who ran sudo instead.
TOOLS_HOME="$HOME"
if [ "$(id -u)" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then
  TOOLS_HOME="$(getent passwd "$SUDO_USER" 2>/dev/null | cut -d: -f6 || true)"
  [ -n "$TOOLS_HOME" ] || TOOLS_HOME="$(eval echo "~$SUDO_USER")"
fi
export PATH="$TOOLS_HOME/.local/bin:$TOOLS_HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1 && [ -s "$TOOLS_HOME/.nvm/nvm.sh" ]; then
  set +u
  # shellcheck disable=SC1091
  . "$TOOLS_HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
  set -u
fi

# Default is plain `uv`. If your shell finds uv but this script does not, run:
#   UV_BIN="$(command -v uv)" ./start.sh
UV_BIN="${UV_BIN:-uv}"

STARTED=0
PIDS=()
cleanup() {
  # Only say anything if we actually got as far as starting the servers.
  if [ "$STARTED" -eq 1 ]; then
    echo ""
    echo "Stopping backend + frontend..."
    for pid in "${PIDS[@]:-}"; do
      [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
    done
    echo "Postgres container '${PG_CONTAINER}' is still running (so your data survives)."
    echo "Stop it with: docker stop ${PG_CONTAINER}"
  fi
  # Run via sudo? Hand everything we created (.env, .venv, node_modules, logs)
  # back to your normal user so it isn't left owned by root.
  if [ "$(id -u)" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then
    chown -R "$SUDO_USER" "$BACKEND_DIR" "$FRONTEND_DIR" "$BACKEND_LOG" "$FRONTEND_LOG" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

fail() { echo "ERROR: $*" >&2; exit 1; }

# Runs the tool for real (instead of only looking it up with `command -v`),
# so a failure shows the actual reason instead of a generic "not found".
check_tool() {
  local name="$1"; shift
  local out
  if ! out="$("$name" "$@" 2>&1)"; then
    echo "ERROR: '$name' could not be run from inside start.sh." >&2
    echo "  Output of '$name $*':" >&2
    echo "$out" | sed 's/^/    /' >&2
    echo "  PATH inside the script: $PATH" >&2
    exit 1
  fi
}

echo "== 1/4 Checking required tools =="
check_tool docker --version
check_tool npm --version
check_tool curl --version

docker info >/dev/null 2>&1 || fail "Docker is installed but the daemon isn't running. Start Docker Desktop / the docker service and retry."

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
for _ in $(seq 1 60); do
  docker exec "$PG_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  echo -n "."
  sleep 1
done
docker exec "$PG_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 || fail "Postgres did not become ready in 60s (check: docker logs ${PG_CONTAINER})"
echo " ready."

echo "== 3/4 Backend =="
# NOTE: no `cd` anywhere in this script. If PATH contains a relative entry,
# a tool that is found from the repo root would stop being found after cd-ing
# into backend/ or frontend/ ("uv: command not found" even though it works in
# your terminal). uv --directory / npm --prefix do the cd for us instead.
[ -f "$BACKEND_DIR/.env" ] || echo "DATABASE_URL=${DATABASE_URL}" > "$BACKEND_DIR/.env"
"$UV_BIN" --directory "$BACKEND_DIR" sync

echo "Starting backend (uvicorn)..."
"$UV_BIN" --directory "$BACKEND_DIR" run uvicorn app.main:app --reload --port 8000 > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
PIDS+=("$BACKEND_PID")
STARTED=1

echo -n "Waiting for backend on :8000"
for _ in $(seq 1 90); do
  curl -sf http://localhost:8000/health >/dev/null 2>&1 && break
  kill -0 "$BACKEND_PID" 2>/dev/null || { echo ""; tail -n 30 "$BACKEND_LOG"; fail "Backend process died - see log above (${BACKEND_LOG})"; }
  echo -n "."
  sleep 1
done
curl -sf http://localhost:8000/health >/dev/null 2>&1 || { echo ""; tail -n 30 "$BACKEND_LOG"; fail "Backend not healthy after 90s (log: ${BACKEND_LOG})"; }
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
[ -d "$FRONTEND_DIR/node_modules" ] || npm --prefix "$FRONTEND_DIR" install

echo "Starting frontend (npm run dev)..."
npm --prefix "$FRONTEND_DIR" run dev > "$FRONTEND_LOG" 2>&1 &
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