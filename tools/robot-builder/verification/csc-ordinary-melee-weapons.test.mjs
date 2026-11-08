import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInThisContext} from 'node:vm';
import {CSC_MELEE_WEAPONS} from '../engine/csc-melee-weapons.mjs';
import {WEAPONS,WEAPON_ACCESSORIES,evaluateWeapons,weaponControl,weaponRecordPresentation} from '../engine/weapons.mjs';
import {estimateCscMagazineMass} from '../engine/csc-ammunition-storage.mjs';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
import {renderReview} from '../js/review.mjs';
import {diagnosticLabel,presentationFacts} from '../js/rules-presentation.mjs';
// Independent audit: revised CSC (copyright 2026), printed pp131-137.
// Numeric rows are pp133/135; hand counts are qualified physical interpretations.
const expected=[
 ['blade','Blade',1,100,1,'2D','blade',[],1,'134-136','135','134,136'],
 ['cutlass','Cutlass',2,200,2,'3D','blade',[],1,'134-136','135','134,136'],
 ['dagger','Dagger',1,10,.5,'1D+2','blade',[],1,'134-135,137','135','134,137'],
 ['hatchet','Hatchet',1,50,2,'2D+2','blade',[],1,'134-136','135','134,136'],
 ['sap','Sap',1,30,1,'1D','bludgeon',['Stun'],1,'132-133','133','132-133'],
 ['sledgehammer','Sledgehammer',1,30,8,'4D','bludgeon',['Smasher','Very Bulky'],2,'132-133','133','132-133'],
 ['rapier','Rapier',2,200,1,'2D','blade',[],1,'135-137','135','136-137'],
 ['stone-axe','Stone Axe',0,5,2,'2D+1','blade',[],1,'131,135-137','135','136-137'],
 ['stealth-dagger','Stealth Dagger',8,175,.5,'1D+2','blade',[],1,'135,137','135','137'],
 ['war-pick','War Pick',1,275,3,'2D+2','blade',['AP 4'],1,'135-137','135','136-137']
];
const source=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const raw=id=>CSC_MELEE_WEAPONS.find(w=>w.id==='csc-'+id);
const record=(id,patch={})=>({id:'selected-melee',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const arms=[{id:'base-1',kind:'base',size:5,strength:7,dexterity:8},{id:'base-2',kind:'base',size:5,strength:12,dexterity:12},{id:'third-arm',kind:'additional',size:5,strength:30,dexterity:15}];
const direct=(id,patch={},options={})=>evaluateWeapons({kind:'standard',techLevel:options.techLevel??16,selections:{physical:{weapons:[record(id,patch)]}}},options.arms??arms,options.skills??[]);
const design=(id,patch={})=>updateDesign(createDesign({techLevel:16}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,patch)]}}});
const has=(result,code)=>result.diagnostics.some(d=>d.code===code);
const noErrors=result=>assert.deepEqual(result.diagnostics.filter(d=>['error','blocker'].includes(d.severity)),[]);
const total=result=>result.totals??result.previewTotals;
const projection=d=>projectReview(d,getCatalogue(d),evaluateDesign(d));
const copy=(patch={})=>({copyIndex:2,initialMagazines:1,initialMagazineType:'standard',extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none',...patch});
class Node {constructor(tag){this.tag=tag;this.textContent='';this.children=[];} append(...items){this.children.push(...items);} replaceChildren(...items){this.children=[...items];}}
const visible=node=>[node.textContent,...node.children.map(visible)].join('\n');

test('ordinary CSC melee adds exactly ten source identities without replacing Core',()=>{
 assert.equal(CSC_MELEE_WEAPONS.length,19);assert.deepEqual(CSC_MELEE_WEAPONS.slice(9).map(w=>w.id),expected.map(e=>'csc-'+e[0]));
 for(const [id,tl,damage,cost,traits]of [['blade',2,'2D',100,[]],['cutlass',2,'3D',200,[]],['dagger',1,'1D+2',10,[]],['rapier',3,'2D',200,[]],['broadsword',2,'4D',500,['Bulky']]]){const core=WEAPONS.find(w=>w.id===id);assert.deepEqual([core.tl,core.damage,core.cost,core.traits],[tl,damage,cost,traits]);assert.equal(core.sourceFamily,'core-2022');assert.deepEqual(core.source,{book:'Core Rulebook Update 2022',edition:'Mongoose 2022',pages:'124-125'});}
 for(const id of ['club','stunstick','spear','gravity-hammer','stealth-dagger-9','stealth-dagger-12'])assert.equal(raw(id),undefined);
});
for(const [id,name,tl,cost,mass,damage,speciality,traits,hands,pages,tablePage,handPages]of expected){
 test('ordinary CSC melee source: '+name+' exact facts and qualified handedness',()=>{
  const w=raw(id);assert.equal(w.label,name+' (CSC 2023)');assert.deepEqual([w.tl,w.cost,w.massKg,w.damage,w.speciality,w.traits],[tl,cost,mass,damage,speciality,traits]);assert.deepEqual(w.source,source(pages));assert.deepEqual(w.sourceMeasurements,{mass:{value:mass,unit:'kg'},source:source(tablePage)});
  assert.deepEqual([w.range,w.skill,w.weaponFamily,w.sourceFamily,w.magazine,w.magazineCost,w.initialIncluded],['Melee','melee','melee','csc-2023',null,0,true]);assert.equal(w.requiresTwoHands,hands===2);assert.equal(w.handedness.hands,hands);assert.equal(w.handedness.explicitPrintedHandCount,false);assert.equal(w.handedness.alternateTwoHandedUse,false);assert.equal(w.handedness.basis,'qualified-physical-interpretation');assert.deepEqual(w.handedness.source,source(handPages));assert.equal(w.handedness.mountSource.book,'Robot Handbook');assert.equal(w.handedness.mountSource.pages,'61');
  const h=w.conditionalEffects.handling;assert.deepEqual([h.hands,h.requiresTwoHands,h.explicitPrintedHandCount,h.optionalSecondGrip,h.mountClassIndependentOfWeaponMass],[hands,hands===2,false,false,true]);assert.deepEqual(h.source,source(handPages));
  for(const flag of ['resolvedAttack','skillGranted','defenceGranted','bodyMountedDefenceGranted'])assert.equal(w.conditionalEffects[flag],false);
  assert.deepEqual(w.compatibility,{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,robotPowerConnection:false});assert.equal(w.ammunitionAccounting.autoloadSupported,false);assert.equal(w.ammunitionAccounting.separatelyPricedAmmunition,false);assert.equal(estimateCscMagazineMass(w),null);
 });
 test('ordinary CSC melee integration: '+name+' mounts, linked copies, TL and skills',()=>{
  const medium=hands===2,mountCost=medium?1000:500,slots=medium?2:1,minSize=medium?5:3,d=design(id),e=evaluateDesign(d),w=e.totals.weapons[0];assert.equal(e.status,'verified');assert.equal(w.cost,cost+mountCost);assert.equal(w.slots,slots);assert.equal(w.mountClass,medium?'medium':'small');assert.equal(w.massKg,mass);assert.equal(w.damage,damage);assert.deepEqual(w.traits,traits);assert.equal(w.baseAttackModifier,-3);assert.equal(w.attackModifier,null);
  const linked=direct(id,{linkedWeapons:3});noErrors(linked);assert.equal(linked.cost,3*(cost+mountCost));assert.equal(linked.slots,3*slots);assert.equal(linked.weapons[0].linkedDamageBonus,Number(damage[0])*2);assert.equal(linked.ledger.length,1);
  assert.ok(has(direct(id,{}, {techLevel:tl-1}),'WEAPON_TL'));assert.equal(has(direct(id,{}, {techLevel:tl}),'WEAPON_TL'),false);
  for(const size of [minSize-1,minSize])assert.equal(has(direct(id,{placement:'arm',manipulatorId:'base-1'},{arms:arms.map(a=>({...a,size}))}),'WEAPON_ARM_SIZE'),size<minSize);
  const trained=direct(id,{}, {skills:[{id:'melee:'+speciality,level:2}]}).weapons[0];assert.equal(trained.softwareLevel,2);assert.equal(trained.baseAttackModifier,2);assert.equal(trained.attackModifier,null);
  for(const skill of ['gun-combat:slug','melee:'+(speciality==='blade'?'bludgeon':'blade')])assert.equal(direct(id,{}, {skills:[{id:skill,level:4}]}).weapons[0].softwareLevel,-3);
  assert.deepEqual(importDesign(exportDesign(d)),d);assert.equal(importDesign(exportDesign(d)).selections.physical.weapons[0].weaponId,'csc-'+id);
 });
 test('ordinary CSC melee held: '+name+' purchase and interpreted hand labels',()=>{
  const patch={placement:'held',manipulatorId:'base-1',...(hands===2?{supportManipulatorId:'base-2'}:{})},r=direct(id,patch),w=r.weapons[0];noErrors(r);assert.equal(w.cost,cost);assert.equal(w.slots,0);assert.equal(w.gripAssignmentStatus,'assigned');assert.deepEqual(w.gripManipulatorIds,hands===2?['base-1','base-2']:['base-1']);assert.equal(w.multiArm,hands===2);assert.equal(w.baseAttackModifier,hands===2?null:-3);assert.equal(w.attackModifier,null);assert.equal(w.handednessBasis.explicitPrintedHandCount,false);assert.equal(w.handednessBasis.optionalSecondGrip,false);
  const code=hands===2?'HELD_HANDEDNESS_INTERPRETATION':'HELD_ONE_HANDED_INTERPRETATION',issue=r.diagnostics.find(d=>d.code===code);assert.ok(issue);assert.equal(diagnosticLabel(issue),(hands===2?'Two':'One')+'-handed use: source interpretation');assert.match(issue.message,new RegExp('^'+(hands===2?'Two':'One')+'-handed operation'));assert.equal(has(r,'HELD_SUPPORT_REQUIRED'),false);assert.equal(has(r,hands===2?'HELD_ONE_HANDED_INTERPRETATION':'HELD_HANDEDNESS_INTERPRETATION'),false);
  if(hands===1){const invalid=direct(id,{...patch,supportManipulatorId:'base-2'});assert.ok(has(invalid,'HELD_SUPPORT_UNSUPPORTED'));assert.equal(invalid.weapons[0].baseAttackModifier,null);assert.equal(invalid.weapons[0].cost,cost);const missing=direct(id,{...patch,supportManipulatorId:'missing-arm'});assert.doesNotMatch(missing.diagnostics.find(x=>x.code==='HELD_SUPPORT_REQUIRED').message,/interpretation uses two hands/);}
  const text=formatStatblock(projection(design(id,patch)));assert.ok(text.includes((hands===2?'Two':'One')+'-handed use: source interpretation'));assert.ok(text.includes((hands===2?'Two':'One')+'-hand physical interpretation; printed hand count unstated'));if(hands===1)assert.doesNotMatch(text,/Two-handed use: source interpretation/);
 });
}
test('Sledgehammer uses two distinct occupied grips without duplicating purchase',()=>{
 for(const [support,code]of [['none','HELD_SUPPORT_REQUIRED'],['missing-arm','HELD_SUPPORT_REQUIRED'],['base-1','HELD_GRIPS_MUST_DIFFER']]){const d=design('sledgehammer',{placement:'held',manipulatorId:'base-1',supportManipulatorId:support}),roundTrip=importDesign(exportDesign(d)),r=evaluateDesign(roundTrip);assert.equal(r.status,'invalid');assert.ok(has(r,code));assert.equal(total(r).weapons[0].cost,30);assert.equal(total(r).weapons[0].baseAttackModifier,null);assert.deepEqual(roundTrip,d);}
 const d=design('sledgehammer',{placement:'held',manipulatorId:'base-1',supportManipulatorId:'base-2'});d.selections.physical.manipulators.pop();assert.ok(has(evaluateDesign(d),'HELD_SUPPORT_REQUIRED'));assert.equal(d.selections.physical.weapons[0].supportManipulatorId,'base-2');
 for(const manipulatorId of ['base-1','base-2','third-arm']){const records=[record('sledgehammer',{placement:'held',manipulatorId:'base-1',supportManipulatorId:'base-2'}),record('war-pick',{id:'second',placement:'held',manipulatorId})],r=evaluateWeapons({kind:'standard',techLevel:16,selections:{physical:{weapons:records}}},arms,[]);assert.equal(has(r,'HELD_GRIP_OCCUPIED'),manipulatorId!=='third-arm');assert.equal(r.cost,305);if(manipulatorId==='third-arm')noErrors(r);}
 const w=direct('sledgehammer',{placement:'held',manipulatorId:'base-1',supportManipulatorId:'base-2',fireControl:'basic'},{skills:[{id:'melee:bludgeon',level:4}]}).weapons[0];assert.equal(w.cost,10030);assert.equal(w.slots,1);assert.equal(w.softwareLevel,4);assert.equal(w.effectiveStrength,null);assert.equal(w.effectiveDexterity,null);assert.equal(w.baseAttackModifier,null);assert.equal(w.heldStrengthRequirement.minimumStrength,12);assert.equal(w.heldStrengthRequirement.penaltyResolved,false);
});
test('Sap Stun and Rapier parry preserve condition-only benefits; War Pick retains only printed AP',()=>{
 assert.deepEqual(raw('sap').conditionalEffects.stun,{trait:'Stun',requiresTargetUnaware:true,removedWhenTargetAware:true,automaticTraitApplied:false,resolved:false,condition:'Target is unaware of the attacker',source:source('132')});
 assert.deepEqual(raw('rapier').conditionalEffects.parry,{modifier:1,requiresHeld:true,automaticBonusApplied:false,resolved:false,attackBonus:0,protectionGranted:0,permanentSkillBonusGranted:false,condition:'Parrying with the rapier',source:source('137')});
 for(const placement of ['body','arm','held'])for(const id of ['sap','rapier']){const r=direct(id,{placement,manipulatorId:placement==='body'?'none':'base-1'},{skills:[{id:'melee:'+raw(id).speciality,level:2}]}),w=r.weapons[0];noErrors(r);assert.deepEqual(w.conditionalEffects,raw(id).conditionalEffects);assert.equal(w.softwareLevel,2);assert.equal(w.baseAttackModifier,2);assert.equal(w.attackModifier,null);assert.equal(w.conditionalEffects.defenceGranted,false);}
 assert.equal(raw('sledgehammer').conditionalEffects.smasher.targetMayParry,false);assert.equal(raw('sledgehammer').conditionalEffects.smasher.armourPenetrationGranted,false);assert.deepEqual(raw('sledgehammer').conditionalEffects.smasher.source,source('131'));assert.equal(raw('war-pick').conditionalEffects.smasher,undefined);assert.deepEqual(raw('war-pick').traits,['AP 4']);
});
test('Stone Axe breakage uses unknown manufacturing TL, never robot TL',()=>{
 const expected={maximumAttackEffect:-3,requiredManufacturingTechLevel:0,manufacturingTechLevel:null,inferFromRobotTechLevel:false,noDefectAtManufacturingTechLevelAtLeast:1,breaks:'weapon',automaticBreakageApplied:false,condition:'Weapon crafted at TL0 and attack Effect is -3 or worse; manufacturing TL is not recorded by this construction.',source:source('131')};assert.deepEqual(raw('stone-axe').conditionalEffects.tl0Breakage,expected);
 for(const techLevel of [0,1,16,23])assert.deepEqual(direct('stone-axe',{}, {techLevel}).weapons[0].conditionalEffects.tl0Breakage,expected);assert.equal(raw('stone-axe').tl,0);assert.equal(raw('stone-axe').cost,5);
});
test('Stealth Dagger detection is sensor-only with TL differential and only priced TL8 acquisition',()=>{
 const e=raw('stealth-dagger').conditionalEffects,s=e.sensorDetection;assert.deepEqual([s.skill,s.modifier,s.subjectToTechLevelDifferential,s.weaponTechLevel,s.generalStealthBonusGranted,s.automaticDetectionFailure,s.resolved],['electronics:sensors',-4,true,8,false,false,false]);assert.deepEqual(s.source,source('137'));
 assert.deepEqual(e.acquisition,{profileTechLevel:8,advancedVersionsUpToTechLevel:12,higherTechLevelPricesSpecified:false,higherTechLevelProfilesImplemented:false,source:source('135,137')});assert.equal(e.legality.normallyBannedAtLawLevelAtLeast,1);assert.equal(e.legality.localLegalityResolved,false);assert.deepEqual(CSC_MELEE_WEAPONS.filter(w=>w.id.startsWith('csc-stealth-dagger')).map(w=>[w.id,w.tl,w.cost]),[['csc-stealth-dagger',8,175]]);
 for(const techLevel of [8,12,23]){const w=direct('stealth-dagger',{}, {techLevel}).weapons[0];assert.equal(w.cost,675);assert.equal(w.conditionalEffects.sensorDetection.weaponTechLevel,8);assert.equal(w.baseAttackModifier,-3);assert.equal(w.conditionalEffects.skillGranted,false);}
});
test('ordinary CSC melee rejects magazines, grenades, power and firearm accessories',()=>{
 for(const [id]of expected){
  for(const patch of [{autoload:true},{autoload:true,extraMagazines:1}])assert.ok(has(direct(id,patch),'AUTOLOADER_AMMUNITION'));
  for(const patch of [{extraMagazines:1},{initialMagazines:0}])assert.ok(has(direct(id,patch),'WEAPON_AMMO_INAPPLICABLE'));
  for(const patch of [{initialMagazineType:'high-capacity'},{extraHighCapacityMagazines:1}])assert.ok(has(direct(id,patch),'CSC_HIGH_CAPACITY_UNSUPPORTED'));
  const linked=direct(id,{linkedWeapons:2,ammunitionOverrides:[copy({extraMagazines:1})]});assert.ok(has(linked,'WEAPON_AMMO_INAPPLICABLE'));assert.equal(linked.weapons[0].magazine,null);
  for(const ammunition of ['frag','smoke','stun','aerosol']){const r=direct(id,{ammunition});assert.ok(has(r,'CSC_AMMUNITION_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].traits,raw(id).traits);}
  for(const patch of [{auxiliaryLauncher:'attached'},{auxiliaryLauncher:'both-acr'},{auxiliaryLoaded:1},{integralLoaded:1},{looseGrenades:1}]){const r=direct(id,patch);assert.ok(has(r,'CSC_LAUNCHERS_UNSUPPORTED'));assert.deepEqual(r.weapons[0].associatedAttacks,[]);assert.equal(r.weapons[0].cost,null);}
  for(const accessory of WEAPON_ACCESSORIES.filter(a=>a.sourceFamily==='core-2022'||!['intelligent','smart-tracker','scan-jammer','gyrostabiliser'].includes(a.kind))){const r=direct(id,{accessories:[accessory.id]});assert.ok(r.diagnostics.some(d=>['error','blocker'].includes(d.severity)),id+' '+accessory.id);assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);}
 }
});
test('ordinary CSC melee import blocks source overrides and snapshots are detached',()=>{
 for(const [id]of expected)for(const patch of [{tl:12},{manufacturingTechLevel:1},{requiresTwoHands:false},{handedness:{hands:1}},{traits:[]},{damage:'99D'},{cost:0},{sourceFamily:'core-2022'},{powerConnection:'robot'},{conditionalEffects:{stun:{removedWhenTargetAware:false}}}]){const d=structuredClone(design(id));Object.assign(d.selections.physical.weapons[0],patch);assert.throws(()=>importDesign(JSON.stringify(d)),TypeError,id+' '+Object.keys(patch));}
 const d=design('stealth-dagger'),choice=getCatalogue(d).stages.find(s=>s.id==='physical').controls.find(c=>c.type==='weapons').itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-stealth-dagger');choice.conditionalEffects.sensorDetection.modifier=99;choice.handedness.source.pages='bad';const fresh=weaponControl(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-stealth-dagger');assert.equal(fresh.conditionalEffects.sensorDetection.modifier,-4);assert.deepEqual(fresh.handedness.source,source('137'));
 const a=direct('stone-axe').weapons[0];a.conditionalEffects.tl0Breakage.inferFromRobotTechLevel=true;a.handednessBasis.source.pages='bad';assert.equal(direct('stone-axe').weapons[0].conditionalEffects.tl0Breakage.inferFromRobotTechLevel,false);assert.deepEqual(raw('stone-axe').handedness.source,source('136-137'));
});
test('ordinary CSC melee API, review, renderer and print retain conditions without source prose',()=>{
 const conditions={sap:['Stun: target unaware of attacker only','Requires Target Unaware: Yes','Removed When Target Aware: Yes'],rapier:['Rapier: parrying only','Modifier: 1','Permanent Skill Bonus Granted: No'],'stone-axe':['TL0 weapon; attack Effect -3 or worse; manufacturing TL unrecorded','Infer From Robot Tech Level: No','Manufacturing Tech Level: Not calculated'],'stealth-dagger':['Weapon detection only; Electronics (sensors); TL differential applies','Modifier: -4','Subject To Tech Level Differential: Yes','Higher Tech Level Prices Specified: No'],sledgehammer:['Attacks with this Smasher only','Target May Parry: No','Armour Penetration Granted: No']};
 for(const [id,labels]of Object.entries(conditions)){const d=design(id,{placement:'held',manipulatorId:'base-1',...(id==='sledgehammer'?{supportManipulatorId:'base-2'}:{})}),api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(name,callback)=>callback()}});api.importDesign(exportDesign(d));const view=api.getView();assert.equal(view.evaluation.status,'verified');assert.deepEqual(view.evaluation.totals.weapons[0].conditionalEffects,raw(id).conditionalEffects);const ui=visible(renderReview(view.review,{createElement:tag=>new Node(tag)}));
  for(const text of [api.getStatblock(),ui,formatStatblock(view.review)]){for(const label of labels)assert.ok(text.replaceAll('\u2212','-').includes(label),id+': '+label);assert.doesNotMatch(text,/qualified physical configuration, not an explicit printed hand count|selected-melee|referenceRows/);assert.ok(text.includes('copyright 2026'));}
  const facts=presentationFacts(view.evaluation.totals.weapons[0].conditionalEffects);assert.ok(facts);assert.doesNotMatch(JSON.stringify(facts),/Operating condition unresolved; check source/);view.evaluation.totals.weapons[0].conditionalEffects.handling.hands=99;assert.notEqual(api.getView().evaluation.totals.weapons[0].conditionalEffects.handling.hands,99);
 }
});
test('no-ammunition melee preserves legacy JSON without inventing purchased magazines or metre ranges',()=>{
 for(const weapon of WEAPONS.filter(w=>w.weaponFamily==='melee'&&w.magazine===null&&!w.poweredMelee&&!w.expendableMelee))for(const linkedWeapons of [1,2]){
  const patch={weaponId:weapon.id,linkedWeapons},d=design('blade',patch),before=exportDesign(d),r=evaluateDesign(d);assert.equal(r.status,'verified');const w=r.totals.weapons[0];assert.equal(w.initialMagazines,1);assert.equal(w.initialAmmunition.status,'not-applicable');assert.deepEqual([w.initialAmmunition.count,w.initialAmmunition.totalRounds,w.initialAmmunition.purchaseCost],[0,0,0]);assert.equal(w.ammunitionInventory.status,'not-applicable');assert.equal(w.ammunitionInventory.totalRounds,0);assert.equal(w.ammunitionInventory.totalCost,0);assert.equal(w.cost,(weapon.cost+(weapon.mountClass==='small'?500:1000))*linkedWeapons);assert.equal(exportDesign(d),before);
  const text=formatStatblock(projection(d));assert.match(text,/Range: Melee/);assert.match(text,/Ammunition: Not applicable/);assert.doesNotMatch(text,/Melee m\b|Initial Magazines:|Initial Ammunition:|Ammunition Inventory:|Capacity Per Magazine:|Initial magazine per weapon/);
 }
 const d=design('sap',{linkedWeapons:2,ammunitionOverrides:[copy()]}),w=evaluateDesign(d).totals.weapons[0];assert.equal(w.initialAmmunition.status,'not-applicable');assert.equal(w.initialAmmunition.count,0);assert.equal(w.ammunitionInventory.totalRounds,0);assert.deepEqual(importDesign(exportDesign(d)),d);assert.doesNotMatch(formatStatblock(projection(d)),/Copy 2 ammunition|Initial: 1|Melee m\b/);
 const child=design('rapier'),parent=updateDesign(createDesign({kind:'ship-brain',techLevel:16}),{special:{designReferences:[{id:'component',role:'installed-robot',quantity:1,design:child}]}}),text=formatStatblock(projection(parent));assert.match(text,/Range: Melee/);assert.match(text,/Ammunition: Not applicable/);assert.doesNotMatch(text,/Melee m\b|Initial Ammunition:|Ammunition Inventory:/);
 const firearm=direct('blade',{weaponId:'autopistol'}).weapons[0];assert.equal(firearm.initialAmmunition.count,1);assert.equal(firearm.initialAmmunition.totalRounds,15);assert.equal(firearm.cost,710);
});
test('no-ammunition editor hides valid load controls but keeps every retained correction path',()=>{
 const control=weaponControl(design('blade')),app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8'),matches=app.match(/function matchesVisibility\([\s\S]*?\n}/)[0],reset=app.match(/function resetHiddenFields\([\s\S]*?\n}/)[0],helper=runInThisContext('(function(){'+matches+'\n'+reset+';return {matchesVisibility,resetHiddenFields};})')();
 for(const [id]of expected){const selected=record(id),before=structuredClone(selected),p=weaponRecordPresentation(selected);for(const field of ['initialMagazines','extraMagazines','autoload','autoloadAllocation'])assert.equal(p.fields[field].visible,false);assert.equal(p.ammunitionCustomization,null);assert.deepEqual(selected,before);
  for(const [field,value]of [['initialMagazines',0],['extraMagazines',1],['autoload',true],['autoloadAllocation',{standard:0,highCapacity:0}]]){const invalid={...selected,[field]:value},view=weaponRecordPresentation(invalid);assert.equal(view.fields[field].visible,true,field);assert.deepEqual(helper.resetHiddenFields(control,invalid)[field],value);}
  const linked={...selected,linkedWeapons:2,ammunitionOverrides:[copy({extraMagazines:1})]},p2=weaponRecordPresentation(linked,2);assert.ok(p2.ammunitionCustomization);assert.equal(p2.ammunitionCustomization.overridden,true);assert.equal(p2.fields.extraMagazines.visible,true);assert.equal(p2.ammunitionCustomization.materializedValue.extraMagazines,1);
  for(const [field,value]of [['initialMagazineType','high-capacity'],['extraHighCapacityMagazines',1],['spareMagazineStorageId','option:storage-compartment'],['highCapacityMagazineStorageId','option:storage-compartment']]){const invalid={...selected,[field]:value};assert.equal(helper.matchesVisibility(control.itemFields.find(f=>f.field===field),invalid),true);assert.equal(helper.resetHiddenFields(control,invalid)[field],value);}
 }
 const removed=direct('blade',{initialMagazines:0});assert.ok(has(removed,'WEAPON_AMMO_INAPPLICABLE'));assert.equal(has(removed,'INCLUDED_POWER_PACK'),false);
 const firearm=weaponRecordPresentation(record('blade',{weaponId:'autopistol'}));assert.notEqual(firearm.fields.initialMagazines?.visible,false);assert.ok(firearm.ammunitionCustomization);
});
