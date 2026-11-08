import test from 'node:test';
import assert from 'node:assert/strict';
import {crossCareerTrainingView,crossCareerRouteSheet} from '../gui/cross-career-view.mjs';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const context={esc,button:(label,action,cls='',attributes='')=>'<button data-action="'+action+'" '+attributes+'>'+label+'</button>',sourceLabel:(id,page)=>id+' p. '+page,careerName:id=>({'zhodani.prole':'Prole','zhodani.agent':'Agent'}[id]??id)};
test('borrowed training uses only authoritative named assignment choices',()=>{const html=crossCareerTrainingView({currentCrossCareerTraining:{sourceCareerId:'zhodani.prole',originCareerId:'zhodani.agent',source:{id:'aliens',page:259},options:[{id:'worker',name:'Worker'},{id:'colonist',name:'Colonist'}]}},context);assert.match(html,/data-assignment="worker"/);assert.match(html,/data-assignment="colonist"/);assert.match(html,/Extra training from <strong>Prole/);assert.match(html,/Current career: Agent/);assert.doesNotMatch(html,/data-action="career"/);});
test('missing or empty borrowed training projection fails closed',()=>{for(const state of [{},{currentCrossCareerTraining:{options:[]}}]){const html=crossCareerTrainingView(state,context);assert.match(html,/unavailable/);assert.doesNotMatch(html,/<button/);}});
test('borrowed training labels and identifiers are escaped',()=>{const html=crossCareerTrainingView({currentCrossCareerTraining:{sourceCareerId:'<career>',originCareerId:'<origin>',options:[{id:'"bad',name:'<name>'}]}},context);assert.match(html,/&lt;career&gt;/);assert.match(html,/&lt;name&gt;/);assert.match(html,/&quot;bad/);assert.doesNotMatch(html,/<career>|<name>/);});


test('borrowed route history keeps original career and rolled table identities separate',()=>{
 const html=crossCareerRouteSheet({character:{crossCareerRoutes:[{originCareerId:'zhodani.agent',status:'completed',check:{total:9,target:8},tables:[{careerId:'zhodani.prole',table:'event',row:2},{careerId:'zhodani.prole',table:'mishap',row:4}],training:{careerId:'zhodani.prole',assignment:'<worker>',die:3}}]}},context);
 assert.match(html,/Agent \/ completed/);assert.match(html,/Prole \/ event result 2/);assert.match(html,/Prole \/ mishap result 4/);assert.match(html,/&lt;worker&gt;/);assert.doesNotMatch(html,/<worker>/);
});
