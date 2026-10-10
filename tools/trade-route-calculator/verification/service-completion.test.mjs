import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceHarness,serviceCampaign,serviceSaveGate,serviceUI,S,same,flush} from './service-save-harness.mjs';
import {supportStock} from '../js/life-support.mjs';
import {bladderSpace,configureFuel} from '../js/fuel.mjs';
import {campaignBaseline} from './fixtures/campaign-baseline.mjs';

// Scope: actual Fuel/LSS app callbacks and real Store, with private storage and
// a delayed completion adapter. This does not certify browser gestures, Web
// Locks, arbitrary async providers, or other not-yet-migrated action groups.
const cases=[
 {id:'refined fuel',kind:'fuel',values:{fuelType:'refined',fuelTons:'7.25',expenseNotes:'Exact refined draft'},bank:'96000',fuel:28,amount:'4000'},
 {id:'unrefined fuel',kind:'fuel',values:{fuelType:'unrefined',fuelTons:'2.25',expenseNotes:'Exact unrefined draft'},bank:'99700',fuel:23,amount:'300'},
 {id:'water collection',kind:'fuel',values:{fuelType:'water',fuelTons:'7.25',expenseNotes:'Free collection draft'},bank:'100000',fuel:28,amount:'0'},
 {id:'custom refined whole credits',kind:'fuel',values:{fuelType:'custom',customFuelType:'refined',customFuelRate:'101.25',fuelTons:'2.25',expenseNotes:'Quoted local price'},bank:'99696',fuel:23,amount:'304'},
 {id:'custom unrefined Cr100',kind:'fuel',fixture:{creditStep:100},values:{fuelType:'custom',customFuelType:'unrefined',customFuelRate:'101.25',fuelTons:'2.25',expenseNotes:'Quoted local price'},bank:'99600',fuel:23,amount:'400'},
 {id:'no-refund fuel correction',kind:'fuel',correction:true,values:{fuelRemaining:'13',fuelReason:'Measured actual remaining'},bank:'100000',fuel:13,amount:null},
 {id:'standard life support',kind:'support',bank:'96000',stock:{numerator:'588',denominator:'5'},amount:'4000'},
 {id:'extra and comfort life support',kind:'support',values:{extraDays:'14',comfortCredits:'2000',comfortNote:'Fresh comfort provisions'},bank:'91900',stock:{numerator:'882',denominator:'5'},amount:'8100'},
 {id:'extra-only full life support',kind:'support',fixture:{full:true},values:{extraDays:'14',comfortCredits:'0',comfortNote:''},bank:'97900',stock:{numerator:'882',denominator:'5'},amount:'2100'},
 {id:'comfort-only full life support',kind:'support',fixture:{full:true},values:{extraDays:'0',comfortCredits:'2000',comfortNote:'Comfort only'},bank:'98000',stock:{numerator:'588',denominator:'5'},amount:'2000'}
];
const representatives=[cases[0],cases[5],cases[7]];
const noSuccess=h=>assert.doesNotMatch(serviceUI(h).message,/Refuelled saved\.|Adjusted fuel aboard saved\.|Refilled life support saved\./i);
const material=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['revision','events'].includes(key)));
const syntheticOffer={offerId:'service-retained-offer',kind:'freight',origin:'0,0',destination:'1,0',quantity:'2',payment:'2000',dueHours:null,audit:{manual:true}};
async function prepare(h,c){
 h.api.services.open(c.kind);
 if(c.correction)await h.serviceAction('service-fuel-correct');
 else if(c.kind==='support'&&c.values)await h.serviceAction('service-adjust');
 if(c.values?.fuelType==='custom')h.fillService({fuelType:'custom'});
 if(c.values)h.fillService(c.values);
 const editorForm=h.serviceForm();
 if(c.correction||(c.kind==='support'&&c.values))await h.serviceAction('service-review');
 assert.equal(h.api.services.active(),true,'Actual service draft is ready');
 assert.equal(h.serviceButton('service-confirm')?.disabled,false,'Actual Confirm is enabled for a valid draft');
 return editorForm;
}
function exactTransaction(h,c,before){
 const saved=h.persisted();assert.equal(saved.revision,before.revision+1);assert.equal(saved.bank,c.bank);
 assert.equal(saved.undo.length,before.undo.length+1);assert.equal(saved.ledger.length,before.ledger.length+(c.amount===null?0:1));
 if(c.fuel!==undefined)assert.equal(saved.ship.fuel.aboardTons,c.fuel);
 else{same(saved.ship.lifeSupport.stockUnits,c.stock);assert.equal(saved.ship.fuel.aboardTons,before.ship.fuel.aboardTons);}
 if(c.amount!==null){assert.equal(saved.ledger.at(-1).amount,c.amount==='0'?'0':'-'+c.amount);assert.equal(saved.ledger.at(-1).world,before.actual);}
 if(c.correction){const events=saved.events.filter(e=>e.fuelCorrection);assert.equal(events.length,1);same(events[0].fuelCorrection,{before:20,after:13,removed:7,reason:c.values.fuelReason,bankChange:'0',world:before.actual});}
 same(saved.lots,before.lots);same(saved.contracts,before.contracts);assert.equal(saved.hours,before.hours);assert.equal(saved.actual,before.actual);
 return saved;
}
async function pending(t,c=cases[0],h=serviceHarness(serviceCampaign(c.fixture))){
 const before=structuredClone(h.api.state),raw=h.bytes(),form=await prepare(h,c);const token=h.api.services.token(),gate=serviceSaveGate(h.store);
 const operation=h.serviceAction('service-confirm');
 t.after(async()=>{for(const entry of gate.entries)if(!entry.settled)entry.fulfill();await operation;gate.restore();});
 await flush();return {h,gate,operation,token,form,before,raw};
}
function assertPending(h,token){
 assert.equal(h.api.services.active(),true,'Service review stays mounted until completion');assert.equal(h.api.services.committing(),true,'Pending completion keeps its action latch');assert.equal(h.api.services.token(),token);
 assert.equal(h.serviceButton('service-confirm')?.disabled,true);for(const button of h.serviceButtons().filter(b=>b.dataset.action))assert.equal(button.disabled,true,'Pending service action '+button.dataset.action+' is disabled');noSuccess(h);
}
function assertTerminal(h){
 assert.equal(h.store.editable,false);assert.equal(h.store.reloadRequired,true);assert.equal(h.api.services.active(),true,'Terminal draft keeps its reload guidance');
 assert.equal(h.serviceButton('service-confirm')?.disabled,true,'Terminal failure cannot offer another payment');
 assert.match(h.api.services.panel(),/reload/i);assert.match(serviceUI(h).message,/reload/i);noSuccess(h);
 assert.equal(h.dom.ids.get('takeover').disabled,true);
}

for(const c of cases)test(`synchronous ${c.id} records exact economics once and real History Undo restores legacy stock`,async()=>{
 const h=serviceHarness(serviceCampaign(c.fixture)),before=structuredClone(h.api.state);await prepare(h,c);const token=h.api.services.token();
 const operation=h.serviceAction('service-confirm');assert.equal(h.counters.writes,1,'Synchronous Store retains immediate write behavior');
 assert.equal(h.api.services.active(),false,'Synchronous completion closes immediately');await operation;exactTransaction(h,c,before);
 const raw=h.bytes();await h.serviceAction('service-confirm','',token);assert.equal(h.counters.writes,1);assert.equal(h.bytes(),raw);
 const reloaded=serviceHarness(h.store.read());assert.equal(reloaded.api.actions.undo(),undefined);same(material(reloaded.persisted()),material(before));assert.equal(reloaded.counters.writes,1);
});

for(const c of cases)test(`${c===cases[0]||c===cases[5]||c===cases[7]?'baseline probe: ':''}delayed ${c.id} stays pending through durable write/publication and closes only at fulfillment`,async t=>{
 const {h,gate,operation,token,before,raw}=await pending(t,c);assert.equal(gate.entries.length,1);assert.equal(h.bytes(),raw);same(h.api.state,before);assertPending(h,token);
 gate.entries[0].write();assert.equal(h.counters.writes,1);assert.equal(h.counters.notifications,1);exactTransaction(h,c,before);assertPending(h,token);
 gate.entries[0].fulfill();await operation;assert.equal(h.api.services.active(),false);assert.equal(h.counters.writes,1);assert.match(serviceUI(h).message,/saved\./);
 for(const snapshot of h.trace)assert.doesNotMatch(snapshot.message,/saved\./,'No success banner precedes durable write/publication');
});

for(const c of cases)test(`known delayed prewrite failure keeps the exact ${c.id} retry draft and one later payment`,async t=>{
 const {h,gate,operation,token,before,raw}=await pending(t,c);h.failNext();gate.entries[0].fulfill();await operation;
 assert.equal(h.bytes(),raw);same(h.api.state,before);assert.equal(h.counters.writes,0);assert.equal(h.counters.notifications,0);assert.equal(h.api.services.active(),true,'Known failure retains the original retry draft');assert.equal(h.api.services.token(),token);assert.equal(h.api.services.committing(),false);assert.equal(h.serviceButton('service-confirm').disabled,false);assert.match(h.api.services.panel(),/quota/i);noSuccess(h);
 if(c.values){await h.serviceAction(c.correction||c.kind==='support'?'service-adjust':'service-review');for(const [name,value]of Object.entries(c.values)){const field=h.serviceFields().get(name);assert.ok(field,'Retained field '+name);assert.equal(field.attributes.type==='checkbox'?field.checked:field.value,String(value));}if(c.correction||c.kind==='support')await h.serviceAction('service-review');}
 const retry=h.serviceAction('service-confirm');await flush();assert.equal(gate.entries.length,2);await h.serviceAction('service-confirm');assert.equal(gate.entries.length,2);
 gate.entries[1].fulfill();await retry;assert.equal(h.counters.attempts,2);assert.equal(h.counters.writes,1);exactTransaction(h,c,before);
});

for(const c of representatives)test(`pending ${c.id} ignores repeated confirm, detached actions/forms and attempted editor mutations`,async t=>{
 const {h,gate,operation,token,form,before}=await pending(t,c);const candidate=JSON.stringify(gate.entries[0].args[0]);
 await h.serviceAction('service-confirm','',token);await h.serviceAction('service-review','',token);if(form)h.submitService(form);
 const frozenFields=serviceUI(h).fields;
 for(const field of h.serviceFields().values()){assert.equal(field.disabled,true,'Every pending input/select is disabled');field.value=field.name.includes('Note')?'Tampered while pending':'999';field.checked=true;}h.api.services.sync();same(serviceUI(h).fields,frozenFields);
 for(const action of ['service-fuel-step','service-fuel-topoff','service-fuel-next','service-fuel-correct','service-adjust'])await h.serviceAction(action,'10',token);
 await flush();assert.equal(gate.entries.length,1);assert.equal(JSON.stringify(gate.entries[0].args[0]),candidate,'Pending payload stays isolated');assertPending(h,token);
 gate.entries[0].fulfill();await operation;exactTransaction(h,c,before);const raw=h.bytes();await h.serviceAction('service-confirm','',token);if(form)h.submitService(form);await flush();assert.equal(gate.entries.length,1);assert.equal(h.bytes(),raw);
});

for(const c of representatives)for(const leave of ['Back','Cancel','Escape','other service','same service toggle','main navigation','expanded map','cargo'])test(`pending ${c.id} blocks ${leave} without abandoning the payment`,async t=>{
 const {h,gate,operation,token,raw}=await pending(t,c);
 if(leave==='Back')await h.serviceAction('service-back');
 if(leave==='Cancel')await h.serviceAction('service-cancel');
 if(leave==='Escape')h.escapeService();
 if(leave==='other service')assert.throws(()=>h.api.services.open(c.kind==='fuel'?'support':'fuel'),/finish saving/);
 if(leave==='same service toggle')assert.throws(()=>h.api.toggleShipPanel(c.kind==='fuel'?'refuel':'refill-support'),/finish saving/);
 if(leave==='main navigation')await h.runAction('tab','History');
 if(leave==='expanded map')await h.runAction('map-expand');
 if(leave==='cargo')await h.runAction('cargo-hold');
 await flush();assertPending(h,token);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,1);gate.entries[0].fulfill();await operation;assert.equal(h.counters.writes,1);
});

for(const c of representatives)for(const loss of ['disk revision','published revision','editing authority'])test(`delayed ${c.id} respects ${loss} at real Store settlement and cannot overwrite the authoritative state`,async t=>{
 const {h,gate,operation,token}=await pending(t,c);
 if(loss==='editing authority')h.store.yield();else h.external(S.transition(h.persisted(),'External deposit',s=>S.deposit(s,23,'External')),{publish:loss==='published revision'});
 const raw=h.bytes(),before=structuredClone(h.api.state);gate.entries[0].fulfill();await operation;
 assert.equal(h.bytes(),raw);same(h.api.state,before);assert.equal(h.counters.writes,0);assert.equal(h.api.services.token(),token);noSuccess(h);assert.match(h.api.services.panel(),/stale|changed|read-only|editing/i);
 if(loss!=='disk revision')assert.equal(h.serviceButton('service-confirm').disabled,true,'Observed revision/ownership invalidates its generation');
 if(loss==='editing authority'){h.store.editable=true;h.api.services.syncControls();}
 const retry=h.serviceAction('service-confirm','',token);await flush();for(const entry of gate.entries)if(!entry.settled)entry.fulfill();await retry;assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);assert.equal(gate.entries.length,loss==='disk revision'?2:1,'An unseen disk revision is rechecked by Store; observed invalidation blocks provider retry');
});

for(const c of representatives)test(`${c===cases[0]?'baseline probe: ':''}external same-revision publication permanently invalidates ${c.id} until a fresh service opens`,async()=>{
 const h=serviceHarness(serviceCampaign(c.fixture));await prepare(h,c);const token=h.api.services.token(),raw=h.bytes();h.external(structuredClone(h.persisted()));
 assert.equal(h.serviceButton('service-confirm').disabled,true,'A replaced same-revision campaign cannot reuse the old draft');await h.serviceAction('service-confirm','',token);assert.equal(h.counters.writes,0);assert.equal(h.bytes(),raw);noSuccess(h);
 await h.serviceAction('service-cancel');await prepare(h,c);await h.serviceAction('service-confirm');assert.equal(h.counters.writes,1);
});

for(const c of representatives)for(const point of ['beforeNotify','afterNotify'])for(const roleThrows of [false,true])test(`${c.id} committed ${point} failure is reload-only, including role callback throw=${roleThrows}`,async t=>{
 const {h,gate,operation,token,before}=await pending(t,c);h.hooks[point]=()=>{throw Error('Injected '+point+' publication failure');};if(roleThrows)h.hooks.onRole=()=>{throw Error('Injected role callback failure');};
 gate.entries[0].fulfill();await operation;assertTerminal(h);assert.equal(h.counters.writes,1);exactTransaction(h,c,before);assert.equal(h.api.state.revision,point==='beforeNotify'?0:1);
 const raw=h.bytes();await h.serviceAction('service-confirm','',token);await h.serviceAction('service-review','',token);h.api.services.syncControls();assertTerminal(h);assert.equal(gate.entries.length,1);assert.equal(h.bytes(),raw);
 const reloaded=serviceHarness(h.store.read());reloaded.api.actions.undo();same(material(reloaded.persisted()),material(before));
});

for(const c of representatives)for(const afterWrite of [false,true])test(`${c.id} unknown ${afterWrite?'after':'before'}-write rejection is terminal and never guessed safe to retry`,async t=>{
 const {h,gate,operation,token,before,raw}=await pending(t,c);if(afterWrite)gate.entries[0].write();gate.entries[0].reject();await operation;
 assertTerminal(h);assert.equal(h.counters.writes,afterWrite?1:0);if(afterWrite)exactTransaction(h,c,before);else{assert.equal(h.bytes(),raw);same(h.api.state,before);}
 const disk=h.bytes();await h.serviceAction('service-confirm','',token);assert.equal(gate.entries.length,1);assert.equal(h.bytes(),disk);
 await h.store.acquire(true);assertTerminal(h);await h.serviceAction('service-cancel');await h.runAction(c.kind==='fuel'?'refuel':'refill-support');assert.equal(h.counters.writes,afterWrite?1:0);assert.equal(h.bytes(),disk);
 const reloaded=serviceHarness(h.store.read());if(afterWrite){reloaded.api.actions.undo();same(material(reloaded.persisted()),material(before));}else same(reloaded.persisted(),before);
});

test('own delayed service publication preserves unrelated offers and consumes its provenance only once',async t=>{
 const h=serviceHarness();h.api.setDrafts([syntheticOffer]);const {gate,operation}=await pending(t,cases[0],h);assert.equal(h.api.controller.isLocalSave(),false);
 const token=gate.entries[0].args[2];assert.ok(token);gate.entries[0].fulfill();await operation;same(h.api.drafts,[syntheticOffer]);assert.equal(h.notifications[0].metadata.saveToken,token);
 await prepare(h,cases[6]);h.api.setState(h.api.state,h.notifications[0].metadata);assert.equal(h.api.drafts.length,0);assert.equal(h.serviceButton('service-confirm').disabled,true,'Replayed own token becomes external to new draft');
});

test('real delayed no-refund correction releases occupied bladder cargo and reload/Undo restores it exactly',async t=>{
 const c={...cases[5],values:{fuelRemaining:'41',fuelReason:'Tank measurement'}},s=serviceCampaign();s.ship.fuel=configureFuel(200,43,55,40,2);
 const {h,gate,operation,before}=await pending(t,c,serviceHarness(s));assert.equal(bladderSpace(before.ship),12);gate.entries[0].fulfill();await operation;
 const saved=h.persisted();assert.equal(saved.ship.fuel.aboardTons,41);assert.equal(bladderSpace(saved.ship),0);assert.equal(saved.bank,before.bank);assert.equal(saved.ledger.length,before.ledger.length);assert.equal(saved.events.find(e=>e.fuelCorrection).fuelCorrection.removed,14);
 const reloaded=serviceHarness(h.store.read());reloaded.api.actions.undo();same(material(reloaded.persisted()),material(before));assert.equal(bladderSpace(reloaded.persisted().ship),12);
});

test('unchanged legacy baseline refuels bladders through delayed completion and History Undo restores original structure',async t=>{
 const s=campaignBaseline(),c={kind:'fuel',values:{fuelType:'refined',fuelTons:'20'}},before=structuredClone(s),{h,gate,operation,token}=await pending(t,c,serviceHarness(s));
 assertPending(h,token);gate.entries[0].fulfill();await operation;assert.equal(h.persisted().bank,'390000');same(h.persisted().ship.fuel,{...before.ship.fuel,aboardTons:60});
 const reloaded=serviceHarness(h.store.read());reloaded.api.actions.undo();same(material(reloaded.persisted()),material(before));
});

test('service save completion does not alter synchronous provider return or ordinary expense/deposit contracts',async()=>{
 const h=serviceHarness();const candidate=S.transition(h.api.state,'Legacy direct save',s=>S.deposit(s,1,'Direct provider'));
 assert.equal(h.store.save(candidate,0),undefined);assert.equal(h.counters.writes,1);assert.equal(h.api.controller.undo(1),undefined);
 h.api.actions.expense();h.fill({amount:17,reason:'Legacy expense'});const expense=h.submit();assert.equal(h.persisted().bank,'99983');assert.match(h.dom.ids.get('message').textContent,/Manual expense saved\./);await expense;
 h.api.actions.deposit();h.fill({amount:'10.1',reason:'Existing deposit completion'});await h.submit();await h.submit();assert.equal(h.persisted().bank,'99994');assert.match(h.dom.ids.get('message').textContent,/Manual deposit saved\./);
 assert.equal(h.persisted().ledger.length,2);assert.equal(supportStock(h.persisted().ship).remainingUnits,'58.8');
});

for(const c of representatives)for(const outcome of ['fulfillment','known prewrite failure'])test(`same-revision external publication while ${c.id} is pending respects provider ${outcome} without reviving its generation`,async t=>{
 const h=serviceHarness(serviceCampaign(c.fixture));h.api.setDrafts([syntheticOffer]);const {gate,operation,token,before}=await pending(t,c,h);
 h.external(structuredClone(h.persisted()));assert.equal(h.api.drafts.length,0,'Tokenless notification stays external');
 // An already invoked provider cannot be canceled by this UI. If its revision
 // still matches it may fulfill; if it rejects, invalidation forbids retry.
 if(outcome==='known prewrite failure')h.failNext();gate.entries[0].fulfill();await operation;
 if(outcome==='fulfillment'){exactTransaction(h,c,before);assert.equal(h.api.services.active(),false);}
 else{assert.equal(h.counters.writes,0);same(h.api.state,before);assert.equal(h.serviceButton('service-confirm').disabled,true);}
 const disk=h.bytes();await h.serviceAction('service-confirm','',token);assert.equal(gate.entries.length,1);assert.equal(h.bytes(),disk);
});

for(const c of representatives)for(const point of ['success banner','service cleanup render'])test(`committed ${c.id} ${point} failure becomes reload-only without losing its durable transaction`,async t=>{
 const {h,gate,operation,before}=await pending(t,c);let injected=false;
 if(point==='success banner'){
  const banner=h.dom.ids.get('message');let value=banner.textContent;
  Object.defineProperty(banner,'textContent',{get:()=>value,set(next){if(/saved\.$/.test(next)){injected=true;throw Error('Injected success banner fault');}value=next;}});
 }else{
  const main=h.dom.ids.get('main'),descriptor=Object.getOwnPropertyDescriptor(main,'innerHTML');
  Object.defineProperty(main,'innerHTML',{...descriptor,set(html){if(h.counters.writes===1&&!h.api.services.active()&&!injected){injected=true;throw Error('Injected completed service render fault');}descriptor.set(html);}});
 }
 gate.entries[0].fulfill();await operation;assert.equal(injected,true,'The intended production callback was exercised');assertTerminal(h);assert.equal(h.counters.writes,1);exactTransaction(h,c,before);
 const disk=h.bytes();await h.serviceAction('service-confirm');assert.equal(h.bytes(),disk);assert.equal(gate.entries.length,1);
});
