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
function campaign(){const s=S.initial();s.initialized=true;s.bank='1000000';s.actual=origin.id;s.worlds=structuredClone({[origin.id]:origin,[destination.id]:destination,[far.id]:far});s.route=[origin.id,destination.id];s.lots=[{id:'insured-lot',commodity:'11',description:'Synthetic insured goods',quantity:'10',basis:'110000',goodsValue:'100000'}];return S.validate(s);}
function harness(saved=campaign()){
 const dom=domDouble(),calls={saves:0,downloads:[]},memory=new Map([['traveller-trade-route-calculator:v1',JSON.stringify(saved)]]);let api,store;
 const localStorage={getItem:k=>memory.get(k)??null,setItem(k,v){memory.set(k,v);calls.saves++;},removeItem:k=>memory.delete(k)};
 const sandbox={...bindings,document:dom.document,window:{addEventListener(){}},crypto:webcrypto,structuredClone,console,FormData:dom.FormData,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},localStorage,Blob,URL:{createObjectURL(blob){calls.downloads.push(blob);return 'blob:test';},revokeObjectURL(){}},BroadcastChannel:undefined};
 vm.runInContext('const initial=S.initial,validate=S.validate;\n'+persistence+'\n'+executable+`\nglobalThis.api={init(s,c,m){core=c;mp=m;known={...s.worlds};view=s.actual;tab='Cargo';store=new Store(receiveCampaign,()=>{});store.editable=true;state=store.read();render();},get state(){return state;},get store(){return store;},get drafts(){return contractDrafts;},setState(s){receiveCampaign(s);},setView(id){view=id;},policyPanel,closedPolicyHistory,cargoPanel,contractsPanel,historyPanel,claimForm,amendPolicy,insureHeldCargo,policyAudit,settings,jump,closeModal,modal,syncModalSubmit,render,backupReplace,actions};`,vm.createContext(sandbox),{filename:'app.mjs + production persistence (VM; boot omitted)'});
 api=sandbox.api;api.init(structuredClone(saved),core,mp);store=api.store;
 const fill=values=>{for(const[k,v]of Object.entries(values)){const n=dom.fields().get(k);assert.ok(n,`Expected form field ${k}`);if(n.attributes.type==='checkbox')n.checked=Boolean(v);else n.value=String(v);}};
 const submit=()=>dom.ids.get('modal-form').onsubmit({preventDefault(){},currentTarget:dom.ids.get('modal-form')});
 return {api,store,calls,dom,fill,submit,persisted:()=>JSON.parse(localStorage.getItem('traveller-trade-route-calculator:v1')),raw:()=>localStorage.getItem('traveller-trade-route-calculator:v1'),button:action=>dom.buttons().find(b=>b.dataset.action===action),async insure(){api.insureHeldCargo('insured-lot');fill({coverage:70,insuranceLegs:1,insuranceDistance:1,distanceReason:'',manualPremium:''});await submit();assert.equal(dom.ids.get('modal-error').textContent,'');assert.equal(dom.ids.get('modal-title').textContent,'Confirm cargo insurance');await submit();assert.equal(dom.ids.get('modal-error').textContent,'');return api.state.policies[0];},async settings(values){api.settings();fill(values);await submit();assert.equal(dom.ids.get('modal-error').textContent,'');},async claim(values={}){api.claimForm(api.state.policies[0].id);fill({quantity:2,reason:'Synthetic approved loss',approved:true,...values});await submit();assert.equal(dom.ids.get('modal-error').textContent,'');assert.equal(dom.ids.get('modal-title').textContent,'Confirm loss and claim');await submit();assert.equal(dom.ids.get('modal-error').textContent,'');},async exported(){api.actions.export();return calls.downloads.at(-1).text();},async imported(text){await dom.ids.get('import-file').onchange({target:{files:[{size:text.length,text:async()=>text}],value:''}});assert.equal(dom.ids.get('modal-title').textContent,'Load campaign (JSON)');fill({backed:true});await submit();assert.equal(dom.ids.get('modal-error').textContent,'');}};
}

const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
const financial=s=>({bank:s.bank,lots:s.lots,policies:s.policies,ledger:s.ledger,settings:s.settings,actual:s.actual,route:s.route,hours:s.hours});
const error=h=>h.dom.ids.get('modal-error').textContent;

test('Actual insurance preview and commit debit premium once, preserve quantity/goods, enable feature, Undo atomically',async()=>{
 const h=harness(),before=h.persisted();h.api.insureHeldCargo('insured-lot');assert.equal(h.calls.saves,0);h.api.closeModal();same(h.persisted(),before);
 const p=await h.insure(),after=h.persisted();assert.equal(p.status,'active');assert.equal(p.coverage,70);assert.equal(p.destination,destination.id);assert.equal(p.remainingQuantity,'10');assert.equal(p.insuredValue,'100000');assert.equal(after.bank,String(BigInt(before.bank)-BigInt(p.premium)));assert.equal(after.lots[0].basis,String(BigInt(before.lots[0].basis)+BigInt(p.premium)));assert.equal(after.lots[0].quantity,before.lots[0].quantity);assert.equal(after.lots[0].goodsValue,before.lots[0].goodsValue);assert.equal(after.settings.insurance,true);assert.equal(after.ledger.filter(e=>e.type==='Insurance premium').length,1);
 await h.submit();assert.equal(h.calls.saves,1);h.api.actions.undo();same(financial(h.persisted()),financial(before));
});

test('Active policy hide/show through actual Settings callback preserves original policy terms; Undo restores visibility',async()=>{
 const h=harness();await h.insure();const insured=h.persisted(),p=insured.policies;assert.match(h.api.policyPanel(),/Cargo insurance/);assert.match(h.api.contractsPanel(),/Cargo insurance/);
 await h.settings({insurance:false});assert.equal(h.api.policyPanel(),'');assert.doesNotMatch(h.api.contractsPanel(),/Cargo insurance/);same(h.persisted().policies,p);assert.equal(h.persisted().bank,insured.bank);same(h.persisted().lots,insured.lots);
 const off=h.persisted();const reloaded=harness(off);assert.equal(reloaded.api.policyPanel(),'');same(reloaded.persisted().policies,p);
 h.api.actions.undo();assert.equal(h.persisted().settings.insurance,true);same(h.persisted().policies,p);assert.match(h.api.policyPanel(),/Cargo insurance/);
 await h.settings({insurance:false});await h.settings({insurance:true});same(h.persisted().policies,p);
});

test('Production Store backup/reload and actual JSON import preserve active policies with insurance on or off',async()=>{
 for(const enabled of [true,false]){
  const h=harness();await h.insure();await h.settings({insurance:enabled});const source=h.persisted(),text=await h.exported();same(JSON.parse(text),source);
  const reloaded=harness(JSON.parse(text));same(reloaded.api.state,source);assert.equal(Boolean(reloaded.api.policyPanel()),enabled);
  const target=harness();await target.imported(text);const imported=target.persisted();same(imported.policies,source.policies);same(imported.lots,source.lots);same(imported.ledger,source.ledger);same(imported.settings,source.settings);assert.equal(imported.bank,source.bank);assert.equal(Boolean(target.api.policyPanel()),enabled);
  if(!enabled)await target.settings({insurance:true});await target.claim();assert.equal(target.persisted().policies[0].remainingQuantity,'8');
 }
});

test('Actual partial claim pays original goods coverage; bank/cargo/policy/ledger survive reload/import and Undo atomically',async()=>{
 const h=harness();await h.insure();await h.settings({tax:true,mode:'75'});const before=h.persisted();await h.claim();const after=h.persisted(),p=after.policies[0],c=p.claims[0];assert.equal(c.payout,'14000');assert.equal(c.lostValue,'20000');assert.equal(after.bank,String(BigInt(before.bank)+14000n));assert.equal(after.lots[0].quantity,'8');assert.equal(after.lots[0].goodsValue,'80000');assert.equal(p.remainingQuantity,'8');assert.equal(p.remainingValue,'80000');assert.equal(p.status,'active');assert.equal(after.ledger.at(-1).type,'Insurance claim');assert.equal(after.ledger.at(-1).amount,'14000');assert.equal(after.ledger.length,before.ledger.length+1);
 h.api.policyAudit(p.id);assert.match(h.dom.ids.get('modal-body').innerHTML,/Synthetic approved loss/);assert.match(h.dom.ids.get('modal-body').innerHTML,/Cr 14,000/);h.api.closeModal();
 const bytes=await h.exported();const reloaded=harness(JSON.parse(bytes));same(reloaded.persisted(),after);const imported=harness();await imported.imported(bytes);same(imported.persisted().policies,after.policies);imported.api.actions.undo();same(financial(imported.persisted()),financial(before));
 h.api.actions.undo();same(financial(h.persisted()),financial(before));
});

test('Full claim closes policy, removes cargo, retains read-only History while disabled; Undo restores all',async()=>{
 const h=harness();await h.insure();const before=h.persisted();await h.claim({quantity:10});assert.equal(h.persisted().lots.length,0);assert.equal(h.persisted().policies[0].status,'closed');assert.equal(h.persisted().policies[0].remainingQuantity,'0');assert.equal(h.persisted().policies[0].remainingValue,'0');assert.equal(h.persisted().policies[0].claims[0].payout,'70000');assert.equal(h.api.policyPanel(),'');assert.match(h.api.closedPolicyHistory(),/Closed cargo insurance/);assert.doesNotMatch(h.api.closedPolicyHistory(),/data-action="claim"|data-action="amend"/);
 await h.settings({insurance:false});assert.match(h.api.closedPolicyHistory(),/Closed cargo insurance/);h.api.actions.undo();h.api.actions.undo();same(financial(h.persisted()),financial(before));
});

test('Claim approval, reason and quantity validation reject safely; cancel, repeat, stale and read-only cannot mutate',async()=>{
 for(const fields of [{approved:false},{reason:''},{quantity:0},{quantity:-1},{quantity:11}]){const h=harness();await h.insure();const before=h.persisted();h.api.claimForm(before.policies[0].id);h.fill({quantity:2,reason:'Loss',approved:true,...fields});await h.submit();assert.notEqual(error(h),'');same(h.persisted(),before);}
 for(const mode of ['cancel','stale','readonly','repeat']){const h=harness();await h.insure();const before=h.persisted();h.api.claimForm(before.policies[0].id);h.fill({quantity:2,reason:'Loss',approved:true});await h.submit();const cb=h.dom.ids.get('modal-form').onsubmit;if(mode==='cancel')h.api.closeModal();if(mode==='stale')h.api.state.revision++;if(mode==='readonly')h.store.editable=false;await Promise.all([cb({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')}),cb({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')})]);if(mode==='repeat'){assert.equal(h.persisted().policies[0].claims.length,1);assert.equal(h.persisted().bank,String(BigInt(before.bank)+14000n));}else same(h.persisted(),before);}
});

test('Insurance route progress updates while hidden; immediate jump Undo restores coverage, later Settings closes it',async()=>{
 const h=harness();await h.insure();await h.settings({insurance:false});const before=h.persisted();h.api.jump();h.fill({hours:0});await h.submit();assert.equal(error(h),'');assert.equal(h.persisted().policies[0].status,'arrived');assert.equal(h.persisted().policies[0].routeProgress,1);assert.equal(h.api.policyPanel(),'');
 const immediate=harness(h.persisted());immediate.api.actions.undo();same(financial(immediate.persisted()),financial(before));
 await h.settings({insurance:true});h.api.claimForm(h.persisted().policies[0].id);h.fill({quantity:1,approved:true,reason:'Cannot claim after arrival'});await h.submit();assert.match(error(h),/Policy is not active/);h.api.closeModal();h.api.actions.undo();assert.throws(()=>h.api.actions.undo(),/later campaign change/);assert.equal(h.persisted().policies[0].status,'arrived');
});

test('Amend and close production callbacks preserve original terms, adjust bank/basis and Undo',async()=>{
 for(const mode of ['amend','close']){const h=harness();await h.insure();const before=h.persisted(),original=before.policies[0];h.api.amendPolicy(original.id);h.fill({mode,adjustment:1234,approved:true,reason:'Synthetic amendment'});await h.submit();assert.equal(error(h),'');const after=h.persisted(),p=after.policies[0];assert.equal(after.bank,String(BigInt(before.bank)-1234n));assert.equal(after.lots[0].basis,String(BigInt(before.lots[0].basis)+1234n));assert.equal(p.premium,original.premium);assert.equal(p.insuredValue,original.insuredValue);assert.equal(p.coverage,original.coverage);assert.equal(p.amendments.length,1);same(p.amendments[0].previous,{route:original.route,destination:original.destination,status:original.status});assert.equal(p.status,mode==='close'?'closed':'active');h.api.actions.undo();same(financial(h.persisted()),financial(before));}
});

test('Route deviation while insurance hidden marks amendment-required and explicit amendment reactivates',async()=>{
 const h=harness();await h.insure();await h.settings({insurance:false});const s=h.persisted();s.ship.jump=6;s.worlds['0,1']={...s.worlds['1,0'],id:'0,1',x:0,y:1,name:'Alternate',hex:'0102'};s.route=['0,0','0,1','1,0'];const moved=harness(s);moved.api.jump();moved.fill({hours:0});await moved.submit();assert.equal(error(moved),'');assert.equal(moved.persisted().policies[0].status,'amendment-required');
 await moved.settings({insurance:true});const before=moved.persisted();moved.api.amendPolicy(before.policies[0].id);moved.fill({mode:'amend',adjustment:0,approved:true,reason:'Referee approves alternative route'});await moved.submit();assert.equal(error(moved),'');const p=moved.persisted().policies[0];assert.equal(p.status,'active');same(p.route,['0,1','1,0']);assert.equal(p.routeProgress,0);same(p.amendments[0].previous.route,['0,0','1,0']);await moved.claim({quantity:1});assert.equal(moved.persisted().policies[0].claims[0].payout,'7000');
});

test('Partial sale reduces active coverage and later claim still pays only original sold-adjusted insured quantity',async()=>{
 const h=harness();await h.insure();const before=h.persisted();const preview={bankDelta:'50000',options:{percent:100},lines:[{lotId:'insured-lot',quantity:'2',basis:String(BigInt(before.lots[0].basis)/5n),gross:'50000',fee:'0',tax:'0',adjustment:'0'}]};const sold=S.transition(before,'Synthetic partial sale',s=>S.sell(s,preview,s.actual,null));const saleHarness=harness(sold);assert.equal(saleHarness.persisted().policies[0].remainingQuantity,'8');assert.equal(saleHarness.persisted().policies[0].remainingValue,'80000');await saleHarness.claim({quantity:8});assert.equal(saleHarness.persisted().policies[0].claims[0].payout,'56000');assert.equal(saleHarness.persisted().policies[0].status,'closed');
});

// Check all campaign data after Undo, except the append-only audit trail,
// monotonic revision and Undo stack (which has its own exact assertion).
const campaignData=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['events','revision','undo'].includes(key)));
for(const mode of ['amend','close'])for(const adjustment of [0,1234,-1234]){
 test(`Imported policy without amendments: ${mode}, Cr ${adjustment}, reload, claim and complete Undo`,async()=>{
  const sourceHarness=harness();await sourceHarness.insure();
  const source=JSON.parse(await sourceHarness.exported());delete source.policies[0].amendments;
  // The existing import contract deliberately accepts a missing optional field.
  S.validate(source);assert.equal(Object.hasOwn(source.policies[0],'amendments'),false);
  const imported=harness();await imported.imported(JSON.stringify(source));
  const before=imported.persisted(),original=before.policies[0];
  assert.equal(Object.hasOwn(original,'amendments'),false,'Import does not rewrite history');
  imported.api.amendPolicy(original.id);
  imported.fill({mode,adjustment,approved:true,reason:'Approved imported-policy regression'});
  await imported.submit();assert.equal(error(imported),'');
  const after=imported.persisted(),p=after.policies[0];
  assert.equal(after.revision,before.revision+1);
  assert.equal(after.bank,String(BigInt(before.bank)-BigInt(adjustment)));
  assert.equal(after.lots[0].basis,String(BigInt(before.lots[0].basis)+BigInt(adjustment)));
  for(const key of ['premium','insuredValue','initialQuantity','coverage'])assert.equal(p[key],original[key]);
  assert.equal(after.lots[0].quantity,before.lots[0].quantity);assert.equal(after.lots[0].goodsValue,before.lots[0].goodsValue);
  assert.equal(p.amendments.length,1);
  same(p.amendments[0],{hours:before.hours,reason:'Approved imported-policy regression',previous:{route:original.route,destination:original.destination,status:original.status},adjustment:String(adjustment)});
  assert.equal(p.status,mode==='close'?'closed':'active');
  assert.equal(p.remainingQuantity,mode==='close'?'0':original.remainingQuantity);
  assert.equal(p.remainingValue,mode==='close'?'0':original.remainingValue);
  assert.equal(after.ledger.length,before.ledger.length+1);
  assert.equal(after.ledger.at(-1).type,'Insurance amendment');assert.equal(after.ledger.at(-1).amount,String(-BigInt(adjustment)));
  const bytes=await imported.exported();S.validate(JSON.parse(bytes));
  const reloaded=harness(JSON.parse(bytes));same(reloaded.api.state,after);
  if(mode==='amend'){
   await reloaded.claim({quantity:2});assert.equal(reloaded.persisted().policies[0].claims.at(-1).payout,'14000');
   reloaded.api.actions.undo();same(campaignData(reloaded.persisted()),campaignData(after));same(reloaded.persisted().undo,after.undo);
  }else{
   assert.equal(reloaded.api.policyPanel(),'');assert.match(reloaded.api.closedPolicyHistory(),/Closed cargo insurance/);
  }
  reloaded.api.actions.undo();const undone=reloaded.persisted();
  same(campaignData(undone),campaignData(before));same(undone.undo,before.undo);
  assert.equal(Object.hasOwn(undone.policies[0],'amendments'),false,'Undo restores the original omitted optional field');
  same(harness(JSON.parse(await reloaded.exported())).api.state,undone);
  // The amended/closed backup must also survive the actual replacement path.
  const replaced=harness();await replaced.imported(bytes);replaced.api.actions.undo();
  same(campaignData(replaced.persisted()),campaignData(before));same(replaced.persisted().undo,before.undo);
 });
}

test('A second amendment appends to existing history and Undo preserves the first amendment',async()=>{
 const h=harness();await h.insure();
 for(const reason of ['First approved route','Second approved route']){
  h.api.amendPolicy(h.persisted().policies[0].id);h.fill({mode:'amend',adjustment:100,approved:true,reason});await h.submit();assert.equal(error(h),'');
 }
 const p=h.persisted().policies[0];assert.equal(p.amendments.length,2);assert.deepEqual(p.amendments.map(a=>a.reason),['First approved route','Second approved route']);
 h.api.actions.undo();assert.equal(h.persisted().policies[0].amendments.length,1);same(h.persisted().policies[0].amendments[0],p.amendments[0]);
});

test('Malformed non-array amendment history is rejected by validation and actual import without writes',async()=>{
 const h=harness();await h.insure();const valid=h.persisted();
 for(const value of [null,{},'invalid',0,false]){
  const source=structuredClone(valid);source.policies[0].amendments=value;
  assert.throws(()=>S.validate(source),/Invalid policy amendments/);
  const target=harness(),before=target.raw(),text=JSON.stringify(source);
  await target.dom.ids.get('import-file').onchange({target:{files:[{size:text.length,text:async()=>text}],value:''}});
  assert.match(target.dom.ids.get('message').textContent,/Invalid policy amendments/);
  assert.equal(target.dom.ids.get('modal').open,false);assert.equal(target.raw(),before);assert.equal(target.calls.saves,0);
 }
});

test('Amendment approval, blank reason, insufficient funds and excessive refund reject without partial changes',async()=>{
 for(const fields of [{approved:false},{reason:''},{adjustment:100000000},{adjustment:-100000000}]){const h=harness();await h.insure();const before=h.persisted();h.api.amendPolicy(before.policies[0].id);h.fill({mode:'amend',adjustment:0,approved:true,reason:'Synthetic amendment',...fields});await h.submit();assert.notEqual(error(h),'');same(h.persisted(),before);}
});

test('Arrived and amendment-required policy claim controls remain enabled although actual preview rejects payout',async()=>{
 for(const status of ['arrived','amendment-required']){const h=harness();await h.insure();const seeded=h.persisted();seeded.policies[0].status=status;const ended=harness(seeded);assert.equal(ended.button('claim').disabled,false);const before=ended.persisted();ended.api.claimForm(before.policies[0].id);ended.fill({quantity:1,approved:true,reason:'Cannot claim'});await ended.submit();assert.match(error(ended),/Policy is not active/);same(ended.persisted(),before);}
});


test('Insurance action input never invokes a missing custom-profit field; Settings still toggles its real field',async()=>{
 const h=harness();await h.insure();const bytes=h.raw();
 h.api.amendPolicy(h.persisted().policies[0].id);
 assert.equal(h.dom.fields().has('custom'),false);
 for(const mode of ['close','amend']){
  h.fill({mode});
  assert.doesNotThrow(()=>h.dom.dispatch('input',{...h.dom.fields().get('mode'),closest:selector=>selector==='#modal-form'?h.dom.ids.get('modal-form'):null}));
  assert.equal(h.raw(),bytes,'Input events do not change policy or campaign data');
 }
 h.api.closeModal();h.api.settings();
 for(const mode of ['custom','100','75','custom']){
  h.fill({mode});
  assert.doesNotThrow(()=>h.dom.dispatch('input',{...h.dom.fields().get('mode'),closest:selector=>selector==='#modal-form'?h.dom.ids.get('modal-form'):null}));
  assert.equal(h.dom.fields().get('custom').disabled,mode!=='custom');
 }
 assert.equal(h.raw(),bytes);h.api.closeModal();
});
