import test from 'node:test';
import assert from 'node:assert/strict';
import {correctionFields,replaceableRolls,extraCharacteristicsView,gmControlsView,correctionPayload,replacementPayload} from '../gui/character-controls.mjs';
const state={stage:'statistics',pool:[{key:'STR',base:10},{key:'DEX',base:8}],character:{species:'human',stats:{},age:18,cash:0,debt:0},config:{gm:true}};
const helpers={esc:String,options:list=>list.map(x=>'<option value="'+x.id+'">'+x.name+'</option>').join(''),button:(label,action)=>'<button data-action="'+action+'">'+label+'</button>'};
const catalog={extraStats:[{id:'PSI',name:'Psionic strength'},{id:'LCK',name:'Luck'}]};
test('named correction fields carry current values and exact pool indices',()=>{
 const before=structuredClone(state),fields=correctionFields(state);assert.deepEqual(state,before);
 assert.equal(fields[0].name,'STR raw score');assert.equal(fields[0].value,10);assert.equal(fields[0].index,0);assert.equal(fields[1].id,'pool.1');
 assert.equal(fields.find(f=>f.id==='age').value,18);assert.equal(fields.find(f=>f.id==='cash').value,0);
 const aslan={...state,stage:'career',character:{...state.character,species:'aezorgh',stats:{SOC:9,CHA:4}}};
 assert.ok(correctionFields(aslan).some(f=>f.id==='stat.SOC'));assert.ok(!correctionFields(aslan).some(f=>f.id==='stat.CHA'));assert.ok(!correctionFields(aslan).some(f=>f.field==='pool'));
});
test('roll picker exposes only original dice rolls with original revision and roll index',()=>{
 const roll={label:'STR',values:[6,2,3],kept:[6,3],total:9},log=[{number:1,type:'setup',rolls:[]},{number:2,type:'roll-statistics',rolls:[roll,{...roll,label:'DEX'}]},{number:3,type:'gm-mode',rolls:[]},{number:4,type:'gm-replay',rolls:[roll]},{number:5,type:'restore',rolls:[]}];
 const before=structuredClone(log),choices=replaceableRolls(log);assert.deepEqual(log,before);assert.deepEqual(choices.map(r=>r.id),['2:1','2:0']);assert.equal(choices[1].revision,2);assert.equal(choices[1].rollIndex,0);assert.match(choices[0].name,/DEX.*action 2/);assert.equal(choices[1].values.length,3);assert.match(choices[1].name,/\[6, 2, 3\] → keep \[6, 3\] = 9/);
});
test('sidebar tools are absent at setup; extras appear only when usable and omit existing characteristics',()=>{
 assert.equal(extraCharacteristicsView({...state,stage:'identity'},catalog,helpers),'');assert.equal(extraCharacteristicsView(state,catalog,helpers),'');assert.equal(gmControlsView({...state,stage:'identity'},[],helpers),'');
 const started={...state,stage:'background',character:{...state.character,stats:{LCK:8}}};
 const html=extraCharacteristicsView(started,catalog,helpers);assert.match(html,/Add another characteristic/);assert.match(html,/value="PSI"/);assert.doesNotMatch(html,/value="LCK"|GM permission/);
 assert.equal(extraCharacteristicsView({...started,pending:{kind:'core-life-decision'}},catalog,helpers),'');
 assert.equal(extraCharacteristicsView({...started,character:{...started.character,stats:{LCK:8,PSI:7}}},catalog,helpers),'');
 assert.match(extraCharacteristicsView({...started,canStartPsionicTraining:true},catalog,helpers),/Arrange psionic training/);
});
test('GM tools keep explicit enabling and one correction task visible by default',()=>{
 const off=gmControlsView({...state,config:{gm:false}},[],helpers);assert.match(off,/Enable corrections/);assert.doesNotMatch(off,/id="gm-value-form"|id="gm-roll-form"/);
 const on=gmControlsView(state,[],helpers);assert.match(on,/id="gm-value-form"/);assert.match(on,/id="gm-roll-form" hidden/);assert.match(on,/value="roll" disabled/);assert.match(on,/aria-hidden="true">ⓘ/);assert.doesNotMatch(on,/Original action number|Roll within that action|Base score position/);
});
test('simple correction and dice inputs preserve existing command contracts',()=>{
 const values={'#gm-field':{value:'pool.1'},'#gm-value':{value:'12'},'#gm-reason':{value:'Referee correction'},'#gm-custom':{value:'rep'}},$=key=>values[key];
 assert.deepEqual(correctionPayload(state,$),{field:'pool',index:1,value:12,reason:'Referee correction'});
 values['#gm-field'].value='custom';assert.equal(correctionPayload(state,$).field,'stat.REP');
 const log=[{number:4,type:'survival',rolls:[{label:'Survival',values:[1,1],kept:[1,1],total:2}]}];
 const inputs={'#gm-roll-choice':{value:'4:0'},'#gm-dice-inputs':{querySelectorAll:()=>[{value:'6'},{value:'4'}]},'#gm-roll-reason':{value:'Confirmed dice'}};
 assert.deepEqual(replacementPayload(log,key=>inputs[key]),{revision:4,rollIndex:0,values:[6,4],reason:'Confirmed dice'});
 inputs['#gm-roll-choice'].value='99:0';assert.throws(()=>replacementPayload(log,key=>inputs[key]),/Choose a recorded roll/);
});
