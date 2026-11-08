import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInThisContext} from 'node:vm';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {WEAPONS,weaponControl,validateWeapons,evaluateWeapons,MOUNTS} from '../engine/weapons.mjs';
import {CSC_AMMUNITION_ESTIMATE_IDS,estimateCscMagazineMass} from '../engine/csc-ammunition-storage.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';

// CSC revised printing pp142-154,160-173: these expected guideline results are
// separate fixtures, not values calculated by the production estimator.
const expected=[
 ['compound-cam-bow',.005,'projectile-load'],['crossbow',.015,'projectile-load'],['long-bow',.0075,'projectile-load'],['repeating-crossbow',.12,'projectile-load'],['short-bow',.005,'projectile-load'],
 ['assault-pistol',.075],['cartridge-pistol',.045],['coach-pistol',.02],['flechette-pistol',.01],['heavy-revolver',.045],['magrail-pistol',.1],['shot-pistol',.0025],['universal-auto-pistol',.05],['zip-gun',.001],
 ['accelerator-rifle-11',.2],['air-rifle-3',.015],['air-rifle-4',.015],['assault-shotgun',.6],['big-game-rifle',.2],['flechette-submachine-gun',.6],['gauss-assault-gun',.36],['gauss-rifle',1.6],['gauss-sniper-rifle',.24],['gauss-submachinegun',.9],['magrail-rifle',.6],['sawn-off-shotgun',.06],['light-shotgun',.09],['sniper-rifle',.1],['snub-carbine',.1],['spear-gun',.01],
 ['gauntlet-laser',1.2,'external-power-pack'],['laser-pistol-11',.6,'external-power-pack'],['personal-defence-laser',.25,'cartridge-magazine'],['cartridge-laser-carbine-10',.225,'cartridge-magazine'],['cartridge-laser-carbine-12',.25,'cartridge-magazine'],['cartridge-laser-rifle-10',.5,'cartridge-magazine'],['cartridge-laser-rifle-12',.5,'cartridge-magazine'],['heavy-laser-rifle',2.4,'internal-power-pack'],['stun-carbine',.8,'internal-power-pack'],
 ['anti-materiel-rifle',.075],['arl-standard',.3],['arl-support',.8],['arl-pdw',.2],['cppg-11',.36,'cartridge-magazine'],['cppg-12',.36,'cartridge-magazine'],['cppg-13',.3,'cartridge-magazine'],['early-machinegun',2.1],['light-assault-gun',1],['light-gatling-laser',9,'cartridge-magazine'],['machinegun',3],['rapid-fire-machinegun',3.6],['rocket-launcher-6',.04],['rocket-launcher-7',.04],['rocket-launcher-8',.08],['rocket-launcher-9',.08],['heavy-machinegun',50],['vrf-gauss-gun',500],['vrf-machinegun',1250],['rocket-pod',22.5],['tac-launcher-anti-aircraft',5],['tac-launcher-anti-personnel',5],['tac-launcher-armour-piercing',5],
 ['grenade-launcher-standard',.06],['ram-grenade-launcher-standard',.18],['heavy-advanced-combat-rifle',.75],['ducks-foot-pistol-4',.04],['ducks-foot-pistol-5',.05],['ducks-foot-pistol-6',.06],['ducks-foot-pistol-7',.07],['ducks-foot-pistol-8',.08]
];
const blocked=['hand-flamer','cryo-rifle','flame-rifle','stagger-laser-rifle-12','stagger-laser-rifle-14','stun-blaster','cryojet','flamethrower-4','flamethrower-6','flamethrower-8','mace','staff','battle-axe','broadsword','great-axe','long-blade-1','long-blade-3','monoblade','buckler','blade','cutlass','dagger','hatchet','sap','sledgehammer','rapier','stone-axe','stealth-dagger','war-pick','direct-grenade-chemical','direct-grenade-emp','direct-grenade-incendiary','direct-grenade-neurotoxin','direct-grenade-plasma','direct-grenade-thermal-smoke','direct-grenade-tranq-gas','pepper-spray','ion-rifle-14','ion-rifle-15','maser-pistol','maser-rifle','solar-beam-rifle','matter-disintegrator-19'];
blocked.push('gravity-hammer','static-maul','stunstick','arc-field-weapon','chaindrive-axe','chaindrive-sword','static-axe-11','static-axe-12','static-blade-11','static-blade-12','shock-whip');
blocked.push('monofilament-axe','spear','lance','piston-spear','shield','riot-shield','boarding-shield','anti-armour-flail','garrotte');
const storageKinds=['storage-compartment','refrigerated-storage-compartment','hazardous-material-storage-compartment'];
const ref='option:storage-compartment';
const record=(patch={})=>({id:'weapon',weaponId:'csc-heavy-advanced-combat-rifle',placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:1,initialMagazines:1,spareMagazineStorageId:ref,...patch});
const equipment=(id='storage-compartment',quantity=1,instanceId)=>({id,quantity,...(instanceId?{instanceId}:{})});
const direct=(records,installed=[equipment()])=>{validateWeapons(records);return evaluateWeapons({kind:'standard',techLevel:23,selections:{physical:{weapons:records}}},[],[],installed);};
const design=(records=[record()],physical={})=>updateDesign(createDesign({techLevel:23}),{selections:{chassis:{size:'size-7'},physical:{options:['storage-compartment'],optionParameters:{'storage-compartment':{quantity:2}},...physical,weapons:records}}});
const has=(result,code)=>result.diagnostics.some(d=>d.code===code);
const projection=d=>{const r=evaluateDesign(d);return projectReview(d,getCatalogue(d),r);};

test('the explicit estimate registry covers 70 CSC profiles and excludes the other 63',()=>{
 const csc=WEAPONS.filter(w=>w.sourceFamily==='csc-2023');
 assert.equal(csc.length,133);assert.equal(expected.length,70);assert.equal(blocked.length,63);
 assert.deepEqual([...CSC_AMMUNITION_ESTIMATE_IDS].sort(),expected.map(([id])=>'csc-'+id).sort());
 assert.deepEqual(csc.filter(w=>!estimateCscMagazineMass(w)).map(w=>w.id).sort(),blocked.map(id=>'csc-'+id).sort());
 assert.ok(Object.isFrozen(CSC_AMMUNITION_ESTIMATE_IDS));
});
for(const [id,unitMassKg,kind='round-load'] of expected){
 test('CSC estimate '+id+' retains source-qualified mass, price and one spare reservation',()=>{
  const weapon=WEAPONS.find(w=>w.id==='csc-'+id),before=structuredClone(weapon),estimate=estimateCscMagazineMass(weapon);
  assert.deepEqual([estimate.estimated,estimate.unitMassKg,estimate.kind],[true,unitMassKg,kind]);
  assert.deepEqual(estimate.source,{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages:'142'});
  assert.ok(estimate.classificationSource.pages);assert.match(estimate.scope,/not an independently measured/);
  const result=direct([record({weaponId:weapon.id})],[equipment('storage-compartment',1000)]),w=result.weapons[0];
  assert.equal(has(result,'SPARE_AMMO_STORAGE'),false);assert.equal(has(result,'AMMUNITION_STORAGE_CAPACITY'),false);
  assert.deepEqual([w.spareAmmunition.count,w.spareAmmunition.massKg,w.spareAmmunition.cost],[1,unitMassKg,weapon.magazineCost]);
  assert.equal(w.cost,weapon.cost+MOUNTS[weapon.mountClass].cost+weapon.magazineCost*(weapon.initialIncluded?1:2));
  assert.equal(result.ammunitionStorage[0].reservedKg,unitMassKg);assert.deepEqual(weapon,before);
 });
}
for(const id of blocked){
 test('CSC unsupported ammunition '+id+' cannot obtain a storage estimate or clear its blocker',()=>{
  assert.equal(estimateCscMagazineMass(WEAPONS.find(w=>w.id==='csc-'+id)),null);
  const result=direct([record({weaponId:'csc-'+id})]);
  assert.ok(has(result,'SPARE_AMMO_STORAGE'));assert.ok(has(result,'SPARE_AMMO_STORAGE_UNSUPPORTED'));
  assert.equal(result.weapons[0].spareAmmunition,undefined);assert.deepEqual(result.ammunitionStorage,[]);
 });
}
test('unlisted weapon mass fallback is confined to ammunition basis and returns detached estimates',()=>{
 const weapon=WEAPONS.find(w=>w.id==='csc-zip-gun'),before=structuredClone(weapon),estimate=estimateCscMagazineMass(weapon);
 assert.equal(estimate.basisWeaponMassKg,.2);assert.equal(estimate.unlistedWeaponMassFallback,true);
 const result=direct([record({weaponId:weapon.id})]);assert.equal(result.weapons[0].massKg,null);assert.equal(weapon.massKg,null);
 estimate.source.pages='mutated';result.weapons[0].spareAmmunition.estimate.source.pages='mutated';
 assert.equal(estimateCscMagazineMass(weapon).source.pages,'142');assert.deepEqual(weapon,before);
 for(const patch of [{massKg:undefined},{massKg:NaN},{massKg:0},{massKg:-1},{sourceFamily:'core-2022'},{magazine:null},{magazine:0},{magazine:1.5},{magazineCost:null},{magazineCost:-1},{ammunitionAccounting:{replacementPurchasesSupported:false}}])assert.equal(estimateCscMagazineMass({...weapon,...patch}),null);
});
test('non-autoloaded counts 0, 1, 10, 11 and 100 preserve exact count and only positive loads reserve storage',()=>{
 for(const count of [0,1,10,11,100]){
  const w=record({extraMagazines:count,...(!count?{spareMagazineStorageId:'none'}:{})}),result=direct([w],[equipment('storage-compartment',100)]);
  assert.equal(has(result,'SPARE_AMMO_STORAGE'),false);
  assert.equal(result.weapons[0].spareAmmunition?.count??0,count);
  assert.equal(result.ammunitionStorage[0]?.reservedKg??0,.75*count);
 }
 for(const count of [-1,101,1.1,'1',null,NaN,Infinity,Number.MAX_SAFE_INTEGER])assert.throws(()=>validateWeapons([record({extraMagazines:count})]),TypeError);
 for(const value of [null,1,{},'', 'instance:', 'option:bad value','x'.repeat(101)])assert.throws(()=>validateWeapons([record({spareMagazineStorageId:value})]),TypeError);
});
test('autoloader ten limit, doubled costs and mount Slots are unchanged, and eleven is rejected',()=>{
 const w=WEAPONS.find(w=>w.id==='csc-heavy-advanced-combat-rifle');
 for(const count of [1,10]){
  const result=direct([record({autoload:true,extraMagazines:count,spareMagazineStorageId:'none'})]);
  assert.equal(result.weapons[0].slots,4);assert.equal(result.weapons[0].cost,w.cost+1000+w.magazineCost*(1+2*count));
  assert.equal(result.weapons[0].spareAmmunition,undefined);assert.deepEqual(result.ammunitionStorage,[]);
 }
 assert.ok(has(direct([record({autoload:true,extraMagazines:0,spareMagazineStorageId:'none'})]),'EMPTY_AUTOLOADER'));
 assert.throws(()=>validateWeapons([record({autoload:true,extraMagazines:11})]),TypeError);
});
test('linked weapons 1 through 4 multiply spare counts, mass and cost once without reserving loaded ammunition',()=>{
 const w=WEAPONS.find(w=>w.id==='csc-heavy-advanced-combat-rifle');
 for(const linkedWeapons of [1,2,3,4])for(const initialMagazines of [0,1]){
  const result=direct([record({linkedWeapons,extraMagazines:2,initialMagazines})],[equipment('storage-compartment',10)]),r=result.weapons[0],ammo=r.spareAmmunition;
  assert.deepEqual([ammo.countPerWeapon,ammo.linkedWeapons,ammo.count,ammo.massKg,ammo.cost],[2,linkedWeapons,2*linkedWeapons,1.5*linkedWeapons,2*w.magazineCost*linkedWeapons]);
  assert.equal(r.cost,(w.cost+1000+w.magazineCost*(2+initialMagazines))*linkedWeapons);
  assert.equal(result.cost,r.cost);assert.equal(result.ledger[0].cost,r.cost);
 }
 for(const id of ['csc-gauntlet-laser','csc-laser-pistol-11','csc-heavy-laser-rifle']){
  const r=direct([record({weaponId:id,extraMagazines:0,spareMagazineStorageId:'none'})]);
  assert.deepEqual(r.ammunitionStorage,[]);assert.equal(r.weapons[0].spareAmmunition,undefined);
 }
});
const coreGrenades=()=>record({id:'grenades',weaponId:'grenade-launcher',ammunition:'frag',extraMagazines:0,spareMagazineStorageId:'none',looseGrenades:2,looseAmmunitionFor:'primary',ammunitionStorageId:ref});
test('CSC spare magazines and Core loose rounds share exact-fit capacity and overflow in either order',()=>{
 const csc=record({linkedWeapons:2,extraMagazines:2});
 for(const records of [[csc,coreGrenades()],[coreGrenades(),csc]]){
  const d=design(records),r=evaluateDesign(d);assert.equal(r.status,'verified');assert.equal(r.totals.ammunitionStorage.length,1);
  assert.deepEqual([r.totals.ammunitionStorage[0].reservedKg,r.totals.ammunitionStorage[0].capacityKg,r.totals.ammunitionStorage[0].remainingKg],[4,4,0]);
  assert.equal(has(r,'SPARE_AMMO_STORAGE'),false);
  const overRecords=records.map(w=>w.id==='weapon'?{...w,extraMagazines:3}:w),over=evaluateDesign(design(overRecords));
  assert.equal(over.status,'invalid');assert.ok(has(over,'AMMUNITION_STORAGE_CAPACITY'));assert.ok(has(over,'SPARE_AMMO_STORAGE'));
  assert.equal(direct(overRecords,[equipment('storage-compartment',2)]).ammunitionStorage[0].reservedKg,5.5);
 }
});
test('decimal accumulation does not reject an exact fit or admit a real overflow',()=>{
 const records=Array.from({length:20},(_,i)=>record({id:'w-'+i,weaponId:'csc-magrail-pistol'}));
 const result=direct(records);assert.equal(result.ammunitionStorage[0].reservedKg,2);assert.equal(result.ammunitionStorage[0].remainingKg,0);assert.equal(has(result,'AMMUNITION_STORAGE_CAPACITY'),false);
 const over=direct([...records,record({id:'over',weaponId:'csc-zip-gun'})]);assert.equal(over.ammunitionStorage[0].reservedKg,2.001);assert.ok(has(over,'AMMUNITION_STORAGE_CAPACITY'));
});
test('each storage kind accepts only capacity accounting, not hazardous-material certification',()=>{
 for(const id of storageKinds){
  const d=design([record({extraMagazines:2,spareMagazineStorageId:'option:'+id})],{options:[id],optionParameters:{[id]:{quantity:1}}}),r=evaluateDesign(d);
  assert.equal(r.status,'verified');assert.equal(r.totals.ammunitionStorage[0].reservedKg,1.5);
  assert.match(r.totals.weapons[0].spareAmmunition.scope,/does not establish hazardous/);
  assert.match(r.totals.ammunitionStorage[0].scope,/volume fit remain external/);
 }
});
test('stable instances do not borrow capacity and removal or dangling references remain invalid',()=>{
 const physical={options:[],optionParameters:{},optionInstances:[{id:'locker-a',optionId:'storage-compartment',parameters:{quantity:1}},{id:'locker-b',optionId:'storage-compartment',parameters:{quantity:1}}]},records=[record({extraMagazines:2,spareMagazineStorageId:'instance:locker-a'}),record({id:'second',extraMagazines:2,spareMagazineStorageId:'instance:locker-b'})];
 const d=design(records,physical),r=evaluateDesign(d);assert.equal(r.status,'verified');assert.deepEqual(r.totals.ammunitionStorage.map(s=>s.reservedKg),[1.5,1.5]);
 const shared=evaluateDesign(design(records.map(w=>({...w,spareMagazineStorageId:'instance:locker-a'})),physical));assert.ok(has(shared,'AMMUNITION_STORAGE_CAPACITY'));
 const removed=updateDesign(d,{selections:{physical:{optionInstances:[physical.optionInstances[1]]}}}),rr=evaluateDesign(removed);
 assert.equal(rr.status,'invalid');assert.ok(has(rr,'SPARE_AMMO_STORAGE_REQUIRED'));assert.ok(has(rr,'SPARE_AMMO_STORAGE'));
 assert.equal(removed.selections.physical.weapons[0].spareMagazineStorageId,'instance:locker-a');
 const dangling=direct([record({spareMagazineStorageId:'instance:missing'})]);assert.ok(has(dangling,'SPARE_AMMO_STORAGE_REQUIRED'));assert.equal(dangling.weapons[0].spareAmmunition,undefined);
 assert.ok(has(direct([record()],[]),'SPARE_AMMO_STORAGE_REQUIRED'));
});
test('hidden imported fields cannot waive source, count, autoloader or reference checks',()=>{
 for(const [patch,code] of [[{extraMagazines:0},'UNUSED_SPARE_AMMO_STORAGE'],[{autoload:true},'SPARE_AMMO_STORAGE_AUTOLOADER'],[{weaponId:'rifle'},'SPARE_AMMO_STORAGE_UNSUPPORTED'],[{weaponId:'csc-ion-rifle-14'},'SPARE_AMMO_STORAGE_UNSUPPORTED'],[{spareMagazineStorageId:'instance:missing'},'SPARE_AMMO_STORAGE_REQUIRED']]){
  const d=design([record(patch)]),loaded=importDesign(exportDesign(d)),r=evaluateDesign(loaded);
  assert.deepEqual(loaded.selections.physical.weapons,d.selections.physical.weapons);assert.equal(r.status,'invalid');assert.ok(has(r,code));assert.equal(r.totals,null);
 }
 const d=design([record()]);d.selections.physical.weapons[0].spareAmmunition={massKg:0};assert.throws(()=>importDesign(JSON.stringify(d)),/unknown field/);
});
test('absent new fields preserve old imports and unknown replacement prices remain null and blocking',()=>{
 const old=record({extraMagazines:0});delete old.spareMagazineStorageId;
 const d=design([old]);assert.deepEqual(importDesign(exportDesign(d)),d);assert.equal(Object.hasOwn(importDesign(exportDesign(d)).selections.physical.weapons[0],'spareMagazineStorageId'),false);
 for(const id of ['csc-maser-pistol','csc-maser-rifle','csc-solar-beam-rifle','csc-matter-disintegrator-19']){
  const r=direct([record({weaponId:id})]);assert.ok(has(r,'CSC_REPLACEMENT_AMMUNITION_UNAVAILABLE'));assert.equal(r.weapons[0].cost,null);assert.equal(r.ledger[0].cost,null);
 }
 for(const id of ['rifle','laser-pistol-11','handbook-stunner-12']){
  assert.equal(estimateCscMagazineMass(WEAPONS.find(w=>w.id===id)),null);
  const r=direct([record({weaponId:id,spareMagazineStorageId:'none'})]);assert.ok(has(r,'SPARE_AMMO_STORAGE'));assert.deepEqual(r.ammunitionStorage,[]);
 }
});
test('UI constraints are engine metadata, source-scoped and detached',()=>{
 const d=design(),control=weaponControl(d),fields=control.itemFields,max=fields.find(f=>f.field==='extraMagazines'),storage=fields.find(f=>f.field==='spareMagazineStorageId');
 assert.deepEqual(max.maxBy,{field:'autoload',values:{true:10,false:100}});assert.equal(max.max,100);assert.match(max.limitScope,/application bound/);
 assert.equal(storage.resetWhenHidden,undefined);assert.equal(storage.default,'none');assert.equal(storage.choices[1].id,ref);
 assert.deepEqual(storage.visibleWhen.anyOf[1].allOf[0].oneOf.slice().sort(),expected.map(([id])=>'csc-'+id).sort());
 assert.deepEqual(storage.visibleWhen.anyOf[1].allOf.slice(1),[{field:'autoload',equals:false},{field:'extraMagazines',notEquals:0}]);
 storage.visibleWhen.anyOf[1].allOf[0].oneOf.splice(0);storage.choices[1].label='mutated';max.maxBy.values.true=999;
 const fresh=weaponControl(d).itemFields;assert.equal(fresh.find(f=>f.field==='spareMagazineStorageId').visibleWhen.anyOf[1].allOf[0].oneOf.length,70);assert.equal(fresh.find(f=>f.field==='extraMagazines').maxBy.values.true,10);
});
test('API rejects 100-spare autoload transition atomically without truncation or loss of storage',()=>{
 const api=createRobotApi(),d=design([record({extraMagazines:100})],{optionParameters:{'storage-compartment':{quantity:100}}});
 api.importDesign(JSON.stringify(d));const before=api.getView().design;
 assert.throws(()=>api.select({stage:'physical',field:'weapons',value:[{...before.selections.physical.weapons[0],autoload:true,spareMagazineStorageId:'none'}]}),/0 to 10/);
 assert.deepEqual(api.getView().design,before);assert.equal(api.getView().design.selections.physical.weapons[0].extraMagazines,100);
});
test('renderer retains a rejected unsaved composer and resets it only after a successful Add',async()=>{
 // Execute the actual UI transaction helpers with the real API, without booting
 // the DOM. Full event rendering is also exercised by the browser harness.
 const source=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');
 const safely=source.match(/async function safely\(action, success\) \{[\s\S]*?\n\}/)?.[0],submit=source.match(/function submitSelection\(control, value, completedDraftKey\) \{[\s\S]*?\n\}/)?.[0];
 assert.ok(safely);assert.ok(submit);
 const api=createRobotApi(),key='weapon-composer',draft=record({autoload:true,extraMagazines:100,spareMagazineStorageId:'none'}),customDrafts=new Map([[key,draft]]),renders=[],notices=[];
 const render=view=>renders.push({view,draft:customDrafts.get(key)});api.subscribe(render);
 const submitSelection=runInThisContext('(function(api,customDrafts,currentStage,render,notify){'+safely+'\n'+submit+'\nreturn submitSelection;})')(api,customDrafts,'physical',render,message=>notices.push(message));
 const before=api.getView().design;
 assert.equal(await submitSelection({field:'weapons'},[draft],key),null);
 assert.deepEqual(api.getView().design,before);assert.equal(customDrafts.get(key),draft);assert.equal(renders.at(-1).draft,draft);assert.equal(renders.length,1);assert.match(notices.at(-1),/0 to 10/);
 assert.deepEqual([draft.weaponId,draft.extraMagazines,draft.autoload],['csc-heavy-advanced-combat-rifle',100,true]);
 draft.autoload=false;
 const accepted=await submitSelection({field:'weapons'},[draft],key);
 assert.equal(accepted.design.selections.physical.weapons[0].extraMagazines,100);assert.equal(customDrafts.has(key),false);assert.equal(renders.at(-1).draft,undefined);assert.equal(renders.length,2);
 customDrafts.set(key,{weaponId:'csc-zip-gun'});
 await submitSelection({field:'weapons'},[]);
 assert.equal(customDrafts.get(key).weaponId,'csc-zip-gun');
 assert.equal((source.match(/submitSelection\(control,\[\.\.\.installed,next\],draftKey\)/g)||[]).length,2);
});
test('review resolves storage labels, distinguishes estimates from weapon mass and does not mutate inputs',()=>{
 const d=design([record({weaponId:'csc-zip-gun',spareMagazineStorageId:'instance:secret-ref'})],{options:[],optionParameters:{},optionInstances:[{id:'secret-ref',optionId:'storage-compartment',parameters:{quantity:1}}]}),result=evaluateDesign(d),before=structuredClone(result);
 const review=projectReview(d,getCatalogue(d),result),weapons=review.sections.find(s=>s.id==='weapons'),text=formatStatblock(review);
 assert.ok(weapons.rows[0].details.some(r=>r.label==='Spare ammunition (estimated mass)'&&r.value.includes('Storage Compartment 1')&&r.value.includes('Unit Mass Kg: 0.001')&&r.value.includes('Mass Kg: 0.001')));
 assert.ok(weapons.rows[0].details.some(r=>r.label==='Source weapon mass (kg)'&&r.value==='Not calculated'));
 assert.equal(text.includes('instance:secret-ref'),false);assert.match(text,/0.001 \/ 2 kg reserved/);assert.match(text,/unlisted|Unlisted/);assert.match(text,/estimated|Estimated/);assert.deepEqual(result,before);
 result.totals.weapons[0].spareAmmunition.estimate.source.pages='mutated';result.totals.weapons[0].spareAmmunition.count=0;
 assert.equal(evaluateDesign(d).totals.weapons[0].spareAmmunition.estimate.source.pages,'142');assert.equal(evaluateDesign(d).totals.weapons[0].spareAmmunition.count,1);
});
test('referenced component weapon review resolves storage labels and preserves tiny estimated masses',()=>{
 const child=design([record({weaponId:'csc-zip-gun',spareMagazineStorageId:'instance:child-locker'})],{options:[],optionParameters:{},optionInstances:[{id:'child-locker',optionId:'storage-compartment',parameters:{quantity:1}}]});
 const host=updateDesign(createDesign({kind:'ship-brain',techLevel:23}),{special:{designReferences:[{id:'component',role:'installed-robot',quantity:1,design:child}]}}),result=evaluateDesign(host);
 assert.equal(result.status,'verified');const text=formatStatblock(projectReview(host,getCatalogue(host),result));
 assert.equal(text.includes('instance:child-locker'),false);assert.match(text,/Storage Compartment \(separate installation 1\)/);assert.match(text,/Unit Mass Kg: 0.001/);assert.match(text,/Spare ammunition \(estimated mass\)/);
});
const limbDesign=(copies=1,extra={})=>updateDesign(createDesign({kind:'cyborg',techLevel:14}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity:copies}}],augmentOptions:[{id:'locker',optionId:'storage-compartment',parameters:{parentLimb:'limb',quantity:1}}],augmentWeapons:[(({manipulatorId,...w})=>({...w,parentLimb:'limb'}))(record({weaponId:'csc-assault-pistol',placement:'arm',extraMagazines:10,spareMagazineStorageId:'instance:locker'}))],...extra}});
test('cyberlimb copies retain per-limb storage and counts while full construction cost scales once',()=>{
 const single=evaluateDesign(limbDesign()),double=evaluateDesign(limbDesign(2));assert.equal(single.status,'verified');assert.equal(double.status,'verified');
 const a=single.totals.augmentations[0],b=double.totals.augmentations[0];assert.equal(b.totalCost,2*a.totalCost);assert.equal(b.weaponCost,2*a.weaponCost);assert.equal(b.weapons[0].copies,2);
 assert.deepEqual(b.weaponAccounting.ammunitionStorage,a.weaponAccounting.ammunitionStorage);assert.equal(b.weaponAccounting.ammunitionStorage[0].reservedKg,.75);
 assert.equal(b.weapons[0].spareAmmunition.count,10);assert.equal(b.weapons[0].spareAmmunition.massKg,.75);assert.equal(b.weaponAccounting.perLimbSlots,1);
 assert.equal(formatStatblock(projection(limbDesign(2))).includes('instance:locker'),false);
});
test('a limb cannot borrow storage from another limb or from ordinary body selections',()=>{
 const d=limbDesign(1,{augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{}},{id:'other',optionId:'cybernetic-arm',parameters:{}}],augmentOptions:[{id:'locker',optionId:'storage-compartment',parameters:{parentLimb:'other',quantity:1}}]}),r=evaluateDesign(d);
 assert.equal(r.status,'invalid');assert.ok(has(r,'SPARE_AMMO_STORAGE_REQUIRED'));assert.ok(has(r,'SPARE_AMMO_STORAGE'));
 const missing=limbDesign(1,{augmentOptions:[]}),withBody=updateDesign(missing,{selections:{physical:{optionInstances:[{id:'locker',optionId:'storage-compartment',parameters:{quantity:1}}]}}});
 assert.ok(has(evaluateDesign(withBody),'SPARE_AMMO_STORAGE_REQUIRED'));
 const copyOverflow=limbDesign(2);copyOverflow.special.augmentWeapons[0].extraMagazines=27;
 const overflow=evaluateDesign(copyOverflow);assert.ok(has(overflow,'AMMUNITION_STORAGE_CAPACITY'));assert.equal(overflow.totals,null);
});
