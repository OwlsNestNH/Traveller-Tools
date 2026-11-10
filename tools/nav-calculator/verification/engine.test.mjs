import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import Nav, * as named from '../engine.mjs';
const source = await readFile(new URL('../engine.js',import.meta.url),'utf8');
const require = createRequire(import.meta.url);
const base = {thrustG:1,profile:'flip',distance:{mode:'km',km:100000}};
const close = (actual,expected) => assert.ok(Math.abs(actual-expected) <= Math.max(1,Math.abs(expected))*1e-13,`${actual} != ${expected}`);
const throws = (fn,code='INVALID_INPUT') => assert.throws(fn,error => error.code === code);
const frozen = value => {if(value && typeof value === 'object'){Object.freeze(value);Object.values(value).forEach(frozen);}return value;};

test('same frozen v1 API in CommonJS, ESM and a sandbox with no browser or RNG',()=>{
  assert.equal(Nav,require('../engine.js'));assert.equal(named.solveRoute,Nav.solveRoute);
  assert.equal(Nav.API_VERSION,'1.0.0');assert.ok(Object.isFrozen(Nav));
  assert.ok(Object.isFrozen(Nav.constants));
  for(const value of Object.values(Nav.constants)) if(value && typeof value==='object') assert.ok(Object.isFrozen(value));
  assert.doesNotMatch(source,/\b(document|window|navigator|localStorage|sessionStorage|fetch|XMLHttpRequest)\b|Math\.random/);
  const context=vm.createContext({});vm.runInContext('Math.random = () => {throw Error("RNG dependency");}',context);
  vm.runInContext(source,context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.TravellerNav.solveRoute(base))),Nav.solveRoute(base));
  assert.deepEqual(Object.keys(context),['TravellerNav']);
});
test('fixed direct route uses original physics, numeric outputs and finite JSON',()=>{
  const s=Nav.solveRoute(base);close(s.nominalRoutedMin,2*Math.sqrt(100000000/9.80665)/60);
  close(s.adjustedRoutedMin,s.nominalRoutedMin);close(s.vKmS,Math.sqrt(9.80665*100000000)/1000);
  close(s.commLagMin,100000/150000000*8.3);assert.equal(s.totalKm,100000);assert.equal(s.distance.rawKm,100000);
  assert.deepEqual(s.warnings,[]);assert.deepEqual(JSON.parse(JSON.stringify(s)),s);
  const constant=Nav.solveRoute({...base,profile:'const'});close(constant.nominalRoutedMin,s.nominalRoutedMin/Math.sqrt(2));close(constant.vKmS,s.vKmS*Math.sqrt(2));
  assert.equal(Nav.solveRoute({...base,distance:{mode:'au',au:2}}).totalKm,300000000);
});
test('all 21 orbit entries and fractions preserve table and difference arithmetic',()=>{
  const bases=[0,.4,.7,1,1.6,2.8,5.2,10,20,40,77,154,308,615,1230,2500,4900,9800,19500,39500,78700];
  const diffs=[.4,.3,.3,.6,1.2,2.4,4.8,10,20,37,77,154,307,615,1270,2400,4900,9700,20000,39200,0];
  for(let whole=0;whole<21;whole++) for(const fraction of [0,.01,.25,.5,.99]){
    const expected=bases[whole]+diffs[whole]*fraction;assert.equal(Nav.orbitToAU(whole,fraction),expected);
    const end={whole:(whole+7)%21,fraction:.25};const other=bases[end.whole]+diffs[end.whole]*end.fraction;
    assert.equal(Nav.computeDistance({mode:'orbit',start:{whole,fraction},end}).rawKm,Math.abs(expected-other)*150000000);
  }
});
test('map geometry covers both body modes, five angles and all UI multipliers',()=>{
  for(const aMode of ['au','orbit']) for(const bMode of ['au','orbit']) for(const [separation,angle] of Object.entries({same:0,'1':Math.PI/4,'2':Math.PI/2,'3':3*Math.PI/4,opp:Math.PI})) for(const safety of [1.5,2,2.5]){
    const a={mode:aMode,au:1,orbit:{whole:3,fraction:0}},b={mode:bMode,au:5.2,orbit:{whole:6,fraction:0}};
    const direct=Nav.computeDistance({mode:'map',a,b,separation});const raw=Math.hypot(4.2,2*Math.sqrt(1)*Math.sqrt(5.2)*Math.sin(angle/2))*150000000;
    assert.equal(direct.rawKm,raw);assert.equal(direct.routedKm,raw);
    const routed=Nav.solveRoute({...base,distance:{mode:'map',a,b,separation,routeType:'trans',safety}});
    assert.equal(routed.distance.rawKm,raw);assert.equal(routed.totalKm,(1+5.2)*safety*150000000);
    assert.equal(routed.commLagMin,raw/150000000*8.3);
  }
});
test('all clearance presets are advisory and do not change route timing',()=>{
  for(const [sizeCode,diameter] of Object.entries(Nav.constants.SIZE_DIAM_KM)) for(const profile of ['flip','const']){
    const clearance={enabled:true,bodyType:'rocky',sizeCode};const route=Nav.solveRoute({...base,profile,clearance});
    assert.equal(route.totalKm,base.distance.km);assert.equal(route.nominalRoutedMin,Nav.solveRoute({...base,profile}).nominalRoutedMin);
    assert.equal(route.jump.clearanceKm,(diameter??0)*100);
    const only=Nav.computeClearance({...base,profile,clearance:{...clearance,enabled:false}});
    assert.equal(only.jump.clearanceKm,route.jump.clearanceKm);assert.equal(only.timeSelectedMin,route.jumpTimeSelMin);
  }
  for(const [bodyType,diameter] of Object.entries(Nav.constants.GAS_GIANT_DIAM_KM)) assert.equal(Nav.clearanceDistance({enabled:true,bodyType}).clearanceKm,diameter*100);
  assert.equal(Nav.clearanceDistance().clearanceKm,0);
});
test('fixed dice, expected dice, failure and manual adjustment without implicit rolls',()=>{
  for(const effect of [0,1,3,10,-1,-5,-6,-10]) for(const autoDice of [true,false]){
    const astrogation={enabled:true,effect,autoDice};const sides=Nav.requiredDice(astrogation);
    const rolls=sides.map((side,i)=>1+i%side);const s=Nav.solveRoute({...base,astrogation},rolls);
    const expected=autoDice ? rolls.reduce((a,b)=>a+b,0) : effect>0 ? effect*2 : Math.abs(effect)*3.5+(effect<=-6?14:0);
    assert.equal(s.astrogation.totalPct,expected);close(s.adjustedRoutedMin,s.nominalRoutedMin*(1+(effect>0?-expected:expected)/100));
    assert.equal(s.astrogation.rolls.length,sides.length);
  }
  for(const manualPercent of [-100,-10,0,20,99.9]){
    const s=Nav.solveRoute({...base,astrogation:{enabled:true,effect:'invalid',manualPercent}});
    close(s.adjustedRoutedMin,s.nominalRoutedMin*(1-manualPercent/100));assert.deepEqual(s.astrogation.sides,[]);
  }
});
test('dice contract rejects missing, sparse, extra, fractional and out-of-range rolls',()=>{
  const input={...base,astrogation:{enabled:true,effect:2}};
  assert.throws(()=>Nav.solveRoute(input),e=>e.code==='DICE_REQUIRED'&&e.sides.join(',')==='3,3');
  for(const rolls of [Array(2),[1,undefined],[0,2],[4,1],[1.5,2],[1,2,3],null]) throws(()=>Nav.solveRoute(input,rolls),'INVALID_DICE');
  throws(()=>Nav.solveRoute(base,[1]),'INVALID_DICE');
  assert.equal(Nav.solveRoute(input,[1,3]).astrogation.totalPct,4);
  // Invalid route errors take precedence, so frontend does not consume random dice.
  throws(()=>Nav.solveRoute({...input,thrustG:0}));
});
test('input objects, supplied dice and API constants cannot leak state across calls',()=>{
  const input=frozen({...base,astrogation:{enabled:true,effect:-6},clearance:{enabled:true,bodyType:'rocky',sizeCode:'8'}});
  const rolls=Object.freeze(Array(10).fill(3));const before=JSON.stringify(input);
  const a=Nav.solveRoute(input,rolls),b=Nav.solveRoute(input,rolls);assert.deepEqual(a,b);assert.equal(JSON.stringify(input),before);
  a.distance.rawKm=0;a.astrogation.rolls[0]=99;a.astrogation.sides[0]=99;a.jump.clearanceKm=0;
  assert.deepEqual(Nav.solveRoute(input,rolls),b);
  assert.throws(()=>{Nav.constants.ORBIT_BASE_AU[3]=99;},TypeError);
  assert.throws(()=>{Nav.constants.SIZE_DIAM_KM['8']=1;},TypeError);
});
test('numeric and enum boundary validation has useful stable codes',()=>{
  for(const thrustG of ['',null,true,0,-1,NaN,Infinity,'1junk']) throws(()=>Nav.solveRoute({...base,thrustG}));
  for(const km of ['',null,true,0,-1,Infinity,'1junk']) throws(()=>Nav.solveRoute({...base,distance:{mode:'km',km}}));
  for(const profile of ['unknown',null]) throws(()=>Nav.solveRoute({...base,profile}));
  for(const value of [null,true,false,{},[],undefined,'',-1,21,1.5]){
    assert.ok(Number.isNaN(Nav.orbitToAU(value,0)));throws(()=>Nav.computeDistance({mode:'orbit',start:{whole:value,fraction:0},end:{whole:3,fraction:0}}));
  }
  for(const fraction of [null,true,{},'',-1,1,Infinity,.001]) throws(()=>Nav.computeDistance({mode:'orbit',start:{whole:3,fraction},end:{whole:6,fraction:0}}));
  for(const effect of ['',null,true,1.5,1001,-1001,Infinity]) throws(()=>Nav.solveRoute({...base,astrogation:{enabled:true,effect}}));
  for(const manualPercent of [100,150,Infinity,'junk']) throws(()=>Nav.solveRoute({...base,astrogation:{enabled:true,manualPercent}}));
  throws(()=>Nav.computeDistance({mode:'au',au:1e308}));
  throws(()=>Nav.computeDistance({mode:'map',a:{au:1},b:{au:1},separation:'same'}));
  throws(()=>Nav.computeDistance({mode:'map',a:{au:1},b:{au:2},separation:'constructor'}));
  throws(()=>Nav.clearanceDistance({enabled:true,bodyType:'constructor'}));
  throws(()=>Nav.clearanceDistance({enabled:true,bodyType:'rocky',sizeCode:'constructor'}));
  throws(()=>Nav.solveRoute({...base,astrogation:{enabled:true,effect:50,autoDice:false}}));
  throws(()=>Nav.computeClearance({thrustG:1e-320}));
});
test('unrepresentable advisory times remain JSON-safe without changing route result',()=>{
  const s=Nav.solveRoute({thrustG:1e-308,distance:{mode:'km',km:1e-310},clearance:{enabled:true}});
  assert.ok(Number.isFinite(s.nominalRoutedMin));assert.equal(s.jumpTimeSelMin,null);assert.equal(s.jumpTimeConstMin,null);assert.equal(s.jumpTimeFlipMin,null);
  assert.deepEqual(s.warnings,['CLEARANCE_TIME_OUT_OF_RANGE']);assert.deepEqual(JSON.parse(JSON.stringify(s)),s);
});
test('presentation structure and styles are byte-identical to PR264',async()=>{
  const original=await readFile(new URL('./fixtures/pr264.html',import.meta.url),'utf8');
  const current=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const removeScripts=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>\s*/g,'').replace(/\r\n/g,'\n');
  assert.equal(removeScripts(current),removeScripts(original));
});
