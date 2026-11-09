import test from 'node:test';
import assert from 'node:assert/strict';
import {prisonerLawyerView,prisonerLawyerPayload,syncPrisonerLawyerControls} from '../gui/prisoner-lawyer-view.mjs';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function fields(){
 const nodes={'#lawyer-outcome':{value:''},'#lawyer-level':{value:'5',disabled:true},'#lawyer-zero':{checked:true,disabled:true},'#lawyer-reason':{value:'Referee confirms the source result.',disabled:true},'#lawyer-hire-fields':{hidden:true}};
 nodes['#lawyer-zero-fields']={hidden:true,querySelectorAll:()=>[nodes['#lawyer-zero'],nodes['#lawyer-reason']]};
 return {nodes,query:id=>nodes[id]};
}
test('lawyer view starts with irrelevant fields hidden and disabled, without changing its decision contract',()=>{
 const html=prisonerLawyerView({pending:{lawyerId:'<pending>'},character:{cash:25000}},{esc,button:(text,action)=>'<button data-action="'+action+'">'+text+'</button>'});
 assert.match(html,/data-lawyer-id="&lt;pending&gt;"/);assert.match(html,/id="lawyer-hire-fields" hidden/);assert.match(html,/id="lawyer-level"[^>]*disabled/);assert.match(html,/id="lawyer-zero-fields" hidden/);assert.match(html,/id="lawyer-zero"[^>]*disabled/);assert.match(html,/id="lawyer-reason"[^>]*disabled/);
 for(const text of ['Core Update 2022, p. 57','Cr1,000 × Advocate level squared','This does not itself release you','No loan, subsidy or outside funding','level-0 lawyer needs a referee ruling','resolve-prisoner-lawyer'])assert.ok(html.includes(text),text);
});
test('only Hire exposes level, and only exact zero exposes the referee ruling',()=>{
 const {nodes:n,query:q}=fields();syncPrisonerLawyerControls(q);assert.equal(n['#lawyer-hire-fields'].hidden,true);assert.equal(n['#lawyer-level'].disabled,true);
 n['#lawyer-outcome'].value='hire';syncPrisonerLawyerControls(q);assert.equal(n['#lawyer-hire-fields'].hidden,false);assert.equal(n['#lawyer-level'].disabled,false);assert.equal(n['#lawyer-zero-fields'].hidden,true);assert.equal(n['#lawyer-reason'].disabled,true);
 for(const value of ['',' ','1','-1','invalid']){n['#lawyer-level'].value=value;syncPrisonerLawyerControls(q);assert.equal(n['#lawyer-zero-fields'].hidden,true,value);}
 n['#lawyer-level'].value='0';syncPrisonerLawyerControls(q);assert.equal(n['#lawyer-zero-fields'].hidden,false);assert.equal(n['#lawyer-zero'].disabled,false);assert.equal(n['#lawyer-reason'].disabled,false);
});
test('hiding and reopening lawyer controls preserves values and sends only applicable fields',()=>{
 const {nodes:n,query:q}=fields();n['#lawyer-outcome'].value='hire';n['#lawyer-level'].value='0';syncPrisonerLawyerControls(q);
 const expected={outcome:'hire',level:0,zeroLevelConfirmed:true,reason:'Referee confirms the source result.'};assert.deepEqual(prisonerLawyerPayload(q),expected);
 n['#lawyer-outcome'].value='decline';syncPrisonerLawyerControls(q);assert.equal(n['#lawyer-hire-fields'].hidden,true);assert.equal(n['#lawyer-zero-fields'].hidden,true);assert.equal(n['#lawyer-zero'].disabled,true);assert.deepEqual(prisonerLawyerPayload(q),{outcome:'decline'});
 n['#lawyer-outcome'].value='hire';syncPrisonerLawyerControls(q);assert.deepEqual(prisonerLawyerPayload(q),expected);assert.equal(n['#lawyer-zero-fields'].hidden,false);
 n['#lawyer-level'].value='5';syncPrisonerLawyerControls(q);assert.deepEqual(prisonerLawyerPayload(q),{outcome:'hire',level:5});assert.equal(n['#lawyer-zero'].checked,true);assert.equal(n['#lawyer-reason'].value,expected.reason);
 n['#lawyer-level'].value='0';syncPrisonerLawyerControls(q);assert.deepEqual(prisonerLawyerPayload(q),expected);
 assert.doesNotThrow(()=>syncPrisonerLawyerControls(()=>null));
});
