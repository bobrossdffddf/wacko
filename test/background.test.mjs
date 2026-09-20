import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../src/background.js', import.meta.url), 'utf8');
function setup(reduced = false) {
  const events = {};
  let draws = 0;
  let config;
  const instance = { fn: { drawAnimFrame: 1, vendors: { draw: () => draws++ } }, particles: { move: {} }, interactivity: { events: { onhover: {} }, mouse: {} }, canvas: { pxratio: 2 } };
  const button = { hidden: true, setAttribute: (k, v) => { button[k] = v; }, addEventListener: (k, v) => { events['button:' + k] = v; } };
  const document = { hidden: false, getElementById: () => button, addEventListener: (k, v) => { events[k] = v; } };
  const window = {
    innerWidth: 1200,
    particlesJS: (_id, value) => { config = value; },
    pJSDom: [{ pJS: instance }],
    matchMedia: () => ({ matches: reduced, addEventListener: (k, v) => { events['media:' + k] = v; } }),
    cancelAnimationFrame: () => {},
    addEventListener: (k, v) => { events[k] = v; }
  };
  vm.runInNewContext(code, { window, document });
  return { instance, button, document, events, get draws() { return draws; }, get config() { return config; } };
}

test('pointer effect is configured and pause/resume controls movement', () => {
  const state = setup();
  assert.equal(state.config.interactivity.detect_on, 'window');
  assert.equal(state.config.interactivity.events.onhover.mode, 'grab');
  assert.equal(state.button.hidden, false);
  assert.equal(state.instance.particles.move.enable, true);
  state.events['button:click']();
  assert.equal(state.instance.particles.move.enable, false);
  assert.equal(state.button['aria-pressed'], 'true');
  assert.equal(state.button.textContent, 'Resume background');
  state.events['button:click']();
  assert.equal(state.instance.particles.move.enable, true);
});
test('reduced motion and hidden tabs stop animation', () => {
  const state = setup(true);
  assert.equal(state.config.particles.move.enable, false);
  assert.equal(state.instance.particles.move.enable, false);
  assert.equal(state.draws, 0);
  state.events['media:change']({ matches: false });
  assert.equal(state.instance.particles.move.enable, true);
  state.document.hidden = true;
  state.events.visibilitychange();
  assert.equal(state.instance.particles.move.enable, false);
  state.document.hidden = false;
  state.events.visibilitychange();
  assert.equal(state.instance.particles.move.enable, true);
});
test('touch coordinates respect pixel density and clear when released', () => {
  const state = setup();
  state.events.touchmove({ touches: [{ clientX: 10, clientY: 20 }] });
  assert.equal(state.instance.interactivity.mouse.pos_x, 20);
  assert.equal(state.instance.interactivity.mouse.pos_y, 40);
  state.events.touchend();
  assert.equal(state.instance.interactivity.status, 'mouseleave');
});
test('missing animation library leaves the page usable', () => {
  assert.doesNotThrow(() => vm.runInNewContext(code, { window: {} }));
});
