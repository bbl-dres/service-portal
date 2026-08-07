// Focused real-WebGL regression for the floor-plan editor's retained 3D camera.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const BUILDING_ID = '1080/6650/AA';
const FLOOR_ID = '1080-6650-AA-2og';
const ROUTE = `${APP_BASE}/app/floorplan-editor?building=${encodeURIComponent(BUILDING_ID)}&floor=${encodeURIComponent(FLOOR_ID)}`;
let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

const cdp = await launch({ webgl: true });
let page;
try {
  page = await openPage(cdp, ROUTE, { login: true });
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(350);
  const controls = await page.evaluate(`(async () => {
    const pause = (duration = 90) => new Promise(resolve => setTimeout(resolve, duration));
    document.querySelector('[data-action="view-3d"]')?.click();
    for (let i = 0; i < 50 && !document.querySelector('.fpe-three-canvas'); i++) await pause(40);
    const canvas = document.querySelector('.fpe-three-canvas');
    const host = document.querySelector('#fpe-three-host');
    const vector = value => String(value || '').split(',').map(Number);
    const state = () => ({
      target: vector(host?.dataset.orbitTarget),
      yaw: Number(host?.dataset.orbitYaw),
      pitch: Number(host?.dataset.orbitPitch),
      distance: Number(host?.dataset.orbitDistance),
      aspect: Number(host?.dataset.cameraAspect),
      fitRatio: Number(host?.dataset.orbitFitRatio),
      panScale: Number(host?.dataset.orbitPanScale),
    });
    const reset = async () => {
      document.querySelector('[data-action="three-reset"]')?.click();
      await pause();
    };
    const drag = async (button, dx, dy, pointerId, pointerType = 'mouse') => {
      const bounds = canvas.getBoundingClientRect();
      const x = bounds.left + bounds.width / 2;
      const y = bounds.top + bounds.height / 2;
      const buttons = button === 2 ? 2 : button === 1 ? 4 : 1;
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, pointerId, pointerType, button, buttons, clientX: x, clientY: y,
      }));
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, cancelable: true, pointerId, pointerType, button, buttons, clientX: x + dx, clientY: y + dy,
      }));
      canvas.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, cancelable: true, pointerId, pointerType, button, buttons: 0, clientX: x + dx, clientY: y + dy,
      }));
      await pause();
    };
    const same = (left, right, epsilon = 1e-4) => left.length === right.length
      && left.every((value, index) => Math.abs(value - right[index]) <= epsilon);

    await reset();
    const jitterBefore = state();
    await drag(0, 2, 1, 201);
    const jitterAfter = state();

    await reset();
    const verticalBefore = state();
    await drag(0, 0, 60, 202);
    const verticalAfter = state();
    const verticalDelta = [
      verticalAfter.target[0] - verticalBefore.target[0],
      verticalAfter.target[2] - verticalBefore.target[2],
    ];
    const backward = [Math.sin(verticalBefore.yaw), Math.cos(verticalBefore.yaw)];
    const verticalDot = verticalDelta[0] * backward[0] + verticalDelta[1] * backward[1];

    await reset();
    const wheelBefore = state();
    const bounds = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY: -120, deltaMode: 0,
      clientX: bounds.left + bounds.width * .72, clientY: bounds.top + bounds.height * .52,
    }));
    await pause();
    const wheelAfter = state();

    await reset();
    const touchBefore = state();
    const centre = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    const touch = (type, id, x, buttons) => canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', button: 0, buttons,
      clientX: x, clientY: centre.y,
    }));
    touch('pointerdown', 211, centre.x - 50, 1);
    touch('pointerdown', 212, centre.x + 50, 1);
    touch('pointermove', 211, centre.x - 75, 1);
    touch('pointermove', 212, centre.x + 75, 1);
    touch('pointerup', 211, centre.x - 75, 0);
    touch('pointerup', 212, centre.x + 75, 0);
    await pause();
    const touchAfter = state();

    await reset();
    return {
      jitterStable: same(jitterBefore.target, jitterAfter.target),
      verticalDot,
      verticalMoved: !same(verticalBefore.target, verticalAfter.target),
      wheelAnchored: wheelAfter.distance < wheelBefore.distance
        && !same(wheelBefore.target, wheelAfter.target),
      pinchZoomed: touchAfter.distance < touchBefore.distance,
      diagnostics: state(),
    };
  })()`);

  check(controls.jitterStable, 'does not pan during click-tolerance jitter');
  check(controls.verticalMoved && controls.verticalDot < 0,
    'keeps a downward left drag attached to the floor-plane pointer direction',
    `floor-axis dot ${controls.verticalDot.toFixed(3)}`);
  check(controls.wheelAnchored, 'zooms toward an off-centre mouse cursor');
  check(controls.pinchZoomed, 'supports two-finger pinch zoom');
  check(controls.diagnostics.aspect > 0 && controls.diagnostics.panScale > 0,
    'publishes deterministic aspect and pan diagnostics');

  const beforeResize = await page.evaluate(`(() => {
    const host = document.querySelector('#fpe-three-host');
    return { aspect: Number(host?.dataset.cameraAspect), distance: Number(host?.dataset.orbitDistance),
      fitRatio: Number(host?.dataset.orbitFitRatio) };
  })()`);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 900, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(450);
  const afterResize = await page.evaluate(`(() => {
    const host = document.querySelector('#fpe-three-host');
    return { aspect: Number(host?.dataset.cameraAspect), distance: Number(host?.dataset.orbitDistance),
      fitRatio: Number(host?.dataset.orbitFitRatio), canvas: !!document.querySelector('.fpe-three-canvas') };
  })()`);
  check(afterResize.canvas && Math.abs(afterResize.aspect - beforeResize.aspect) > .01
    && Math.abs(afterResize.fitRatio - beforeResize.fitRatio) < .01
    && Math.abs(afterResize.distance - beforeResize.distance) > .01,
  'preserves zoom-to-fit ratio when responsive layout changes camera aspect',
  `${beforeResize.aspect.toFixed(2)} → ${afterResize.aspect.toFixed(2)}`);

  const problems = await page.problems();
  check(problems.length === 0, '3D controls produce no runtime problems', problems[0] || '');
} finally {
  if (page) {
    try { await page.closeTarget(); } catch { /* browser may already be closing */ }
  }
  cdp.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ Three.js controls checks passed'}`);
process.exit(failures ? 1 : 0);
