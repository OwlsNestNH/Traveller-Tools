import test from 'node:test';import assert from 'node:assert/strict';
import {rankAwardPopupView} from '../gui/rank-award-popup.mjs';
import {api} from '../engine/session.mjs';
const catalog=api({operation:'catalog'}),esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const state={stage:'skill-choice',pendingChoice:{name:'Gun Combat',mode:'set',value:1}},origin={kind:'rank',careerId:'core.army',rank:0,track:'enlisted',title:'Private'};
test('only an observed pending rank choice uses the popup; historical review stays inline',()=>{
 const before=JSON.stringify(state),controls='<select id="existing-choice"></select>';
 const html=rankAwardPopupView(state,{pending:origin},catalog,controls,{esc});
 assert.match(html,/Army • Private • Rank 0/);assert.match(html,/Gun Combat 1/);assert.ok(html.includes(controls));
 for(const pending of [null,{...origin,kind:'academy-service'},{...origin,kind:'academy-entry'},{...origin,kind:'basic-training'},{...origin,careerId:'unknown'}])assert.equal(rankAwardPopupView(state,{pending},catalog,controls,{esc}),null);
 assert.equal(rankAwardPopupView(state,{pending:origin},catalog,controls,{esc,readOnly:true}),null);
 assert.equal(rankAwardPopupView({...state,stage:'survival'},{pending:origin},catalog,controls,{esc}),null);
 assert.equal(JSON.stringify(state),before);
});
