/**
 * Traveller Nav calculation API v1.0.0. No DOM, storage, network or random source.
 * Browser: globalThis.TravellerNav. Node: require('./engine.js').
 * Inputs/outputs and units: README.md. Caller supplies dice as an array.
 */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.TravellerNav = factory();
})(typeof globalThis === 'object' ? globalThis : this, function(){
  'use strict';
// Units / constants
  const AU_TO_KM = 150000000;      // rounded per spec
  const AU_TO_LAG_MIN = 8.3;       // one-way light time in minutes per AU

  // Orbit# table (World Builder's Handbook): base AU + (difference AU * fractional)
  // Orbit# 0..20
  const ORBIT_BASE_AU = [
    0, 0.4, 0.7, 1.0, 1.6, 2.8, 5.2, 10, 20, 40, 77,
    154, 308, 615, 1230, 2500, 4900, 9800, 19500, 39500, 78700
  ];
  const ORBIT_DIFF_AU = [
    0.4, 0.3, 0.3, 0.6, 1.2, 2.4, 4.8, 10, 20, 37, 77,
    154, 307, 615, 1270, 2400, 4900, 9700, 20000, 39200, 0
  ];
const G0 = 9.80665;              // m/s^2

  // expected values if Auto-roll deviation dice is off
  const EV_D3 = 2.0;
  const EV_D6 = 3.5;
  const EV_4D6 = 14.0;

  // Size chart: Average diameters in km
  const SIZE_DIAM_KM = {
    "0": null, "R": null, "S": 600,
    "1": 1600, "2": 3200, "3": 4800, "4": 6400,
    "5": 8000, "6": 9600, "7": 11200, "8": 12800,
    "9": 14400, "A": 16000, "B": 17600, "C": 19200,
    "D": 20800, "E": 22400, "F": 24000
  };

  // Gas giant diameter presets (km)
  const GAS_GIANT_DIAM_KM = {
    "gg_small": 60000,
    "gg_std": 120000,
    "gg_large": 160000,
    "gg_super": 200000
  };
  const API_VERSION = '1.0.0';
  const ORBIT_ERROR = 'Enter Orbit# 0–20 and fractions from 0 to 0.99 in steps of 0.01.';
  const finite = value => typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
  function fail(message, code = 'INVALID_INPUT'){ const error = new Error(message); error.code = code; throw error; }
  function profileValue(profile = 'flip'){
    if(profile !== 'flip' && profile !== 'const') fail('Select a transit profile.');
    return profile;
  }
function orbitToAU(whole, frac){
    const w = finite(whole), f = finite(frac);
    if(String(whole).trim() === "" || String(frac).trim() === "" || !Number.isInteger(w) || w < 0 || w > 20 || !Number.isFinite(f) || f < 0 || f > 0.99) return NaN;
    return ORBIT_BASE_AU[w] + (ORBIT_DIFF_AU[w] * f);
  }
  function checkedOrbit(orbit = {}){
    const au = orbitToAU(orbit.whole, orbit.fraction);
    const fraction = Number(orbit.fraction);
    if(!Number.isFinite(au) || Math.abs(fraction * 100 - Math.round(fraction * 100)) > 1e-8) fail(ORBIT_ERROR);
    return au;
  }
  function mapBodyAU(body = {}){
    if(body.mode === 'orbit') return checkedOrbit(body.orbit);
    if(body.mode !== undefined && body.mode !== 'au') fail('Select a map body distance mode.');
    return finite(body.au);
  }
  function distanceFromInput(input = {}){
    const mode = input.mode;
    if(mode === 'km' || mode === 'au'){
      const value = finite(input[mode]);
      if(!Number.isFinite(value) || value <= 0) fail(mode === 'km' ? 'Enter a positive distance in km.' : 'Enter a positive distance in AU.');
      const km = mode === 'km' ? value : value * AU_TO_KM;
      return {rawKm:km, routedKm:km, arcMult:1, modeLabel:mode === 'km' ? 'DIRECT (KM)' : 'DIRECT (AU)'};
    }
    if(mode === 'orbit'){
      const a1 = checkedOrbit(input.start), a2 = checkedOrbit(input.end);
      const dAU = Math.abs(a2 - a1);
      if(!Number.isFinite(dAU) || dAU <= 0) fail('Select different start/end Orbit# values.');
      const km = dAU * AU_TO_KM;
      return {rawKm:km, routedKm:km, arcMult:1, modeLabel:'ORBIT# (WBH)'};
    }
    if(mode === 'map'){
      // Validate both orbit entries before the AU radius checks, matching the UI.
      for(const body of [input.a,input.b]) if(body?.mode === 'orbit') checkedOrbit(body.orbit);
      const au1 = mapBodyAU(input.a), au2 = mapBodyAU(input.b);
      if(!Number.isFinite(au1) || !Number.isFinite(au2) || au1 <= 0 || au2 <= 0) fail('Enter positive AU radii (or Orbit# values) for both bodies.');
      const inner = Math.min(au1, au2), outer = Math.max(au1, au2);
      const angles = {same:0, '1':Math.PI/4, '2':Math.PI/2, '3':3*Math.PI/4, opp:Math.PI};
      const angle = Object.hasOwn(angles,input.separation) ? angles[input.separation] : undefined;
      if(angle === undefined) fail('Select a compass separation.');
      const rawAU = Math.hypot(outer - inner, 2 * Math.sqrt(inner) * Math.sqrt(outer) * Math.sin(angle/2));
      if(!Number.isFinite(rawAU) || rawAU <= 0) fail('The selected bodies have zero separation. Choose different radii or directions.');
      const routeType = input.routeType ?? 'direct';
      if(routeType !== 'direct' && routeType !== 'trans') fail('Select a route type.');
      let routedAU = rawAU, arcMult = 1;
      if(routeType === 'trans'){
        const safety = finite(input.safety);
        if(!Number.isFinite(safety) || safety <= 0) fail('Select a positive trans-solar multiplier.');
        routedAU = (au1 + au2) * safety;
        arcMult = routedAU / rawAU;
      }
      return {rawKm:rawAU*AU_TO_KM, routedKm:routedAU*AU_TO_KM, arcMult, modeLabel:routeType === 'trans' ? 'SYSTEM MAP (TRANS-SOLAR)' : 'SYSTEM MAP (DIRECT)'};
    }
    fail('Select a distance mode.');
  }
  function computeDistance(input = {}){
    const distance = distanceFromInput(input);
    if(!Number.isFinite(distance.rawKm) || !Number.isFinite(distance.routedKm) || distance.rawKm <= 0 || distance.routedKm <= 0) fail('Distance is outside the supported positive, finite range.');
    // The rounded UI shows an em dash for an unrepresentable multiplier.
    // Use null in the public result so it remains JSON-safe.
    if(!Number.isFinite(distance.arcMult)) distance.arcMult = null;
    return distance;
  }
  function clearanceDistance(input = {}){
    if(!input.enabled) return {clearanceKm:0, label:'Not applied'};
    const type = input.bodyType ?? 'rocky';
    if(type === 'rocky'){
      const code = String(input.sizeCode ?? '8');
      if(!Object.hasOwn(SIZE_DIAM_KM,code)) fail('Select a supported body size.');
      const diamKm = SIZE_DIAM_KM[code];
      return diamKm === null ? {clearanceKm:0,label:`N/A (Size ${code})`} : {clearanceKm:diamKm*100,label:`100D from Size ${code} (${diamKm.toLocaleString()} km dia)`};
    }
    if(!Object.hasOwn(GAS_GIANT_DIAM_KM,type)) fail('Select a supported body type.');
    const diamKm = GAS_GIANT_DIAM_KM[type];
    const tag = {gg_small:'Gas Giant Small',gg_std:'Gas Giant Standard',gg_large:'Gas Giant Large',gg_super:'Gas Giant Super'}[type];
    return {clearanceKm:diamKm*100,label:`100D from ${tag} (${diamKm.toLocaleString()} km dia)`};
  }
function timeMinutesFromDistance(distanceKm, thrustG, profile){
    const a = thrustG * G0;
    const dMeters = distanceKm * 1000;

    let tSec;
    if(profile === "flip"){
      tSec = 2 * Math.sqrt(dMeters / a);
    } else {
      tSec = Math.sqrt((2 * dMeters) / a);
    }
    return tSec / 60;
  }
function speedFromDistance(distanceKm, thrustG, profile){
    const a = thrustG * G0;
    const dMeters = distanceKm * 1000;

    if(profile === "flip"){
      return Math.sqrt(a * dMeters);
    } else {
      return Math.sqrt(2 * a * dMeters);
    }
  }
  function astrogationPlan(input = {}){
    if(!input.enabled) return {kind:'none',sides:[]};
    const manualInput = input.manualPercent == null ? '' : String(input.manualPercent).trim();
    if(manualInput !== ''){
      const percent = finite(manualInput);
      if(!Number.isFinite(percent) || percent >= 100) fail('Manual time reduction must be finite and below 100%.');
      return {kind:'manual',percent,sides:[]};
    }
    const effect = finite(input.effect);
    if(!Number.isSafeInteger(effect)) fail('Enter a whole-number Astrogation Effect (or a manual % override).');
    if(Math.abs(effect)>1000) fail('Effect is outside the supported range (-1000 to 1000). Use a manual percentage for exceptional cases.');
    const autoDice = input.autoDice !== false;
    const count = effect > 0 ? effect : -effect + (effect <= -6 ? 4 : 0);
    return {kind:effect === 0 ? 'zero' : effect > 0 ? 'optimization' : effect <= -6 ? 'failure' : 'inefficiency',effect,autoDice,sides:autoDice ? Array(count).fill(effect > 0 ? 3 : 6) : []};
  }
  function requiredDice(input = {}){ return astrogationPlan(input).sides; }
  function applyAstrogation(nominalMinutes, input = {}, rolls = []){
    const plan = astrogationPlan(input);
    if(!Array.isArray(rolls)) fail('Dice rolls must be an array.', 'INVALID_DICE');
    if(rolls.length < plan.sides.length){
      const error = new Error('Supply the required Astrogation dice rolls.');
      error.code = 'DICE_REQUIRED'; error.sides = plan.sides.slice(); throw error;
    }
    if(rolls.length !== plan.sides.length) fail('Supply exactly the required Astrogation dice rolls.', 'INVALID_DICE');
    for(let i=0;i<rolls.length;i++){ const roll=rolls[i]; if(!Number.isInteger(roll)||roll<1||roll>plan.sides[i]) fail('Each die must be an integer within its die size.', 'INVALID_DICE'); }
    let totalPct = 0;
    if(plan.kind === 'manual') totalPct = plan.percent;
    else if(plan.autoDice) totalPct = rolls.reduce((sum,roll)=>sum+roll,0);
    else if(plan.kind === 'optimization') totalPct = plan.effect * EV_D3;
    else if(plan.kind === 'failure') totalPct = EV_4D6 + Math.abs(plan.effect) * EV_D6;
    else if(plan.kind === 'inefficiency') totalPct = Math.abs(plan.effect) * EV_D6;
    const reduction = plan.kind === 'manual' || plan.kind === 'optimization';
    const adjustedMinutes = nominalMinutes * (1 + (reduction ? -totalPct : totalPct)/100);
    return {...plan,totalPct,adjustedMinutes,rolls:rolls.slice()};
  }
  function computeClearance(input = {}){
    const thrustG = finite(input.thrustG), profile = profileValue(input.profile);
    if(!Number.isFinite(thrustG) || thrustG <= 0) fail('Enter a positive thrust in G to compute 100D time.');
    const jump = clearanceDistance({...input.clearance,enabled:true});
    const timeConstMin = jump.clearanceKm > 0 ? timeMinutesFromDistance(jump.clearanceKm,thrustG,'const') : 0;
    const timeFlipMin = jump.clearanceKm > 0 ? timeMinutesFromDistance(jump.clearanceKm,thrustG,'flip') : 0;
    const timeSelectedMin = profile === 'flip' ? timeFlipMin : timeConstMin;
    if(!Number.isFinite(timeSelectedMin)) fail('100D time is outside the supported finite range.');
    return {thrustG,profile,jump,timeConstMin,timeFlipMin,timeSelectedMin};
  }
  function solveRoute(input = {}, rolls = []){
    const thrustG = finite(input.thrustG), profile = profileValue(input.profile);
    if(!Number.isFinite(thrustG) || thrustG <= 0) fail('Enter a positive thrust in G.');
    const distance = computeDistance(input.distance);
    const {rawKm,routedKm} = distance;
    if(!Number.isFinite(rawKm) || !Number.isFinite(routedKm) || rawKm <= 0 || routedKm <= 0) fail('Distance is outside the supported positive, finite range.');
    const jump = clearanceDistance(input.clearance);
    const jumpKm = jump.clearanceKm;
    const jumpTimeConstMin = jumpKm > 0 ? timeMinutesFromDistance(jumpKm,thrustG,'const') : 0;
    const jumpTimeFlipMin = jumpKm > 0 ? timeMinutesFromDistance(jumpKm,thrustG,'flip') : 0;
    const jumpTimeSelMin = profile === 'flip' ? jumpTimeFlipMin : jumpTimeConstMin;
    const totalKm = routedKm;
    const commLagMin = (rawKm / AU_TO_KM) * AU_TO_LAG_MIN;
    const nominalRoutedMin = timeMinutesFromDistance(routedKm,thrustG,profile);
    const astrogation = applyAstrogation(nominalRoutedMin,input.astrogation,rolls);
    const adjustedRoutedMin = astrogation.adjustedMinutes;
    if(!Number.isFinite(nominalRoutedMin) || nominalRoutedMin <= 0 || !Number.isFinite(adjustedRoutedMin) || adjustedRoutedMin <= 0) fail('The calculation must produce a positive, finite travel time. Check thrust, distance and time reduction.');
    const vKmS = speedFromDistance(routedKm,thrustG,profile)/1000;
    if(!Number.isFinite(vKmS)) fail('Speed is outside the supported finite range.');
    const warnings = [];
    if(distance.arcMult === null) warnings.push('ARC_MULTIPLIER_OUT_OF_RANGE');
    if(!Number.isFinite(jumpTimeConstMin) || !Number.isFinite(jumpTimeFlipMin)) warnings.push('CLEARANCE_TIME_OUT_OF_RANGE');
    const advisory = value => Number.isFinite(value) ? value : null;
    return {thrustG,profile,distance,jump,jumpTimeConstMin:advisory(jumpTimeConstMin),
      jumpTimeFlipMin:advisory(jumpTimeFlipMin),jumpTimeSelMin:advisory(jumpTimeSelMin),
      totalKm,commLagMin,nominalRoutedMin,adjustedRoutedMin,vKmS,astrogation,warnings};
  }
  const constants = Object.freeze({AU_TO_KM,AU_TO_LAG_MIN,G0,EV_D3,EV_D6,EV_4D6,
    ORBIT_BASE_AU:Object.freeze(ORBIT_BASE_AU),ORBIT_DIFF_AU:Object.freeze(ORBIT_DIFF_AU),
    SIZE_DIAM_KM:Object.freeze(SIZE_DIAM_KM),GAS_GIANT_DIAM_KM:Object.freeze(GAS_GIANT_DIAM_KM)});
  return Object.freeze({API_VERSION,constants,orbitToAU,computeDistance,clearanceDistance,requiredDice,solveRoute,computeClearance});
});
