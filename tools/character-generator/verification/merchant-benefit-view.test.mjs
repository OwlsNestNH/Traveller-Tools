import test from 'node:test';
import assert from 'node:assert/strict';
import {exportSession,importSession,project} from '../engine/session.mjs';
import {conciseResult,latestResultView} from '../gui/concise-result.mjs';
import {fullActionLog} from '../gui/log-download.mjs';
import {merchantBenefitFixture} from './merchant-benefit-fixtures.mjs';
import {run,settleAssignment} from './assignment-fixtures.mjs';
test('Merchant Broker event 10 projects source prose while preserving old summary, dice and save',()=>{
 const {after:r}=merchantBenefitFixture(),event=r.log.at(-1),raw=exportSession(r.session),log=fullActionLog(r.log);
 assert.equal(event.summary,'Career event result 10. Resolve benefit credit.');
 assert.equal(event.eventResults[0].row,10);
 const result=conciseResult(event,r.state,{});
 assert.equal(result.title,'A profitable deal lets you live well for a few years.');
 assert.match(result.text,/\+1 to one future Benefit roll\./);
 assert.doesNotMatch(result.text,/neither money|Advancement below|p\. 35/);
 const information=result.information.paragraphs.join(' ');assert.match(information,/neither money nor an extra roll/);assert.match(information,/Advancement below/);assert.match(information,/p\. 35/);
 assert.doesNotMatch(result.text,/Resolve benefit credit|Benefit credit value|Benefit credit: available/);
 assert.match(result.full.text,/Resolve benefit credit/);
 const html=latestResultView(result,{esc:String});assert.match(html,/data-result-information/);assert.doesNotMatch(html,/<details|Resolve benefit credit/);
 assert.equal(exportSession(importSession(raw)),raw);assert.deepEqual(project(importSession(raw)).log,r.log);
 assert.equal(fullActionLog(r.log),log);assert.match(log,/Resolve benefit credit/);
 let next=settleAssignment(run(r,'advancement'));assert.equal(next.state.character.benefitCredits[0].status,'available');
 assert.equal(exportSession(r.session),raw);
});
test('shared credit presentation preserves scope, signed amounts and unrelated outcomes in both delta shapes',()=>{
 for(const scope of ['any','career'])for(const value of [1,2,-1])for(const leaf of [false,true]){
  const credit={id:'credit-1',value,scope,status:'available',originCareerId:'core.agent'};
  const changes=leaf?Object.entries(credit).map(([field,after])=>({path:'benefitCredits.0.'+field,before:null,after})):[{path:'benefitCredits.0',before:null,after:credit}];
  const event={type:'career-event',summary:'Recorded event.',changes:[...changes,{path:'cash',before:0,after:100}],eventResults:[{title:'Agent event',roll:{values:[2,2],total:4},summary:'Resolve benefit credit. Admin +1.',description:'Recorded source context.'}]};
  const result=conciseResult(event,{stage:'advancement'},{careers:[{id:'core.agent',name:'Agent'}]});
  assert.ok(result.text.includes((value>=0?'+':'')+value+' to one future Benefit roll from '+(scope==='any'?'any career':'this career (Agent)')));
  assert.match(result.text,/Admin \+1/);assert.match(result.text,/Cash: Cr0 → Cr100/);assert.match(result.text,/Recorded source context/);
 }
});
test('consumption and expired or incomplete credits do not claim a new saved bonus',()=>{
 for(const changes of [[{path:'benefitCredits.0.status',before:'available',after:'consumed'}],[{path:'benefitCredits.0',before:null,after:{status:'expired',value:1,scope:'any'}}],[{path:'benefitCredits.0.value',before:null,after:1}]]){
  const result=conciseResult({type:'benefit',summary:'Recorded benefit.',changes},{},{});assert.doesNotMatch(result.text,/The bonus is saved/);
 }
});
