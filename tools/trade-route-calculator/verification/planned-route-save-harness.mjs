import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {S,same,ui,flush} from './deposit-save-harness.mjs';
import {element,attrs} from './app-harness.mjs';
import {serviceSaveGate} from './service-save-harness.mjs';
import {fixture as clearFixture,canonical,display,trap} from './clear-route-save-harness.mjs';
export {S,same,ui,flush,serviceSaveGate,canonical,display,trap};

// Real app/controller/Store and real world picker run from one selected source
// tree. DOM, localStorage, network transport and animation scheduling alone are
// doubled. Original observation recording uses every released helper import.
const harnessURL=new URL('./app-harness.mjs',import.meta.url),storageURL=new URL('./deposit-save-harness.mjs',import.meta.url);
const candidateRoot=new URL('../',import.meta.url);
const html=await readFile(new URL('index.html',candidateRoot),'utf8');
const formMarkup=html.match(/<form id="modal-form">([\s\S]*?)<\/form>/)?.[1];
assert.ok(formMarkup,'Production modal form boundary');
const chrome=[...formMarkup.matchAll(/<button\b([^>]*id="modal-(?:close|cancel|submit)"[^>]*)>/g)].map(m=>attrs(m[1]));
assert.deepEqual(chrome.map(a=>a.id),['modal-close','modal-cancel','modal-submit']);
const absolutize=(source,url)=>source.replaceAll('import.meta.url',JSON.stringify(url.href)).replace(/from '(\.[^']+)'/g,(_all,path)=>'from '+JSON.stringify(new URL(path,url).href));
function replace(source,from,to){assert.ok(source.includes(from),'Expected actual harness boundary '+from);return source.replace(from,to);}
export async function loadPlannedRouteHarness(root=candidateRoot){
 const sourceRoot=root instanceof URL?root:new URL('file://'+root.replace(/\/$/,'')+'/');
 const sourceApp=await readFile(new URL('js/app.mjs',sourceRoot),'utf8');
 const roleStart=sourceApp.indexOf('store=new Store(receiveCampaign,');assert.ok(roleStart>=0);
 const role=sourceApp.slice(roleStart+'store=new Store(receiveCampaign,'.length).split(');try{state=store.read();}')[0];assert.ok(role.startsWith('(editable,text)=>'));
 let source=await readFile(harnessURL,'utf8');
 source=replace(source,"const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');",'const app=PLANNED_ROUTE_APP;');
 source=absolutize(source,harnessURL).replaceAll(candidateRoot.href,sourceRoot.href);
 source=replace(source,'PLANNED_ROUTE_APP',JSON.stringify(sourceApp));
 source=replace(source,'clearTimeout:cancel=clearTimeout}={}','clearTimeout:cancel=clearTimeout,mapControl,frameControl,domEnhance,pickerControl}={}');
 source=replace(source,"get:()=>markup,set:html=>{","configurable:true,get:()=>markup,set:html=>{");
 source=replace(source,'const dom=domDouble(),calls=','const dom=domDouble();domEnhance(dom);pickerControl.init(dom);const calls=');
 source=replace(source,'...bindings,R:rules,document:dom.document','...bindings,M:{...bindings.M,...mapControl.methods},createWorldPicker:(...args)=>pickerControl.create(...args),rememberWorld:w=>pickerControl.remember(w),R:rules,document:dom.document');
 source=replace(source,'requestAnimationFrame:()=>1,cancelAnimationFrame(){}','requestAnimationFrame:fn=>frameControl.request(fn),cancelAnimationFrame:id=>frameControl.cancel(id)');
 source=replace(source,'globalThis.api={setStore','globalThis.api={get routeDraft(){return routeDraft;},get tab(){return tab;},get epoch(){return campaignPublicationEpoch;},get editingEpoch(){return editingLossEpoch;},get mapAreas(){return mapAreas;},get mapOverview(){return mapOverview;},saveMapRoute,plotRoute,clearPlannedRoute,startMapRoute,mapEmpty,mapWorld,calculateMapRoute,retryMapRoute,paintMap,requestMapAreas,scheduleMapPaint,refreshNearby,setDecisions(v){decisions=v;},roleChange:'+role+',setStore');
 const module='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
 let storage=absolutize(await readFile(storageURL,'utf8'),storageURL);storage=replace(storage,JSON.stringify(harnessURL.href),JSON.stringify(module));storage=storage.replaceAll(candidateRoot.href,sourceRoot.href);
 const factory=(await import('data:text/javascript;base64,'+Buffer.from(storage).toString('base64'))).depositHarness;
 const pickerSource=await readFile(new URL('js/world-picker.mjs',sourceRoot),'utf8'),map=await import(new URL('js/map.mjs',sourceRoot));
 const decisions=JSON.parse(await readFile(new URL('rules/decisions.json',sourceRoot),'utf8'));
 const sourceHtml=await readFile(new URL('index.html',sourceRoot),'utf8');assert.equal(sourceHtml.match(/<form id="modal-form">([\s\S]*?)<\/form>/)?.[1],formMarkup,'Production original and candidate modal form markup must agree');
 return {factory,pickerSource,map,sourceRoot,decisions};
}
const candidate=await loadPlannedRouteHarness(process.env.TRAVELLER_PLANNED_ROUTE_HARNESS_ROOT||candidateRoot);

export function fixture({spent=true,legacy=true,duplicates=true}={}){
 const s=canonical(clearFixture({spent,legacy}),{id:'11111111-2222-4333-8444-555555555555'});s.name='Planned route completion synthetic fixture';
 const next=s.route[s.routeIndex+1],far=s.route[s.routeIndex+2];s.mandatoryStops=duplicates?[next,far,next,far]:[next,far];
 return S.validate(s);
}
function matches(node,selector){return selector.split(',').some(part=>{part=part.trim();if(part==='*')return true;if(part.startsWith('#'))return node.id===part.slice(1);if(part.startsWith('.'))return (node.className||'').split(' ').includes(part.slice(1));const attr=part.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);if(attr)return node.hasAttribute(attr[1])&&(attr[2]===undefined||node.getAttribute(attr[1])===attr[2]);return node.tagName?.toLowerCase()===part;});}
function treeNode(tag='div',attributes={}){
 const n=element(attributes);n.tagName=tag.toUpperCase();n.type=attributes.type||(tag==='button'?'submit':tag==='select'?'select-one':tag==='input'?'text':'');n.id=attributes.id;n.style={};n.getBoundingClientRect=()=>({height:120});n.children=[];n.parentNode=null;Object.defineProperty(n,'isConnected',{configurable:true,get:()=>!!n.parentNode?.isConnected});n.className='';
 n.classList={add:(...values)=>{n.className=[...new Set([...n.className.split(' ').filter(Boolean),...values])].join(' ');},contains:value=>n.className.split(' ').includes(value)};
 n.setAttribute=(key,value)=>{n.attributes[key]=String(value);if(key==='id')n.id=String(value);};
 n.append=(...nodes)=>{for(const node of nodes){if(typeof node==='string')continue;node.remove?.();n.children.push(node);node.parentNode=n;node.form=n.form;}};
 n.remove=()=>{if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(c=>c!==n);n.parentNode=null;};
 n.replaceWith=node=>{const parent=n.parentNode;assert.ok(parent,'A connected DOM replacement retains its parent');const index=parent.children.indexOf(n);assert.ok(index>=0);node.remove?.();parent.children[index]=node;node.parentNode=parent;n.parentNode=null;};
 n.replaceChildren=(...nodes)=>{for(const old of n.children)old.parentNode=null;n.children=[];n.append(...nodes);};n.add=node=>n.append(node);
 n.contains=node=>n===node||n.children.some(c=>c.contains?.(node));
 n.querySelectorAll=selector=>n.children.flatMap(child=>[...(matches(child,selector)?[child]:[]),...(child.querySelectorAll?.(selector)||[])]);
 n.querySelector=selector=>n.querySelectorAll(selector)[0]||null;n.closest=selector=>{let node=n;while(node){if(matches(node,selector))return node;node=node.parentNode;}return null;};Object.defineProperty(n,'parentElement',{get:()=>n.parentNode});n.focus=()=>{};return n;
}
function enhance(dom){
 for(const node of dom.ids.values())node.isConnected=true;
 const originalGet=dom.document.getElementById;dom.document.getElementById=id=>{const node=originalGet(id);return node?.isConnected===false?null:node;};
 const body=dom.ids.get('modal-body'),descriptor=Object.getOwnPropertyDescriptor(body,'innerHTML');let dynamic=[];
 Object.assign(body,{children:[],querySelectorAll:selector=>body.children.flatMap(c=>[...(matches(c,selector)?[c]:[]),...c.querySelectorAll(selector)]),querySelector:selector=>body.querySelectorAll(selector)[0]||null});
 Object.defineProperty(body,'innerHTML',{configurable:true,get:descriptor.get,set:html=>{for(const child of body.children)child.parentNode=null;descriptor.set(html);for(const id of dynamic)dom.ids.delete(id);dynamic=[];body.children=[];for(const match of html.matchAll(/<(div|button)\b([^>]*id="([^"]+)"[^>]*)>/g)){const node=treeNode(match[1],attrs(match[2]));dom.ids.set(node.id,node);dynamic.push(node.id);body.children.push(node);node.parentNode=body;}}});
 const oldCreate=dom.document.createElement;dom.document.createElement=tag=>{const node=treeNode(tag);if(tag==='canvas')return oldCreate(tag);return node;};
 const form=dom.ids.get('modal-form'),dialog=dom.ids.get('modal');form.id='modal-form';form.tagName='FORM';form.isConnected=true;dialog.tagName='DIALOG';dialog.isConnected=true;form.parentNode=dialog;body.tagName='DIV';body.parentNode=form;
 for(const attributes of chrome){const node=dom.ids.get(attributes.id);Object.assign(node,{attributes,id:attributes.id,type:attributes.type,form,isConnected:true});}
 form.querySelectorAll=selector=>selector==='input,select,textarea,button'?[dom.ids.get('modal-close'),...dom.fields().values(),...body.querySelectorAll(selector),dom.ids.get('modal-cancel'),dom.ids.get('modal-submit')]:selector==='[data-round]'?[...dom.fields().values()].filter(n=>n.hasAttribute('data-round')):body.querySelectorAll(selector);
 Object.defineProperty(form,'elements',{configurable:true,get(){const nodes=form.querySelectorAll('input,select,textarea,button');nodes.namedItem=name=>dom.fields().get(name)||nodes.find(n=>n.name===name)||null;return nodes;}});
 form.contains=node=>node===body||body.children.some(child=>child.contains(node))||form.querySelectorAll('input,select,textarea,button').includes(node);dialog.contains=node=>node===form||form.contains(node);
}
function maps(saved,map){
 const all=Object.values(saved.worlds),queue={nearby:[],loadWorld:[],loadMapHex:[],sectors:[],sectorCatalog:[],sectorOverview:[]},calls=[];
 const defaults={nearby:()=>all,loadWorld:(sector,hex)=>{const w=all.find(w=>w.sector===sector&&w.hex===hex);assert.ok(w,'Synthetic selected world '+sector+' '+hex);return structuredClone(w);},loadMapHex:(x,y)=>all.find(w=>w.id===x+','+y),sectors:()=>[...new Set(all.map(w=>w.sector))].map(name=>({name,aliases:[name]})),sectorCatalog:sector=>({worlds:all.filter(w=>w.sector===sector).map(w=>({...w,subsector:map.subsectorForHex(w.hex)})),subsectors:Array.from({length:16},(_,i)=>({index:String.fromCharCode(65+i),name:'Synthetic subsector '+i}))}),sectorOverview:()=>({worlds:[],subsectors:[],borders:[]})};
 const methods=Object.fromEntries(Object.keys(queue).map(kind=>[kind,(...args)=>{calls.push({kind,args:structuredClone(args)});const fn=queue[kind].shift();return fn?fn(...args):Promise.resolve(defaults[kind](...args));}]));
 return {calls,methods,hold(kind,{skip=0}={}){for(let i=0;i<skip;i++)queue[kind].push((...args)=>Promise.resolve(defaults[kind](...args)));let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});promise.catch(()=>{});let args;queue[kind].push((...values)=>{args=values;return promise;});return {resolve:value=>resolve(value??defaults[kind](...(args||[]))),reject:(error=Error('Synthetic '+kind+' failure'))=>reject(error)};}};
}
function picker(source,map,subsectorForHex){const instances=[],values=new Map();let api;
 return {instances,init(dom){const sandbox={...map.methods,subsectorForHex,document:dom.document,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},Option:class{constructor(text,value){Object.assign(this,treeNode('option'),{textContent:text,value});}}};api=vm.runInNewContext(source.replace(/^import .*;\n/gm,'').replaceAll('export ','')+'\n({createWorldPicker,rememberWorld});',sandbox,{filename:'actual world-picker.mjs (transport/DOM doubled)'});},create(host,options){const instance=api.createWorldPicker(host,options);instances.push({host,instance,options});return instance;},remember:w=>api.rememberWorld(w)};
}
export function setup(saved=fixture(),{kind='map',draft=true,source=candidate}={}){
 const map=maps(saved,source.map),pickers=picker(source.pickerSource,map,source.map.subsectorForHex),frames=new Map();let nextFrame=0;
 const frameControl={request(fn){frames.set(++nextFrame,fn);return nextFrame;},cancel(id){frames.delete(id);}};
 const h=source.factory(saved,{setTimeout:()=>0,clearTimeout(){},mapControl:map,frameControl,domEnhance:enhance,pickerControl:pickers});
 h.api.setDecisions(source.decisions);h.hooks.onRole=(editable,text)=>h.api.roleChange(editable,text);h.api.setTab('Overview');
 if(draft){const stops=[...saved.mandatoryStops];h.api.setRouteDraft({mode:kind==='auto'?'auto':'build',origin:saved.actual,revision:saved.revision,stops,selections:stops.map((id,i)=>({id,sequence:i+1,pending:false,error:'',anchor:null})),selection:stops.length,path:[saved.actual,...stops],loading:false,error:'',request:1});}
 const paints={replacements:0,statusWrites:0,markup:[]},oldQuery=h.dom.document.querySelector,oldCreate=h.dom.document.createElement;
 h.dom.ids.set('map-load-status',element());let status='';Object.defineProperty(h.dom.ids.get('map-load-status'),'textContent',{configurable:true,get:()=>status,set:value=>{status=value;paints.statusWrites++;}});
 h.dom.document.querySelector=selector=>selector==='.world-map'?{replaceWith(node){assert.ok(node);paints.replacements++;paints.markup.push(node.markup);}}:oldQuery(selector);
 h.dom.document.createElement=tag=>{const node=oldCreate(tag);if(tag==='div'){const query=node.querySelector;node.querySelector=selector=>selector==='.world-map'?{markup:node.innerHTML}:query(selector);}return node;};
 h.api.render();const originalForm=h.dom.ids.get('modal-form');
 return {...h,kind,map,pickers,paints,frames,runFrames(){const entries=[...frames];frames.clear();for(const [,fn]of entries)fn();},event:()=>({preventDefault(){},currentTarget:originalForm}),
 async open(){if(kind!=='plot'){if(kind==='auto')await h.api.calculateMapRoute();h.api.saveMapRoute();}else{h.api.plotRoute();await Promise.all(pickers.instances.map(p=>p.instance.ready));await h.submit();}assert.equal(ui(h).modalTitle,kind==='plot'?'Review route':'Save planned route');assert.equal(ui(h).modalError,'');},
 async openPicker(){h.api.plotRoute();await Promise.all(pickers.instances.map(p=>p.instance.ready));assert.equal(ui(h).modalTitle,'Plan route · fewest jumps');},
 choose(index,id){const p=pickers.instances[index],w=h.api.state.worlds[id];assert.ok(p&&w);const select=p.host.querySelector('[aria-label="World"]');select.value=w.hex;select.dispatch('change');},
 };
}
export const body=h=>h.dom.ids.get('modal-body').innerHTML;
export const success=/^Route planned(?: from map)? saved\.$/;
export const noSuccess=h=>assert.doesNotMatch(ui(h).message,success);
export function busy(h,session=h.api.modalSession){assert.equal(h.api.modalSession,session);assert.equal(ui(h).modalOpen,true);assert.equal(session.busy,true);for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(h.dom.ids.get(id).disabled,true,id);noSuccess(h);}
export function terminal(h,{modal=true}={}){assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.equal(h.dom.ids.get('takeover').disabled,true);assert.match(h.dom.ids.get('save-status').textContent,/reload/i);noSuccess(h);if(modal&&ui(h).modalOpen){assert.equal(ui(h).submitDisabled,true);assert.match(ui(h).modalError,/reload/i);}}
export async function pending(t,kind='map',h=setup(undefined,{kind})){
 const before=h.persisted(),raw=h.bytes();await h.open();const draft=h.api.routeDraft,session=h.api.modalSession,review=body(h),visible=display(h),gate=serviceSaveGate(h.store),detached=h.dom.ids.get('modal-form').onsubmit,operation=h.submit();
 assert.equal(gate.entries.length,1,'Real controller reaches deferred Store in submit stack');
 t.after(async()=>{for(const entry of gate.entries)if(!entry.settled)entry.fulfill();await operation;gate.restore();});
 return {h,before,raw,draft,session,review,visible,gate,detached,operation};
}
export const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');

export function attachSettings(h){const form=h.dom.document.createElement('form'),input=h.dom.document.createElement('input'),main=h.dom.ids.get('main');form.id='settings-form';input.setAttribute('name','synthetic-draft');input.name='synthetic-draft';input.value='Unsaved settings sentinel';form.append(input);form.elements=[input];form.elements.namedItem=name=>name===input.name?input:null;main.children=[form];form.parentNode=main;h.dom.ids.set('settings-form',form);h.api.setTab('Settings');return {form,input,attached:()=>form.isConnected&&main.children.includes(form)};}
