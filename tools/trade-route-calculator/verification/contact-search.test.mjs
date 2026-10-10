import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as S from '../js/state.mjs';
import {CONTACT_SEARCH_PERIOD_HOURS,contactSearchStatus,contactSearchPeriod,contactSearchRule} from '../js/contact-search.mjs';
const w=(id,x)=>({id,x,y:0,name:'Planet '+id,sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'});
function campaign(){const s=S.initial();Object.assign(s,{initialized:true,actual:'0,0',worlds:{'0,0':w('0,0',0),'1,0':w('1,0',1)},route:['0,0','1,0']});return s;}
function preview(s,{kind='supplier',method='online',partyName='Test contact',duration=1,success=true}={}){
 const id=S.uid(),period=contactSearchPeriod(s,id),previous=period.previous,effectiveTotal=success?12:2,port=success?6:0,total=effectiveTotal+port-previous,hours=duration*(method==='online'?1:24);
 return {id,kind,worldId:s.actual,partyName,party:s.actual+'|'+partyName.toLowerCase(),startedHours:s.hours,hours:s.hours+hours,offers:[],success:total>=8,search:{contactPeriod:period,method,dateLabel:s.dateLabel,effectiveTotal,skill:0,characteristic:0,port,previous,total,difficulty:8,successOverride:false,durationDie:duration,hours}};
}
const commit=(s,options)=>S.transition(s,'Contact search',next=>S.commitContactSearch(next,preview(s,options),{revision:s.revision}));
const jumpClock=(s,hours)=>S.transition(s,'Set clock',next=>{next.hours=hours;});
const move=(s,id)=>S.transition(s,'Move planet',next=>{next.actual=id;});
const status=s=>contactSearchStatus(s);
const sameData=(actual,expected)=>{for(const key of ['hours','snapshots','bank','lots','ledger','cooldowns','actual','undo'])assert.deepEqual(actual[key],expected[key],key);};

test('Home Rule period is 28 days, with no mutable preview/cancel state',()=>{
 const s=campaign(),before=JSON.stringify(s);assert.equal(CONTACT_SEARCH_PERIOD_HOURS,672);assert.match(contactSearchRule,/Home Rule/);assert.match(contactSearchRule,/same month/);
 assert.deepEqual(status(s),{worldId:s.actual,active:false,previous:0,periodHours:672,period:null});
 for(let i=0;i<3;i++){const p=preview(s);assert.equal(p.search.contactPeriod.startedHours,0);assert.equal(p.search.contactPeriod.resetsHours,672);}
 assert.equal(JSON.stringify(s),before);
});
test('first committed start anchors group; all attempts clear together at exact boundary',()=>{
 let s=jumpClock(campaign(),17);s=commit(s);const first=s.snapshots[0];
 s=jumpClock(s,688);assert.equal(status(s).previous,1);s=commit(s,{kind:'buyer'});
 assert.equal(s.snapshots[1].search.previous,1);assert.equal(s.snapshots[1].search.contactPeriod.anchorSearchId,first.id);
 assert.equal(s.hours,689);assert.equal(status(s).previous,0);assert.equal(status(s).active,false);
 s=jumpClock(s,700);s=commit(s);assert.equal(s.snapshots[2].search.previous,0);assert.equal(status(s).period.startedHours,700);assert.equal(status(s).period.resetsHours,1372);
 assert.equal(status({...s,hours:1371}).previous,1);assert.equal(status({...s,hours:1372}).previous,0);assert.equal(status({...s,hours:1373}).previous,0);
});
test('buyer/supplier, method, identity, success and revisits share one planet count',()=>{
 let s=commit(campaign(),{success:false});assert.equal(s.snapshots[0].success,false);
 s=commit(s,{kind:'buyer',method:'normal',partyName:'Another'});s=commit(s,{method:'blackMarket',partyName:'Fixer'});
 assert.deepEqual(s.snapshots.map(x=>x.search.previous),[0,1,2]);
 const originalPeriod=status(s).period;s=move(s,'1,0');assert.equal(status(s).previous,0);s=commit(s,{kind:'buyer'});const otherPeriod=status(s).period;
 s=move(s,'0,0');assert.equal(status(s).previous,3);assert.deepEqual(status(s).period,originalPeriod);
 s=commit(s,{partyName:'Yet another'});assert.equal(s.snapshots.at(-1).search.previous,3);
 assert.deepEqual(contactSearchStatus(s,'1,0').period,otherPeriod);
});
test('search crossing reset uses start-time penalty; next search is unpenalized',()=>{
 let s=commit(campaign());s=jumpClock(s,671);s=commit(s,{method:'normal',duration:6});
 assert.equal(s.snapshots.at(-1).search.previous,1);assert.equal(s.snapshots.at(-1).search.contactPeriod.resetsHours,672);assert.equal(s.hours,815);assert.equal(status(s).previous,0);
 s=commit(s);assert.equal(s.snapshots.at(-1).search.previous,0);assert.equal(status(s).period.startedHours,815);
});
test('clock correction backward cannot discard the latest committed group',()=>{
 let s=commit(jumpClock(campaign(),100));s=jumpClock(s,50);assert.equal(status(s).previous,1);s=commit(s);assert.equal(s.snapshots.at(-1).search.previous,1);assert.equal(status(s).period.startedHours,100);S.validate(s);
});
test('legacy snapshots migrate deterministically without mutating totals, audit, offers or Undo',()=>{
 let s=campaign();
 for(const [i,hours]of [10,681,682,740,1354].entries())s=S.transition({...s,hours},'Legacy search',n=>{n.snapshots.push({id:'legacy-'+i,kind:i%2?'buyer':'supplier',worldId:n.actual,startedHours:hours,hours,offers:[],search:{previous:77,total:-65}});});
 const bytes=JSON.stringify(s),snapshots=JSON.stringify(s.snapshots),undo=JSON.stringify(s.undo);S.validate(s);assert.equal(JSON.stringify(s),bytes);
 assert.equal(status(s).period.startedHours,1354);assert.equal(status(s).previous,1);
 const restored=S.validate(JSON.parse(bytes));assert.deepEqual(status(restored),status(s));assert.equal(JSON.stringify(restored.snapshots),snapshots);assert.equal(JSON.stringify(restored.undo),undo);
 const next=commit(restored);assert.equal(next.snapshots.at(-1).search.previous,1);assert.equal(next.snapshots.at(-1).search.contactPeriod.anchorSearchId,'legacy-4');assert.deepEqual(next.snapshots.slice(0,-1),s.snapshots);
 sameData(S.undo(next),s);assert.equal(status(S.undo(next)).previous,1);
 const legacyUndo=S.undo(restored);assert.equal(status(legacyUndo).previous,0);assert.equal(status(legacyUndo).period.startedHours,682);
});
test('commit, JSON reload/import and Undo restore period/time with history kept auditable',()=>{
 const original=jumpClock(campaign(),100);let s=commit(original),id=s.snapshots[0].id;
 const loaded=S.validate(JSON.parse(JSON.stringify(s)));assert.deepEqual(loaded,s);assert.equal(loaded.events.at(-2).contactSearch.contactPeriod.anchorSearchId,id);assert.equal(loaded.events.at(-2).contactSearch.contactPeriod.rule,'Home Rule / campaign interpretation');
 sameData(S.undo(loaded),original);assert.equal(status(S.undo(loaded)).period,null);
 s=jumpClock(s,800);const before=s;s=commit(s);assert.equal(status(s).previous,1);assert.equal(status(s).period.startedHours,800);
 const undone=S.undo(S.validate(JSON.parse(JSON.stringify(s))));sameData(undone,before);assert.equal(status(undone).previous,0);assert.equal(status(undone).period.startedHours,100);
});
test('authoritative commit rejects stale, duplicate, shifted or forged period without mutation',()=>{
 const cases=[p=>p.search.previous++,p=>p.search.contactPeriod.previous++,p=>p.search.contactPeriod.startedHours++,p=>p.search.contactPeriod.resetsHours++,p=>p.worldId='1,0',p=>p.startedHours++,p=>p.search.total++,p=>p.search.hours++,p=>p.search.method='different'];
 for(const alter of cases){const s=campaign(),p=preview(s),before=JSON.stringify(s);alter(p);assert.throws(()=>S.commitContactSearch(s,p));assert.equal(JSON.stringify(s),before);}
 const s=campaign(),p=preview(s);assert.throws(()=>S.commitContactSearch(s,p,{revision:1}),/stale/);
 const next=S.transition(s,'Search',n=>S.commitContactSearch(n,p));assert.throws(()=>S.commitContactSearch(next,p),/stale/);
 const changed=commit(s,{kind:'buyer'});const forged=structuredClone(p);forged.startedHours=changed.hours;forged.hours=changed.hours+1;assert.throws(()=>S.commitContactSearch(changed,forged),/penalty changed/);
});
test('period validation rejects altered new audits and leaves legacy fields untouched',()=>{
 const s=commit(campaign());for(const key of ['version','periodHours','startedHours','resetsHours','previous']){const bad=structuredClone(s);bad.snapshots[0].search.contactPeriod[key]++;assert.throws(()=>S.validate(bad),/period audit/);}
 const bad=structuredClone(s);bad.snapshots[0].search.contactPeriod.anchorSearchId='wrong';assert.throws(()=>S.validate(bad),/period audit/);
});
test('rejection remains independent and cannot be bypassed by the commit helper',()=>{
 const s=campaign(),p=preview(s);s.cooldowns[p.party]=720;assert.throws(()=>S.commitContactSearch(s,p),/cooldown/);assert.equal(s.snapshots.length,0);s.hours=720;S.commitContactSearch(s,preview(s));assert.equal(s.snapshots[0].search.previous,0);
});
test('production Store read/save/replace round-trip grouped periods without a load-time migration write',async()=>{
 const source=(await readFile(new URL('../js/persistence.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const key='traveller-trade-route-calculator:v1',saved=commit(jumpClock(campaign(),12)),memory=new Map([[key,JSON.stringify(saved)]]);let writes=0;
 const sandbox={initial:S.initial,validate:S.validate,crypto,structuredClone,window:{addEventListener(){}},localStorage:{getItem:k=>memory.get(k)??null,setItem(k,v){writes++;memory.set(k,v);}},BroadcastChannel:undefined};
 vm.runInNewContext(source+';globalThis.store=new Store(()=>{},()=>{});',sandbox);const store=sandbox.store;store.editable=true;
 assert.deepEqual(status(store.read()),status(saved));assert.equal(writes,0);
 const next=commit(store.read(),{kind:'buyer'});store.save(next,saved.revision);assert.equal(writes,1);assert.equal(status(store.read()).previous,2);
 const imported=JSON.parse(JSON.stringify(next));store.replace(imported,next.revision);assert.equal(writes,2);assert.deepEqual(status(store.read()),status(next));
 const restored=S.undo(store.read());store.save(restored,store.read().revision);assert.equal(status(store.read()).previous,1);assert.deepEqual(JSON.parse(JSON.stringify(store.read().snapshots)),saved.snapshots);
});
