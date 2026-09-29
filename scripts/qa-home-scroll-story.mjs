/** Local, disposable-browser verification. Uses actual native scroll and rendered Three.js state. */
export async function exerciseHomeScrollStory({cdp, evaluate, navigate, record, delay}) {
  const checks = [], matrix = [];
  const check = (name, ok, details = {}) => {
    const value = {name, ok:Boolean(ok), ...details}; checks.push(value); console.log(JSON.stringify(value));
  };
  const wait = async (expression, name) => {
    for (let n=0;n<100;n++) { if(await evaluate(expression)) return; await delay(100); }
    throw new Error(`Scroll QA did not settle: ${name}`);
  };
  const state = () => evaluate(`(() => {
    const c=document.querySelector('[data-home-scene-canvas]');
    const track=document.querySelector('[data-home-scroll-track]');
    const pin=document.querySelector('[data-home-scroll-pin]');
    const stage=document.querySelector('[data-home-scene-stage]');
    return {progress:Number(c?.dataset.scrollProgress), target:Number(c?.dataset.scrollTarget),
      yaw:Number(c?.dataset.viewYaw), pitch:Number(c?.dataset.viewPitch), layout:Number(c?.dataset.layoutProgress),
      controlled:c?.dataset.scrollControlled, mode:document.querySelector('figure')?.dataset.layoutMode,
      pin:getComputedStyle(pin).position, canvasCount:document.querySelectorAll('[data-home-scene-canvas]').length,
      controls:document.querySelectorAll('[data-scene-layout]').length, sections:[...document.querySelectorAll('[data-home-section]')].map(x=>x.dataset.homeSection),
      width:innerWidth, scrollWidth:document.documentElement.scrollWidth, draws:window.__qaDraws,
      stage:stage.getBoundingClientRect().toJSON(), track:track.getBoundingClientRect().toJSON(),
      pinHeight:pin.getBoundingClientRect().height, pageY:scrollY};
  })()`);
  const scrollToProgress = async (progress) => {
    await evaluate(`(() => {
      const track=document.querySelector('[data-home-scroll-track]');
      const pin=document.querySelector('[data-home-scroll-pin]');
      const stage=document.querySelector('[data-home-scene-stage]');
      const r=track.getBoundingClientRect(), s=stage.getBoundingClientRect(), p=pin.getBoundingClientRect(), style=getComputedStyle(pin);
      const y=style.position==='sticky'
        ? scrollY+r.top-parseFloat(style.top)+${progress}*(r.height-p.height)
        : scrollY+s.top-innerHeight*.8+${progress}*(innerHeight*.8+s.height*.4);
      window.scrollTo({top:Math.max(0,y),behavior:'instant'});
    })()`);
    await delay(120);
  };
  const settle = async () => {
    await wait(`(() => { const c=document.querySelector('[data-home-scene-canvas]'); return c && c.dataset.scrollControlled==='true' && Math.abs(Number(c.dataset.scrollProgress)-Number(c.dataset.scrollTarget))<.015; })()`, 'physical progress');
    await delay(120);
  };
  const click = async (selector) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest',behavior:'instant'})`);
    await delay(80);
    const r=await evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON()`);
    const x=r.x+r.width/2,y=r.y+r.height/2;
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});
    await delay(120);
  };
  const locales=[['ko','/?lang=ko'],['en','/en'],['ja','/ja'],['zh','/zh'],['zh-tw','/zh-tw']];
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  for(const width of [1440,375]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===375?812:1000,deviceScaleFactor:1,mobile:width===375});
    for(const [locale,path] of locales) {
      await navigate(path);
      await wait("document.querySelector('[data-home-scene-canvas]')?.dataset.scrollControlled === 'true'", `${locale} initialized`);
      await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5});
      await scrollToProgress(.1); await settle(); const start=await state();
      if(locale==='ko') await record(`scroll-${width}-start`);
      await scrollToProgress(.5); await settle(); const middle=await state();
      if(locale==='ko') await record(`scroll-${width}-middle`);
      await scrollToProgress(.85); await settle(); const end=await state();
      if(locale==='ko') await record(`scroll-${width}-end`);
      await scrollToProgress(.1); await settle(); const reversed=await state();
      const row={locale,width,pin:start.pin,start:start.progress,middle:middle.progress,end:end.progress,
        reversed:reversed.progress,yawStart:start.yaw,yawEnd:end.yaw,controls:start.controls,sections:start.sections};
      matrix.push(row);
      check(`${locale}-${width}: scroll down/up moves the rendered pose reversibly`,
        end.progress-start.progress>.45 && middle.progress>start.progress && middle.progress<end.progress
        && Math.abs(reversed.progress-start.progress)<.035 && Math.abs(end.yaw-start.yaw)>.05
        && Math.abs(end.layout-start.layout)>.45 && end.draws>start.draws, row);
      check(`${locale}-${width}: shared layout and usable viewport`,start.canvasCount===1 && start.controls===3
        && start.sections.length===5 && start.scrollWidth<=width && end.stage.bottom>100
        && (width===375?start.pin!=='sticky':start.pin==='sticky'));
    }
  }
  check('five locales use the same geometry rules at each breakpoint', [375,1440].every(width=> {
    const rows=matrix.filter(r=>r.width===width);return rows.every(r=>r.pin===rows[0].pin
      && JSON.stringify(r.sections)===JSON.stringify(rows[0].sections)
      && Math.abs(r.middle-.5)<.035 && Math.abs(r.end-.85)<.035);
  }));

  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate('/?lang=ko'); await scrollToProgress(.35); await settle();
  await click('[data-scene-playback]'); await delay(200); const paused=await state();
  await scrollToProgress(.75); await delay(300); const frozen=await state();
  check('pause freezes scroll pose and makes no extra GPU draws', frozen.draws===paused.draws
    && frozen.progress===paused.progress && frozen.yaw===paused.yaw);
  await click('[data-scene-layout="stacked"]'); const pausedStack = await state();
  check('Stack immediately resets a paused scroll pose', pausedStack.layout===0 && pausedStack.yaw===0 && pausedStack.controlled==='false');
  await click('[data-scene-layout="scroll"]');
  await click('[data-scene-playback]'); await settle(); const resumed=await state();
  check('play resumes at the current scroll position',resumed.progress>paused.progress+.2);
  await click('[data-scene-layout="spread"]'); await delay(1000);
  await scrollToProgress(.15); await delay(200); const manual=await state();
  check('manual spread is not overwritten by scrolling',manual.controlled==='false' && manual.layout>.98);
  await click('[data-scene-layout="scroll"]'); await settle();
  check('scroll mode can be restored after manual interaction',(await state()).controlled==='true');

  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await delay(300); const reducedBefore=await state();
  await scrollToProgress(.7); await delay(250); const reducedAfter=await state();
  check('reduced motion disables pinning and scroll animation',reducedBefore.pin!=='sticky'
    && reducedBefore.progress===reducedAfter.progress && reducedBefore.draws===reducedAfter.draws);
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await delay(200); await scrollToProgress(.5); await settle();

  const injection=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"const original=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:original.call(this,type,...args)}"});
  await navigate('/en');
  check('WebGL fallback has no pinned spacer and retains content',await evaluate(`document.querySelector('figure')?.dataset.renderer==='static'
    && !document.querySelector('[data-home-scroll-track]').hasAttribute('data-home-scroll-ready')
    && !!document.querySelector('[data-home-scene-fallback]') && !!document.querySelector('h1')
    && [...document.querySelectorAll('[data-scene-layout]')].every(x=>x.disabled)`));
  await record('scroll-static-fallback');
  await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier});
  return {ok:checks.every(x=>x.ok), checks, matrix};
}
