/* Nav frontend adapter/controller. Calculations live in engine.js. */
const NavEngine = globalThis.TravellerNav;
  const {AU_TO_KM, AU_TO_LAG_MIN, ORBIT_BASE_AU, ORBIT_DIFF_AU, SIZE_DIAM_KM, GAS_GIANT_DIAM_KM} = NavEngine.constants;

  function orbitToAU(whole, frac){ return NavEngine.orbitToAU(whole, frac); }

  function populateOrbitSelects(){
    const sW = document.getElementById("orbitStartWhole");
    const eW = document.getElementById("orbitEndWhole");
    if(!sW || !eW) return;

    const makeOpt = (v, label) => {
      const o = document.createElement("option");
      o.value = String(v);
      o.textContent = label;
      return o;
    };

    for(let i=0;i<=20;i++){
      const label = `${i} • ${ORBIT_BASE_AU[i].toLocaleString()} AU`;
      sW.appendChild(makeOpt(i,label));
      eW.appendChild(makeOpt(i,label));
    }
    // sensible defaults: Earth-ish to Jupiter-ish
    sW.value = "3";
    eW.value = "6";
    updateOrbitDistancePreview();
  }
  // Map-model Orbit# helpers (WBH Orbit# table)
  function populateMapOrbitSelects(){
    const aW = document.getElementById("aOrbitWhole");
    const bW = document.getElementById("bOrbitWhole");
    if(!aW || !bW) return;

    const makeOpt = (v, label) => {
      const o = document.createElement("option");
      o.value = String(v);
      o.textContent = label;
      return o;
    };

    // clear (defensive)
    aW.innerHTML = "";
    bW.innerHTML = "";

    for(let i=0;i<=20;i++){
      const label = `${i} • ${ORBIT_BASE_AU[i].toLocaleString()} AU`;
      aW.appendChild(makeOpt(i,label));
      bW.appendChild(makeOpt(i,label));
    }
    aW.value = "3";
    bW.value = "6";
  }

  function onMapBodyModeChange(){
    const aMode = document.getElementById("aMode")?.value || "au";
    const bMode = document.getElementById("bMode")?.value || "au";

    // Toggle AU vs Orbit blocks
    const aAu = document.getElementById("aAuBlock");
    const bAu = document.getElementById("bAuBlock");
    const aOr = document.getElementById("aOrbitBlock");
    const bOr = document.getElementById("bOrbitBlock");

    if(aAu) aAu.style.display = (aMode === "au") ? "" : "none";
    if(aOr) aOr.style.display = (aMode === "orbit") ? "" : "none";

    if(bAu) bAu.style.display = (bMode === "au") ? "" : "none";
    if(bOr) bOr.style.display = (bMode === "orbit") ? "" : "none";

    updateMapAUPreview();
  }

  function getMapBodyAU(which){
    if(which === "A"){
      const mode = document.getElementById("aMode")?.value || "au";
      if(mode === "orbit"){
        const w = document.getElementById("aOrbitWhole")?.value;
        const f = document.getElementById("aOrbitFrac")?.value;
        return orbitToAU(w, f);
      }
      return parseFloat(document.getElementById("au1")?.value);
    } else {
      const mode = document.getElementById("bMode")?.value || "au";
      if(mode === "orbit"){
        const w = document.getElementById("bOrbitWhole")?.value;
        const f = document.getElementById("bOrbitFrac")?.value;
        return orbitToAU(w, f);
      }
      return parseFloat(document.getElementById("au2")?.value);
    }
  }

  function updateMapAUPreview(){
    const a = getMapBodyAU("A");
    const b = getMapBodyAU("B");
    const prev = document.getElementById("mapAUPreview");
    if(!prev) return;

    if(!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0){
      prev.innerHTML = "Map radii: —";
      return;
    }
    const dAU = Math.abs(a - b);
    const dKm = dAU * AU_TO_KM;
    prev.innerHTML = `Map radii: <b>A ${a.toFixed(4)} AU</b>, <b>B ${b.toFixed(4)} AU</b> • Δ ${dAU.toFixed(4)} AU (${fmtDistance(dKm)})`;
  }

  function updateOrbitDistancePreview(){
    const sw = document.getElementById("orbitStartWhole").value;
    const sf = document.getElementById("orbitStartFrac").value;
    const ew = document.getElementById("orbitEndWhole").value;
    const ef = document.getElementById("orbitEndFrac").value;

    const a1 = orbitToAU(sw, sf);
    const a2 = orbitToAU(ew, ef);
    const dAU = Math.abs(a2 - a1);
    const dKm = dAU * AU_TO_KM;

    const prev = document.getElementById("orbitPreview");
    if(prev && !Number.isFinite(dAU)){
      prev.textContent = "Orbit model: enter Orbit# 0–20 and fractions 0–0.99.";
    } else if(prev){
      prev.innerHTML = `Orbit model: <b>${dAU.toFixed(4)} AU</b> (${fmtDistance(dKm)})`;
    }
  }



  let lastBrief = "";
  let navResult = null;
  let calculationMode = "route";

  function fmt(n, d=2){ return Number.isFinite(n) ? n.toFixed(d) : "—"; }

  function fmtDHM(totalMinutes){
    if(!Number.isFinite(totalMinutes)) return "—";
    const total = Math.max(0, Math.round(totalMinutes));
    const days = Math.floor(total / (60 * 24));
    const remAfterDays = total - days * 60 * 24;
    const hours = Math.floor(remAfterDays / 60);
    const mins = remAfterDays - hours * 60;
    return `${days}d ${hours}h ${mins}m`;
  }

  function fmtDistance(distanceKm){
    const kkm = distanceKm / 1000;
    const au = distanceKm / AU_TO_KM;
    return `RANGE: ${fmt(kkm,2)} kkm / ${fmt(au,1)} AU`;
  }


function setStatus(ok, text){
    const lamp = document.getElementById("lamp");
    if(lamp){
      lamp.classList.remove("ok","bad");
      lamp.classList.add(ok ? "ok" : "bad");
    }
    const st = document.getElementById("statusText");
    if(st) st.textContent = text;
    const chip = document.getElementById("chipStatus");
    if(chip) chip.textContent = ok ? "SOLVED" : "INPUT ERR";
  }

  function invalidateSolution(){
    navResult = null;
    lastBrief = "";
    for(const id of ["rawDistOut", "distOut", "arcMultOut", "jumpOut", "totalDistOut",
      "commOut", "nominalOut", "adjustedOut", "routeLegOut", "jumpLegOut", "legsSumOut", "speedOut"]){
      document.getElementById(id).textContent = "—";
    }
    document.getElementById("mainTime").textContent = "—";
    document.getElementById("mainSub").textContent = "No current route solution. Solve again after changing inputs.";
    document.getElementById("notesOut").textContent = "No current route solution.";
    document.getElementById("assumeOut").textContent = "—";
    document.getElementById("chipStatus").textContent = "READY";
    document.getElementById("lamp").classList.remove("ok", "bad");
    document.getElementById("statusText").textContent = "STANDBY • Inputs changed";
  }

  function revealOutput(id){
    const target = document.getElementById(id);
    target.focus({preventScroll:true});
    target.scrollIntoView({behavior:"instant", block:"start"});
  }

  function setError(msg){
    invalidateSolution();
    document.getElementById("errorBox").innerHTML =
      `<div class="err"><b>NAV ERROR:</b> ${msg}</div>`;
    setStatus(false, "NAV ERROR: " + msg);
    revealOutput("errorBox");
  }

  function clearError(){ document.getElementById("errorBox").innerHTML = ""; }

  function onDistModeChange(){
    const mode = document.getElementById("distMode").value;
    document.getElementById("distKmBlock").style.display = (mode==="km") ? "" : "none";
    document.getElementById("distAuBlock").style.display = (mode==="au") ? "" : "none";
    document.getElementById("distMapBlock").style.display = (mode==="map") ? "" : "none";
    document.getElementById("distOrbitBlock").style.display = (mode==="orbit") ? "" : "none";
    if(mode==="map"){ onMapBodyModeChange(); updateMapAUPreview(); }
    updateOrbitDistancePreview();
    syncPills();
  }

  function onRouteTypeChange(){
    const rt = document.getElementById("routeType").value;
    document.getElementById("safetyBlock").style.display = (rt==="trans") ? "" : "none";
    if(rt !== "trans"){
      document.getElementById("multHelp").classList.remove("open");
      document.getElementById("multHelpToggle").setAttribute("aria-expanded", "false");
    }
  }

  function onAstroToggle(){
    const on = document.getElementById("useAstro").checked;
    document.getElementById("astroBlock").style.display = on ? "" : "none";
  }

  function syncPills(){
    const profile = document.getElementById("profile").value;
    const distMode = document.getElementById("distMode").value;
    document.getElementById("pillProfile").textContent = (profile==="flip") ? "FLIP/BURN" : "NO BRAKE";
    document.getElementById("pillDist").textContent = distMode.toUpperCase();
  }

  function onProfileChange(){
    // A 100D-only calculation must stay 100D-only even if an old route input exists.
    const clearanceOnly = calculationMode === "clearance";
    invalidateSolution();
    syncPills();
    if(clearanceOnly){
      compute100DOnly(false);
      return;
    }
    const thrustG = Number(document.getElementById("thrust").value);
    if(!Number.isFinite(thrustG) || thrustG <= 0) return;
    try { computeDistanceInfo(); } catch { return; }
    solve(false);
  }

  function toggleMultiplierHelp(){
    const open = document.getElementById("multHelp").classList.toggle("open");
    document.getElementById("multHelpToggle").setAttribute("aria-expanded", String(open));
  }

  // 100D UI handlers
  function on100DToggle(){
    const on = document.getElementById("use100d").checked;
    document.getElementById("jumpBlock").style.display = on ? "" : "none";
    update100DPreview();
  }

  function onJumpBodyTypeChange(){
    const type = document.getElementById("jumpBodyType").value;
    const sizeBlock = document.getElementById("sizeCodeBlock");
    sizeBlock.style.display = (type === "rocky") ? "" : "none";
    update100DPreview();
  }

  function update100DPreview(){
    const on = document.getElementById("use100d").checked;
    if(!on){
      document.getElementById("d100Preview").textContent = "100D clearance: —";
      return;
    }

    const type = document.getElementById("jumpBodyType").value;
    let diamKm = null;
    let note = "";

    if(type === "rocky"){
      const code = document.getElementById("sizeCode").value;
      diamKm = SIZE_DIAM_KM[code] ?? null;
      note = (diamKm === null) ? "N/A for belts/rings" : `Size ${code} avg diameter ${diamKm.toLocaleString()} km`;
    } else {
      diamKm = GAS_GIANT_DIAM_KM[type];
      note = `Gas giant avg diameter ${diamKm.toLocaleString()} km`;
    }

    if(diamKm === null){
      document.getElementById("d100Preview").textContent = `100D clearance: N/A (${note})`;
    } else {
      const d100 = diamKm * 100;
      document.getElementById("d100Preview").textContent =
        `100D clearance: ${fmt(d100/1000,1)} kkm / ${fmt(d100/AU_TO_KM,2)} AU (${note})`;
    }
  }

  function get100DClearanceKm(){ return NavEngine.clearanceDistance(readNavInput().clearance); }

  function resetAll(){
    navResult = null;
    calculationMode = "route";
    clearError();
    lastBrief = "";

    document.getElementById("thrust").value = "";
    document.getElementById("profile").value = "flip";
    document.getElementById("distMode").value = "km";
    onDistModeChange();
    syncPills();

    document.getElementById("distanceKm").value = "";
    document.getElementById("distanceAu").value = "";

    // Orbit mode defaults
    const osw = document.getElementById("orbitStartWhole");
    const oew = document.getElementById("orbitEndWhole");
    if(osw && oew){
      osw.value = "3";
      oew.value = "6";
      document.getElementById("orbitStartFrac").value = "0";
      document.getElementById("orbitEndFrac").value = "0";
      updateOrbitDistancePreview();
    }
    document.getElementById("aMode").value = "au";
    document.getElementById("bMode").value = "au";
    document.getElementById("aOrbitWhole").value = "3";
    document.getElementById("bOrbitWhole").value = "6";
    document.getElementById("aOrbitFrac").value = "0";
    document.getElementById("bOrbitFrac").value = "0";
    onMapBodyModeChange();
    document.getElementById("au1").value = "";
    document.getElementById("au2").value = "";
    updateMapAUPreview();
    document.getElementById("separation").value = "same";
    document.getElementById("routeType").value = "direct";
    onRouteTypeChange();
    document.getElementById("safety").value = "2.0";

    document.getElementById("use100d").checked = false;
    document.getElementById("jumpBodyType").value = "rocky";
    document.getElementById("sizeCode").value = "8";
    onJumpBodyTypeChange();
    on100DToggle();

    document.getElementById("useAstro").checked = false;
    document.getElementById("autoDice").checked = true;
    onAstroToggle();
    document.getElementById("effect").value = "";
    document.getElementById("manualPct").value = "";

    document.getElementById("multHelp").classList.remove("open");
    document.getElementById("multHelpToggle").setAttribute("aria-expanded", "false");

    document.getElementById("mainTime").textContent = "0d 0h 0m";
    document.getElementById("mainSub").textContent = "No solution computed.";
    document.getElementById("rawDistOut").textContent = "—";
    document.getElementById("distOut").textContent = "—";
    document.getElementById("arcMultOut").textContent = "—";
    document.getElementById("jumpOut").textContent = "—";
    document.getElementById("totalDistOut").textContent = "—";
    document.getElementById("commOut").textContent = "—";
    document.getElementById("nominalOut").textContent = "—";
    document.getElementById("adjustedOut").textContent = "—";
    document.getElementById("routeLegOut").textContent = "—";
    document.getElementById("jumpLegOut").textContent = "—";
    document.getElementById("legsSumOut").textContent = "—";
    document.getElementById("speedOut").textContent = "—";
    document.getElementById("assumeOut").textContent = "Start: rest";
    document.getElementById("notesOut").textContent = "Provide parameters, then solve.";
    document.getElementById("chipStatus").textContent = "READY";

    const lamp = document.getElementById("lamp");
    lamp.classList.remove("ok","bad");
    document.getElementById("statusText").textContent = "STANDBY • Awaiting input";
  }

  function rollD(sides){ return Math.floor(Math.random()*sides) + 1; }

  function computeDistanceInfo(){ return NavEngine.computeDistance(readNavInput().distance); }




    function buildBrief(obj){
    const lines = [
      "NAV BRIEF",
      "---------",
      `PROFILE: ${obj.profileLabel}`,
      `THRUST: ${obj.thrustG.toFixed(2)} G`,
      `RAW DIST: ${obj.rawKKM} kkm (${obj.rawAU} AU)`,
      `ROUTED:   ${obj.routeKKM} kkm (${obj.routeAU} AU)`,
      `ARC MULT: ${obj.arcMult}×`,
      `100D CLR: ${obj.jumpKKM} kkm (${obj.jumpAU} AU) • ${obj.jumpLabel} • CLEARANCE ONLY (NOT ADDED) • t=${obj.jumpTimeDHM} (advisory)`,
      `COMM LAG (1-WAY): ${obj.commLagDHM}`,
      `TIME (NOMINAL ROUTED): ${obj.nominalRoutedDHM}`,
      `TIME (ASTRO-ADJ ROUTED): ${obj.adjustedRoutedDHM}`,
      `SPEED: ${obj.speedLine}`,
      `ASTRO: ${obj.astroLine}`,
      `NOTES: ${obj.notesShort}`
    ];
    return lines.join("\n");
  }

  async function copyBrief(){
    if(!lastBrief){
      alert("No NAV solution to copy yet. Solve a route first.");
      return;
    }
    let copied = false;
    try{
      await navigator.clipboard.writeText(lastBrief);
      copied = true;
    } catch {
      const previousFocus = document.activeElement;
      const ta = document.createElement("textarea");
      ta.value = lastBrief;
      ta.setAttribute("aria-label", "NAV brief clipboard transfer");
      ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
      try{
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand("copy") === true;
      } catch { copied = false; }
      finally{
        ta.remove();
        previousFocus?.focus({preventScroll:true});
      }
    }
    alert(copied ? "NAV brief copied to clipboard." : "Could not copy NAV brief. Clipboard access is unavailable; try again or copy the readout manually.");
  }

    function solve(reveal = true){
  calculationMode = "route";
  try{
    clearError();
    invalidateSolution();
    syncPills();

    const input = readNavInput();
    let solution;
    try{
      // The pure engine requests explicit dice only after route validation.
      try { solution = NavEngine.solveRoute(input); }
      catch(error){
        if(error.code !== 'DICE_REQUIRED') throw error;
        solution = NavEngine.solveRoute(input, error.sides.map(rollD));
      }
    } catch(error){ return setError(error.message); }
    navResult = solution;
    const {thrustG,profile,distance:dist,jump,jumpTimeSelMin,totalKm,commLagMin,
      nominalRoutedMin,adjustedRoutedMin,vKmS,astrogation} = solution;
    const {rawKm,routedKm} = dist;
    const jumpKm = jump.clearanceKm;
    const useAstro = input.astrogation.enabled;
    const {astroLog,astroBrief} = formatAstrogation(astrogation);

    const profileLabel = (profile==="flip") ? "FLIP-AND-BURN" : "CONSTANT THRUST (NO BRAKE)";
    const speedLine = (profile==="flip")
      ? `${fmt(vKmS,2)} km/s (midpoint peak)`
      : `${fmt(vKmS,2)} km/s (arrival speed)`;

    // Main readout: Astro-adjusted routed time (or nominal if astro off)
    document.getElementById("mainTime").textContent = fmtDHM(adjustedRoutedMin);
    document.getElementById("mainSub").textContent =
      `${fmtDHM(nominalRoutedMin)} nominal routed • ${fmtDHM(adjustedRoutedMin)} astro-adjusted routed`;

    document.getElementById("rawDistOut").textContent = fmtDistance(rawKm);
    document.getElementById("distOut").textContent = fmtDistance(routedKm);
    document.getElementById("arcMultOut").textContent = `${fmt(dist.arcMult,2)}×`;

    // 100D clearance display only
    document.getElementById("jumpOut").textContent =
      (jumpKm > 0)
        ? `${fmtDistance(jumpKm)} • ${fmtDHM(jumpTimeSelMin)}`
        : `N/A / 0.0 AU • ${jump.label}`;

    // Total distance flown is routed only
    document.getElementById("totalDistOut").textContent = fmtDistance(totalKm);

    document.getElementById("commOut").textContent = fmtDHM(commLagMin);

    // Time tiles
    document.getElementById("nominalOut").textContent = fmtDHM(nominalRoutedMin);
    document.getElementById("adjustedOut").textContent = fmtDHM(adjustedRoutedMin);

    // Keep these fields for layout compatibility; they now reflect routed-only logic
    document.getElementById("routeLegOut").textContent = fmtDHM(adjustedRoutedMin);
    document.getElementById("jumpLegOut").textContent = "—";
    document.getElementById("legsSumOut").textContent = fmtDHM(adjustedRoutedMin);

    document.getElementById("speedOut").textContent = speedLine;

    document.getElementById("assumeOut").textContent =
      (profile==="flip") ? "Start: rest • End: rest" : "Start: rest • End: not-rest";

    const jumpNote = (jumpKm > 0)
      ? `100D clearance requirement shown: ${fmt(jumpKm/1000,1)} kkm (not added to route).`
      : `100D clearance not applied (${jump.label}).`;

    document.getElementById("notesOut").innerHTML =
      `<b>Transit:</b> ${profileLabel}<br>
       <b>Distance Mode:</b> ${dist.modeLabel}<br>
       <b>Arc Multiplier:</b> ${fmt(dist.arcMult,2)}× (routed ÷ raw)<br>
       <b>100D Clearance:</b> ${jumpNote} <span style="opacity:.75">(time is advisory; not added to route)</span><br>
       <b>Astrogation:</b> ${astroLog}<br>
       <span style="opacity:.75">
         Notes: Time and distance are computed for the routed leg only. 100D is displayed as a clearance requirement, not a flown leg.
       </span>`;

    // Brief text
    lastBrief = buildBrief({
      profileLabel,
      thrustG,
      rawKKM: fmt(rawKm/1000, 2),
      rawAU: fmt(rawKm/AU_TO_KM, 1),
      routeKKM: fmt(routedKm/1000, 2),
      routeAU: fmt(routedKm/AU_TO_KM, 1),
      arcMult: fmt(dist.arcMult,2),

      jumpKKM: fmt(jumpKm/1000, 2),
      jumpAU: fmt(jumpKm/AU_TO_KM, 1),
      jumpLabel: jump.label,
      jumpTimeDHM: (jumpKm > 0) ? fmtDHM(jumpTimeSelMin) : "—",

      commLagDHM: fmtDHM(commLagMin),

      nominalRoutedDHM: fmtDHM(nominalRoutedMin),
      adjustedRoutedDHM: fmtDHM(adjustedRoutedMin),

      speedLine,
      astroLine: astroBrief,
      notesShort: `${profileLabel}. ${useAstro ? "Astrogation deviations applied (routed leg)." : "No Astrogation deviations."} ${jumpKm>0 ? "100D shown (clearance only)." : "100D not applied."}`
    });

    setStatus(true, "NAV SOLUTION: Route computed. Travel time " + fmtDHM(adjustedRoutedMin));
    if(reveal) revealOutput("resultsTop");
  } catch(e){
    const msg = (e && e.message) ? e.message : String(e);
    setError(msg);
    setStatus(false, "FAULT • Script error");
  }
}

  function compute100DOnly(reveal = true){
    calculationMode = "clearance";
    clearError();
    invalidateSolution();
    syncPills();

    const thrustG = parseFloat(document.getElementById("thrust").value);
    const profile = document.getElementById("profile").value;
    if(!Number.isFinite(thrustG) || thrustG <= 0){
      return setError("Enter a positive thrust in G to compute 100D time.");
    }

    // Enable 100D UI so body type/size can be selected
    const use = document.getElementById("use100d");
    if(use && !use.checked){
      use.checked = true;
      on100DToggle();
    }

    let result;
    try { result = NavEngine.computeClearance(readNavInput()); }
    catch(error){ return setError(error.message); }
    navResult = result;
    const {jump,timeSelectedMin:jumpTimeSelMin} = result;
    const jumpKm = jump.clearanceKm;

    // Update 100D output only (do not compute route)
    document.getElementById("jumpOut").textContent =
      (jumpKm > 0)
        ? `${fmtDistance(jumpKm)} • ${fmtDHM(jumpTimeSelMin)}`
        : `N/A / 0.0 AU • ${jump.label}`;

    document.getElementById("notesOut").innerHTML =
      (jumpKm > 0)
        ? `<b>100D Clearance:</b> ${fmtDistance(jumpKm)} • ${fmtDHM(jumpTimeSelMin)} <span style="opacity:.75">(advisory only)</span><br>
           <span style="opacity:.75">Clearance is displayed only. It is not added to travel time or distance.</span>`
        : `<b>100D Clearance:</b> N/A • ${jump.label}`;

    document.getElementById("mainSub").textContent = "100D advisory only. No route or NAV brief computed.";
    setStatus(jumpKm > 0, jumpKm > 0 ? "100D COMPUTED: " + document.getElementById("jumpOut").textContent + " (advisory)" : "100D N/A • Check body type/size");
    if(reveal) revealOutput("resultsTop");
  }

  function init(){
    populateOrbitSelects();
    populateMapOrbitSelects();
    onMapBodyModeChange();
    onDistModeChange();
    onRouteTypeChange();
    onAstroToggle();
    syncPills();
    on100DToggle();
    onJumpBodyTypeChange();
    update100DPreview();

    // Never present or copy a prior solution as matching edited inputs.
    document.querySelector(".panelBody").addEventListener("input", event => {
      if(event.target.id === "profile") return;
      clearError();
      invalidateSolution();
      updateOrbitDistancePreview();
      updateMapAUPreview();
      update100DPreview();
    });
    document.querySelector(".panelBody").addEventListener("change", event => {
      // Profile changes explicitly recompute through their inline handler.
      if(event.target.id !== "profile"){
        clearError();
        invalidateSolution();
      }
    });
  }
  // The only translation from page controls into the public calculation contract.
  function readNavInput(){
    const value = id => document.getElementById(id).value;
    const checked = id => document.getElementById(id).checked;
    const orbit = prefix => ({whole:value(prefix+'Whole'),fraction:value(prefix+'Frac')});
    const body = (prefix,auId) => ({mode:value(prefix+'Mode'),au:value(auId),orbit:orbit(prefix+'Orbit')});
    return {
      thrustG:value('thrust'),profile:value('profile'),
      distance:{mode:value('distMode'),km:value('distanceKm'),au:value('distanceAu'),
        start:orbit('orbitStart'),end:orbit('orbitEnd'),a:body('a','au1'),b:body('b','au2'),
        separation:value('separation'),routeType:value('routeType'),safety:value('safety')},
      clearance:{enabled:checked('use100d'),bodyType:value('jumpBodyType'),sizeCode:value('sizeCode')},
      astrogation:{enabled:checked('useAstro'),autoDice:checked('autoDice'),effect:value('effect'),manualPercent:value('manualPct')}
    };
  }
  function formatAstrogation(astro){
    const {kind,effect,autoDice,totalPct} = astro;
    let astroLog = 'Astrogation deviations not applied.', astroBrief = 'Not applied';
    if(kind === 'manual'){
      astroLog = `Manual % override: ${fmt(totalPct,1)}% applied to routed leg.`;
      astroBrief = `Manual %: ${fmt(totalPct,1)}%`;
    } else if(kind === 'zero'){
      astroLog = 'Effect 0: no variance applied.'; astroBrief = 'Effect 0: no variance';
    } else if(kind === 'optimization'){
      astroLog = autoDice ? `Effect +${effect}: routed optimization −${fmt(totalPct,1)}% (D3% per point).` : `Effect +${effect}: routed optimization −${fmt(totalPct,1)}% (expected D3=2% per point).`;
      astroBrief = `Effect +${effect}: -${fmt(totalPct,1)}%`;
    } else if(kind === 'failure'){
      astroLog = autoDice ? `FAILURE (Effect ${effect}): routed correction +${fmt(totalPct,1)}% (4D% + 1D%×${Math.abs(effect)}).` : `FAILURE (Effect ${effect}): routed correction +${fmt(totalPct,1)}% (expected 4D=14% + 3.5%×${Math.abs(effect)}).`;
      astroBrief = `FAILURE Effect ${effect}: +${fmt(totalPct,1)}%`;
    } else if(kind === 'inefficiency'){
      astroLog = autoDice ? `Effect ${effect}: routed inefficiency +${fmt(totalPct,1)}% (D6% per point).` : `Effect ${effect}: routed inefficiency +${fmt(totalPct,1)}% (expected D6=3.5% per point).`;
      astroBrief = `Effect ${effect}: +${fmt(totalPct,1)}%`;
    }
    return {astroLog,astroBrief};
  }

  init();
