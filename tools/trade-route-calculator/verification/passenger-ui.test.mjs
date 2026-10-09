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
function element(attributes={}){return {attributes,dataset:Object.fromEntries(Object.entries(attributes).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),value:attributes.value??'',name:attributes.name,disabled:'disabled'in attributes,hidden:false,open:false,textContent:'',innerHTML:'',hasAttribute(n){return n in this.attributes;},getAttribute(n){return this.attributes[n]??null;},closest(){return null;},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},insertAdjacentHTML(_,html){this.innerHTML+=html;},querySelectorAll(){return [];}};}
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
 vm.runInContext(executable+`\nglobalThis.api={init(s,c,m,p){state=s;core=c;mp=m;store=p;known={...s.worlds};view=s.actual;tab='Contracts';},get state(){return state;},get drafts(){return contractDrafts;},get check(){return mailCheck;},setState(s){receiveCampaign(s);},setDrafts(d){contractDrafts=d;},get passengerController(){return passengers;},readAccommodation,accommodationFields,saveSettings,setView(id){view=id;},mailPanel,mailRollSummary,contractsPanel,historyPanel,cancelledMailHistory,contractDetails,contractRolls,historyDetails,historyCategory,contractSearch,updateMailEstimate,accept,deliver,editDraft,closeModal,modal,syncModalSubmit,render,backupReplace,actions};`,vm.createContext(sandbox),{filename:'app.mjs (VM; boot omitted)'});
 api=sandbox.api;api.init(structuredClone(saved),core,mp,store);api.render();
 const fill=values=>{for(const[k,v]of Object.entries(values)){const n=dom.fields().get(k);assert.ok(n,`Expected form field ${k}`);if(n.attributes.type==='checkbox')n.checked=Boolean(v);else n.value=String(v);}};
 const submit=()=>dom.ids.get('modal-form').onsubmit({preventDefault(){},currentTarget:dom.ids.get('modal-form')});
 return {api,store,calls,dom,fill,submit,persisted:()=>structuredClone(persisted),button:action=>dom.buttons().find(b=>b.dataset.action===action),check:async(values={})=>{api.contractSearch(true);fill({dice:8,skill:0,characteristic:0,mailAvailability:12,mailContainers:3,...values});await submit();assert.equal(dom.ids.get('modal-error').textContent,'');return api.check;}};
}
const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
function passengerCampaign(){const s=campaign();s.ship.accommodation={combinedPeople:true,rooms:{low:0,middle:3,high:1},passengers:{low:0,middle:4,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:0,luggageMode:'auto',luggageTons:'0'};s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'112',denominator:'1'}};s.ship.fuel={displacementTons:200,capacityTons:40,aboardTons:40};return S.validate(s);}
async function setupPassengers(h){h.api.actions['passenger-setup']();h.fill({reservedCabins:2,installedLowBerths:4,reviewed:true});await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'');}
async function searchPassengers(h){h.api.actions['passenger-search']();h.fill({dice:12,skill:2,characteristic:1,steward:1,sequence:Array(200).fill(2).join(',')});await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'');return h.api.state.events.findLast(e=>e.label==='Passenger search audit');}
const passengerOffer=(h,type)=>h.api.state.events.findLast(e=>e.label==='Passenger search audit').offers.find(o=>o.passageClass===type);
async function previewBoard(h,type='high',count=2,mode='shared'){h.api.actions['passenger-board'](passengerOffer(h,type).offerId);h.fill({count,cabinMode:mode,...(['high','middle'].includes(type)?{serviceConfirmed:true}:{}),...(type==='basic'?{spaceConfirmed:true}:{})});await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'');assert.equal(h.dom.ids.get('modal-title').textContent,'Confirm passenger booking');}

test('actual passenger UI searches four classes, requires capacity review and keeps freight/mail controls separate',async()=>{
 const h=harness(passengerCampaign());const before=h.persisted();await searchPassengers(h);assert.equal(h.api.state.contracts.length,0);assert.equal(h.api.state.bank,before.bank);assert.deepEqual(h.api.state.ship,before.ship);
 const main=h.dom.ids.get('main').innerHTML;assert.match(main,/Passengers/);assert.match(main,/High/);assert.match(main,/Basic/);assert.match(main,/Low/);assert.equal(h.button('passenger-board').disabled,true);assert.equal(h.api.drafts.length,0);assert.equal(h.calls.freight,0);assert.equal(h.calls.mail,0);
 await setupPassengers(h);assert.equal(h.button('passenger-board').disabled,false);assert.equal(h.api.state.ship.accommodation.passengerCapacity.reservedCabins,2);
});
test('actual boarding preview is side-effect free, double submit boards once and booked people do not replace manual counts',async()=>{
 const h=harness(passengerCampaign());await setupPassengers(h);await searchPassengers(h);const before=h.persisted();await previewBoard(h);same(h.persisted(),before);assert.match(h.dom.ids.get('modal-body').innerHTML,/Existing LSS stock is preserved/);
 await Promise.all([h.submit(),h.submit()]);assert.equal(h.api.state.contracts.length,1);assert.equal(h.api.state.contracts[0].count,2);same(h.api.state.ship.accommodation.passengers,before.ship.accommodation.passengers);same(h.api.state.ship.lifeSupport,before.ship.lifeSupport);assert.equal(h.api.state.bank,before.bank);assert.match(h.dom.ids.get('main').innerHTML,/2 booked people aboard/);
 const audit=h.api.contractDetails(h.api.state.contracts[0]);assert.match(audit,/Shared, two per cabin/);assert.match(audit,/Passenger availability calculation/);assert.match(audit,/app convention/);assert.doesNotMatch(audit,/Rate per ton|Freight contract/);
});
test('Cancel/replacement and read-only state prevent passenger acceptance',async()=>{
 const h=harness(passengerCampaign());await setupPassengers(h);await searchPassengers(h);const before=h.persisted();await previewBoard(h);const submit=h.dom.ids.get('modal-form').onsubmit;h.api.closeModal();await submit({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});same(h.persisted(),before);
 await previewBoard(h);h.store.editable=false;h.api.syncModalSubmit();await h.submit();same(h.persisted(),before);assert.equal(h.dom.ids.get('modal-submit').disabled,true);
});
test('reload and external replacement never rebuild actionable offers from passenger History',async()=>{
 const h=harness(passengerCampaign());await setupPassengers(h);const e=await searchPassengers(h),reloaded=harness(h.persisted());assert.doesNotMatch(reloaded.dom.ids.get('main').innerHTML,/data-action="passenger-board"/);assert.match(reloaded.api.historyDetails(e),/people/);assert.match(reloaded.api.historyDetails(e),/Passenger availability calculation/);
 const old=e.offers[0].offerId;h.api.setState(structuredClone(h.api.state));assert.throws(()=>h.api.actions['passenger-board'](old),/no longer active/);
});
test('actual delivery dialog posts one receipt, frees booked occupancy and History Undo restores it',async()=>{
 const h=harness(passengerCampaign());await setupPassengers(h);await searchPassengers(h);await previewBoard(h);await h.submit();const c=h.api.state.contracts[0];h.api.state.actual=destination.id;h.api.actions['passenger-deliver'](c.id);const before=h.persisted();await Promise.all([h.submit(),h.submit()]);assert.equal(h.api.state.contracts[0].status,'delivered');assert.equal(h.api.state.ledger.filter(e=>e.type==='Passenger delivery').length,1);assert.equal(h.api.state.bank,String(BigInt(before.bank)+BigInt(c.payment)));assert.match(h.dom.ids.get('main').innerHTML,/0 booked people aboard/);
 h.api.actions.undo();assert.equal(h.api.state.contracts[0].status,'accepted');assert.equal(h.api.state.bank,before.bank);assert.equal(h.api.state.ledger.filter(e=>e.type==='Passenger delivery').length,0);
});
test('legacy zero/custom luggage overrides are preselected in actual Settings and preserved by readAccommodation',()=>{
 for(const value of ['0','7']){const s=passengerCampaign();delete s.ship.accommodation.combinedPeople;delete s.ship.accommodation.luggageMode;s.ship.accommodation.luggageTons=value;s.ship.accommodation.passengers.high=2;s.ship.accommodation.passengerCapacity={reservedCabins:2,installedLowBerths:4};const h=harness(s),markup=h.api.accommodationFields();assert.match(markup,/<input type="checkbox" name="luggageOverride" checked>/);
  const values={'people-middle':'4','people-high':'2',occupiedLowBerths:'0',luggageTons:value,'rooms-low':'0','rooms-middle':'3','rooms-high':'1','roomService-low':'low','roomService-middle':'middle','roomService-high':'high'};
  const a=h.api.readAccommodation({get:key=>values[key]??null,has:key=>key==='luggageOverride'});assert.equal(a.luggageMode,'manual');assert.equal(a.luggageTons,value);assert.deepEqual(a.passengerCapacity,s.ship.accommodation.passengerCapacity);
 }
 const h=harness(passengerCampaign());assert.doesNotMatch(h.api.accommodationFields(),/<input type="checkbox" name="luggageOverride" checked>/);
});

test('delivery preview discloses fixed whole-ship luggage override and remains draft-only',async()=>{
 const s=passengerCampaign();s.ship.accommodation.luggageMode='manual';s.ship.accommodation.luggageTons='7';const h=harness(s);await setupPassengers(h);await searchPassengers(h);await previewBoard(h);await h.submit();const c=h.api.state.contracts[0];h.api.state.actual=destination.id;const before=h.persisted();h.api.actions['passenger-deliver'](c.id);assert.match(h.dom.ids.get('modal-body').innerHTML,/manual whole-ship luggage total remains fixed/);assert.match(h.dom.ids.get('modal-body').innerHTML,/Whole-ship luggage after<\/dt><dd>7 t/);same(h.persisted(),before);h.api.closeModal();same(h.persisted(),before);
});
