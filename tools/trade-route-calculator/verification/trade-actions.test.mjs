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
 const sandbox={...bindings,R:rules,document:dom.document,window:{addEventListener(){}},crypto:webcrypto,structuredClone,console,FormData:dom.FormData,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
 vm.runInContext(executable+`\nglobalThis.api={init(s,c,m,p){state=s;core=c;mp=m;store=p;known={...s.worlds};view=s.actual;tab='Trade';},get state(){return state;},get view(){return view;},setSelected(ids){selected=new Set(ids);},get drafts(){return contractDrafts;},get check(){return mailCheck;},setState(s){receiveCampaign(s);},setDrafts(d){contractDrafts=d;},setView(id){view=id;},get previewSale(){return previewSale;},setTab(t){tab=t;},setRouteDraft(d){routeDraft=d;},get mapZoom(){return mapZoom;},setMapDrag(d){mapDrag=d;},routeJumpControl,routeStops,shipActions,refuelShortcut,currentQuote,priceAudit,searchDialog,beginSale,buyForm,marketPanel,cargoPanel,mailPanel,mailRollSummary,contractsPanel,historyPanel,cancelledMailHistory,contractDetails,contractRolls,historyDetails,historyCategory,contractSearch,updateMailEstimate,accept,deliver,editDraft,closeModal,modal,syncModalSubmit,render,backupReplace,actions};`,vm.createContext(sandbox),{filename:'app.mjs (VM; boot omitted)'});
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
 assert.doesNotMatch(html,/Jump to Far Destination|data-unavailable/);
 assert.equal((html.match(/data-action="jump"/g)||[]).length,1);
 h.api.actions.jump();assert.equal(h.dom.ids.get('modal-title').textContent,'Commit jump · Origin → Destination');
 assert.equal(h.dom.ids.get('modal-submit').textContent,'COMMIT JUMP');
 same(h.persisted(),before);h.api.closeModal();same(h.persisted(),before);
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
 assert.doesNotMatch(h.api.routeJumpControl(),/data-unavailable/);
 h.api.actions.jump();assert.equal(h.dom.ids.get('modal-title').textContent,'Commit jump · Origin → Empty hex <0201> & beyond');
 h.api.closeModal();same(h.persisted(),s);
});
test('one explicit jump commits only one leg, keeps history labels, rejects repeat submit and supports Undo',async()=>{
 const s=campaign();s.route=[origin.id,destination.id,origin.id];s.ship.fuel=bindings.configureFuel(200,40,40,0,2);s.ship.lifeSupport={capacityHours:672,remainingHours:672,elapsedHours:0};
 const h=harness(s),before=h.persisted();h.api.setView(far.id);
 h.api.actions.jump();const oldSubmit=h.dom.ids.get('modal-form').onsubmit;h.fill({hours:160});await h.submit();noError(h);
 const jumped=h.persisted();assert.equal(jumped.actual,destination.id);assert.equal(jumped.routeIndex,1);assert.equal(jumped.hours,160);assert.equal(jumped.ship.fuel.aboardTons,20);
 assert.equal(jumped.bank,before.bank);same(jumped.lots,before.lots);same(jumped.route,before.route);
 assert.equal(jumped.ship.lifeSupport.remainingHours,528);assert.equal(jumped.ship.lifeSupport.elapsedHours,16);
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
  if(mode==='revision')h.store.save(S.transition(before,'Newer test action',s=>s.bank='99999'),before.revision);
  const expected=h.persisted();await h.submit();same(h.persisted(),expected);
  if(mode==='revision')assert.match(h.dom.ids.get('modal-error').textContent,/stale|changed/i);
 }
});
test('Overview has four matching primary services and fuel source lives inside the existing refuel dialog',()=>{
 for(const [port,type]of [['A','refined'],['B','refined'],['C','unrefined'],['D','unrefined'],['E','unrefined']]){
  const s=campaign();s.worlds[origin.id].uwp=port+'788899-C';s.ship.fuel=bindings.configureFuel(200,40,10,0,2);
  const h=harness(s),before=h.persisted();h.api.setTab('Overview');const html=h.api.shipActions();
  assert.equal((html.match(/class="primary"/g)||[]).length,4);assert.doesNotMatch(html,/quickFuelType|fuel-radio|Refined|Unrefined/);
  h.api.setTab('Trade');h.api.refuelShortcut();assert.equal(h.dom.ids.get('modal-title').textContent,'Refuel');
  assert.equal(h.dom.fields().get('fuelType').value,type);assert.equal(h.dom.fields().get('fuelTons').value,'30');
  assert.match(h.dom.ids.get('modal-body').innerHTML,/Refined · Cr500\/ton/);assert.match(h.dom.ids.get('modal-body').innerHTML,/Purchased unrefined · Cr100\/ton/);assert.match(h.dom.ids.get('modal-body').innerHTML,/Collect water · Free unrefined fuel/);
  h.api.closeModal();same(h.persisted(),before);
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
