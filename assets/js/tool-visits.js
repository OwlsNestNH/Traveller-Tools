/* Shared page-open counters. Only canonical published tool pages send a hit. */
(() => {
  'use strict';
  const tools = ['nav-calculator', 'traveller_ship_logger_v2', 'traveller_tools_buttons', 'trade-route-calculator', 'vehicle-builder'];
  const prefix = '/Traveller-Tools/tools/';
  if (location.hostname !== 'owlsnestnh.github.io' || !location.pathname.startsWith(prefix)) return;
  const rest = location.pathname.slice(prefix.length);
  const tool = rest.split('/')[0];
  if (!tools.includes(tool)) return;
  const file = rest.slice(tool.length).replace(/^\//, '');
  const allowed = tool === 'vehicle-builder' ? ['Traveller-Vehicle-Builder.html'] : ['', 'index.html'];
  if (!allowed.includes(file) || window.__travellerVisitCounted) return;
  window.__travellerVisitCounted = true;
  const count = () => {
    const pixel = new Image();
    pixel.alt = '';
    pixel.referrerPolicy = 'no-referrer';
    pixel.hidden = true;
    pixel.onload = pixel.onerror = () => pixel.remove();
    // Only the public canonical tool path is sent; no query, fragment, or saved design.
    pixel.src = 'https://hits.sh/owlsnestnh.github.io/Traveller-Tools/tools/' + tool + '.svg';
    document.body.appendChild(pixel);
  };
  if (document.visibilityState === 'hidden') {
    const visible = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', visible);
      count();
    };
    document.addEventListener('visibilitychange', visible);
  } else count();
})();
