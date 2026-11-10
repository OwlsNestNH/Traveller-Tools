import test from 'node:test';
import assert from 'node:assert/strict';
import {aezorghSetupMethod,aezorghRollChoiceView} from '../gui/aezorgh-setup.mjs';
import {OPENING_HELP,openingInfoButton} from '../gui/opening-help.mjs';
import {createSession,execute,project,COMPATIBLE_RULES_REVISIONS,RULES_REVISION,exportSession,importSession} from '../engine/session.mjs';
const run=(s,type,payload)=>execute(s,{type,payload});
test('House is only a pristine current UI default, without changing the engine config',()=>{
 for(const revision of COMPATIBLE_RULES_REVISIONS){
  const s={...createSession('method-ui-default'),rulesRevision:revision},p=project(s);
  assert.equal(p.state.config.aezorghTwoDice,false);
  assert.equal(aezorghSetupMethod(p.state,p.log),[RULES_REVISION,'character-preview-2026-11-09.22'].includes(revision)?'house':'raw');
  for(const chosen of [false,true]){
   const r=run(s,'configure',{aezorghTwoDice:chosen});assert.equal(aezorghSetupMethod(r.state,r.log),chosen?'house':'raw');
   const raw=exportSession(r.session),replayed=project(importSession(raw));
   assert.equal(exportSession(importSession(raw)),raw);assert.equal(aezorghSetupMethod(replayed.state,replayed.log),chosen?'house':'raw');
  }
 }
});
test('existing unconfigured history and restored state do not receive a new UI default',()=>{
 const s=createSession('existing-raw'),r=run(s,'gm-mode',{enabled:true});
 assert.equal(aezorghSetupMethod(r.state,r.log),'raw');
 const restored=run(r.session,'restore',{revision:0,reason:'Test identity restore'});
 assert.equal(aezorghSetupMethod(restored.state,restored.log),'raw');
});
test('one checkbox is clearly labelled, checked by default, and historical labels retain floor rounding',()=>{
 const render=(state,log=[])=>aezorghRollChoiceView(state,log,{esc:String,infoButton:openingInfoButton});
 const current=render({aezorghRoundUp:true,config:{aezorghTwoDice:false}});
 assert.match(current,/id="aezorgh-roll-choice" class="opening-house-rule" hidden/);
 assert.match(current,/<label for="setup-aezorgh-method">/);
 assert.equal((current.match(/type="checkbox"/g)||[]).length,1);assert.doesNotMatch(current,/<select|type="radio"/);
 assert.match(current,/<input id="setup-aezorgh-method" name="aezorghTwoDice" type="checkbox"[^>]* checked disabled>/);
 assert.match(current,/<label for="setup-aezorgh-method">Aezorgh: use 2D6 ÷ 2 for Stats<\/label>/);assert.doesNotMatch(current,/<small/);
 assert.match(render({config:{aezorghTwoDice:true}},[{}]),/checked disabled/);
 assert.match(OPENING_HELP.aezorgh.source,/Vol\. 11, p\. 67/);
 for(const text of ['Checked: House','Unchecked: RAW','DEX and INT stay unhalved','30 for RAW','historical House saves continue rounding down'])assert.ok(OPENING_HELP.aezorgh.paragraphs.join(' ').includes(text));
});
