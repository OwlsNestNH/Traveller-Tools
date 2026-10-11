import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {depositHarness,campaign,S,same,ui,flush} from './deposit-save-harness.mjs';
import {serviceSaveGate} from './service-save-harness.mjs';
import {KEY,SaveNotCommittedError} from '../js/persistence.mjs';
import {createDebugLog} from '../js/debug-log.mjs';

// Native application/controller/Store integration with synthetic storage only.
// Browser startup, real DOM, clipboard and gestures belong to the CI suite.
// Reuse the existing persistence and expense harness definitions, without
// registering their tests or copying any production function implementation.
async function fixtureHeader(name,edits,exports){
 const url=new URL(name,import.meta.url),source=await readFile(url,'utf8');
 const end=source.indexOf('\ntest(');assert.ok(end>0,'Expected native fixture boundary');
 let header=source.slice(0,end);
 assert.doesNotMatch(header,/\btest\s*\(/);
 for(const [from,to] of edits){assert.ok(header.includes(from),'Expected harness exposure: '+from);header=header.replace(from,to);}
 header=header.replaceAll('import.meta.url',JSON.stringify(url.href)).replace(/from '(\.[^']+)'/g,(_all,path)=>'from '+JSON.stringify(new URL(path,url).href));
 return import('data:text/javascript;base64,'+Buffer.from(header+'\nexport {'+exports+'};').toString('base64'));
}
const {environment}=await fixtureHeader('./persistence.test.mjs',[
 ['store(onChange=()=>{}, onRole=()=>{}) {const store=new Store(onChange,onRole);','store(onChange=()=>{}, onRole=()=>{}, onDiagnostic) {const store=new Store(onChange,onRole,onDiagnostic);'],
],'environment');
const {harness:expenseHarness}=await fixtureHeader('./expense-panels.test.mjs',[
 ['createExpensePanels({document,','createExpensePanels({onDiagnostic:options.onDiagnostic,document,'],
],'harness');
const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const expenses=await readFile(new URL('../js/expense-panels.mjs',import.meta.url),'utf8');
const noTimers={setTimeout:()=>0,clearTimeout(){}};
const setup=()=>depositHarness(campaign(),noTimers);
const fields=h=>[...h.dom.fields()].map(([name,node])=>[name,node.value]);
const material=state=>Object.fromEntries(Object.entries(state).filter(([key])=>!['revision','events','jumpAttempts'].includes(key)));
function openCargo(h){
 h.api.setTab('Cargo');h.api.actions['add-lot']();
 h.fill({description:'Synthetic diagnostic cargo',quantity:'2',basis:'123',goods:'100',reason:'Synthetic opening cargo'});
}
function openTime(h){
 h.api.actions.time();h.fill({date:h.api.state.dateLabel,hours:25,reason:'Synthetic time correction'});
}
function diagnostic(h,index=0){
 const entry=h.api.debugErrors[index];assert.ok(entry,'Expected caught error entry');return entry;
}
function assertOutcome(entry,action,outcome,committed){
 assert.equal(entry.action,action);assert.equal(entry.outcome,outcome);assert.equal(entry.committed,committed);
}
function pendingTime(t,h=setup()){
 openTime(h);const gate=serviceSaveGate(h.store),operation=h.submit();
 assert.equal(gate.entries.length,1);
 t.after(async()=>{for(const entry of gate.entries)if(!entry.settled)entry.fulfill();await operation;gate.restore();});
 return {h,gate,operation};
}

test('plain cargo caught storage rejection logs once, retains input and retries exactly once',async()=>{
 const h=setup(),before=h.persisted(),raw=h.bytes();openCargo(h);const draft=fields(h);
 h.failNext();await h.submit();
 assert.equal(h.bytes(),raw);same(h.api.state,before);same(fields(h),draft);
 assert.equal(ui(h).modalOpen,true);assert.equal(ui(h).submitDisabled,false);assert.match(ui(h).modalError,/quota/);
 assert.equal(h.counters.writes,0);assert.equal(h.counters.notifications,0);assert.equal(h.api.debugErrors.length,1);
 const entry=diagnostic(h);assertOutcome(entry,'cargo-add','not-committed',false);assert.equal(entry.screen,'Cargo');assert.match(entry.message,/quota/);
 const full=h.api.debugReportObject();same(full.errors,h.api.debugErrors);assert.equal(full.campaign.bank,before.bank);
 const safe=h.api.debugLog.safeReport();assert.equal(safe.events.length,1);assertOutcome(safe.events[0],'cargo-add','not-committed',false);
 assert.doesNotMatch(JSON.stringify(safe),/Synthetic diagnostic cargo|quota|stack|campaign|cargoUsed/);
 await h.submit();assert.equal(h.counters.attempts,2);assert.equal(h.counters.writes,1);assert.equal(h.counters.notifications,1);
 const saved=h.persisted();assert.equal(saved.bank,before.bank);assert.equal(saved.revision,before.revision+1);assert.equal(saved.undo.length,before.undo.length+1);
 assert.equal(saved.lots.length,before.lots.length+1);assert.equal(saved.lots[0].quantity,'2');assert.equal(saved.lots[0].basis,'123');assert.equal(saved.lots[0].goodsValue,'100');
 same(saved.ledger,before.ledger);same(material(S.undo(saved)),material(before));
 assert.equal(h.api.debugErrors.length,1);assert.equal(ui(h).modalOpen,false);
});

test('a deliberate second failed cargo retry is a second occurrence, without duplicate writes',async()=>{
 const h=setup(),raw=h.bytes();openCargo(h);const draft=fields(h);h.failNext(2);
 await h.submit();assert.equal(h.api.debugErrors.length,1);await h.submit();
 assert.equal(h.api.debugErrors.length,2);assert.notEqual(diagnostic(h,0),diagnostic(h,1));
 assert.equal(diagnostic(h,0).message,diagnostic(h,1).message);
 for(const entry of h.api.debugErrors)assertOutcome(entry,'cargo-add','not-committed',false);
 assert.equal(h.bytes(),raw);same(fields(h),draft);assert.equal(h.counters.writes,0);assert.equal(h.counters.attempts,2);
 await h.submit();assert.equal(h.counters.writes,1);assert.equal(h.persisted().revision,1);assert.equal(h.persisted().undo.length,1);assert.equal(h.api.debugErrors.length,2);
});

test('owned publication normalizes a contradictory rejection before recording one terminal error',async t=>{
 const {h,gate,operation}=pendingTime(t),before=h.persisted();
 gate.entries[0].write();gate.entries[0].reject(new SaveNotCommittedError(Error('Synthetic contradictory outcome')));await operation;
 assert.equal(h.api.debugErrors.length,1);const entry=diagnostic(h);
 assertOutcome(entry,'time-save','committed-publication-failed',true);assert.equal(entry.revision,1);
 assert.equal(h.counters.writes,1);assert.equal(h.persisted().hours,25);assert.equal(h.persisted().revision,1);assert.equal(h.persisted().undo.length,1);
 assert.equal(h.persisted().bank,before.bank);same(h.persisted().ledger,before.ledger);
 assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.match(ui(h).modalError,/saved, but|reload/i);
 await h.submit();assert.equal(gate.entries.length,1);assert.equal(h.api.debugErrors.length,1);
});

test('retired time owner still records its unwritten failure without replacing newer UI',async t=>{
 const {h,gate,operation}=pendingTime(t),raw=h.bytes();
 h.external(structuredClone(h.persisted()));h.dom.ids.get('modal').close();h.dom.ids.get('modal').dispatch('close');
 assert.notEqual(h.api.modal('Newer work','Synthetic newer content',null),false);
 const newer=h.api.modalSession;gate.entries[0].reject(new SaveNotCommittedError(Error('Synthetic stale-owner rejection')));await operation;
 assert.equal(h.api.debugErrors.length,1);assertOutcome(diagnostic(h),'time-save','not-committed',false);
 assert.equal(h.api.modalSession,newer);assert.equal(h.dom.ids.get('modal-body').innerHTML,'Synthetic newer content');
 assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);assert.equal(h.store.reloadRequired??false,false);
});

test('a throwing app diagnostic observer cannot replace a cargo failure or prevent its safe retry',async()=>{
 const h=setup(),raw=h.bytes();openCargo(h);const draft=fields(h);
 h.api.debugLog.record=()=>{throw Error('Synthetic diagnostic observer failure');};h.failNext();
 await h.submit();assert.equal(h.bytes(),raw);same(fields(h),draft);assert.match(ui(h).modalError,/quota/);
 assert.doesNotMatch(ui(h).modalError,/observer/);assert.equal(ui(h).submitDisabled,false);
 await h.submit();assert.equal(h.counters.writes,1);assert.equal(h.persisted().revision,1);assert.equal(h.persisted().undo.length,1);assert.equal(ui(h).modalOpen,false);
});

test('startup read diagnostics retain malformed bytes and preserve the actual Store recovery contract',async t=>{
 const env=environment(t),log=createDebugLog(),published=[],roles=[];
 env.values.set(KEY,'{synthetic malformed campaign');
 const store=env.store(s=>published.push(s),(...args)=>roles.push(args),(error,context)=>log.record(error,context,{screen:'Startup'}));
 await store.acquire();await flush();
 assert.equal(log.entries.length,1);assertOutcome(log.entries[0],'startup-read','unknown',null);assert.equal(log.entries[0].screen,'Startup');
 assert.equal(env.values.get(KEY),'{synthetic malformed campaign');assert.equal(store.recovery,true);assert.equal(store.editable,true);assert.equal(env.held(),true);
 assert.equal(published.length,1);assert.equal(published[0].initialized,false);assert.match(roles.at(-1)[1],/Recovery/);
 assert.throws(()=>store.save(S.transition(published[0],'Synthetic',s=>{s.name='Blocked';}),0),error=>error.code==='SAVE_NOT_COMMITTED'&&/Restore or reset/.test(error.message));
 assert.equal(env.values.get(KEY),'{synthetic malformed campaign');
});

test('throwing startup-read observer cannot prevent recovery replacement, lock release or exact Undo data',async t=>{
 const env=environment(t),seen=[];env.values.set(KEY,'{synthetic malformed campaign');
 const store=env.store(()=>{},()=>{},(error,context)=>{seen.push({error,context});throw Error('Synthetic observer failure');});
 await store.acquire();await flush();assert.equal(store.recovery,true);assert.equal(store.editable,true);assert.equal(env.held(),true);assert.equal(seen.length,1);
 const restored=campaign();store.replace(restored,0);
 assert.equal(store.recovery,false);assert.equal(store.read().revision,1);assert.equal(store.read().bank,restored.bank);same(store.read().undo,restored.undo);same(store.read().ledger,restored.ledger);
 store.yield();await flush();assert.equal(env.held(),false);assert.equal(store.editable,false);assert.equal(env.queued(),0);
});

test('throwing acquisition observer cannot retain ownership or change rejected-lock retry semantics',async t=>{
 const env=environment(t),seen=[],roles=[];
 const store=env.store(()=>{},(...args)=>roles.push(args),(error,context)=>{seen.push({error,context});throw Error('Synthetic observer failure');});
 env.rejectNext();await store.acquire();await flush();
 assert.equal(seen.length,1);assert.equal(seen[0].context,'startup-acquire');assert.match(seen[0].error.message,/Lock service unavailable/);
 assert.equal(store.editable,false);assert.equal(store.acquisition,null);assert.equal(store.release,null);assert.equal(env.held(),false);assert.equal(env.queued(),0);
 assert.match(roles.at(-1)[1],/Lock service unavailable/);assert.throws(()=>store.save(S.transition(S.initial(),'Synthetic',s=>{s.name='Blocked';}),0),/read-only/);
 await store.acquire();await flush();assert.equal(store.editable,true);assert.equal(env.held(),true);assert.equal(env.requests(),2);assert.equal(seen.length,1);
});

test('startup metadata write rejection reports once, fails closed and retries without economic or revision changes',async t=>{
 const env=environment(t),log=createDebugLog(),before=campaign(),raw=JSON.stringify(before),roles=[];
 env.values.set(KEY,raw);const original=localStorage.setItem;let attempts=0;
 localStorage.setItem=(key,value)=>{attempts++;if(attempts===1)throw Error('Synthetic baseline storage rejection');return original(key,value);};
 const store=env.store(()=>{},(...args)=>roles.push(args),(error,context)=>{log.record(error,context,{screen:'Startup'});throw Error('Synthetic observer failure');});
 await store.acquire();await flush();
 assert.equal(log.entries.length,1);assert.equal(log.entries[0].action,'startup-acquire');assert.match(log.entries[0].message,/baseline storage rejection/);
 assert.equal(env.values.get(KEY),raw);assert.equal(store.editable,false);assert.equal(store.acquisition,null);assert.equal(env.held(),false);assert.equal(store.release,null);
 assert.match(roles.at(-1)[1],/baseline storage rejection/);
 await store.acquire();await flush();const saved=store.read();assert.equal(attempts,2);assert.equal(log.entries.length,1);assert.equal(store.editable,true);assert.ok(saved.dashboardBaseline);
 assert.equal(saved.revision,before.revision);assert.equal(saved.bank,before.bank);same(saved.undo,before.undo);same(saved.ledger,before.ledger);same(saved.events,before.events);
});

test('throwing expense diagnostic observer preserves the original unwritten rejection and one safe retry',async()=>{
 const options={fail:true,onDiagnostic(error){seen.push(error);throw Error('Synthetic observer failure');}},seen=[],h=expenseHarness(undefined,options),before=structuredClone(h.state());
 h.expenses.open('mortgage',{fresh:true});h.edit({payments:2});const pay=h.arg('expense-pay');
 await assert.rejects(h.expenses.action('expense-pay',pay),error=>{assert.equal(error,seen[0]);assert.equal(error.code,'SAVE_NOT_COMMITTED');assert.match(error.message,/Storage rejected/);return true;});
 assert.equal(seen.length,1);same(h.state(),before);assert.equal(h.commits,0);assert.equal(h.expenses.committing(),false);assert.equal(h.controls.pay.disabled,false);assert.match(h.expenses.panel(),/Storage rejected/);
 options.fail=false;await h.expenses.action('expense-pay',pay);assert.equal(h.commits,1);assert.equal(h.state().bank,'4799998');assert.equal(h.state().revision,1);assert.equal(h.state().undo.length,1);assert.equal(h.state().ledger.length,1);assert.equal(seen.length,1);
 same(material(S.undo(h.state())),material(S.validate(before)));
});

test('expense observer sees normalized committed failure and cannot undo terminal protection',async()=>{
 const seen=[],h=expenseHarness(undefined,{
  onDiagnostic(error){seen.push(error);throw Error('Synthetic observer failure');},
  commit({label,fn,revision,save}){save(label,fn,revision);throw new SaveNotCommittedError(Error('Synthetic contradictory expense outcome'));},
 });
 h.expenses.open('mortgage',{fresh:true});const pay=h.arg('expense-pay');
 await h.expenses.action('expense-pay',pay);
 assert.equal(seen.length,1);assert.equal(seen[0].code,'SAVE_COMMITTED_PUBLICATION_FAILED');assert.equal(seen[0].committed,true);assert.equal(seen[0].revision,1);
 assert.equal(h.commits,1);assert.equal(h.state().bank,'4899999');assert.equal(h.state().revision,1);assert.equal(h.state().undo.length,1);assert.equal(h.state().ledger.length,1);
 assert.equal(h.expenses.committing(),false);assert.match(h.expenses.panel(),/saved, but|reload/i);assert.doesNotMatch(h.expenses.panel(),/Payment recorded/);
 await assert.rejects(h.expenses.action('expense-pay',pay),/ownership changed|reload/i);assert.equal(h.commits,1);assert.equal(seen.length,1);assert.throws(()=>h.expenses.open('mortgage',{fresh:true}),/Reload/i);
});

test('all primary app save failure observers precede early returns and follow local outcome normalization',()=>{
 const names=['timeWriteFailure','settingsSaveFailure','worldWriteFailure','plannedRouteWriteFailure','clearRouteWriteFailure','reportContactSearchWriteFailure','reportInsuranceWriteFailure','reportPurchaseWriteFailure','saleWriteFailure','reportContractOfferWriteFailure','reportContractLifecycleWriteFailure','reportPassengerWriteFailure','accountsWriteFailure'];
 for(const name of names){
  const start=app.indexOf('function '+name+'(');assert.ok(start>=0,name);
  const rest=app.slice(start),end=rest.slice(1).search(/\n(?:async )?function /),body=end<0?rest:rest.slice(0,end+1);
  const record=body.indexOf('recordSaveDebugError(');assert.ok(record>=0,name+' records');
  assert.doesNotMatch(body.slice(0,record),/\breturn\b/,name+' captures retired-owner early returns');
  const normalizations=[...body.matchAll(/error\s*=\s*(?:new SaveCommittedPublicationError|Error)\(/g)].map(match=>match.index);
  assert.ok(normalizations.length>0,name+' retains local outcome normalization');
  assert.ok(normalizations.every(index=>index<record),name+' records only the normalized primary outcome');
  assert.equal((body.match(/recordSaveDebugError\(/g)||[]).length,1,name+' has one primary observer');
 }
 for(const name of ['immediateUndoFailure','failJumpPreparation']){
  const rest=app.slice(app.indexOf('function '+name+'(')),body=rest.slice(0,rest.slice(1).search(/\n(?:async )?function /)+1);
  assert.ok(body.indexOf('recordSaveDebugError(')>=0,name+' records');
  assert.doesNotMatch(body.slice(0,body.indexOf('recordSaveDebugError(')),/\breturn\b/,name+' records before an early return');
 }
 const declared=[...app.matchAll(/^function ([^(]+)\([^\n]*\)\{/gm)];
 const owners=[...app.matchAll(/^ recordSaveDebugError\(/gm)].map(match=>declared.filter(fn=>fn.index<match.index).at(-1)[1]);
 same(owners.sort(),[...names,'immediateUndoFailure','failJumpPreparation'].sort());
});

test('expense primary observers sit after committed normalization and before retired-owner returns',()=>{
 const terminal=expenses.slice(expenses.indexOf(' function terminalFailure('),expenses.indexOf(' function fail('));
 assert.ok(terminal.indexOf('new SaveCommittedPublicationError(')<terminal.indexOf('diagnostic(error);'));
 assert.ok(terminal.indexOf('diagnostic(error);')<terminal.indexOf('return false;'));
 const fail=expenses.slice(expenses.indexOf(' function fail('),expenses.indexOf(' function finish('));
 assert.ok(fail.indexOf('if(!known)return terminalFailure(owner,error);')<fail.indexOf('diagnostic(error);'));
 assert.ok(fail.indexOf('diagnostic(error);')<fail.indexOf('if(!ownerCurrent(owner))return false;'));
 assert.match(expenses,/function diagnostic\(error\)\{try\{onDiagnostic\(error\);\}catch/);
});
