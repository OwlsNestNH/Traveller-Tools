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
 vm.runInContext(executable+`\nglobalThis.api={init(s,c,m,p){state=s;core=c;mp=m;store=p;known={...s.worlds};view=s.actual;tab='Contracts';},get state(){return state;},get drafts(){return contractDrafts;},get check(){return mailCheck;},setState(s){receiveCampaign(s);},setDrafts(d){contractDrafts=d;},setView(id){view=id;},mailPanel,mailRollSummary,contractsPanel,historyPanel,cancelledMailHistory,contractDetails,contractRolls,historyDetails,historyCategory,contractSearch,updateMailEstimate,accept,deliver,editDraft,closeModal,modal,syncModalSubmit,render,backupReplace,actions};`,vm.createContext(sandbox),{filename:'app.mjs (VM; boot omitted)'});
 api=sandbox.api;api.init(structuredClone(saved),core,mp,store);api.render();
 const fill=values=>{for(const[k,v]of Object.entries(values)){const n=dom.fields().get(k);assert.ok(n,`Expected form field ${k}`);if(n.attributes.type==='checkbox')n.checked=Boolean(v);else n.value=String(v);}};
 const submit=()=>dom.ids.get('modal-form').onsubmit({preventDefault(){},currentTarget:dom.ids.get('modal-form')});
 return {api,store,calls,dom,fill,submit,persisted:()=>structuredClone(persisted),button:action=>dom.buttons().find(b=>b.dataset.action===action),check:async(values={})=>{api.contractSearch(true);fill({dice:8,skill:0,characteristic:0,mailAvailability:12,mailContainers:3,...values});await submit();assert.equal(dom.ids.get('modal-error').textContent,'');return api.check;}};
}
const html=h=>h.api.mailPanel();
const same=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));

const text=markup=>decode(markup.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
// Inspect the expanded outer card while excluding the independent nested
// shipment/calculation disclosures. Outer visibility has its own tests below.
const outsideInnerDetails=markup=>{
 const body=markup.startsWith('<details id="mail-card"')?markup.replace(/^<details\b[^>]*><summary\b[^>]*>[\s\S]*?<\/summary>/,'').replace(/<\/details>$/,''):markup;
 return body.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g,'');
};
const outerDetails=h=>{
 const match=html(h).match(/^<details\b([^>]*)><summary\b([^>]*)>([\s\S]*?)<\/summary>/);
 assert.ok(match,'The whole Mail card is a native details disclosure');
 assert.equal(attrs(match[1]).id,'mail-card');assert.equal(attrs(match[1])['aria-label'],'Mail');
 assert.doesNotMatch(match[3],/<button|<a\b|<input|<select|<summary/,'Summary contains no nested interactive controls');
 assert.match(match[3],/role="status"/,'Visible header exposes the current result');
 return {open:'open'in attrs(match[1]),summary:text(match[3].replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g,'')),markup:match[0]};
};
const toggleOuter=(h,open)=>h.dom.dispatch('toggle',{id:'mail-card',open,isConnected:true});
const summaryText=markup=>{
 const match=markup.match(/<div class="mail-roll-summary[^"]*">([\s\S]*?)<\/div>/);
 assert.ok(match,'A rendered roll summary is present');return text(match[1]);
};
function expandedCardRoll(h){
 const card=html(h),calculation=card.match(/<details\b([^>]*)><summary>How was this calculated\?<\/summary>/);
 assert.ok(calculation,'The calculation disclosure is present');assert.equal('open'in attrs(calculation[1]),false,'Calculation details start collapsed');
 const visible=outsideInnerDetails(card);assert.equal((visible.match(/class="mail-roll-summary/g)||[]).length,1,'Exactly one roll summary sits outside nested collapsed details');
 assert.match(visible,/data-action="mail-audit"[^>]*>Audit<\/button>/);
 return summaryText(visible);
}
const contractRow=(h,id)=>{
 const row=[...h.api.contractsPanel().matchAll(/<tr>([\s\S]*?)<\/tr>/g)].find(m=>m[1].includes(id));
 assert.ok(row,'Saved contract row is rendered');return row[1];
};
const auditValues=markup=>Object.fromEntries([...markup.matchAll(/<dt>(.*?)<\/dt><dd>(.*?)<\/dd>/g)].map(([,k,v])=>[decode(k),decode(v)]));
const acceptedDetails=h=>{
 const match=html(h).match(/<details\b([^>]*\bid="mail-accepted-details"[^>]*)><summary>(.*?)<\/summary>([\s\S]*?)<\/details>/);
 assert.ok(match,'Accepted/delivered mail has a native details container');const attributes=attrs(match[1]);
 assert.ok(attributes.class.split(/\s+/).includes('mail-accepted-details'));
 return {open:'open'in attributes,summary:text(match[2]),body:match[3]};
};

test('initial card has settings and session-only/read-only History explanation; check is in the primary toolbar',()=>{
 const h=harness();assert.match(html(h),/No mail check in this session/);assert.match(html(h),/previous checks remain read-only in History/);
 const panel=h.api.contractsPanel(),toolbar=panel.match(/<div id="contract-actions"[^>]*>([\s\S]*?)<\/div>/);assert.ok(toolbar,'A dedicated contract-action toolbar is present');
 const buttons=[...toolbar[1].matchAll(/<button\b([^>]*)>(.*?)<\/button>/g)].map(([,attributes,label])=>({...attrs(attributes),label:text(label)}));
 assert.deepEqual(buttons.map(b=>b.label),['Find contracts','Manual contract','Check for mail']);
 assert.deepEqual(buttons.map(b=>b['data-action']),['contracts-search','contract-manual','mail-check']);
 for(const button of buttons)assert.ok(button.class.split(/\s+/).includes('primary'),button.label+' uses primary styling');
 assert.equal((panel.match(/data-action="mail-check"/g)||[]).length,1,'Exactly one mail-check action exists');assert.doesNotMatch(html(h),/data-action="mail-check"/,'The check button is outside the Mail card');
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
test('accepted details collapse independently, survive renders and tabs, and never change campaign data',async()=>{
 const h=harness();assert.doesNotMatch(html(h),/id="mail-accepted-details"/);await h.check();assert.doesNotMatch(html(h),/id="mail-accepted-details"/);
 const expected=expandedCardRoll(h);h.api.accept(h.api.drafts[0].offerId);await h.submit();
 const details=acceptedDetails(h);assert.equal(details.open,true);assert.equal(details.summary,'Accepted mail details · 15 t reserved');
 for(const label of ['From Settings:','Edit mail settings','Containers rolled','Total tons','Payment on delivery','Hold capacity','Deliver explicitly at the destination'])assert.ok(details.body.includes(label),label+' is inside the collapsible section');
 const saved=h.persisted(),live=structuredClone(h.api.state),saves=h.calls.saves,check=JSON.stringify(h.api.check);
 const toggle=open=>h.dom.dispatch('toggle',{id:'mail-accepted-details',open,isConnected:true});
 toggle(false);h.api.render();assert.equal(acceptedDetails(h).open,false);assert.equal(expandedCardRoll(h),expected);
 const outside=text(outsideInnerDetails(html(h)));assert.match(outside,/Mail accepted/);assert.match(outside,/Origin → Destination/);assert.doesNotMatch(outside,/From Settings:|Containers rolled|Payment on delivery|Hold capacity/);
 // Native toggle events from detached/replaced elements must not overwrite the
 // live session preference after a render.
 h.dom.dispatch('toggle',{id:'mail-accepted-details',open:true,isConnected:false});h.api.render();assert.equal(acceptedDetails(h).open,false);
 h.api.actions.tab('History');h.api.actions.tab('Contracts');assert.equal(acceptedDetails(h).open,false);assert.equal(expandedCardRoll(h),expected);
 h.api.actions['mail-audit']();assert.equal(h.dom.ids.get('modal-title').textContent,'Mail roll audit');assert.equal(h.dom.ids.get('modal-submit').hidden,true);h.api.closeModal();
 toggle(true);h.api.render();assert.equal(acceptedDetails(h).open,true);h.api.actions.tab('History');h.api.actions.tab('Contracts');assert.equal(acceptedDetails(h).open,true);
 same(h.persisted(),saved);same(h.api.state,live);assert.equal(h.calls.saves,saves);assert.equal(JSON.stringify(h.api.check),check);
 toggle(false);h.api.state.actual=destination.id;h.api.deliver(h.api.state.contracts[0].id);await h.submit();
 const delivered=acceptedDetails(h);assert.equal(delivered.open,false,'Delivery renders keep the session disclosure preference');assert.equal(delivered.summary,'Delivered mail details · Cr 75,000 paid');assert.match(delivered.body,/Released after delivery/);assert.equal(expandedCardRoll(h),expected);assert.match(text(outsideInnerDetails(html(h))),/Mail delivered/);
 const deliveredSaved=h.persisted(),deliveredSaves=h.calls.saves;toggle(true);h.api.render();assert.equal(acceptedDetails(h).open,true);toggle(false);h.api.render();same(h.persisted(),deliveredSaved);assert.equal(h.calls.saves,deliveredSaves);
 h.api.state.actual=origin.id;await h.check();assert.doesNotMatch(html(h),/id="mail-accepted-details"/);h.api.accept(h.api.drafts[0].offerId);await h.submit();assert.equal(acceptedDetails(h).open,true,'A new check resets details to open for its accepted result');
 const reload=harness(h.persisted());assert.equal(reload.api.check.historical,true);assert.match(html(reload),/id="mail-accepted-details"/);assert.equal(reload.api.drafts.length,0);assert.equal('mailAcceptedDetailsOpen'in reload.api.state,false,'Disclosure state is session-only');
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
 const h=harness();await h.check();const reload=harness(h.persisted());assert.equal(reload.api.check.historical,true);assert.equal(reload.api.drafts.length,0);assert.match(html(reload),/Previous mail result/);assert.doesNotMatch(reload.dom.ids.get('main').innerHTML,/data-action="contract-accept"/);assert.match(reload.api.historyDetails(reload.api.state.events.find(e=>e.mailOnly)),/Mail available/);
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
  assert.ok(h.api.drafts.length);h.api.actions.undo();assert.equal(h.api.drafts.length,0,kind);if(kind==='search')assert.equal(h.api.check,null,kind);else assert.equal(h.api.check.historical,true,kind);assert.equal(h.api.state.contracts.length,0);assert.equal(h.api.state.bank,'100000');assert.doesNotMatch(h.dom.ids.get('main').innerHTML,/data-action="contract-accept"/);
 }
});


test('expanded card shows rolls outside nested details for automatic, manual and unavailable checks',async()=>{
 const h=harness();await h.check({mailAvailability:'',mailContainers:''});
 assert.equal(expandedCardRoll(h),'Availability roll: 2D 3 + 3 = 6; 6 + 7 DM = 13 (12+ required) Container roll: 1D 3 = 3');
 assert.match(text(outsideInnerDetails(html(h))),/Mail available/);
 await h.check();
 assert.equal(expandedCardRoll(h),'Availability roll: manual 2D total 12; 12 + 7 DM = 19 (12+ required) Container roll: manual 1D total 3');
 await h.check({dice:2,mailAvailability:2,mailContainers:6});
 assert.equal(expandedCardRoll(h),'Availability roll: manual 2D total 2; 2 + 7 DM = 9 (12+ required)');
 assert.match(text(outsideInnerDetails(html(h))),/No mail available/);assert.doesNotMatch(expandedCardRoll(h),/Container roll|1D/);
});

test('negative total DM uses subtraction and retains the exact recorded outcome',async()=>{
 const saved=campaign();saved.ship.armed=false;saved.trader.rank=0;saved.trader.soc=-1;saved.worlds[origin.id].uwp='C000500-5';saved.worlds[destination.id].uwp='C000500-8';
 const h=harness(saved);await h.check({mailAvailability:12});
 assert.equal(h.api.check.audit.modifierTotal,-5);assert.equal(h.api.check.audit.total,7);
 assert.equal(expandedCardRoll(h),'Availability roll: manual 2D total 12; 12 - 5 DM = 7 (12+ required)');
 assert.doesNotMatch(expandedCardRoll(h),/\+\s*-/);
});

test('legacy roll summary uses only recorded values and requires all five modifiers for its fallback',()=>{
 const h=harness(),base={dice:{dice:[3,3],total:6},modifiers:{freight:2,armed:2,lowTech:0,rank:2,soc:1},total:13,count:{dice:[3],total:3}};
 const render=a=>summaryText(h.api.mailRollSummary(a));
 assert.match(render(base),/6 \+ 7 DM = 13/);
 assert.match(render({...base,modifierTotal:0,total:6}),/6 \+ 0 DM = 6/,'An explicitly recorded zero overrides the modifier sum');
 assert.match(render({...base,modifierTotal:-3,total:3}),/6 - 3 DM = 3/,'Recorded modifierTotal takes precedence');
 assert.match(render({...base,modifierTotal:'7'}),/6 \+ 7 DM = 13/,'Non-numeric total falls back to complete recorded modifiers');
 for(const key of ['freight','armed','lowTech','rank','soc']){
  const a=structuredClone(base);delete a.modifiers[key];const shown=render(a);
  assert.match(shown,/total DM not recorded; final result 13/i,key);assert.doesNotMatch(shown,/DM = 13/);
 }
 for(const invalid of [null,'0',NaN,Infinity]){
  const a=structuredClone(base);a.modifiers.soc=invalid;
  assert.match(render(a),/total DM not recorded/i,'Never coerce a missing or malformed modifier into zero');
 }
 assert.match(render({...base,dice:{total:6}}),/2D total 6 \(individual dice not recorded\)/);
 assert.doesNotMatch(render({...base,dice:{total:6}}),/3 \+ 3/,'A saved total must not invent individual dice');
 assert.match(render({...base,dice:{dice:[3],total:6}}),/individual dice not recorded/,'Partial dice are not a complete 2D roll');
 assert.match(render({...base,dice:undefined}),/Availability roll: Not recorded; total DM \+7; final result 13/i);
 assert.match(render({...base,total:undefined}),/final result not recorded/i,'Never reconstruct a missing final result');
 assert.doesNotMatch(render({...base,total:undefined}),/DM = 13/);
 assert.equal(render(undefined),'Availability roll: Not recorded; total DM not recorded; final result not recorded (12+ required)');
 assert.equal(render({manual:true}),'Availability roll: Not recorded (referee-entered terms).');
});

test('card Audit is read-only and preserves every recorded input and modifier after settings or world changes',async()=>{
 const h=harness();await h.check({skill:2,characteristic:-1});
 const recorded=structuredClone(h.api.check.audit),saved=h.persisted(),saves=h.calls.saves,visible=expandedCardRoll(h);
 same(recorded.searchDice,{dice:null,total:8,manual:true});assert.equal(recorded.searchSkill,2);assert.equal(recorded.searchCharacteristic,-1);
 same(recorded.worldInputs,{origin:{name:'Origin',population:8,starport:'A',techLevel:12,zone:'Safe'},destination:{name:'Destination',population:8,starport:'A',techLevel:12,zone:'Safe'}});
 h.api.actions['mail-audit']();assert.equal(h.dom.ids.get('modal-title').textContent,'Mail roll audit');assert.equal(h.dom.ids.get('modal-submit').hidden,true);
 const original=h.dom.ids.get('modal-body').innerHTML,facts=auditValues(original);
 for(const label of ['Search 2D','Search skill DM','Search characteristic DM','Search target','Origin world DM','Destination world DM','Distance DM','Search Effect','Combined freight traffic DM','Population DM','Starport DM','Technology DM','Travel-zone DM','Direct distance','Freight-band DM','Armed ship DM','Low technology DM','Naval / Scout rank DM','Social Standing DM','Final availability result','Required result'])assert.ok(label in facts,label);
 for(const heading of ['Origin at this check','Destination at this check','Origin world modifiers','Destination world modifiers'])assert.ok(original.includes(heading),heading);
 assert.equal(facts['Search skill DM'],'+2');assert.equal(facts['Search characteristic DM'],'-1');assert.equal(facts['Distance DM'],'+0');assert.equal(facts['Low technology DM'],'+0');assert.equal(facts['Travel-zone DM'],'+0');assert.equal(facts['Search Effect'],'+1');
 assert.equal((original.match(/<dt>Population DM<\/dt>/g)||[]).length,2);assert.equal((original.match(/<dt>Travel-zone DM<\/dt>/g)||[]).length,2);
 h.api.closeModal();h.api.state.ship.armed=false;h.api.state.trader.rank=0;h.api.state.trader.soc=-2;h.api.state.trader.characteristic=5;
 h.api.state.worlds[origin.id].uwp='X000000-0';h.api.state.worlds[origin.id].name='Edited origin';h.api.state.worlds[destination.id].zone='Red';h.api.render();
 assert.equal(expandedCardRoll(h),visible);h.api.actions['mail-audit']();assert.equal(h.dom.ids.get('modal-body').innerHTML,original);same(h.api.check.audit,recorded);
 await h.submit();assert.equal(h.calls.saves,saves);same(h.persisted(),saved);h.api.closeModal();
 h.store.editable=false;h.api.render();h.api.actions['mail-audit']();assert.equal(h.dom.ids.get('modal-body').innerHTML,original);assert.equal(h.dom.ids.get('modal-submit').hidden,true);
});

test('Audit includes explicit zeroes for every mail DM and both neutral endpoints',async()=>{
 const saved=campaign();saved.ship.armed=false;saved.trader.rank=0;saved.trader.soc=0;for(const w of Object.values(saved.worlds))w.uwp='C000500-8';
 const h=harness(saved);await h.check();assert.match(expandedCardRoll(h),/12 \+ 0 DM = 12 \(12\+ required\)/);
 h.api.actions['mail-audit']();const body=h.dom.ids.get('modal-body').innerHTML,facts=auditValues(body);
 for(const label of ['Search skill DM','Search characteristic DM','Origin world DM','Destination world DM','Distance DM','Search Effect','Combined freight traffic DM','Freight-band DM','Armed ship DM','Low technology DM','Naval / Scout rank DM','Social Standing DM'])assert.equal(facts[label],'+0',label);
 for(const label of ['Population DM','Starport DM','Technology DM','Travel-zone DM'])assert.equal((body.match(new RegExp('<dt>'+label+'</dt><dd>\\+0</dd>','g'))||[]).length,2,label);
});

test('accepted and delivered cards and saved contract rows retain the visible roll after reload',async()=>{
 const h=harness();await h.check();const expected=expandedCardRoll(h);h.api.accept(h.api.drafts[0].offerId);await h.submit();const id=h.api.state.contracts[0].id;
 assert.match(text(outsideInnerDetails(html(h))),/Mail accepted/);assert.equal(expandedCardRoll(h),expected);
 for(const status of ['accepted','delivered']){
  if(status==='delivered'){h.api.state.actual=destination.id;h.api.deliver(id);await h.submit();assert.match(text(outsideInnerDetails(html(h))),/Mail delivered/);assert.equal(expandedCardRoll(h),expected);}
  const reload=harness(h.persisted());assert.equal(reload.api.check.historical,true);assert.match(html(reload),new RegExp('Mail '+status));assert.equal(expandedCardRoll(reload),expected);
  const row=contractRow(reload,id);assert.equal(summaryText(outsideInnerDetails(row)),expected);assert.equal(reload.api.state.contracts[0].status,status);
  assert.ok(row.indexOf('mail-roll-summary')<row.indexOf('</td>'),'Roll is in the description cell, not an audit popup');
  const facts=auditValues(reload.api.contractDetails(reload.api.state.contracts[0]));assert.equal(facts['Search 2D'],'Manual roll total: 8');assert.equal(facts['Search skill DM'],'+0');
 }
});

test('historical contracts missing rolls or input snapshots show explicit gaps without current-value reconstruction',()=>{
 for(const audit of [undefined,{dice:{total:12},total:12,count:{total:2}},{dice:{total:12},total:12,modifiers:{freight:0,armed:0,lowTech:0,rank:0,soc:0},count:{total:2}}]){
  const saved=campaign();saved.contracts=[{id:'legacy-mail',kind:'mail',status:'accepted',origin:origin.id,destination:destination.id,quantity:'10',payment:'50000',dueHours:null,...(audit?{audit}:{})}];
  const h=harness(saved),shown=summaryText(contractRow(h,'legacy-mail')),facts=auditValues(h.api.contractDetails(h.api.state.contracts[0]));
  assert.match(shown,/Availability roll:/);assert.doesNotMatch(shown,/3 \+ 3|6 \+ 6|manual/i);
  if(!audit)assert.match(shown,/Not recorded; total DM not recorded; final result not recorded/i);
  else assert.match(shown,/individual dice not recorded/);
  if(audit&&!audit.modifiers)assert.match(shown,/total DM not recorded/i);
  for(const label of ['Search 2D','Search skill DM','Search characteristic DM'])assert.match(facts[label],/Not recorded/i,label);
  assert.match(h.api.contractDetails(h.api.state.contracts[0]),/World inputs not recorded/);
 }
});


test('Audit displays distinct origin and destination source values and component DMs',async()=>{
 const saved=campaign();saved.worlds[origin.id].uwp='A788800-9';saved.worlds[origin.id].zone='Amber';saved.worlds[destination.id].uwp='E000100-6';saved.worlds[destination.id].zone='Red';
 const h=harness(saved);await h.check({dice:8,skill:2,characteristic:1});h.api.actions['mail-audit']();
 const body=h.dom.ids.get('modal-body').innerHTML,section=heading=>{
  const start=body.indexOf('<h4>'+heading+'</h4>');assert.ok(start>=0,heading);
  const next=body.slice(start).replace(/^<h4>[^<]*<\/h4>/,'').split(/<h[34]>/)[0];return auditValues(next);
 };
 same(section('Origin at this check'),{World:'Origin',Population:'8',Starport:'A','Tech Level':'9','Travel zone':'Amber'});
 same(section('Destination at this check'),{World:'Destination',Population:'1',Starport:'E','Tech Level':'6','Travel zone':'Red'});
 same(section('Origin world modifiers'),{'Population DM':'+4','Starport DM':'+2','Technology DM':'+2','Travel-zone DM':'-2'});
 same(section('Destination world modifiers'),{'Population DM':'-4','Starport DM':'-1','Technology DM':'-1','Travel-zone DM':'-6'});
 const facts=auditValues(body);assert.equal(facts['Origin world DM'],'+6');assert.equal(facts['Destination world DM'],'-12');assert.equal(facts['Search Effect'],'+3');assert.equal(facts['Combined freight traffic DM'],'-3');
});

async function acceptMail(h,values={}){await h.check(values);const offerId=h.api.drafts.find(c=>c.kind==='mail').offerId;h.api.accept(offerId);await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'');return h.api.state.contracts.find(c=>c.offerId===offerId).id;}
const cancelButton=(h,id)=>{
 const match=contractRow(h,id).match(/<button\b([^>]*data-action="mail-cancel"[^>]*)>/);
 assert.ok(match,'The accepted Mail contract has its own cancel action');return attrs(match[1]);
};

test('Mail cancellation confirmation names the whole consignment and dismissing does not change anything',async()=>{
 const h=harness(),id=await acceptMail(h),before=h.persisted(),roll=expandedCardRoll(h),saves=h.calls.saves;
 assert.equal(cancelButton(h,id)['data-arg'],id);assert.equal('disabled'in cancelButton(h,id),false);
 assert.match(acceptedDetails(h).body,/data-action="mail-cancel"/);
 h.api.actions['mail-cancel'](id);const cancelled=h.dom.ids.get('modal-form').onsubmit;
 assert.equal(h.dom.ids.get('modal-title').textContent,'Cancel mail');assert.equal(h.dom.ids.get('modal-submit').textContent,'Cancel mail and start over');
 const body=text(h.dom.ids.get('modal-body').innerHTML);for(const label of ['whole accepted mail consignment','Origin','Destination','15 t','Income Cr 0','Penalty Cr 0','no income or penalty','Undo','Check for mail'])assert.ok(body.includes(label),label);
 h.api.closeModal();await cancelled({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});same(h.persisted(),before);same(h.api.state,before);assert.equal(h.calls.saves,saves);assert.equal(expandedCardRoll(h),roll);assert.match(html(h),/Mail accepted/);
});

test('cancel releases the full hold once, preserves rolls and audits, survives reload, and Undo restores acceptance',async()=>{
 const saved=campaign();saved.ship.capacity='15';const h=harness(saved),id=await acceptMail(h),before=h.persisted(),roll=expandedCardRoll(h);
 h.dom.dispatch('toggle',{id:'mail-accepted-details',open:false,isConnected:true});h.api.render();
 h.api.actions['mail-cancel'](id);await Promise.all([h.submit(),h.submit()]);await h.submit();
 assert.equal(h.calls.saves,3,'Check, acceptance and exactly one cancellation save');assert.equal(h.api.state.contracts.length,1);const c=h.api.state.contracts[0];
 assert.equal(c.status,'cancelled');assert.equal(c.cancelledHours,before.hours);assert.equal(c.cancellation.world,before.actual);assert.equal(c.cancellation.source,'recorded');assert.equal(A.decimal(S.used(h.api.state)),'0');
 assert.equal(h.api.state.bank,before.bank);assert.equal(h.api.state.hours,before.hours);assert.equal(h.api.state.actual,before.actual);same(h.api.state.ledger,before.ledger);same(h.api.state.lots,before.lots);same(h.api.state.ship,before.ship);same(c.audit,before.contracts[0].audit);
 assert.match(text(outsideInnerDetails(html(h))),/Mail cancelled/);assert.equal(expandedCardRoll(h),roll);assert.equal(acceptedDetails(h).open,false);assert.equal(acceptedDetails(h).summary,'Cancelled mail details · 15 t released');assert.match(acceptedDetails(h).body,/Released after cancellation/);assert.doesNotMatch(html(h),/15 t reserved|data-action="mail-cancel"|data-action="contract-accept"/);
 assert.doesNotMatch(h.api.contractsPanel(),new RegExp(id));assert.match(h.api.cancelledMailHistory(),new RegExp(id));assert.match(h.api.cancelledMailHistory(),/Audit\/View/);
 const cancellation=h.api.state.events.find(e=>e.label==='Mail cancellation audit'),audit=h.api.historyDetails(cancellation),facts=auditValues(audit);assert.equal(h.api.historyCategory(cancellation),'Trade');assert.equal(h.api.historyCategory({label:'Cancelled mail'}),'Trade');assert.equal(h.api.historyCategory({label:'Mail acceptance audit'}),'Trade');same(cancellation.contract,c);
 for(const label of ['Mail lifecycle','Cancellation result','Cancelled before first jump; no payment or penalty','Manual roll total: 3'])assert.ok(audit.includes(label),label);
 assert.equal(facts['Reserved cargo'],'None');assert.equal(facts.Income,'Cr 0');assert.equal(facts.Penalty,'Cr 0');assert.equal(facts['Cargo space released'],'15 t');assert.equal(facts['Departure verification'],'Recorded lifecycle marker');assert.doesNotMatch(audit,/Additional inputs were not saved/);
 const reload=harness(h.persisted());assert.equal(reload.api.check.historical,true);assert.doesNotMatch(reload.api.contractsPanel(),new RegExp(id));assert.match(reload.api.cancelledMailHistory(),new RegExp(id));assert.equal(A.decimal(S.used(reload.api.state)),'0');assert.throws(()=>reload.api.actions['mail-cancel'](id),/already cancelled/);
 h.api.actions.undo();assert.equal(h.api.state.contracts[0].status,'accepted');assert.equal(A.decimal(S.used(h.api.state)),'15');assert.equal(acceptedDetails(h).open,false);assert.equal(expandedCardRoll(h),roll);assert.equal('disabled'in cancelButton(h,id),false);same(h.api.state.contracts,before.contracts);assert.equal(h.api.state.bank,before.bank);
 assert.equal(h.api.state.events.find(e=>e.id===cancellation.id).contract.status,'cancelled','Historical cancellation snapshot survives Undo unchanged');
});

test('a saved contract can be cancelled without a session card and a fresh Mail check yields a new actionable offer',async()=>{
 const h=harness(),id=await acceptMail(h),reload=harness(h.persisted());assert.equal(reload.api.check.historical,true);assert.equal('disabled'in cancelButton(reload,id),false);
 reload.api.actions['mail-cancel'](id);await reload.submit();assert.equal(reload.api.state.contracts[0].status,'cancelled');assert.equal(reload.api.check.historical,true);assert.equal(reload.calls.mail,0,'Cancellation never rolls replacement mail');
 await reload.check({mailContainers:2});const newId=reload.api.drafts[0].offerId;assert.notEqual(newId,h.api.state.contracts[0].offerId);assert.match(html(reload),/Mail available/);assert.match(html(reload),/10 t/);assert.equal(reload.button('contract-accept').disabled,false);
 reload.api.accept(newId);await reload.submit();assert.equal(reload.api.state.contracts.length,2);assert.equal(reload.api.state.contracts[0].status,'cancelled');assert.equal(reload.api.state.contracts[1].status,'accepted');assert.equal(A.decimal(S.used(reload.api.state)),'10');assert.equal(reload.api.state.bank,'100000');
});

test('cancellation affects only its selected consignment and preserves freight and session drafts',async()=>{
 const h=harness(),first=await acceptMail(h,{mailContainers:1}),second=await acceptMail(h,{mailContainers:2});
 const saved=S.transition(h.api.state,'Manual contract accepted',s=>S.acceptContract(s,{offerId:'freight-consignment',kind:'freight',quantity:'3',payment:'1000',origin:origin.id,destination:destination.id,dueHours:336}));h.store.save(saved,h.api.state.revision);
 const drafts=[{offerId:'unaccepted-freight',kind:'freight',quantity:'1',payment:'50',origin:origin.id,destination:destination.id,dueHours:100}];h.api.setDrafts(drafts);const before=h.persisted(),check=JSON.stringify(h.api.check);
 h.api.actions['mail-cancel'](first);await h.submit();assert.equal(h.api.state.contracts.find(c=>c.id===first).status,'cancelled');same(h.api.state.contracts.filter(c=>c.id!==first),before.contracts.filter(c=>c.id!==first));assert.equal(h.api.state.contracts.find(c=>c.id===second).status,'accepted');same(h.api.drafts,drafts);assert.equal(JSON.stringify(h.api.check),check);assert.equal(A.decimal(S.used(h.api.state)),'13');
});

test('replacement dialogs and repeated cancel clicks cannot commit an obsolete confirmation',async()=>{
 const h=harness(),id=await acceptMail(h),before=h.persisted();h.api.actions['mail-cancel'](id);const first=h.dom.ids.get('modal-form').onsubmit;
 h.api.actions['mail-cancel'](id);await first({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});same(h.persisted(),before);assert.equal(h.dom.ids.get('modal-title').textContent,'Cancel mail');
 const second=h.dom.ids.get('modal-form').onsubmit;h.api.actions['contract-audit'](id);await second({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});same(h.persisted(),before);assert.equal(h.dom.ids.get('modal-title').textContent,'Contract');assert.equal(h.dom.ids.get('modal-submit').hidden,true);
 h.api.closeModal();h.api.actions['mail-cancel'](id);await h.submit();assert.equal(h.api.state.contracts[0].status,'cancelled');assert.equal(h.calls.saves,3);
});

test('stale cancellation previews and lost editing locks cannot mutate the campaign',async()=>{
 for(const mode of ['revision','store','lock']){
  const h=harness(),id=await acceptMail(h),before=h.persisted();h.api.actions['mail-cancel'](id);
  if(mode==='revision')h.api.state.revision++;else if(mode==='store'){const other=S.transition(before,'Other tab change',s=>{s.name='Newer save';});h.store.save(other,before.revision);h.api.setState(structuredClone(before));}else{h.store.editable=false;h.api.syncModalSubmit();assert.equal(h.dom.ids.get('modal-submit').disabled,true);}
  const persisted=h.persisted();await h.submit();same(h.persisted(),persisted);assert.equal(h.api.state.contracts[0].status,'accepted');assert.equal(A.decimal(S.used(h.api.state)),'15');
  if(mode!=='lock')assert.match(h.dom.ids.get('modal-error').textContent,/changed|stale/);else{h.api.closeModal();h.api.render();assert.equal(h.button('mail-cancel').disabled,true);h.api.actions['contract-audit'](id);assert.equal(h.dom.ids.get('modal-submit').hidden,true);}
 }
});

test('jump cancellation saves dice only; committing even a zero-hour jump permanently disables Mail cancellation until Undo',async()=>{
 const h=harness(),id=await acceptMail(h),before=h.persisted();h.api.actions.jump();const prepared=h.persisted();h.api.closeModal();same(h.persisted(),prepared);for(const key of ['actual','ship','hours','contracts','ledger','bank','route'])same(prepared[key],before[key]);assert.equal(prepared.jumpAttempts.length,1);assert.equal('disabled'in cancelButton(h,id),false);
 h.api.actions.jump();h.fill({hours:0});await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'');assert.equal(h.api.state.actual,destination.id);assert.equal(h.api.state.hours,0);const c=h.api.state.contracts[0],jump=h.api.state.events.find(e=>e.label==='Jump audit');
 same(c.firstDeparture,{eventId:jump.id,from:origin.id,to:destination.id,hours:0,revision:h.api.state.revision});assert.equal('disabled'in cancelButton(h,id),true);assert.ok('data-unavailable'in cancelButton(h,id));assert.match(contractRow(h,id),/already departed/);assert.throws(()=>h.api.actions['mail-cancel'](id),/already departed/);
 const audit=auditValues(h.api.contractDetails(c));assert.match(audit['First departure'],/Origin → Destination/);assert.equal(audit['Departure event'],jump.id);assert.equal(audit['Departure revision'],String(h.api.state.revision));
 h.api.state.actual=origin.id;h.api.render();assert.equal('disabled'in cancelButton(h,id),true,'Returning to the origin does not reset departure');h.api.actions.undo();assert.equal(h.api.state.actual,origin.id);assert.equal(h.api.state.contracts[0].firstDeparture,null);assert.equal('disabled'in cancelButton(h,id),false);assert.equal(A.decimal(S.used(h.api.state)),'15');
});

test('delivered and unverified legacy Mail are not cancellable and their audits remain readable',async()=>{
 const h=harness(),id=await acceptMail(h);h.api.state.actual=destination.id;h.api.deliver(id);await h.submit();assert.doesNotMatch(contractRow(h,id),/data-action="mail-cancel"/);assert.throws(()=>h.api.actions['mail-cancel'](id),/Delivered mail/);
 const saved=campaign();saved.contracts=[{id:'legacy-mail',kind:'mail',status:'accepted',origin:origin.id,destination:destination.id,quantity:'10',payment:'50000',dueHours:null}];const legacy=harness(saved);
 assert.equal('disabled'in cancelButton(legacy,'legacy-mail'),true);assert.match(contractRow(legacy,'legacy-mail'),/Travel history unverified/);assert.throws(()=>legacy.api.actions['mail-cancel']('legacy-mail'),/unverified/);assert.match(legacy.api.contractDetails(legacy.api.state.contracts[0]),/Not verified in this older contract/);
 const before=legacy.persisted();legacy.api.actions['contract-audit']('legacy-mail');await legacy.submit();same(legacy.persisted(),before);assert.equal(legacy.calls.saves,0);
});

test('legacy Mail with complete Undo proof can cancel, and its first jump is recorded before the campaign moves',async()=>{
 const source=harness(),id=await acceptMail(source),saved=source.persisted();delete saved.contracts[0].firstDeparture;
 const h=harness(saved);assert.equal('disabled'in cancelButton(h,id),false);const facts=auditValues(h.api.contractDetails(h.api.state.contracts[0]));assert.equal(facts['First departure'],'No committed jump after acceptance');assert.equal(facts['Departure verification'],'Verified from retained Undo history');
 h.api.actions['mail-cancel'](id);await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'');assert.equal(h.api.state.contracts[0].cancellation.source,'legacy-undo');assert.match(h.api.historyDetails(h.api.state.events.find(e=>e.label==='Mail cancellation audit')),/Verified from retained Undo history/);
 const travelled=harness(saved);travelled.api.actions.jump();travelled.fill({hours:0});await travelled.submit();assert.equal(travelled.dom.ids.get('modal-error').textContent,'');const departure=travelled.api.state.contracts[0].firstDeparture;assert.equal(departure.from,origin.id);assert.equal(departure.to,destination.id);assert.equal(departure.priorHistoryUnverified,undefined,'Legacy proof is reconstructed while pre-jump state is intact');assert.equal('disabled'in cancelButton(travelled,id),true);
});


test('whole Mail panel starts collapsed, keeps a noninteractive summary, and retains session disclosure state without saving',async()=>{
 const h=harness(),initial=h.persisted();assert.equal(outerDetails(h).open,false);assert.equal(outerDetails(h).summary,'Mail Not checked this session');
 const saves=h.calls.saves;toggleOuter(h,true);h.api.render();assert.equal(outerDetails(h).open,true);
 h.api.actions.tab('History');h.api.actions.tab('Contracts');assert.equal(outerDetails(h).open,true);
 h.dom.dispatch('toggle',{id:'mail-card',open:false,isConnected:false});h.api.render();assert.equal(outerDetails(h).open,true,'Detached toggles do not override the live preference');
 toggleOuter(h,false);h.api.render();assert.equal(outerDetails(h).open,false);same(h.persisted(),initial);same(h.api.state,initial);assert.equal(h.calls.saves,saves);
 await h.check();assert.equal(outerDetails(h).open,false,'Checking while collapsed keeps the compact panel');
 assert.equal(outerDetails(h).summary,'Mail Mail available · 15 t · Cr 75,000 on delivery');assert.match(h.dom.ids.get('message').textContent,/Mail available/);
 const saved=h.persisted(),check=JSON.stringify(h.api.check),drafts=JSON.stringify(h.api.drafts),afterCheckSaves=h.calls.saves;
 toggleOuter(h,true);h.api.render();const roll=expandedCardRoll(h);toggleOuter(h,false);h.api.render();toggleOuter(h,true);h.api.render();assert.equal(expandedCardRoll(h),roll);
 same(h.persisted(),saved);assert.equal(h.calls.saves,afterCheckSaves);assert.equal(JSON.stringify(h.api.check),check);assert.equal(JSON.stringify(h.api.drafts),drafts);
 await h.check({mailContainers:1});assert.equal(outerDetails(h).open,true,'New checks preserve an explicitly expanded panel');assert.equal(outerDetails(h).summary,'Mail Mail available · 5 t · Cr 25,000 on delivery');
 const reload=harness(h.persisted());assert.equal(outerDetails(reload).open,false);assert.equal(outerDetails(reload).summary,'Mail Previous mail result · Offer no longer active');assert.equal('mailPanelOpen'in reload.api.state,false);assert.equal(reload.api.drafts.length,0);
});

test('collapsed summary reflects unavailability, current overrides, capacity guards and lifecycle without inventing a payment',async()=>{
 const h=harness();await h.check({dice:2,mailAvailability:2});assert.equal(outerDetails(h).summary,'Mail No mail available');assert.equal(outerDetails(h).open,false);assert.match(h.dom.ids.get('message').textContent,/No mail available/);
 await h.check();h.api.state.ship.capacity='14';h.api.render();assert.match(outerDetails(h).summary,/15 t · Cr 75,000 on delivery · Does not fit$/);
 h.api.state.ship.capacity='60';h.api.state.actual=destination.id;h.api.render();assert.match(outerDetails(h).summary,/Return to origin to accept$/);h.api.state.actual=origin.id;
 h.api.editDraft(h.api.drafts[0].offerId);h.fill({description:'Compact override',quantity:10,payment:60000,due:'',reason:'Referee amendment'});await h.submit();assert.equal(outerDetails(h).summary,'Mail Mail available · 10 t · Cr 60,000 on delivery');
 const recorded=JSON.stringify(h.api.check.audit);h.api.accept(h.api.drafts[0].offerId);await h.submit();assert.equal(outerDetails(h).summary,'Mail Mail accepted · 10 t reserved · Cr 60,000 on delivery');assert.equal(outerDetails(h).open,false);
 const id=h.api.state.contracts[0].id;h.api.actions['mail-cancel'](id);await h.submit();assert.equal(outerDetails(h).summary,'Mail Mail cancelled · 10 t released · No payment');assert.equal(JSON.stringify(h.api.check.audit),recorded);
 h.api.actions.undo();assert.match(outerDetails(h).summary,/Mail accepted · 10 t reserved/);h.api.state.actual=destination.id;h.api.deliver(id);await h.submit();assert.equal(outerDetails(h).summary,'Mail Mail delivered · 10 t delivered · Cr 60,000 paid');assert.equal(JSON.stringify(h.api.check.audit),recorded);
 const old=harness();await old.check();old.api.setDrafts([]);old.api.render();assert.equal(outerDetails(old).summary,'Mail Previous mail result · Offer no longer active');assert.doesNotMatch(outerDetails(old).summary,/Cr |reserved/);
});

test('outer and accepted disclosures are independent in read-only mode and keep audit access',async()=>{
 const h=harness();await acceptMail(h);toggleOuter(h,true);h.dom.dispatch('toggle',{id:'mail-accepted-details',open:false,isConnected:true});h.api.render();
 assert.equal(outerDetails(h).open,true);assert.equal(acceptedDetails(h).open,false);const roll=expandedCardRoll(h),saved=h.persisted(),saves=h.calls.saves;
 h.store.editable=false;toggleOuter(h,false);h.api.render();assert.equal(outerDetails(h).open,false);toggleOuter(h,true);h.api.render();assert.equal(outerDetails(h).open,true);assert.equal(acceptedDetails(h).open,false);assert.equal(expandedCardRoll(h),roll);
 h.api.actions['mail-audit']();assert.equal(h.dom.ids.get('modal-submit').hidden,true);h.api.closeModal();h.dom.dispatch('toggle',{id:'mail-accepted-details',open:true,isConnected:true});h.api.render();assert.equal(outerDetails(h).open,true);assert.equal(acceptedDetails(h).open,true);assert.equal(h.button('mail-cancel').disabled,true);
 same(h.persisted(),saved);assert.equal(h.calls.saves,saves);assert.equal(h.api.state.bank,saved.bank);
});

test('cancelled Mail rows move to History while accepted freight and delivered Mail remain in the main table',async()=>{
 let saved=campaign();saved=S.transition(saved,'Accepted freight',s=>S.acceptContract(s,{offerId:'freight-archive-fixture',kind:'freight',origin:origin.id,destination:destination.id,quantity:'5',payment:'1000',dueHours:null}));
 const h=harness(saved),deliveredId=await acceptMail(h);await h.check({mailContainers:1});h.api.accept(h.api.drafts[0].offerId);await h.submit();const cancelledId=h.api.state.contracts.at(-1).id;
 h.api.actions['mail-cancel'](cancelledId);await h.submit();h.api.state.actual=destination.id;h.api.deliver(deliveredId);await h.submit();const before=h.persisted();
 assert.match(contractRow(h,deliveredId),/Delivered · paid/);assert.match(contractRow(h,saved.contracts[0].id),/Freight contract/);assert.doesNotMatch(h.api.contractsPanel(),new RegExp(cancelledId));
 h.api.actions.tab('History');const archive=h.api.cancelledMailHistory();assert.match(archive,/Cancelled mail archive/);assert.match(archive,new RegExp(cancelledId));assert.doesNotMatch(archive,new RegExp(deliveredId));assert.doesNotMatch(archive,/data-mutate|data-action="deliver"|data-action="mail-cancel"/);
 h.api.actions['contract-audit'](cancelledId);assert.equal(h.dom.ids.get('modal-submit').hidden,true);assert.match(h.dom.ids.get('modal-body').innerHTML,/Cancellation result|Manual roll total: 1/);h.api.closeModal();same(h.persisted(),before);same(h.api.state,before);
});

test('cancelled contract Audit/View remains available in History for read-only imports without event history',async()=>{
 const h=harness(),id=await acceptMail(h);h.api.actions['mail-cancel'](id);await h.submit();const saved=h.persisted();saved.events=[];saved.undo=[];saved.latestMailCheckId=null;S.validate(saved);
 const restored=harness(saved);restored.store.editable=false;restored.api.actions.tab('History');assert.match(restored.dom.ids.get('main').innerHTML,new RegExp(id));assert.match(restored.api.cancelledMailHistory(),/Audit\/View/);assert.doesNotMatch(restored.api.contractsPanel(),new RegExp(id));
 restored.api.actions['contract-audit'](id);assert.equal(restored.dom.ids.get('modal-submit').hidden,true);assert.match(restored.dom.ids.get('modal-body').innerHTML,/Cancelled before first jump; no payment or penalty/);restored.api.closeModal();same(restored.persisted(),saved);
});

test('rechecking replaces one current result, marks the prior reference superseded, and Undo restores only read-only history',async()=>{
 const h=harness();await h.check();const first=h.api.state.events.find(e=>e.id===h.api.state.latestMailCheckId),frozenFirst=structuredClone(first),firstOffer=h.api.drafts[0].offerId;
 await h.check({dice:2,mailAvailability:2});const second=h.api.state.events.find(e=>e.id===h.api.state.latestMailCheckId),frozenSecond=structuredClone(second);
 assert.equal(second.supersedesMailCheckId,first.id);same(h.api.state.events.find(e=>e.id===first.id),frozenFirst);assert.equal(h.api.drafts.filter(c=>c.kind==='mail').length,0);assert.equal((h.api.contractsPanel().match(/id="mail-card"/g)||[]).length,1);assert.match(html(h),/No mail available/);assert.throws(()=>h.api.accept(firstOffer),/no longer available/);
 const audit=h.api.historyDetails(first);assert.match(audit,/Superseded mail check/);assert.equal(auditValues(audit)['Replaced by check'],second.id);assert.match(h.api.historyPanel(),/Superseded mail check/);assert.match(h.api.historyDetails(second),/Latest mail check/);
 h.api.actions.undo();assert.equal(h.api.state.latestMailCheckId,first.id);assert.equal(h.api.check.checkId,first.id);assert.equal(h.api.check.historical,true);assert.match(html(h),/Previous mail result/);assert.doesNotMatch(h.api.contractsPanel(),/data-action="contract-accept"/);assert.match(h.api.historyDetails(second),/Historical mail check/);
 await h.check({mailContainers:1});const third=h.api.state.events.find(e=>e.id===h.api.state.latestMailCheckId);assert.equal(third.supersedesMailCheckId,first.id);assert.equal(h.api.drafts.filter(c=>c.kind==='mail').length,1);assert.notEqual(h.api.drafts[0].offerId,firstOffer);same(h.api.state.events.find(e=>e.id===second.id),frozenSecond);same(h.api.state.events.find(e=>e.id===first.id),frozenFirst);
});

test('a newer tab result invalidates the older session draft while saved checks remain read-only',async()=>{
 const h=harness();await h.check();const offer=h.api.drafts[0].offerId;h.api.accept(offer);const oldSubmit=h.dom.ids.get('modal-form').onsubmit;
 const other=harness(h.persisted());await other.check({mailContainers:1});h.api.setState(other.persisted());h.api.render();assert.equal(h.api.drafts.filter(c=>c.kind==='mail').length,0);assert.equal(h.api.check.historical,true);assert.equal(h.api.check.checkId,other.api.state.latestMailCheckId);assert.throws(()=>h.api.accept(offer),/no longer available/);
 await oldSubmit({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});assert.match(h.dom.ids.get('modal-error').textContent,/Campaign changed/);assert.equal(h.api.state.contracts.length,0);
});

test('hidden-tab replacement and same-reference imports invalidate session offers before any later Undo can revive them',async()=>{
 const h=harness();await h.check();const original=h.persisted(),offer=h.api.drafts[0].offerId;
 h.api.actions.tab('History');const other=harness(original);await other.check({mailContainers:1});h.api.setState(other.persisted());assert.equal(h.api.drafts.length,0);assert.equal(h.api.check.historical,true);
 other.api.actions.undo();h.api.setState(other.persisted());h.api.actions.tab('Contracts');assert.equal(h.api.check.checkId,original.latestMailCheckId);assert.equal(h.api.drafts.length,0);assert.doesNotMatch(h.api.contractsPanel(),/data-action="contract-accept"/);assert.throws(()=>h.api.accept(offer),/no longer available/);
 const fresh=harness();await fresh.check();const sameIds=fresh.persisted(),sameOffer=fresh.api.drafts[0].offerId;sameIds.revision++;
 fresh.api.setState(sameIds);assert.equal(fresh.api.check.historical,true);assert.equal(fresh.api.drafts.length,0);assert.throws(()=>fresh.api.accept(sameOffer),/no longer available/);
});
