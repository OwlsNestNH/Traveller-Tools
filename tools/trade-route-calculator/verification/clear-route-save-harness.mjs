import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {S,same,ui,flush} from './deposit-save-harness.mjs';
import {element,attrs} from './app-harness.mjs';
import {serviceSaveGate} from './service-save-harness.mjs';
import {originalClearRoute,originalClearRouteSHA256} from './fixtures/clear-route-original.mjs';
import {guiFixture} from './fixtures/gui-parity.mjs';
import {configureFuel} from '../js/fuel.mjs';
export {S,same,ui,flush,serviceSaveGate};

// Native application integration, not a simulated browser certification. The
// actual app, receiveCampaign, controller, state, Store, render, paintMap and
// map cache callbacks run unchanged. Only DOM, transport and localStorage are
// doubled. The browser companion owns native requestSubmit and DOM layout.
const harnessURL=new URL('./app-harness.mjs',import.meta.url),storageURL=new URL('./deposit-save-harness.mjs',import.meta.url);
const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const formMarkup=html.match(/<form id="modal-form">([\s\S]*?)<\/form>/)?.[1];
assert.ok(formMarkup,'Production modal form boundary');
const chrome=[...formMarkup.matchAll(/<button\b([^>]*id="modal-(?:close|cancel|submit)"[^>]*)>/g)].map(m=>attrs(m[1]));
assert.deepEqual(chrome.map(a=>a.id),['modal-close','modal-cancel','modal-submit'],'All three real chrome buttons are inside the form');
assert.equal(createHash('sha256').update(originalClearRoute).digest('hex'),originalClearRouteSHA256);
const absolutize=(source,url)=>source.replaceAll('import.meta.url',JSON.stringify(url.href)).replace(/from '(\.[^']+)'/g,(_all,path)=>'from '+JSON.stringify(new URL(path,url).href));
function replace(source,from,to){assert.ok(source.includes(from),'Expected actual harness boundary '+from);return source.replace(from,to);}
export async function loadClearRouteHarness(root=new URL('../',import.meta.url),{original=false}={}){
 const sourceRoot=root instanceof URL?root:new URL('file://'+root.replace(/\/$/,'')+'/');
 const sourceApp=await readFile(new URL('js/app.mjs',sourceRoot),'utf8');
 const roleStart=sourceApp.indexOf('store=new Store(receiveCampaign,');assert.ok(roleStart>=0);
 const role=sourceApp.slice(roleStart+'store=new Store(receiveCampaign,'.length).split(');try{state=store.read();}')[0];assert.ok(role.startsWith('(editable,text)=>'));
 let source=await readFile(harnessURL,'utf8');
 source=replace(source,"const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');",'const app=CLEAR_ROUTE_APP;');
 source=absolutize(source,harnessURL);
 // Every production dependency, rule and Store import uses the chosen root.
 // The independent released oracle must not borrow changed candidate helpers.
 source=source.replaceAll(new URL('../',import.meta.url).href,sourceRoot.href);
 source=replace(source,'CLEAR_ROUTE_APP',JSON.stringify(sourceApp));
 source=replace(source,'clearTimeout:cancel=clearTimeout}={}','clearTimeout:cancel=clearTimeout,mapControl,frameControl}={}');
 source=replace(source,'...bindings,R:rules,document:dom.document','...bindings,M:{...bindings.M,nearby:(...args)=>mapControl.nearby(...args),loadMapHex:(...args)=>mapControl.loadMapHex(...args),sectors:(...args)=>mapControl.sectors(...args),sectorOverview:(...args)=>mapControl.sectorOverview(...args)},R:rules,document:dom.document');
 source=replace(source,'requestAnimationFrame:()=>1,cancelAnimationFrame(){}','requestAnimationFrame:fn=>frameControl.request(fn),cancelAnimationFrame:id=>frameControl.cancel(id)');
 source=replace(source,'vm.runInContext(executable+','vm.runInContext(executable+'+JSON.stringify(original?'\n'+originalClearRoute:'')+'+');
 source=replace(source,'globalThis.api={setStore','globalThis.api={get routeDraft(){return routeDraft;},get tab(){return tab;},get epoch(){return campaignPublicationEpoch;},get editingEpoch(){return editingLossEpoch;},get mapAreas(){return mapAreas;},get mapOverview(){return mapOverview;},clearPlannedRoute,startMapRoute,mapEmpty,mapWorld,calculateMapRoute,retryMapRoute,paintMap,requestMapAreas,scheduleMapPaint,refreshNearby,setDecisions(v){decisions=v;},roleChange:'+role+',setStore');
 const module='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
 let storage=absolutize(await readFile(storageURL,'utf8'),storageURL);storage=replace(storage,JSON.stringify(harnessURL.href),JSON.stringify(module));storage=storage.replaceAll(new URL('../',import.meta.url).href,sourceRoot.href);
 return (await import('data:text/javascript;base64,'+Buffer.from(storage).toString('base64'))).depositHarness;
}
const candidateHarness=await loadClearRouteHarness(),originalHarness=await loadClearRouteHarness(undefined,{original:true});
const decisions=JSON.parse(await readFile(new URL('../rules/decisions.json',import.meta.url),'utf8'));

export function fixture({jump=true,spent=true,legacy=true}={}){
 let s=guiFixture().state;s.name='Clear route completion fixture';s.bank='900719925474099312345678901';s.ledger[0].amount=s.bank;
 // Seed a UUID-shaped identity specifically to catch overbroad normalizers.
 s.lots[0].id='11111111-2222-4333-8444-555555555555';
 s.ship.fuel=configureFuel(200,40,60,40,2);s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'560',denominator:'1'}};
 s.mandatoryStops=s.route.slice(4,7);
 s.contracts.push({id:'clear-mail',kind:'mail',status:'accepted',origin:s.actual,destination:s.route[4],quantity:'5',payment:'9007199254740993',dueHours:null,firstDeparture:null,audit:{manual:true,reason:'Retain approved mail terms'}});
 s.policies=[{id:'clear-policy',lotId:'lot-opening',claims:[],status:'active',initialQuantity:'2',remainingQuantity:'2',insuredValue:'2000',remainingValue:'2000',coverage:70,route:s.route.slice(s.routeIndex),routeProgress:0,destination:s.route.at(-1)}];
 s=S.transition(s,'Passenger capacity',n=>S.configurePassengerCapacity(n,{reservedCabins:2,installedLowBerths:2}));
 const offers=['low','basic','middle','high'].map((passageClass,i)=>({offerId:'clear-passage-'+i,passageClass,count:2,fare:String(1000+i*1000),origin:s.actual,destination:s.route[3],audit:{synthetic:true}}));
 s=S.transition(s,'Passenger search',n=>S.recordPassengerSearch(n,{id:'clear-search',label:'Passenger search audit',hours:n.hours,world:n.actual,destination:n.route[3],offers}));
 s=S.transition(s,'Accepted passenger booking',n=>S.acceptPassengers(n,'clear-passage-2',{count:1,cabinMode:'private',serviceConfirmed:true,spaceConfirmed:true}));
 if(jump){const commit=(state,face)=>{const p=S.prepareJump(state,()=>({dice:Array(6).fill(face),total:face*6}));return S.transition(p.state,'Saved jump',n=>S.commitJump(n,{attemptId:p.attempt.id,elapsed:160}));};s=commit(s,3);if(spent)s=commit(S.undoJump(s),2);}
 if(legacy)s.ship.lifeSupport={capacityHours:672,remainingHours:336,elapsedHours:6};
 return S.validate(s);
}
function maps(saved){
 const queue={nearby:[],loadMapHex:[],sectors:[],sectorOverview:[]},calls=[];
 const consume=(kind,args)=>{calls.push({kind,args});const fn=queue[kind].shift();if(fn)return fn(...args);return Promise.resolve(kind==='nearby'?Object.values(saved.worlds):kind==='sectors'?[]:kind==='sectorOverview'?{worlds:[],subsectors:[],borders:[]}:null);};
 return {calls,...Object.fromEntries(Object.keys(queue).map(kind=>[kind,(...args)=>consume(kind,args)])),hold(kind){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});promise.catch(()=>{});queue[kind].push(()=>promise);return {resolve:value=>resolve(value??(kind==='nearby'?Object.values(saved.worlds):[])),reject:(error=Error('Synthetic '+kind+' failure'))=>reject(error)};}};
}
export function setup(saved=fixture(),{original=false,draft=true,factory=null}={}){
 const map=maps(saved),frames=new Map();let nextFrame=0;
 const frameControl={request(fn){frames.set(++nextFrame,fn);return nextFrame;},cancel(id){frames.delete(id);}};
 const h=(factory||(original?originalHarness:candidateHarness))(saved,{setTimeout:()=>0,clearTimeout(){},mapControl:map,frameControl});
 h.api.setDecisions(decisions);h.hooks.onRole=(editable,text)=>h.api.roleChange(editable,text);
 const form=h.dom.ids.get('modal-form'),dialog=h.dom.ids.get('modal');form.id='modal-form';form.isConnected=true;dialog.isConnected=true;
 for(const attributes of chrome){const node=h.dom.ids.get(attributes.id);Object.assign(node,{attributes,id:attributes.id,type:attributes.type,form,isConnected:true});}
 const originalQuery=form.querySelectorAll;
 form.querySelectorAll=selector=>selector==='input,select,textarea,button'?[h.dom.ids.get('modal-close'),...h.dom.fields().values(),h.dom.ids.get('modal-cancel'),h.dom.ids.get('modal-submit')]:originalQuery(selector);
 form.contains=node=>form.querySelectorAll('input,select,textarea,button').includes(node);dialog.contains=node=>node===form||form.contains(node);
 h.api.setTab('Overview');
 if(draft)h.api.setRouteDraft({mode:'build',origin:saved.actual,revision:saved.revision,stops:[saved.route[saved.routeIndex+1]],selections:[{id:saved.route[saved.routeIndex+1],sequence:1,pending:false,error:'',anchor:null}],selection:1,path:saved.route.slice(saved.routeIndex,saved.routeIndex+2),loading:false,error:'',request:1});
 const paints={replacements:0,statusWrites:0,markup:[]},oldQuery=h.dom.document.querySelector,oldCreate=h.dom.document.createElement;
 h.dom.ids.set('map-load-status',element());let status='';Object.defineProperty(h.dom.ids.get('map-load-status'),'textContent',{configurable:true,get:()=>status,set:value=>{status=value;paints.statusWrites++;}});
 h.dom.document.querySelector=selector=>selector==='.world-map'?{replaceWith(node){assert.ok(node,'Real mapPanel generated a replacement SVG');paints.replacements++;paints.markup.push(node.markup);}}:oldQuery(selector);
 h.dom.document.createElement=tag=>{const node=oldCreate(tag);if(tag==='div')node.querySelector=selector=>selector==='.world-map'?{markup:node.innerHTML}:null;return node;};
 h.api.render();
 return {...h,map,paints,frames,runFrames(){const entries=[...frames];frames.clear();for(const [,fn]of entries)fn();},open(){h.api.clearPlannedRoute();assert.equal(ui(h).modalTitle,'Clear planned route');assert.equal(ui(h).modalError,'');},event:()=>({preventDefault(){},currentTarget:form})};
}
export function canonical(value,seed){
 const seeded=new Set(),generated=new Map(),uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
 JSON.stringify(seed,(_key,v)=>{if(typeof v==='string'&&uuid.test(v))seeded.add(v);return v;});
 return JSON.parse(JSON.stringify(value,(_key,v)=>{if(typeof v==='string'&&uuid.test(v)&&!seeded.has(v)){if(!generated.has(v))generated.set(v,'generated-'+generated.size);return generated.get(v);}return v;}));
}
export const display=h=>Object.fromEntries(['summary','main','ship-actions'].map(id=>[id,h.dom.ids.get(id).innerHTML]));
export const success=/^Cleared planned route saved\.$/;
export const noSuccess=h=>assert.doesNotMatch(ui(h).message,success);
export function busy(h,session=h.api.modalSession){assert.equal(h.api.modalSession,session);assert.equal(ui(h).modalOpen,true);assert.equal(session.busy,true);for(const id of ['modal-submit','modal-cancel','modal-close'])assert.equal(h.dom.ids.get(id).disabled,true,id);noSuccess(h);}
export function terminal(h,{modal=true}={}){assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.equal(h.dom.ids.get('takeover').disabled,true);assert.match(h.dom.ids.get('save-status').textContent,/reload/i);noSuccess(h);if(modal&&ui(h).modalOpen){assert.equal(ui(h).submitDisabled,true);assert.match(ui(h).modalError,/reload/i);}}
export async function pending(t,h=setup()){
 const before=h.persisted(),raw=h.bytes(),draft=h.api.routeDraft;h.open();const session=h.api.modalSession,review=h.dom.ids.get('modal-body').innerHTML,visible=display(h),gate=serviceSaveGate(h.store),detached=h.dom.ids.get('modal-form').onsubmit,operation=h.submit();
 assert.equal(gate.entries.length,1,'Real controller reaches deferred Store in the submit stack');
 t.after(async()=>{for(const entry of gate.entries)if(!entry.settled)entry.fulfill();await operation;gate.restore();});
 return {h,before,raw,draft,session,review,visible,gate,detached,operation};
}
export function trap(h,id,property,callback){const node=h.dom.ids.get(id),descriptor=Object.getOwnPropertyDescriptor(node,property);let value=node[property];Object.defineProperty(node,property,{configurable:true,get:descriptor?.get??(()=>value),set(next){if(descriptor?.set)descriptor.set(next);else value=next;callback(next);}});}
