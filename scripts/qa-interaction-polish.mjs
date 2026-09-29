/** Additional native input QA; caller enforces loopback and an isolated Chrome profile. */
export async function exerciseInteractionPolish({ cdp, evaluate, navigate, record, delay }) {
  const checks = [];
  const check = (name, ok, details = {}) => {
    const row = { name, ok: Boolean(ok), ...details };
    checks.push(row); console.log(JSON.stringify(row));
  };
  const until = async expression => {
    for (let i = 0; i < 50; i++) { if (await evaluate(expression)) return true; await delay(80); }
    return false;
  };
  const move = (x, y) => cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  const click = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',behavior:'instant'})`);
    await delay(120);
    const r = await evaluate(`document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect().toJSON()`);
    if (!r) throw new Error(`Missing polish control: ${selector}`);
    const x=r.x+r.width/2, y=r.y+r.height/2;
    await move(x,y);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});
    await delay(100);
  };
  const canvas = 'document.querySelector("[data-home-scene-canvas]")';
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:false});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'},{name:'prefers-color-scheme',value:'light'}]});
  await navigate('/?lang=ko');
  check('layout switch is enabled after actual WebGL initialization', await until(`${canvas} && !document.querySelector('[data-scene-layout="spread"]').disabled`));
  await click('[data-scene-layout="spread"]');
  check('spread layout reaches its physical endpoint', await until(`${canvas}?.dataset.layoutMode === 'spread' && Number(${canvas}?.dataset.layoutProgress) > 0.98`));
  await record('polish-spread-desktop');
  await click('[data-scene-playback]');
  await click('[data-scene-layout="stacked"]');
  check('paused layout change settles immediately', await evaluate(`${canvas}?.dataset.layoutMode === 'stacked' && Number(${canvas}?.dataset.layoutProgress) < 0.001`));
  const drawCount = await evaluate('window.__qaDraws');
  await delay(350);
  check('paused layout does not keep an animation loop running', await evaluate(`window.__qaDraws === ${drawCount}`));
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await click('[data-scene-layout="spread"]');
  check('reduced-motion visitors can change layout without animation', await evaluate(`Number(${canvas}?.dataset.layoutProgress) > 0.999 && document.querySelector('[data-scene-playback]').disabled`));
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await click('[data-scene-layout="stacked"]');

  await click('[data-home-chapters] a[href="#home-latest"]');
  check('chapter rail reflects actual native-anchor position', await until(`document.querySelector('[data-home-chapters] a[aria-current="location"]')?.getAttribute('href') === '#home-latest'`));
  const cardCount = await evaluate('document.querySelectorAll("[data-interactive-card]").length');
  if (cardCount) {
    await evaluate('document.querySelector("[data-interactive-card]").scrollIntoView({block:"center",behavior:"instant"})');
    await delay(180);
    const r = await evaluate('document.querySelector("[data-interactive-card]").getBoundingClientRect().toJSON()');
    await move(r.x+r.width*0.78,r.y+r.height*0.32); await delay(220);
    const tilted = await evaluate(`(() => {const e=document.querySelector('[data-interactive-card]');return {tilt:e.dataset.tilt,active:e.dataset.pointerActive,transform:getComputedStyle(e).transform};})()`);
    const values = (tilted.tilt ?? '').split(',').map(Number);
    check('real pointer input tilts and lights editorial cards within four degrees', tilted.active === 'true' && values.some(v=>Math.abs(v)>0.1) && values.every(v=>Number.isFinite(v)&&Math.abs(v)<=4), tilted);
    await record('polish-pointer-card');
    await move(4,80); await delay(180);
    check('leaving a card restores its neutral pose', await evaluate(`document.querySelector('[data-interactive-card]').dataset.tilt === '0,0' && !document.querySelector('[data-interactive-card]').dataset.pointerActive`));
    await move(r.x+r.width*0.72,r.y+r.height*0.3);
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await delay(150);
    check('motion preference changes immediately clear card transforms', await evaluate(`document.querySelector('[data-interactive-card]').dataset.tilt === '0,0' && !document.querySelector('[data-interactive-card]').style.getPropertyValue('--card-tilt-x')`));
  } else {
    check('no fabricated cards when the real recent feed is empty', true, { skipped:'Live card-input checks: no real records available.' });
  }
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await click('[data-home-chapters] a[href="#home-signals"]');
  check('exactly one active chapter follows the next section', await until(`document.querySelectorAll('[data-home-chapters] [aria-current="location"]').length === 1 && document.querySelector('[data-home-chapters] [aria-current="location"]').getAttribute('href') === '#home-signals'`));
  await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await navigate('/?lang=ko');
  check('compact mobile hero shows search and a substantial part of the 3D stage', await evaluate(`(() => {const f=document.querySelector('[data-home-section="hero-search"] form');const s=document.querySelector('[data-home-scene-stage]');return f.getBoundingClientRect().bottom<innerHeight && s.getBoundingClientRect().top<innerHeight-120 && document.documentElement.scrollWidth<=innerWidth;})()`));
  await record('polish-mobile-hero');
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:false});
  return {ok:checks.every(c=>c.ok),checks};
}
