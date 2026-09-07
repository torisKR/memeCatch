#!/usr/bin/env node --no-warnings
/**
 * URL Liveness Checker
 * Queries meme_sources with offset=800, limit=800
 * Samples 80 rows at 10-row intervals
 * Checks each URL and returns structured results
 */

import { execFileSync } from 'child_process'

const SUPABASE_URL = 'https://onjipuldngbdptldkpoe.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uamlwdWxkbmdiZHB0bGRrcG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzczNTksImV4cCI6MjA5OTAxMzM1OX0.V2Jcyz9OuQwg8DDxR8QK6n78YPyJY-XTYE3hOS-VneM'

interface MemeSource {
  id: string
  source_url: string | null
}

interface UrlCheckResult {
  meme_id: string
  url: string
  verdict: 'ok' | 'dead' | 'blocked' | 'timeout' | 'private'
}

// Fetch data from Supabase
async function fetchMemeSources(): Promise<MemeSource[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/meme_sources?select=id,source_url&source_url=neq.null&offset=800&limit=800`,
    {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch meme_sources: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Check if URL is YouTube
function isYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')
  } catch {
    return false
  }
}

// Check YouTube URL via oEmbed
async function checkYouTube(url: string): Promise<'ok' | 'dead' | 'private'> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}`
    )
    if (response.ok) return 'ok'
    if (response.status === 404 || response.status === 401) return 'dead'
    return 'dead'
  } catch {
    return 'dead'
  }
}

// Check URL via curl HEAD/GET
async function checkUrl(url: string): Promise<'ok' | 'dead' | 'blocked' | 'timeout'> {
  try {
    // Try HEAD first
    const code = execFileSync('curl', ['-sIL', '-m', '8', '-o', '/dev/null', '-w', '%{http_code}', url], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    const httpCode = parseInt(code, 10)

    if (httpCode >= 200 && httpCode < 400) return 'ok'
    if (httpCode === 403 || httpCode === 451) return 'blocked'
    if (httpCode === 404 || httpCode === 410) return 'dead'
    if (httpCode === 0) return 'timeout'

    return 'ok' // Treat other codes as ok
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout'
    }
    return 'dead'
  }
}

// Main function
async function main() {
  console.log('Fetching meme_sources (offset=800, limit=800)...')
  const sources = await fetchMemeSources()
  console.log(`Total rows: ${sources.length}`)

  // Sample 80 rows at 10-row intervals (0, 10, 20, ..., 790)
  const sampleIndices = Array.from({ length: 80 }, (_, i) => i * 10).filter(
    (i) => i < sources.length
  )
  console.log(`Sampling ${sampleIndices.length} rows...`)

  const deadUrls: UrlCheckResult[] = []
  const byStatus: Record<string, number> = {
    ok: 0,
    dead: 0,
    blocked: 0,
    timeout: 0,
    private: 0,
  }

  for (const idx of sampleIndices) {
    const source = sources[idx]
    if (!source.source_url) continue

    const url = source.source_url
    console.log(`[${idx}/${sources.length - 1}] Checking: ${url}`)

    let verdict: 'ok' | 'dead' | 'blocked' | 'timeout' | 'private'

    if (isYouTubeUrl(url)) {
      const youtubeResult = await checkYouTube(url)
      verdict = youtubeResult
    } else {
      verdict = await checkUrl(url)
    }

    byStatus[verdict]++

    if (verdict !== 'ok') {
      deadUrls.push({
        meme_id: source.id,
        url: url,
        verdict: verdict,
      })
    }

    // Wait 0.3 seconds between requests
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  const result = {
    checked: sampleIndices.length,
    byStatus,
    deadUrls: deadUrls.slice(0, 40), // Limit to 40 for output
  }

  console.log('\n=== RESULTS ===')
  console.log(JSON.stringify(result, null, 2))

  // Also write to file
  const fs = await import('fs/promises')
  await fs.writeFile(
    '/Users/toris/projects/memecatch/artifacts/renewal/loop-024/url-check-results.json',
    JSON.stringify(result, null, 2)
  )
  console.log('\nResults saved to url-check-results.json')

  return result
}

main().catch(console.error)
