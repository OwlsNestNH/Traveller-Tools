import test from 'node:test';
import assert from 'node:assert/strict';
import {coreLifeEventView,coreLifeEventPayload,coreLifeEventSheet,coreLifeBenefitView} from '../gui/core-life-event-view.mjs';
import {lifeFixture} from './core-life-event-fixtures.mjs';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const ui={esc,button:(label,action)=>'<button data-action="'+action+'">'+label+'</button>',sourceLabel:(id,page)=>id+' p. '+page,careerName:id=>id};
test('typed forms and printed ledger escape character input and expose no generic effects',()=>{
 for(const row of [3,4,8,11]){const s=lifeFixture({row}).state;const html=coreLifeEventView(s,ui);assert.match(html,/resolve-life-event/);assert.doesNotMatch(html,/add-effect|resolve-book/);}
 const s=lifeFixture({row:3}).state;s.character.lifeEvents[0].decision={kind:'narrative',reason:'<script>unsafe</script>',outcome:'birth'};assert.doesNotMatch(coreLifeEventSheet(s,ui),/<script>/);assert.match(coreLifeEventSheet(s,ui),/&lt;script&gt;/);
});
test('testing payload omits inactive fields on decline and source-provided testing requires explicit confirmation',()=>{
 const state={pending:{decision:'psionics'}},fields={'#life-outcome':{value:'decline'},'#life-reason':{value:'Original decision'},'#life-confirm':{checked:true},'#life-funding':{value:'provided'},'#life-cost':{value:'0'},'#life-timing':{checked:true},'#life-referee':{checked:false}},query=id=>fields[id];
 assert.deepEqual(coreLifeEventPayload(state,query),{outcome:'decline',confirmed:true,reason:'Original decision'});fields['#life-outcome'].value='test';assert.equal(coreLifeEventPayload(state,query).confirmed,false);fields['#life-referee'].checked=true;assert.deepEqual(coreLifeEventPayload(state,query),{outcome:'test',confirmed:true,reason:'Original decision',funding:'provided',cost:0,timingConfirmed:true});
});
test('optional Benefit bonuses remain opt-in and consumed bonuses are absent',()=>{
 const html=coreLifeBenefitView({character:{lifeBenefitBonuses:[{id:'a',value:2,status:'available'},{id:'b',value:2,status:'consumed'}]}},ui);assert.match(html,/value="a"/);assert.doesNotMatch(html,/value="b"| checked/);
});
