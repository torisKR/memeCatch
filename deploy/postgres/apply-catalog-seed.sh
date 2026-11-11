#!/bin/bash
# Run after the production meme catalog is present. The seed raises if the
# 1000 referenced memes are not approved, green, and published.
set -euo pipefail
psql "${DATABASE_URL:?DATABASE_URL is required}" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261007083649_meme_collectible_catalog_seed.sql
