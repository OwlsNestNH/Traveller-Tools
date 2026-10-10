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
function element(attributes={}){return {clientWidth:1440,attributes,dataset:Object.fromEntries(Object.entries(attributes).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),value:attributes.value??'',name:attributes.name,disabled:'disabled'in attributes,hidden:false,open:false,textContent:'',innerHTML:'',hasAttribute(n){return n in this.attributes;},getAttribute(n){return this.attributes[n]??null;},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},insertAdjacentHTML(_,html){this.innerHTML+=html;},querySelector(){return null;},querySelectorAll(){return [];},closest(){return null;}};}
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
 return {ids,fields:()=>fields,buttons:()=>buttons,dispatch(type,target,details={}){for(const listener of listeners.get(type)||[])listener({type,target,...details});},document:{createElement(){return {...element(),getContext(){return {measureText:t=>({width:String(t).length*6})};}};},getElementById:id=>ids.get(id)||null,addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},querySelector(){return null;},querySelectorAll(selector){
  if(selector!=='[data-mutate]')return [];
  buttons=[...ids.values()].flatMap(n=>[...(n.innerHTML||'').matchAll(/<button\b([^>]*)>/g)].map(m=>element(attrs(m[1])))).filter(n=>n.hasAttribute('data-mutate'));return buttons;
 }},FormData:class{constructor(){this.values=new Map([...fields].filter(([,n])=>!n.disabled&&n.attributes.type!=='checkbox').map(([k,n])=>[k,n.value]));for(const[k,n]of fields)if(n.attributes.type==='checkbox'&&n.checked)this.values.set(k,'on');}get(k){return this.values.get(k)??null;}has(k){return this.values.has(k);}[Symbol.iterator](){return this.values[Symbol.iterator]();}}};
}
function campaign(){const s=S.initial();s.initialized=true;s.bank='100000';s.actual=origin.id;s.worlds=structuredClone({[origin.id]:origin,[destination.id]:destination,[far.id]:far});s.route=[origin.id,destination.id];s.ship.armed=true;s.trader.rank=2;s.trader.soc=1;return S.validate(s);}
function harness(saved=campaign(),priceDice=[]){
 const dom=domDouble(),calls={freight:0,mail:0,saves:0,quotes:0,priceDice:0};let persisted=structuredClone(saved),api;
 const store={editable:true,recovery:false,save(next,expected){if(!this.editable)throw Error('This tab is read-only.');if(persisted.revision!==expected)throw Error('This preview is stale.');S.validate(next);persisted=structuredClone(next);calls.saves++;api.setState(next);api.render();},replace(next,expected){next=structuredClone(S.validate(next));next.revision=expected+1;this.save(next,expected);},read:()=>structuredClone(persisted)};
 const rules={...bindings.R,quote(...args){calls.quotes++;return bindings.R.quote(...args,()=>{calls.priceDice++;return priceDice.shift()??3;});},roll:n=>({dice:Array(n).fill(3),total:n*3}),die:()=>3,freightOffers(...args){calls.freight++;return bindings.R.freightOffers(...args);},mailOffer(...args){calls.mail++;return bindings.R.mailOffer(...args);}};
 const sandbox={...bindings,R:rules,document:dom.document,window:{addEventListener(){},innerWidth:1440},getComputedStyle:()=>({paddingLeft:'0',paddingRight:'0'}),crypto:webcrypto,structuredClone,console,FormData:dom.FormData,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
 vm.runInContext(executable+`\nglobalThis.api={services,toggleShipPanel,setInputRounding(values){inputRounding=values;},init(s,c,m,p){state=s;core=c;mp=m;store=p;known={...s.worlds};view=s.actual;tab='Trade';},get state(){return state;},get view(){return view;},setSelected(ids){selected=new Set(ids);},get drafts(){return contractDrafts;},get check(){return mailCheck;},setState(s){receiveCampaign(s);},setDrafts(d){contractDrafts=d;},setView(id){view=id;},get previewSale(){return previewSale;},setTab(t){tab=t;},setRouteDraft(d){routeDraft=d;},get mapZoom(){return mapZoom;},setMapDrag(d){mapDrag=d;},ledgerAudit,routeJumpControl,routeStops,shipActions,refuelShortcut,currentQuote,priceAudit,searchDialog,beginSale,buyForm,marketPanel,cargoPanel,mailPanel,mailRollSummary,contractsPanel,historyPanel,cancelledMailHistory,contractDetails,contractRolls,historyDetails,historyCategory,contractSearch,updateMailEstimate,accept,deliver,editDraft,closeModal,modal,syncModalSubmit,render,backupReplace,actions};`,vm.createContext(sandbox),{filename:'app.mjs (VM; boot omitted)'});
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


function tradeCampaign(){
 const s=campaign();s.bank='1000000';
 const c=bindings.R.context(origin,core),options={skill:1,counterparty:2,local:false};let n=0;
 const price=bindings.R.quote(core.commodities[0],c,{...options,side:'buy'},core,()=>[5,5,2][n++]);
 s.snapshots=[{id:'supplier',kind:'supplier',worldId:origin.id,party:'supplier',partyName:'Supplier',hours:0,startedHours:0,world:c,options,offers:[{id:'paired-offer',commodity:'11',description:'Paired goods',remaining:'6',expired:false,...price}]},{id:'buyer',kind:'buyer',worldId:origin.id,party:'buyer',partyName:'Buyer',hours:0,startedHours:0,success:true,criminal:true,world:c,options,offers:[]}];
 return S.validate(s);
}
const modalText=h=>h.dom.ids.get('modal-body').innerHTML;
const noError=h=>assert.equal(h.dom.ids.get('modal-error').textContent,'');

test('complication purchase warnings keep one offer roll across cancel, previews, repeated purchases and audits',async()=>{
 const h=harness(tradeCampaign()),before=h.persisted();
 assert.match(h.api.marketPanel(),/data-complication="complication"/);
 h.api.buyForm('paired-offer');assert.match(modalText(h),/GM decides the issue and consequences/);h.api.closeModal();same(h.persisted(),before);
 for(let i=0;i<2;i++){
  h.api.buyForm('paired-offer');h.fill({quantity:1});await h.submit();noError(h);assert.match(modalText(h),/data-complication="complication"/);await h.submit();noError(h);
 }
 assert.equal(h.calls.priceDice,0);assert.equal(h.persisted().lots.length,2);assert.equal(h.persisted().hours,before.hours);
 for(const l of h.persisted().lots){assert.equal(l.audit.price.audit.tradeComplication.result,'complication');h.api.actions['lot-audit'](l.id);assert.match(modalText(h),/Trade complication · house rule/);h.api.closeModal();}
 for(const e of h.persisted().ledger){h.api.actions['ledger-audit'](e.id);assert.match(modalText(h),/data-complication="complication"/);h.api.closeModal();}
});

test('sale pair and severe flags survive cancel/reopen, quantity/fee edit, local-ban repricing and manual price with no reroll',async()=>{
 const s=tradeCampaign();s.lots=[{id:'pair',commodity:'11',description:'Pair lot',quantity:'3',basis:'30000',goodsValue:'30000'},{id:'triple',commodity:'11',description:'Triple lot',quantity:'2',basis:'20000',goodsValue:'20000'}];
 const h=harness(S.validate(s),[5,5,2,5,5,5]),before=h.persisted();h.api.setSelected(['pair','triple']);h.api.beginSale();
 assert.equal(h.calls.priceDice,6);assert.equal(h.calls.quotes,2);assert.match(modalText(h),/data-complication="complication"/);assert.match(modalText(h),/data-complication="severe"/);same(h.persisted(),before);
 const original=JSON.parse(JSON.stringify([h.api.currentQuote('pair'),h.api.currentQuote('triple')]));
 h.api.closeModal();assert.match(h.api.cargoPanel(true),/data-complication="severe"/);h.api.beginSale();assert.equal(h.calls.priceDice,6);
 h.fill({qty_pair:1,qty_triple:2,ban_pair:2,ban_triple:2,price_triple:12345,reason:'Referee price',fee:5});await h.submit();noError(h);
 assert.equal(h.dom.ids.get('modal-title').textContent,'Confirm sale');assert.match(modalText(h),/data-complication="complication"/);assert.match(modalText(h),/data-complication="severe"/);
 const first=JSON.parse(JSON.stringify(h.api.previewSale));
 for(let i=0;i<2;i++){same(first.lines[i].audit.dice,original[i].audit.dice);same(first.lines[i].audit.tradeComplication,original[i].audit.tradeComplication);assert.equal(first.lines[i].audit.dice.manual,undefined);}
 assert.equal(first.lines[1].audit.manualPrice,'12345');assert.equal(first.lines[0].audit.sale.localIllegalDM,7);assert.equal(h.calls.priceDice,6);
 h.api.actions['sale-edit']();noError(h);assert.equal(h.dom.fields().get('ban_pair').value,'2');h.fill({fee:10});await h.submit();noError(h);assert.equal(h.calls.priceDice,6);
 const edited=JSON.parse(JSON.stringify(h.api.previewSale));await h.submit();noError(h);
 assert.equal(h.persisted().lots.length,1);assert.equal(h.persisted().lots[0].quantity,'2');assert.equal(h.persisted().hours,before.hours);assert.equal(h.persisted().bank,String(BigInt(before.bank)+BigInt(edited.bankDelta)));
 for(const e of h.persisted().ledger.filter(e=>e.type==='Sale')){h.api.actions['ledger-audit'](e.id);assert.match(modalText(h),/Trade complication · house rule/);h.api.closeModal();}
 h.api.actions.undo();same(h.persisted().lots,before.lots);assert.equal(h.persisted().bank,before.bank);assert.equal(h.api.currentQuote('pair'),null,'Campaign change invalidates session quote');
});

test('legacy and entered-total Audit labels never invent a clean roll or active complication',()=>{
 const h=harness(tradeCampaign()),audit=h.persisted().snapshots[0].offers[0].audit;
 delete audit.tradeComplication;const legacy=h.api.priceAudit(audit,'1000','11');assert.match(legacy,/Not recorded for this quote/);assert.doesNotMatch(legacy,/data-complication=/);
 const manual=bindings.R.quote(core.commodities[0],bindings.R.context(origin,core),{side:'buy',skill:1,rollTotal:15},core);
 const html=h.api.priceAudit(manual.audit,manual.unitPrice,'11');assert.match(html,/Unknown · natural dice not recorded/);assert.doesNotMatch(html,/data-complication=|None \(no matching dice\)/);
});


// Overview shortcuts keep existing application handlers and state transactions.
test('next jump always follows actual saved route progress while browsing another world',()=>{
 const s=campaign();s.route=[far.id,origin.id,destination.id];s.routeIndex=1;
 const h=harness(s),before=h.persisted();h.api.setView(far.id);
 const html=h.api.routeJumpControl();
 assert.match(html,/Next destination/);assert.match(html,/Jump to Destination →/);
 assert.doesNotMatch(html,/Jump to Far Destination/);assert.doesNotMatch(html.match(/<button[^>]*data-action="jump"[^>]*>/)[0],/data-unavailable/);
 assert.equal((html.match(/data-action="jump"/g)||[]).length,1);
 h.api.actions.jump();assert.equal(h.dom.ids.get('modal-title').textContent,'Commit jump · Origin → Destination');
 assert.equal(h.dom.ids.get('modal-submit').textContent,'COMMIT JUMP');
 const prepared=h.persisted();for(const key of ['actual','ship','hours','route','contracts','bank','ledger'])same(prepared[key],before[key]);assert.equal(prepared.jumpAttempts.length,1);h.api.closeModal();same(h.persisted(),prepared);
});
test('no route, origin-only and completed route retain a disabled jump control with an explanation',()=>{
 for(const [route,index,actual,reason]of [[[],0,origin.id,'No route planned'],[[origin.id],0,origin.id,'No route planned'],[[origin.id,destination.id],1,destination.id,'Route complete']]){
  const s=campaign();Object.assign(s,{route,routeIndex:index,actual});const h=harness(s);
  assert.match(h.api.routeJumpControl(),/data-unavailable disabled/);assert.ok(h.api.routeJumpControl().includes(reason));
  assert.throws(()=>h.api.actions.jump(),/Plan a route first/);
 }
});
test('draft planning disables jump without replacing the saved destination or committing anything',()=>{
 const h=harness(),before=h.persisted();h.api.setRouteDraft({path:[origin.id,far.id]});
 assert.match(h.api.routeJumpControl(),/data-unavailable disabled/);
 assert.match(h.api.routeJumpControl(),/Finish or cancel route planning before jumping/);
 assert.doesNotMatch(h.api.routeJumpControl(),/Jump to Far Destination/);
 h.api.setRouteDraft(null);assert.match(h.api.routeJumpControl(),/Jump to Destination →/);same(h.persisted(),before);
});
test('route badges identify actual progress and next stop even when a world repeats',()=>{
 const s=campaign();s.route=[origin.id,destination.id,origin.id];const h=harness(s);
 const html=h.api.routeStops();assert.equal((html.match(/aria-current="location"/g)||[]).length,1);
 assert.equal((html.match(/route-stop-status">Current/g)||[]).length,1);
 assert.equal((html.match(/route-stop-status">Next/g)||[]).length,1);
 assert.equal((html.match(/route-arrow/g)||[]).length,2);same(h.persisted(),s);
});
test('next jump supports empty-space destinations and escapes destination labels',()=>{
 const s=campaign();Object.assign(s.worlds[destination.id],{emptySpace:true,name:'Empty hex <0201> & beyond'});const h=harness(s);
 assert.match(h.api.routeJumpControl(),/Jump to Empty hex &lt;0201&gt; &amp; beyond →/);
 assert.doesNotMatch(h.api.routeJumpControl().match(/<button[^>]*data-action="jump"[^>]*>/)[0],/data-unavailable/);
 h.api.actions.jump();assert.equal(h.dom.ids.get('modal-title').textContent,'Commit jump · Origin → Empty hex <0201> & beyond');
 const prepared=h.persisted();h.api.closeModal();same(h.persisted(),prepared);assert.equal(prepared.jumpAttempts.length,1);
});
test('one explicit jump commits only one leg, keeps history labels, rejects repeat submit and supports Undo',async()=>{
 const s=campaign();s.route=[origin.id,destination.id,origin.id];s.ship.fuel=bindings.configureFuel(200,40,40,0,2);s.ship.lifeSupport={capacityHours:672,remainingHours:672,elapsedHours:0};s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:4,high:0},crew:{low:0,middle:0,high:0}};
 const h=harness(s),before=h.persisted();h.api.setView(far.id);
 h.api.actions.jump();const oldSubmit=h.dom.ids.get('modal-form').onsubmit;h.fill({hours:160});await h.submit();noError(h);
 const jumped=h.persisted();assert.equal(jumped.actual,destination.id);assert.equal(jumped.routeIndex,1);assert.equal(jumped.hours,160);assert.equal(jumped.ship.fuel.aboardTons,20);
 assert.equal(jumped.bank,before.bank);same(jumped.lots,before.lots);same(jumped.route,before.route);
 same(jumped.ship.lifeSupport.stockUnits,{numerator:'256',denominator:'3'});
 assert.equal(jumped.ledger.at(-1).type,'Jump');assert.equal(jumped.ledger.at(-1).amount,'0');
 assert.ok(jumped.events.some(e=>e.label==='Jump audit'));assert.ok(jumped.events.some(e=>e.label==='Jump: Origin → Destination'));
 await oldSubmit({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});same(h.persisted(),jumped);
 assert.match(h.api.routeJumpControl(),/Jump to Origin →/);
 h.api.actions.undo();const undone=h.persisted();for(const key of ['actual','routeIndex','hours','bank','ship','route','lots','ledger'])same(undone[key],before[key]);
 assert.ok(undone.events.some(e=>e.label==='Undo: Jump: Origin → Destination'));
});
test('jump confirmation cannot submit after close, ownership loss or newer campaign revision',async()=>{
 for(const mode of ['close','ownership','revision']){
  const h=harness(),before=h.persisted();h.api.actions.jump();h.fill({hours:160});
  if(mode==='close')h.api.closeModal();
  if(mode==='ownership'){h.store.editable=false;h.api.syncModalSubmit();assert.equal(h.dom.ids.get('modal-submit').disabled,true);}
  if(mode==='revision'){const prepared=h.persisted();h.store.save(S.transition(prepared,'Newer test action',s=>s.bank='99999'),prepared.revision);}
  const expected=h.persisted();await h.submit();same(h.persisted(),expected);
  if(mode==='revision')assert.match(h.dom.ids.get('modal-error').textContent,/stale|changed/i);
 }
});
test('Overview has four shortcuts and Refuel opens its nonmutating inline editor',async()=>{
 for(const [port,type]of [['A','refined'],['B','refined'],['C','unrefined'],['D','unrefined'],['E','unrefined']]){
  const s=campaign();s.worlds[origin.id].uwp=port+'788899-C';s.ship.fuel=bindings.configureFuel(200,43,20,0,2);
  const h=harness(s),before=h.persisted();h.api.setTab('Overview');const html=h.api.shipActions();
  assert.equal((html.match(/class="primary"/g)||[]).length,4);assert.match(html,/data-action="cargo-hold"/);assert.doesNotMatch(html,/quickFuelType|fuel-radio|Refined|Unrefined/);
  h.api.setTab('Trade');h.api.refuelShortcut();assert.equal(h.dom.ids.get('modal').open,false);
  assert.match(h.api.services.panel(),/id="service-form"/);assert.doesNotMatch(h.api.services.panel(),/data-action="service-(?:adjust|review)"/);assert.match(h.api.services.panel(),/Actual ship location/);
  const editor=h.api.services.panel();
  assert.match(editor,new RegExp('value="'+type+'" selected'));
  assert.match(editor,/name="fuelTons"[^>]*value="23"/);assert.match(editor,/Top off · 23 t/);
  h.api.services.close();same(h.persisted(),before);
 }
});


test('plain wheel on the map preserves page scrolling and never changes map zoom or campaign data',()=>{
 for(const deltaMode of [0,1,2]){
  const h=harness(),before=h.persisted();let prevented=0;
  h.dom.dispatch('wheel',{closest:()=>({})},{deltaY:150,deltaMode,ctrlKey:false,preventDefault(){prevented++;}});
  assert.equal(prevented,0);assert.equal(h.api.mapZoom,1);same(h.persisted(),before);
 }
});
test('only Ctrl plus vertical wheel over an active map is intercepted to change zoom',()=>{
 for(const deltaMode of [0,1,2]){
  const h=harness(),before=h.persisted();let prevented=0;
  h.dom.dispatch('wheel',{closest:()=>({})},{deltaY:-1,deltaMode,ctrlKey:true,preventDefault(){prevented++;}});
  assert.equal(prevented,1);assert.ok(h.api.mapZoom>1);same(h.persisted(),before);
 }
 for(const guard of ['outside','modal','drag','horizontal']){
  const h=harness(),before=h.persisted();let prevented=0;
  if(guard==='modal')h.dom.ids.get('modal').open=true;
  if(guard==='drag')h.api.setMapDrag({});
  h.dom.dispatch('wheel',{closest:()=>guard==='outside'?null:{}},{deltaY:guard==='horizontal'?0:-150,deltaMode:0,ctrlKey:true,preventDefault(){prevented++;}});
  assert.equal(prevented,0,guard+' retains default behavior');assert.equal(h.api.mapZoom,1);same(h.persisted(),before);
 }
});

test('dedicated Undo Jump confirmation cancels cleanly, rejects stale approval, and commits at most once',async()=>{
 for(const mode of ['cancel','stale','commit']){
  const h=harness();h.api.actions.jump();h.fill({hours:160});await h.submit();noError(h);const arrived=h.persisted();h.api.setView(far.id);
  h.api.actions['jump-undo']();assert.equal(h.dom.ids.get('modal-submit').textContent,'Use mulligan & return');const submit=h.dom.ids.get('modal-form').onsubmit;
  if(mode==='cancel'){h.api.closeModal();await submit({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});same(h.persisted(),arrived);continue;}
  if(mode==='stale'){h.store.save(S.transition(arrived,'Later deposit',s=>S.deposit(s,1,'Newer action')),arrived.revision);const changed=h.persisted();await h.submit();same(h.persisted(),changed);assert.match(h.dom.ids.get('modal-error').textContent,/changed/i);continue;}
  await h.submit();noError(h);const undone=h.persisted();assert.equal(undone.actual,origin.id);assert.equal(h.api.view,origin.id);assert.equal(undone.jumpAttempts[0].mulliganUsed,true);await submit({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});same(h.persisted(),undone);
 }
});

test('cancelled modal rounding never contaminates a service confirmation audit',async()=>{
 const s=campaign();s.ship.fuel=bindings.configureFuel(200,43,20,0,2);
 const h=harness(s);h.api.setInputRounding([{label:'Cancelled old expense',before:'1.2',after:'2'}]);h.api.closeModal();
 h.api.refuelShortcut();await h.api.services.action('service-confirm','',h.api.services.token());
 assert.equal(h.persisted().ship.fuel.aboardTons,43);assert.equal(h.persisted().events.some(e=>e.label==='Rounding applied [R]'),false);
 const detail=h.api.historyDetails({label:'Fuel aboard correction audit',world:origin.id,fuelCorrection:{before:43,after:20,removed:23,reason:'Tank sounding'}});
 assert.match(detail,/Tank sounding/);assert.match(detail,/Cr 0 · no refund/);assert.doesNotMatch(detail,/Additional inputs were not saved/);
});

test('recurring settings history shows mortgage and maintenance facts instead of cargo corrections',()=>{
 const s=campaign(),mortgage={originalAmount:'24000000',payment:'100000',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105'},maintenance={payment:'2000',nextDueDate:'015-1105',paidSinceTracking:'0'};
 const n=S.transition(s,'Ship / trader settings',n=>{S.setMortgage(n,mortgage);S.setMaintenance(n,maintenance);});
 const h=harness(n);
 const mortgageHTML=h.api.historyDetails(n.events.find(e=>e.label==='Mortgage settings audit'));
 assert.match(mortgageHTML,/Mortgage before/);assert.match(mortgageHTML,/Not configured/);assert.match(mortgageHTML,/Original mortgage amount/);assert.match(mortgageHTML,/Cr 24,000,000/);assert.match(mortgageHTML,/029-1105/);assert.doesNotMatch(mortgageHTML,/Cargo before correction|Cargo after correction/);
 const maintenanceHTML=h.api.historyDetails(n.events.find(e=>e.label==='Maintenance settings audit'));
 assert.match(maintenanceHTML,/Monthly maintenance after/);assert.match(maintenanceHTML,/Cr 2,000/);assert.match(maintenanceHTML,/015-1105/);assert.doesNotMatch(maintenanceHTML,/Cargo before correction/);
 const cleared=S.transition(n,'Clear tracking',n=>S.setMortgage(n,undefined));const clearHTML=h.api.historyDetails(cleared.events.at(-2));assert.match(clearHTML,/Mortgage after<\/h3><p class="help">Not configured/);
});

function expenseArg(h,name){const tag=[...h.api.services.panel().matchAll(/<button\b([^>]*)>/g)].map(m=>attrs(m[1])).find(a=>a['data-action']===name);assert.ok(tag,'Rendered '+name);return tag['data-arg'];}
function recurringCampaign(){const s=campaign();s.ship.fuel=bindings.configureFuel(200,43,20,0,2);s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:4,high:0},crew:{low:0,middle:0,high:0}};s.ship.lifeSupport={capacityHours:672,remainingHours:336,elapsedHours:0};s.ship.mortgage={originalAmount:'240000',payment:'1000',remainingPayments:360,totalPaid:'120000',nextDueDate:'029-1105'};s.ship.maintenance={payment:'100',nextDueDate:'015-1105',paidSinceTracking:'0'};return S.validate(s);}
test('all direct service switches discard only drafts and detached callbacks cannot commit',async()=>{
 const h=harness(recurringCampaign()),before=h.persisted();h.api.setTab('Overview');
 for(const from of ['fuel','support','mortgage','maintenance','salary','berthing'])for(const to of ['fuel','support','expenses']){
  h.api.services.open(from,{fresh:true});const stock=['fuel','support'].includes(from),oldToken=h.api.services.token(),oldArg=stock?'':expenseArg(h,'expense-back');
  h.api.services.open(to);same(h.persisted(),before);
  await h.api.services.action(stock?'service-confirm':'expense-pay',oldArg,oldToken);same(h.persisted(),before);
 }
 h.api.services.close();assert.doesNotMatch(h.api.shipActions(),/port-costs/);
});
test('mortgage payment stays on a ledger-backed receipt across switching and reload, with History Undo only',async()=>{
 const h=harness(recurringCampaign()),before=h.persisted();h.api.setTab('Overview');h.api.actions['ship-expenses']();assert.match(h.api.services.panel(),/Regular 4-week total/);
 h.api.services.open('mortgage',{fresh:true});const pay=expenseArg(h,'expense-pay');await h.api.services.action('expense-pay',pay);
 const paid=h.persisted();assert.equal(paid.bank,'99000');assert.equal(paid.ship.mortgage.remainingPayments,359);assert.match(h.api.services.panel(),/Payment recorded/);assert.doesNotMatch(h.api.services.panel(),/data-action="expense-(pay|cancel)"/);
 await h.api.services.action('expense-pay',pay);same(h.persisted(),paid);
 h.api.services.open('support');same(h.persisted(),paid);h.api.services.open('mortgage');assert.match(h.api.services.panel(),/Payment recorded/);same(h.persisted(),paid);
 const reload=harness(paid);reload.api.services.open('mortgage');assert.match(reload.api.services.panel(),/Payment recorded/);same(reload.persisted(),paid);
 h.api.actions.tab('History');h.api.actions.undo();assert.equal(h.persisted().bank,before.bank);same(h.persisted().ship.mortgage,before.ship.mortgage);
});
test('life support expense audit retains the saved location after moving, including legacy fallback',()=>{
 const s=recurringCampaign(),paid=S.transition(s,'Refill',S.refillLifeSupport),entry=paid.ledger.at(-1);
 assert.equal(entry.expense.worldId,origin.id);assert.equal(entry.expense.worldName,'Origin');
 paid.actual=destination.id;paid.route=[destination.id];paid.routeIndex=0;const h=harness(S.validate(paid));
 h.api.ledgerAudit(entry.id);assert.match(modalText(h),/Origin/);assert.doesNotMatch(modalText(h),/Destination/);h.api.closeModal();
 const legacy=structuredClone(paid);delete legacy.ledger.at(-1).expense.worldName;delete legacy.ledger.at(-1).expense.worldId;const old=harness(legacy);old.api.ledgerAudit(entry.id);assert.match(modalText(old),/Origin/);assert.doesNotMatch(modalText(old),/Destination/);
});

test('expense fuel and life support names use existing setup guards for legacy campaigns',async()=>{
 for(const kind of ['fuel','support']){
  const h=harness(campaign()),before=h.persisted();h.api.services.open('expenses');const buttons=[...h.api.services.panel().matchAll(/<button\b([^>]*)>/g)].map(m=>attrs(m[1]));const link=buttons.find(a=>a['data-action']==='expense-open'&&a['data-arg'].endsWith(':'+kind));assert.ok(link);
  await h.api.services.action('expense-open',link['data-arg']);assert.equal(h.dom.ids.get('modal-title').textContent,'Ship, trader & options');assert.equal(h.api.services.active(),false);h.api.closeModal();assert.doesNotMatch(h.dom.ids.get('main').innerHTML,/id="expense-panel"/);h.api.services.open('expenses');assert.match(h.api.services.panel(),/Regular 4-week total/);same(h.persisted(),before);
 }
});

test('leaving Overview closes unfinished service views and restores current-world Trade and Accounts controls',async()=>{
 for(const kind of ['fuel','support','expenses','mortgage','maintenance','salary','berthing']){
  const h=harness(recurringCampaign()),before=h.persisted();h.api.services.open(kind,{fresh:true});const token=h.api.services.token();
  h.api.actions.tab('Trade');assert.equal(h.api.services.active(),false,kind+' leaves no hidden lock');assert.equal(h.button('search').disabled,false);assert.equal(h.button('buyer-search').disabled,false);same(h.persisted(),before);
  await h.api.services.action('service-confirm','',token);same(h.persisted(),before);
  h.api.services.open(kind,{fresh:true});h.api.actions.tab('Accounts');assert.equal(h.button('ship-expenses').disabled,false);assert.equal(h.button('deposit').disabled,false);same(h.persisted(),before);
 }
});
test('leaving a service retains editor ownership guards on Trade',()=>{
 const h=harness(recurringCampaign()),before=h.persisted();h.api.refuelShortcut();h.store.editable=false;h.api.actions.tab('Trade');assert.equal(h.api.services.active(),false);assert.equal(h.button('search').disabled,true);assert.equal(h.button('buyer-search').disabled,true);same(h.persisted(),before);
});


test('Cargo Hold cancels every unfinished service without saving or replaying stale controls',async()=>{
 const h=harness(recurringCampaign()),before=h.persisted();h.api.setTab('Overview');
 for(const from of ['fuel','support','mortgage','maintenance','salary','berthing']){
  h.api.services.open(from,{fresh:true});const stock=['fuel','support'].includes(from),oldToken=h.api.services.token(),oldArg=stock?'':expenseArg(h,'expense-back');
  if(from==='support')await h.api.services.action('service-adjust','',oldToken);
  h.api.actions['cargo-hold']();assert.equal(h.api.services.active(),false);assert.match(h.dom.ids.get('main').innerHTML,/id="cargo-hold-panel"/);same(h.persisted(),before);
  await h.api.services.action(stock?'service-confirm':'expense-pay',oldArg,oldToken);same(h.persisted(),before);
  for(const next of ['refuel','refill-support','ship-expenses']){h.api.actions['cargo-hold']();h.api.actions[next]();assert.doesNotMatch(h.dom.ids.get('main').innerHTML,/id="cargo-hold-panel"/);same(h.persisted(),before);}
 }
 h.api.actions['cargo-hold']();h.api.actions['cargo-hold-close']();assert.doesNotMatch(h.dom.ids.get('main').innerHTML,/id="cargo-hold-panel"/);assert.match(h.dom.ids.get('main').innerHTML,/Selected world data/);assert.equal(h.calls.saves,0);
});
test('read-only Cargo Hold and its tab links preserve all campaign and Undo data',()=>{
 const h=harness(recurringCampaign()),before=h.persisted();h.store.editable=false;h.api.setTab('Overview');
 h.api.actions['cargo-hold']();assert.match(h.dom.ids.get('main').innerHTML,/id="cargo-hold-panel"/);assert.match(h.dom.ids.get('main').innerHTML,/overview-cargo/);
 h.api.actions.world(destination.id);assert.equal(h.api.state.actual,origin.id);assert.equal(h.api.view,destination.id);assert.match(h.dom.ids.get('main').innerHTML,/ship at Origin/);
 for(const tab of ['Cargo','Contracts']){h.api.actions['cargo-hold-tab'](tab);assert.doesNotMatch(h.dom.ids.get('main').innerHTML,/id="cargo-hold-panel"/);h.api.actions.tab('Overview');h.api.actions['cargo-hold']();}
 h.dom.dispatch('keydown',{matches:()=>false},{key:'Escape',preventDefault(){}});assert.doesNotMatch(h.dom.ids.get('main').innerHTML,/id="cargo-hold-panel"/);same(h.persisted(),before);assert.equal(h.calls.saves,0);
});


function selectedShipButton(h){
 const buttons=[...h.api.shipActions().matchAll(/<button\b([^>]*)>/g)].map(m=>attrs(m[1])).filter(a=>'aria-pressed'in a);
 assert.equal(buttons.length,4,'All service buttons expose a selected state');
 for(const button of buttons)assert.ok(['true','false'].includes(button['aria-pressed']));
 return buttons.filter(a=>a['aria-pressed']==='true').map(a=>a['data-action']);
}
for(const action of ['refuel','refill-support','cargo-hold','ship-expenses'])test(action+' toggles World data repeatedly without writes or campaign locks',()=>{
 const h=harness(recurringCampaign()),before=h.persisted();h.api.setTab('Overview');
 for(let i=0;i<8;i++){
  h.api.toggleShipPanel(action);assert.deepEqual(selectedShipButton(h),i%2?[]:[action]);
  assert.equal(h.api.services.active(),i%2===0&&action!=='cargo-hold');
  same(h.persisted(),before);
 }
 assert.match(h.dom.ids.get('main').innerHTML,/id="world-information-panel"/);
 assert.equal(h.api.services.active(),false);
 h.api.actions['day-forward']();assert.equal(h.persisted().hours,before.hours+24,'Closing releases the campaign mutation lock');
});
test('switching each selected service directly to every different button preserves draft-only state',async()=>{
 const h=harness(recurringCampaign()),before=h.persisted();h.api.setTab('Overview');
 for(const from of ['refuel','refill-support','cargo-hold','ship-expenses'])for(const to of ['refuel','refill-support','cargo-hold','ship-expenses']){
  if(selectedShipButton(h).length)h.api.toggleShipPanel(selectedShipButton(h)[0]);
  h.api.toggleShipPanel(from);const token=h.api.services.token();
  h.api.toggleShipPanel(to);assert.deepEqual(selectedShipButton(h),from===to?[]:[to]);
  await h.api.services.action('service-confirm','',token);same(h.persisted(),before);
 }
});
test('toggling support adjust/review and fuel correction invalidates every old stock handler',async()=>{
 for(const kind of ['refuel','refill-support'])for(const mode of ['edit','review']){
  const h=harness(recurringCampaign()),before=h.persisted();h.api.setTab('Overview');h.api.toggleShipPanel(kind);
  const token=h.api.services.token();
  await h.api.services.action(kind==='refuel'?'service-fuel-correct':'service-adjust','',token);
  // A correction without reduced fuel cannot be reviewed; ordinary support can.
  if(mode==='review'&&kind==='refill-support')await h.api.services.action('service-review','',token);
  h.api.toggleShipPanel(kind);h.api.toggleShipPanel(kind);const replacement=h.api.services.panel();
  for(const action of ['service-confirm','service-review','service-back','service-cancel','service-fuel-step'])await h.api.services.action(action,'10',token);
  assert.equal(h.api.services.panel(),replacement);same(h.persisted(),before);
  h.api.toggleShipPanel(kind);assert.deepEqual(selectedShipButton(h),[]);
 }
});
test('Ship expenses stays selected on a draft or paid receipt; toggling only closes its view',async()=>{
 const h=harness(recurringCampaign()),before=h.persisted();h.api.setTab('Overview');h.api.toggleShipPanel('ship-expenses');
 h.api.services.open('mortgage',{fresh:true});const stalePay=expenseArg(h,'expense-pay');assert.deepEqual(selectedShipButton(h),['ship-expenses']);
 h.api.toggleShipPanel('ship-expenses');assert.deepEqual(selectedShipButton(h),[]);await h.api.services.action('expense-pay',stalePay);same(h.persisted(),before);
 h.api.toggleShipPanel('ship-expenses');h.api.services.open('mortgage',{fresh:true});const pay=expenseArg(h,'expense-pay');await h.api.services.action('expense-pay',pay);
 const paid=h.persisted();assert.equal(paid.bank,'99000');assert.match(h.api.services.panel(),/Payment recorded/);assert.deepEqual(selectedShipButton(h),['ship-expenses']);
 h.api.toggleShipPanel('ship-expenses');await h.api.services.action('expense-pay',pay);assert.deepEqual(selectedShipButton(h),[]);same(h.persisted(),paid);
 h.api.toggleShipPanel('ship-expenses');assert.match(h.api.services.panel(),/Regular 4-week total/);same(h.persisted(),paid);
});
test('top-level toggles never undo or reapply confirmed fuel or life support',async()=>{
 for(const kind of ['refuel','refill-support']){
  const h=harness(recurringCampaign());h.api.setTab('Overview');h.api.toggleShipPanel(kind);
  const token=h.api.services.token();await h.api.services.action('service-confirm','',token);const paid=h.persisted();
  assert.equal(paid.ledger.length,1);assert.equal(paid.undo.length,1);assert.deepEqual(selectedShipButton(h),[]);
  h.api.toggleShipPanel(kind);h.api.toggleShipPanel(kind);await h.api.services.action('service-confirm','',token);same(h.persisted(),paid);
 }
});

test('a payment in progress blocks all toggles until its confirmed receipt is saved',async()=>{
 const h=harness(recurringCampaign());h.api.setTab('Overview');h.api.services.open('mortgage',{fresh:true});
 const pending=h.api.services.action('expense-pay',expenseArg(h,'expense-pay'));
 assert.equal(h.api.services.committing(),true);
 for(const action of ['refuel','refill-support','cargo-hold','ship-expenses'])assert.throws(()=>h.api.toggleShipPanel(action),/finish saving/);
 await pending;const paid=h.persisted();assert.equal(h.api.services.committing(),false);h.api.toggleShipPanel('ship-expenses');same(h.persisted(),paid);assert.deepEqual(selectedShipButton(h),[]);
});
test('a stale selected stock view still closes after editing ownership is lost',()=>{
 const h=harness(recurringCampaign()),before=h.persisted();h.api.setTab('Overview');h.api.toggleShipPanel('refuel');h.store.editable=false;
 h.api.services.syncControls();h.api.toggleShipPanel('refuel');assert.equal(h.api.services.active(),false);assert.deepEqual(selectedShipButton(h),[]);same(h.persisted(),before);
});

// Audit F02/F03: execute the actual form, normalization, preview, commit and
// persistence boundaries. Browser-native validity has its own dedicated suite.
const radioactives=core.commodities.find(g=>g.name==='Radioactives');
function auditTradeCampaign({raw=true,quantity='1.5',criminal=true}={}){
 const s=tradeCampaign();Object.assign(s.settings,{maxBaseRetailEnabled:true,maxBaseRetail:'100000',useRawIllegalPrices:raw});
 const supplier=s.snapshots[0];Object.assign(supplier.options,s.settings);
 const quote=bindings.R.quote(radioactives,supplier.world,{...supplier.options,side:'buy',illegalGood:false,rollTotal:10},core);
 supplier.offers=[{id:'radio-offer',commodity:radioactives.id,description:'Radioactives',remaining:'3',illegal:false,expired:false,...quote}];
 s.snapshots[1].criminal=criminal;
 s.lots=[{id:'legacy',commodity:radioactives.id,description:'Legacy radioactives',quantity,basis:'1001',goodsValue:'501',illegal:false,world:s.actual,hours:0}];
 return S.validate(s);
}
for(const raw of [true,false])test('offer first-save legality uses the submitted checkbox; RAW exception '+raw,async()=>{
 const h=harness(auditTradeCampaign({raw}));
 const save=async illegal=>{h.api.actions['offer-edit']('radio-offer');h.fill({illegal,useRoll:true,roll:10,reason:'Referee local legality'});await h.submit();noError(h);return h.persisted().snapshots[0].offers[0];};
 const first=await save(true);assert.equal(first.illegal,true);assert.equal(first.audit.effectiveIllegal,true);assert.equal(first.audit.basePrice,raw?1000000:100000);assert.equal(first.audit.illegalRawPriceExempt,raw);
 const repeated=await save(true);assert.equal(repeated.unitPrice,first.unitPrice,'A second identical save must not change the price');
 const legal=await save(false);assert.equal(legal.illegal,false);assert.equal(legal.audit.effectiveIllegal,false);assert.equal(legal.audit.basePrice,100000);assert.equal(legal.audit.illegalRawPriceExempt,false);
 h.api.actions['offer-edit']('radio-offer');h.fill({illegal:true,useRoll:false,price:123456,reason:'Explicit referee price'});await h.submit();noError(h);
 assert.equal(h.persisted().snapshots[0].offers[0].unitPrice,'123456','Manual price survives a legality change');
});
for(const raw of [true,false])for(const threshold of [5,9,10])test('sale local legality, benchmark and price basis agree: RAW '+raw+', threshold '+threshold,async()=>{
 const h=harness(auditTradeCampaign({raw})),before=h.persisted();h.api.setSelected(['legacy']);h.api.beginSale();
 const original=h.api.currentQuote('legacy');h.fill({ban_legacy:threshold});await h.submit();noError(h);
 const line=h.api.previewSale.lines[0],illegal=threshold<=9,base=raw&&illegal?1000000:100000;
 assert.equal(line.audit.effectiveIllegal,illegal);assert.equal(line.audit.locallyBanned,illegal);assert.equal(line.audit.illegalRawPriceExempt,raw&&illegal);assert.equal(line.audit.basePrice,base);assert.equal(line.benchmarkPrice,String(base));
 assert.equal(line.audit.sale.localIllegalDM,illegal?9-threshold:undefined);same(line.audit.dice,original.audit.dice);same(line.audit.tradeComplication,original.audit.tradeComplication);
 assert.equal(line.audit.manualPrice,null);assert.equal(h.calls.priceDice,3);same(h.persisted(),before);
 h.api.actions['sale-edit']();await h.submit();noError(h);assert.equal(h.api.previewSale.lines[0].unitPrice,line.unitPrice);assert.equal(h.calls.priceDice,3);
 await h.submit();noError(h);assert.equal(h.persisted().ledger.find(e=>e.type==='Sale').audit.audit.basePrice,base);
});
test('local ban keeps explicit referee price and benchmark and rejects a noncriminal buyer atomically',async()=>{
 const h=harness(auditTradeCampaign());h.api.setSelected(['legacy']);h.api.beginSale();h.fill({ban_legacy:5,price_legacy:123456,benchmark_legacy:234567,reason:'Referee agrees special terms'});await h.submit();noError(h);
 const line=h.api.previewSale.lines[0];assert.equal(line.unitPrice,'123456');assert.equal(line.benchmarkPrice,'234567');assert.equal(line.audit.manualPrice,'123456');assert.equal(line.audit.basePrice,1000000);assert.equal(line.audit.effectiveIllegal,true);
 const legal=harness(auditTradeCampaign({criminal:false})),before=legal.persisted();legal.api.setSelected(['legacy']);legal.api.beginSale();legal.fill({ban_legacy:5});await legal.submit();assert.match(legal.dom.ids.get('modal-error').textContent,/Locally banned cargo needs a black-market buyer/);same(legal.persisted(),before);
});
for(const quantity of ['0.5','1.5'])test('legacy '+quantity+' tons can preview, fully sell, reload and Undo without rounding stock',async()=>{
 const h=harness(auditTradeCampaign({quantity})),before=h.persisted();h.api.setSelected(['legacy']);h.api.beginSale();
 const input=h.dom.fields().get('qty_legacy');assert.equal(input.value,quantity);assert.equal(input.attributes.min,'0');assert.equal(input.attributes.max,quantity);assert.equal(input.attributes.step,'any');assert.equal(input.dataset.roundExact,quantity);
 await h.submit();noError(h);assert.equal(h.api.previewSale.lines[0].quantity,quantity);assert.equal(h.api.previewSale.lines[0].basis,'1001');same(h.persisted(),before);
 h.api.actions['sale-edit']();assert.equal(h.dom.fields().get('qty_legacy').value,quantity);await h.submit();noError(h);const delta=h.api.previewSale.bankDelta;await h.submit();noError(h);
 assert.equal(h.persisted().lots.length,0);assert.equal(h.persisted().bank,String(BigInt(before.bank)+BigInt(delta)));
 const reloaded=harness(S.validate(JSON.parse(JSON.stringify(h.persisted()))));assert.equal(reloaded.persisted().ledger.find(e=>e.type==='Sale').audit.quantity,quantity);
 reloaded.api.actions.undo();same(reloaded.persisted().lots,before.lots);assert.equal(reloaded.persisted().bank,before.bank);
});
test('one ton from a 1.5-ton legacy lot leaves an exactly saleable 0.5-ton remainder across reload and Undo',async()=>{
 let h=harness(auditTradeCampaign()),before=h.persisted();h.api.setSelected(['legacy']);h.api.beginSale();h.fill({qty_legacy:1});await h.submit();noError(h);assert.equal(h.api.previewSale.lines[0].basis,'667');await h.submit();noError(h);
 const partial=h.persisted();assert.equal(partial.lots[0].quantity,'0.5');assert.equal(partial.lots[0].basis,'334');assert.equal(partial.lots[0].goodsValue,'167');
 h=harness(S.validate(JSON.parse(JSON.stringify(partial))));h.api.setSelected(['legacy']);h.api.beginSale();assert.equal(h.dom.fields().get('qty_legacy').value,'0.5');await h.submit();noError(h);assert.equal(h.api.previewSale.lines[0].basis,'334');await h.submit();noError(h);
 assert.equal(h.persisted().lots.length,0);const sales=h.persisted().ledger.filter(e=>e.type==='Sale');assert.equal(A.decimal(A.sum(sales.map(e=>e.audit.quantity))),'1.5');assert.equal(sales.reduce((n,e)=>n+BigInt(e.audit.basis),0n),1001n);
 h=harness(S.validate(JSON.parse(JSON.stringify(h.persisted()))));h.api.actions.undo();same(h.persisted().lots,partial.lots);assert.equal(h.persisted().bank,partial.bank);h.api.actions.undo();same(h.persisted().lots,before.lots);assert.equal(h.persisted().bank,before.bank);
});
test('the historical remainder exception preserves ordinary upward entry rounding and over-sale rejection',async()=>{
 for(const [quantity,entered,expected]of [['1.5','0.25','1'],['2','0.5','1']]){
  const h=harness(auditTradeCampaign({quantity}));h.api.setSelected(['legacy']);h.api.beginSale();h.fill({qty_legacy:entered});await h.submit();noError(h);assert.equal(h.api.previewSale.lines[0].quantity,expected);
 }
 for(const entered of ['0','1.6']){
  const h=harness(auditTradeCampaign()),before=h.persisted();h.api.setSelected(['legacy']);h.api.beginSale();h.fill({qty_legacy:entered});await h.submit();assert.match(h.dom.ids.get('modal-error').textContent,/Invalid sale quantity/);same(h.persisted(),before);
 }
 const h=harness(auditTradeCampaign());h.api.buyForm('radio-offer');h.fill({quantity:'0.5'});await h.submit();noError(h);assert.match(modalText(h),/<dd>1 t<\/dd>/);assert.match(modalText(h),/0.5 → 1/);
});


test('saved insurance OFF hides new coverage and omits irrelevant purchase premium, without enabling it',async()=>{
 const s=campaign();s.lots=[{id:'held',commodity:'11',description:'Held goods',quantity:'1',basis:'100',goodsValue:'100'}];
 s.snapshots=[{id:'off-supplier',kind:'supplier',party:'supplier',partyName:'Supplier',worldId:origin.id,world:bindings.R.context(origin,core),startedHours:0,hours:0,success:true,criminal:false,options:{local:false},offers:[{id:'off-offer',commodity:'11',name:'Common Electronics',description:'New goods',quantity:'10',remaining:'10',unitPrice:'100',expired:false,illegal:false,audit:{percent:100}}]}];
 const h=harness(s),before=h.persisted();
 assert.doesNotMatch(h.api.cargoPanel(true),/lot-insure/);
 assert.throws(()=>h.api.actions['lot-insure']('held'),/Insurance is disabled/);same(h.persisted(),before);
 h.api.buyForm('off-offer');assert.equal(h.dom.fields().has('insure'),false);assert.equal(h.dom.fields().has('coverage'),false);
 h.fill({quantity:1,fee:0});await h.submit();assert.equal(h.dom.ids.get('modal-title').textContent,'Confirm purchase');
 assert.doesNotMatch(h.dom.ids.get('modal-body').innerHTML,/Insurance premium/);same(h.persisted(),before);
 await h.submit();assert.equal(h.persisted().settings.insurance,false);assert.equal(h.persisted().policies.length,0);assert.equal(h.persisted().bank,'99900');
});

test('saved insurance ON exposes both new coverage controls and zero-cost policy premiums remain visible',async()=>{
 const s=campaign();s.settings.insurance=true;s.lots=[{id:'held',commodity:'11',description:'Held goods',quantity:'1',basis:'100',goodsValue:'100'}];
 s.snapshots=[{id:'on-supplier',kind:'supplier',party:'supplier',partyName:'Supplier',worldId:origin.id,world:bindings.R.context(origin,core),startedHours:0,hours:0,success:true,criminal:false,options:{local:false},offers:[{id:'on-offer',commodity:'11',name:'Common Electronics',description:'New goods',quantity:'10',remaining:'10',unitPrice:'100',expired:false,illegal:false,audit:{percent:100}}]}];
 const h=harness(s);assert.match(h.api.cargoPanel(true),/lot-insure/);h.api.buyForm('on-offer');assert.equal(h.dom.fields().has('insure'),true);
 h.fill({quantity:1,fee:0,insure:true,insuranceLegs:1,insuranceDistance:1,coverage:70,manualPremium:0});await h.submit();
 assert.equal(h.dom.ids.get('modal-error').textContent,'');assert.match(h.dom.ids.get('modal-body').innerHTML,/<dt>Insurance premium<\/dt><dd>Cr 0<\/dd>/);
 await h.submit();assert.equal(h.persisted().settings.insurance,true);assert.equal(h.persisted().policies.length,1);
});
