import test from 'node:test';
import assert from 'node:assert/strict';
import {coverCheckInstruction,crossCareerCoverView,crossCareerTrainingView,crossCareerRouteSheet} from '../gui/cross-career-view.mjs';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const context={esc,button:(label,action,cls='',attributes='')=>'<button data-action="'+action+'" '+attributes+'>'+label+'</button>',sourceLabel:(id,page)=>id+' p. '+page,careerName:id=>({'zhodani.prole':'Prole','zhodani.agent':'Agent'}[id]??id)};
test('borrowed training uses only authoritative named assignment choices',()=>{const html=crossCareerTrainingView({currentCrossCareerTraining:{sourceCareerId:'zhodani.prole',originCareerId:'zhodani.agent',source:{id:'aliens',page:259},options:[{id:'worker',name:'Worker'},{id:'colonist',name:'Colonist'}]}},context);assert.match(html,/data-assignment="worker"/);assert.match(html,/data-assignment="colonist"/);assert.match(html,/Extra training from <strong>Prole/);assert.match(html,/Current career: Agent/);assert.doesNotMatch(html,/data-action="career"/);});
test('missing or empty borrowed training projection fails closed',()=>{for(const state of [{},{currentCrossCareerTraining:{options:[]}}]){const html=crossCareerTrainingView(state,context);assert.match(html,/unavailable/);assert.doesNotMatch(html,/<button/);}});
test('borrowed training labels and identifiers are escaped',()=>{const html=crossCareerTrainingView({currentCrossCareerTraining:{sourceCareerId:'<career>',originCareerId:'<origin>',options:[{id:'"bad',name:'<name>'}]}},context);assert.match(html,/&lt;career&gt;/);assert.match(html,/&lt;name&gt;/);assert.match(html,/&quot;bad/);assert.doesNotMatch(html,/<career>|<name>/);});


test('borrowed route history keeps original career and rolled table identities separate',()=>{
 const html=crossCareerRouteSheet({character:{crossCareerRoutes:[{originCareerId:'zhodani.agent',status:'completed',check:{total:9,target:8},tables:[{careerId:'zhodani.prole',table:'event',row:2},{careerId:'zhodani.prole',table:'mishap',row:4}],training:{careerId:'zhodani.prole',assignment:'<worker>',die:3}}]}},context);
 assert.match(html,/Agent \/ completed/);assert.match(html,/Prole \/ event result 2/);assert.match(html,/Prole \/ mishap result 4/);assert.match(html,/&lt;worker&gt;/);assert.doesNotMatch(html,/<worker>/);
});

for(const origin of ['core.agent','vargr.agent'])test(origin+' cover action explicitly includes its unchanged Deception check',()=>{
 const state={stage:'cross-career-cover',currentCrossCareerCover:{originCareerId:origin,source:{id:'core',page:23},options:[{id:'core.citizen',name:'<Citizen>'}]}};
 const before=JSON.stringify(state),html=crossCareerCoverView(state,context),instruction=coverCheckInstruction(state);
 assert.match(html,/&lt;Citizen&gt; — Roll Deception 8\+/);assert.match(html,/data-career="core.citizen"/);assert.match(instruction,/failure gives a cover mishap/);
 if(origin==='core.agent'){assert.match(instruction,/cover event and extra training/);assert.doesNotMatch(instruction,/DM \+2/);}else{assert.match(instruction,/DM \+2 on your next advancement/);assert.doesNotMatch(instruction,/cover event/);}
 assert.doesNotMatch(html,/Try looking employed/);assert.match(html,/class="cover-check-instruction"/);assert.ok(html.includes(instruction));assert.equal(JSON.stringify(state),before);
});
test('cover clarification does not invent a check for another stage or deferred origin',()=>{
 for(const state of [{},{stage:'training',currentCrossCareerCover:{originCareerId:'core.agent',options:[{}]}},{stage:'cross-career-cover',currentCrossCareerCover:{originCareerId:'zhodani.agent',options:[{}]}},{stage:'cross-career-cover',currentCrossCareerCover:{originCareerId:'core.agent',options:[]}}])assert.equal(coverCheckInstruction(state),null);
});
