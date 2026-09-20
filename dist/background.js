(() => {
  'use strict';
  if (typeof window.particlesJS !== 'function') return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = preference.matches;
  window.particlesJS('particles', {
    particles: {
      number: { value: window.innerWidth < 600 ? 26 : 60, density: { enable: false } },
      color: { value: '#ffffff' },
      shape: { type: 'circle' },
      opacity: { value: 0.22, random: true },
      size: { value: 1.1, random: true },
      line_linked: { enable: true, distance: 240, color: '#ffffff', opacity: 0.22, width: 0.65 },
      move: { enable: !paused && !document.hidden, speed: 0.3, direction: 'none', random: false, straight: false, out_mode: 'out', bounce: false }
    },
    interactivity: {
      detect_on: 'window',
      events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: false }, resize: true },
      modes: { grab: { distance: 190, line_linked: { opacity: 0.45 } } }
    },
    retina_detect: true
  });
  const instance = window.pJSDom[window.pJSDom.length - 1]?.pJS;
  if (!instance) return;
  const button = document.getElementById('motion-toggle');
  const update = () => {
    const moving = !paused && !document.hidden;
    window.cancelAnimationFrame(instance.fn.drawAnimFrame);
    instance.particles.move.enable = moving;
    instance.interactivity.events.onhover.enable = moving;
    if (moving) instance.fn.vendors.draw();
    button.textContent = paused ? 'Resume background' : 'Pause background';
    button.setAttribute('aria-pressed', String(paused));
  };
  button.hidden = false;
  button.addEventListener('click', () => { paused = !paused; update(); });
  preference.addEventListener('change', event => { paused = event.matches; update(); });
  document.addEventListener('visibilitychange', update);
  const touch = event => {
    if (paused || !event.touches.length) return;
    const ratio = instance.canvas.pxratio;
    instance.interactivity.mouse.pos_x = event.touches[0].clientX * ratio;
    instance.interactivity.mouse.pos_y = event.touches[0].clientY * ratio;
    instance.interactivity.status = 'mousemove';
  };
  window.addEventListener('touchstart', touch, { passive: true });
  window.addEventListener('touchmove', touch, { passive: true });
  window.addEventListener('touchend', () => { instance.interactivity.status = 'mouseleave'; }, { passive: true });
  update();
})();
