import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {WEAPONS,WEAPON_ACCESSORIES,MOUNTS,weaponControl,evaluateWeapons} from '../engine/weapons.mjs';
import {CSC_WEAPON_ACCESSORIES,CSC_FOF_TAG,cscAccessoryEligibility,evaluateCscAccessories} from '../engine/csc-weapon-accessories.mjs';
import {createRobotApi} from '../js/api.mjs';

// Independent scalar audit of the revised CSC printing, printed pp174-177.
const rows=[
 ['bipod',4,50,1,'bipod','174','big-game-rifle'],
 ['fof-safety',9,250,null,'fof-safety','175','big-game-rifle'],
 ['scan-jammer',8,2500,null,'scan-jammer','176','big-game-rifle'],
 ['secure',10,250,null,'secure','177','big-game-rifle'],
 ['shoulder-stock',4,75,1,'shoulder-stock','177','cartridge-pistol'],
 ['telescoping-stock',9,500,.5,'shoulder-stock','177','cartridge-pistol'],
 ['xray-1',9,300,null,'xray','177','big-game-rifle'],
 ['xray-3',11,500,null,'xray','177','big-game-rifle']
];
const rec=(id='big-game-rifle',accessories=[],patch={})=>({id:'accessory-test',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,accessories:accessories.map(a=>'csc-'+a),...patch});
const raw=id=>WEAPONS.find(w=>w.id==='csc-'+id);
const direct=(id='big-game-rifle',accessories=[],patch={},techLevel=20)=>evaluateWeapons({kind:'standard',techLevel,selections:{physical:{weapons:[rec(id,accessories,patch)]}}},[{id:'arm',size:9,dexterity:8}],[]);
const profile=(...args)=>direct(...args).weapons[0];
const design=(id='big-game-rifle',accessories=[],patch={},techLevel=16)=>updateDesign(createDesign({techLevel}),{selections:{chassis:{size:'size-7'},physical:{weapons:[rec(id,accessories,patch)]}}});
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const effect=(p,id)=>p.accessoryEffects.find(a=>a.accessory==='csc-'+id);
const choices=id=>weaponControl().itemFields.find(f=>f.field==='accessories').choicesBy.values['csc-'+id].map(a=>a.id);
const newRows=CSC_WEAPON_ACCESSORIES.slice(12);

for(const [id,tl,cost,mass,family,page,weapon] of rows){
 test('CSC expansion source: '+id+' preserves audited scalar values and exact linked cost',()=>{
  const a=CSC_WEAPON_ACCESSORIES.find(a=>a.id==='csc-'+id),deps=id.startsWith('xray-')?['scope-5']:[],depCost=deps.length?50:0;
  assert.deepEqual([a.tl,a.cost,a.massKg,a.family,a.source.pages],[tl,cost,mass,family,page]);assert.equal(a.source.book,'Central Supply Catalogue Update 2023');assert.equal(a.source.edition,'Mongoose revised printing (copyright 2026)');assert.equal(a.sourceFamily,'csc-2023');
  for(const linkedWeapons of [1,2,4]){
   const accessories=[...deps,id],w=raw(weapon),p=profile(weapon,accessories,{linkedWeapons}),base=profile(weapon,[],{linkedWeapons});
   assert.equal(p.cost,base.cost+(cost+depCost)*linkedWeapons);assert.equal(p.slots,base.slots);assert.equal(p.massKg,w.massKg);assert.equal(p.range,w.range);assert.equal(p.baseAttackModifier,base.baseAttackModifier);assert.equal(p.attackModifier,null);
   const d=p.accessoryDetails.find(a=>a.id==='csc-'+id);assert.deepEqual([d.unitCost,d.cost,d.copies,d.massKgPerCopy],[cost,cost*linkedWeapons,linkedWeapons,mass]);
   assert.equal(effect(p,id).resolvedAttack,false);assert.equal(effect(p,id).skillGranted,false);assert.equal(effect(p,id).recipientVisionGranted,false);
   const saved=design(weapon,accessories,{linkedWeapons});assert.deepEqual(importDesign(exportDesign(saved)),saved);assert.equal(evaluateDesign(saved).status,'verified');
  }
  assert.equal(profile(weapon,[...deps,id],{placement:'held',manipulatorId:'arm'}).cost,raw(weapon).cost+raw(weapon).magazineCost+cost+depCost);
  assert.ok(has(direct(weapon,[...deps,id],{},tl-1),'ACCESSORY_TL'));assert.equal(has(direct(weapon,[...deps,id],{},tl),'ACCESSORY_TL'),false);
 });
}

test('CSC expansion catalogue: eight exact new IDs, catalogue-derived bounds and no tag multiselect',()=>{
 assert.deepEqual(newRows.map(a=>a.id),rows.map(r=>'csc-'+r[0]));assert.equal(CSC_WEAPON_ACCESSORIES.length,20);
 const c=weaponControl(),f=c.itemFields.find(f=>f.field==='accessories'),tags=c.itemFields.find(f=>f.field==='extraFofTags');
 assert.equal(f.maxItems,WEAPON_ACCESSORIES.length);assert.ok(f.maxItems>=10);assert.equal(tags.label,'Extra FOF tags (installation total)');assert.equal(tags.resetWhenHidden,undefined);assert.equal(tags.min,0);assert.equal(tags.max,100);
 assert.equal(WEAPON_ACCESSORIES.some(a=>a.id==='csc-fof-tag'),false);assert.deepEqual([CSC_FOF_TAG.tl,CSC_FOF_TAG.cost,CSC_FOF_TAG.massKg,CSC_FOF_TAG.source.pages],[9,25,null,'175']);
});

test('CSC expansion matrix: every supported profile independently checks all eight acquisition choices',()=>{
 const scopeWeapons=['csc-gauss-sniper-rifle','csc-sniper-rifle','csc-anti-materiel-rifle'];
 for(const w of WEAPONS.filter(w=>w.compatibility.accessoryRules==='csc-2023'))for(const a of newRows){
  const rifleOrHeavy=['rifle','heavy-portable','heavy-vehicle'].includes(w.weaponFamily),actualScope=scopeWeapons.includes(w.id),canAddScope=rifleOrHeavy&&!w.traits.includes('Scope');
  let allowed=w.weaponFamily!=='melee'||a.kind==='scan-jammer';
  if(a.kind==='bipod'&&['csc-anti-materiel-rifle','csc-light-assault-gun'].includes(w.id))allowed=false;
  if(a.kind==='shoulder-stock'&&(w.weaponFamily!=='pistol'||['csc-gauntlet-laser','csc-pepper-spray'].includes(w.id)))allowed=false;
  if(a.kind==='xray'&&!actualScope&&!canAddScope)allowed=false;
  const ids=[a.id,...(a.kind==='xray'&&canAddScope?['csc-scope-5']:[])],r=direct(w.id.slice(4),[],{accessories:ids});
  assert.equal(cscAccessoryEligibility(w,a).available,allowed,w.id+' '+a.id);assert.equal(choices(w.id.slice(4)).includes(a.id),allowed,w.id+' '+a.id+' control');
  assert.equal(r.diagnostics.some(d=>d.severity==='error'),!allowed,w.id+' '+a.id+' evaluation');
  if(!allowed){assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);}
 }
});

test('CSC bipod preserves Bulky traits, setup, mount costs and included hardware',()=>{
 for(const id of ['big-game-rifle','cppg-13','cartridge-pistol','long-bow']){
  const p=profile(id,['bipod']),b=effect(p,'bipod');assert.deepEqual(p.traits,raw(id).traits);assert.deepEqual(b.setup,{action:'Minor',actions:2});assert.deepEqual(b.ignoredTraits,['Bulky','Very Bulky']);assert.equal(b.traitsPermanentlyRemoved,false);assert.equal(b.replacesRobotMount,false);assert.match(b.condition,/deployed/);assert.equal(p.slots,MOUNTS[raw(id).mountClass].slots);
 }
 const combined=profile('big-game-rifle',['gyrostabiliser','bipod']);assert.deepEqual(combined.traits,['Bulky']);assert.deepEqual(effect(combined,'bipod').ignoredTraits,['Bulky','Very Bulky']);
 for(const id of ['anti-materiel-rifle','light-assault-gun']){assert.ok(has(direct(id,['bipod']),'CSC_INCLUDED_BIPOD'));assert.equal(profile(id,['bipod']).cost,null);const p=profile(id);assert.equal(p.conditionalEffects.bipod.additionalCost,0);assert.equal(p.conditionalEffects.bipod.included,true);assert.ok(!choices(id).includes('csc-bipod'));}
 assert.ok(!has(direct('cppg-13',['bipod']),'GYROSTABILISER_WEAPON'));assert.equal(effect(profile('cppg-13',['bipod']),'bipod').resolvedAttack,false);
});

test('CSC FOF quantities include two tags per physical weapon and price extras only once',()=>{
 for(const linkedWeapons of [1,2,4])for(const extraFofTags of [0,1,7,100]){
  const p=profile('big-game-rifle',['fof-safety'],{linkedWeapons,extraFofTags}),f=effect(p,'fof-safety'),base=profile('big-game-rifle',[],{linkedWeapons});
  assert.equal(p.cost,base.cost+250*linkedWeapons+25*extraFofTags);assert.equal(f.includedTagsPerWeapon,2);assert.equal(f.includedTags,2*linkedWeapons);assert.equal(f.additionalTags,extraFofTags);assert.equal(f.totalTags,2*linkedWeapons+extraFofTags);
  assert.deepEqual([p.fofTags.included,p.fofTags.additional,p.fofTags.total,p.fofTags.additionalCost],[2*linkedWeapons,extraFofTags,2*linkedWeapons+extraFofTags,25*extraFofTags]);assert.equal(p.fofTags.weaponMounted,false);assert.equal(p.fofTags.massKgPerTag,null);assert.equal(p.accessoryMass.extraTagsWithUnresolvedMass,undefined);
  const d=p.accessoryDetails.find(a=>a.id==='csc-fof-tag');if(extraFofTags){assert.equal(d.copies,extraFofTags);assert.equal(d.cost,25*extraFofTags);assert.equal(d.quantityScope,'installation-set');assert.equal(d.massKgPerCopy,null);}else assert.equal(d,undefined);
  const hardware=p.accessoryDetails.find(a=>a.id==='csc-fof-safety');assert.equal(hardware.cost,250*linkedWeapons);assert.equal(p.accessoryDetails.reduce((s,a)=>s+a.cost,0),p.cost-base.cost);
 }
 const f=effect(profile('big-game-rifle',['fof-safety']),'fof-safety');assert.equal(f.signalRangeMetres,50);assert.equal(f.targetDistanceFromTagMetres,1);assert.equal(f.requiresTransmittingTag,true);assert.equal(f.requiresMatchingCode,true);assert.equal(f.requiresTriggerActivatedFiringMechanism,true);assert.equal(f.preventsFiring,true);assert.equal(f.universalFriendlyFireImmunity,false);assert.equal(f.phudRequired,false);assert.equal(f.phudGranted,false);assert.equal(f.modifier,undefined);
});

test('CSC FOF import and API edits preserve extras and revalidate stale association',()=>{
 for(const value of [-1,.5,101,'2',null,true,{},[]])assert.throws(()=>design('big-game-rifle',['fof-safety'],{extraFofTags:value}),TypeError);
 const saved=design('big-game-rifle',['fof-safety'],{extraFofTags:7,linkedWeapons:3});assert.deepEqual(importDesign(exportDesign(saved)),saved);
 const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(n,cb)=>cb()}});api.importDesign(exportDesign(saved));let record=api.getView().design.selections.physical.weapons[0];
 api.select({stage:'physical',field:'weapons',value:[{...record,accessories:[]}]});let view=api.getView();assert.equal(view.design.selections.physical.weapons[0].extraFofTags,7);assert.equal(view.evaluation.status,'invalid');assert.ok(has(view.evaluation,'CSC_FOF_TAG_ASSOCIATION'));assert.equal(importDesign(api.exportDesign()).selections.physical.weapons[0].extraFofTags,7);
 api.select({stage:'physical',field:'weapons',value:[{...record,linkedWeapons:2}]});view=api.getView();assert.equal(view.evaluation.totals.weapons[0].fofTags.total,11);assert.equal(view.evaluation.totals.weapons[0].fofTags.additionalCost,175);
 assert.ok(has(direct('big-game-rifle',[],{extraFofTags:1}),'CSC_FOF_TAG_ASSOCIATION'));assert.ok(has(direct('big-game-rifle',[],{weaponId:'rifle',extraFofTags:1}),'CSC_FOF_TAG_ASSOCIATION'));
 assert.equal(profile('big-game-rifle',[],{extraFofTags:1}).cost,null);assert.equal(profile('big-game-rifle',[],{weaponId:'rifle',extraFofTags:1}).cost,null);
 assert.ok(has(direct('big-game-rifle',['fof-safety'],{extraFofTags:1},8),'ACCESSORY_TL'));
});

test('CSC FOF mechanism qualification does not follow Gun Combat or names alone',()=>{
 for(const id of ['air-rifle-3','air-rifle-4','spear-gun','pepper-spray','hand-flamer','flame-rifle','cryo-rifle','cryojet','flamethrower-4','flamethrower-6','flamethrower-8','crossbow','repeating-crossbow','long-bow','short-bow','compound-cam-bow']){
  const r=direct(id,['fof-safety']),f=effect(r.weapons[0],'fof-safety');assert.ok(has(r,'CSC_FOF_TRIGGER_UNVERIFIED'),id);assert.equal(r.diagnostics.find(d=>d.code==='CSC_FOF_TRIGGER_UNVERIFIED').severity,'warning');assert.equal(f.triggerCompatibility,'unverified-source-mechanism');assert.equal(f.resolvedAttack,false);assert.notEqual(r.weapons[0].cost,null);assert.equal(r.weapons[0].baseAttackModifier,profile(id).baseAttackModifier);
 }
 assert.equal(has(direct('big-game-rifle',['fof-safety']),'CSC_FOF_TRIGGER_UNVERIFIED'),false);assert.equal(effect(profile('big-game-rifle',['fof-safety']),'fof-safety').triggerCompatibility,'firearm-mechanism-interpretation');
});

test('CSC jammer and authentication remain weapon-local and do not grant robot software or sensors',()=>{
 const jammer=effect(profile('mace',['scan-jammer']),'scan-jammer');assert.equal(jammer.check,'Electronics (sensors)');assert.equal(jammer.discoveryDM,-4);assert.match(jammer.condition,/this weapon/);assert.equal(jammer.generalRobotStealthGranted,false);assert.equal(jammer.automaticConcealmentStacking,false);assert.deepEqual(jammer.settingLaw,{highlyIllegalAboveLawLevel:0,constructionValidityDeterminesLegality:false});assert.equal(evaluateDesign(design('mace',['scan-jammer'])).status,'verified');
 const secure=effect(profile('big-game-rifle',['secure']),'secure');assert.equal(secure.authenticationRequiredBeforeFiring,true);assert.equal(secure.robotSensorPrerequisite,false);assert.equal(secure.robotComputerPrerequisite,false);assert.equal(secure.modifier,undefined);
 const baseline=evaluateDesign(design()),selected=evaluateDesign(design('big-game-rifle',['secure','scan-jammer']));assert.deepEqual(selected.totals.bandwidth,baseline.totals.bandwidth);assert.deepEqual(selected.totals.skills,baseline.totals.skills);
 assert.ok(has(direct('mace',['secure']),'CSC_MELEE_ACCESSORY_UNSUPPORTED'));
});

test('CSC stocks change conditional effective and long ranges only, never base range or pistol identity',()=>{
 for(const [id,action] of [['shoulder-stock',{duration:'1D rounds'}],['telescoping-stock',{action:'Significant',actions:1}]])for(const placement of ['body','arm','held']){
  const p=profile('cartridge-pistol',[id],{placement,manipulatorId:placement==='body'?'none':'arm'}),s=effect(p,id);assert.equal(p.range,10);assert.equal(p.mountClass,'small');assert.equal(p.weaponFamily,'pistol');assert.deepEqual(s.rangeMultipliers,{effective:1.25,long:1.25,extreme:1});assert.deepEqual(s.attachDetach,action);assert.equal(s.holsterWhileAttached,false);assert.equal(s.baseRangeUnchanged,true);assert.equal(s.mountClassUnchanged,true);assert.equal(s.weaponFamilyUnchanged,true);assert.match(s.condition,/attached/);
  assert.ok(has(direct('cartridge-pistol',[id,'scope-5']),'SCOPE_WEAPON'));
 }
 assert.ok(has(direct('cartridge-pistol',['shoulder-stock','telescoping-stock']),'ACCESSORY_FAMILY'));assert.equal(profile('cartridge-pistol',['shoulder-stock','telescoping-stock']).cost,null);
 for(const id of ['gauntlet-laser','pepper-spray']){assert.ok(has(direct(id,['shoulder-stock']),'CSC_STOCK_FORM_UNVERIFIED'));assert.equal(choices(id).includes('csc-shoulder-stock'),false);}
});

test('CSC X-Ray dependencies require actual scopes and never a bare Scope trait',()=>{
 for(const aid of ['xray-1','xray-3']){
  assert.ok(has(direct('big-game-rifle',[aid]),'CSC_XRAY_SCOPE'));assert.ok(has(direct('big-game-rifle',[aid],{fireControl:'advanced'}),'CSC_XRAY_SCOPE'));assert.ok(has(direct('big-game-rifle',[aid,'holographic-sight']),'CSC_XRAY_SCOPE'));
  for(const id of ['gauss-rifle','heavy-advanced-combat-rifle','cppg-11','heavy-laser-rifle','rocket-launcher-8','tac-launcher-anti-aircraft'])assert.ok(has(direct(id,[aid]),'CSC_XRAY_SCOPE'),id);
  for(const [id,page] of [['gauss-sniper-rifle','146'],['sniper-rifle','148'],['anti-materiel-rifle','160']]){const p=profile(id,[aid]),x=effect(p,aid);assert.notEqual(p.cost,null);assert.deepEqual(x.scopeDependency,{integralWeapon:'csc-'+id,source:{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages:page}});assert.ok(has(direct(id,[aid,'scope-5']),'CSC_SIGHT_LIMIT'));}
  for(const scope of ['scope-5','scope-7'])for(const placement of ['body','arm','held']){
   const p=profile('big-game-rifle',[scope,aid],{placement,manipulatorId:placement==='body'?'none':'arm'}),x=effect(p,aid);assert.equal(x.scopeDependency.accessory,'csc-'+scope);assert.equal(x.maximumBarrierMetres,aid==='xray-1'?1:3);assert.deepEqual(x.excludedBarrierMaterials,['metal']);assert.equal(x.requiresUnshieldedBarrier,true);assert.equal(x.coverDMIgnored,true);assert.equal(x.protectionRetained,true);assert.equal(x.generalXrayVisionGranted,false);assert.equal(x.recipientVisionGranted,false);assert.equal(x.requiresScopeUse,true);assert.equal(x.scopeUseCertified,false);assert.equal(x.handHeldScopeBenefitEligible,placement==='held');assert.equal(x.modifier,undefined);assert.equal(p.accessories.length,2);
  }
 }
 assert.ok(has(direct('big-game-rifle',['scope-5','xray-1','xray-3']),'ACCESSORY_FAMILY'));assert.ok(has(direct('big-game-rifle',['scope-5','scope-7','xray-1']),'CSC_SIGHT_LIMIT'));
});

test('CSC ten-family Big Game Rifle configuration survives API import/export and cost once',()=>{
 const ids=['gyrostabiliser','scope-7','intelligent-3','smart-tracker','suppressor','fof-safety','scan-jammer','secure','bipod','xray-3'],unit=500+50+2000+500+250+250+2500+250+50+500;
 const d=design('big-game-rifle',ids,{linkedWeapons:4,extraFofTags:7}),r=evaluateDesign(d);assert.equal(r.status,'verified');const p=r.totals.weapons[0];assert.equal(p.accessories.length,10);assert.equal(p.cost,4*(1250+1000+50+unit)+175);assert.equal(p.accessoryDetails.reduce((sum,a)=>sum+a.cost,0),unit*4+175);assert.equal(p.baseAttackModifier,-3);assert.equal(p.attackModifier,null);assert.deepEqual(p.traits,['Bulky','Silent']);assert.equal(p.accessoryMass.knownKgPerWeapon,2);assert.equal(p.massKg,8);assert.equal(p.slots,8);
 assert.deepEqual(importDesign(exportDesign(d)),d);const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(n,cb)=>cb()}});api.importDesign(exportDesign(d));assert.deepEqual(importDesign(api.exportDesign()),d);assert.equal(api.getView().evaluation.totals.weapons[0].cost,p.cost);
 assert.throws(()=>design('big-game-rifle',ids.concat('bipod')),TypeError);assert.ok(has(direct('big-game-rifle',ids.concat('intelligent-0')),'ACCESSORY_FAMILY'));assert.ok(has(direct('big-game-rifle',ids.filter(id=>id!=='intelligent-3')),'CSC_TRACKER_COMPUTER'));assert.ok(has(direct('big-game-rifle',ids.filter(id=>id!=='scope-7')),'CSC_XRAY_SCOPE'));
});

test('CSC melee computers, tracker hardware, jammer and literal stabilisation retain narrow operational scope',()=>{
 for(const id of ['mace','staff','battle-axe','broadsword','great-axe','long-blade-1','long-blade-3','monoblade','buckler']){
  for(const level of [0,1,2,3]){const p=profile(id,['intelligent-'+level,'smart-tracker','scan-jammer']),t=effect(p,'smart-tracker');assert.notEqual(p.cost,null);assert.equal(t.modifier,null);assert.equal(t.conditionalFiringModifier,2);assert.equal(t.requiresFiringAttack,true);assert.equal(t.ordinaryMeleeBonusGranted,false);assert.equal(t.operationalApplicability,'ordinary-melee-not-firing');assert.equal(t.operationalBenefitCertified,false);assert.equal(p.baseAttackModifier,-3);assert.equal(p.mountClass,raw(id).mountClass);assert.deepEqual(p.traits,raw(id).traits);assert.equal(effect(p,'intelligent-'+level).computerRating,level);}
  for(const a of ['laser-sight-8','laser-sight-10','holographic-sight','scope-5','suppressor','bipod','fof-safety','secure','shoulder-stock','xray-1'])assert.ok(has(direct(id,[a]),'CSC_MELEE_ACCESSORY_UNSUPPORTED'));
 }
 for(const id of ['mace','battle-axe','broadsword','great-axe']){const p=profile(id,['gyrostabiliser']);assert.equal(p.traits.includes('Very Bulky'),false);assert.equal(p.traits.includes('Bulky'),id==='great-axe');assert.equal(p.mountClass,raw(id).mountClass);assert.equal(p.range,'Melee');assert.equal(p.baseAttackModifier,-3);}
 assert.ok(has(direct('staff',['gyrostabiliser']),'GYROSTABILISER_WEAPON'));assert.ok(has(direct('mace',['smart-tracker']),'CSC_TRACKER_COMPUTER'));
});

test('CSC tracker acquisition does not certify non-firearm firing bonuses or weaken tag conditions',()=>{
 for(const id of ['air-rifle-3','air-rifle-4','pepper-spray','long-bow','crossbow','repeating-crossbow','flamethrower-4','cryojet']){
  const r=direct(id,['intelligent-0','smart-tracker']),t=effect(r.weapons[0],'smart-tracker');assert.notEqual(r.weapons[0].cost,null);assert.ok(has(r,'CSC_TRACKER_FIRING_UNVERIFIED'));assert.equal(t.operationalBenefitCertified,false);assert.equal(t.operationalApplicability,'requires-referee-confirmation');assert.equal(t.requiresFiringAttack,true);assert.equal(t.ordinaryMeleeBonusGranted,false);assert.equal(t.tagAction,'Minor');assert.equal(t.tagActions,1);assert.equal(t.bonusRound,'following round');assert.equal(t.programBandwidth,0);
  for(const key of ['requiresSuccessfulHit','tagInHitRound','requiresSameWeapon','requiresSameTarget','retagEachRound'])assert.equal(t[key],true);assert.equal(r.weapons[0].baseAttackModifier,profile(id).baseAttackModifier);
 }
});

test('CSC accessory mass stays separate and flags only selected 250 kg vehicle boundary uncertainty',()=>{
 for(const id of ['vrf-gauss-gun','vrf-machinegun','rocket-pod']){
  const bare=direct(id);assert.equal(raw(id).massKg,250);assert.equal(has(bare,'CSC_ACCESSORY_MOUNT_MASS_UNRESOLVED'),false);
  for(const a of ['bipod','scan-jammer','fof-safety','intelligent-0']){const r=direct(id,[a]),p=r.weapons[0],d=r.diagnostics.find(d=>d.code==='CSC_ACCESSORY_MOUNT_MASS_UNRESOLVED');assert.equal(d?.severity,'blocker');assert.equal(d.source.pages,'61');assert.equal(p.massKg,250);assert.equal(p.slots,15);assert.notEqual(p.cost,null);assert.equal(p.accessoryMass.vehicleMountAggregation,'not-specified-by-source');assert.equal(p.accessoryMass.knownKgPerWeapon,a==='bipod'?1:0);assert.deepEqual(p.accessoryMass.unresolvedAccessoryIds,a==='bipod'?[]:['csc-'+a]);}
  const r=evaluateDesign(design(id,['bipod']));assert.equal(r.status,'blocked');assert.ok(has(r,'CSC_ACCESSORY_MOUNT_MASS_UNRESOLVED'));
 }
 const below=direct('heavy-machinegun',['bipod','scan-jammer']);assert.equal(has(below,'CSC_ACCESSORY_MOUNT_MASS_UNRESOLVED'),false);assert.equal(below.weapons[0].massKg,100);assert.equal(below.weapons[0].accessoryMass.knownKgPerWeapon,1);
 const tags=profile('vrf-gauss-gun',['fof-safety'],{extraFofTags:100});assert.equal(tags.fofTags.weaponMounted,false);assert.deepEqual(tags.accessoryMass.unresolvedAccessoryIds,['csc-fof-safety']);assert.equal(tags.accessoryMass.extraTagsWithUnresolvedMass,undefined);
});

test('CSC expansion source isolation rejects every new row on Core and direct payloads',()=>{
 for(const a of newRows)for(const weaponId of ['rifle','autopistol','broadsword','csc-frag-grenade']){
  if(!WEAPONS.some(w=>w.id===weaponId))continue;
  const r=direct('big-game-rifle',[],{weaponId,accessories:[a.id]});assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);assert.ok(r.diagnostics.some(d=>d.severity==='error'));
 }
 const core=profile('big-game-rifle',[],{weaponId:'rifle',accessories:['scope-5','laser-sight-8','secure']});assert.equal(core.cost,200+1000+10+50+200+250);assert.ok(core.traits.includes('Scope'));assert.equal(core.accessoryMass,undefined);assert.equal(core.fofTags,undefined);
});

test('CSC expansion nested effects, mass, dependencies and tag quantities are detached and non-injectable',()=>{
 const ids=['scope-7','xray-3','fof-safety','bipod'],d=design('big-game-rifle',ids,{extraFofTags:3}),p=profile('big-game-rifle',ids,{extraFofTags:3});
 effect(p,'bipod').setup.actions=99;effect(p,'xray-3').scopeDependency.source.pages='bad';p.fofTags.additionalCost=0;p.accessoryMass.unresolvedAccessoryIds.push('fake');p.accessoryDetails[0].source.pages='bad';
 const fresh=profile('big-game-rifle',ids,{extraFofTags:3});assert.equal(effect(fresh,'bipod').setup.actions,2);assert.equal(effect(fresh,'xray-3').scopeDependency.source.pages,'176');assert.equal(fresh.fofTags.additionalCost,75);assert.equal(fresh.accessoryMass.unresolvedAccessoryIds.includes('fake'),false);
 const cat=getCatalogue(d),control=cat.stages.find(s=>s.id==='physical').controls.find(c=>c.type==='weapons');control.itemFields.find(f=>f.field==='accessories').choices.find(a=>a.id==='csc-xray-3').maximumBarrierMetres=100;assert.equal(CSC_WEAPON_ACCESSORIES.find(a=>a.id==='csc-xray-3').maximumBarrierMetres,3);
 for(const patch of [{fofTags:{additionalCost:0}},{accessoryMass:{knownKgPerWeapon:0}},{accessoryEffects:[{coverDMIgnored:true}]},{extraFofTagsCost:0}]){const imported=structuredClone(d);Object.assign(imported.selections.physical.weapons[0],patch);assert.throws(()=>importDesign(JSON.stringify(imported)),TypeError);}
 const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(n,cb)=>cb()}});api.importDesign(exportDesign(d));api.getView().evaluation.totals.weapons[0].fofTags.total=999;assert.equal(api.getView().evaluation.totals.weapons[0].fofTags.total,5);assert.ok(api.getView().review.sections.find(s=>s.id==='weapons').rows[0].details.some(d=>d.label==='Accessory Effects'&&d.value.includes('Protection')));
});
