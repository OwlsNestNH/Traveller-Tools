import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import * as S from '../js/state.mjs';

// Application-function integration tests, not browser or visual tests. Execute
// actual app source and real rules/state modules. Only boot is omitted; DOM and
// persistence boundaries are doubled. No copied production function bodies.
const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url)));
const mp=JSON.parse(await readFile(new URL('../rules/merchant-prince-1e.json',import.meta.url)));
const bindings={};
for(const[,names,path]of app.matchAll(/^import (.+) from '([^']+)';$/gm)){
 const module=await import(new URL(path,new URL('../js/app.mjs',import.meta.url)));
 if(names.startsWith('* as '))bindings[names.slice(5)]=module;
 else for(const name of names.slice(1,-1).split(','))bindings[name.trim()]=module[name.trim()];
}
const persistence=(await readFile(new URL('../js/persistence.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
delete bindings.Store;delete bindings.KEY;
const executable=app.replace(/^import .*;\n/gm,'').replace(/\nboot\(\)\.catch\([\s\S]*$/,'');
const origin={id:'0,0',x:0,y:0,name:'Origin',sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'};
const destination={...origin,id:'1,0',x:1,name:'Destination',hex:'0201'};
const far={...destination,id:'8,0',x:8,name:'Far Destination',hex:'0901'};
const decode=t=>t.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m=>[m[1],decode(m[2]??'')]));
function element(attributes={}){return {attributes,dataset:Object.fromEntries(Object.entries(attributes).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),value:attributes.value??'',name:attributes.name,disabled:'disabled'in attributes,hidden:false,checked:'checked'in attributes,open:false,type:attributes.type,textContent:'',innerHTML:'',hasAttribute(n){return n in this.attributes;},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},insertAdjacentHTML(_,html){this.innerHTML+=html;},querySelectorAll(){return [];},querySelector(){return null;},click(){},remove(){}};}
function domDouble(){
 const ids=new Map(['summary','ship-actions','tabs','main','modal','modal-title','modal-body','modal-error','modal-submit','modal-cancel','modal-form','modal-close','notes','takeover','import-file','save-status','message'].map(id=>[id,element()]));
 let fields=new Map(),buttons=[],markup='';const listeners=new Map();
 Object.defineProperty(ids.get('modal-body'),'innerHTML',{get:()=>markup,set:html=>{
  markup=html;fields=new Map();
  for(const match of html.matchAll(/<input\b([^>]*)>/g)){const n=element(attrs(match[1]));fields.set(n.name,n);}
  for(const match of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)){
   const options=[...match[2].matchAll(/<option\b([^>]*)>/g)].map(m=>attrs(m[1])),chosen=options.find(o=>'selected'in o)||options[0]||{};
   const n=element({...attrs(match[1]),value:chosen.value??''});fields.set(n.name,n);
  }
  for(const id of ['mail-dm-preview','rounding-input-note'])ids.delete(id);
  for(const[,id]of html.matchAll(/id="(mail-dm-preview|rounding-input-note)"/g))ids.set(id,element());
 }});
 const form=ids.get('modal-form');form.elements=new Proxy({namedItem:n=>fields.get(n)},{get:(target,key)=>key in target?target[key]:fields.get(key)});form.querySelectorAll=selector=>selector==='[data-round]'?[...fields.values()].filter(n=>n.hasAttribute('data-round')):[];
 return {ids,fields:()=>fields,buttons:()=>buttons,dispatch(type,target){for(const listener of listeners.get(type)||[])listener({type,target});},document:{body:{append(){}},createElement(){return {...element(),getContext(){return {measureText:t=>({width:String(t).length*6})};}};},getElementById:id=>ids.get(id)||null,addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},querySelector(){return null;},querySelectorAll(selector){
  if(selector!=='[data-mutate]')return [];
  buttons=[...ids.values()].flatMap(n=>[...(n.innerHTML||'').matchAll(/<button\b([^>]*)>/g)].map(m=>element(attrs(m[1])))).filter(n=>n.hasAttribute('data-mutate'));return buttons;
 }},FormData:class{constructor(){this.values=new Map([...fields].filter(([,n])=>!n.disabled&&n.attributes.type!=='checkbox').map(([k,n])=>[k,n.value]));for(const[k,n]of fields)if(n.attributes.type==='checkbox'&&n.checked)this.values.set(k,'on');}get(k){return this.values.get(k)??null;}has(k){return this.values.has(k);}}};
}
function campaign(){const s=S.initial();s.settings.insurance=true;s.initialized=true;s.bank='1000000';s.actual=origin.id;s.worlds=structuredClone({[origin.id]:origin,[destination.id]:destination,[far.id]:far});s.route=[origin.id,destination.id];s.lots=[{id:'insured-lot',commodity:'11',description:'Synthetic insured goods',quantity:'10',basis:'110000',goodsValue:'100000'}];return S.validate(s);}
function harness(saved=campaign()){
 const dom=domDouble(),calls={saves:0,downloads:[]},memory=new Map([['traveller-trade-route-calculator:v1',JSON.stringify(saved)]]);let api,store;
 const localStorage={getItem:k=>memory.get(k)??null,setItem(k,v){memory.set(k,v);calls.saves++;},removeItem:k=>memory.delete(k)};
 const sandbox={...bindings,document:dom.document,window:{addEventListener(){}},crypto:webcrypto,structuredClone,console,FormData:dom.FormData,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},localStorage,Blob,URL:{createObjectURL(blob){calls.downloads.push(blob);return 'blob:test';},revokeObjectURL(){}},BroadcastChannel:undefined};
 vm.runInContext('const initial=S.initial,validate=S.validate;\n'+persistence+'\n'+executable+`\nglobalThis.api={init(s,c,m){core=c;mp=m;known={...s.worlds};view=s.actual;tab='Cargo';store=new Store(receiveCampaign,()=>{});store.editable=true;state=store.read();render();},get state(){return state;},get store(){return store;},get drafts(){return contractDrafts;},setState(s){receiveCampaign(s);},setView(id){view=id;},searchDialog,contactSearchDetails,historyDetails,policyPanel,availabilityAudit,ledgerAudit,accountsPanel,closedPolicyHistory,cargoPanel,contractsPanel,historyPanel,claimForm,amendPolicy,insureHeldCargo,policyAudit,settings,jump,closeModal,modal,syncModalSubmit,render,backupReplace,actions};`,vm.createContext(sandbox),{filename:'app.mjs + production persistence (VM; boot omitted)'});
 api=sandbox.api;api.init(structuredClone(saved),core,mp);store=api.store;
 const fill=values=>{for(const[k,v]of Object.entries(values)){const n=dom.fields().get(k);assert.ok(n,`Expected form field ${k}`);if(n.attributes.type==='checkbox')n.checked=Boolean(v);else n.value=String(v);}};
 const submit=()=>dom.ids.get('modal-form').onsubmit({preventDefault(){},currentTarget:dom.ids.get('modal-form')});
 return {api,store,calls,dom,fill,submit,persisted:()=>JSON.parse(localStorage.getItem('traveller-trade-route-calculator:v1')),raw:()=>localStorage.getItem('traveller-trade-route-calculator:v1')};
}

const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
const financial=s=>({bank:s.bank,lots:s.lots,policies:s.policies,ledger:s.ledger,settings:s.settings,actual:s.actual,route:s.route,hours:s.hours});
const error=h=>h.dom.ids.get('modal-error').textContent;

async function previewSearch(h,kind='buyer',method='online'){
 h.api.searchDialog(kind);h.fill({party:'Test '+kind,method,dice:12,duration:1});await h.submit();assert.equal(error(h),'');assert.equal(h.dom.ids.get('modal-title').textContent,'Review '+kind+' search');
}
test('actual contact-search form uses grouped legacy periods and cancelling either form is nonmutating',async()=>{
 const saved=campaign();saved.hours=671;saved.snapshots=[0,650].map((startedHours,i)=>({id:'legacy-'+i,kind:i?'buyer':'supplier',worldId:saved.actual,partyName:'Legacy '+i,party:saved.actual+'|legacy '+i,startedHours,hours:startedHours+1,offers:[],search:{previous:37,total:-30}}));
 const h=harness(saved),before=h.raw();
 for(const kind of ['buyer','supplier']){
  h.api.searchDialog(kind);assert.match(h.dom.ids.get('modal-body').innerHTML,/previous attempts in this period: 2 \(DM −2\)/);assert.match(h.dom.ids.get('modal-body').innerHTML,/029-1105 · 00:00/);assert.match(h.dom.ids.get('modal-body').innerHTML,/Home Rule/);h.api.closeModal();assert.equal(h.raw(),before);
  await previewSearch(h,kind);assert.equal(h.raw(),before);h.api.closeModal();assert.equal(h.raw(),before);
 }
 await previewSearch(h);await h.submit();assert.equal(error(h),'');const after=h.persisted();assert.equal(after.hours,672);assert.equal(after.snapshots.at(-1).search.previous,2);same(after.snapshots.slice(0,2),saved.snapshots);
 h.api.searchDialog();assert.match(h.dom.ids.get('modal-body').innerHTML,/previous attempts in this period: 0/);assert.match(h.dom.ids.get('modal-body').innerHTML,/All penalties cleared/);h.api.closeModal();
 h.api.actions.undo();same(h.persisted().snapshots,saved.snapshots);assert.equal(h.persisted().hours,671);
});
test('actual supplier and buyer commits share grouped count; saved audit preserves Home Rule dates',async()=>{
 const h=harness();await previewSearch(h,'supplier','normal');await h.submit();assert.equal(error(h),'');assert.equal(h.persisted().snapshots.length,1);const first=h.persisted().snapshots[0];assert.equal(first.search.previous,0);assert.equal(first.search.contactPeriod.startedHours,0);
 await previewSearch(h,'buyer','blackMarket');await h.submit();assert.equal(error(h),'');const saved=h.persisted(),second=saved.snapshots.at(-1);assert.equal(second.search.previous,1);assert.equal(second.search.contactPeriod.anchorSearchId,first.id);assert.equal(saved.hours,48);
 const audit=saved.events.findLast(e=>e.contactSearch),html=h.api.historyDetails(audit);assert.match(html,/Home Rule \/ campaign interpretation/);assert.match(html,/same month/);assert.match(html,/029-1105 · 00:00/);
 const reloaded=harness(saved);await previewSearch(reloaded,'buyer');assert.match(reloaded.dom.ids.get('modal-body').innerHTML,/2 \(DM −2\)/);reloaded.api.closeModal();
 h.api.actions.undo();same(h.persisted().snapshots,[first]);assert.equal(h.persisted().hours,24);
});
test('actual commit callback cannot count canceled, stale, read-only or repeated confirmations',async()=>{
 for(const mode of ['cancel','stale','readonly','repeat']){
  const h=harness(),before=h.raw();await previewSearch(h);const callback=h.dom.ids.get('modal-form').onsubmit;
  if(mode==='cancel')h.api.closeModal();if(mode==='stale')h.api.state.revision++;if(mode==='readonly')h.store.editable=false;
  await Promise.all([callback({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')}),callback({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')})]);
  if(mode==='repeat'){assert.equal(h.calls.saves,1);assert.equal(h.persisted().snapshots.length,1);assert.equal(h.persisted().hours,1);}else assert.equal(h.raw(),before);
 }
});
