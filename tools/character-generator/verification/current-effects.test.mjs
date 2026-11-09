import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,exportSession} from '../engine/session.mjs';
import {currentEffects,currentEffectsSheet} from '../gui/current-effects.mjs';
import {laterTermVargrFixture,run} from './survival-result-fixtures.mjs';
import {optionalBenefitFixture} from './optional-benefit-fixtures.mjs';
const data=catalog(),esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const text=state=>currentEffects(state,data).map(r=>r.status+': '+r.label).join('\n');
test('actual Vargr +4 remains on sheet until consumed, without modifying saves or logs',()=>{
 const r=laterTermVargrFixture()[1],saved=exportSession(r.session),before=structuredClone(r.state),log=structuredClone(r.log);
 assert.match(text(r.state),/Available: Vargr Agent.*Advancement DM \+4.*next matching roll/);
 assert.doesNotMatch(text(run(r,'advancement').state),/Advancement DM \+4/);
 assert.deepEqual(r.state,before);assert.deepEqual(r.log,log);assert.equal(exportSession(r.session),saved);
});
for(const vargr of [false,true])test('real '+(vargr?'Vargr':'Core')+' benefit bonus remains visible until spent',()=>{
 const r=optionalBenefitFixture(vargr),credit=r.state.benefitCreditOptions[0];assert.ok(credit);
 assert.match(text(r.state),/Available: .*one benefit roll DM \+1/);
 const next=run(r,'benefit',{cash:true,creditIds:[credit.id]});
 assert.doesNotMatch(text(next.state),/one benefit roll DM/);
});
test('career-independent presentation handles every catalog career without leaking IDs',()=>{
 for(const career of data.careers){
  const state={active:0,modifiers:[{target:'qualification',careerId:career.id,value:2,scope:'all'}],automaticCareers:[career.id],forcedCareer:career.id,character:{careers:[{id:career.id,forcedStay:true,automaticPromotion:true}]}};
  const result=text(state);assert.ok(result.includes(career.name));assert.match(result,/Qualification DM \+2 · ongoing/);assert.match(result,/automatic entry right/);assert.match(result,/another term required/);assert.doesNotMatch(result,new RegExp(career.id.replaceAll('.','\\.')));
 }
});
test('pending source and planned treatment are never described as applied',()=>{
 const state={stage:'book-step',pending:{label:'Confirm employer coverage',source:'core',page:49},character:{injuries:[{tableResult:4,losses:{STR:2,DEX:0,END:0},restoration:{STR:2},completed:false,source:{id:'core',page:49}}]}};
 assert.match(text(state),/Loss recorded; treatment pending: Injury 1 · table result 4 · applied loss: STR -2 · proposed treatment: STR \+2/);
 assert.match(text(state),/Awaiting source resolution; not yet applied: Confirm employer coverage/);
 assert.doesNotMatch(text(state),/restored:/);
 state.character.injuries[0].completed=true;state.character.injuries[0].statsAfterTreatment={STR:8};state.pending=null;
 assert.match(text(state),/Recorded: Injury 1.*restored: STR \+2/);
});
test('light, unresolved and fatal injuries and qualification restriction stay explicit',()=>{
 const result=text({character:{qualificationBanned:true,deceased:true,injuries:[{tableResult:6,completed:true,losses:{STR:0,DEX:0,END:0}},{tableResult:2,completed:false},{tableResult:5,completed:true,deceased:true}]}});
 assert.match(result,/no characteristic loss/);assert.match(result,/Pending: Injury 2.*outcome unresolved/);assert.match(result,/Injury 3.*fatal/);assert.match(result,/qualification checks barred/);assert.match(result,/Traveller is deceased/);
});
test('escaped HTML, empty state and unavailable credit filtering',()=>{
 assert.equal(currentEffectsSheet({},data,{esc}),'');
 const state={stage:'book-step',pending:{label:'<script>unsafe</script>',source:'core',page:49},character:{benefitCredits:[{status:'expired',value:1},{status:'consumed',value:2}]}};
 const html=currentEffectsSheet(state,data,{esc,sourceLabel:(id,page)=>id+' p. '+page});
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|one benefit roll DM/);assert.match(html,/core p. 49/);
});

test('recorded medical and zero-score ruling notes appear as escaped narrative, not new assets',()=>{
 const state={character:{injuries:[{tableResult:2,completed:true,losses:{STR:2},medical:{note:'Referee recorded <replacement limb> care.'},zeroRuling:{note:'Survival approved with <restricted recovery>.'}}]}};
 const before=structuredClone(state),html=currentEffectsSheet(state,data,{esc});
 assert.match(html,/recorded medical note: Referee recorded &lt;replacement limb&gt; care\./);
 assert.match(html,/recorded injury ruling: Survival approved with &lt;restricted recovery&gt;\./);
 assert.doesNotMatch(html,/<replacement limb>|<restricted recovery>/);assert.deepEqual(state,before);assert.equal(state.character.assets,undefined);
});
