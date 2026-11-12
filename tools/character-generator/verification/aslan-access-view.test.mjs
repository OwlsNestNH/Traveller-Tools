import test from 'node:test';
import assert from 'node:assert/strict';
import {characterChanges} from '../engine/audit.mjs';
import {aslanAccessSelection,aslanAccessPayload,aslanAccessView,aslanAccessSheet,cashRollDisplay,aslanAccessConflictView,fallbackView} from '../gui/aslan-access-view.mjs';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const context={esc,button:(name,action,cls='',attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+name+'</button>',sourceLabel:(id,page)=>id+' p'+page,careerName:id=>id};
const route={id:'r1',name:'Source <route>',available:true,reason:'',source:{id:'aliens',page:35},automatic:true,mandatory:false,availableAtCompletedTerms:1,status:'offered'};
const state={character:{},aslanAccessRules:{destinationMaxLength:160},aslanAccessOptions:[route]};
test('access selection and payload preserve explicit choice and confirmation only',()=>{
 assert.equal(aslanAccessSelection(state,'r1'),route);assert.equal(aslanAccessSelection(state,'missing'),null);
 assert.deepEqual(aslanAccessPayload({routeId:'r1',destination:'World',confirmed:false,culture:'imperial',years:4}),{routeId:'r1',destination:'World',confirmed:false});
});
test('access form uses API bounds, starts unselected and disabled, and escapes route labels',()=>{
 const html=aslanAccessView(state,context);assert.match(html,/&lt;route&gt;/);assert.match(html,/maxlength="160"/);assert.doesNotMatch(html,/<route>|\schecked(?:\s|>|=)/);assert.match(html,/Choose a route/);assert.match(html,/data-action="activate-aslan-access" disabled/);assert.match(html,/does not simulate travel or advance time/);
 assert.equal(aslanAccessView({character:{},aslanAccessOptions:[]},context),'');
});
test('outside context remains visible without an unconsumed opportunity',()=>{
 const html=aslanAccessView({character:{aslanCareerContext:{destination:'<World>'}},aslanAccessOptions:[]},context);assert.match(html,/&lt;World&gt;/);assert.match(html,/Native upbringing remains unchanged/);assert.doesNotMatch(html,/id="aslan-access-route"/);
});
test('benefit view uses the selected account, not total prior native cash rolls',()=>{
 const core=cashRollDisplay({cashRolls:9,cashRollsUsed:2,cashRollAccount:'core',cashLimit:3,cashRollAccounting:{name:'Core lifetime cash rolls',used:2}});assert.deepEqual(core,{used:2,limit:3,label:'Core lifetime cash rolls',disabled:false});
 assert.equal(cashRollDisplay({cashRolls:10,cashRollsUsed:3,cashRollAccount:'core',cashLimit:3}).disabled,true);
 assert.equal(cashRollDisplay({cashRolls:7,cashRollsUsed:7,cashRollAccount:'aslan',cashLimit:999}).disabled,false);
 assert.deepEqual(cashRollDisplay({cashRolls:3,cashLimit:3}),{used:3,limit:3,label:'Cash rolls used across all careers',disabled:true});
});
test('access sheet shows actual route status, context, attempt and expiry without invented travel',()=>{
 const html=aslanAccessSheet({character:{aslanCareerContext:{destination:'Other <world>'},aslanCareerAccess:[{...route,status:'consumed',activation:{destination:'Other <world>'},attempt:{careerId:'core.scholar',assignment:'scientist'},expiry:{reason:'next-term-window-ended'},conflictDecision:{reason:'Recorded <ruling>'}}]}},context);
 assert.match(html,/Status: consumed/);assert.match(html,/core.scholar/);assert.match(html,/next term window ended/);assert.match(html,/&lt;world&gt;/);assert.match(html,/&lt;ruling&gt;/);assert.doesNotMatch(html,/<world>|<ruling>/);
});
test('timing conflict has no default, requires GM, and displays only projected choices',()=>{
 const p={reason:'Source <conflict>',source:[{id:'aliens',page:41},{id:'core',page:19}],reasonMaxLength:500,choices:[{id:'honor-expedition',name:'Honor expedition'}]};
 const html=aslanAccessConflictView({config:{gm:false},aslanAccessConflict:p},context);assert.match(html,/&lt;conflict&gt;/);assert.match(html,/Choose a decision/);assert.match(html,/maxlength="500"/);assert.match(html,/Enable GM mode/);assert.match(html,/id="aslan-access-decision" disabled/);assert.doesNotMatch(html,/<option[^>]*\sselected(?:\s|>|=)/);assert.equal(aslanAccessConflictView({},context),'');
});

test('access audit retains source scope, actual attempts, context and separate cash accounts',()=>{
 const before={stats:{},skills:{},careers:[],aslanCareerAccess:[]},after={...before,aslanCareerAccess:[{...route,careerIds:['core.scholar'],activation:{destination:'World'},attempt:{careerId:'core.scholar',success:true},expiry:null,conflictDecision:null}],aslanCareerContext:{region:'outside-aslan-space',status:'established',accessId:'r1',destination:'World',careerIds:['core.scholar'],source:{id:'aliens',page:35},scopeLabel:'Derived label'},cashRollAccounts:{aslan:4,core:1},careers:[{id:'core.scholar',aslanOutsideRules:{benefitSystem:'core'}}]};
 const changes=characterChanges(before,after);for(const path of ['aslanCareerAccess.0.careerIds','aslanCareerAccess.0.activation','aslanCareerAccess.0.attempt','aslanCareerContext.destination','aslanCareerContext.careerIds','cashRollAccounts','careers.0.aslanOutsideRules'])assert.ok(changes.some(c=>c.path===path),path);
 assert.ok(changes.every(c=>!c.path.endsWith('scopeLabel')));
});

test('fallback UI uses only projected route and draft permissions',()=>{
 const native=fallbackView({fallbackOptions:{normal:{name:'Continue as a Drifter',available:true,reason:''},draft:{name:'Enter draft',available:false,reason:'No second attempt in this term.'}}},context);assert.match(native,/Continue as a Drifter/);assert.match(native,/data-action="draft" disabled/);assert.match(native,/No second attempt/);
 const core=fallbackView({fallbackOptions:{normal:{name:'Continue as a Drifter',available:true,reason:''},draft:{name:'Enter draft',available:true,reason:''}}},context);assert.doesNotMatch(core,/data-action="draft" disabled/);assert.match(fallbackView({},context),/Preserve the current save/);
});

test('career access record hides internal route identity while preserving actual status',()=>{
 const html=aslanAccessSheet({character:{aslanCareerAccess:[{...route,id:'aslan-access-472',name:'Scholar opportunity'}]}},context);assert.match(html,/Scholar opportunity/);assert.match(html,/Status: offered/);assert.doesNotMatch(html,/aslan-access-472/);
});
