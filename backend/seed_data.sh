#!/usr/bin/env bash
#
# Loads sample data into a running local stack:
#   - uploads test_data/t212_export.csv to the T212 broker account
#   - inserts a couple of XTB positions directly (XTB isn't wired to an
#     upload endpoint yet, see README "Not yet built" list)
#
# Assumes start.sh is already running (backend on :8000, Postgres container
# "pg-portfolio", and the test user/broker account it seeds).
#
# Usage:
#   chmod +x seed_data.sh
#   ./seed_data.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CSV_FILE="$ROOT_DIR/test_data/t212_export.csv"

PG_CONTAINER="pg-portfolio"
PG_DB="portfolio_tracker"

TEST_USER_ID="11111111-1111-1111-1111-111111111111"
T212_ACCOUNT_ID="22222222-2222-2222-2222-222222222222"
XTB_ACCOUNT_ID="33333333-3333-3333-3333-333333333333"

echo "== Checking backend is up =="
curl -sf http://localhost:8000/health >/dev/null || {
  echo "Backend not reachable on :8000 — start the stack first with ./start.sh"
  exit 1
}

echo "== Uploading T212 sample CSV =="
[ -f "$CSV_FILE" ] || { echo "Missing $CSV_FILE"; exit 1; }
curl -sf -X POST \
  "http://localhost:8000/portfolio/upload/t212?broker_account_id=${T212_ACCOUNT_ID}" \
  -F "file=@${CSV_FILE}" | python3 -m json.tool

echo ""
echo "== Seeding an XTB broker account + positions directly =="
echo "   (XTB has no upload endpoint yet — inserting Position rows so the"
echo "    dashboard shows a second broker, like the mockup does)"
docker exec -i "$PG_CONTAINER" psql -U postgres -d "$PG_DB" >/dev/null <<SQL
INSERT INTO broker_accounts (id, user_id, broker_type, display_name)
VALUES ('${XTB_ACCOUNT_ID}', '${TEST_USER_ID}', 'XTB', 'XTB main')
ON CONFLICT (id) DO NOTHING;

DELETE FROM positions WHERE broker_account_id = '${XTB_ACCOUNT_ID}';

INSERT INTO positions (id, broker_account_id, ticker, quantity, avg_buy_price, currency)
VALUES
  (gen_random_uuid(), '${XTB_ACCOUNT_ID}', 'GOOGL', 5, 168.30, 'USD'),
  (gen_random_uuid(), '${XTB_ACCOUNT_ID}', 'AMZN', 10, 205.75, 'USD'),
  (gen_random_uuid(), '${XTB_ACCOUNT_ID}', 'CDR', 30, 42.10, 'EUR');
SQL

echo ""
echo "Done. Check http://localhost:3000 or GET http://localhost:8000/portfolio"