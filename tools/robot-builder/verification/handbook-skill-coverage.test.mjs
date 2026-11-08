import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,exportDesign,importDesign,getCatalogue} from '../engine/index.mjs';
import {PACKAGES} from '../engine/catalogue.mjs';
import {SPECIALITIES} from '../engine/skills-data.mjs';
import {resolveSkillLevel} from '../engine/skill-coverage.mjs';
import {createRobotApi} from '../js/api.mjs';
const choice=id=>PACKAGES.find(p=>p.id===id);
const custom=(skill,speciality,level=1)=>({id:'custom-one',skill,speciality,level});
const robot=(packages=[],customPackages=[])=>updateDesign(createDesign({techLevel:19}),{selections:{brain:{model:'conscious-tl19'},skills:{packages,customPackages}}});
const good=design=>{const result=evaluateDesign(design);assert.equal(result.status,'verified',JSON.stringify(result.diagnostics));return result.totals;};
const has=(design,code)=>evaluateDesign(design).diagnostics.some(d=>d.code===code);
const held=(weaponId='autopistol')=>({id:'weapon',weaponId,placement:'held',manipulatorId:'base-1',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1});
const armed=(packages,weaponId='autopistol')=>updateDesign(robot(packages),{selections:{physical:{weapons:[held(weaponId)]}}});
// Sources are intentionally citations and independent expected values, not publisher text.
test('Core p58 standard specialities resolve exact positives, same-skill zero and unrelated untrained',()=>{
 for(const [packages,expected] of [[[], -3],[['gun-combat-0'],0],[['gun-combat-energy-1'],0],[['gun-combat-slug-1'],1],[['gun-combat-all-listed-1'],1],[['melee-blade-1'],-3]]){
  const result=good(armed(packages));assert.equal(result.weapons[0].softwareLevel,expected,packages.join(','));
  assert.equal(result.weapons[0].baseAttackModifier,expected+result.weapons[0].manipulatorDM);
 }
 const skills=good(robot(['gun-combat-energy-2','gun-combat-slug-1'])).skills;
 assert.equal(resolveSkillLevel(skills,'gun-combat','energy'),2);assert.equal(resolveSkillLevel(skills,'gun-combat','slug'),1);assert.equal(resolveSkillLevel(skills,'gun-combat','archaic'),0);
 assert.equal(resolveSkillLevel([{id:'melee-other:blade',speciality:'blade',level:3}],'melee','blade'),-3);
 assert.equal(resolveSkillLevel([{id:'melee:blade',level:1,grantsOtherSpecialitiesAtZero:false}],'melee','whip'),-3);
 assert.equal(resolveSkillLevel([],'athletics','strength',{untrained:null}),null);
});
test('hard-coded skills keep their exact task, IDs and no characteristic or other-speciality grants',()=>{
 const rows=[{id:'gun-combat:energy',level:1,characteristic:'hard-coded',grantsOtherSpecialitiesAtZero:true},{id:'athletics-dexterity',level:2,characteristic:'hard-coded'},{id:'profession-domestic-servant',level:2,characteristic:'hard-coded'},{id:'tactics-military',level:1,characteristic:'hard-coded'}];
 assert.equal(resolveSkillLevel(rows,'gun-combat','energy'),1);assert.equal(resolveSkillLevel(rows,'gun-combat','slug'),-3);
 assert.equal(resolveSkillLevel(rows,'athletics','dexterity'),2);assert.equal(resolveSkillLevel(rows,'athletics','strength'),-3);
 assert.equal(resolveSkillLevel(rows,'profession','domestic-servant'),2);assert.equal(resolveSkillLevel(rows,'profession','belter'),-3);
 assert.equal(resolveSkillLevel(rows,'tactics','military'),1);assert.equal(resolveSkillLevel(rows,'tactics','naval'),-3);
 const d=updateDesign(createDesign({techLevel:12}),{selections:{brain:{model:'basic-tl10'},skills:{corePackage:'basic-security',coreWeapon:'gun-combat:energy'},physical:{weapons:[held()]}}});
 assert.equal(good(d).weapons[0].softwareLevel,-3);assert.deepEqual(good(d).skillEquivalents,[]);
});
test('RH pp26,73 Athletics equivalents agree for individual, listed, legacy and explicit full purchases',()=>{
 const prepared=packages=>updateDesign(robot(packages),{selections:{physical:{manipulators:[{id:'base-1',kind:'base',size:'chassis',strengthIncrease:3,dexterityIncrease:3},{id:'base-2',kind:'base',size:'chassis',strengthIncrease:0,dexterityIncrease:0}]}}});
 const expected=[{skill:'athletics',speciality:'strength',manipulatorId:'base-1',level:3},{skill:'athletics',speciality:'dexterity',manipulatorId:'base-1',level:3},{skill:'athletics',speciality:'strength',manipulatorId:'base-2',level:2},{skill:'athletics',speciality:'dexterity',manipulatorId:'base-2',level:2}];
 for(const packages of [['athletics-strength-1','athletics-dexterity-1','athletics-endurance-1'],['athletics-all-listed-1'],['athletics-all-referee-four-1'],['athletics-all-referee-four-full-1'],['athletics-all-referee-eight-full-1']])assert.deepEqual(good(prepared(packages)).skillEquivalents,expected,packages.join(','));
 assert.deepEqual(good(prepared([])).skillEquivalents,[]);
 for(const packages of [['athletics-0'],['athletics-endurance-1']])assert.deepEqual(good(prepared(packages)).skillEquivalents,expected.map(row=>({...row,level:row.level-1})));
});
test('CSC whip receives only zero from Core listed or individual software, positive only from purchase or explicit full rule',()=>{
 for(const [packages,expected] of [[[],-3],[['melee-blade-1'],0],[['melee-all-listed-1'],0],[['melee-all-referee-four-1'],0],[['melee-whip-1'],1],[['melee-all-referee-four-full-1'],1],[['melee-all-listed-1','melee-whip-1'],1]])assert.equal(good(armed(packages,'csc-shock-whip')).weapons[0].softwareLevel,expected,packages.join(','));
 const p=choice('melee-all-listed-1');assert.equal(p.cost,4000);assert.equal(p.bandwidth,4);assert.deepEqual(p.coveredSpecialities,['unarmed','blade','bludgeon','natural']);assert.equal(p.coversAllSpecialities,undefined);
});
test('RH p73 makes four/eight full coverage explicit for every specialised skill, including Art and Profession',()=>{
 for(const skill of Object.keys(SPECIALITIES))for(const [word,count] of [['four',4],['eight',8]])for(const level of [1,2,3]){
  const p=choice(`${skill}-all-referee-${word}-full-${level}`);assert.ok(p,skill);assert.equal(p.implemented,true);assert.equal(p.refereeBroad,true);assert.equal(p.coversAllSpecialities,true);assert.equal(p.packageCount,count);assert.equal(p.bandwidth,count*p.perPackageBandwidth);assert.equal(p.cost,count*choice(`${skill}-${level}`).cost);assert.equal(p.source.book,'Robot Handbook');assert.match(p.source.pages,/73/);
 }
 for(const [skill,speciality]of [['profession','orbital rigger'],['art','instrument: alien harp'],['science','new scientific field'],['language','new language']])for(const word of ['four','eight']){
  const d=robot([`${skill}-all-referee-${word}-full-1`]),t=good(d);assert.equal(resolveSkillLevel(t.skills,skill,speciality),1);assert.ok(has(d,'REFEREE_BROAD_SKILL'));assert.equal(t.skills[0].coversAllSpecialities,true);
 }
 assert.equal(has(robot(['art-instrument-1']),'SPECIALITY_REQUIRED'),true);assert.equal(has(robot(['art-all-listed-1']),'SPECIALITY_REQUIRED'),true);
});
test('saved finite bundles retain their prices, bandwidth and listed scope without implicit upgrades',()=>{
 for(const id of ['science-all-referee-four-1','science-all-referee-eight-1','language-all-referee-four-1']){
  const p=choice(id),d=robot([id]),round=importDesign(exportDesign(d)),t=good(round);assert.deepEqual(round,d);assert.equal(p.coversAllSpecialities,undefined);assert.match(p.label,/listed only; legacy/);assert.deepEqual(t.skills[0].coveredSpecialities,SPECIALITIES[p.skill]);assert.equal(resolveSkillLevel(t.skills,p.skill,'new custom speciality'),0);assert.equal(t.bandwidth.used,p.packageCount);assert.equal(evaluateDesign(d).ledger.find(row=>row.id===id).cost,p.cost);
 }
 const profession=good(robot(['profession-all-listed-1']));assert.equal(resolveSkillLevel(profession.skills,'profession','orbital rigger'),-3);assert.equal(resolveSkillLevel(profession.skills,'profession','belter'),1);
});
test('Core Profession exception and custom open specialties remain separate from explicit full coverage',()=>{
 for(const level of [0,1,2]){const rows=good(robot([],[custom('profession','Orbital Rigger',level)])).skills;assert.equal(resolveSkillLevel(rows,'profession','orbital rigger'),level);assert.equal(resolveSkillLevel(rows,'profession','belter'),-3);assert.equal(rows[0].grantsOtherSpecialitiesAtZero,false);}
 assert.equal(resolveSkillLevel(good(robot(['profession-0'])).skills,'profession','belter'),-3);
 const instrument=good(robot([],[custom('art-instrument','Alien Harp',1)])).skills;assert.equal(resolveSkillLevel(instrument,'art','instrument: alien harp'),1);assert.equal(resolveSkillLevel(instrument,'art','instrument: piano'),0);
 const languages=good(robot(['language-galanglic-1','language-vilani-1','language-zdetl-1','language-oynprith-1']));assert.equal(resolveSkillLevel(languages.skills,'language','Trokh'),0);assert.equal(languages.bandwidth.used,4);
});
test('full coverage conflicts with additional same-skill purchases, while finite disjoint custom choices remain valid',()=>{
 for(const skill of ['profession','language','science']){
  for(const word of ['four','eight']){assert.ok(has(robot([`${skill}-all-referee-${word}-full-1`],[custom(skill,'novel specialty')]),'DUPLICATE_SKILL'));assert.ok(has(robot([`${skill}-all-referee-${word}-full-1`,`${skill}-0`]),'DUPLICATE_SKILL'));}
  good(robot([`${skill}-all-listed-1`],[custom(skill,'novel specialty')]));
 }
 for(const packages of [['melee-all-referee-four-full-1','melee-whip-1'],['melee-whip-1','melee-all-referee-four-full-1'],['art-all-referee-four-full-1','art-all-referee-eight-full-1']])assert.ok(has(robot(packages),'DUPLICATE_SKILL'));
 assert.ok(has(robot(['art-all-referee-four-full-1'],[custom('art-instrument','harp')]),'DUPLICATE_SKILL'));
 const limited=updateDesign(createDesign({techLevel:15}),{selections:{brain:{model:'advanced-tl10',bandwidthUpgrade:'bw-4'},skills:{packages:['art-all-referee-four-full-3']}}});assert.ok(has(limited,'INHERENT_BANDWIDTH'));assert.ok(has(limited,'BANDWIDTH_EXCEEDED'));
});
test('equipment readiness uses exact, covered and zero fallback levels without unrelated software',()=>{
 const d=packages=>updateDesign(robot(packages),{selections:{physical:{options:['robotic-drone-controller-basic']}}});
 for(const packages of [['electronics-computers-1'],['electronics-all-1'],['electronics-all-referee-four-full-1']]){const t=good(d(packages));assert.equal(t.equipmentOperations[0].status,'software-ready');assert.equal(t.equipmentCapabilities.find(row=>row.family==='robotic-drone-controller')?.status??t.equipmentOperations[0].status,'software-ready');}
 for(const packages of [[],['science-robotics-1']])assert.equal(good(d(packages)).equipmentOperations[0].status,'inactive');
});
test('API JSON, explicit save, review, print and composite profile retain authoritative scope and corrected ratings',async()=>{
 const storage=new Map(),options={storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},locks:{request:(_n,_o,fn)=>fn()},idFactory:()=> 'coverage-synthetic',clock:()=> '2026-11-08T00:00:00Z'};
 const d=updateDesign(armed(['gun-combat-energy-1','profession-all-referee-eight-full-1']),{name:'Skill coverage fixture'}),api=createRobotApi(options);api.importDesign(exportDesign(d));await api.saveDesign();
 const fresh=createRobotApi(options);fresh.loadDesign('coverage-synthetic');assert.deepEqual(fresh.getView().design,d);let view=fresh.getView();assert.equal(view.evaluation.totals.weapons[0].softwareLevel,0);assert.match(view.statblock,/Profession \(all specialities; referee 8-package rule\)/);assert.match(view.statblock,/Covers All Specialities: Yes/);assert.match(view.statblock,/Referee Broad: Yes/);assert.match(view.statblock,/Robot Handbook/);assert.match(view.statblock,/Broad speciality: referee approval required/);
 view.evaluation.totals.skills.find(s=>s.skill==='profession').coversAllSpecialities=false;assert.equal(fresh.getView().evaluation.totals.skills.find(s=>s.skill==='profession').coversAllSpecialities,true);
 const parent=updateDesign(createDesign({kind:'ship-brain',techLevel:19}),{special:{designReferences:[{id:'child',role:'installed-robot',quantity:1,design:d}]}}),result=evaluateDesign(parent);assert.equal(result.status,'verified');const profile=result.composite.components[0].profile;assert.equal(profile.weapons[0].softwareLevel,0);assert.equal(resolveSkillLevel(profile.skills,'profession','orbital rigger'),1);
 const forged=JSON.parse(exportDesign(d));forged.selections.skills.coversAllSpecialities=true;assert.throws(()=>importDesign(JSON.stringify(forged)));
 const catalogue=getCatalogue(d),selected=catalogue.stages.find(s=>s.id==='skills').controls.find(c=>c.field==='packages').choices.find(p=>p.id==='profession-all-referee-eight-full-1');assert.equal(selected.eligibility.available,true);selected.coversAllSpecialities=false;assert.equal(choice('profession-all-referee-eight-full-1').coversAllSpecialities,true);
});
