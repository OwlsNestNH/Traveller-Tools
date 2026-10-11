import test from 'node:test';
import assert from 'node:assert/strict';
import {S,same,ui,flush,serviceSaveGate,fixture,setup,canonical,display,success,noSuccess,busy,terminal,pending,trap} from './clear-route-save-harness.mjs';
import {SaveNotCommittedError,SaveCommittedPublicationError} from '../js/persistence.mjs';
import {dashboardData} from '../js/dashboard-data.mjs';

const body=h=>h.dom.ids.get('modal-body').innerHTML;
function economics(h,before){
 const after=h.persisted();assert.equal(after.revision,before.revision+1);assert.equal(after.undo.length,before.undo.length+1);same(after.route,[before.actual]);assert.equal(after.routeIndex,0);same(after.mandatoryStops,[]);
 for(const key of ['actual','bank','ledger','lots','contracts','policies','snapshots','hours','dateLabel','trader','settings','dashboardBaseline'])same(after[key],before[key]);
 same(dashboardData(after),dashboardData(before));
 for(const [i,attempt]of before.jumpAttempts.entries()){same(after.jumpAttempts[i].rolls,attempt.rolls);assert.equal(after.jumpAttempts[i].mulliganUsed,attempt.mulliganUsed);assert.equal(after.jumpAttempts[i].closed,true);}
 assert.equal(S.jumpUndoEligibility(after).allowed,false);assert.equal(after.events.at(-1).label,'Cleared planned route');assert.equal(h.counters.writes,1);assert.doesNotMatch(h.bytes(),/saveToken|replacementToken/);
 assert.equal(after.lots[0].id,'11111111-2222-4333-8444-555555555555');
}
test('native modal harness follows actual index.html form placement for all chrome controls',()=>{const h=setup();h.open();const form=h.dom.ids.get('modal-form');same(form.querySelectorAll('input,select,textarea,button').map(n=>n.id),['modal-close','modal-cancel','modal-submit']);for(const id of ['modal-close','modal-cancel','modal-submit'])assert.equal(h.dom.ids.get(id).form,form);});

for(const delayed of [false,true])for(const spent of [false,true])for(const legacy of [false,true])test(`${delayed?'delayed':'native'} clear equals original .59 target-function mutation, spent=${spent}, legacy=${legacy}`,async()=>{
 const seed=fixture({spent,legacy}),original=setup(seed,{original:true}),h=setup(seed);
 original.open();const baselineOperation=original.submit();assert.equal(original.counters.writes,1);assert.match(ui(original).message,success);assert.equal(ui(original).modalOpen,true,'Original generic async form closes after a microtask');await baselineOperation;
 const baseline=original.persisted();h.open();const gate=delayed?serviceSaveGate(h.store):null,visible=display(h),draft=h.api.routeDraft,review=body(h),operation=h.submit();
 if(gate){assert.equal(gate.entries.length,1);assert.equal(h.counters.writes,0);busy(h);gate.entries[0].write();assert.equal(h.counters.writes,1);same(display(h),visible);assert.equal(body(h),review);assert.equal(h.api.routeDraft,draft);busy(h);gate.entries[0].fulfill();}
 else{assert.equal(h.counters.writes,1,'Native Store still writes synchronously');assert.match(ui(h).message,success,'Native announcement still occurs in submit stack');assert.equal(ui(h).modalOpen,true,'Close retains original microtask boundary');assert.equal(h.api.routeDraft,null);}
 await operation;gate?.restore();assert.equal(ui(h).modalOpen,false);assert.match(ui(h).message,success);assert.equal(h.api.routeDraft,null);same(canonical(h.persisted(),seed),canonical(baseline,seed));economics(h,seed);
 const fresh=setup(h.store.read(),{draft:false}),oldFresh=setup(original.store.read(),{original:true,draft:false});assert.equal(fresh.bytes(),h.bytes());await fresh.runAction('undo');await oldFresh.runAction('undo');same(canonical(fresh.persisted(),seed),canonical(oldFresh.persisted(),seed));
 const restored=fresh.persisted();for(const key of ['bank','ledger','lots','contracts','policies','ship','actual','route','routeIndex','mandatoryStops','hours','dateLabel','dashboardBaseline'])same(restored[key],seed[key]);same(restored.jumpAttempts[0].rolls,seed.jumpAttempts[0].rolls);assert.equal(restored.jumpAttempts[0].mulliganUsed,spent);assert.equal(restored.jumpAttempts[0].closed,true);assert.equal(S.jumpUndoEligibility(restored).allowed,false);assert.equal(fresh.api.routeDraft,null);
 const raw=fresh.bytes();await fresh.runAction('jump-undo');assert.equal(fresh.bytes(),raw,'Ordinary Undo cannot renew a consumed or retired jump mulligan');
});

test('deferred prewrite, durable publication and provider settlement retain one exact review and draft',async t=>{
 const {h,before,raw,draft,session,review,visible,gate,operation}=await pending(t);busy(h,session);assert.equal(h.bytes(),raw);assert.equal(h.api.routeDraft,draft);same(display(h),visible);const entry=gate.entries[0];assert.equal(entry.args[1],before.revision);assert.ok(entry.args[2]);
 entry.write();same(h.api.state,entry.args[0]);same(h.persisted(),entry.args[0]);assert.equal(h.api.routeDraft,draft);same(display(h),visible);assert.equal(body(h),review);busy(h,session);economics(h,before);for(const phase of h.trace)assert.doesNotMatch(phase.message,success);
 entry.fulfill();await operation;assert.equal(h.api.routeDraft,null);assert.equal(ui(h).modalOpen,false);assert.match(ui(h).message,success);
});
test('pending clear blocks repeated, queued, detached and reentrant submits, dismissal, navigation and replacement',async t=>{
 const {h,raw,session,review,gate,detached,operation}=await pending(t);await h.submit();await Promise.resolve().then(()=>h.submit());await detached(h.event());
 for(const id of ['modal-cancel','modal-close'])h.dom.ids.get(id).onclick();let prevented=0;h.dom.ids.get('modal').dispatch('cancel',{preventDefault(){prevented++;}});assert.equal(prevented,1);
 h.api.modal('Unrelated review','Must not replace clear confirmation',null);await h.runAction('reset');await h.runAction('tab','History');assert.equal(h.api.tab,'Overview');assert.equal(body(h),review);busy(h,session);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,1);
 let reentrant;h.hooks.beforeNotify=()=>{reentrant=detached(h.event());h.api.modal('Publication reentry','Must not replace owner',null);};gate.entries[0].fulfill();await operation;await reentrant;assert.equal(h.counters.writes,1);const bytes=h.bytes();await detached(h.event());assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});
for(const delayed of [false,true])test(`${delayed?'delayed':'native'} atomic prewrite rejection retains exact draft and permits one explicit retry`,async()=>{
 const h=setup(),before=h.persisted(),raw=h.bytes(),draft=h.api.routeDraft;h.open();const review=body(h),gate=delayed?serviceSaveGate(h.store):null;h.failNext();const first=h.submit();if(gate)gate.entries[0].fulfill();await first;
 assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);assert.equal(h.api.routeDraft,draft);assert.equal(body(h),review);assert.equal(ui(h).modalOpen,true);assert.equal(ui(h).submitDisabled,false);assert.match(ui(h).modalError,/quota/);assert.equal(h.store.reloadRequired??false,false);noSuccess(h);
 const retry=h.submit();if(gate){assert.equal(gate.entries.length,2);gate.entries[1].fulfill();}await retry;gate?.restore();economics(h,before);assert.equal(h.counters.attempts,2);assert.equal(ui(h).modalOpen,false);assert.equal(h.api.routeDraft,null);
});
for(const changedBy of ['Cancel','Close','Escape','newer dialog','same revision campaign','editor loss and regain'])test(`unsubmitted detached clear cannot acquire authority after ${changedBy}`,async()=>{
 const h=setup();h.open();const detached=h.dom.ids.get('modal-form').onsubmit,raw=h.bytes();
 if(changedBy==='Cancel'||changedBy==='Close')h.dom.ids.get(changedBy==='Cancel'?'modal-cancel':'modal-close').onclick();else if(changedBy==='Escape')h.dom.ids.get('modal').dispatch('cancel',{preventDefault(){}});else if(changedBy==='newer dialog')h.api.modal('Newer review','Retain',null);else if(changedBy==='same revision campaign')h.external(structuredClone(h.persisted()));else{h.store.yield();h.store.editable=true;h.store.onRole(true,'Editing again');}
 const session=h.api.modalSession,review=body(h);await detached(h.event());assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);assert.equal(h.api.modalSession,session);assert.equal(body(h),review);noSuccess(h);
});
for(const changedBy of ['same revision replacement','new campaign revision','editor loss and regain'])for(const published of [false,true])test(`${changedBy} ${published?'after':'before'} owned publication permanently retires pending clear`,async t=>{
 const {h,gate,detached,operation}=await pending(t);if(published)gate.entries[0].write();
 if(changedBy==='editor loss and regain'){h.store.yield();h.store.editable=true;h.store.onRole(true,'Editing again');}else{let next=structuredClone(h.persisted());if(changedBy==='new campaign revision')next=S.transition(next,'Foreign deposit',n=>S.deposit(n,7,'Other editor'));h.external(next);}
 const newer={mode:'build',origin:h.api.state.actual,revision:h.api.state.revision,stops:[],selections:[],selection:9,path:[h.api.state.actual],loading:false,error:'Newer draft',request:99};h.api.setRouteDraft(newer);h.api.setView(h.api.state.route[0]);
 gate.entries[0].fulfill();await operation;assert.equal(h.api.routeDraft,newer);noSuccess(h);const raw=h.bytes();await detached(h.event());assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,1);if(changedBy==='new campaign revision'&&!published)assert.equal(h.counters.writes,0);else assert.equal(h.counters.writes,1);
});

for(const corruption of ['same revision disk drift','new revision disk drift','unreadable disk'])for(const phase of ['before submit','known unwritten result','after publication'])test(`${corruption} at ${phase} is independently detected without duplicate save`,async()=>{
 const h=setup();h.open();const draft=h.api.routeDraft,gate=serviceSaveGate(h.store);let operation;
 if(phase!=='before submit'){operation=h.submit();if(phase==='after publication')gate.entries[0].write();}
 if(corruption==='unreadable disk')h.store.read=()=>{throw Error('Synthetic unreadable disk');};else{const next=h.persisted();next.bank=String(BigInt(next.bank)+101n);if(corruption==='new revision disk drift')next.revision++;h.external(next,{publish:false});}
 const raw=h.bytes();if(phase==='before submit')await h.submit();else{if(phase==='known unwritten result')gate.entries[0].reject(new SaveNotCommittedError(Error('Known unwritten clear')));else gate.entries[0].fulfill();await operation;}
 assert.equal(h.bytes(),raw);terminal(h);assert.equal(h.api.routeDraft,draft,'Independent disk uncertainty cannot discard the unsaved planning draft');if(phase!=='after publication'){assert.equal(h.counters.writes,0);assert.match(ui(h).modalError,/not cleared|not saved/i);assert.doesNotMatch(ui(h).modalError,/outcome.*could not be confirmed/i);}else assert.equal(h.counters.writes,1);
 await h.submit();assert.equal(gate.entries.length,phase==='before submit'?0:1);gate.restore();
});
for(const publication of ['missing','missing token','foreign token','consumed token','wrong revision','wrong candidate'])test(`fulfilled ${publication} publication is not authoritative completion`,async t=>{
 const {h,gate,operation}=await pending(t);if(publication==='missing')h.store.onChange=()=>{};else h.hooks.beforeNotify=(next,metadata)=>{if(publication==='missing token')delete metadata.saveToken;else if(publication==='foreign token')metadata.saveToken={};else if(publication==='consumed token')assert.equal(h.api.controller.isLocalPublication(next,metadata),true);else if(publication==='wrong revision')next.revision++;else next.bank='123456';};
 gate.entries[0].fulfill();await operation;terminal(h);assert.equal(h.counters.writes,1);await h.submit();assert.equal(gate.entries.length,1);
});
test('fulfilled provider without durable write or publication is unknown and reload-only',async()=>{const h=setup(),raw=h.bytes();h.open();h.store.save=()=>Promise.resolve();await h.submit();terminal(h);assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);});
for(const observed of [false,true])for(const classification of ['unknown','missing revision','wrong revision','missing committed','false committed','contradictory unwritten','saved'])test(`${observed?'observed publication':'no publication'} governs ${classification} provider rejection`,async t=>{
 const {h,gate,operation}=await pending(t);if(observed)gate.entries[0].write();let error=new SaveCommittedPublicationError(gate.entries[0].args[0].revision,Error('Synthetic completion failure'));
 if(classification==='unknown')error=Error('Unknown completion');else if(classification==='missing revision')delete error.revision;else if(classification==='wrong revision')error.revision+=99;else if(classification==='missing committed')delete error.committed;else if(classification==='false committed')error.committed=false;else if(classification==='contradictory unwritten')error=new SaveNotCommittedError(Error('Synthetic unwritten claim'));
 gate.entries[0].reject(error);await operation;if(!observed&&classification==='contradictory unwritten'){assert.equal(h.store.reloadRequired??false,false);assert.equal(ui(h).submitDisabled,false);}else{terminal(h);assert.match(ui(h).message,observed||classification==='saved'?/saved, but/i:/outcome.*could not be confirmed/i);}assert.equal(h.counters.writes,Number(observed));
});
for(const observed of [false,true])for(const classification of ['unknown','saved'])test(`detached ${classification} failure ${observed?'after':'before'} publication latches reload without touching newer review or draft`,async t=>{
 const {h,gate,operation}=await pending(t);if(observed)gate.entries[0].write();const dialog=h.dom.ids.get('modal');dialog.close();dialog.dispatch('close');h.api.modal('Newer read-only review','Retain newer body',null);const newerDraft={mode:'build',origin:h.api.state.actual,revision:h.api.state.revision,stops:[],selections:[],selection:5,path:[h.api.state.actual],loading:false,error:'',request:8};h.api.setRouteDraft(newerDraft);const session=h.api.modalSession,review=body(h);
 gate.entries[0].reject(classification==='saved'?new SaveCommittedPublicationError(gate.entries[0].args[0].revision,Error('Late saved failure')):Error('Late unknown failure'));await operation;terminal(h,{modal:false});assert.equal(h.api.modalSession,session);assert.equal(ui(h).modalTitle,'Newer read-only review');assert.equal(body(h),review);assert.equal(ui(h).modalError,'');assert.equal(h.api.routeDraft,newerDraft);assert.equal(h.counters.writes,Number(observed));
});

for(const phase of ['confirmation','pending','published'])for(const outcome of ['resolve','reject'])test(`real selected-hex ${outcome} is held during ${phase} and cannot mutate accepted draft`,async()=>{
 const h=setup();h.api.startMapRoute('build');const lookup=h.map.hold('loadMapHex'),lookupOperation=h.api.mapEmpty('999,999');await flush();assert.equal(h.map.calls.filter(c=>c.kind==='loadMapHex').length,1);h.open();const draft=h.api.routeDraft,accepted=structuredClone(draft),gate=serviceSaveGate(h.store);let operation;if(phase!=='confirmation'){operation=h.submit();if(phase==='published')gate.entries[0].write();}
 const known=Object.keys(h.api.known),message=ui(h).message;if(outcome==='resolve')lookup.resolve({id:'999,999',x:999,y:999,name:'Late selected hex',sector:'Synthetic',hex:'0101',uwp:'X000000-0',zone:'Safe',emptySpace:true});else lookup.reject();await flush();same(draft,accepted);same(Object.keys(h.api.known),known);assert.equal(ui(h).message,message);assert.equal(h.api.routeDraft,draft);
 if(phase==='confirmation'){h.dom.ids.get('modal-cancel').onclick();await lookupOperation.catch(()=>{});assert.equal(h.counters.writes,0);assert.equal(draft.selections[0].pending,false);}else{gate.entries[0].fulfill();await operation;await lookupOperation;assert.equal(h.api.routeDraft,null);assert.equal(h.api.known['999,999'],undefined);assert.match(ui(h).message,success);}gate.restore();
});
for(const outcome of ['resolve','reject'])test(`real pending automatic route ${outcome} remains held through failed clear until dismissal`,async()=>{
 const h=setup();h.api.startMapRoute('auto');const lookup=h.map.hold('nearby'),routeOperation=h.api.mapWorld(h.api.state.route[h.api.state.routeIndex+1]);await flush();h.open();const draft=h.api.routeDraft,accepted=structuredClone(draft);h.failNext();await h.submit();assert.equal(ui(h).submitDisabled,false);if(outcome==='resolve')lookup.resolve();else lookup.reject();await flush();same(draft,accepted);h.dom.ids.get('modal-cancel').onclick();await routeOperation;assert.equal(draft.loading,false);assert.equal(h.counters.writes,0);if(outcome==='reject')assert.match(draft.error,/Synthetic/);
});
test('real queued map-cache frames and nearby callback cannot repaint or announce pending owned clear',async t=>{
 const h=setup(),held=h.map.hold('nearby');h.api.mapAreas.request([{key:'private-clear-tile',x:0,y:0}]);await flush();const {gate,operation,visible}=await pending(t,h);const count=h.paints.replacements,status=h.paints.statusWrites;
 held.resolve();await flush();h.runFrames();assert.equal(h.paints.replacements,count);assert.equal(h.paints.statusWrites,status);same(display(h),visible);
 const nearby=h.map.hold('nearby'),refresh=h.api.refreshNearby();nearby.resolve();await refresh;noSuccess(h);assert.doesNotMatch(ui(h).message,/Live nearby worlds loaded/);same(display(h),visible);
 gate.entries[0].write();h.api.paintMap();h.api.render();assert.equal(h.paints.replacements,count);assert.equal(h.paints.statusWrites,status);same(display(h),visible);gate.entries[0].fulfill();await operation;h.api.paintMap();assert.equal(h.paints.replacements,count+1);assert.match(h.paints.markup.at(-1),/Planned route.*1 stop/);assert.match(ui(h).message,success);
});
for(const newer of ['identity','in-place contents'])test(`accepted ${newer} draft change is never erased or silently substituted`,async t=>{
 const {h,gate,operation,draft}=await pending(t);const next=structuredClone(draft);next.error='Newer draft sentinel';if(newer==='identity')h.api.setRouteDraft(next);else Object.assign(draft,next);const retained=h.api.routeDraft;
 gate.entries[0].fulfill();await operation;assert.equal(h.api.routeDraft,retained);assert.equal(h.api.routeDraft.error,'Newer draft sentinel');noSuccess(h);assert.equal(h.counters.writes,1);
});
for(const field of ['campaign contents','actual location','draft contents'])test(`in-place ${field} drift before submit prevents a stale clear`,async()=>{
 const h=setup();h.open();const raw=h.bytes();if(field==='campaign contents')h.api.state.bank='55';else if(field==='actual location')h.api.state.actual=h.api.state.route[0];else h.api.routeDraft.error='Revised draft';await h.submit();assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);noSuccess(h);assert.equal(ui(h).submitDisabled,true);
});

for(const id of ['modal-close','modal-cancel','modal-submit'])test(`throwing ${id} freeze is known prewrite and reentrant cleanup cannot submit twice`,async()=>{
 const h=setup();h.open();const raw=h.bytes(),draft=h.api.routeDraft,gate=serviceSaveGate(h.store);let thrown=false,reentered=false,reentrant;
 trap(h,id,'disabled',value=>{if(value&&!thrown){thrown=true;throw Error('Synthetic chrome freeze fault');}if(!value&&thrown&&!reentered){reentered=true;reentrant=h.submit();}});await h.submit();await reentrant;assert.equal(thrown,true);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,0);assert.equal(h.api.routeDraft,draft);assert.equal(h.store.reloadRequired??false,false);assert.equal(ui(h).submitDisabled,false);
 const retry=h.submit();assert.equal(gate.entries.length,1);gate.entries[0].fulfill();await retry;assert.equal(h.counters.writes,1);gate.restore();
});
for(const boundary of ['render','message','dialog close','body cleanup'])test(`saved ${boundary} failure never offers another clear write`,async t=>{
 const {h,gate,operation}=await pending(t);let faults=0;if(boundary==='render')trap(h,'main','innerHTML',()=>{if(!faults++)throw Error('Synthetic saved render failure');});else if(boundary==='message')trap(h,'message','textContent',value=>{if(success.test(value)&&!faults++)throw Error('Synthetic saved message failure');});else if(boundary==='dialog close'){const dialog=h.dom.ids.get('modal'),close=dialog.close;dialog.close=function(){if(!faults++)throw Error('Synthetic saved close failure');return close.call(this);};}else trap(h,'modal-body','innerHTML',value=>{if(value===''&&!faults++)throw Error('Synthetic saved cleanup failure');});
 gate.entries[0].fulfill();await operation;assert.ok(faults);terminal(h);assert.equal(h.counters.writes,1);const raw=h.bytes();await h.submit();assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,1);
});
for(const boundary of ['dialog close','body cleanup','message'])test(`reentrant ${boundary} cannot erase a newer review or route draft`,async t=>{
 const {h,gate,operation}=await pending(t);let entered=false,newer,session;const replace=()=>{if(entered)return;entered=true;h.api.modal('Newer completion review','Preserve new content',null);session=h.api.modalSession;newer={mode:'build',origin:h.api.state.actual,revision:h.api.state.revision,stops:[],selections:[],selection:8,path:[h.api.state.actual],loading:false,error:'New owner draft',request:8};h.api.setRouteDraft(newer);};
 if(boundary==='dialog close'){const dialog=h.dom.ids.get('modal'),close=dialog.close;dialog.close=function(){close.call(this);replace();};}else if(boundary==='body cleanup')trap(h,'modal-body','innerHTML',value=>{if(value==='')replace();});else trap(h,'message','textContent',value=>{if(success.test(value)){h.dom.ids.get('modal').close();h.dom.ids.get('modal').dispatch('close');replace();}});
 gate.entries[0].fulfill();await operation;assert.equal(entered,true);assert.equal(h.api.modalSession,session);assert.equal(ui(h).modalTitle,'Newer completion review');assert.equal(body(h),'Preserve new content');assert.equal(h.api.routeDraft,newer);assert.equal(ui(h).modalOpen,true);assert.equal(h.counters.writes,1);
});
for(const phase of ['partial construction','terminal'])test(`${phase} missing handler still prevents native modal navigation`,async t=>{
 const h=setup();if(phase==='partial construction'){trap(h,'modal-title','textContent',()=>{throw Error('Synthetic construction fault');});try{h.api.clearPlannedRoute();}catch(error){assert.match(error.message,/construction/);}}else{const {gate,operation}=await pending(t,h);gate.entries[0].reject();await operation;terminal(h);}h.dom.ids.get('modal-form').onsubmit=null;const raw=h.bytes();let prevented=0;h.dom.dispatch('submit',h.dom.ids.get('modal-form'),{preventDefault(){prevented++;}});await flush();assert.equal(prevented,1);assert.equal(h.bytes(),raw);
});

for(const outcome of ['resolve','reject'])for(const retry of [false,true])test(`selected-hex ${outcome} inherits immediately reopened Clear owner, retry=${retry}`,async()=>{
 const h=setup();h.api.startMapRoute('build');const lookup=h.map.hold('loadMapHex'),lookupOperation=h.api.mapEmpty('998,998');await flush();h.open();const draft=h.api.routeDraft,accepted=structuredClone(draft);
 if(outcome==='resolve')lookup.resolve({id:'998,998',x:998,y:998,name:'Reopened held hex',sector:'Synthetic',hex:'0101',uwp:'X000000-0',zone:'Safe',emptySpace:true});else lookup.reject();await flush();
 h.dom.ids.get('modal-cancel').onclick();h.open();if(retry){h.failNext();await h.submit();assert.equal(ui(h).submitDisabled,false);}await flush();same(draft,accepted);assert.equal(h.api.routeDraft,draft);assert.equal(h.counters.writes,0);
 h.dom.ids.get('modal-cancel').onclick();await lookupOperation.catch(()=>{});assert.equal(draft.selections[0].pending,false);if(outcome==='resolve')assert.ok(h.api.known['998,998']);else assert.match(draft.selections[0].error,/Synthetic/);
});
for(const phase of ['confirmation','pending','published'])test(`real Refresh nearby rejection during ${phase} cannot overwrite Clear announcement`,async t=>{
 const h=setup(),lookup=h.map.hold('nearby'),refresh=h.runAction('nearby');await flush();h.open();const message=ui(h).message,gate=serviceSaveGate(h.store);let operation;if(phase!=='confirmation'){operation=h.submit();if(phase==='published')gate.entries[0].write();}lookup.reject(Error('Obsolete nearby error'));await refresh;assert.equal(ui(h).message,message);if(operation){gate.entries[0].fulfill();await operation;assert.match(ui(h).message,success);}else h.api.closeModal();gate.restore();
});
for(const changed of ['body','title','submit label','modal-submit','modal-cancel','modal-close','form disconnected'])for(const phase of ['before submit','pending'])test(`same-session ${changed} replacement at ${phase} has no stale cleanup authority`,async()=>{
 const h=setup();h.open();const gate=serviceSaveGate(h.store),draft=h.api.routeDraft,raw=h.bytes(),detached=h.dom.ids.get('modal-form').onsubmit;let operation;if(phase==='pending')operation=h.submit();
 if(changed==='body')h.dom.ids.get('modal-body').innerHTML='Unrelated current body';else if(changed==='title')h.dom.ids.get('modal-title').textContent='Unrelated current title';else if(changed==='submit label')h.dom.ids.get('modal-submit').textContent='New meaning';else if(changed==='form disconnected')h.dom.ids.get('modal-form').isConnected=false;else{const old=h.dom.ids.get(changed);h.dom.ids.set(changed,{...old});}
 const retained=body(h),title=ui(h).modalTitle;if(operation){gate.entries[0].fulfill();await operation;assert.equal(h.counters.writes,1);}else{await detached(h.event());assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);}assert.equal(h.api.routeDraft,draft);assert.equal(body(h),retained);assert.equal(ui(h).modalTitle,title);noSuccess(h);gate.restore();
});

for(const single of [false,true])for(const delayed of [false,true])test(`${delayed?'delayed':'native'} clear without a draft, single-stop=${single}, preserves original action semantics`,async()=>{
 const seed=fixture({jump:false});if(single){seed.route=[seed.actual];seed.routeIndex=0;seed.mandatoryStops=[];}const h=setup(seed,{draft:false}),original=setup(seed,{draft:false,original:true});original.open();await original.submit();h.open();const gate=delayed?serviceSaveGate(h.store):null,operation=h.submit();if(gate)gate.entries[0].fulfill();await operation;gate?.restore();assert.equal(h.counters.writes,1);assert.equal(h.api.routeDraft,null);same(canonical(h.persisted(),seed),canonical(original.persisted(),seed));assert.equal(h.persisted().revision,seed.revision+1);assert.equal(h.persisted().undo.length,seed.undo.length+1);assert.match(ui(h).message,success);
});
for(const phase of ['confirmation','pending','published'])for(const outcome of ['resolve','reject'])test(`real MapOverview cache ${outcome} frame stays held throughout ${phase}`,async()=>{
 const h=setup(),lookup=h.map.hold('sectors');h.api.mapOverview.request(h.api.state.worlds[h.api.state.actual],{x:0,y:0},0.1,true);await flush();assert.equal(h.map.calls.filter(c=>c.kind==='sectors').length,1);h.open();const gate=serviceSaveGate(h.store);let operation;if(phase!=='confirmation'){operation=h.submit();if(phase==='published')gate.entries[0].write();}const visible=display(h),count=h.paints.replacements,status=h.paints.statusWrites;
 if(outcome==='resolve')lookup.resolve([{name:'Synthetic remote sector',x:20,y:20}]);else lookup.reject();await flush();h.runFrames();same(display(h),visible);assert.equal(h.paints.replacements,count);assert.equal(h.paints.statusWrites,status);
 if(operation){gate.entries[0].fulfill();await operation;}else h.api.closeModal();h.api.paintMap();assert.equal(h.paints.replacements,count+1);gate.restore();
});
