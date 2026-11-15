/** Native-browser checks for the renewed landing; runs only against the QA runner's local origin. */
export async function exerciseWeb3Home({ cdp, evaluate, navigate, record, delay }) {
  const checks = [];
  const check = (name, ok, detail = {}) => {
    const result = { name, ok: Boolean(ok), ...detail };
    checks.push(result);
    console.log(JSON.stringify(result));
  };
  const click = async (selector) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',behavior:'instant'})`);
    await delay(80);
    const rect = await evaluate(`document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect().toJSON()`);
    if (!rect) throw new Error(`Missing landing QA control: ${selector}`);
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    await cdp('Input.dispatchMouseEvent', { type:'mousePressed', x, y, button:'left', buttons:1, clickCount:1 });
    await cdp('Input.dispatchMouseEvent', { type:'mouseReleased', x, y, button:'left', buttons:0, clickCount:1 });
    await delay(180);
  };
  await cdp('Emulation.setDeviceMetricsOverride', { width:1440, height:1000, deviceScaleFactor:1, mobile:false });
  await navigate('/en');
  const hierarchy = await evaluate(`(() => {
    const h = document.querySelector('h1');
    const form = document.querySelector('[data-home-section="hero-search"] form[role="search"]');
    const scene = document.querySelector('figure[data-scene-variant="hero"]');
    const targets = ['home-latest','home-signals','home-pathways','home-editorial'];
    return { headingBeforeScene: !!(h && scene && h.compareDocumentPosition(scene)&Node.DOCUMENT_POSITION_FOLLOWING),
      searchBeforeScene: !!(form && scene && form.compareDocumentPosition(scene)&Node.DOCUMENT_POSITION_FOLLOWING),
      h1s:document.querySelectorAll('h1').length, canvases:document.querySelectorAll('[data-home-scene-canvas]').length,
      targets:targets.every(id => document.getElementById(id)),
      searchAction:form?.getAttribute('action') };
  })()`);
  check('integrated hero keeps real search and one heading before one 3D scene',
    hierarchy.headingBeforeScene && hierarchy.searchBeforeScene && hierarchy.h1s === 1 && hierarchy.canvases === 1 && hierarchy.searchAction === '/en/search', hierarchy);
  check('all chapter anchors have real destination sections', hierarchy.targets);
  await record('web3-desktop-hero');

  // Exercise data-dependent filters on Korean records; localized feeds can legitimately be empty.
  await navigate('/?lang=ko');
  await click('a[href="#home-latest"]');
  check('native latest chapter navigation reaches the section', await evaluate("location.hash === '#home-latest' && document.getElementById('home-latest').getBoundingClientRect().top < innerHeight"));
  const deck = '#home-latest [aria-label="필터된 최근 항목"]';
  const search = '#home-latest input[type="search"]';
  const initial = await evaluate(`(() => {
    const list=document.querySelector(${JSON.stringify(deck)});
    return {count:list?.children.length ?? 0, title:list?.querySelector('h3')?.textContent ?? '', hasSearch:!!document.querySelector(${JSON.stringify(search)})};
  })()`);
  if (initial.count > 0) {
    await click(search);
    await cdp('Input.insertText', { text:'__no_matching_meme_qa_42__' });
    await delay(120);
    check('recent-only query renders an honest zero-result state', await evaluate(`!document.querySelector(${JSON.stringify(deck)}) && !![...document.querySelectorAll('#home-latest button')].find(b=>b.textContent.trim()==='필터 초기화')`));
    const clearSelector = '#home-latest button[data-qa-clear]';
    // Tag only an already visible semantic button in this disposable test page.
    await evaluate("[...document.querySelectorAll('#home-latest button')].find(b=>b.textContent.trim()==='필터 초기화')?.setAttribute('data-qa-clear','true')");
    await click(clearSelector);
    check('clear filters restores the entire supplied recent set', await evaluate(`document.querySelector(${JSON.stringify(deck)})?.children.length === ${initial.count} && document.querySelector(${JSON.stringify(search)})?.value === ''`));

    const categories = '#home-latest [aria-label="카테고리로 필터"]';
    const categoryCount = await evaluate(`document.querySelector(${JSON.stringify(categories)})?.querySelectorAll('button').length ?? 0`);
    if (categoryCount > 1) {
      await click(`${categories} button:nth-of-type(2)`);
      const filtered = await evaluate(`({count:document.querySelector(${JSON.stringify(deck)})?.children.length ?? 0, pressed:document.querySelector(${JSON.stringify(categories)})?.querySelectorAll('button')[1]?.getAttribute('aria-pressed')})`);
      check('category selection changes only the supplied recent deck', filtered.count > 0 && filtered.count <= initial.count && filtered.pressed === 'true', filtered);
      await click(`${categories} button:first-of-type`);
    }
    const preview = '#home-latest [aria-label="다음 선택 미리보기"]';
    const before = await evaluate(`document.querySelector(${JSON.stringify(preview)})?.querySelector('a')?.getAttribute('href')`);
    const nextButton = `${preview} button`;
    const enabled = await evaluate(`!!document.querySelector(${JSON.stringify(nextButton)}) && !document.querySelector(${JSON.stringify(nextButton)}).disabled`);
    if (enabled) {
      await click(nextButton);
      const after = await evaluate(`document.querySelector(${JSON.stringify(preview)})?.querySelector('a')?.getAttribute('href')`);
      check('next-pick control chooses a different real linked entry', !!before && !!after && before !== after, { before, after });
    }
    await record('web3-latest-discovery');
  } else {
    check('empty published set does not fabricate content or active filters', !initial.hasSearch, { note:'No real recent records available for data-dependent checks.' });
  }

  await click('a[href="#home-pathways"]');
  check('participation paths preserve community and meme submission entry points', await evaluate(`['/community','/community/new','/submit'].every(path=>[...document.querySelectorAll('[data-home-section="pathways"] a')].some(a=>a.getAttribute('href')===path)) && ![...document.querySelectorAll('a')].some(a=>a.getAttribute('href')==='/products' || a.getAttribute('href')==='/products/new')`));
  await record('web3-community-products');

  await cdp('Emulation.setDeviceMetricsOverride', {width:375,height:812,deviceScaleFactor:1,mobile:true});
  await navigate('/?lang=ko');
  check('mobile full-site search is reachable before artwork', await evaluate(`(() => {const f=document.querySelector('[data-home-section="hero-search"] form'); const s=document.querySelector('[data-home-scene-stage]'); return !!f && !!s && f.getBoundingClientRect().top < s.getBoundingClientRect().top && document.documentElement.scrollWidth <= innerWidth;})()`));
  await record('web3-mobile-hero');
  return { ok: checks.every(c=>c.ok), checks };
}
