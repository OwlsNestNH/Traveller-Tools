import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
import {findCareer} from '../engine/catalog.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);let code=await readFile(url,'utf8');code=code.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));code+='\nexport const a={initial,apply,queueEffects,availableCareers,commissionAvailability,followingInteractionDM,exitOptions};';
const {a}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const run=(r,type,payload={},options)=>execute(r.session??r,{type,payload},options);
function fixture(id='core.army',terms=0){
 const s=a.initial('availability');s.stage='advancement';s.character.species=id.startsWith('aslan.')?'aslan':id.startsWith('zhodani.')?'zhodani':'human';s.character.gender='male';s.character.stats={STR:8,DEX:8,END:8,INT:8,EDU:8,SOC:10};
 s.character.careers=[{id,assignment:findCareer(id).assignments[0].id,terms,rank:0,officer:false,benefitRolls:1,totalBenefits:0}];s.active=0;return s;
}
function cmd(s,type,payload={},values){const rolls=[];if(values)s._override={index:0,values};const result=a.apply(s,{type,payload},rolls);delete s._override;return {result,rolls};}
test('commission is unavailable for ordinary non-military careers, with the same validator reason',()=>{
 for(const id of ['core.scout','core.merchant','companion.truther','aslan.envoy']){const s=fixture(id),option=a.commissionAvailability(s);assert.equal(option.available,false);assert.match(option.reason,/does not offer/);assert.throws(()=>cmd(s,'commission'),e=>e.message===option.reason);}
});
for(const [field,value,reason]of[['officer',true,/already holds/],['commissionTried',true,/already been attempted/],['commissionBlockedFirstTerm',true,/academy/]])test('commission availability respects '+field,()=>{
 const s=fixture();s.character.careers[0][field]=value;const option=a.commissionAvailability(s);assert.equal(option.available,false);assert.match(option.reason,reason);assert.throws(()=>cmd(s,'commission'),reason);
});
test('later commissions require SOC9, while first-term missing SOC routes to source resolution',()=>{
 const later=fixture('core.army',1);later.character.stats.SOC=8;assert.equal(a.commissionAvailability(later).available,false);assert.throws(()=>cmd(later,'commission'),/SOC 9/);
 const first=fixture();delete first.character.stats.SOC;assert.deepEqual(a.commissionAvailability(first),{available:true,reason:'The missing SOC check requires explicit source resolution.',sourceRequired:true,automatic:false});
 cmd(first,'commission');assert.equal(first.pending.kind,'missing-characteristic-check');assert.equal(first.character.careers[0].commissionTried,undefined);
 cmd(first,'resolve-book',{confirmed:true,note:'Referee resolved first-term missing-SOC check',checkNatural:8,checkTotal:8});assert.equal(first.character.careers[0].officer,true);
 delete later.character.stats.SOC;assert.equal(a.commissionAvailability(later).available,false);
});
test('automatic first-term commission does not invent a missing SOC check',()=>{
 const s=fixture();delete s.character.stats.SOC;s.character.careers[0].automaticCommission=true;assert.equal(a.commissionAvailability(s).automatic,true);assert.equal(a.commissionAvailability(s).sourceRequired,false);cmd(s,'commission');assert.equal(s.character.careers[0].officer,true);
});
test('Zhodani commission projection enforces status and draft term rules',()=>{
 const s=fixture('zhodani.navy');s.character.stats.SOC=9;assert.equal(a.commissionAvailability(s).available,false);s.character.stats.SOC=10;s.character.careers[0].drafted=true;assert.equal(a.commissionAvailability(s).available,false);
 s.character.careers[0].terms=1;const option=a.commissionAvailability(s);assert.equal(option.available,true);assert.equal(option.automatic,true);cmd(s,'commission');assert.equal(s.character.careers[0].officer,true);
});
test('public advancement projection does not advertise Commission for Merchant',()=>{
 let r=run(createSession('benefit-public-1'),'setup',{species:'human'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'background',{skills:['Admin','Animals','Art']});r=run(r,'skip-precareer');r=run(r,'career',{id:'core.merchant',assignment:'marine'});r=run(r,'survival');r=run(r,'choose-effect',{index:0});
 assert.equal(r.state.stage,'advancement');assert.equal(r.state.commissionAvailability.available,false);assert.match(r.state.commissionAvailability.reason,/does not offer/);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('Following interaction bands are separate from characteristic DMs and absent FOL is null',()=>{
 assert.equal(a.followingInteractionDM(undefined),null);for(const [score,dm]of[[0,0],[3,0],[4,1],[6,1],[7,2],[9,2],[10,3],[12,3],[13,4],[15,4]])assert.equal(a.followingInteractionDM(score),dm);
 let r=run(createSession('following-dm'),'setup',{species:'human'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');assert.equal(r.state.followingInteractionDM,null);r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-override',{field:'stat.FOL',value:13,reason:'Source threshold regression'});assert.equal(r.state.followingInteractionDM,4);assert.equal(r.state.statDMs.FOL,2);
 const s=fixture('companion.truther');s.character.stats.FOL=15;a.queueEffects(s,[{kind:'stat',name:'FOL',value:1}],'advancement',[]);assert.equal(s.character.stats.FOL,15,'Existing maximum remains unchanged.');
});
test('early native Aslan exit distinguishes retirement from transfer and keeps the decision',()=>{
 const s=fixture('aslan.military',1);s.stage='term-end';const options=a.exitOptions(s);assert.equal(options.canLeave,false);assert.equal(options.canRetire,true);assert.equal(options.retirementRequired,true);assert.equal(options.canContinue,true);
 assert.throws(()=>cmd(s,'leave-career'),/three terms/);cmd(s,'leave-career',{retire:true});assert.equal(s.stage,'benefits');assert.equal(s.character.retirementFromCreation,true);assert.equal(s.character.careers[0].retiredFromCreation,true);assert.equal(s.character.retirementDecision.source.page,22);
 cmd(s,'benefit',{cash:false},[1]);assert.equal(s.stage,'retirement');assert.equal(s.active,null);assert.ok(a.availableCareers(s).every(c=>c.disabled));assert.throws(()=>cmd(s,'career',{id:'aslan.envoy',assignment:'duellist'}),/start of a term/);assert.throws(()=>cmd(s,'open-precareer'),/Education/);assert.throws(()=>cmd(s,'begin-psionic-training'),/between careers/);cmd(s,'finish');assert.equal(s.stage,'finish');
});
test('early retirement waits for typed equipment and resumes retirement after medical source correction',()=>{
 const s=fixture('aslan.military',1);s.stage='term-end';s.character.stats.SOC=8;s.character.cash=-1;s.character.debt=700;s.character.medicalBills=[{id:'bill1',personalCost:5000,settled:false,paid:0,debt:0}];
 cmd(s,'leave-career',{retire:true});cmd(s,'benefit',{cash:false},[4]);assert.equal(s.stage,'book-step');assert.equal(s.pending.kind,'benefit-equipment');assert.equal(s.character.careers[0].benefitRolls,1);
 cmd(s,'resolve-book',{confirmed:true,note:'Verified source weapon and restrictions',benefitItemName:'Service pistol',benefitItemCost:1000,benefitItemTL:10,benefitWeaponSkill:'Gun Combat (slug)'});assert.equal(s.stage,'retirement');assert.equal(s.character.assets.length,1);
 cmd(s,'finish');assert.equal(s.pending.kind,'medical-settlement');cmd(s,'resolve-book',{confirmed:true,note:'Source correction supplies the missing final cash',effects:[{kind:'cash',value:5001}]});assert.equal(s.stage,'retirement');assert.ok(a.availableCareers(s).every(c=>c.disabled));
 cmd(s,'finish');assert.equal(s.stage,'finish');assert.equal(s.character.cash,0);assert.equal(s.character.debt,700);assert.equal(s.character.medicalSettlements.length,1);assert.equal(s.character.medicalBills[0].settled,true);
});
test('early retirement with no benefit rolls goes directly to retirement rather than another career',()=>{
 const s=fixture('aslan.envoy',2);s.stage='term-end';s.character.careers[0].benefitRolls=0;cmd(s,'leave-career',{retire:true});assert.equal(s.stage,'retirement');assert.equal(s.active,null);cmd(s,'finish');assert.equal(s.stage,'finish');
});
for(const id of ['aslan.outcast','aslan.outlaw'])test(id+' retains its explicit transfer exception',()=>{
 const s=fixture(id,1);s.stage='term-end';assert.equal(a.exitOptions(s).canLeave,true);assert.equal(a.exitOptions(s).canRetire,false);cmd(s,'leave-career');assert.equal(s.character.retirementFromCreation,undefined);
});
test('three terms permit normal Aslan transfer and forced exit does not force creation retirement',()=>{
 for(const [terms,forcedExit]of[[3,false],[1,true]]){const s=fixture('aslan.military',terms);s.stage='term-end';s.character.careers[0].forcedExit=forcedExit;assert.equal(a.exitOptions(s).canLeave,true);cmd(s,'leave-career');assert.equal(s.character.retirementFromCreation,undefined);}
});
test('Imperial Aslan in Core careers do not inherit the native three-term transfer restriction',()=>{
 const s=fixture('core.army',1);s.character.species='aslan';s.character.culture='imperial';s.stage='term-end';assert.equal(a.exitOptions(s).canLeave,true);assert.equal(a.exitOptions(s).retirementRequired,false);cmd(s,'leave-career');assert.equal(s.character.retirementFromCreation,undefined);
});
test('natural12 forced stay blocks both ordinary exit and early retirement',()=>{
 const s=fixture('aslan.military',1);s.stage='term-end';s.character.careers[0].forcedStay=true;const options=a.exitOptions(s);assert.equal(options.canLeave,false);assert.equal(options.canRetire,false);assert.equal(options.canContinue,true);assert.throws(()=>cmd(s,'leave-career',{retire:true}),/natural 12/);cmd(s,'continue-career');assert.equal(s.stage,'training');
});
test('Prisoner parole or escape is required before voluntary exit',()=>{
 const s=fixture('core.prisoner',1);s.stage='term-end';assert.equal(a.exitOptions(s).canLeave,false);assert.equal(a.exitOptions(s).canRetire,false);assert.throws(()=>cmd(s,'leave-career'),/parole/);s.character.careers[0].released=true;assert.equal(a.exitOptions(s).canLeave,true);
});
test('required next career cannot be bypassed through an early-retirement request',()=>{
 const s=fixture('aslan.military',1);s.stage='term-end';s.forcedCareer='aslan.outcast';assert.equal(a.exitOptions(s).canRetire,false);assert.throws(()=>cmd(s,'leave-career',{retire:true}),/required next career/);
});
test('availability outside its active stage is false without requiring an active career',()=>{
 const s=a.initial('no-active');assert.equal(a.commissionAvailability(s).available,false);assert.equal(a.exitOptions(s).canLeave,false);assert.equal(a.exitOptions(s).canContinue,false);
});
