import test from 'node:test';
import assert from 'node:assert/strict';
import {aezorghSetupMethod,aezorghRollChoiceView,syncAezorghMethodSummary} from '../gui/aezorgh-setup.mjs';
import {OPENING_HELP,openingInfoButton} from '../gui/opening-help.mjs';
import {createSession,execute,project,COMPATIBLE_RULES_REVISIONS,RULES_REVISION,exportSession,importSession} from '../engine/session.mjs';
const run=(s,type,payload)=>execute(s,{type,payload});
test('House is only a pristine current UI default, without changing the engine config',()=>{
 for(const revision of COMPATIBLE_RULES_REVISIONS){
  const s={...createSession('method-ui-default'),rulesRevision:revision},p=project(s);
  assert.equal(p.state.config.aezorghTwoDice,false);
  assert.equal(aezorghSetupMethod(p.state,p.log),revision===RULES_REVISION?'house':'raw');
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
test('selector is clearly labelled, disabled outside species setup, and historical labels retain floor rounding',()=>{
 const render=(state,log=[])=>aezorghRollChoiceView(state,log,{esc:String,infoButton:openingInfoButton});
 const current=render({aezorghRoundUp:true,config:{aezorghTwoDice:false}});
 assert.match(current,/id="aezorgh-roll-choice" class="opening-info-field" hidden/);
 assert.match(current,/<label for="setup-aezorgh-method">Aezorgh stat rolls<\/label>/);
 assert.match(current,/<select id="setup-aezorgh-method" name="aezorghTwoDice"[^>]*disabled>/);
 assert.match(current,/<option value="house" selected>House · round up/);
 assert.match(current,/RAW · mixed dice/);
 assert.match(render({config:{aezorghTwoDice:true}},[{}]),/historical round-down rules/);
 assert.match(OPENING_HELP.aezorgh.source,/Vol\. 11, p\. 67/);
 for(const text of ['DEX and INT stay unhalved','30 for RAW','historical House saves continue rounding down'])assert.ok(OPENING_HELP.aezorgh.paragraphs.join(' ').includes(text));
});

test('compact method summary follows choice and retains historical wording',()=>{
 const summary={},select={value:'house',dataset:{roundUp:'true'}},form={elements:{aezorghTwoDice:select},querySelector:()=>summary};
 syncAezorghMethodSummary(form);assert.equal(summary.textContent,'2D6 ÷ 2 · default for new Aezorgh.');select.value='raw';syncAezorghMethodSummary(form);assert.equal(summary.textContent,'Published mixed 1D / 2D.');select.value='house';select.dataset.roundUp='false';syncAezorghMethodSummary(form);assert.match(summary.textContent,/historical round-down/);
});
