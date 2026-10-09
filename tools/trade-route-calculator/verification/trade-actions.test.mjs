import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import * as S from '../js/state.mjs';
import * as A from '../js/amounts.mjs';

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
const executable=app.replace(/^import .*;\n/gm,'').replace(/\nboot\(\)\.catch\([\s\S]*$/,'');
const origin={id:'0,0',x:0,y:0,name:'Origin',sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'};
const destination={...origin,id:'1,0',x:1,name:'Destination',hex:'0201'};
const far={...destination,id:'8,0',x:8,name:'Far Destination',hex:'0901'};
const decode=t=>t.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m=>[m[1],decode(m[2]??'')]));
function element(attributes={}){return {attributes,dataset:Object.fromEntries(Object.entries(attributes).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),value:attributes.value??'',name:attributes.name,disabled:'disabled'in attributes,hidden:false,open:false,textContent:'',innerHTML:'',hasAttribute(n){return n in this.attributes;},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},insertAdjacentHTML(_,html){this.innerHTML+=html;},querySelectorAll(){return [];}};}
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
 const form=ids.get('modal-form');form.elements={namedItem:n=>fields.get(n)};form.querySelectorAll=selector=>selector==='[data-round]'?[...fields.values()].filter(n=>n.hasAttribute('data-round')):[];
 return {ids,fields:()=>fields,buttons:()=>buttons,dispatch(type,target){for(const listener of listeners.get(type)||[])listener({type,target});},document:{createElement(){return {...element(),getContext(){return {measureText:t=>({width:String(t).length*6})};}};},getElementById:id=>ids.get(id)||null,addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},querySelector(){return null;},querySelectorAll(selector){
  if(selector!=='[data-mutate]')return [];
  buttons=[...ids.values()].flatMap(n=>[...(n.innerHTML||'').matchAll(/<button\b([^>]*)>/g)].map(m=>element(attrs(m[1])))).filter(n=>n.hasAttribute('data-mutate'));return buttons;
 }},FormData:class{constructor(){this.values=new Map([...fields].filter(([,n])=>!n.disabled&&n.attributes.type!=='checkbox').map(([k,n])=>[k,n.value]));for(const[k,n]of fields)if(n.attributes.type==='checkbox'&&n.checked)this.values.set(k,'on');}get(k){return this.values.get(k)??null;}has(k){return this.values.has(k);}}};
}
function campaign(){const s=S.initial();s.initialized=true;s.bank='100000';s.actual=origin.id;s.worlds=structuredClone({[origin.id]:origin,[destination.id]:destination,[far.id]:far});s.route=[origin.id,destination.id];s.ship.armed=true;s.trader.rank=2;s.trader.soc=1;return S.validate(s);}
function harness(saved=campaign()){
 const dom=domDouble(),calls={freight:0,mail:0,saves:0};let persisted=structuredClone(saved),api;
 const store={editable:true,recovery:false,save(next,expected){if(!this.editable)throw Error('This tab is read-only.');if(persisted.revision!==expected)throw Error('This preview is stale.');S.validate(next);persisted=structuredClone(next);calls.saves++;api.setState(next);api.render();},replace(next,expected){next=structuredClone(S.validate(next));next.revision=expected+1;this.save(next,expected);},read:()=>structuredClone(persisted)};
 const rules={...bindings.R,roll:n=>({dice:Array(n).fill(3),total:n*3}),die:()=>3,freightOffers(...args){calls.freight++;return bindings.R.freightOffers(...args);},mailOffer(...args){calls.mail++;return bindings.R.mailOffer(...args);}};
 const sandbox={...bindings,R:rules,document:dom.document,window:{addEventListener(){}},crypto:webcrypto,structuredClone,console,FormData:dom.FormData,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
 vm.runInContext(executable+`\nglobalThis.api={init(s,c,m,p){state=s;core=c;mp=m;store=p;known={...s.worlds};view=s.actual;tab='Trade';},get state(){return state;},get view(){return view;},setSelected(ids){selected=new Set(ids);},get drafts(){return contractDrafts;},get check(){return mailCheck;},setState(s){receiveCampaign(s);},setDrafts(d){contractDrafts=d;},setView(id){view=id;},searchDialog,beginSale,buyForm,marketPanel,cargoPanel,mailPanel,mailRollSummary,contractsPanel,historyPanel,cancelledMailHistory,contractDetails,contractRolls,historyDetails,historyCategory,contractSearch,updateMailEstimate,accept,deliver,editDraft,closeModal,modal,syncModalSubmit,render,backupReplace,actions};`,vm.createContext(sandbox),{filename:'app.mjs (VM; boot omitted)'});
 api=sandbox.api;api.init(structuredClone(saved),core,mp,store);api.render();
 const fill=values=>{for(const[k,v]of Object.entries(values)){const n=dom.fields().get(k);assert.ok(n,`Expected form field ${k}`);if(n.attributes.type==='checkbox')n.checked=Boolean(v);else n.value=String(v);}};
 const submit=()=>dom.ids.get('modal-form').onsubmit({preventDefault(){},currentTarget:dom.ids.get('modal-form')});
 return {api,store,calls,dom,fill,submit,persisted:()=>structuredClone(persisted),button:action=>dom.buttons().find(b=>b.dataset.action===action),check:async(values={})=>{api.contractSearch(true);fill({dice:8,skill:0,characteristic:0,mailAvailability:12,mailContainers:3,...values});await submit();assert.equal(dom.ids.get('modal-error').textContent,'');return api.check;}};
}
const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));

for(const [action,kind] of [['search','supplier'],['buyer-search','buyer']]){
 test(`${kind} search opens at actual world, preview/cancel does not save, commit advances only search time`,async()=>{
  const h=harness(),before=h.persisted();h.api.actions[action]();
  assert.equal(h.dom.ids.get('modal-title').textContent,'Find a '+kind);
  same(h.persisted(),before);h.fill({dice:12,duration:1});await h.submit();
  assert.equal(h.dom.ids.get('modal-title').textContent,'Review '+kind+' search');
  same(h.persisted(),before);h.api.closeModal();same(h.persisted(),before);
  h.api.actions[action]();h.fill({dice:12,duration:1});await h.submit();await h.submit();
  const after=h.persisted();assert.equal(after.snapshots.length,1);assert.equal(after.snapshots[0].kind,kind);
  assert.equal(after.snapshots[0].worldId,origin.id);assert.equal(after.actual,origin.id);assert.equal(after.hours,before.hours+1);
  assert.equal(after.bank,before.bank);same(after.lots,before.lots);same(after.route,before.route);
 });
 test(`${kind} search recovers explicitly from browsed world without moving ship or saving a preview`,async()=>{
  const h=harness(),before=h.persisted();h.api.setView(destination.id);h.api.render();
  h.api.actions[action]();assert.equal(h.dom.ids.get('modal-title').textContent,'Trade at the current system');
  assert.match(h.dom.ids.get('modal-body').innerHTML,/Destination/);assert.match(h.dom.ids.get('modal-body').innerHTML,/Origin/);
  h.api.closeModal();assert.equal(h.api.view,destination.id);same(h.persisted(),before);
  h.api.actions[action]();await h.submit();assert.equal(h.api.view,origin.id);
  assert.equal(h.dom.ids.get('modal-title').textContent,'Find a '+kind);same(h.persisted(),before);
  h.fill({dice:12,duration:1});await h.submit();same(h.persisted(),before);await h.submit();
  assert.equal(h.persisted().snapshots[0].worldId,origin.id);assert.equal(h.persisted().actual,origin.id);
  assert.equal(h.persisted().bank,before.bank);same(h.persisted().lots,before.lots);
 });
}
test('row Sell and Get sale offers recover from map browsing and still require an actual-world buyer',async()=>{
 for(const action of ['lot-sell','sale']){
  const s=campaign();s.lots.push({id:'owned',commodity:'11',description:'Owned goods',quantity:'2',basis:'10000',goodsValue:'10000',world:origin.id,hours:0});
  const h=harness(S.validate(s)),before=h.persisted();h.api.setView(destination.id);h.api.setSelected(['owned']);
  h.api.actions[action]('owned');assert.equal(h.dom.ids.get('modal-title').textContent,'Trade at the current system');
  await h.submit();assert.equal(h.dom.ids.get('modal-title').textContent,'Find a buyer');same(h.persisted(),before);
  h.fill({dice:12,duration:1});await h.submit();await h.submit();
  assert.match(h.dom.ids.get('modal-title').textContent,/Prepare sale/);same(h.persisted().lots,before.lots);assert.equal(h.persisted().bank,before.bank);
 }
});
test('empty-space searches stay blocked and do not create a world market',()=>{
 const s=campaign();s.worlds[origin.id].emptySpace=true;const h=harness(s),before=h.persisted();
 for(const action of ['search','buyer-search'])assert.throws(()=>h.api.actions[action](),/No local market/);
 same(h.persisted(),before);
});
test('a saved remote offer is still rejected before a purchase dialog or commit',()=>{
 const s=campaign();s.snapshots.push({id:'remote-supplier',kind:'supplier',worldId:destination.id,party:'remote',partyName:'Remote supplier',hours:0,startedHours:0,offers:[{id:'remote-offer',commodity:'11',description:'Remote goods',remaining:'3',unitPrice:'1000'}],options:{}});
 const h=harness(s),before=h.persisted();h.api.setView(destination.id);
 assert.throws(()=>h.api.actions.buy('remote-offer'),/ship must be at this world/);
 assert.equal(h.dom.ids.get('modal').open,false);same(h.persisted(),before);
});
test('recovery submission is inert after editing ownership is lost',async()=>{
 const h=harness(),before=h.persisted();h.api.setView(destination.id);h.api.actions.search();
 h.store.editable=false;h.api.syncModalSubmit();assert.equal(h.dom.ids.get('modal-submit').disabled,true);
 await h.submit();assert.equal(h.api.view,destination.id);same(h.persisted(),before);
});
