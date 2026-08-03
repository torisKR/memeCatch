#!/usr/bin/env python3
"""
URL Liveness Checker
Queries meme_sources with offset=800, limit=800
Samples 80 rows at 10-row intervals
Checks each URL and returns structured results
"""

import json
import subprocess
import time
import urllib.request
import urllib.error
from urllib.parse import quote

SUPABASE_URL = "https://onjipuldngbdptldkpoe.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uamlwdWxkbmdiZHB0bGRrcG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzczNTksImV4cCI6MjA5OTAxMzM1OX0.V2Jcyz9OuQwg8DDxR8QK6n78YPyJY-XTYE3hOS-VneM"

def fetch_meme_sources():
    """Fetch meme_sources from Supabase"""
    url = f"{SUPABASE_URL}/rest/v1/meme_sources?select=id,source_url&source_url=neq.null&offset=800&limit=800"
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching meme_sources: {e}")
        return []

def is_youtube_url(url):
    """Check if URL is a YouTube URL"""
    return "youtube.com" in url or "youtu.be" in url

def check_youtube(url):
    """Check YouTube URL via oEmbed"""
    try:
        oembed_url = f"https://www.youtube.com/oembed?url={quote(url)}"
        req = urllib.request.Request(oembed_url)
        with urllib.request.urlopen(req, timeout=8) as response:
            return "ok" if response.status == 200 else "dead"
    except urllib.error.HTTPError as e:
        if e.code in (404, 401):
            return "dead"
        return "dead"
    except Exception:
        return "dead"

def check_url(url):
    """Check URL via curl HEAD/GET"""
    try:
        cmd = ["curl", "-sIL", "-m", "8", "-o", "/dev/null", "-w", "%{http_code}", url]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        code = result.stdout.strip()

        if not code:
            return "timeout"

        http_code = int(code)

        if 200 <= http_code < 400:
            return "ok"
        elif http_code in (403, 451):
            return "blocked"
        elif http_code in (404, 410):
            return "dead"
        elif http_code == 0:
            return "timeout"
        else:
            return "ok"
    except subprocess.TimeoutExpired:
        return "timeout"
    except Exception as e:
        if "timeout" in str(e).lower():
            return "timeout"
        return "dead"

def main():
    print("Fetching meme_sources (offset=800, limit=800)...")
    sources = fetch_meme_sources()
    print(f"Total rows: {len(sources)}")

    # Sample 80 rows at 10-row intervals
    sample_indices = [i * 10 for i in range(80) if i * 10 < len(sources)]
    print(f"Sampling {len(sample_indices)} rows...")

    dead_urls = []
    by_status = {
        "ok": 0,
        "dead": 0,
        "blocked": 0,
        "timeout": 0,
        "private": 0,
    }

    for idx in sample_indices:
        source = sources[idx]
        if not source.get("source_url"):
            continue

        url = source["source_url"]
        meme_id = source["id"]

        print(f"[{idx}/{len(sources)-1}] Checking: {url}")

        if is_youtube_url(url):
            verdict = check_youtube(url)
        else:
            verdict = check_url(url)

        by_status[verdict] += 1

        if verdict != "ok":
            dead_urls.append({
                "meme_id": meme_id,
                "url": url,
                "verdict": verdict,
            })

        # Wait 0.3 seconds between requests
        time.sleep(0.3)

    result = {
        "checked": len(sample_indices),
        "byStatus": by_status,
        "deadUrls": dead_urls[:40],
    }

    print("\n=== RESULTS ===")
    print(json.dumps(result, indent=2))

    # Write to file
    with open("/Users/toris/projects/memecatch/artifacts/renewal/loop-024/url-check-results.json", "w") as f:
        json.dump(result, f, indent=2)

    print("\nResults saved to url-check-results.json")

    return result

if __name__ == "__main__":
    main()
