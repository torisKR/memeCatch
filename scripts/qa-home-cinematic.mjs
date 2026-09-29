/** Local-only full-composition QA, executed by qa-unified-home.mjs --cinematic. */
export async function exerciseHomeCinematic({ cdp, evaluate, navigate, record, delay }) {
  const checks = [];
  const check = (name, ok, details = {}) => {
    const row = { name, ok: Boolean(ok), ...details };
    checks.push(row); console.log(JSON.stringify(row));
  };
  const click = async (selector) => {
    const box = await evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Missing cinematic control'); return el.getBoundingClientRect().toJSON();})()`);
    const x=box.x+box.width/2, y=box.y+box.height/2;
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});
    await delay(180);
  };
  const sample = () => evaluate(`(() => {
    const canvas=document.querySelector('[data-home-scene-canvas]');
    const pin=document.querySelector('[data-home-scroll-pin]');
    const scene=document.querySelector('[data-story-scene]');
    const h=document.querySelector('h1');
    const sr=scene?.getBoundingClientRect(), hr=h?.getBoundingClientRect();
    return {width:innerWidth, overflow:document.documentElement.scrollWidth>innerWidth+1,
      chapters:[...document.querySelectorAll('[data-story-chapter]')].map(e=>e.dataset.storyChapter),
      h1s:document.querySelectorAll('h1').length, canvasCount:document.querySelectorAll('[data-home-scene-canvas]').length,
      sameCanvas:window.__cinematicCanvas===canvas, renderer:scene?.dataset.renderer,
      progress:Number(canvas?.dataset.scrollProgress), yaw:Number(canvas?.dataset.viewYaw),
      sceneWidth:sr?.width, sceneCenter:sr ? sr.x+sr.width/2 : null,
      headingCenter:hr ? hr.x+hr.width/2 : null, pin:getComputedStyle(pin).position,
      pinTop:pin.getBoundingClientRect().top, draws:window.__qaDraws};
  })()`);
  const moveToChapter = async (id) => {
    await evaluate(`(() => {const section=document.getElementById('home-story-'+${JSON.stringify(id)});const pin=document.querySelector('[data-home-scroll-pin]');const top=parseFloat(getComputedStyle(pin).top)||0;window.scrollTo({top:Math.max(0,scrollY+section.getBoundingClientRect().top-top),behavior:'instant'});})()`);
    await delay(550);
  };
  const locales=[['ko','/?lang=ko'],['en','/en'],['ja','/ja'],['zh','/zh'],['zh-tw','/zh-tw']];
  for(const width of [1440,768,375]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===375?812:960,deviceScaleFactor:1,mobile:width===375});
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    for(const [locale,path] of locales) {
      await navigate(path);
      await evaluate('window.__cinematicCanvas=document.querySelector("[data-home-scene-canvas]")');
      await moveToChapter('discover'); const first=await sample();
      check(`${locale}-${width}: one centered full-width composition, not a split hero`,
        first.h1s===1 && first.canvasCount===1 && first.sceneWidth>=width*0.92
        && Math.abs(first.headingCenter-first.sceneCenter)<24 && !first.overflow
        && first.chapters.join(',')==='discover,context,participate',first);
      if(locale==='ko') {
        await record(`cinematic-${width}-discover`);
        const hit = await evaluate(`(() => { const el=document.querySelector('[data-home-scene-canvas]');const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height*0.45)===el; })()`);
        check(`${width}: artwork receives real pointer input through the text composition`, hit);
      }
      await moveToChapter('context'); const middle=await sample();
      if(locale==='ko') await record(`cinematic-${width}-context`);
      await moveToChapter('participate'); const last=await sample();
      if(locale==='ko') await record(`cinematic-${width}-participate`);
      await moveToChapter('discover'); const reverse=await sample();
      check(`${locale}-${width}: section-by-section scroll reuses and reverses the same 3D scene`,
        middle.sameCanvas && last.sameCanvas && reverse.sameCanvas && last.progress>first.progress+0.4
        && middle.progress>first.progress+0.15 && middle.progress<last.progress
        && Math.abs(reverse.progress-first.progress)<0.08 && Math.abs(last.yaw-first.yaw)>0.06,
        {start:first.progress,middle:middle.progress,end:last.progress,reverse:reverse.progress});
      check(`${locale}-${width}: all three chapters expose native actions`, await evaluate(`(() => {
        const form=document.querySelector('[data-story-chapter="discover"] form');
        return form?.getAttribute('action')===${JSON.stringify(locale==='ko'?'/search':`/${locale}/search`)}
          && !!document.querySelector('[data-story-chapter="context"] a[href="#home-signals"]')
          && !!document.querySelector('[data-story-chapter="participate"] a[href="/community"]')
          && !!document.querySelector('[data-story-chapter="participate"] a[href="/products"]')
          && document.querySelectorAll('[data-home-section]').length===5;
      })()`));
    }
  }

  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
  await navigate('/?lang=ko');
  await moveToChapter('discover');
  await evaluate("document.getElementById('home-story-search-ko').focus()");
  for(let n=0;n<2;n++) {
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  }
  check('keyboard reaches the visible scene controls directly after the search form',await evaluate("document.activeElement===document.querySelector('[data-story-controls] summary')"));
  await moveToChapter('discover');
  const wheelBefore=await sample();
  const wheelBox=await evaluate("document.querySelector('[data-home-scene-canvas]').getBoundingClientRect().toJSON()");
  await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:wheelBox.x+wheelBox.width/2,y:wheelBox.y+wheelBox.height/2,deltaX:0,deltaY:240});
  await delay(650);const wheelAfter=await sample();
  check('native mouse wheel advances chapter-linked geometry without hijacking scroll',wheelAfter.progress>wheelBefore.progress+0.05);
  await moveToChapter('context');
  await click('[data-scene-playback]');
  await delay(150); const paused=await sample();
  await moveToChapter('participate'); const still=await sample();
  check('pause freezes scene despite chapter scrolling',paused.progress===still.progress && paused.draws===still.draws);
  await click('[data-scene-playback]'); await delay(550); const resumed=await sample();
  check('play resumes from the current chapter',resumed.progress>still.progress+0.2);

  await click('[data-story-controls] summary');
  check('scene controls stay collapsed until requested',await evaluate("document.querySelector('[data-story-controls]').open"));
  await click('[data-scene-layout="stacked"]'); await delay(700);
  check('manual stack overrides scroll',await evaluate("document.querySelector('[data-home-scene-canvas]').dataset.scrollControlled==='false' && Number(document.querySelector('[data-home-scene-canvas]').dataset.layoutProgress)<0.02"));
  await click('[data-scene-layout="scroll"]'); await delay(550);
  check('scroll can take control again',await evaluate("document.querySelector('[data-home-scene-canvas]').dataset.scrollControlled==='true'"));
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  check('Escape closes controls and restores summary focus',await evaluate("!document.querySelector('[data-story-controls]').open && document.activeElement===document.querySelector('[data-story-controls] summary')"));

  await evaluate("document.getElementById('home-latest').scrollIntoView({behavior:'instant',block:'start'})"); await delay(200);
  check('story releases into real recent content without an overlay trapping it',await evaluate("document.querySelector('[data-story-scene]').getBoundingClientRect().bottom < 140 && document.getElementById('home-latest').getBoundingClientRect().top < innerHeight"));
  const d=await sample(); await delay(250); const d2=await sample();
  check('offscreen story stops GPU frames',d.draws===d2.draws);

  await moveToChapter('context');
  const beforeLoss=await evaluate("document.getElementById('home-story-context').getBoundingClientRect().top");
  await evaluate("document.querySelector('[data-home-scene-canvas]').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()");
  await delay(450);
  const loss=await evaluate(`(() => {const stage=document.querySelector('[data-home-scene-stage]');const rect=stage.getBoundingClientRect();return {renderer:document.querySelector('[data-story-scene]').dataset.renderer, top:document.getElementById('home-story-context').getBoundingClientRect().top, visible:rect.bottom>108 && rect.top<innerHeight, svg:!!stage.querySelector('[data-home-scene-fallback]'), canvas:!!stage.querySelector('canvas')};})()`);
  check('GPU failure mid-story keeps the SVG visible without shifting the current chapter',loss.renderer==='failed' && loss.visible && loss.svg && !loss.canvas && Math.abs(loss.top-beforeLoss)<2,loss);
  await record('cinematic-mid-story-gpu-fallback');

  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await navigate('/en'); await delay(100); const reduced=await sample(); await delay(250); const reduced2=await sample();
  check('reduced motion keeps three readable sections without a pinned animation',reduced.pin!=='sticky' && reduced.draws===reduced2.draws && reduced.chapters.length===3);
  await record('cinematic-reduced-motion');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});

  const inject=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"const gc=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:gc.call(this,type,...args)};"});
  await navigate('/en'); const fallback=await sample();
  check('WebGL fallback preserves sections, search and a single SVG without empty pinning',fallback.renderer==='static' && fallback.canvasCount===0 && fallback.chapters.length===3 && fallback.pin!=='sticky');
  await record('cinematic-no-webgl');
  await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:inject.identifier});

  await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await navigate('/?lang=ko'); await moveToChapter('discover');
  const tb=await evaluate("document.querySelector('[data-home-scene-canvas]').getBoundingClientRect().toJSON()");
  const beforeTouch=await evaluate('scrollY'); const beforeTouchPose=await sample();
  const x=tb.x+tb.width/2, y=tb.y+tb.height*0.55;
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(let n=1;n<=8;n++) { await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-n*12,id:1}]});await delay(20); }
  await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await delay(550);
  const afterTouchPose=await sample();
  check('native mobile swipe scrolls the integrated scene and changes its pose',await evaluate(`scrollY>${beforeTouch+30}`) && afterTouchPose.progress>beforeTouchPose.progress+0.02);
  await cdp('Emulation.setTouchEmulationEnabled',{enabled:false});

  await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
  await navigate('/?lang=ko'); const short=await sample();
  check('small landscape/short-height layout has no overflow or pinned text trap',!short.overflow && short.pin!=='sticky' && short.chapters.length===3);
  await record('cinematic-short-mobile');
  return {ok:checks.every(c=>c.ok),checks};
}
