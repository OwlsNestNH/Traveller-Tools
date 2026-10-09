import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/state.mjs';
import {decimal} from '../js/amounts.mjs';
import {Store,KEY} from '../js/persistence.mjs';
const origin={id:'0,0',x:0,y:0,name:'Origin',sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'};
const destination={...origin,id:'1,0',x:1,name:'Destination',hex:'0201'};
function campaign(){const s=S.initial();Object.assign(s,{initialized:true,actual:origin.id,bank:'100000',route:[origin.id,destination.id,origin.id],worlds:{[origin.id]:origin,[destination.id]:destination}});s.ship.capacity='30';return S.validate(s);}
function accept(s,kind='mail',quantity='15',manual=false){return S.transition(s,manual?'Manual contract accepted':'Accepted '+kind,x=>S.acceptContract(x,{offerId:S.uid(),kind,origin:x.actual,destination:destination.id,quantity,payment:'75000',dueHours:null,audit:{manual,reason:'Synthetic terms'}}));}
function jump(s,{tracked=true,hours=0}={}){return S.transition(s,'Jump: '+s.actual+' → '+s.route[s.routeIndex+1],x=>{const from=x.actual,to=x.route[x.routeIndex+1],event={id:S.uid(),label:'Jump audit',from,to,hours:x.hours+hours,effectiveHours:hours};if(tracked)S.recordMailDeparture(x,event);x.actual=to;x.routeIndex++;x.hours+=hours;x.events.push(event);x.ledger.push({id:S.uid(),type:'Jump',amount:'0',world:to,from,to,eventId:event.id,hours:x.hours});});}
const cancel=(s,id=s.contracts[0].id)=>S.transition(s,'Cancelled mail',x=>S.cancelMail(x,id));
const eligible=(s,id=s.contracts[0].id)=>S.mailCancellationEligibility(s,id);
const old=s=>{s=structuredClone(s);for(const c of s.contracts){delete c.firstDeparture;delete c.acceptanceEventId;}s.events=s.events.filter(e=>e.label!=='Mail acceptance audit');return s;};
const roundtrip=s=>S.validate(JSON.parse(JSON.stringify(s)));

test('cancel one whole accepted Mail retains audit, frees a full hold, never posts money, and Undo restores it',()=>{
 let s=accept(accept(campaign(),'freight'),'mail');const mail=s.contracts[1],freight=structuredClone(s.contracts[0]),saved=structuredClone(s),audit=structuredClone(mail.audit);
 assert.equal(decimal(S.used(s)),'30');assert.equal(mail.firstDeparture,null);assert.equal(eligible(s,mail.id).allowed,true);
 s=cancel(s,mail.id);assert.equal(decimal(S.used(s)),'15');assert.equal(s.bank,saved.bank);assert.deepEqual(s.ledger,saved.ledger);assert.deepEqual(s.contracts[0],freight);assert.deepEqual(s.contracts[1].audit,audit);assert.equal(s.contracts[1].status,'cancelled');assert.equal(s.contracts[1].cancelledHours,0);assert.equal(s.contracts[1].cancellation.source,'recorded');
 assert.deepEqual(s.events.find(e=>e.label==='Mail cancellation audit').contract,s.contracts[1]);assert.throws(()=>cancel(s,mail.id),/already cancelled/);assert.throws(()=>S.deliver(structuredClone(s),mail.id),/not awaiting delivery/);
 s=S.undo(s);assert.deepEqual(s.contracts,saved.contracts);assert.equal(decimal(S.used(s)),'30');assert.equal(s.bank,saved.bank);assert.ok(s.events.some(e=>e.label==='Mail cancellation audit'),'Undo preserves cancellation audit');assert.ok(s.events.some(e=>e.label==='Undo: Cancelled mail'));
});
test('fresh generated/manual acceptance can follow cancellation without reviving the cancelled offer',()=>{
 let s=accept(campaign());const offer=s.contracts[0];s=cancel(s);assert.throws(()=>S.acceptContract(structuredClone(s),offer),/already accepted/);
 s=accept(s,'mail','30',true);assert.deepEqual(s.contracts.map(c=>c.status),['cancelled','accepted']);assert.equal(decimal(S.used(s)),'30');assert.equal(s.contracts[1].firstDeparture,null);assert.equal(eligible(s,s.contracts[1].id).allowed,true);
});
test('first committed zero-hour jump permanently blocks cancellation across return, route/date/location edits and reload',()=>{
 let s=accept(campaign());s=jump(s);const marker=structuredClone(s.contracts[0].firstDeparture);assert.equal(marker.hours,0);assert.equal(marker.from,origin.id);assert.equal(marker.to,destination.id);assert.equal(marker.eventId,s.ledger.at(-1).eventId);assert.equal(marker.revision,s.revision);assert.equal(eligible(s).allowed,false);assert.throws(()=>cancel(s),/already departed/);
 s=jump(s);assert.equal(s.actual,origin.id);assert.deepEqual(s.contracts[0].firstDeparture,marker);
 s=S.transition(s,'Route/time/location correction',x=>{x.route=[origin.id];x.routeIndex=0;x.hours=0;x.dateLabel='001-1105';x.actual=origin.id;});s=roundtrip(s);assert.equal(eligible(s).allowed,false);assert.deepEqual(s.contracts[0].firstDeparture,marker);
});
test('Undo jump restores predeparture eligibility despite retained Jump audit; Undo delivery alone does not',()=>{
 const accepted=accept(campaign());let s=jump(accepted,{hours:168});s=S.transition(s,'Delivered mail',x=>S.deliver(x,x.contracts[0].id));assert.equal(eligible(s).allowed,false);assert.match(eligible(s).reason,/Delivered/);
 s=S.undo(s);assert.equal(eligible(s).allowed,false);assert.equal(s.bank,accepted.bank);s=S.undo(s);assert.deepEqual(s.contracts,accepted.contracts);assert.equal(eligible(s).allowed,true);assert.ok(s.events.some(e=>e.label==='Jump audit'));assert.equal(cancel(s).contracts[0].status,'cancelled');
});
test('each accepted Mail receives its first marker together; freight and cancelled Mail are unaffected',()=>{
 let s=accept(campaign(),'mail','5');s=cancel(s);s=accept(s,'mail','5');s=accept(s,'freight','5');s=accept(s,'mail','5');s=jump(s);
 assert.equal(s.contracts[0].firstDeparture,null);assert.equal(Object.hasOwn(s.contracts[2],'firstDeparture'),false);assert.deepEqual(s.contracts[1].firstDeparture,s.contracts[3].firstDeparture);assert.throws(()=>cancel(s,s.contracts[2].id),/Only accepted mail/);
});
test('legacy recent accepted Mail with complete Undo and event trail is cancellable, including manual acceptance',()=>{
 for(const manual of [false,true]){
  let s=old(accept(campaign(),'mail','15',manual));s=S.transition(s,'Date correction',x=>{x.hours=24;});assert.equal(eligible(s).allowed,true);assert.equal(eligible(s).source,'legacy-undo');
  const original=structuredClone(s);s=cancel(s);assert.equal(s.contracts[0].cancellation.source,'legacy-undo');assert.equal(s.contracts[0].firstDeparture,null);s=S.undo(s);assert.deepEqual(s.contracts,original.contracts);assert.equal(Object.hasOwn(s.contracts[0],'firstDeparture'),false);assert.equal(eligible(s).allowed,true);
 }
});
test('legacy history recognizes committed zero-hour out-and-back jumps, and an undone jump is eligible again',()=>{
 let s=old(accept(campaign()));s=jump(s,{tracked:false});const first=structuredClone(eligible(s).firstDeparture);assert.equal(eligible(s).allowed,false);assert.equal(eligible(s).source,'legacy-undo');s=jump(s,{tracked:false});assert.equal(s.actual,origin.id);assert.equal(eligible(s).allowed,false);assert.deepEqual(eligible(s).firstDeparture,first);
 s=S.undo(S.undo(s));assert.equal(eligible(s).allowed,true);assert.ok(s.events.filter(e=>e.label==='Jump audit').length===2);
});
test('legacy missing acceptance, incomplete inverses, contradictory jump records and ambiguous revision seams fail closed',()=>{
 const base=old(accept(campaign()));const cases=[];
 let s=structuredClone(base);s.undo=[];cases.push(s);
 s=structuredClone(base);s.events=[];cases.push(s);
 s=structuredClone(base);s.undo[0].label='Unidentified acceptance';cases.push(s);
 s=jump(base,{tracked:false});s.undo.pop();cases.push(s);
 s=jump(base,{tracked:false});s.events.at(-1).label='Date correction';s.undo.at(-1).label='Date correction';cases.push(s);
 s=jump(base,{tracked:false});s.events.find(e=>e.label==='Jump audit').from=destination.id;cases.push(s);
 s=S.transition(base,'After import',x=>{x.hours=24;});s.events.at(-1).revision=77;cases.push(s);
 s=structuredClone(base);s.undo[0].inverse[0].path=['contracts',8];cases.push(s);
 s=structuredClone(base);s.undo[0].inverse.push({path:['routeIndex'],value:-1});cases.push(s);
 s=structuredClone(base);s.undo[0].inverse.push({path:['contracts',99],remove:true});cases.push(s);
 s=structuredClone(base);s.undo[0].inverse.push({path:['actual'],value:destination.id});cases.push(s);
 s=structuredClone(base);s.undo[0].inverse.push({path:['hours'],value:24});cases.push(s);
 for(const state of cases){assert.equal(eligible(state).allowed,false);assert.equal(eligible(state).source,'unverified');assert.match(eligible(state).reason,/Travel history unverified/);assert.throws(()=>cancel(state),/unverified/);}
});
test('legacy revision differences before acceptance and immediately after import are not falsely treated as journeys',()=>{
 let s=S.transition(campaign(),'Earlier setting',x=>{x.hours=1;});s.revision=50;s=old(accept(s));assert.equal(eligible(s).allowed,true,'Pre-acceptance import seam cannot hide post-acceptance travel');
 s.revision=2;assert.equal(eligible(s).allowed,true,'Import replacement itself preserves the saved complete trail');s=S.transition(s,'Post-import setting',x=>{x.hours=2;});assert.equal(eligible(s).source,'unverified','No boundary marker exists for this post-acceptance revision seam');
});
test('observed departure locks unknown legacy Mail without claiming an earlier journey is known',()=>{
 let s=old(accept(campaign()));s.events=[];s.undo=[];s=jump(s);assert.equal(s.contracts[0].firstDeparture.priorHistoryUnverified,true);assert.equal(eligible(s).allowed,false);s=S.undo(s);assert.equal(eligible(s).source,'unverified');
});
test('new lifecycle data roundtrips and malformed imported markers/cancellations are rejected',()=>{
 const accepted=accept(campaign()),departed=jump(accepted),cancelled=cancel(accepted);
 for(const s of [accepted,departed,cancelled,old(accepted)])assert.deepEqual(roundtrip(s),s);
 for(const marker of [false,0,{}, {eventId:'bad',from:origin.id,to:destination.id,hours:-1,revision:2}, {...departed.contracts[0].firstDeparture,revision:0}, {...departed.contracts[0].firstDeparture,priorHistoryUnverified:'yes'}]){
  const s=structuredClone(accepted);s.contracts[0].firstDeparture=marker;assert.throws(()=>S.validate(s),/mail departure/);
 }
 for(const modify of [c=>delete c.firstDeparture,c=>c.firstDeparture=departed.contracts[0].firstDeparture,c=>c.kind='freight',c=>c.cancelledHours=-1,c=>c.cancellation.source='guessed',c=>c.payout='1',c=>c.status='accepted']){const s=structuredClone(cancelled);modify(s.contracts[0]);assert.throws(()=>S.validate(s),/mail (cancellation|departure|acceptance)/);}
});
test('Store import retains recorded departure through revision replacement and read-only/stale cancellation cannot save',()=>{
 const saved=new Map();globalThis.localStorage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
 try{
  const store=Object.create(Store.prototype);store.editable=true;store.onChange=()=>{};store.onRole=()=>{};const initial=accept(campaign());saved.set(KEY,JSON.stringify(initial));
  const proposal=cancel(initial);store.editable=false;assert.throws(()=>store.save(proposal,initial.revision),/read-only/);assert.deepEqual(store.read(),initial);store.editable=true;
  const changed=S.transition(initial,'Unrelated setting',x=>{x.hours=24;});store.save(changed,initial.revision);assert.throws(()=>store.save(proposal,initial.revision),/stale/);assert.deepEqual(store.read(),changed);
  const departed=jump(initial);store.replace(departed,changed.revision);assert.deepEqual(store.read().contracts,departed.contracts);assert.equal(eligible(store.read()).allowed,false);
 }finally{delete globalThis.localStorage;}
});

test('contradictory imported null and missing zero-hour jump actions fail closed even after returning to origin',()=>{
 const departed=jump(jump(accept(campaign())));
 let s=structuredClone(departed);s.contracts[0].firstDeparture=null;assert.equal(eligible(roundtrip(s)).source,'unverified');assert.throws(()=>cancel(s),/unverified/);
 s=old(departed);s.undo=s.undo.filter(e=>!e.label.startsWith('Jump: '));s.events=s.events.filter(e=>!e.label.startsWith('Jump: '));assert.equal(eligible(roundtrip(s)).source,'unverified');assert.throws(()=>cancel(s),/unverified/);
 const accepted=accept(campaign());delete accepted.contracts[0].acceptanceEventId;assert.equal(eligible(accepted).source,'unverified');
});

test('orphan pre-ledger jump audits fail closed for legacy and explicit-null imports; genuine Undo remains eligible',()=>{
 const base=accept(campaign());let departed=jump(jump(base));
 departed.contracts[0].firstDeparture=null;departed.ledger=[];
 departed.undo=departed.undo.filter(e=>!e.label.startsWith('Jump: '));departed.events=departed.events.filter(e=>!e.label.startsWith('Jump: '));
 for(const s of [departed,old(departed)]){assert.equal(eligible(roundtrip(s)).source,'unverified');assert.throws(()=>cancel(s),/unverified/);}
 let genuine=jump(base);genuine=S.undo(genuine);assert.equal(eligible(genuine).allowed,true);
});

test('new Mail does not inherit ambiguous pre-acceptance history, including an imported revision seam',()=>{
 let s=old(accept(campaign()));s=S.transition(s,'Older setting',x=>{x.hours=24;});s.events=[];s.undo=[];s.revision=77;
 s=accept(s,'mail','5');const id=s.contracts.at(-1).id;assert.equal(eligible(s,id).allowed,true);assert.equal(cancel(s,id).contracts.at(-1).status,'cancelled');
 s=S.undo(jump(s));assert.equal(eligible(s,id).allowed,true);
});

test('verified legacy import cancellation and Undo preserve eligibility across the audited revision seam',()=>{
 let s=old(accept(campaign()));s.revision=50;const original=structuredClone(s);assert.equal(eligible(s).allowed,true);
 s=S.undo(cancel(s));assert.deepEqual(s.contracts,original.contracts);assert.equal(eligible(s).allowed,true);assert.equal(eligible(s).source,'legacy-undo');
 s=S.transition(s,'Later settings',x=>{x.hours=24;});assert.equal(eligible(s).allowed,true);s=S.undo(cancel(s));assert.equal(eligible(s).allowed,true);
 const missing=structuredClone(s);missing.events=missing.events.filter(e=>e.label!=='Mail cancellation audit');assert.equal(eligible(missing).source,'unverified');
 for(const damage of [c=>c.cancellation.source='unverified',c=>c.cancellation.world=destination.id,c=>c.cancelledHours=999,c=>c.kind='freight',c=>c.payout='0']){const contradicted=structuredClone(s);damage(contradicted.events.find(e=>e.label==='Mail cancellation audit').contract);assert.equal(eligible(contradicted).source,'unverified');}
 s=jump(s);assert.equal(eligible(s).allowed,false);s=S.undo(s);assert.equal(eligible(s).allowed,true);
});
