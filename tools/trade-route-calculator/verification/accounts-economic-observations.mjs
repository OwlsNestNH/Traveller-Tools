import assert from 'node:assert/strict';
const clone=value=>JSON.parse(JSON.stringify(value));
export function canonical(value){
 // IDs already present before the user action are exact retained fixture data.
 // Only newly generated identity/reference fields may differ across executions.
 // Never transform arbitrary reason/description/notes/report/HTML/field strings.
 const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
 const keys=new Set(['id','offerId','searchId','latestPassengerSearchId','latestMailCheckId','batchId','eventId','contractId','lotId','policyId','jumpAttemptId','acceptanceEventId','jumpEventId','worldChangeEventId','departure']);
 const retained=new Set(),ids=new Map();
 function seed(x,key=''){if(typeof x==='string'&&keys.has(key)&&uuid.test(x))retained.add(x);else if(Array.isArray(x))x.forEach(v=>seed(v));else if(x&&typeof x==='object')for(const[k,v]of Object.entries(x))seed(v,k);}
 seed(value.checkpoints?.[0]?.live);
 function visit(x,key='',parent=null){
  if(typeof x==='string'){
   if(key==='savedJSON')return JSON.stringify(visit(JSON.parse(x)));
   const effective=key==='value'&&Array.isArray(parent?.path)?parent.path.at(-1):key;
   if(keys.has(effective)&&uuid.test(x)&&!retained.has(x)){if(!ids.has(x))ids.set(x,'generated-'+ids.size);return ids.get(x);}
   return x;
  }
  if(Array.isArray(x))return Array.from(x,v=>visit(v,'',x));
  if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,visit(v,k,x)]));
  return x;
 }
 return {value:visit(value),mapping:Object.fromEntries(ids),retainedIdentities:[...retained]};
}
const formValues=h=>Object.fromEntries([...h.fields()].map(([name,n])=>[name,{type:n.type,value:n.value,checked:n.checked,disabled:n.disabled}]));
const fieldValues=h=>Object.fromEntries([...h.fields()].map(([name,n])=>[name,{value:String(n.value),checked:n.checked}]));
function report(h,reporter,core){return reporter.campaignReport(h.persisted(),core,{exportedAt:new Date('2026-10-11T00:00:00.000Z')}).replace(/^Calculator version:[ \t]+[^\r\n]+$/m,'Calculator version:                <RELEASE_VERSION_ONLY>');}
export async function executeEconomics(spec,seed,factory,reporter,stateModule,{accountsHarness,kinds,core,S}){
 const h=accountsHarness(clone(seed),factory),checkpoints=[],prefix=h.counters.writes;
 if(spec.view)h.api.setView(spec.view);
 h.api.known['2,0']={id:'2,0',x:2,y:0,name:'Harmless catalog enrichment',sector:'Test',hex:'0301',uwp:'C788899-C',zone:'Safe'};
 h.api.setSelected(['retained-cargo']);h.api.setDrafts([{offerId:'retained-ui-offer',kind:'freight',origin:seed.actual,destination:seed.actual==='0,0'?'1,0':'0,0',quantity:'1',payment:'100',dueHours:null}]);
 const snapshot=(stage)=>checkpoints.push({stage,live:clone(h.api.state),durable:clone(h.persisted()),savedJSON:h.bytes(),report:report(h,reporter,core),reimport:clone(stateModule.validate(JSON.parse(h.bytes()))),ephemera:{rounding:clone(h.api.inputRounding),drafts:clone(h.api.drafts),mailCheck:clone(h.api.check),view:h.api.view,tab:h.api.tab,known:clone(h.api.known),selected:h.api.selected}});
 const raw=h.bytes();snapshot('before');
 if(spec.fuelOnly)h.api.shipExpenses(spec.fuelOnly);else h.open(spec.kind==='manual'?'expense':spec.kind==='correction'?'correction':'bundle');
 const opened=h.body();
 if(spec.kind==='bundle'){
  const selections=Object.fromEntries(kinds.filter(k=>h.fields().has('include-'+k)).map(k=>['include-'+k,spec.selection.includes(k)]));
  h.fillAccounts({...selections,...spec.values});if(spec.selectAll)h.api.selectAllExpenses();if(spec.shortcut)h.api.setFuelQuantity(spec.shortcut==='fill');
 }else h.fillAccounts(spec.values);
 const edited=formValues(h),estimate=h.dom.ids.get('expense-estimate')?.innerHTML??null;
 if(spec.rateFirst){const form=h.form(),fields=fieldValues(h),beforeCount=h.counters.writes;const result=h.start('rate');assert.equal(h.counters.writes,beforeCount+1,'Rate remains synchronous: '+spec.name);await result;assert.equal(h.form(),form,'Same retained rate form');assert.deepEqual(fieldValues(h),fields,'Rate preserves field values without normalization');assert.equal(h.calls.rolls,1);snapshot('rate saved');}
 if(spec.cancelAt==='first'){h.api.closeModal();assert.equal(h.bytes(),raw);snapshot('cancelled');return {checkpoints,opened,edited,estimate,writes:0,rolls:h.calls.rolls};}
 // Simulate the real blur/change event before Preview; raw fractional salary
 // makes the live input estimate invalid until this existing normalization path.
 if(spec.kind==='bundle')for(const field of h.fields().values())if(field.dataset.round&&!field.disabled)h.dom.dispatch('change',field);
 const op=h.start(spec.kind==='manual'?'expense':spec.kind);
 if(spec.kind!=='bundle'&&!spec.reject)assert.equal(h.counters.writes,prefix+1,'Manual/correction saves synchronously before submit Promise resolves');
 await op;
 const preview={title:h.dom.ids.get('modal-title').textContent,body:h.body(),fields:formValues(h),rounding:clone(h.api.inputRounding),valid:h.api.modalSession?.valid??null};
 if(spec.kind==='bundle'&&spec.cancelAt==='review'){assert.match(preview.title,/Confirm/);h.api.closeModal();assert.equal(h.bytes(),raw);snapshot('cancelled');return {checkpoints,opened,edited,estimate,preview,writes:0,rolls:h.calls.rolls};}
 if(spec.kind==='bundle'&&!spec.reject){assert.match(preview.title,/Confirm/,'A real final review: '+spec.name);assert.equal(h.counters.writes,prefix+Number(!!spec.rateFirst),'Preview has no campaign write');snapshot('preview');const payment=h.submit();assert.equal(h.counters.writes,prefix+1+Number(!!spec.rateFirst),'Bundle saves synchronously before submit Promise resolves');await payment;}
 if(spec.reject){assert.equal(h.bytes(),raw,'Rejected action leaves original exact durable bytes');assert.equal(h.counters.writes,0);snapshot('rejected');return {checkpoints,opened,edited,estimate,preview,writes:0,rolls:h.calls.rolls};}
 const saved=h.persisted();assert.equal(saved.revision,seed.revision+1+Number(!!spec.rateFirst));assert.equal(saved.hours,seed.hours);assert.equal(saved.dateLabel,seed.dateLabel);assert.deepEqual(saved.lots,seed.lots);assert.deepEqual(saved.policies,seed.policies);assert.deepEqual(saved.contracts,seed.contracts);assert.equal(h.counters.writes,1+Number(!!spec.rateFirst));
 const newLedger=saved.ledger.slice(seed.ledger.length);if(spec.kind==='bundle'){assert.equal(new Set(newLedger.map(x=>x.batchId)).size,1);assert.ok(newLedger[0].batchId);assert.equal(BigInt(seed.bank)-BigInt(saved.bank),newLedger.reduce((v,row)=>v-BigInt(row.amount),0n));}
 else assert.equal(newLedger[0].reason,spec.values.reason,'Exact original reason preserved');
 if(spec.fixture?.jump)assert.equal(saved.jumpAttempts.at(-1).closed,true);
 snapshot('saved');
 const savedJSON=h.bytes(),reload=accountsHarness(JSON.parse(savedJSON),factory);assert.deepEqual(clone(reload.api.state),JSON.parse(savedJSON));
 await h.runAction('undo');assert.equal(h.counters.writes,2+Number(!!spec.rateFirst));snapshot('undo payment');
 if(spec.rateFirst){assert.ok(h.persisted().worlds[seed.actual].berthingRate,'Payment undo retains saved rate');await h.runAction('undo');snapshot('undo rate');}
 if(spec.fixture?.jump){assert.equal(h.persisted().jumpAttempts.at(-1).closed,true);assert.equal(S.jumpUndoEligibility(h.persisted()).allowed,false);}
 return {checkpoints,opened,edited,estimate,preview,writes:1+Number(!!spec.rateFirst),rolls:h.calls.rolls};
}
