import test from 'node:test';
import assert from 'node:assert/strict';
import {createServicePanels,maxFuelAddition,fuelCorrection} from '../js/service-panels.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {refillQuote,supportStock} from '../js/life-support.mjs';
import {campaignBaseline} from './fixtures/campaign-baseline.mjs';
import * as S from '../js/state.mjs';
import {SaveNotCommittedError} from '../js/persistence.mjs';
const campaign=()=>{const s=S.initial();s.initialized=true;s.bank='100000';s.actual='0,0';s.route=['0,0'];s.worlds={'0,0':{id:'0,0',name:'Actual origin',x:0,y:0,sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'}};s.ship.fuel=configureFuel(200,43,20,0,2);return s;};
function withSupport({frozen=0}={}){
 const s=campaign();
 s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:4,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:frozen,luggageTons:'0'};
 // Legacy stock is deliberately preserved until a recorded transaction.
 s.ship.lifeSupport={capacityHours:672,remainingHours:336,elapsedHours:0};
 return s;
}
function harness(s=campaign()){
 let state=s,editable=true,form=null;
 const h={renders:0,commits:0,commitError:null,confirmControl:{disabled:false}};
 h.quoteWrites=0;h.quote={auditOpen:false,set innerHTML(html){this.html=html;this.auditOpen=false;h.quoteWrites++;}};
 const document={
  getElementById(id){return id==='service-form'?form:id==='service-quote'?h.quote:null;},
  querySelector(selector){return selector==='#service-form [name="fuelTons"]'?form?.elements.find(el=>el.name==='fuelTons'):null;},
  querySelectorAll(selector){return selector==='#service-panel [data-action="service-confirm"],#service-panel [data-action="service-review"]'?[h.confirmControl]:[];}
 };
 h.services=createServicePanels({document,getState:()=>state,isEditable:()=>editable,
  commit(label,fn,revision){
   assert.equal(revision,state.revision);
   if(!editable)throw Error('read-only');
   if(h.commitError)throw new SaveNotCommittedError(Error(h.commitError));
   h.duringCommit?.();state=S.transition(state,label,fn);h.commits++;
  },
  render(){h.renders++;form=null;},showOverview(){},message(){},nextJumpFuel:()=>20
 });
 h.state=()=>state;h.bytes=()=>JSON.stringify(state);h.setState=s=>state=s;
 h.readOnly=()=>editable=false;h.editable=()=>editable=true;
 h.action=(name,arg='')=>h.services.action(name,arg,h.services.token());
 h.capture=(name,arg='')=>{const token=h.services.token();return()=>h.services.action(name,arg,token);};
 h.fill=(values,token=h.services.token())=>{
  form={dataset:{serviceToken:token},elements:Object.entries(values).map(([name,value])=>({name,type:typeof value==='boolean'?'checkbox':'text',value:String(value),checked:value}))};
  h.services.sync();return form;
 };
 return h;
}
test('fuel maximum preserves odd tons and combines empty base tanks with exact free cargo',()=>{const s=campaign();assert.equal(maxFuelAddition(s),23);s.ship.fuel=configureFuel(200,43,40,40,2);s.ship.capacity='9';s.lots=[{quantity:'5.2'}];assert.equal(maxFuelAddition(s),6);s.ship.fuel.aboardTons=50;assert.equal(maxFuelAddition(s),0);});
test('fuel correction is reduction-only, audited, bank-neutral, releases bladder cargo and undoes',()=>{const s=campaign();s.ship.fuel=configureFuel(200,43,55,40,2);const before=structuredClone(s),n=S.transition(s,'Adjusted fuel aboard',n=>fuelCorrection(n,'41','Actual tank check'));assert.equal(n.bank,s.bank);assert.equal(n.ship.fuel.aboardTons,41);assert.equal(n.events[0].fuelCorrection.removed,14);assert.equal(n.events[0].fuelCorrection.reason,'Actual tank check');assert.equal(n.ledger.length,0);assert.deepEqual(S.undo(n).ship,before.ship);for(const bad of ['','56','-1','2.5','55'])assert.throws(()=>fuelCorrection(structuredClone(s),bad));assert.deepEqual(s,before);});
test('opening, editing and cancelling inline fuel never mutate the campaign',async()=>{const h=harness(),before=structuredClone(h.state());h.services.open('fuel');assert.match(h.services.panel(),/id="service-form"/);assert.doesNotMatch(h.services.panel(),/data-action="service-(?:adjust|review)"/);assert.match(h.services.panel(),/Actual origin/);assert.match(h.services.panel(),/value="23"/);h.fill({fuelTons:'7.25',fuelType:'unrefined',expenseNotes:'Draft only'});assert.equal(h.commits,0);await h.action('service-back','');assert.equal(h.services.active(),false);assert.deepEqual(h.state(),before);});
test('duplicate input/change synchronization retains quote disclosure nodes and still validates controls',async()=>{
 const h=harness(),before=h.bytes();h.services.open('fuel');h.fill({fuelTons:'7',expenseNotes:'Draft note'});
 assert.equal(h.quoteWrites,1);h.quote.auditOpen=true;
 h.services.sync();assert.equal(h.quoteWrites,1);assert.equal(h.quote.auditOpen,true,'Blur/change leaves the current summary in place');
 await h.action('service-fuel-step','10');assert.equal(h.quoteWrites,2);assert.match(h.quote.html,/17 t/,'Programmatic shortcuts still refresh the quote');
 h.readOnly();h.services.sync();assert.equal(h.quoteWrites,2);assert.equal(h.confirmControl.disabled,true,'Unchanged markup does not bypass ownership validation');
 assert.equal(h.bytes(),before);assert.equal(h.commits,0);
});
test('direct inline Confirm saves once; repeated click cannot pay again',async()=>{const h=harness();h.services.open('fuel');const confirm=h.capture('service-confirm');await confirm();await confirm();assert.equal(h.commits,1);assert.equal(h.state().ship.fuel.aboardTons,43);assert.equal(h.state().bank,'88500');assert.equal(S.undo(h.state()).ship.fuel.aboardTons,20);});
test('legacy campaign baseline can preview, cancel, refuel bladders and undo without rewriting fuel data',async()=>{
 const s=campaignBaseline(),before=structuredClone(s),h=harness(s);
 assert.equal(s.ship.fuel.bladderJumps,1,'Use the unchanged legacy campaign-stress fixture');
 h.services.open('fuel');h.fill({fuelTons:'20',fuelType:'refined'});
 assert.equal(h.confirmControl.disabled,false,'A valid legacy refuel preview keeps Confirm enabled');
 assert.match(h.services.panel(),/After refuelling<\/span><strong>60 \/ 80 t/);
 assert.match(h.services.panel(),/Cargo occupied by fuel after<\/dt><dd>20 t/);
 assert.doesNotMatch(h.services.panel(),/Legacy fuel bladder capacity needs/);
 assert.deepEqual(h.state(),before,'Preview keeps the entire legacy campaign unchanged');
 await h.action('service-cancel');assert.deepEqual(h.state(),before);
 h.services.open('fuel');h.fill({fuelTons:'20',fuelType:'refined'});
 const confirm=h.capture('service-confirm');await confirm();await confirm();
 assert.equal(h.commits,1);assert.equal(h.state().bank,'390000');
 assert.deepEqual(h.state().ship.fuel,{...before.ship.fuel,aboardTons:60});
 assert.equal(h.state().ledger.length,before.ledger.length+1);
 const undone=S.undo(h.state());
 for(const key of ['ship','bank','ledger','hours'])assert.deepEqual(undone[key],before[key]);
 assert.deepEqual(undone.events.slice(0,before.events.length),before.events);
 assert.deepEqual(undone.events.slice(before.events.length).map(e=>e.label),['Refuelled','Undo: Refuelled']);
});
test('stale and read-only drafts cannot commit and keep frozen actual-world display',async()=>{for(const mode of ['revision','ownership']){const h=harness();h.services.open('fuel');if(mode==='revision'){const next=S.transition(h.state(),'Other change',s=>s.bank='99999');h.setState(next);}else h.readOnly();assert.match(h.services.panel(),/Campaign or editing ownership changed/);await assert.rejects(h.action('service-confirm',''),/Campaign or editing ownership changed/);assert.equal(h.commits,0);await h.action('service-cancel','');assert.equal(h.services.active(),false);}});
test('LSS preview rejects funds and cargo overflow before offering payment',()=>{for(const kind of ['funds','cargo']){const s=campaign();s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:4,high:0},crew:{low:0,middle:0,high:0}};s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'56',denominator:'1'}};if(kind==='funds')s.bank='1';else{s.ship.fuel=configureFuel(10,4,2,0,2);s.ship.capacity='0';}const h=harness(s);h.services.open('support');assert.match(h.services.panel(),kind==='funds'?/Insufficient funds/:/exceed available cargo/);assert.equal(h.commits,0);}});

for(const [from,to] of [['fuel','support'],['support','fuel']]){
 for(const mode of (from==='fuel'?['inline']:['summary','adjust','reviewed']))test(`${from} → ${to} from ${mode} discards only the draft and rejects its detached callbacks`,async()=>{
  const h=harness(withSupport({frozen:2})),before=h.bytes();
  h.services.open(from);
  if(mode!=='summary'){
   if(from==='support')await h.action('service-adjust');
   h.fill(from==='fuel'?{fuelType:'water',fuelTons:'7',expenseNotes:'Discard this fuel draft'}:{extraDays:'14',comfortCredits:'2000',comfortNote:'Discard this support draft'});
   if(mode==='reviewed')await h.action('service-review');
  }
  const oldToken=h.services.token(),callbacks=['service-confirm','service-review','service-adjust','service-fuel-correct','service-back','service-cancel','service-fuel-step','service-fuel-topoff','service-fuel-next'].map(name=>h.capture(name,'-10'));
  h.services.open(to);
  assert.notEqual(h.services.token(),oldToken,'Each switch has a fresh generation');
  const replacement=h.services.panel(),renders=h.renders;
  assert.match(replacement,to==='fuel'?/id="service-form"/:/Life support · Summary/);
  assert.match(replacement,/Actual origin/);
  assert.equal(h.bytes(),before,'Switching must preserve every serialized campaign byte');
  for(const callback of callbacks)await callback();
  assert.equal(h.services.panel(),replacement,'Detached callbacks cannot edit or dismiss the replacement panel');
  assert.equal(h.renders,renders);assert.equal(h.commits,0);assert.equal(h.bytes(),before);
  if(to==='support')await h.action('service-adjust');
  const editor=h.services.panel();
  if(to==='fuel'){
   assert.match(editor,/name="fuelTons"[^>]*value="23"/);
   assert.match(editor,/value="refined" selected/);
   assert.match(editor,/name="expenseNotes"[^>]*value=""/);
  }else{
   assert.match(editor,/name="extraDays"[^>]*value="0"/);
   assert.match(editor,/name="comfortCredits"[^>]*value="0"/);
   assert.match(editor,/name="comfortNote"[^>]*value=""/);
   assert.match(editor,/Cr 4,000/,'Fresh standard LSS quote ignores discarded extras');
  }
  // Return directly once more: the original service also starts afresh.
  h.services.open(from);if(from==='support')await h.action('service-adjust');
  assert.match(h.services.panel(),from==='fuel'?/name="fuelTons"[^>]*value="23"/:/name="extraDays"[^>]*value="0"/);
  assert.doesNotMatch(h.services.panel(),/Discard this/);
  await h.action('service-cancel');assert.equal(h.services.active(),false);assert.equal(h.bytes(),before);
 });
}

test('fuel correction draft is discarded by a direct switch without a refund, audit or stock change',async()=>{
 const h=harness(withSupport()),before=h.bytes();h.services.open('fuel');
 await h.action('service-fuel-correct');
 h.fill({fuelRemaining:'13',fuelReason:'Unfinished correction'});await h.action('service-review');
 const confirm=h.capture('service-confirm');assert.match(h.services.panel(),/Adjust fuel aboard · Summary/);
 h.services.open('support');await confirm();assert.equal(h.bytes(),before);
 h.services.open('fuel');assert.match(h.services.panel(),/id="service-form"/);assert.doesNotMatch(h.services.panel(),/Unfinished correction/);
 assert.equal(h.state().ship.fuel.aboardTons,20);assert.equal(h.commits,0);
});

test('every service action and form carries its session token while references remain read-only',async()=>{
 const h=harness();h.services.open('fuel');
 for(const mode of ['inline']){
  const tags=h.services.panel().match(/<(?:button|form)\b[^>]*>/g);
  assert.ok(tags.length);
  for(const tag of tags){if(tag.includes('data-rule-info=')){assert.match(tag,/type="button"/);assert.doesNotMatch(tag,/data-action=|data-mutate/);}else assert.match(tag,new RegExp('data-service-token="'+h.services.token()+'"'));}
 }
 assert.match(h.services.panel(),/data-action="service-fuel-step" data-arg="-10"/);
 assert.match(h.services.panel(),/data-action="service-fuel-step" data-arg="10"/);
 h.fill({fuelTons:'23'});await h.action('service-fuel-step','-10');
 assert.match(h.services.panel(),/name="fuelTons"[^>]*value="13"/);
 await h.action('service-fuel-step','10');assert.match(h.services.panel(),/name="fuelTons"[^>]*value="23"/);
});

test('missing or malformed tokens never authorize actions, including Cancel and Back',async()=>{
 const h=harness(),before=h.bytes();h.services.open('fuel');const panel=h.services.panel();
 for(const token of [undefined,null,'','stock-0',h.services.token()+'x']){
  for(const name of ['service-confirm','service-adjust','service-fuel-correct','service-review','service-back','service-cancel'])await h.services.action(name,'',token);
 }
 assert.equal(h.services.panel(),panel);assert.equal(h.bytes(),before);assert.equal(h.commits,0);
 assert.equal(await h.services.action('unrelated-action',''),false);
});

test('quiet close abandons the session without rendering and invalidates callbacks before reopening',async()=>{
 const h=harness(withSupport()),before=h.bytes();h.services.open('fuel');const callback=h.capture('service-confirm'),token=h.services.token(),renders=h.renders;
 assert.equal(h.services.close({render:false}),true);assert.equal(h.services.active(),false);assert.equal(h.services.token(),'');assert.equal(h.services.panel(),'');assert.equal(h.renders,renders);
 await callback();assert.equal(h.commits,0);h.services.open('support');assert.notEqual(h.services.token(),token);
 const panel=h.services.panel();await callback();assert.equal(h.services.panel(),panel);assert.equal(h.bytes(),before);
 h.services.close();assert.equal(h.renders,renders+2);assert.equal(h.bytes(),before);
});

test('the replacement session reads current revision, actual world and LSS stock instead of the abandoned base',async()=>{
 const h=harness(withSupport({frozen:2}));h.services.open('fuel');const oldConfirm=h.capture('service-confirm');
 const next=S.transition(h.state(),'External campaign update',s=>{
  s.hours+=24;
  s.worlds['1,0']={...s.worlds['0,0'],id:'1,0',name:'New actual harbor',x:1,hex:'0201',uwp:'D788899-C'};
  s.actual='1,0';s.route=['1,0'];
 });
 h.setState(next);const before=h.bytes(),expected=refillQuote(next);
 assert.match(h.services.panel(),/Actual origin/);assert.match(h.services.panel(),/Campaign or editing ownership changed/);
 h.services.open('support');assert.match(h.services.panel(),/New actual harbor/);assert.doesNotMatch(h.services.panel(),/Actual origin/);
 assert.match(h.services.panel(),/13 days/);assert.match(h.services.panel(),/54\.6 LSS aboard/);
 assert.equal(h.bytes(),before);await oldConfirm();assert.equal(h.bytes(),before);
 const confirm=h.capture('service-confirm');await confirm();await confirm();
 assert.equal(h.commits,1);assert.equal(h.state().bank,String(BigInt(next.bank)-BigInt(expected.amount)));
 assert.equal(supportStock(h.state().ship).remainingUnits,'117.6');
 assert.equal(h.state().ledger.at(-1).world,'1,0');assert.equal(h.state().revision,next.revision+1);
 assert.equal(h.state().ship.fuel.aboardTons,20);
});

test('read-only switch cannot replace or commit a session, and ownership recovery needs a fresh session',async()=>{
 const h=harness(withSupport()),before=h.bytes();h.services.open('fuel');h.fill({fuelTons:'7'});
 const token=h.services.token(),oldConfirm=h.capture('service-confirm');h.readOnly();h.services.syncControls();
 assert.throws(()=>h.services.open('support'),/read-only/);assert.equal(h.services.token(),token);
 await assert.rejects(h.action('service-review'),/Campaign or editing ownership changed/);assert.equal(h.bytes(),before);
 h.editable();await assert.rejects(oldConfirm(),/Campaign or editing ownership changed/);
 h.services.open('support');const panel=h.services.panel();await oldConfirm();assert.equal(h.services.panel(),panel);assert.equal(h.bytes(),before);
 await h.action('service-confirm');assert.equal(h.commits,1);assert.equal(h.state().bank,'96000');
});

test('an unavailable replacement leaves the original draft intact and never mutates state',async()=>{
 const s=withSupport();s.worlds[s.actual].emptySpace=true;
 const h=harness(s),before=h.bytes();h.services.open('fuel');const panel=h.services.panel(),token=h.services.token();
 assert.throws(()=>h.services.open('support'),/No local supplies/);
 assert.throws(()=>h.services.open('invalid'),/Unknown ship service/);
 assert.equal(h.services.token(),token);assert.equal(h.services.panel(),panel);assert.equal(h.bytes(),before);
 await h.action('service-back');assert.equal(h.services.active(),false);
});

test('an old form cannot overwrite fresh LSS inputs or amounts after a direct switch',async()=>{
 const h=harness(withSupport({frozen:2})),before=h.bytes();h.services.open('support');await h.action('service-adjust');
 const oldToken=h.services.token();h.fill({extraDays:'14',comfortCredits:'2000',comfortNote:'Old form'});
 h.services.open('fuel');h.services.open('support');await h.action('service-adjust');
 h.fill({extraDays:'999',comfortCredits:'99000',comfortNote:'Detached old form'},oldToken);
 assert.match(h.services.panel(),/name="extraDays"[^>]*value="0"/);assert.match(h.services.panel(),/Cr 4,000/);assert.equal(h.bytes(),before);
 h.fill({extraDays:'14',comfortCredits:'2000',comfortNote:'Fresh supplies'});await h.action('service-review');
 assert.match(h.services.panel(),/Cr 8,100/);assert.match(h.services.panel(),/176\.4 LSS aboard/);
 const confirm=h.capture('service-confirm');await confirm();await confirm();
 assert.equal(h.commits,1);assert.equal(h.state().bank,'91900');assert.equal(h.state().ledger.length,1);assert.equal(supportStock(h.state().ship).remainingUnits,'176.4');
});

test('switching and Back preserve all previously recorded payments, audits and Undo entries',async()=>{
 const h=harness(withSupport());h.services.open('fuel');await h.action('service-confirm');
 h.services.open('support');await h.action('service-confirm');
 const paid=h.bytes();assert.equal(h.commits,2);assert.equal(h.state().ledger.length,2);assert.equal(h.state().undo.length,2);
 h.services.open('support');await h.action('service-adjust');h.fill({extraDays:'14'});await h.action('service-review');
 h.services.open('fuel');h.services.open('support');await h.action('service-back');
 assert.equal(h.bytes(),paid,'Draft navigation never rolls back an already recorded transaction');assert.equal(h.commits,2);
});

test('a failed final save stays atomic, and reentrant switching is locked until saving finishes',async()=>{
 const h=harness(withSupport()),before=h.bytes();h.services.open('fuel');h.commitError='Synthetic storage failure';
 await assert.rejects(h.action('service-confirm'),/Synthetic storage failure/);
 assert.equal(h.bytes(),before);assert.equal(h.commits,0);assert.equal(h.services.committing(),false);
 const token=h.services.token();h.commitError=null;
 h.duringCommit=()=>{
  assert.equal(h.services.committing(),true);
  assert.throws(()=>h.services.open('support'),/finish saving/);
  assert.equal(h.services.close({render:false}),false);
  assert.equal(h.services.token(),token);
 };
 await h.action('service-confirm');assert.equal(h.commits,1);assert.equal(h.services.active(),false);assert.equal(h.state().bank,'88500');
});

for(const frozen of [0,2])for(const kind of ['extra','comfort'])test(`full LSS exposes ${kind} without charging baseline again (${frozen} frozen)`,async()=>{
 const s=withSupport({frozen});s.ship.lifeSupport.remainingHours=672;const before=structuredClone(s),h=harness(s);h.services.open('support');
 assert.match(h.services.panel(),/id="service-form"/);assert.match(h.services.panel(),/name="extraDays"[^>]*value="0"/);assert.match(h.services.panel(),/name="comfortCredits"[^>]*value="0"/);assert.match(h.services.panel(),/Standard top-up<\/dt><dd>\+0 days · Cr 0/);assert.match(h.services.panel(),/<strong>Cr 0<\/strong>/);assert.equal(h.bytes(),JSON.stringify(before));
 await h.action('service-confirm');assert.equal(h.commits,0,'Full initial draft still requires Review');
 h.fill(kind==='extra'?{extraDays:'14'}:{comfortCredits:'2000',comfortNote:'Comfort only, no physical stock'});
 const q=refillQuote(s,kind==='extra'?{extraDays:'14'}:{comfortCost:'2000',comfortNote:'Comfort only, no physical stock'});assert.equal(q.standardAmount,'0');assert.equal(q.extraAmount,kind==='extra'?(frozen?'2100':'2000'):'0');assert.equal(q.amount,kind==='comfort'?'2000':frozen?'2100':'2000');
 assert.equal(h.bytes(),JSON.stringify(before));await h.action('service-review');assert.equal(h.bytes(),JSON.stringify(before));const confirm=h.capture('service-confirm');await confirm();await confirm();
 assert.equal(h.commits,1);assert.equal(h.state().bank,String(100000n-BigInt(q.amount)));assert.equal(supportStock(h.state().ship).remainingUnits,q.afterUnits);assert.equal(h.state().ledger.length,1);assert.equal(h.state().undo.length,1);
 h.services.open('support');assert.match(h.services.panel(),/id="service-form"/);assert.match(h.services.panel(),/<strong>Cr 0<\/strong>/);assert.equal(h.commits,1);
 const undone=S.undo(h.state());for(const key of ['bank','ship','ledger','hours'])assert.deepEqual(undone[key],before[key]);
});
