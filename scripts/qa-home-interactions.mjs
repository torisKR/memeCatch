/** Browser-only interaction assertions, called from the disposable local QA session. */
export async function exerciseHomeInteractions({ cdp, evaluate, navigate, record, delay }) {
  const checks = [];
  const check = (name, ok, details = {}) => {
    checks.push({ name, ok: Boolean(ok), ...details });
    console.log(JSON.stringify(checks.at(-1)));
  };
  const state = () => evaluate(`(() => {
    const canvas = document.querySelector('[data-home-scene-canvas]');
    const buttons = [...document.querySelectorAll('figure[data-renderer] button[aria-pressed]')];
    return { selected: canvas?.dataset.selectedSignal, yaw: Number(canvas?.dataset.viewYaw ?? 0),
      pitch: Number(canvas?.dataset.viewPitch ?? 0), pressed: buttons.map(b => b.getAttribute('aria-pressed') === 'true'),
      explanation: document.querySelector('figure[data-renderer] [aria-live="polite"]')?.textContent,
      count: buttons.length, renderer: document.querySelector('figure[data-renderer]')?.dataset.renderer };
  })()`);
  const enter = async () => {
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await delay(100);
  };
  const mouse = (type, x, y, extra = {}) => cdp('Input.dispatchMouseEvent', { type, x, y, ...extra });
  const clickAt = async (x, y) => {
    await mouse('mouseMoved', x, y);
    await mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 });
    await mouse('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 });
    await delay(120);
  };
  const clickControl = async (selector) => {
    await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing QA control');const r=e.getBoundingClientRect();if(r.top<80 || r.bottom>innerHeight) e.scrollIntoView({block:'center',behavior:'instant'});})()`);
    await delay(80);
    const box = await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing QA control');return e.getBoundingClientRect().toJSON();})()`);
    await clickAt(box.x + box.width / 2, box.y + box.height / 2);
  };

  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 980, deviceScaleFactor: 1, mobile: false });
  await navigate('/?lang=ko');
  // Explicit manual mode isolates pointer behavior from the separately tested scroll story.
  await clickControl('[data-scene-layout="stacked"]');
  // Freeze ambient motion so pointer assertions cannot pass from automatic animation.
  await clickControl('[data-scene-playback]');
  const labels = ['green', 'yellow', 'gray', 'red'];
  let previous = await state();
  check('four native signal controls', previous.count === 4);
  for (const i of [1, 2, 3, 0]) {
    await evaluate(`document.querySelectorAll('figure[data-renderer] button[aria-pressed]')[${i}].focus()`);
    await enter();
    const current = await state();
    check(`keyboard selection ${labels[i]}`, current.selected === labels[i] && current.pressed[i]
      && current.pressed.filter(Boolean).length === 1 && current.explanation && current.explanation !== previous.explanation,
      { selected: current.selected });
    if (i === 3) await record('interactive-red-desktop');
    previous = current;
  }

  await clickControl('[data-scene-reset]');
  const before = await state();
  const bounds = await evaluate("document.querySelector('[data-home-scene-canvas]').getBoundingClientRect().toJSON()");
  const x = bounds.x + bounds.width * 0.48;
  const y = bounds.y + bounds.height * 0.51;
  await mouse('mouseMoved', x, y);
  await mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 });
  for (let n = 1; n <= 8; n++) {
    await mouse('mouseMoved', x + n * 12, y + n * 2, { button: 'left', buttons: 1 });
    await delay(18);
  }
  await mouse('mouseReleased', x + 96, y + 16, { button: 'left', buttons: 0, clickCount: 1 });
  const dragged = await state();
  check('native mouse drag rotates paused scene without selecting a token', Math.abs(dragged.yaw - before.yaw) > 0.02
    && dragged.selected === before.selected, { before: before.yaw, after: dragged.yaw });
  await record('interactive-drag-desktop');
  await clickControl('[data-scene-reset]');
  const reset = await state();
  check('reset restores orientation without changing selection', Math.abs(reset.yaw) < 0.001
    && Math.abs(reset.pitch) < 0.001 && reset.selected === before.selected, reset);

  // Pick an actual rendered token; coordinates are fractions of the visible canvas,
  // and a hit is verified through the React-controlled selection, not a synthetic callback.
  // A small set of sample positions accommodates camera fitting at this fixed viewport.
  let picked = false;
  const attempts = [];
  // The compact studio stage places the red token near x=0.36, y=0.36;
  // this was measured from the rendered 1440px QA image, not a callback injection.
  for (const [fx, fy] of [[0.36, 0.36], [0.35, 0.35], [0.33, 0.35], [0.31, 0.36], [0.28, 0.36], [0.22, 0.36]]) {
    await clickAt(bounds.x + bounds.width * fx, bounds.y + bounds.height * fy);
    const current = await state();
    attempts.push({ fx, fy, selected: current.selected });
    if (current.selected === 'red' && current.pressed[3]) { picked = true; break; }
  }
  check('actual 3D token click synchronizes the HTML selection', picked, { attempts });
  await clickControl('[data-scene-playback]');
  await mouse('mouseMoved', bounds.x + bounds.width * 0.88, bounds.y + bounds.height * 0.4);
  await delay(120);
  const hovered = await state();
  check('fine-pointer hover tilts the scene', Math.abs(hovered.yaw) > 0.01, { yaw: hovered.yaw });

  // A vertical touch gesture over the 3D stage must scroll the page, not rotate it.
  await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await navigate('/?lang=ko');
  await clickControl('[data-scene-playback]');
  await evaluate("document.querySelector('[data-home-scene-stage]').scrollIntoView({block:'center',behavior:'instant'})");
  await delay(180);
  await clickControl('[data-scene-layout="stacked"]');
  const mobileBefore = await state();
  const scrollBefore = await evaluate('window.scrollY');
  const mobileBox = await evaluate("document.querySelector('[data-home-scene-canvas]').getBoundingClientRect().toJSON()");
  const tx = mobileBox.x + mobileBox.width * 0.5;
  const ty = mobileBox.y + mobileBox.height * 0.75;
  const touch = async (type, touchPoints) => cdp('Input.dispatchTouchEvent', { type, touchPoints });
  await touch('touchStart', [{ x: tx, y: ty, id: 1, radiusX: 2, radiusY: 2, force: 1 }]);
  for (let n = 1; n <= 8; n++) {
    await touch('touchMove', [{ x: tx + 1, y: ty - n * 15, id: 1, radiusX: 2, radiusY: 2, force: 1 }]);
    await delay(28);
  }
  await touch('touchEnd', []);
  await delay(250);
  const scrollY = await evaluate('window.scrollY');
  const mobileAfter = await state();
  check('vertical touch scroll is preserved over the canvas', scrollY - scrollBefore > 30
    && Math.abs(mobileAfter.yaw - mobileBefore.yaw) < 0.01
    && mobileAfter.selected === mobileBefore.selected, { scrollY });
  await evaluate("document.querySelector('[data-home-scene-stage]').scrollIntoView({block:'center',behavior:'instant'})");
  await delay(180);
  const horizontalBox = await evaluate("document.querySelector('[data-home-scene-canvas]').getBoundingClientRect().toJSON()");
  const hx = horizontalBox.x + horizontalBox.width * 0.3;
  const hy = horizontalBox.y + horizontalBox.height * 0.48;
  await touch('touchStart', [{ x: hx, y: hy, id: 2, radiusX: 2, radiusY: 2, force: 1 }]);
  for (let n = 1; n <= 6; n++) {
    await touch('touchMove', [{ x: hx + n * 12, y: hy + 1, id: 2, radiusX: 2, radiusY: 2, force: 1 }]);
    await delay(25);
  }
  await touch('touchEnd', []);
  const mobileDragged = await state();
  check('horizontal native touch drag rotates without selecting', Math.abs(mobileDragged.yaw) > 0.02
    && mobileDragged.selected === mobileBefore.selected, { yaw: mobileDragged.yaw });
  await record('interactive-mobile');
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });

  const injection = await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: "const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:original.call(this,type,...args)};",
  });
  await navigate('/en');
  const initialStatic = await state();
  await evaluate("document.querySelectorAll('figure[data-renderer] button[aria-pressed]')[3].focus()");
  await enter();
  const changedStatic = await state();
  check('no-WebGL visitors can select and read signals', initialStatic.renderer === 'static'
    && changedStatic.pressed[3] && changedStatic.explanation !== initialStatic.explanation);
  await record('interactive-fallback-mobile');
  await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });

  return { ok: checks.every(c => c.ok), checks };
}
