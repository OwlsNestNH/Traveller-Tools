import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {campaign, S, attrs, element} from './app-harness.mjs';
export {campaign, S};

// Faithful Accounts-only DOM adapter. It parses actual generated markup rather
// than reproducing any quote, normalization, application, controller or Store
// algorithm. Every named field retains its node identity and real membership.
export function accountsDOM() {
 const roots=[],listeners=new Map(),baseIds=new Map();
 let document;
 const walk=(node)=>node.children.flatMap(child=>[child,...walk(child)]);
 function match(node, selector) {
  selector=selector.trim();
  if(selector.includes(','))return selector.split(',').some(part=>match(node,part));
  const parts=selector.split(/\s+(?![^\[]*\])/);
  if(parts.length>1){if(!match(node,parts.pop()))return false;let ancestor=node.parentElement;while(ancestor){if(match(ancestor,parts.join(' ')))return true;ancestor=ancestor.parentElement;}return false;}
  if(selector==='*')return true;
  const tag=selector.match(/^[a-z][\w-]*/i)?.[0];if(tag&&node.tagName.toLowerCase()!==tag.toLowerCase())return false;
  const id=selector.match(/#([\w-]+)/)?.[1];if(id&&node.id!==id)return false;
  for(const [,cls]of selector.matchAll(/\.([\w-]+)/g))if(!node.classList.contains(cls))return false;
  for(const [,name,,value]of selector.matchAll(/\[([\w-]+)(?:([~|^$*]?=)"([^"]*)")?\]/g)){
   if(!node.hasAttribute(name))return false;if(value!==undefined&&node.getAttribute(name)!==value)return false;
  }
  if(selector.includes(':checked')&&!node.checked)return false;
  if(selector.includes(':disabled')&&!node.disabled)return false;
  return !!(tag||id||selector.startsWith('.')||selector.startsWith('['));
 }
 function node(tag='div',attributes={}) {
  const n=element(attributes);n.tagName=tag.toUpperCase();n.nodeName=n.tagName;n.id=attributes.id??'';n.children=[];n.parentElement=null;n.ownerDocument=document;n.type=attributes.type??(tag==='select'?'select-one':tag==='button'?'submit':'text');n.checked='checked'in attributes;n.hidden='hidden'in attributes;n.readOnly='readonly'in attributes;
  let html='',text='';
  n.classList={contains:name=>(n.attributes.class??'').split(/\s+/).includes(name),add(name){n.attributes.class=[...(n.attributes.class??'').split(/\s+/),name].filter(Boolean).join(' ');},remove(name){n.attributes.class=(n.attributes.class??'').split(/\s+/).filter(x=>x!==name).join(' ');}};
  Object.defineProperties(n,{
   isConnected:{get:()=>roots.some(root=>root===n||root.contains(n))},
   form:{get:()=>n.closest('form')},
   elements:{get:()=>{const list=n.querySelectorAll('input,select,textarea,button');for(const field of list)if(field.name)list[field.name]=field;list.namedItem=name=>list.find(field=>field.name===name)??null;return list;}},
   innerHTML:{configurable:true,get:()=>html,set(value){html=String(value);text=html.replace(/<[^>]*>/g,'');for(const child of n.children)child.parentElement=null;n.children=[];parse(n,html);}},
   textContent:{configurable:true,get:()=>text,set(value){text=String(value);html=text;for(const child of n.children)child.parentElement=null;n.children=[];}},
   className:{get:()=>n.attributes.class??'',set(value){n.attributes.class=String(value);}}
  });
  n.matches=selector=>match(n,selector);
  n.contains=other=>!!other&&(other===n||walk(n).includes(other));
  n.closest=selector=>{let p=n;while(p){if(match(p,selector))return p;p=p.parentElement;}return null;};
  n.querySelectorAll=selector=>walk(n).filter(child=>match(child,selector));
  n.querySelector=selector=>n.querySelectorAll(selector)[0]??null;
  n.setAttribute=(name,value)=>{n.attributes[name]=String(value);if(name.startsWith('data-'))n.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);if(name==='id')n.id=String(value);if(['disabled','checked','hidden','readonly'].includes(name))n[name==='readonly'?'readOnly':name]=true;};
  n.removeAttribute=name=>{delete n.attributes[name];if(['disabled','checked','hidden','readonly'].includes(name))n[name==='readonly'?'readOnly':name]=false;if(name.startsWith('data-'))delete n.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())];};
  n.append=(...children)=>{for(const child of children){child.remove();child.parentElement=n;n.children.push(child);}};
  n.remove=()=>{if(n.parentElement){const p=n.parentElement;p.children=p.children.filter(child=>child!==n);n.parentElement=null;}};
  n.replaceWith=other=>{const parent=n.parentElement;if(!parent)return;const index=parent.children.indexOf(n);other.remove();parent.children[index]=other;other.parentElement=parent;n.parentElement=null;};
  n.insertAdjacentHTML=(_position,value)=>{html+=String(value);parse(n,String(value));};
  n.focus=()=>{document.activeElement=n;};n.getClientRects=()=>n.isConnected&&!n.hidden?[{width:100,height:20}]:[];
  return n;
 }
 function parse(parent,html) {
  const stack=[parent],voids=new Set(['input','br','hr','img','meta','link']);
  for(const token of html.matchAll(/<!--[^]*?-->|<\/?([a-z][\w-]*)\b([^>]*?)>|([^<]+)/gi)){
   if(token[3])continue;
   if(!token[1])continue;
   const tag=token[1].toLowerCase();
   if(token[0].startsWith('</')){for(let i=stack.length-1;i>0;i--)if(stack[i].tagName.toLowerCase()===tag){stack.length=i;break;}continue;}
   const child=node(tag,attrs(token[2]));const p=stack.at(-1);child.parentElement=p;p.children.push(child);
   if(tag==='option'){const select=child.closest('select');if(select&&(select.children.length===1||'selected'in child.attributes))select.value=child.attributes.value??'';}
   if(!voids.has(tag)&&!token[2].endsWith('/'))stack.push(child);
  }
 }
 const ids={get(id){return baseIds.get(id)??roots.flatMap(root=>walk(root)).find(n=>n.id===id);},has(id){return !!this.get(id);},set(id,n){n.id=id;n.setAttribute?.('id',id);baseIds.set(id,n);return this;},delete(id){const n=this.get(id);n?.remove();return baseIds.delete(id);},values(){return [...baseIds.values()];}};
 document={activeElement:null,createElement:tag=>{const n=node(tag);n.getContext=()=>({measureText:t=>({width:String(t).length*6})});return n;},getElementById:id=>ids.get(id)||null,addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},querySelectorAll:selector=>roots.flatMap(root=>[root,...walk(root)]).filter(n=>match(n,selector)),querySelector(selector){return this.querySelectorAll(selector)[0]??null;}};
 const root=node('body');roots.push(root);document.body=root;
 for(const id of ['summary','ship-actions','tabs','main','modal','modal-title','modal-body','modal-error','modal-submit','modal-cancel','modal-form','modal-close','notes','takeover','import-file','save-status','message']){const tag=id==='modal'?'dialog':id==='modal-form'?'form':id.startsWith('modal-')&&['modal-submit','modal-cancel','modal-close'].includes(id)?'button':'div';const n=node(tag,{id});baseIds.set(id,n);root.append(n);}
 const dialog=ids.get('modal'),form=ids.get('modal-form');dialog.append(ids.get('modal-title'),ids.get('modal-close'),form);form.append(ids.get('modal-body'),ids.get('modal-error'),ids.get('modal-submit'),ids.get('modal-cancel'));ids.get('modal-submit').type='submit';for(const id of ['modal-cancel','modal-close'])ids.get(id).type='button';
 const disabledByFieldset=n=>{let p=n.parentElement;while(p){if(p.tagName==='FIELDSET'&&p.disabled){const legend=p.children.find(c=>c.tagName==='LEGEND');if(!legend?.contains(n))return true;}p=p.parentElement;}return false;};
 const fields=()=>new Map(form.querySelectorAll('input,select,textarea').filter(n=>n.name).map(n=>[n.name,n]));
 return {ids,document,fields,buttons:()=>document.querySelectorAll('button'),node,dispatch(type,target,details={}){for(const listener of listeners.get(type)||[])listener({type,target,preventDefault(){},stopImmediatePropagation(){},...details});},FormData:class{
  constructor(target=form){if(target!==form&&!target?.tagName?.match(/^FORM$/))throw TypeError('FormData requires a form');this.values=new Map(target.querySelectorAll('input,select,textarea').filter(n=>n.form===target&&n.name&&!n.disabled&&!disabledByFieldset(n)&&!(n.type==='checkbox'&&!n.checked)).map(n=>[n.name,n.type==='checkbox'?(n.attributes.value??'on'):n.value]));}
  get(name){return this.values.get(name)??null;}has(name){return this.values.has(name);}[Symbol.iterator](){return this.values[Symbol.iterator]();}
 }};
}
const absolutize=(source,url)=>source.replaceAll('import.meta.url',JSON.stringify(url.href)).replace(/from '(\.[^']+)'/g,(_all,path)=>'from '+JSON.stringify(new URL(path,url).href));
const uri=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const replace=(source,from,to)=>{assert.ok(source.includes(from),'Preserved harness boundary: '+from);return source.replace(from,to);};
const factories=new Map();
export async function loadAccountsHarness(root=new URL('../',import.meta.url)) {
 if(typeof root==='string')root=pathToFileURL(root.replace(/\/$/,'')+'/');
 if(factories.has(root.href))return factories.get(root.href);
 const appURL=new URL('js/app.mjs',root),harnessURL=new URL('verification/app-harness.mjs',root),storageURL=new URL('verification/deposit-save-harness.mjs',root),app=await readFile(appURL,'utf8');
 const marker='store=new Store(receiveCampaign,',offset=app.indexOf(marker);assert.ok(offset>=0);const role=app.slice(offset+marker.length).split(');try{state=store.read();}')[0];
 let hs=await readFile(harnessURL,'utf8');const begin=hs.indexOf('function domDouble(){'),end=hs.indexOf('\nfunction campaign()',begin);assert.ok(begin>=0&&end>begin);
 hs=hs.slice(0,begin)+'const domDouble='+accountsDOM.toString()+';'+hs.slice(end);
 hs=replace(hs,'globalThis.api={setStore',`globalThis.api={shipExpenses,rollBerthingRate,expenseForm,expenseInput,updateExpenseEstimate,updateFuelAvailability,selectAllExpenses,setFuelQuantity,expenseSummary,expenseBundleSummary,renderCoveredPayments,refreshNearby,paintMap,normaliseFields,get modalRevision(){return modalRevision;},get tab(){return tab;},get owner(){return typeof accountsWriteOperation==='undefined'?null:accountsWriteOperation;},get accountsEpoch(){return typeof accountsWriteEpoch==='undefined'?0:accountsWriteEpoch;},get coreRules(){return core;},setCoreRules(value){core=value;},setDecisions(value){decisions=value;},roleChange:${role},setStore`);
 hs=replace(hs,'priceDice:0','priceDice:0,rolls:0,dice:0,nearby:0,formData:0,transitions:0');
 hs=replace(hs,'roll:n=>({dice:Array(n).fill(3),total:n*3}),die:()=>3','roll:n=>{calls.rolls++;calls.onRoll?.();return bindings.R.roll(n,()=>3);},die:()=>{calls.dice++;calls.onDie?.();return 3;}');
 hs=replace(hs,'const sandbox={...bindings,R:rules,','const sandbox={...bindings,M:{...bindings.M,nearby(...args){calls.nearby++;return calls.onNearby?.(...args)??Promise.resolve([]);}},S:{...bindings.S,transition(...args){calls.transitions++;calls.beforeTransition?.(...args);const result=bindings.S.transition(...args);calls.afterTransition?.(result,...args);return result;}},R:rules,');
 hs=replace(hs,'requestAnimationFrame:()=>1','requestAnimationFrame:callback=>{calls.onFrame?.(callback);return 1;}');
 hs=replace(hs,'FormData:dom.FormData','FormData:class extends dom.FormData{constructor(...args){calls.formData++;calls.onFormData?.(...args);super(...args);}}');
 hs=absolutize(hs,harnessURL);const hm=uri(hs);
 let ss=absolutize(await readFile(storageURL,'utf8'),storageURL);ss=replace(ss,JSON.stringify(harnessURL.href),JSON.stringify(hm));
 const factory=(await import(uri(ss))).depositHarness;factories.set(root.href,factory);return factory;
}
const defaultFactory=await loadAccountsHarness();
const decisions=JSON.parse(await readFile(new URL('../rules/decisions.json',import.meta.url),'utf8'));
export function accountsFixture({rate=true,creditStep=1}={}) {
 const s=campaign();s.bank='900719925474099312345';s.hours=37;s.settings.creditStep=creditStep;s.ship.capacity='120';s.ship.fuel={displacementTons:200,baseCapacityTons:40,bladderTons:20,capacityTons:60,aboardTons:10};
 s.ship.accommodation={rooms:{low:0,middle:3,high:1},passengers:{low:0,middle:2,high:1},crew:{low:0,middle:2,high:0},occupiedLowBerths:0,luggageTons:'0'};
 s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'140',denominator:'1'}};s.ship.expenses={salary:'7000'};
 s.ship.mortgage={originalAmount:'296160',payment:'1234',remainingPayments:12,totalPaid:'0',nextDueDate:'001-1105'};s.ship.maintenance={payment:'2345',paidSinceTracking:'0',nextDueDate:'001-1105'};
 if(rate)s.worlds[s.actual].berthingRate={port:'A',die:3,weekly:'3000'};
 return S.validate(s);
}
export function accountsHarness(saved=accountsFixture(),factory=defaultFactory) {
 const h=factory(saved,{setTimeout:()=>0,clearTimeout(){}});h.api.setDecisions(decisions);h.store.onRole=(editable,text)=>{h.roles.push([editable,text]);h.hooks.onRole?.(editable,text);h.api.roleChange(editable,text);};h.api.setTab('Accounts');h.api.render();
 return {...h,fields:()=>h.dom.fields(),form:()=>h.dom.ids.get('modal-form'),body:()=>h.dom.ids.get('modal-body').innerHTML,button:name=>h.dom.document.querySelector('#modal-body [data-action="'+name+'"]'),open(kind='bundle'){return kind==='rate'||kind==='bundle'?h.api.shipExpenses():h.api.expenseForm(kind==='correction');},fillAccounts(values){h.fill(values);h.api.updateExpenseEstimate();},start(kind='bundle'){return kind==='rate'?h.api.safely(h.api.rollBerthingRate)():h.submit();},click(name,arg=''){const button=h.dom.document.querySelector('#modal-body [data-action="'+name+'"]')??h.dom.node('button',{'data-action':name,'data-arg':arg});h.dom.dispatch('click',button,{detail:0,button:0});return button;}};
}
