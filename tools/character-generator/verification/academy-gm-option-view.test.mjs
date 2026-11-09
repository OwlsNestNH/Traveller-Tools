import test from 'node:test';
import assert from 'node:assert/strict';
import {gmControlsView} from '../gui/character-controls.mjs';
import {trainingContext} from '../gui/training-context.mjs';
const state={stage:'career',pool:[],config:{gm:true},character:{stats:{INT:7},careers:[],skills:{}}};
const helpers={esc:String,options:()=>''};
test('Academy GM label is exact, unchecked by default, and disabled after career entry',()=>{
 let html=gmControlsView(state,[],helpers);
 assert.match(html,/Allow Service Skill choice in the first term after Academy/);
 assert.match(html,/id="gm-academy-training" type="checkbox"  >/);
 assert.match(html,/House option, off by default/);
 html=gmControlsView({...state,config:{gm:true,academyServiceSkill:true},character:{...state.character,careers:[{}]}},[],helpers);
 assert.match(html,/id="gm-academy-training" type="checkbox" checked disabled/);
});
test('training presentation identifies the optional Academy roll separately from RAW',()=>{
 const context=trainingContext({...state,stage:'training',active:0,character:{careers:[{terms:0,academyServiceTraining:'pending'}]}});
 assert.match(context.title,/GM option/);assert.match(context.description,/normal skill gains/);assert.match(context.description,/not the default Core rule/);
});
