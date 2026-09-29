import test from 'node:test';
import assert from 'node:assert/strict';
import { Corpus, parseCorpus, safeMemeUrl } from '../src/corpus.mjs';

export const fixture=`### 국물이 끝내줘요
- URL: https://catchmeme.com/memes/abc12345-test
- 사용 안전도: ● 써도 됨
- 별칭: 국물이 끝네줘요
- 한 줄 뜻: 국물 요리를 맛있게 먹었을 때 표현
- 유래: 연도 확인 필요
### 조심할 표현
- URL: https://catchmeme.com/memes/risk1234-test
- 사용 안전도: ✕ 쓰면 위험
- 한 줄 뜻: 비하 맥락의 표현
### 잘못된 링크
- URL: https://attacker.invalid/memes/abc12345-test
- 한 줄 뜻: 표시하면 안 되는 항목
### 확인 안 된 표현
- URL: https://catchmeme.com/memes/unknown1-test
`;
export const fixtureCorpus=()=>new Corpus({fetcher:async()=>new Response(fixture)});

test('parser rejects foreign, script, credential and nested-path links',()=>{
  assert.equal(parseCorpus(fixture).length,3);
  for(const url of ['javascript:alert(1)','https://catchmeme.com.attacker.invalid/memes/abc12345-test','https://user@catchmeme.com/memes/abc12345-test','https://catchmeme.com/memes/abc12345-test/extra']) assert.equal(safeMemeUrl(url),null);
});
test('search handles aliases, scope, risk opt-in and details',async()=>{
  const corpus=fixtureCorpus();
  const result=await corpus.search({query:'국물 이 끝네 줘요'});
  assert.equal(result.memes[0].id,'abc12345'); assert.equal(result.corpusSize,3); assert.match(result.scope,/일부/);
  assert.equal((await corpus.search()).memes.length,1);
  assert.equal((await corpus.search({includeRisky:true})).memes.length,3);
  assert.equal((await corpus.get('abc12345')).memes[0].origin,'연도 확인 필요');
  await assert.rejects(corpus.get('notfound'),/찾지 못/);
  await assert.rejects(corpus.search({query:'!!!'}),/단어나/);
  await assert.rejects(corpus.search({limit:100}),/1~12/);
});
test('cache coalesces concurrent loads and refresh failures do not masquerade as fresh data',async()=>{
  let now=1000,calls=0,fail=false;
  const corpus=new Corpus({now:()=>now,ttlMs:100,fetcher:async()=>{calls++;if(fail)throw new Error('offline');return new Response(fixture);}});
  await Promise.all([corpus.search(),corpus.search()]);assert.equal(calls,1);
  now+=200;fail=true;await assert.rejects(corpus.search(),/offline/);assert.equal(calls,2);
});
