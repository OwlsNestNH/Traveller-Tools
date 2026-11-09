import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {conciseResult,isBasicTrainingChoice,latestResultView} from '../gui/concise-result.mjs';
import {characterEffectDetails} from '../gui/roll-result-view.mjs';
import {fullActionLog} from '../gui/log-download.mjs';
import {qualificationOutcomeFixture} from './check-outcome-fixtures.mjs';
import {laterCareerFixture,treatmentFixture,equipmentFixture} from './concise-result-fixtures.mjs';
const catalog=api({operation:'catalog'}),esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
test('later career entry shows the actual check and new career, not bookkeeping; choice is named accurately',()=>{
 const r=laterCareerFixture().after,result=conciseResult(r.log.at(-1),r.state,catalog),before=exportSession(r.session);
 assert.equal(result.title,'Entered Rogue / Thief.');assert.equal(result.details.length,1);assert.match(result.text,/\[6, 4\].*total 11 against 6\+; succeeded/);assert.doesNotMatch(result.text,/none → 0|Officer commission|Pending:/);assert.equal(isBasicTrainingChoice(r.state),true);
 const html=latestResultView(result,{esc});assert.match(html,/<details class="result-information"><summary><span aria-hidden="true">ⓘ<\/span> Result details/);assert.doesNotMatch(html,/<details[^>]* open/);assert.equal(exportSession(r.session),before);
 const replay=project(importSession(before));assert.deepEqual(conciseResult(replay.log.at(-1),replay.state,catalog),result);
});
test('first-career skill awards are grouped without omitting any skill; qualification failures stay failures',()=>{
 for(const success of [true,false]){const r=qualificationOutcomeFixture(success).after,result=conciseResult(r.log.at(-1),r.state,catalog);assert.equal(result.status,success?'success':'failure');assert.match(result.text,success?/succeeded/:/failed/);if(success){assert.match(result.text,/Basic training: Pilot 0, Vacc Suit 0/);assert.ok(result.details.length<4);}}
});
test('treatment shows restored characteristics and personal bill, not old injury losses again',()=>{
 const r=treatmentFixture().after,result=conciseResult(r.log.at(-1),r.state,catalog);assert.equal(result.title,'Injury treatment complete.');assert.match(result.text,/Strength: 7 → 11/);assert.match(result.text,/Cr20,000 due/);assert.doesNotMatch(result.text,/Injury loss|Treatment restores|Career terms|Completed terms/);assert.match(result.full.text,/Injury loss/);
 const pending=treatmentFixture().before;assert.equal(conciseResult(pending.log.at(-1),pending.state,catalog).compact,false);
});
test('equipment appears once with material ownership, mortgage and redemption restrictions retained',()=>{
 const r=equipmentFixture().after,result=conciseResult(r.log.at(-1),r.state,catalog);assert.equal(result.title,'Received Synthetic weapon.');assert.doesNotMatch(result.text,/Asset:|Benefit:|Benefit award recorded|Owned by Traveller|Benefit rolls/);
 const event={type:'benefit',summary:'Ship award.',changes:[{path:'assets.0',after:{name:'Scout Ship',ownership:'use',owner:'Scout Service',recallable:true,mortgagePaidPercent:25,condition:'Cannot be sold.'}},{path:'benefits.0',after:{name:'Scout Ship',redeemableForCash:false}}]};
 const restricted=conciseResult(event,{},catalog).text;for(const text of ['Use only','Scout Service','recall','25%','Cannot be sold','cannot be redeemed'])assert.ok(restricted.includes(text));
 assert.equal(conciseResult({...event,type:'restore'}, {},catalog).compact,false);
});
test('false initial flags never claim an officer commission or qualification ban was removed',()=>{
 assert.deepEqual(characterEffectDetails({changes:[{path:'careers.0.officer',before:null,after:false},{path:'qualificationBanned',before:null,after:false}]},catalog),[]);
 assert.deepEqual(characterEffectDetails({changes:[{path:'careers.0.officer',before:true,after:false}]},catalog),['Officer commission removed.']);
});
test('troubleshooting download retains every audit action, raw dice and change without mutating the save',()=>{
 const r=equipmentFixture().after,before=exportSession(r.session),text=fullActionLog(r.log);
 for(const e of r.log){assert.ok(text.includes('ACTION '+e.number+' · '+e.summary));for(const roll of e.rolls)assert.ok(text.includes(roll.label+': '+roll.values.join(', ')+'; kept '+roll.kept.join(', ')+'; total '+roll.total));}
 assert.match(text,/assets\.0:/);assert.equal(exportSession(r.session),before);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.ok(html.includes('id="log-download"'));assert.ok(!html.includes('id="action-log"'));assert.ok(!html.includes('class="log-section"'));
});
test('result information escapes free text and does not expose serialized summaries',()=>{
 const result=conciseResult({type:'benefit',summary:'<script>never</script>',changes:[{path:'assets.0',after:{name:'<img src=x>',ownership:'owned'}}]}, {},catalog);
 const html=latestResultView(result,{esc});assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;img/);
});
test('replacement equipment names the trade-in and does not hide unrelated benefit changes',()=>{
 const event={type:'resolve-book',summary:'Replacement confirmed.',changes:[
  {path:'assets.0',before:{id:'old',name:'Cloth Armour',active:true},after:{id:'old',name:'Cloth Armour',active:false}},
  {path:'assets.1',before:null,after:{id:'new',name:'Combat Armour',active:true,replacesAssetId:'old'}},
  {path:'benefits.0',before:{name:'Cloth Armour',assetId:'old'},after:null},
  {path:'benefits.1',before:null,after:{name:'Combat Armour',assetId:'new'}},
  {path:'benefits.2',before:null,after:{name:'Ship Share',quantity:2}},
  {path:'benefits.3',before:{name:'Membership'},after:null}
 ]};
 const result=conciseResult(event,{},catalog);assert.match(result.text,/Received Combat Armour/);assert.match(result.text,/Traded in Cloth Armour/);assert.match(result.text,/Ship Share × 2/);assert.match(result.text,/Removed: Membership/);assert.doesNotMatch(result.text,/Benefit: Combat Armour/);
});
