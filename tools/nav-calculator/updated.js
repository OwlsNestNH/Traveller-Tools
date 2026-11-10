/* Optional presentation. The existing controls and engine own all calculations. */
(() => {
  const $ = id => document.getElementById(id);
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet'; sheet.href = new URL('updated.css', document.currentScript.src).href;
  document.head.append(sheet);
  const grid = document.querySelector('.grid'), inputPanel = grid.firstElementChild, readout = $('resultsTop');
  const switcher = document.createElement('div');
  switcher.className = 'view-switch'; switcher.setAttribute('role','group'); switcher.setAttribute('aria-label','Navigation interface');
  switcher.innerHTML = '<span>INTERFACE</span><button id="legacyView" aria-pressed="true">Legacy</button><button id="updatedView" aria-pressed="false">Updated</button><small>Same inputs. Same calculation.</small>';
  grid.before(switcher);
  const dashboard = document.createElement('section');
  dashboard.id = 'updatedDashboard'; dashboard.hidden = true; dashboard.tabIndex = -1;
  dashboard.setAttribute('aria-label','Updated navigation results');
  dashboard.innerHTML = [
    '<header class="u-heading"><div><span class="u-eyebrow">STARSHIP SYSTEMS</span><h1>Navigation Computer</h1></div><span class="u-local">NAV / ASTRO / COMM / ENG</span></header><div class="u-console-title"><span class="u-console-mark" aria-hidden="true">NAV</span><h2 id="uConsoleProfile">TRANSIT PROFILE</h2><span>NAVIGATION COMPUTER</span></div>',
    '<div class="u-summary"><button id="routeSummary" type="button" aria-label="Edit route in Plan Route"><span class="u-label">ROUTE</span><strong id="uRoute">No route planned</strong><span class="u-chevron" aria-hidden="true">⌄</span></button><button id="driveSummary" type="button" aria-label="Edit drive and profile in Plan Route"><span class="u-label">DRIVE & PROFILE</span><strong id="uDrive">Set thrust in Plan Route</strong><span class="u-chevron" aria-hidden="true">⌄</span></button></div>',
    '<div class="u-metrics"><div><span class="u-label" id="uTimeLabel">JOURNEY TIME</span><strong id="uTime">—</strong><small id="uTimeNote">Awaiting calculation</small></div><div><span class="u-label">DISTANCE</span><strong id="uDistance">—</strong><small id="uDistanceNote">Routed distance</small></div><div><span class="u-label">ARRIVAL SPEED</span><strong id="uSpeed">—</strong><small id="uSpeedNote">Selected transit profile</small></div><div><span class="u-label">COMMS DELAY</span><strong id="uComms">—</strong><small>One-way · direct separation</small></div></div>',
    '<section class="u-flight" aria-labelledby="uFlightTitle"><div class="u-section-heading"><h2 id="uFlightTitle">ADVISORY</h2><span>TRANSIT PROFILE · NOT TO SCALE</span></div><div id="uFlightEmpty">Open Plan Route to calculate a transit or 100D clearance.</div><div id="uFlightDiagram" hidden><div class="u-phases"><span>BURN</span><span id="uFlip">FLIP</span><span id="uBrake">BRAKE</span></div>',
    '<svg viewBox="0 0 900 170" role="img" aria-label="Transit schematic from start, via midpoint flip, to arrival; clearance ring is advisory only"><defs><radialGradient id="navPlanet" cx=".3" cy=".25"><stop stop-color="#b5f7ff"/><stop offset=".4" stop-color="#408bad"/><stop offset=".8" stop-color="#134466"/><stop offset="1" stop-color="#051b32"/></radialGradient><radialGradient id="navArrival" cx=".28" cy=".2"><stop stop-color="#fff0c9"/><stop offset=".45" stop-color="#c2a77c"/><stop offset=".8" stop-color="#79634f"/><stop offset="1" stop-color="#382f2d"/></radialGradient><linearGradient id="navExhaust"><stop stop-color="#22baff" stop-opacity="0"/><stop offset="1" stop-color="#9dedff"/></linearGradient><filter id="navGlow"><feGaussianBlur stdDeviation="4"/></filter></defs><path d="M80 70 H820" stroke="#53e4ed" stroke-width="2"/><path d="M100 97 V104 H428 V97 M472 97 V104 H800 V97" fill="none" stroke="#61899e"/><circle cx="65" cy="70" r="24" fill="url(#navPlanet)" stroke="#69ddeb"/><g id="uArrivalRing"><circle cx="835" cy="70" r="43" fill="none" stroke="#6fffea" stroke-width="1.6" stroke-dasharray="5 4"/><circle cx="792" cy="70" r="4" fill="#76fff3"/><text x="835" y="16" text-anchor="middle" fill="#82ffef" font-size="13">100D</text></g><circle id="uArrivalPlanet" cx="835" cy="70" r="23" fill="url(#navArrival)" stroke="#c4d6c2"/><path id="uClearanceEnd" d="M835 58 L847 70 L835 82 L823 70 Z" fill="#103f4b" stroke="#8cfff1" stroke-width="2"/><g id="uMidpoint"><circle cx="450" cy="70" r="20" fill="#082438" stroke="#84effb" stroke-width="1.5"/><path d="M440 73 A11 11 0 0 1 457 61 M457 61 V68 M457 61 H450 M460 67 A11 11 0 0 1 443 79 M443 79 V72 M443 79 H450" fill="none" stroke="white" stroke-width="2"/></g><path d="M113 61 L163 67 L163 73 L113 79 Z" fill="url(#navExhaust)" filter="url(#navGlow)"/><path d="M147 66 L172 66 L178 60 L182 62 L180 68 L197 70 L180 73 L182 79 L178 80 L172 74 L147 74 L154 70 Z" fill="#e9fbff" stroke="#88bcd2" stroke-width=".6"/><text x="65" y="123" text-anchor="middle" fill="#e8fcff" font-size="17">A</text><text id="uEndLabel" x="835" y="123" text-anchor="middle" fill="#e8fcff" font-size="17">B</text><text id="uBurnTime" x="265" y="132" text-anchor="middle" fill="#f0fcff" font-size="22" font-weight="650"></text><text id="uBrakeTime" x="635" y="132" text-anchor="middle" fill="#f0fcff" font-size="22" font-weight="650"></text><text id="uBurnDistance" x="265" y="155" text-anchor="middle" fill="#bad9e7" font-size="15"></text><text id="uBrakeDistance" x="635" y="155" text-anchor="middle" fill="#bad9e7" font-size="15"></text></svg><div class="u-mobile-times"><span id="uBurnMobile"></span><span id="uBrakeMobile"></span></div><p id="uPhaseNote" class="u-caption"></p></div>',
    '<div class="u-clearance"><span class="u-ring" aria-hidden="true">100D</span><div><span class="u-label">100D CLEARANCE</span><strong id="uClearance">Not calculated</strong><small>Selected-body advisory; ring illustrative. Not added to route or a braking point.</small></div></div></section>',
    '<details class="u-details" open><summary>Profile Details</summary><dl id="uDetails"></dl><details class="u-calculation-notes"><summary>Nominal phases · 100D advisory · Calculation notes</summary><div id="uLog"></div></details></details><div class="u-actions"><button id="planRoute"><span aria-hidden="true">⌖</span>Plan Route</button><button id="recompute"><span aria-hidden="true">↻</span>Recompute</button><button id="copyUpdated"><span aria-hidden="true">▤</span>Copy Brief</button><button id="clearanceUpdated"><span aria-hidden="true">◎</span>100D Only</button><button id="clearUpdated"><span aria-hidden="true">×</span>Clear</button><button id="legacyUpdated"><span aria-hidden="true">▤</span>Legacy</button></div><p class="u-status" id="uStatus"></p><nav class="u-links" aria-label="Updated tool navigation"><a href="../../">Traveller Tools</a><a href="../../changes/nav.html">Nav Changelog</a></nav>'
  ].join('');
  const metricIcons = ['<circle cx="12" cy="12" r="8"/><path d="M12 6v6l4 2"/>', '<path d="M3 12h18M6 8l-4 4 4 4m12-8 4 4-4 4"/>', '<circle cx="12" cy="12" r="8"/><path d="M12 12l5-5M7 17h10"/>', '<path d="M12 18V9m-3 9h6M8 6a6 6 0 0 0 0 9m8-9a6 6 0 0 1 0 9M5 3a10 10 0 0 0 0 15m14-15a10 10 0 0 1 0 15"/>'];
  dashboard.querySelectorAll('.u-metrics>div').forEach((el,i)=>{ el.insertAdjacentHTML('afterbegin','<svg class="u-metric-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">'+metricIcons[i]+'</svg>'); });
  const actionIcons = ['<path d="M4 20L11 4l3 7 6 2-16 7Z"/><path d="M4 20l10-9"/>', '<path d="M20 7A8 8 0 1 0 20 17M20 3v5h-5"/>', '<path d="M7 4h12v16H7zM3 8v13h12M10 8h6m-6 4h6m-6 4h6"/>', '<circle cx="12" cy="12" r="8" stroke-dasharray="3 2"/><circle cx="12" cy="12" r="3"/>', '<path d="M6 6l12 12M18 6L6 18"/><circle cx="12" cy="12" r="9"/>', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11m4-7h5m-5 4h5"/>'];
  dashboard.querySelectorAll('.u-actions button>span').forEach((el,i)=>{el.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">'+actionIcons[i]+'</svg>';});
  grid.after(dashboard);
  const dialog = document.createElement('dialog'); dialog.id = 'planDialog'; dialog.setAttribute('aria-labelledby','planTitle');
  dialog.innerHTML = '<header class="u-dialog-heading"><div><span class="u-eyebrow">NAV / ROUTE SETUP</span><h2 id="planTitle">Plan Route</h2></div><button id="closePlan" class="ghost" aria-label="Close Plan Route">Close ×</button></header><p class="u-dialog-note">Edits are kept when you close. Compute to refresh your flight profile.</p><div id="planError" tabindex="-1" role="alert"></div><div class="u-route-choice"><label for="planKind">Calculation</label><select id="planKind"><option value="route">Route transit</option><option value="clearance">100D clearance only</option></select></div><div id="planInputs"></div><footer><button id="computePlan">Compute route</button></footer>';
  document.body.append(dialog);
  // Mark fields instead of cloning: one input/session/dice owner.
  let node = $('distMode').previousElementSibling;
  const end = $('distOrbitBlock').nextElementSibling;
  while(node && node !== end){ node.dataset.routeField = ''; node = node.nextElementSibling; }
  $('useAstro').closest('.toggleRow').dataset.routeField = ''; $('astroBlock').dataset.routeField = '';
  let updated = false;
  function modeUI(){
    const clearance = $('planKind').value === 'clearance';
    dialog.classList.toggle('clearance-only',clearance);
    $('computePlan').textContent = clearance ? 'Compute 100D clearance' : 'Compute route';
    if(clearance){ $('use100d').checked = true; on100DToggle(); }
  }
  function openPlan(){
    $('planKind').value = calculationMode; modeUI(); $('planError').textContent = '';
    dialog.showModal(); $('planKind').focus();
  }
  function switchView(next){
    if(dialog.open) dialog.close();
    updated = next; document.body.classList.toggle('nav-updated',next);
    dashboard.hidden = !next; grid.hidden = next; document.querySelector('.topbar').hidden = next;
    $('legacyView').setAttribute('aria-pressed',String(!next)); $('updatedView').setAttribute('aria-pressed',String(next));
    if(next){ document.body.append(dialog); $('planInputs').append(inputPanel); $('statusText').removeAttribute('role'); $('statusText').removeAttribute('aria-live'); $('uStatus').setAttribute('role','status'); $('uStatus').setAttribute('aria-live','polite'); } else { grid.prepend(inputPanel); dialog.remove(); $('uStatus').removeAttribute('role'); $('uStatus').removeAttribute('aria-live'); $('statusText').setAttribute('role','status'); $('statusText').setAttribute('aria-live','polite'); }
    render(); (next ? $('updatedView') : $('legacyView')).focus();
  }
  $('legacyView').onclick = () => switchView(false); $('updatedView').onclick = () => switchView(true);
  $('planRoute').onclick = openPlan;
  $('routeSummary').onclick = openPlan; $('driveSummary').onclick = openPlan;
  $('legacyUpdated').onclick = () => switchView(false);
  $('clearanceUpdated').onclick = () => { openPlan(); $('planKind').value = 'clearance'; $('planKind').dispatchEvent(new Event('change')); };
 $('closePlan').onclick = () => dialog.close();
  $('planKind').onchange = () => { calculationMode = $('planKind').value; invalidateSolution(); modeUI(); render(); };
  $('computePlan').onclick = () => { if($('planKind').value === 'clearance') compute100DOnly(); else solve(); };
  $('recompute').onclick = () => { if(calculationMode === 'clearance') compute100DOnly(); else solve(); };
  $('copyUpdated').onclick = () => copyBrief(); $('clearUpdated').onclick = () => { resetAll(); render(); };
  inputPanel.addEventListener('input', () => { dialog.querySelector('#planError').textContent = ''; });
  inputPanel.addEventListener('change', () => { dialog.querySelector('#planError').textContent = ''; });
  const oldReveal = revealOutput;
  revealOutput = function(id){
    if(!updated) return oldReveal(id);
    render();
    if(id === 'errorBox'){
      if(!dialog.open) openPlan();
      $('planError').textContent = $('errorBox').textContent;
      $('planError').focus(); $('planError').scrollIntoView({block:'nearest'});
    } else {
      if(dialog.open) dialog.close();
      dashboard.focus({preventScroll:true}); dashboard.scrollIntoView({block:'start'});
    }
  };
  // This exact engine result is recorded by the shared controller. Rendering never rolls.
  function render(){
    const s = navResult, route = s && calculationMode === 'route', clearance = s && calculationMode === 'clearance', flip = s?.profile === 'flip';
    const minutes = route ? s.adjustedRoutedMin : s?.timeSelectedMin, nominal = route ? s.nominalRoutedMin : minutes, km = route ? s.distance.routedKm : s?.jump.clearanceKm;
    $('uRoute').textContent = route ? s.distance.modeLabel : clearance ? '100D clearance only' : 'No current solution';
    $('uDrive').textContent = s ? s.thrustG.toFixed(2)+' G · '+(flip?'Burn → Flip → Brake':'Constant thrust · No braking') : 'Set thrust & profile in Plan Route';
    $('uTimeLabel').textContent = clearance ? '100D TIME' : 'JOURNEY TIME';
    $('uTime').textContent = clearance && !km ? 'N/A' : s ? fmtDHM(minutes) : '—';
    $('uTimeNote').textContent = route ? 'Astrogation-adjusted transit' : clearance ? 'Clearance advisory only' : 'Awaiting calculation';
    $('uDistance').textContent = s ? fmt(km/AU_TO_KM,3)+' AU' : '—';
    $('uDistanceNote').textContent = s ? fmt(km/1000,2)+' kkm'+(clearance?' · clearance':' · routed') : 'Routed distance';
    $('uSpeed').textContent = s && km > 0 ? (flip ? '0.00 km/s' : route ? fmt(s.vKmS,2)+' km/s' : '—') : '—';
    $('uSpeedNote').textContent = s ? (flip ? 'Arrive at rest' : route ? 'No braking at arrival' : 'No route computed') : 'Selected transit profile';
    $('uComms').textContent = route ? fmtDHM(s.commLagMin) : '—';
    $('uFlightEmpty').hidden = !!s && km > 0;
    $('uFlightEmpty').textContent = s && !km ? '100D clearance is not available for this body type.' : 'Open Plan Route to calculate a transit or 100D clearance.'; $('uFlightDiagram').hidden = !s || !(km > 0);
    $('uFlip').hidden = !flip; $('uBrake').hidden = !flip; $('uMidpoint').style.display = flip ? '' : 'none';
    $('uBurnTime').textContent = s ? fmtDHM(flip ? nominal/2 : nominal) : '';
    $('uBrakeTime').textContent = s && flip ? fmtDHM(nominal/2) : '';
    $('uBurnMobile').textContent = s ? $('uBurnTime').textContent+' / '+fmt(km/AU_TO_KM/(flip?2:1),3)+' AU' : '';
    $('uBrakeMobile').textContent = s && flip ? $('uBrakeTime').textContent+' / '+fmt(km/AU_TO_KM/2,3)+' AU' : '';
    $('uEndLabel').textContent = clearance ? '100D' : 'B';
    $('uArrivalRing').style.display = s?.jump.clearanceKm > 0 && !clearance ? '' : 'none';
    $('uArrivalPlanet').style.display = clearance ? 'none' : '';
    $('uClearanceEnd').style.display = clearance ? '' : 'none';
    $('uBurnDistance').textContent = s ? '('+fmt(km/AU_TO_KM/(flip?2:1),3)+' AU)' : '';
    $('uBrakeDistance').textContent = s && flip ? '('+fmt(km/AU_TO_KM/2,3)+' AU)' : '';
    $('uPhaseNote').textContent = flip ? 'Nominal symmetric profile. Flip at half the flown distance; Astrogation adjusts total time, not these physical phase estimates.' : 'Constant acceleration from rest. No flip or braking phase.';
    $('uConsoleProfile').textContent = s ? (flip ? 'BURN / FLIP / BRAKE' : 'CONSTANT THRUST') : 'TRANSIT PROFILE';
    const jumpMinutes = route ? s.jumpTimeSelMin : s?.timeSelectedMin;
    $('uClearance').textContent = s?.jump.clearanceKm > 0 ? fmtDHM(jumpMinutes)+' · '+fmt(s.jump.clearanceKm/1000,2)+' kkm' : s ? s.jump.label : 'Not calculated';
    $('uDetails').replaceChildren();
    const entries = route ? [
      ['Burn time',fmtDHM(flip ? nominal/2 : nominal)+' ('+fmt(km/AU_TO_KM/(flip?2:1),3)+' AU)'],
      ['Flip',flip ? 'Midpoint — course reversal' : 'None — constant thrust'],
      ['Brake time',flip ? fmtDHM(nominal/2)+' ('+fmt(km/AU_TO_KM/2,3)+' AU)' : 'None — no braking'],
      ['Peak velocity',fmt(s.vKmS,2)+' km/s'],
      ['100D advisory',s.jump.clearanceKm > 0 ? fmtDHM(s.jumpTimeSelMin)+' / '+fmt(s.jump.clearanceKm/1000000,2)+' M km' : s.jump.label]
    ] : clearance ? [['Clearance profile',flip?'Arrive at rest':'Constant thrust'],['100D time',fmtDHM(minutes)],['Clearance distance',fmt(km/1000000,3)+' M km / '+fmt(km/AU_TO_KM,3)+' AU']] : [];
    for(const [key,value] of entries){ const dt=document.createElement('dt'),dd=document.createElement('dd'); dt.textContent=key; dd.textContent=value; $('uDetails').append(dt,dd); }
    $('uLog').textContent = 'Selected-body 100D ring is illustrative, not a route leg or braking point. '+$('notesOut').textContent; $('uStatus').textContent = $('statusText').textContent; $('copyUpdated').disabled = !lastBrief;
  }
  new MutationObserver(render).observe(readout,{subtree:true,childList:true,characterData:true});
  render();
  dialog.remove();
})();
