import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
import {buildAslanOriginFixture as build,run,force,rejected} from './aslan-origin-fixtures.mjs';
import {aslanRitePopupModel,aslanRitePopupView,riteEventSummary,aslanRiteDoublesView,riteDoublesHeadline} from '../gui/aslan-rite-popup.mjs';
const round=r=>{const x=api({operation:'import',raw:exportSession(r.session)});assert.equal(x.ok,true,x.error?.message);assert.deepEqual(x.state,r.state);assert.deepEqual(x.log,r.log);};
test('all36 Rite rolls preserve strict comparison and resolve doubles exactly once',()=>{
 for(const gender of ['male','female'])for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
  const before=build({stage:'aslan-rite',gender});let r=force(before,'roll-aslan-rite',{},[a,b]);const rite=r.state.currentAslanOrigin.rite;assert.deepEqual(rite.dice,[a,b]);assert.equal(rite.modifier,['STR','DEX','END','INT','EDU','SOC'].filter(k=>before.state.character.stats[k]>a+b).length);assert.equal(rite.additionalRolls.length,a===1&&b===1?1:0);round(r);
  let model=aslanRitePopupModel(r.state),html=aslanRitePopupView(model,{esc:String});assert.ok(html.includes(a+' + '+b+' = '+(a+b)));assert.ok(html.includes('RITE +'+rite.modifier));assert.match(html,/Equal does not count/);assert.ok(riteEventSummary(model));rejected(r,'roll-aslan-rite');rejected(r,'skip-precareer',{},/origin/);
  if(a===2&&b===2&&gender==='male'){assert.equal(model.equipment,true);assert.equal(r.state.character.cash,before.state.character.cash);rejected(r,'acknowledge-aslan-rite');r=run(r,'record-aslan-rite-equipment',{}, {id:'rite-credit'});assert.equal(r.state.character.equipmentCredits.at(-1).remaining,5000);assert.deepEqual(run(r,'record-aslan-rite-equipment',{}, {id:'rite-credit'}).state,r.state);rejected(r,'record-aslan-rite-equipment');round(r);}
  assert.equal(r.state.stage,'aslan-rite-result');assert.equal(r.state.currentAslanOrigin.rite.effectsResolved,true);assert.equal(r.state.currentAslanOrigin.status,'pending');if(a===2&&b===2&&gender==='female')assert.equal(r.state.character.cash,before.state.character.cash+5000);if(a===6&&b===6){assert.equal(r.state.character.stats.END,before.state.character.stats.END+1);assert.equal(rite.statsBefore.END,before.state.character.stats.END);}
  const c=structuredClone(r.state.character),rng=r.state.rng;rejected(r,'acknowledge-aslan-rite',{extra:true});r=run(r,'acknowledge-aslan-rite',{}, {id:'rite-ack'});assert.equal(r.state.stage,'precareer');assert.equal(r.state.currentAslanOrigin.status,'completed');assert.equal(r.state.rng,rng);assert.deepEqual(r.log.at(-1).rolls,[]);for(const key of ['skills','stats','cash','benefits','relationships','equipmentCredits'])assert.deepEqual(r.state.character[key],c[key]);assert.deepEqual(run(r,'acknowledge-aslan-rite',{}, {id:'rite-ack'}).state,r.state);rejected(r,'acknowledge-aslan-rite');round(r);
 }
});
test('Rite equality excluded and extra share die visible separately',()=>{
 const r=force(build({familySOC:4,stage:'aslan-rite'}),'roll-aslan-rite',{},[3,4]),html=aslanRitePopupView(aslanRitePopupModel(r.state),{esc:String});assert.equal(r.state.character.stats.RITE,4);assert.match(html,/7 = 7 · No count/);assert.match(html,/data-counts="true"/);const shares=force(build({stage:'aslan-rite'}),'roll-aslan-rite',{},[1,1]),model=aslanRitePopupModel(shares.state);assert.match(riteEventSummary(model),new RegExp(model.rite.additionalRolls[0].total+' Clan Shares'));assert.match(aslanRitePopupView(model,{esc:String}),/Clan Share quantity/);
});
test('legacy Rite shape and transitions remain unchanged',()=>{
 for(const gender of ['male','female'])for(const die of [1,2,6]){let r=force(build({stage:'aslan-rite',gender,rulesRevision:'character-preview-2026-11-09.27'}),'roll-aslan-rite',{},[die,die]);assert.equal(aslanRitePopupModel(r.state),null);assert.equal(r.state.currentAslanOrigin.rite.additionalRolls,undefined);if(gender==='male'&&die===2)r=run(r,'record-aslan-rite-equipment');assert.equal(r.state.stage,'precareer');round(r);}
});
test('exceptional referee resolution stays available and is not labelled as the standard credit',()=>{
 let r=force(build({stage:'aslan-rite'}),'roll-aslan-rite',{},[2,2]);assert.match(aslanRitePopupView(aslanRitePopupModel(r.state),{esc:String}),/data-action="aslan-source-review"/);r=run(r,'resolve-book',{confirmed:true,note:'Explicit referee source fixture.',effects:[{kind:'relationship',role:'Contact',name:'Source contact'}]});assert.equal(r.state.stage,'aslan-rite-result');assert.match(riteEventSummary(aslanRitePopupModel(r.state)),/referee ruling/);assert.equal(r.state.character.equipmentCredits,undefined);round(r);
});
test('each Rite flavor outcome has six stable nonmechanical variants',async()=>{
 const {ASLAN_ORIGIN_TAGLINES,originTagline}=await import('../gui/aslan-origin-taglines.mjs');for(const id of ['ordinary','shares','reward','contact','rival','scar','endurance']){const key='rite:'+id;assert.equal(ASLAN_ORIGIN_TAGLINES[key].length,6);assert.equal(new Set(ASLAN_ORIGIN_TAGLINES[key]).size,6);assert.equal(originTagline(key,'event'),originTagline(key,'event'));}
});
test('two labelled information panels keep required actions and actual events on the main screen',()=>{
 for(const values of [[3,4],[1,1],[2,2],[6,6]]){
  const r=force(build({stage:'aslan-rite'}),'roll-aslan-rite',{},values),model=aslanRitePopupModel(r.state),html=aslanRitePopupView(model,{esc:String}),main=html.split('</dialog>')[0];assert.match(main,/id="aslan-rite-info-open"/);assert.match(main,/id="aslan-rite-calculation-open"/);assert.match(html,/aria-labelledby="aslan-rite-calculation-title"/);assert.doesNotMatch(main,/rite-comparisons/);assert.ok(main.includes(riteEventSummary(model)));assert.ok(main.includes(values.join(' + ')+' = '+values.reduce((a,b)=>a+b)));assert.match(main,/id="aslan-family-continue"/);if(values[0]===1)assert.match(main,/Clan Share quantity/);if(values[0]===2)assert.match(main,/Record restricted credit/);assert.match(html,/Equal does not count/);
 }
});

test('doubles event is read-only, named and narrative-rich with no tagline for all genders and six outcomes',()=>{
 for(const gender of ['male','female'])for(let die=1;die<=6;die++){
  const r=force(build({stage:'aslan-rite',gender}),'roll-aslan-rite',{},[die,die]),before=structuredClone(r),model=aslanRitePopupModel(r.state),html=aslanRiteDoublesView({...model,tagline:'DO NOT SHOW'},{esc:String});
  assert.match(html,/id="aslan-rite-doubles-dialog"/);assert.match(html,/aslan-family-narrative/);assert.match(html,/Continue to Rite result/);assert.ok(html.includes(riteEventSummary(model)));assert.doesNotMatch(html,/DO NOT SHOW|data-action=|aslan-family-continue|aslan-family-roll/);assert.deepEqual(r,before);
  if(die===1){const extra=model.rite.additionalRolls[0];assert.ok(html.includes(extra.total+' Clan Shares'));assert.ok(html.includes(extra.values.join(' + ')+' = '+extra.total));}
  if(die===2){assert.match(html,gender==='male'?/Decision still required/:/Cr5000 cash awarded/);if(gender==='male'){assert.match(html,/It is not cash/);const credited=run(r,'record-aslan-rite-equipment');assert.match(aslanRiteDoublesView(aslanRitePopupModel(credited.state),{esc:String}),/restricted equipment credit recorded/);}}
 }
 const ordinary=force(build({stage:'aslan-rite'}),'roll-aslan-rite',{},[3,4]);assert.equal(aslanRiteDoublesView(aslanRitePopupModel(ordinary.state),{esc:String}),'');assert.equal(aslanRiteDoublesView(aslanRitePopupModel(build({stage:'aslan-rite'}).state),{esc:String}),'');
});
test('doubles popup does not claim standard credit after a source ruling',()=>{
 let r=force(build({stage:'aslan-rite'}),'roll-aslan-rite',{},[2,2]);r=run(r,'resolve-book',{confirmed:true,note:'Explicit referee source fixture.',effects:[{kind:'relationship',role:'Contact',name:'Source contact'}]});const html=aslanRiteDoublesView(aslanRitePopupModel(r.state),{esc:String});assert.match(html,/recorded referee ruling/);assert.doesNotMatch(html,/credit recorded|cash awarded|Decision still required/);
});

test('doubles consequence leads the story with accurate recorded or pending headline',()=>{
 for(const gender of ['male','female'])for(let die=1;die<=6;die++){
  const r=force(build({stage:'aslan-rite',gender}),'roll-aslan-rite',{},[die,die]),model=aslanRitePopupModel(r.state),html=aslanRiteDoublesView(model,{esc:String});
  assert.ok(html.indexOf('id="rite-doubles-outcome"')<html.indexOf('class="aslan-family-narrative"'));assert.ok(html.includes('<h3 id="rite-doubles-outcome">'+riteDoublesHeadline(model)+'</h3>'));
  if(die===1)assert.ok(riteDoublesHeadline(model).startsWith(model.rite.additionalRolls[0].total+' Clan Share'));
  if(die===2&&gender==='male'){assert.match(riteDoublesHeadline(model),/pending/);assert.doesNotMatch(html,/Recorded outcome/);}else assert.match(html,/Recorded outcome/);
  if(die===6)assert.equal(riteDoublesHeadline(model),'END +1');
  const main=aslanRitePopupView(model,{esc:String}).split('</dialog>')[0];assert.doesNotMatch(main,/rite-doubles-outcome|rite-doubles-status/);
 }
});
