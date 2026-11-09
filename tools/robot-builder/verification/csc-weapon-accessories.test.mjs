import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {WEAPONS,WEAPON_ACCESSORIES,weaponControl,evaluateWeapons} from '../engine/weapons.mjs';
import {CSC_WEAPON_ACCESSORIES,cscAccessoryEligibility,evaluateCscAccessories} from '../engine/csc-weapon-accessories.mjs';
import {CSC_SLUG_WEAPONS} from '../engine/csc-slug-weapons.mjs';
import {CSC_ENERGY_WEAPONS} from '../engine/csc-energy-weapons.mjs';
import {createRobotApi} from '../js/api.mjs';

// Independent table values checked against complete, privately rendered CSC pp174-177.
const expected=[
 ['gyrostabiliser',9,500,1,'gyrostabiliser','175','big-game-rifle'],
 ['holographic-sight',10,2000,.5,'sight','175','air-rifle-4'],
 ['intelligent-0',11,1000,null,'intelligent','175','air-rifle-4'],
 ['intelligent-1',12,1000,null,'intelligent','175','air-rifle-4'],
 ['intelligent-2',13,1200,null,'intelligent','175','air-rifle-4'],
 ['intelligent-3',15,2000,null,'intelligent','175','air-rifle-4'],
 ['laser-sight-8',8,200,null,'sight','176','air-rifle-4'],
 ['laser-sight-10',10,200,null,'sight','176','air-rifle-4'],
 ['scope-5',5,50,null,'sight','176','air-rifle-4'],
 ['scope-7',7,50,null,'sight','176','air-rifle-4'],
 ['smart-tracker',11,500,null,'smart-tracker','175,177','air-rifle-4'],
 ['suppressor',8,250,null,'suppressor','131,177','air-rifle-4']
];
const record=(id,accessories=[],patch={})=>({id:'test',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,accessories:accessories.map(a=>'csc-'+a),...patch});
const design=(id,accessories=[],patch={},tl=16)=>updateDesign(createDesign({techLevel:tl}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,accessories,patch)]}}});
const run=(...args)=>evaluateDesign(design(...args));
const profile=(...args)=>run(...args).totals.weapons[0];
const direct=(id,accessories=[],patch={},tl=16)=>evaluateWeapons({kind:'standard',techLevel:tl,selections:{physical:{weapons:[record(id,accessories,patch)]}}},[{id:'arm',size:9,dexterity:8}],[]);
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const control=(d)=>weaponControl(d).itemFields.find(f=>f.field==='accessories');
const choices=(id)=>control().choicesBy.values[id].map(a=>a.id);

for(const [id,tl,cost,mass,family,pages,weaponId] of expected){
 test('CSC accessory '+id+' preserves exact price, TL, mass, provenance and linked accounting',()=>{
  const a=CSC_WEAPON_ACCESSORIES.find(a=>a.id==='csc-'+id);
  assert.deepEqual([a.tl,a.cost,a.massKg,a.family,a.source.pages],[tl,cost,mass,family,pages]);assert.equal(a.sourceFamily,'csc-2023');assert.equal(a.source.book,'Central Supply Catalogue Update 2023');assert.equal(a.source.edition,'Mongoose revised printing (copyright 2026)');
  const accessories=id==='smart-tracker'?['intelligent-0',id]:[id],accessoryCost=cost+(id==='smart-tracker'?1000:0),w=WEAPONS.find(w=>w.id==='csc-'+weaponId);
  const base=run(weaponId,accessories);assert.equal(base.status,'verified');assert.equal(base.totals.weapons[0].cost,w.cost+1000+w.magazineCost+accessoryCost);
  const linked=profile(weaponId,accessories,{linkedWeapons:3,autoload:true,extraMagazines:2,fireControl:'basic'});
  assert.equal(linked.cost,3*(w.cost+1000+5*w.magazineCost+accessoryCost)+10000);assert.equal(linked.slots,13);
  const detail=linked.accessoryDetails.find(a=>a.id==='csc-'+id);assert.deepEqual([detail.unitCost,detail.copies,detail.cost],[cost,3,cost*3]);assert.equal(detail.source.pages,pages);
  assert.equal(profile(weaponId,accessories,{initialMagazines:0}).cost,w.cost+1000+accessoryCost);
  assert.equal(direct(weaponId,accessories,{placement:'held',manipulatorId:'arm'}).weapons[0].cost,w.cost+w.magazineCost+accessoryCost);
  assert.ok(has(direct(weaponId,accessories,{},tl-1),'ACCESSORY_TL'));assert.ok(!has(direct(weaponId,accessories,{},tl),'ACCESSORY_TL'));
  assert.deepEqual(importDesign(exportDesign(design(weaponId,accessories))),design(weaponId,accessories));
 });
}

test('bounded catalogue contains twenty unique CSC accessory IDs and unchanged nine Core IDs/prices',()=>{
 assert.equal(CSC_WEAPON_ACCESSORIES.length,20);assert.deepEqual(CSC_WEAPON_ACCESSORIES.slice(0,12).map(a=>a.id),expected.map(([id])=>'csc-'+id));assert.equal(new Set(WEAPON_ACCESSORIES.map(a=>a.id)).size,WEAPON_ACCESSORIES.length);
 const core=WEAPON_ACCESSORIES.filter(a=>a.sourceFamily==='core-2022');assert.deepEqual(core.map(a=>[a.id,a.tl,a.cost]),[['gyrostabiliser',9,500],['intelligent-0',11,1000],['intelligent-1',13,5000],['laser-sight-8',8,200],['laser-sight-10',10,200],['scope-5',5,50],['scope-7',7,50],['secure',10,250],['suppressor',8,250]]);
 for(const id of ['csc-auxiliary-launcher','csc-high-capacity-magazine','csc-phud','csc-xray'])assert.ok(!WEAPON_ACCESSORIES.some(a=>a.id===id));
});

test('all 25 slug weapons enforce the original twelve-accessory eligibility matrix in controls and evaluation',()=>{
 for(const w of CSC_SLUG_WEAPONS)for(const a of CSC_WEAPON_ACCESSORIES.slice(0,12)){
  const optic=['scope-5','scope-7','holographic-sight','laser-sight-8','laser-sight-10'].some(id=>a.id==='csc-'+id);
  const allowed=!(optic&&w.traits.includes('Scope'))&&!(a.id.startsWith('csc-scope-')&&w.weaponFamily==='pistol')&&!(a.id==='csc-gyrostabiliser'&&!w.traits.some(t=>['Bulky','Very Bulky'].includes(t)))&&!(a.id==='csc-suppressor'&&w.traits.some(t=>t.startsWith('Auto ')));
  const ids=a.id==='csc-smart-tracker'?['intelligent-0','smart-tracker']:[a.id.slice(4)],r=direct(w.id.slice(4),ids);
  assert.equal(r.diagnostics.some(d=>d.severity==='error'),!allowed,w.id+' '+a.id);
  assert.equal(choices(w.id).includes(a.id),allowed,w.id+' '+a.id+' control');
  if(!allowed){assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);assert.deepEqual(r.weapons[0].traits,w.traits);}
 }
});

test('source mismatches are rejected in both directions without cost, Scope, Silent or computer benefits',()=>{
 for(const w of CSC_SLUG_WEAPONS)for(const a of WEAPON_ACCESSORIES.filter(a=>a.sourceFamily==='core-2022')){
  const r=direct(w.id.slice(4),[],{accessories:[a.id]});assert.ok(has(r,'CSC_ACCESSORIES_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].traits,w.traits);assert.deepEqual(r.weapons[0].accessoryEffects,[]);
 }
 for(const a of CSC_WEAPON_ACCESSORIES){const r=direct('air-rifle-4',[],{weaponId:'rifle',accessories:[a.id]});assert.ok(has(r,'ACCESSORY_SOURCE'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].traits,[]);assert.deepEqual(r.weapons[0].accessoryEffects,[]);assert.ok(!choices('rifle').includes(a.id));}
 assert.ok(choices('handbook-stunner-12').includes('intelligent-1'));assert.ok(!choices('csc-air-rifle-4').includes('scope-5'));
});

test('gyrostabiliser removes Bulky but reduces Very Bulky only one step',()=>{
 assert.deepEqual(profile('big-game-rifle',['gyrostabiliser']).traits,['Bulky']);assert.deepEqual(profile('cartridge-pistol',['gyrostabiliser']).traits,[]);assert.deepEqual(profile('assault-shotgun',['gyrostabiliser']).traits,['Auto 2']);
 for(const patch of [{damage:'1DD'},{traits:['Bulky','Destructive']}]){const w={...CSC_SLUG_WEAPONS.find(w=>w.id==='csc-cartridge-pistol'),...patch};const a=CSC_WEAPON_ACCESSORIES.find(a=>a.id==='csc-gyrostabiliser');assert.equal(cscAccessoryEligibility(w,a).available,false);assert.equal(evaluateCscAccessories(w,record('cartridge-pistol',['gyrostabiliser']),16).cost,null);}
});

test('scope hardware is legal on rifles at any placement but its held-use benefit is conditional',()=>{
 for(const placement of ['body','arm','held']){
  const r=direct('air-rifle-4',['scope-7'],{placement,manipulatorId:placement==='body'?'none':'arm'}),w=r.weapons[0];assert.ok(!r.diagnostics.some(d=>d.severity==='error'));
  assert.equal(w.traits.includes('Scope'),placement==='held');assert.equal(w.accessoryEffects[0].active,placement==='held');assert.equal(w.accessoryEffects[0].lowLightPenaltyIgnored,true);assert.equal(w.accessoryEffects[0].recipientVisionGranted,false);
 }
 const fcs=profile('air-rifle-4',['scope-5'],{fireControl:'basic'});assert.ok(fcs.traits.includes('Scope'));assert.equal(fcs.accessoryEffects[0].active,false);assert.equal(fcs.baseAttackModifier,1);
 assert.ok(has(direct('cartridge-pistol',['scope-5']),'SCOPE_WEAPON'));
 // The lightweight carbine remains a rifle even though its mass is only 1 kg.
 assert.equal(direct('snub-carbine',['scope-5'],{placement:'held',manipulatorId:'arm'}).weapons[0].traits.includes('Scope'),true);
});

test('printed integral Scope remains listed but its hand-held use is explicitly qualified',()=>{
 for(const id of ['gauss-rifle','gauss-sniper-rifle','sniper-rifle'])for(const placement of ['body','held']){
  const w=direct(id,[],{placement,manipulatorId:placement==='held'?'arm':'none'}).weapons[0];assert.ok(w.traits.includes('Scope'));assert.equal(w.conditionalEffects.scopeUsage.active,placement==='held');assert.equal(w.conditionalEffects.scopeUsage.source.pages,'176');assert.equal(w.attackModifier,null);
 }
});

test('one sight-or-scope rule spans all optic kinds and respects built-in scopes',()=>{
 const optics=['scope-5','scope-7','holographic-sight','laser-sight-8','laser-sight-10'];
 for(let i=0;i<optics.length;i++)for(let j=i+1;j<optics.length;j++){const r=direct('air-rifle-4',[optics[i],optics[j]]);assert.ok(has(r,'CSC_SIGHT_LIMIT'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);}
 for(const id of ['gauss-rifle','gauss-sniper-rifle','sniper-rifle'])for(const optic of optics)assert.ok(has(direct(id,[optic]),'CSC_SIGHT_LIMIT'));
 const core=direct('air-rifle-4',[],{weaponId:'rifle',accessories:['scope-5','laser-sight-8']});assert.ok(!has(core,'CSC_SIGHT_LIMIT'));assert.ok(core.weapons[0].traits.includes('Scope'));
});

test('laser and holographic thresholds retain conditions without changing base attack modifiers',()=>{
 for(const id of ['laser-sight-8','laser-sight-10','holographic-sight']){
  const w=profile('air-rifle-4',[id]),e=w.accessoryEffects[0];assert.equal(e.modifier,1);assert.equal(w.baseAttackModifier,-3);assert.equal(w.attackModifier,null);assert.equal(e.resolvedAttack,false);assert.equal(e.skillGranted,false);
  if(id==='holographic-sight'){assert.deepEqual(e.rangeMetres,{minimum:50,minimumInclusive:true});assert.match(e.interpretation,/prose/);assert.ok(w.traits.includes('Scope'));}
  else{assert.deepEqual(e.rangeMetres,{maximum:50,maximumInclusive:false});assert.equal(e.visibleDot,id==='laser-sight-8');assert.ok(!w.traits.includes('Scope'));}
 }
});

test('computer and tracker purchase remain weapon-local with no robot brain or skill grants',()=>{
 const before=run('air-rifle-4');
 for(let rating=0;rating<=3;rating++){
  const r=run('air-rifle-4',['intelligent-'+rating,'smart-tracker']),w=r.totals.weapons[0],computer=w.accessoryEffects.find(e=>e.computerRating!==undefined),tracker=w.accessoryEffects.find(e=>e.programBandwidth!==undefined);
  assert.equal(computer.computerRating,rating);assert.equal(computer.robotBrainBandwidthGranted,0);assert.deepEqual(computer.programsGranted,[]);assert.deepEqual(r.totals.bandwidth,before.totals.bandwidth);assert.deepEqual(r.totals.skills,[]);assert.equal(w.softwareLevel,-3);assert.equal(w.baseAttackModifier,-3);assert.equal(w.attackModifier,null);
  assert.equal(tracker.modifier,2);assert.equal(tracker.programBandwidth,0);assert.equal(tracker.computerAccessory,'csc-intelligent-'+rating);assert.equal(tracker.tagAction,'Minor');assert.equal(tracker.tagActions,1);assert.equal(tracker.bonusRound,'following round');
  for(const key of ['requiresSuccessfulHit','tagInHitRound','requiresSameWeapon','requiresSameTarget','retagEachRound'])assert.equal(tracker[key],true);
 }
 assert.ok(has(direct('air-rifle-4',['smart-tracker']),'CSC_TRACKER_COMPUTER'));
 const two=evaluateDesign(updateDesign(design('air-rifle-4',['intelligent-0']),{selections:{physical:{weapons:[record('air-rifle-4',['intelligent-0']),record('snub-carbine',['smart-tracker'],{id:'second'})]}}}));assert.equal(two.status,'invalid');assert.ok(has(two,'CSC_TRACKER_COMPUTER'));
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(has(direct('air-rifle-4',['intelligent-'+i,'intelligent-'+j]),'ACCESSORY_FAMILY'));
});

test('suppressor adds only Silent and conditional sound detection without stacking built-in silence',()=>{
 for(const id of ['universal-auto-pistol','snub-carbine','air-rifle-4','sniper-rifle']){
  const w=profile(id,['suppressor']);assert.equal(w.traits.filter(t=>t==='Silent').length,1);const e=w.accessoryEffects[0];assert.equal(e.soundSourceDetectionDM,-6);assert.equal(e.trait,'Silent');assert.equal(e.source.pages,'131,177');assert.equal(w.baseAttackModifier,-3);assert.equal(w.attackModifier,null);
 }
 for(const id of ['assault-pistol','magrail-pistol','assault-shotgun','flechette-submachine-gun','gauss-assault-gun','gauss-rifle','gauss-submachinegun','magrail-rifle'])assert.ok(has(direct(id,['suppressor']),'SUPPRESSOR_WEAPON'));
});

test('energy and other source categories are evaluated without deriving eligibility from mount class',()=>{
 const seed=CSC_SLUG_WEAPONS.find(w=>w.id==='csc-big-game-rifle');
 const energy={...seed,speciality:'energy',traits:['Bulky'],mountClass:'small'};
 for(const id of ['scope-5','holographic-sight','intelligent-1','laser-sight-8','gyrostabiliser'])assert.equal(cscAccessoryEligibility(energy,CSC_WEAPON_ACCESSORIES.find(a=>a.id==='csc-'+id)).available,true);
 assert.equal(cscAccessoryEligibility(energy,CSC_WEAPON_ACCESSORIES.find(a=>a.id==='csc-suppressor')).available,false);
 const pistol={...energy,weaponFamily:'pistol',mountClass:'vehicle'};assert.equal(cscAccessoryEligibility(pistol,CSC_WEAPON_ACCESSORIES.find(a=>a.id==='csc-scope-5')).available,false);
 const unsupported={...energy,compatibility:{accessoryRules:null}};for(const a of CSC_WEAPON_ACCESSORIES)assert.equal(cscAccessoryEligibility(unsupported,a).available,false);
});

test('invalid or imported combinations cannot inject accessory stats, quantity, source or software',()=>{
 for(const accessories of [['csc-scope-5','csc-scope-5'],Array(7).fill('csc-intelligent-0'),['csc-high-capacity-magazine'],[{id:'csc-intelligent-0',cost:0}]])assert.throws(()=>design('air-rifle-4',[],{accessories}),TypeError);
 for(const patch of [{accessoryDetails:[{id:'csc-intelligent-0',cost:0}]},{sourceFamily:'core-2022'},{compatibility:{accessoryRules:'core-2022'}},{traits:['Scope']},{accessoryEffects:[{modifier:99}]},{accessoryQuantity:0}]){
  const d=design('air-rifle-4',['scope-5']);Object.assign(d.selections.physical.weapons[0],patch);assert.throws(()=>importDesign(JSON.stringify(d)),TypeError);
 }
 const d=design('air-rifle-4',[],{accessories:['scope-5']}),r=evaluateDesign(importDesign(exportDesign(d)));assert.equal(r.status,'invalid');assert.ok(has(r,'CSC_ACCESSORIES_UNSUPPORTED'));
 const mixed=direct('air-rifle-4',[],{accessories:['csc-intelligent-0','scope-5']});assert.equal(mixed.weapons[0].cost,null);assert.deepEqual(mixed.weapons[0].accessoryEffects,[]);
});

test('accessory sources, conditional effects, catalogue variants and API returns are detached',()=>{
 const d=design('air-rifle-4',['intelligent-0','smart-tracker']),c=control(d);c.choices.find(a=>a.id==='csc-intelligent-0').source.pages='bad';c.choicesBy.values['csc-air-rifle-4'].find(a=>a.id==='csc-intelligent-0').source.pages='bad';
 const cat=getCatalogue(d).stages.find(s=>s.id==='physical').controls.find(c=>c.type==='weapons');cat.itemFields.find(f=>f.field==='accessories').choices[0].cost=0;
 const r=direct('air-rifle-4',['intelligent-0','smart-tracker']);r.weapons[0].accessoryEffects[0].source.pages='bad';r.weapons[0].accessoryDetails[0].source.pages='bad';r.weapons[0].compatibility.accessoryRules='bad';
 const fresh=profile('air-rifle-4',['intelligent-0','smart-tracker']);assert.equal(fresh.accessoryEffects[0].source.pages,'175');assert.equal(fresh.accessoryDetails[0].source.pages,'175');assert.equal(fresh.compatibility.accessoryRules,'csc-2023');assert.equal(CSC_WEAPON_ACCESSORIES[2].source.pages,'175');assert.equal(WEAPON_ACCESSORIES.find(a=>a.id==='csc-intelligent-0').source.pages,'175');
 const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(name,callback)=>callback()}});api.importDesign(exportDesign(d));const view=api.getView();view.evaluation.totals.weapons[0].accessoryEffects[1].modifier=999;assert.equal(api.getView().evaluation.totals.weapons[0].accessoryEffects[1].modifier,2);
 const details=view.review.sections.find(s=>s.id==='weapons').rows[0].details;assert.ok(details.some(r=>r.label==='Accessory Effects'&&r.value.includes('following round')));
});


test('all 15 integrated energy profiles use the original twelve CSC accessories and reject slug-only suppressors',()=>{
 for(const w of CSC_ENERGY_WEAPONS)for(const a of CSC_WEAPON_ACCESSORIES.slice(0,12)){
  const optic=['scope-5','scope-7','holographic-sight','laser-sight-8','laser-sight-10'].some(id=>a.id==='csc-'+id);
  const allowed=a.id!=='csc-suppressor'&&a.id!=='csc-gyrostabiliser'&&!(optic&&w.traits.includes('Scope'))&&!(a.id.startsWith('csc-scope-')&&w.weaponFamily==='pistol');
  const ids=a.id==='csc-smart-tracker'?['intelligent-0','smart-tracker']:[a.id.slice(4)],r=direct(w.id.slice(4),ids);
  assert.equal(r.diagnostics.some(d=>d.severity==='error'),!allowed,w.id+' '+a.id);
  assert.equal(choices(w.id).includes(a.id),allowed,w.id+' '+a.id+' control');
  if(!allowed){assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);assert.deepEqual(r.weapons[0].traits,w.traits);}
 }
});
