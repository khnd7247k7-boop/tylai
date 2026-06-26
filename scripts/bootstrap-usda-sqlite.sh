#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="$ROOT/assets/usda_nutrition.db"
SQL="$ROOT/scripts/usda_nutrition_schema.sql"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 CLI not found. Install SQLite to generate assets/usda_nutrition.db." >&2
  exit 1
fi

mkdir -p "$ROOT/assets"
rm -f "$DB"
sqlite3 "$DB" <"$SQL"
echo "Wrote $DB"
