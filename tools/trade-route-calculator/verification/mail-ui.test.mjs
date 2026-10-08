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
 const ids=new Map(['summary','tabs','main','modal','modal-title','modal-body','modal-error','modal-submit','modal-cancel','modal-form','modal-close','notes','takeover','import-file','save-status','message'].map(id=>[id,element()]));
 let fields=new Map(),buttons=[],markup='';
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
 return {ids,fields:()=>fields,buttons:()=>buttons,document:{createElement(){return {...element(),getContext(){return {measureText:t=>({width:String(t).length*6})};}};},getElementById:id=>ids.get(id)||null,addEventListener(){},querySelector(){return null;},querySelectorAll(selector){
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
 vm.runInContext(executable+`\nglobalThis.api={init(s,c,m,p){state=s;core=c;mp=m;store=p;known={...s.worlds};view=s.actual;tab='Contracts';},get state(){return state;},get drafts(){return contractDrafts;},get check(){return mailCheck;},setState(s){state=s;},setDrafts(d){contractDrafts=d;},setView(id){view=id;},mailPanel,contractsPanel,contractDetails,contractRolls,historyDetails,historyCategory,contractSearch,updateMailEstimate,accept,deliver,editDraft,closeModal,modal,syncModalSubmit,render,backupReplace,actions};`,vm.createContext(sandbox),{filename:'app.mjs (VM; boot omitted)'});
 api=sandbox.api;api.init(structuredClone(saved),core,mp,store);api.render();
 const fill=values=>{for(const[k,v]of Object.entries(values)){const n=dom.fields().get(k);assert.ok(n,`Expected form field ${k}`);if(n.attributes.type==='checkbox')n.checked=Boolean(v);else n.value=String(v);}};
 const submit=()=>dom.ids.get('modal-form').onsubmit({preventDefault(){},currentTarget:dom.ids.get('modal-form')});
 return {api,store,calls,dom,fill,submit,persisted:()=>structuredClone(persisted),button:action=>dom.buttons().find(b=>b.dataset.action===action),check:async(values={})=>{api.contractSearch(true);fill({dice:8,skill:0,characteristic:0,mailAvailability:12,mailContainers:3,...values});await submit();assert.equal(dom.ids.get('modal-error').textContent,'');return api.check;}};
}
const html=h=>h.api.mailPanel();
const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));

test('initial card has explicit check, settings and session-only/read-only History explanation',()=>{
 const h=harness();assert.match(html(h),/No mail check in this session/);assert.match(html(h),/Check for mail/);assert.match(html(h),/previous checks remain read-only in History/);
 assert.match(html(h),/armed ship Yes \(\+2\)/);assert.match(html(h),/Naval \/ Scout rank 2/);assert.match(html(h),/SOC DM \+1/);assert.equal(h.calls.saves,0);assert.equal(h.api.drafts.length,0);
});
test('standalone Check Mail skips freight table even at eight parsecs, retains freight drafts, saves only audit',async()=>{
 const h=harness(),freight={offerId:'keep-freight',kind:'freight',quantity:'1',payment:'1000',origin:origin.id,destination:destination.id,dueHours:336};h.api.setDrafts([freight,{...freight,offerId:'old-mail',kind:'mail'}]);const before=h.persisted();
 await h.check({destination:far.id});assert.equal(h.calls.freight,0);assert.equal(h.calls.mail,1);assert.equal(h.calls.saves,1);same(h.api.drafts.filter(c=>c.kind==='freight'),[freight]);assert.equal(h.api.drafts.filter(c=>c.kind==='mail').length,1);assert.ok(!h.api.drafts.some(c=>c.offerId==='old-mail'));
 const saved=h.persisted(),e=saved.events.find(e=>e.mailOnly);assert.equal(saved.contracts.length,0);assert.equal(saved.bank,before.bank);assert.equal(saved.hours,before.hours);same(saved.lots,before.lots);same(saved.ledger,before.ledger);assert.ok(!('mailCheck'in saved));assert.ok(!('contractDrafts'in saved));assert.equal(e.destination,far.id);assert.equal(e.offers.length,1);assert.equal(e.offers[0].dueHours,null);
 assert.equal(e.searchDice.total,8);assert.equal(e.searchDice.manual,true);assert.equal(e.generatedSearchDice.total,6);assert.equal(e.effectiveSearchDice,8);assert.equal(e.mailAudit.dice.manual,true);assert.equal(e.mailAudit.count.manual,true);assert.match(html(h),/Mail available/);assert.match(html(h),/15 t/);assert.match(html(h),/Cr 75,000/);assert.equal(h.button('contract-accept').disabled,false);
});
test('mail form separates automatic DMs from bounded manual availability and container rolls',()=>{
 const h=harness();h.api.contractSearch(true);const form=h.dom.ids.get('modal-body').innerHTML;
 for(const text of ['Manual mail rolls (optional)','Mail availability · 2D total','Mail containers · 1D roll','container die is used only when mail is available'])assert.ok(form.includes(text));assert.equal(h.dom.fields().has('days'),false);assert.equal(h.dom.fields().has('diceSequence'),false);
 assert.equal(h.dom.fields().get('mailAvailability').attributes.min,'2');assert.equal(h.dom.fields().get('mailAvailability').attributes.max,'12');assert.equal(h.dom.fields().get('mailContainers').attributes.min,'1');assert.equal(h.dom.fields().get('mailContainers').attributes.max,'6');
 const initial=h.dom.ids.get('mail-dm-preview').textContent;assert.match(initial,/Automatic freight traffic DM/);assert.match(initial,/mail freight-band DM/);h.fill({dice:12,skill:2,characteristic:1});h.api.updateMailEstimate();assert.notEqual(h.dom.ids.get('mail-dm-preview').textContent,initial);h.fill({dice:13});h.api.updateMailEstimate();assert.match(h.dom.ids.get('mail-dm-preview').textContent,/Enter valid search dice/);
});
test('audit exposes every traffic/mail DM, manual rolls, fixed terms and rule interpretations',async()=>{
 const h=harness();await h.check();const card=html(h);
 for(const label of ['How was this calculated?','Search 2D','Search skill DM','Search characteristic DM','Search target','Origin world DM','Destination world DM','Distance DM','Search Effect','Combined freight traffic DM','Population DM','Starport DM','Technology DM','Travel-zone DM','Availability 2D roll','Freight-band DM','Armed ship DM','Low technology DM','Naval / Scout rank DM','Social Standing DM','Final availability result','Required result','Outcome','Container-count die','Quantity per container','Payment per container','INT-002','INT-004','239–241'])assert.ok(card.includes(label),label);
 for(const total of [8,12,3])assert.ok(card.includes('Manual roll total: '+total));assert.match(card,/5 tons/);assert.match(card,/Cr 25,000 on delivery, regardless of distance/);assert.match(card,/no automatic deadline or late penalty/);
 const e=h.api.state.events.find(e=>e.mailOnly),history=h.api.historyDetails(e);assert.match(history,/<h3>Mail check<\/h3>/);assert.doesNotMatch(history,/data-action="contract-accept"/);assert.equal(h.api.historyCategory(e),'Searches');
});
test('unavailable result has audit but no containers, payment, acceptance or persistent offer',async()=>{
 const h=harness();await h.check({dice:2,mailAvailability:2,mailContainers:6});assert.equal(h.api.check.available,false);assert.equal(h.api.drafts.length,0);assert.equal(h.api.state.contracts.length,0);assert.match(html(h),/No mail available/);assert.match(html(h),/No containers or payment offered/);assert.match(html(h),/Not rolled: no mail available/);assert.doesNotMatch(html(h),/data-action="contract-accept"/);assert.equal(h.api.state.events.find(e=>e.mailOnly).offers.length,0);
});
test('whole-consignment capacity and wrong origin disable acceptance through render',async()=>{
 const h=harness();await h.check();h.api.state.ship.capacity='14';h.api.render();assert.equal(h.button('contract-accept').disabled,true);assert.ok(h.button('contract-accept').hasAttribute('data-unavailable'));assert.match(html(h),/Does not fit/);assert.match(html(h),/partial acceptance is not available/);
 h.api.state.ship.capacity='15';h.api.render();assert.equal(h.button('contract-accept').disabled,false);h.api.state.actual=destination.id;h.api.render();assert.equal(h.button('contract-accept').disabled,true);assert.match(html(h),/Return to the origin world/);
});
test('actual app acceptance/delivery submissions show correct status and reserve/release capacity',async()=>{
 const h=harness();await h.check();const id=h.api.drafts[0].offerId,bank=h.api.state.bank;h.api.accept(id);assert.match(h.dom.ids.get('modal-body').innerHTML,/does not pay you yet/);await h.submit();assert.equal(h.api.state.contracts.length,1);assert.equal(h.api.drafts.length,0);assert.equal(h.api.state.bank,bank);assert.equal(A.decimal(S.used(h.api.state)),'15');assert.match(html(h),/Mail accepted/);assert.match(html(h),/15 t reserved/);assert.doesNotMatch(html(h),/data-action="contract-accept"/);
 h.api.state.actual=destination.id;assert.match(html(h),/At destination/);h.api.deliver(h.api.state.contracts[0].id);await h.submit();assert.equal(h.api.state.contracts[0].status,'delivered');assert.equal(h.api.state.bank,'175000');assert.equal(A.decimal(S.used(h.api.state)),'0');assert.match(html(h),/Mail delivered/);assert.match(html(h),/Released after delivery/);
});
test('read-only render disables mutations and still displays contract audits',async()=>{
 const h=harness();await h.check();h.store.editable=false;h.api.render();for(const action of ['mail-check','settings-edit','contract-accept','draft-edit'])assert.equal(h.button(action)?.disabled,true,action);assert.match(h.dom.ids.get('main').innerHTML,/data-action="draft-audit"/);const before=h.persisted();h.api.accept(h.api.drafts[0].offerId);assert.equal(h.dom.ids.get('modal-submit').disabled,true);await h.submit();same(h.persisted(),before);
});
test('referee override updates card and keeps original rolls plus full before/after audit',async()=>{
 const h=harness();await h.check();h.api.editDraft(h.api.drafts[0].offerId);h.fill({description:'Priority dispatch',quantity:10,payment:60000,due:'',reason:'Referee replaces one container'});await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'');assert.match(html(h),/10 t/);assert.match(html(h),/Cr 60,000/);assert.match(html(h),/Referee-edited terms/);
 const detail=h.api.contractDetails(h.api.drafts[0]);for(const text of ['Changes to contract terms','Referee replaces one container','Manual roll total: 3','Cr 75,000','Cr 60,000'])assert.ok(detail.includes(text));assert.equal(h.api.state.events.find(e=>e.label==='Contract offer edit').offer.overrides.length,1);assert.equal(h.api.state.contracts.length,0);
});
test('Cancel invalidates original submit; reopening and repeated submits commit just once',async()=>{
 const h=harness();h.api.contractSearch(true);const cancelled=h.dom.ids.get('modal-form').onsubmit,before=h.persisted();h.api.closeModal();await cancelled({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});same(h.persisted(),before);assert.equal(h.api.check,null);
 h.api.contractSearch(true);h.fill({dice:8,mailAvailability:12,mailContainers:3});await Promise.all([h.submit(),h.submit()]);assert.equal(h.calls.saves,1);assert.equal(h.calls.mail,1);assert.equal(h.api.drafts.length,1);await h.submit();assert.equal(h.calls.saves,1);
});
test('stale revision and lost editing lock reject an open check without replacing drafts',async()=>{
 const h=harness();await h.check();const old=JSON.stringify(h.api.drafts),oldCheck=JSON.stringify(h.api.check);h.api.contractSearch(true);h.fill({dice:8,mailAvailability:12,mailContainers:1});h.api.state.revision++;await h.submit();assert.match(h.dom.ids.get('modal-error').textContent,/Campaign changed/);assert.equal(JSON.stringify(h.api.drafts),old);assert.equal(JSON.stringify(h.api.check),oldCheck);assert.equal(h.calls.saves,1);
 h.api.closeModal();h.api.contractSearch(true);h.store.editable=false;h.api.syncModalSubmit();assert.equal(h.dom.ids.get('modal-submit').disabled,true);await h.submit();assert.equal(h.calls.saves,1);
});
test('invalid manual rolls never save or replace session offers',async()=>{
 for(const values of [{mailAvailability:1},{mailAvailability:13},{mailAvailability:2.5},{mailContainers:0},{mailContainers:7},{mailContainers:2.5},{dice:1},{skill:0.5}]){const h=harness();h.api.contractSearch(true);h.fill({dice:8,mailAvailability:12,mailContainers:3,...values});await h.submit();assert.notEqual(h.dom.ids.get('modal-error').textContent,'',JSON.stringify(values));assert.equal(h.calls.saves,0);assert.equal(h.api.drafts.length,0);assert.equal(h.api.check,null);}
});
test('reload preserves read-only history without reconstructing offers; reset clears session card and drafts',async()=>{
 const h=harness();await h.check();const reload=harness(h.persisted());assert.equal(reload.api.check,null);assert.equal(reload.api.drafts.length,0);assert.match(html(reload),/No mail check in this session/);assert.doesNotMatch(reload.dom.ids.get('main').innerHTML,/data-action="contract-accept"/);assert.match(reload.api.historyDetails(reload.api.state.events.find(e=>e.mailOnly)),/Mail available/);
 h.api.backupReplace('Reset campaign',S.initial());h.fill({backed:true});await h.submit();assert.equal(h.api.check,null);assert.equal(h.api.drafts.length,0);assert.equal(h.api.state.initialized,false);
});
test('browsed-only worlds and empty space cannot initiate Mail checks',()=>{
 const h=harness();h.api.setView(destination.id);assert.throws(()=>h.api.contractSearch(true),/actual world/);h.api.setView(origin.id);h.api.state.worlds[origin.id].emptySpace=true;assert.throws(()=>h.api.contractSearch(true),/empty space/);assert.equal(h.calls.mail,0);assert.equal(h.calls.saves,0);
});

test('combined search still generates freight and mail; standalone recheck preserves exact freight terms',async()=>{
 const h=harness();h.api.contractSearch(false);assert.equal(h.dom.fields().has('days'),true);assert.equal(h.dom.fields().has('diceSequence'),true);
 h.fill({dice:8,skill:0,characteristic:0,mailAvailability:12,mailContainers:2,days:17});await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'');assert.equal(h.calls.freight,1);
 const freight=structuredClone(h.api.drafts.filter(c=>c.kind==='freight'));assert.ok(freight.length);assert.ok(freight.every(c=>c.dueHours===17*24));assert.equal(h.api.drafts.find(c=>c.kind==='mail').dueHours,null);
 await h.check({mailContainers:1});assert.equal(h.calls.freight,1);same(h.api.drafts.filter(c=>c.kind==='freight'),freight);assert.equal(h.api.drafts.filter(c=>c.kind==='mail').length,1);assert.match(html(h),/5 t/);
});

test('replacement dialog invalidates former mail check and acceptance callbacks',async()=>{
 const h=harness();h.api.contractSearch(true);const first=h.dom.ids.get('modal-form').onsubmit;
 h.api.modal('Read-only inspection','<p>Keep this dialog</p>',null);await first({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});assert.equal(h.calls.saves,0);assert.equal(h.dom.ids.get('modal-title').textContent,'Read-only inspection');assert.equal(h.dom.ids.get('modal-error').textContent,'');
 h.api.closeModal();await h.check();h.api.accept(h.api.drafts[0].offerId);const oldAccept=h.dom.ids.get('modal-form').onsubmit;h.api.closeModal();h.api.contractSearch(true);await oldAccept({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});assert.equal(h.api.state.contracts.length,0);assert.equal(h.calls.saves,1);assert.equal(h.dom.ids.get('modal-title').textContent,'Check for mail');
});

test('repeated acceptance and delivery submit cannot duplicate capacity or payment',async()=>{
 const h=harness();await h.check();h.api.accept(h.api.drafts[0].offerId);await Promise.all([h.submit(),h.submit()]);assert.equal(h.api.state.contracts.length,1);assert.equal(h.calls.saves,2);assert.equal(A.decimal(S.used(h.api.state)),'15');
 h.api.state.actual=destination.id;h.api.deliver(h.api.state.contracts[0].id);await Promise.all([h.submit(),h.submit()]);assert.equal(h.api.state.bank,'175000');assert.equal(h.calls.saves,3);assert.equal(h.api.state.ledger.filter(e=>e.contractId).length,1);
});

test('unavailable Mail result never matches unrelated legacy contracts without offer IDs',async()=>{
 const h=harness();h.api.state.contracts.push({id:'legacy-mail',kind:'mail',quantity:'5',payment:'25000',origin:origin.id,destination:destination.id,status:'accepted',dueHours:null});await h.check({dice:2,mailAvailability:2});assert.equal(h.api.check.available,false);assert.match(html(h),/No mail available/);assert.doesNotMatch(html(h),/Mail accepted/);assert.doesNotMatch(html(h),/5 t reserved/);
});

test('blank optional rolls use generated dice; immutable history survives referee edits and later checks',async()=>{
 const h=harness();await h.check({mailAvailability:'',mailContainers:''});const e=h.api.state.events.find(e=>e.mailOnly),original=JSON.stringify(e);
 assert.deepEqual(e.mailAudit.dice.dice,[3,3]);assert.equal(e.mailAudit.dice.manual,undefined);assert.deepEqual(e.mailAudit.count.dice,[3]);
 h.api.editDraft(h.api.drafts[0].offerId);h.fill({description:'Edited',quantity:5,payment:100,due:'',reason:'Referee'});await h.submit();assert.equal(JSON.stringify(h.api.state.events.find(x=>x.id===e.id)),original);
 await h.check({mailContainers:1});assert.equal(JSON.stringify(h.api.state.events.find(x=>x.id===e.id)),original);
});

test('Undo Mail check removes actionable mail but preserves freight drafts and finances',async()=>{
 const h=harness(),freight={offerId:'preserve-freight',kind:'freight',quantity:'1',payment:'1000',origin:origin.id,destination:destination.id,dueHours:336};h.api.setDrafts([freight]);const before=h.persisted();await h.check();h.api.actions.undo();
 assert.equal(h.api.check,null);same(h.api.drafts,[freight]);assert.doesNotMatch(html(h),/data-action="contract-accept"/);assert.equal(h.api.state.bank,before.bank);same(h.api.state.contracts,before.contracts);same(h.api.state.lots,before.lots);same(h.api.state.ledger,before.ledger);
 const reloaded=harness(h.persisted());assert.equal(reloaded.api.drafts.length,0);assert.equal(reloaded.api.check,null);
});

test('Undo combined search or referee edit discards session drafts without rebuilding historical offers',async()=>{
 for(const kind of ['search','edit']){
  const h=harness();if(kind==='search'){h.api.contractSearch(false);h.fill({dice:8,mailAvailability:12,mailContainers:2,days:14});await h.submit();}else{await h.check();h.api.editDraft(h.api.drafts[0].offerId);h.fill({description:'Edited',quantity:5,payment:100,due:'',reason:'Referee'});await h.submit();}
  assert.ok(h.api.drafts.length);h.api.actions.undo();assert.equal(h.api.drafts.length,0,kind);assert.equal(h.api.check,null,kind);assert.equal(h.api.state.contracts.length,0);assert.equal(h.api.state.bank,'100000');assert.doesNotMatch(h.dom.ids.get('main').innerHTML,/data-action="contract-accept"/);
 }
});
