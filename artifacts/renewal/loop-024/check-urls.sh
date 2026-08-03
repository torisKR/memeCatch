#!/bin/bash

# URL Liveness Checker
# Queries meme_sources with offset=800, limit=800
# Samples 80 rows at 10-row intervals

SUPABASE_URL="https://onjipuldngbdptldkpoe.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uamlwdWxkbmdiZHB0bGRrcG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzczNTksImV4cCI6MjA5OTAxMzM1OX0.V2Jcyz9OuQwg8DDxR8QK6n78YPyJY-XTYE3hOS-VneM"

# Fetch data
echo "Fetching meme_sources (offset=800, limit=800)..."
SOURCES=$(curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/meme_sources?select=id,source_url&source_url=neq.null&offset=800&limit=800")

echo "$SOURCES" > /tmp/sources.json

# Count total
TOTAL=$(echo "$SOURCES" | jq 'length')
echo "Total rows fetched: $TOTAL"

# Initialize counters
OK=0
DEAD=0
BLOCKED=0
TIMEOUT=0
PRIVATE=0

# Sample 80 rows at 10-row intervals
DEAD_URLS="[]"

for i in {0..79}; do
  IDX=$((i * 10))

  if [ $IDX -ge $TOTAL ]; then
    break
  fi

  SOURCE=$(echo "$SOURCES" | jq ".[$IDX]")
  URL=$(echo "$SOURCE" | jq -r '.source_url')
  MEME_ID=$(echo "$SOURCE" | jq -r '.id')

  if [ -z "$URL" ] || [ "$URL" = "null" ]; then
    continue
  fi

  echo "[$IDX/$((TOTAL-1))] Checking: $URL"

  # Determine verdict
  VERDICT="ok"

  # Check if YouTube
  if echo "$URL" | grep -qE "youtube\.com|youtu\.be"; then
    # Use oEmbed for YouTube
    OEMBED_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
      "https://www.youtube.com/oembed?url=$(printf %s "$URL" | jq -sRr @uri)")

    if [ "$OEMBED_RESPONSE" = "200" ]; then
      VERDICT="ok"
    elif [ "$OEMBED_RESPONSE" = "404" ] || [ "$OEMBED_RESPONSE" = "401" ]; then
      VERDICT="dead"
    else
      VERDICT="dead"
    fi
  else
    # Use curl for other URLs
    HTTP_CODE=$(curl -sIL -m 8 -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null)

    if [ -z "$HTTP_CODE" ]; then
      VERDICT="timeout"
    elif [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "451" ]; then
      VERDICT="blocked"
    elif [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "410" ]; then
      VERDICT="dead"
    elif [ ${HTTP_CODE%?} -ge 2 ] && [ ${HTTP_CODE%?} -le 3 ]; then
      VERDICT="ok"
    else
      VERDICT="ok"
    fi
  fi

  # Update counters
  case $VERDICT in
    ok) ((OK++)) ;;
    dead) ((DEAD++)) ;;
    blocked) ((BLOCKED++)) ;;
    timeout) ((TIMEOUT++)) ;;
    private) ((PRIVATE++)) ;;
  esac

  # Add to dead URLs if not ok
  if [ "$VERDICT" != "ok" ]; then
    NEW_ENTRY=$(jq -n --arg meme_id "$MEME_ID" --arg url "$URL" --arg verdict "$VERDICT" \
      '{meme_id: $meme_id, url: $url, verdict: $verdict}')
    DEAD_URLS=$(echo "$DEAD_URLS" | jq ". += [$NEW_ENTRY]")
  fi

  # Wait 0.3 seconds between requests
  sleep 0.3
done

# Calculate checked count
CHECKED=$((i))

# Build result JSON
RESULT=$(jq -n \
  --arg ok "$OK" \
  --arg dead "$DEAD" \
  --arg blocked "$BLOCKED" \
  --arg timeout "$TIMEOUT" \
  --arg private "$PRIVATE" \
  --argjson dead_urls "$DEAD_URLS" \
  --arg checked "$CHECKED" \
  '{
    checked: ($checked | tonumber),
    byStatus: {
      ok: ($ok | tonumber),
      dead: ($dead | tonumber),
      blocked: ($blocked | tonumber),
      timeout: ($timeout | tonumber),
      private: ($private | tonumber)
    },
    deadUrls: $dead_urls[0:40]
  }')

echo "$RESULT" > /Users/toris/projects/memecatch/artifacts/renewal/loop-024/url-check-results.json

echo "=== RESULTS ==="
echo "$RESULT" | jq '.'
echo ""
echo "Results saved to url-check-results.json"
