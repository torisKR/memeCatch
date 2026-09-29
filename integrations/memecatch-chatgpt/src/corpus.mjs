export const SOURCE = 'https://catchmeme.com/llms-full.txt';
export const SCOPE = '밈캐치가 공개 본문으로 제공하는 일부 밈을 검색합니다. 전체 사전 검색은 밈캐치 사이트를 이용하세요.';
const LIMIT_BYTES = 5 * 1024 * 1024;
const normalize = (value) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const FIELD_NAMES = { '사용 안전도': 'safety', '시기': 'year', '별칭': 'aliases', '한 줄 뜻': 'summary', '설명': 'description', '유래': 'origin', '사용법·주의': 'usage' };

export function safeMemeUrl(value) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://catchmeme.com' || url.username || url.password || url.search || url.hash) return null;
    if (!/^\/memes\/[a-z0-9]{3,36}-[^/]+$/i.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

export function parseCorpus(text) {
  const memes = [];
  const seen = new Set();
  for (const block of text.split(/^### /m).slice(1, 801)) {
    const lines = block.split('\n');
    const title = lines.shift().trim().slice(0, 240);
    const fields = {};
    for (const line of lines) {
      const match = line.match(/^- ([^:]+):\s*(.*)$/);
      if (match) fields[match[1].trim()] = match[2].trim().slice(0, 6000);
    }
    const url = safeMemeUrl(fields.URL);
    if (!title || !url || seen.has(url)) continue;
    const id = new URL(url).pathname.split('/')[2].split('-')[0];
    if (seen.has(id)) continue;
    const item = { id, title, url };
    for (const [field, property] of Object.entries(FIELD_NAMES)) item[property] = fields[field] || '';
    item.safetyCode = item.safety.includes('써도 됨') ? 'safe' : item.safety.includes('맥락 주의') ? 'context' : item.safety.includes('이미 늦음') ? 'outdated' : item.safety.includes('쓰면 위험') ? 'risky' : 'unknown';
    if (!item.safety) item.safety = '사용 안전도 정보 없음';
    memes.push(item);
    seen.add(id); seen.add(url);
  }
  if (!memes.length) throw new Error('공개 본문에서 밈 항목을 읽지 못했습니다.');
  return memes;
}

async function readLimited(response) {
  if (Number(response.headers.get('content-length')) > LIMIT_BYTES) throw new Error('공개 본문이 허용 크기를 초과했습니다.');
  const reader = response.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > LIMIT_BYTES) throw new Error('공개 본문이 허용 크기를 초과했습니다.');
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { await reader.cancel().catch(() => {}); }
}

export class Corpus {
  constructor({ fetcher = fetch, ttlMs = 300_000, now = Date.now } = {}) {
    this.fetcher = fetcher; this.ttlMs = ttlMs; this.now = now;
    this.cached = null; this.pending = null;
  }
  async load() {
    if (this.cached && this.now() - this.cached.at < this.ttlMs) return this.cached;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      const response = await this.fetcher(SOURCE, { redirect: 'error', signal: AbortSignal.timeout(12_000), headers: { Accept: 'text/plain' } });
      if (!response.ok) throw new Error('밈캐치 공개 본문을 불러오지 못했습니다.');
      const memes = parseCorpus(await readLimited(response));
      this.cached = { memes, at: this.now() };
      return this.cached;
    })();
    try { return await this.pending; } finally { this.pending = null; }
  }
  async search({ query = '', limit = 6, includeRisky = false } = {}) {
    if (typeof query !== 'string' || query.length > 160 || !Number.isInteger(limit) || limit < 1 || limit > 12 || typeof includeRisky !== 'boolean') throw new TypeError('검색어는 160자 이내, 결과 수는 1~12여야 합니다.');
    const { memes, at } = await this.load();
    const term = normalize(query.trim());
    if (query.trim() && !term) throw new TypeError('검색할 단어나 밈 이름을 입력하세요.');
    const scored = memes.filter(m => includeRisky || !['risky', 'unknown'].includes(m.safetyCode)).map(m => {
      const title = normalize(m.title); const aliases = normalize(m.aliases);
      const rest = normalize([m.summary, m.description, m.origin, m.usage].join(' '));
      return { meme: m, score: !term ? 1 : title === term ? 100 : title.includes(term) ? 60 : aliases.includes(term) ? 40 : rest.includes(term) ? 10 : 0 };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    return { query, memes: scored.slice(0, limit).map(x => x.meme), matched: scored.length, corpusSize: memes.length, scope: SCOPE, source: SOURCE, fetchedAt: new Date(at).toISOString(), siteSearchUrl: `https://catchmeme.com/search?q=${encodeURIComponent(query)}` };
  }
  async get(id) {
    if (typeof id !== 'string' || !/^[a-z0-9]{3,36}$/i.test(id)) throw new TypeError('유효한 밈 ID가 필요합니다.');
    const { memes, at } = await this.load();
    const meme = memes.find(m => m.id === id);
    if (!meme) throw new TypeError('공개 본문에서 해당 밈을 찾지 못했습니다.');
    return { memes: [meme], corpusSize: memes.length, scope: SCOPE, source: SOURCE, fetchedAt: new Date(at).toISOString() };
  }
}
