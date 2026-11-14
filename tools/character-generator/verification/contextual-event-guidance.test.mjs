import test from 'node:test';import assert from 'node:assert/strict';
import {api,exportSession,project} from '../engine/session.mjs';
import {conciseResult,latestResultView} from '../gui/concise-result.mjs';
import {recordedConsequenceCheck} from '../gui/check-outcome.mjs';
import {contextualGuidanceFixtures} from './contextual-event-guidance-fixtures.mjs';
const catalog=api({operation:'catalog'});
test('contextual choices and recorded followup checks keep one pictured speaker without changing accepted evidence',()=>{for(const {name,fixture:r}of contextualGuidanceFixtures()){
 const e=r.log.at(-1),raw=exportSession(r.session),result=conciseResult(e,r.state,catalog);assert.equal(result.information.retainCrow,true,name);
 assert.equal((latestResultView(result,{esc:String,tagline:'Crow commentary',crowType:'agent'}).match(/crow-speaking-panel/g)??[]).length,1,name);
 assert.ok(result.full.details.every(x=>result.information.paragraphs.includes(x)),name+' full details remain available');
 assert.doesNotMatch(result.text,/Table outcome:|Source:|Pending:|EDU check result 12\. 12/);
 assert.equal(exportSession(r.session),raw);assert.deepEqual(project(r.session).state,r.state);
}});
test('success and failure come from the recorded applied check, never the earlier event number',()=>{for(const {name,fixture:r}of contextualGuidanceFixtures().filter(x=>['specialist-success','specialist-failure'].includes(x.name))){
 const e=r.log.at(-1),check=recordedConsequenceCheck(e),result=conciseResult(e,r.state,catalog);assert.ok(check);assert.equal(result.status,check.success?'success':'failure');assert.equal(result.title,'EDU check '+(check.success?'succeeded.':'failed.'));assert.ok(result.text.includes('Total '+check.total+' against '+check.target+'+.'));assert.equal(check.success,name==='specialist-success');
 if(check.success)assert.match(result.text,/Choose one existing skill to improve by 1/);else assert.doesNotMatch(result.text,/Choose one existing skill/);
 const invalid=structuredClone(e);invalid.rolls[0].total++;assert.equal(recordedConsequenceCheck(invalid),null);assert.notEqual(conciseResult(invalid,r.state,catalog).title,result.title);
}});
