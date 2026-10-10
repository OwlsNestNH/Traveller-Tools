import test from 'node:test';
import assert from 'node:assert/strict';
import {campaign,core,origin,destination,bindings,S,same} from './app-harness.mjs';
import {depositHarness,deferredSave,flush,ui} from './deposit-save-harness.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {recordWorldOverride,revertWorldField,worldOverrideSnapshot,worldChangeFields,worldFieldRevertEligibility,validateWorldChangeHistory} from '../js/world-change-history.mjs';

// Native actual-app integration: real rules, campaign transitions and Store;
// the shared harness doubles only the DOM and storage boundary, not handlers.
const roundtrip=s=>S.validate(JSON.parse(JSON.stringify(s)));
const audits=s=>s.events.filter(e=>e.worldChangeAudit?.version===1);
const latest=s=>audits(s).at(-1);
const eligibility=(s,event,key='techLevel')=>worldFieldRevertEligibility(s,event.id,key,core);
function edit(s,values={},worldId=origin.id){
 const w=s.worlds[worldId];
 return S.transition(s,'World override',next=>recordWorldOverride(next,worldId,{uwp:w.overrideUWP||w.uwp,zone:w.zone,fuelOverride:w.fuelOverride??null,accessibleWater:w.accessibleWater===true,reason:'Referee survey',...values},core));
}
const restore=(s,event,key='techLevel')=>S.transition(s,'World field reverted',next=>revertWorldField(next,event.id,key,core));
const setup=s=>{const h=depositHarness(s,{setTimeout:()=>0,clearTimeout(){}});h.api.setTab('History');h.api.render();return h;};
const open=(h,event,key='techLevel')=>h.api.actions['world-field-revert'](event.id+'|'+key);
const submitEvent=h=>({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});
const material=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['revision','events','undo','dashboardBaseline'].includes(key)));
const unchanged=(h,raw,state)=>{assert.equal(h.bytes(),raw);same(h.api.state,state);assert.equal(h.counters.writes,0);};
const noSuccess=h=>assert.doesNotMatch(ui(h).message,/saved\.|undone\.|replaced\./i);
const roll=()=>({dice:[2,2,2,2,2,2],total:12});
function jump(s){const p=S.prepareJump(s,roll);return S.transition(p.state,'Jump: Origin → Destination',next=>S.commitJump(next,{attemptId:p.attempt.id,elapsed:160}));}
function economics(){
 const s=campaign();s.ship.capacity='100';s.ship.fuel=configureFuel(200,40,60,40,2);
 s.ship.lifeSupport={capacityHours:672,remainingHours:672,elapsedHours:0};
 s.lots=[{id:'cargo',commodity:'11',description:'Saved cargo',quantity:'5',basis:'1000',goodsValue:'1000'}];
 s.contracts=[{id:'freight',kind:'freight',status:'accepted',origin:origin.id,destination:destination.id,quantity:'5',payment:'1000',dueHours:null}];
 s.policies=[{id:'policy',lotId:'cargo',claims:[],status:'active',initialQuantity:'5',remainingQuantity:'5',insuredValue:'1000',remainingValue:'1000',coverage:70,route:[origin.id,destination.id],routeProgress:0,destination:destination.id}];
 s.snapshots=[{id:'supplier',kind:'supplier',worldId:origin.id,world:bindings.R.context(s.worlds[origin.id],core),party:'supplier',partyName:'Saved supplier',hours:0,startedHours:0,offers:[{id:'quote',commodity:'11',description:'Saved quote',expired:false,remaining:'2',unitPrice:'1234',audit:{dice:[3,3,3],total:9}}]}];
 return S.validate(s);
}

test('world override records immutable target-world identity, exact optional-field presence, reason and before/after values',()=>{
 const initial=campaign(),before=structuredClone(initial),s=edit(initial,{uwp:'A788899-D',reason:'  Remote survey <confirmed>  '},destination.id),event=latest(s),audit=event.worldChangeAudit;
 same(initial,before);assert.equal(s.actual,origin.id);assert.equal(event.world,destination.id);assert.equal(event.hours,0);assert.equal(event.reason,'Remote survey <confirmed>');
 same({worldId:audit.worldId,worldName:audit.worldName,sector:audit.sector,hex:audit.hex},{worldId:destination.id,worldName:destination.name,sector:destination.sector,hex:destination.hex});
 same(audit.before,{publishedUWP:'A788899-C',overrideUWP:{present:false},zone:{present:true,value:'Safe'},fuelOverride:{present:false},accessibleWater:{present:false}});
 same(audit.after,worldOverrideSnapshot(s.worlds[destination.id]));
 assert.equal(s.undo.at(-1).worldChangeEventId,event.id);assert.equal(s.events.at(-1).worldChangeEventId,event.id);
 const retained=structuredClone(event),later=edit(s,{uwp:'B788899-D',zone:'Amber'},destination.id);later.worlds[destination.id].name='Renamed current world';later.worlds[destination.id].raw={UWP:'C000000-0'};
 same(later.events.find(e=>e.id===event.id),retained);same(s.events.find(e=>e.id===event.id),retained);same(roundtrip(later).events.find(e=>e.id===event.id),retained);
 const h=setup(later),details=h.api.historyDetails(event);assert.match(details,/Destination · Test 0201/);assert.doesNotMatch(details,/Renamed current world/);assert.match(details,/Remote survey &lt;confirmed&gt;/);
});

test('semantic TL correction preserves later UWP digits, zone, fuel, water, jump, accounts, cargo, contracts, insurance and saved quotes',()=>{
 let s=edit(economics(),{uwp:'A788899-D'}),event=latest(s);s=edit(s,{uwp:'B563456-D',zone:'Amber',fuelOverride:true,accessibleWater:true});
 s=jump(s);s=S.transition(s,'Manual deposit',next=>S.deposit(next,75,'Later receipt'));
 const before=structuredClone(s),originalAudit=structuredClone(event),after=restore(roundtrip(s),event),correction=latest(after);
 assert.equal(eligibility(before,event).allowed,true);assert.equal(after.worlds[origin.id].overrideUWP,'B563456-C');
 for(const key of ['zone','fuelOverride','accessibleWater','uwp'])assert.equal(after.worlds[origin.id][key],before.worlds[origin.id][key]);
 for(const key of ['actual','hours','bank','dateLabel','route','routeIndex','ship','lots','contracts','policies','ledger','snapshots','jumpAttempts','cooldowns','settings','trader'])same(after[key],before[key]);
 same(after.worlds[destination.id],before.worlds[destination.id]);same(after.events.slice(0,before.events.length),before.events);same(after.undo.slice(0,before.undo.length),before.undo);
 same(after.events.find(e=>e.id===event.id),originalAudit);assert.equal(correction.worldChangeAudit.kind,'revert');assert.equal(correction.worldChangeAudit.sourceEventId,event.id);assert.equal(correction.worldChangeAudit.field,'techLevel');
 same(worldChangeFields(correction),[{key:'techLevel',label:'Tech level',before:'D',after:'C'}]);assert.equal(after.revision,before.revision+1);same(roundtrip(after),after);
});

test('restoring the sole UWP change deletes an originally absent override, while other changed digits keep an override',()=>{
 const original=campaign(),edited=edit(original,{uwp:'A788899-D'}),event=latest(edited),restored=restore(edited,event);
 assert.equal(Object.hasOwn(restored.worlds[origin.id],'overrideUWP'),false);assert.equal(restored.worlds[origin.id].uwp,'A788899-C');
 const unrelated=edit(edited,{uwp:'B788899-D'}),partial=restore(unrelated,event);assert.equal(partial.worlds[origin.id].overrideUWP,'B788899-C');
});

test('previous UWP may itself be an override and restores that value rather than the published digit',()=>{
 const initial=campaign();initial.worlds[origin.id].overrideUWP='A788899-A';
 const edited=edit(initial,{uwp:'A788899-D'}),restored=restore(edited,latest(edited));assert.equal(restored.worlds[origin.id].overrideUWP,'A788899-A');assert.equal(restored.worlds[origin.id].uwp,'A788899-C');
});

for(const [key,values]of [['zone',{zone:'Red'}],['fuelOverride',{fuelOverride:true}],['accessibleWater',{accessibleWater:true}]])test(`restoring ${key} only preserves the complete current UWP and other world values`,()=>{
 let s=edit(campaign(),values),event=latest(s);s=edit(s,{uwp:'B563456-8'});const before=structuredClone(s.worlds[origin.id]),after=restore(s,event,key),world=after.worlds[origin.id];
 assert.equal(world.overrideUWP,before.overrideUWP);for(const property of ['zone','fuelOverride','accessibleWater'].filter(k=>k!==key))assert.equal(world[property],before[property]);
 if(key==='zone')assert.equal(world.zone,'Safe');else assert.equal(Object.hasOwn(world,key),false);
 same(worldChangeFields(latest(after)).map(c=>c.key),[key]);same(roundtrip(after),after);
});

test('per-field conflict blocks an older same-field change even if the latest edit returns to the old recorded value',()=>{
 let s=edit(campaign(),{uwp:'A788899-D'}),first=latest(s);s=edit(s,{uwp:'A788899-E'});const second=latest(s);s=edit(s,{uwp:'A788899-D',zone:'Amber'});const third=latest(s);
 for(const event of [first,second]){assert.equal(eligibility(s,event).allowed,false);assert.match(eligibility(s,event).reason,/later change/);assert.throws(()=>restore(s,event),/later change/);}
 assert.equal(eligibility(s,third).allowed,true);assert.equal(eligibility(s,third,'zone').allowed,true);
 const next=restore(s,third);assert.equal(next.worlds[origin.id].overrideUWP,'A788899-E');assert.equal(eligibility(next,third,'zone').allowed,true);assert.equal(eligibility(next,third).allowed,false);
});

test('later changes to another world do not conflict, and globally undone changes stop being live blockers',()=>{
 let s=edit(campaign(),{uwp:'A788899-D'}),first=latest(s);s=edit(s,{uwp:'A788899-E'},destination.id);assert.equal(eligibility(s,first).allowed,true);
 s=edit(s,{uwp:'A788899-F'});assert.equal(eligibility(s,first).allowed,false);s=S.undo(s);assert.equal(eligibility(s,first).allowed,true);
 const removed=latest(s);assert.equal(eligibility(s,removed).allowed,false);assert.match(eligibility(s,removed).reason,/already undone/);
});

for(const kind of ['missing Undo record','missing target world','current value diverged','later legacy edit'])test(`selective restore refuses ${kind} without modifying the campaign`,()=>{
 let s=edit(campaign(),{uwp:'A788899-D'},destination.id),event=latest(s);
 if(kind==='missing Undo record')s.undo=[];
 if(kind==='missing target world')delete s.worlds[destination.id];
 if(kind==='current value diverged')s.worlds[destination.id].overrideUWP='A788899-E';
 if(kind==='later legacy edit')s=S.transition(s,'World override',next=>{next.worlds[origin.id].zone='Amber';});
 const before=structuredClone(s),eligible=eligibility(s,event);assert.equal(eligible.allowed,false);assert.ok(eligible.reason);assert.throws(()=>revertWorldField(s,event.id,'techLevel',core));same(s,before);
});

test('legacy generic world history remains readable and explicitly unavailable, with no guessed previous values',()=>{
 const legacy=S.transition(campaign(),'World override',s=>{s.worlds[destination.id].overrideUWP='A788899-D';}),event=legacy.events.at(-1),saved=roundtrip(legacy),h=setup(saved),raw=h.bytes();
 assert.equal(eligibility(saved,event).allowed,false);assert.deepEqual(worldChangeFields(event),[]);assert.match(h.api.historyDetails(event),/older entry.*complete target-world/);assert.match(h.api.historyDetails(event),/Individual restore is unavailable/);assert.doesNotMatch(h.api.historyDetails(event),/data-action="world-field-revert"/);
 assert.equal(h.api.historyCategory(event),'World Changes');h.api.actions['event-audit'](event.id);assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);assert.match(ui(h).modalTitle,/History entry/);
});

test('unrelated custom history and unsupported future world audit versions round-trip unchanged without selective controls',()=>{
 const s=campaign();s.events.push({id:'custom',label:'Referee custom event',hours:1,custom:{version:1,notes:['Keep this extension']}},{id:'future-world',label:'Future custom world event',hours:2,worldChangeAudit:{version:42,data:'Opaque future payload'}});
 const before=structuredClone(s.events),saved=roundtrip(s),h=setup(saved);same(saved.events,before);
 for(const event of saved.events){assert.deepEqual(worldChangeFields(event),[]);assert.equal(eligibility(saved,event).allowed,false);assert.doesNotMatch(h.api.historyDetails(event),/data-action="world-field-revert"/);}
 assert.match(h.api.historyPanel(),/Referee custom event/);assert.match(h.api.historyPanel(),/Future custom world event/);assert.equal(h.counters.writes,0);
});

const malformed=[
 ['wrong label',(s,e)=>{e.label='Custom event';}],['target mismatch',(s,e)=>{e.world=destination.id;}],['invalid world ID',(s,e)=>{e.world=e.worldChangeAudit.worldId='bad/id';}],
 ['missing world name',(s,e)=>{delete e.worldChangeAudit.worldName;}],['invalid sector',(s,e)=>{e.worldChangeAudit.sector=3;}],['invalid hex',(s,e)=>{e.worldChangeAudit.hex='123';}],['unknown operation',(s,e)=>{e.worldChangeAudit.kind='remove';}],['empty reason',(s,e)=>{e.reason=' ';}],
 ['missing snapshot',(s,e)=>{delete e.worldChangeAudit.before;}],['missing field slot',(s,e)=>{delete e.worldChangeAudit.before.zone;}],['non-boolean presence',(s,e)=>{e.worldChangeAudit.before.overrideUWP.present=0;}],['absent slot with value',(s,e)=>{e.worldChangeAudit.before.overrideUWP.value='A788899-C';}],['present slot without value',(s,e)=>{delete e.worldChangeAudit.after.overrideUWP.value;}],
 ['numeric UWP',(s,e)=>{e.worldChangeAudit.after.overrideUWP.value=123;}],['unknown zone',(s,e)=>{e.worldChangeAudit.after.zone.value='Green';}],['string fuel override',(s,e)=>{e.worldChangeAudit.after.fuelOverride.value='yes';}],['string accessible water',(s,e)=>{e.worldChangeAudit.after.accessibleWater.value='yes';}],['published UWP changed',(s,e)=>{e.worldChangeAudit.after.publishedUWP='B788899-C';}],
 ['missing Undo audit',(s)=>{s.undo.at(-1).worldChangeEventId='missing';}],['duplicate Undo audit link',s=>{s.undo.push({...structuredClone(s.undo[0]),id:'duplicate-link'});}],['wrong Undo label',s=>{s.undo.at(-1).label='Deposit';}],['broken summary audit link',s=>{s.events.at(-1).worldChangeEventId='missing';}],['missing summary revision',s=>{delete s.events.at(-1).revision;}]
];
for(const [label,mutate]of malformed)test(`import rejects malformed v1 world history: ${label}`,()=>{
 const bad=edit(campaign(),{uwp:'A788899-D'});mutate(bad,latest(bad));assert.throws(()=>roundtrip(bad),/world-change|world corrections|history/i);
});
for(const [label,mutate]of [
 ['missing source',audit=>{audit.sourceEventId='missing';}],['wrong field',audit=>{audit.field='zone';}],['wrong previous value',audit=>{audit.after.overrideUWP={present:true,value:'A788899-E'};}],['multiple restored fields',audit=>{audit.after.zone={present:true,value:'Red'};}]
])test(`import rejects a forged field-revert audit with ${label}`,()=>{
 const edited=edit(campaign(),{uwp:'A788899-D'}),bad=restore(edited,latest(edited));mutate(latest(bad).worldChangeAudit);assert.throws(()=>roundtrip(bad),/world-change revert audit/);
});

test('History groups each audited action once, shows readable changes and selects World Changes without writing',()=>{
 const s=edit(campaign(),{uwp:'A788899-D',zone:'Amber'},destination.id),event=latest(s),h=setup(s),before=h.bytes();
 const panel=h.api.historyPanel();assert.match(panel,/World Changes \(1\)/);assert.match(panel,/Tech level: C → D/);assert.match(panel,/Travel zone: Safe → Amber/);assert.equal((panel.match(/data-action="event-audit"/g)||[]).length,1);
 h.api.actions['history-filter']('World Changes');assert.equal((h.api.historyPanel().match(/data-action="event-audit"/g)||[]).length,1);
 h.api.actions['event-audit'](event.id);const details=h.dom.ids.get('modal-body').innerHTML;assert.match(details,/Restore previous tech level/);assert.match(details,/previous value.*another override/);assert.equal(h.bytes(),before);assert.equal(h.counters.writes,0);
});

test('a confirmed correction persists once, reloads and imports with its audit, and global Undo restores only that correction',async()=>{
 const source=edit(campaign(),{uwp:'A788899-D'}),event=latest(source),h=setup(source);open(h,event);assert.match(ui(h).modalTitle,/Restore previous tech level/);assert.match(h.dom.ids.get('modal-body').innerHTML,/Previous value to restore/);assert.equal(h.counters.writes,0);
 await h.submit();assert.equal(h.counters.writes,1);assert.equal(ui(h).modalOpen,false);assert.match(ui(h).message,/World field reverted saved/);const saved=h.persisted(),correction=latest(saved);
 assert.equal(correction.worldChangeAudit.kind,'revert');assert.equal(saved.undo.at(-1).worldChangeEventId,correction.id);same(h.store.read(),saved);
 const reloaded=setup(roundtrip(saved));reloaded.api.actions.undo();const undone=reloaded.persisted();same(material(undone),material(source));same(undone.events.slice(0,saved.events.length),saved.events);assert.equal(undone.events.at(-1).label,'Undo: World field reverted');assert.equal(eligibility(undone,event).allowed,true);assert.equal(eligibility(undone,correction).allowed,false);
 const imported=setup(campaign());imported.api.backupReplace('Import campaign',roundtrip(saved));imported.fill({backed:true});await imported.submit();assert.equal(imported.counters.writes,1);same(material(imported.persisted()),material(saved));same(imported.persisted().events,saved.events);assert.equal(eligibility(imported.persisted(),correction).allowed,true);imported.api.actions.undo();same(material(imported.persisted()),material(source));
});

for(const dismiss of ['Cancel','Close','Escape'])test(`cancelled correction via ${dismiss} and its detached submit never writes`,async()=>{
 const s=edit(campaign(),{uwp:'A788899-D'}),h=setup(s),raw=h.bytes(),before=structuredClone(h.api.state);open(h,latest(s));const detached=h.dom.ids.get('modal-form').onsubmit;
 if(dismiss==='Cancel')h.dom.ids.get('modal-cancel').onclick();if(dismiss==='Close')h.dom.ids.get('modal-close').onclick();if(dismiss==='Escape')h.dom.ids.get('modal').dispatch('cancel',{preventDefault(){}});
 await detached(submitEvent(h));unchanged(h,raw,before);assert.equal(ui(h).modalOpen,false);noSuccess(h);
});

test('read-only History keeps audit readable, disables restore controls and rejects a direct restore action without writes',async()=>{
 const s=edit(campaign(),{uwp:'A788899-D'}),h=setup(s),event=latest(s),raw=h.bytes(),before=structuredClone(h.api.state);h.store.yield();
 const html=h.api.historyDetails(event);assert.match(html,/Read-only: take over editing/);assert.match(html,/<button disabled[^>]*data-action="world-field-revert"/);await h.runAction('world-field-revert',event.id+'|techLevel');
 unchanged(h,raw,before);assert.match(ui(h).message,/read-only/i);assert.equal(ui(h).modalOpen,false);noSuccess(h);
});

for(const loss of ['disk revision','published revision','editing authority'])test(`correction confirmation rejects ${loss} and preserves the current campaign without a write`,async()=>{
 const s=edit(campaign(),{uwp:'A788899-D'}),h=setup(s);open(h,latest(s));
 if(loss==='editing authority')h.store.yield();else h.external(S.transition(s,'Later deposit',next=>S.deposit(next,23,'External tab')),{publish:loss==='published revision'});
 const raw=h.bytes(),before=structuredClone(h.api.state);await h.submit();unchanged(h,raw,before);noSuccess(h);
 if(loss==='editing authority')assert.equal(ui(h).submitDisabled,true);else assert.match(ui(h).modalError,/stale|changed/i);
});

test('quota failure keeps exact bytes and review intact, and one explicit retry creates one correction',async()=>{
 const s=edit(campaign(),{uwp:'A788899-D'}),h=setup(s),raw=h.bytes(),before=structuredClone(h.api.state);open(h,latest(s));const body=h.dom.ids.get('modal-body').innerHTML;h.failNext();await h.submit();
 unchanged(h,raw,before);assert.equal(ui(h).modalOpen,true);assert.equal(ui(h).submitDisabled,false);assert.match(ui(h).modalError,/quota/i);assert.equal(h.dom.ids.get('modal-body').innerHTML,body);noSuccess(h);
 await h.submit();assert.equal(h.counters.attempts,2);assert.equal(h.counters.writes,1);assert.equal(audits(h.persisted()).length,2);assert.equal(ui(h).modalOpen,false);
});

async function pendingCorrection(t){
 const s=edit(campaign(),{uwp:'A788899-D'}),h=setup(s);open(h,latest(s));const gate=deferredSave(h.store),detached=h.dom.ids.get('modal-form').onsubmit,operation=h.submit();operation.catch(()=>{});
 t.after(async()=>{for(const entry of gate.pending)if(!entry.settled)entry.resolve();await operation;gate.restore();});await flush();return {h,gate,operation,detached};
}

test('duplicate correction confirmations and detached submits share one pending durable write',async t=>{
 const {h,gate,operation,detached}=await pendingCorrection(t),raw=h.bytes(),before=structuredClone(h.api.state);assert.equal(h.api.modalSession.busy,true);assert.equal(ui(h).submitDisabled,true);unchanged(h,raw,before);
 await h.submit();await detached(submitEvent(h));assert.equal(gate.pending.length,1);assert.equal(h.api.closeModal(),false);assert.equal(ui(h).modalOpen,true);noSuccess(h);
 gate.pending[0].resolve();await operation;assert.equal(h.counters.writes,1);assert.equal(audits(h.persisted()).length,2);const saved=h.bytes();await detached(submitEvent(h));assert.equal(h.bytes(),saved);assert.equal(gate.pending.length,1);
});

for(const loss of ['disk revision','published revision','editing authority'])test(`pending correction rechecks ${loss} at durable settlement`,async t=>{
 const {h,gate,operation}=await pendingCorrection(t);
 if(loss==='editing authority')h.store.yield();else h.external(S.transition(h.persisted(),'External deposit',next=>S.deposit(next,23,'External')),{publish:loss==='published revision'});
 const raw=h.bytes(),before=structuredClone(h.api.state);gate.pending[0].resolve();await operation;unchanged(h,raw,before);noSuccess(h);assert.match(ui(h).modalError,/stale|changed|read-only|editing/i);
});

for(const outcome of ['committed publication failure','unknown outcome'])test(`terminal correction ${outcome} prevents a duplicate save and names the correction correctly`,async t=>{
 const {h,gate,operation,detached}=await pendingCorrection(t);
 if(outcome==='committed publication failure'){h.hooks.beforeNotify=()=>{throw Error('Injected rendering failure');};gate.pending[0].resolve();}else gate.pending[0].reject(Error('Unknown provider outcome'));
 await operation;assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.equal(ui(h).submitDisabled,true);assert.match(ui(h).modalError,/reload/i);assert.doesNotMatch(ui(h).modalError,/deposit/i);
 const saved=h.bytes(),writes=h.counters.writes;await h.submit();await detached(submitEvent(h));assert.equal(h.bytes(),saved);assert.equal(h.counters.writes,writes);assert.equal(gate.pending.length,1);
});

for(const protectedBy of ['later change','spent mulligan'])test(`History protected jump click warns without writing when blocked by ${protectedBy}, while state guards stay enforced`,async()=>{
 let s=jump(campaign());
 if(protectedBy==='later change'){s=S.transition(s,'Deposit',next=>S.deposit(next,1,'Later action'));s=S.undo(s);}else{s=S.undoJump(s);s=jump(s);}
 assert.equal(S.jumpUndoEligibility(s).allowed,false);assert.throws(()=>S.undo(s),/later campaign change|Mulligan used/);assert.throws(()=>S.undoJump(s),/later campaign change|Mulligan used/);
 const h=setup(roundtrip(s)),raw=h.bytes(),before=structuredClone(h.api.state),button=h.button('undo');assert.ok(button);assert.equal(button.disabled,false);await h.runAction('undo');
 unchanged(h,raw,before);assert.match(ui(h).message,/Cannot undo this protected jump/);assert.match(ui(h).message,/Nothing was changed/);assert.match(ui(h).message,/World Changes/);assert.equal(ui(h).modalOpen,false);
});

test('validator leaves a valid audited campaign unchanged and no-op override has no selectively restorable fields',()=>{
 const s=edit(campaign()),before=structuredClone(s),event=latest(s);validateWorldChangeHistory(s);same(s,before);assert.deepEqual(worldChangeFields(event),[]);assert.equal(eligibility(s,event).allowed,false);assert.match(setup(s).api.historyDetails(event),/No effective world fields changed/);
});

for(const [key,first,expected]of [
 ['starport','B788899-C','A563456-D'],['size','A588899-C','B763456-D'],['atmosphere','A768899-C','B583456-D'],['hydrographics','A783899-C','B568456-D'],
 ['population','A788499-C','B563856-D'],['government','A788859-C','B563496-D'],['law','A788896-C','B563459-D'],['techLevel','A788899-D','B563456-C']
])test(`semantic ${key} restore edits exactly its UWP digit after all other digits change`,()=>{
 let s=edit(campaign(),{uwp:first}),event=latest(s);same(worldChangeFields(event).map(c=>c.key),[key]);
 s=edit(s,{uwp:'B563456-D',zone:'Red',fuelOverride:false,accessibleWater:true});assert.equal(eligibility(s,event,key).allowed,true);
 const after=restore(s,event,key);assert.equal(after.worlds[origin.id].overrideUWP,expected);assert.equal(after.worlds[origin.id].zone,'Red');assert.equal(after.worlds[origin.id].fuelOverride,false);assert.equal(after.worlds[origin.id].accessibleWater,true);
 same(worldChangeFields(latest(after)).map(c=>c.key),[key]);same(roundtrip(after),after);
});

test('actual world editor writes a linked audit for the selected remote world and normalizes the reviewed values',async()=>{
 const h=setup(campaign()),before=h.persisted();h.api.actions.override(destination.id);h.fill({uwp:'b563456-d',zone:'Amber',fuel:'yes',water:true,reason:'  New survey  '});await h.submit();
 assert.equal(ui(h).modalError,'');assert.equal(h.counters.writes,1);const saved=h.persisted(),event=latest(saved);assert.ok(event);assert.equal(saved.actual,origin.id);assert.equal(event.world,destination.id);assert.equal(event.worldChangeAudit.worldId,destination.id);assert.equal(event.reason,'New survey');
 assert.equal(saved.worlds[destination.id].overrideUWP,'B563456-D');assert.equal(saved.worlds[destination.id].zone,'Amber');assert.equal(saved.worlds[destination.id].fuelOverride,true);assert.equal(saved.worlds[destination.id].accessibleWater,true);
 same(event.worldChangeAudit.before,worldOverrideSnapshot(before.worlds[destination.id]));same(event.worldChangeAudit.after,worldOverrideSnapshot(saved.worlds[destination.id]));same(saved.worlds[origin.id],before.worlds[origin.id]);assert.equal(saved.undo.at(-1).worldChangeEventId,event.id);assert.equal(saved.events.at(-1).worldChangeEventId,event.id);same(h.store.read(),saved);
});

test('reopening the original restore after a successful correction cannot duplicate it',async()=>{
 const s=edit(campaign(),{uwp:'A788899-D'}),event=latest(s),h=setup(s);open(h,event);await h.submit();const saved=h.bytes(),writes=h.counters.writes;
 await h.runAction('world-field-revert',event.id+'|techLevel');assert.equal(h.bytes(),saved);assert.equal(h.counters.writes,writes);assert.equal(ui(h).modalOpen,false);assert.match(ui(h).message,/later change/);assert.equal(audits(h.persisted()).length,2);
});

test('an earlier zone restore stays available after a later TL correction on the same source entry',()=>{
 const edited=edit(campaign(),{uwp:'A788899-D',zone:'Amber',fuelOverride:true,accessibleWater:true}),event=latest(edited),tl=restore(edited,event),zone=restore(tl,event,'zone');
 assert.equal(zone.worlds[origin.id].uwp,'A788899-C');assert.equal(Object.hasOwn(zone.worlds[origin.id],'overrideUWP'),false);assert.equal(zone.worlds[origin.id].zone,'Safe');assert.equal(zone.worlds[origin.id].fuelOverride,true);assert.equal(zone.worlds[origin.id].accessibleWater,true);
 assert.equal(eligibility(zone,event,'fuelOverride').allowed,true);assert.equal(eligibility(zone,event,'accessibleWater').allowed,true);same(audits(zone).slice(-2).map(e=>e.worldChangeAudit.field),['techLevel','zone']);same(roundtrip(zone),zone);
});

for(const [label,mutate]of [
 ['removed source action summary',s=>{s.events=s.events.filter(e=>e.worldChangeEventId!==latest(s).id);}],
 ['source summary relabeled as a deposit',s=>{s.events.at(-1).label='Manual deposit';}],
 ['negative source summary revision',s=>{s.events.at(-1).revision=-1;}],
 ['different positive source summary revision',s=>{s.events.at(-1).revision+=5;}],
 ['duplicate source summary link',s=>{s.events.push({...structuredClone(s.events.at(-1)),id:'duplicate-action-summary'});}],
 ['missing committed revision',s=>{delete latest(s).worldChangeAudit.committedRevision;}],
 ['negative committed revision',s=>{latest(s).worldChangeAudit.committedRevision=-1;}],
 ['mismatched action timestamp',s=>{s.events.at(-1).hours+=1;}]
])test(`import rejects broken audit/action pairing: ${label}`,()=>{
 const s=edit(campaign(),{uwp:'A788899-D'}),event=latest(s);assert.equal(event.worldChangeAudit.committedRevision,s.revision);assert.equal(s.events.at(-1).revision,event.worldChangeAudit.committedRevision);
 mutate(s);assert.throws(()=>roundtrip(s),/world-change/i);
});

test('import rejects swapped Undo links for C→D, D→E, E→D even though current TL matches the oldest audit',()=>{
 let s=edit(campaign(),{uwp:'A788899-D'});const first=latest(s);s=edit(s,{uwp:'A788899-E'});s=edit(s,{uwp:'A788899-D'});const third=latest(s);
 same(roundtrip(s),s);assert.equal(s.worlds[origin.id].overrideUWP,'A788899-D');assert.equal(eligibility(s,first).allowed,false);assert.equal(eligibility(s,third).allowed,true);
 [s.undo[0].worldChangeEventId,s.undo[2].worldChangeEventId]=[s.undo[2].worldChangeEventId,s.undo[0].worldChangeEventId];
 assert.throws(()=>roundtrip(s),/world-change retained Undo order/i);
});

test('new complete audits remain usable after an incomplete unlinked legacy history prefix',()=>{
 const legacy=S.transition(campaign(),'World override',s=>{s.worlds[origin.id].overrideUWP='A788899-A';});
 legacy.events=[{id:'legacy-note',label:'Imported referee history fragment',hours:0,custom:{preserved:true}}];const prefix=structuredClone(legacy.events),saved=roundtrip(legacy),edited=edit(saved,{uwp:'A788899-D'}),event=latest(edited);
 same(edited.events.slice(0,prefix.length),prefix);assert.equal(edited.undo[0].worldChangeEventId,undefined);assert.equal(event.worldChangeAudit.committedRevision,edited.revision);assert.equal(eligibility(roundtrip(edited),event).allowed,true);
 const restored=restore(roundtrip(edited),event);assert.equal(restored.worlds[origin.id].overrideUWP,'A788899-A');same(restored.events.slice(0,prefix.length),prefix);same(roundtrip(restored),restored);
 const undoCorrection=S.undo(restored),undoEdit=S.undo(undoCorrection),undoLegacy=S.undo(undoEdit);assert.equal(undoCorrection.worlds[origin.id].overrideUWP,'A788899-D');assert.equal(undoEdit.worlds[origin.id].overrideUWP,'A788899-A');assert.equal(Object.hasOwn(undoLegacy.worlds[origin.id],'overrideUWP'),false);same(roundtrip(undoLegacy),undoLegacy);
});

test('import may rebase below stored committed revisions while preserving audits, further corrections and Undo',async()=>{
 const initial=campaign();initial.revision=40;const edited=edit(initial,{uwp:'A788899-D'}),source=latest(edited),saved=restore(edited,source),auditBytes=JSON.stringify(saved.events),h=setup(campaign());
 assert.equal(source.worldChangeAudit.committedRevision,41);assert.equal(latest(saved).worldChangeAudit.committedRevision,42);
 h.api.backupReplace('Import campaign',roundtrip(saved));h.fill({backed:true});await h.submit();assert.equal(ui(h).modalError,'');assert.equal(h.counters.writes,1);assert.equal(h.persisted().revision,1);assert.equal(JSON.stringify(h.persisted().events),auditBytes);same(h.store.read(),h.persisted());
 h.api.actions.override(origin.id);h.fill({uwp:'B788899-C',reason:'Fresh edit after import'});await h.submit();assert.equal(ui(h).modalError,'');const fresh=latest(h.persisted());assert.equal(fresh.worldChangeAudit.committedRevision,2);assert.equal(h.persisted().revision,2);
 open(h,fresh,'starport');await h.submit();assert.equal(ui(h).modalError,'');assert.equal(latest(h.persisted()).worldChangeAudit.committedRevision,3);assert.equal(h.persisted().worlds[origin.id].uwp,'A788899-C');same(h.store.read(),h.persisted());
 h.api.actions.undo();assert.equal(h.persisted().worlds[origin.id].overrideUWP,'B788899-C');h.api.actions.undo();same(material(h.persisted()),material(saved));h.api.actions.undo();same(material(h.persisted()),material(edited));assert.equal(eligibility(h.persisted(),source).allowed,true);same(h.store.read(),h.persisted());
});
