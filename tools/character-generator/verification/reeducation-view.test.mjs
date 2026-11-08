import test from 'node:test';
import assert from 'node:assert/strict';
import {reeducationView,readReeducationDecisions,reeducationSheet,formatCharacterAge} from '../gui/reeducation-view.mjs';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const view=state=>reeducationView(state,{esc,button:(label,action,cls='',attributes='')=>'<button data-action="'+action+'" '+attributes+'>'+label+'</button>',sourceLabel:(source,page)=>source+' p. '+page});
const base={stage:'reeducation-decisions',currentReeducation:{source:{id:'aliens',page:276},roll:{die:1,modifier:-2,total:-1},plan:{row:null}},reeducationRequirements:[]};
test('re-education shows the original roll and only requested source decisions',()=>{
 const html=view({...base,reeducationRequirements:[{key:'rowOverride',rows:[1,2,3,4,5,6]}]});assert.match(html,/1 − 2 = -1/);assert.match(html,/data-reeducation-decision="rowOverride"/);assert.doesNotMatch(html,/data-reeducation-decision="duration"/);assert.match(html,/<option value="">Choose from the source ruling/);assert.doesNotMatch(html,/<option[^>]* selected/);
});
test('timed choices are explicit and do not choose a chronology or duration by default',()=>{
 const html=view({...base,reeducationRequirements:[{key:'duration'},{key:'chronology',options:['before-resume','after-current-term']}]});assert.match(html,/step="any"/);assert.match(html,/After the current career term/);assert.match(html,/Before resuming the event/);assert.doesNotMatch(html,/<option[^>]* selected/);assert.match(html,/Referee reason/);
});
test('roll and fine stages have engine-roll buttons rather than editable dice',()=>{
 assert.match(view({...base,stage:'reeducation-roll'}),/data-action="reeducation-roll"/);assert.match(view({...base,stage:'reeducation-fine'}),/data-action="reeducation-fine"/);assert.doesNotMatch(view({...base,stage:'reeducation-fine'}),/<input/);
});
test('unknown requirements fail closed and projected strings stay escaped',()=>{
 const html=view({...base,currentReeducation:{...base.currentReeducation,source:{id:'<script>bad</script>',page:276}},reeducationRequirements:[{key:'future-decision'}]});assert.match(html,/disabled/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});
test('decision reading submits only present typed fields without invented defaults',()=>{
 const fields=[['duration','0.5','Referee specifies two weeks approximately'],['chronology','after-current-term','Campaign timing ruling']].map(([key,value,reason])=>({dataset:{reeducationDecision:key},querySelector:selector=>({value:selector.includes('reason')?reason:value})}));const payload=readReeducationDecisions({querySelectorAll:()=>fields});assert.deepEqual(payload,{duration:{months:0.5,reason:'Referee specifies two weeks approximately'},chronology:{mode:'after-current-term',reason:'Campaign timing ruling'}});assert.equal(payload.rowOverride,undefined);
});

test('history preserves source rulings and distinguishes treatment from benefit awards',()=>{
 const state={character:{reeducations:[{status:'completed',origin:{careerId:'zhodani.agent'},roll:{die:1,modifier:-1,total:0},plan:{durationMonths:0,benefitRolls:1},decisions:{rowOverride:{row:6,reason:'Referee <decision>'}}}]}};
 const html=reeducationSheet(state,{esc,careerName:id=>id});assert.match(html,/result 0/);assert.match(html,/Referee-selected row 6/);assert.match(html,/Additional benefit roll: 1/);assert.match(html,/Referee &lt;decision&gt;/);assert.doesNotMatch(html,/No additional career term credit/);
});

test('fractional treatment age is readable without changing the stored number',()=>{
 assert.equal(formatCharacterAge(26),'26');assert.equal(formatCharacterAge(26.5),'26y 6m');assert.equal(formatCharacterAge(26.041666667),'26y 0.5m');assert.equal(formatCharacterAge(27.000000001),'27');assert.match(formatCharacterAge(26.123456789),/^≈ 26y /);
});

test('unperformed deferred treatment is not displayed as elapsed treatment',()=>{
 const html=reeducationSheet({character:{reeducations:[{status:'deceased',completion:{cause:'death-before-treatment'},plan:{durationMonths:48},timeline:null}]}},{esc,careerName:()=>''});assert.match(html,/Treatment did not start/);assert.doesNotMatch(html,/Treatment duration: 48/);
});
