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
const executable=app.replace(/^import .*;\n/gm,'').replace(/\nboot\(\)\.catch\([\s\S]*$/,'');
const origin={id:'0,0',x:0,y:0,name:'Origin',sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'};
const destination={...origin,id:'1,0',x:1,name:'Destination',hex:'0201'};
const decode=t=>t.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m=>[m[1],decode(m[2]??'')]));
function element(attributes={}){return {clientWidth:1440,attributes,dataset:Object.fromEntries(Object.entries(attributes).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),value:attributes.value??'',name:attributes.name,disabled:'disabled'in attributes,hidden:false,open:false,textContent:'',innerHTML:'',hasAttribute(n){return n in this.attributes;},getAttribute(n){return this.attributes[n]??null;},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},insertAdjacentHTML(_,html){this.innerHTML+=html;},querySelector(){return null;},querySelectorAll(){return [];},closest(){return null;}};}
function domDouble(){
 const ids=new Map(['summary','ship-actions','tabs','main','modal','modal-title','modal-body','modal-error','modal-submit','modal-cancel','modal-form','modal-close','notes','takeover','import-file','save-status','message'].map(id=>[id,element()]));
 let buttons=[];const listeners=new Map();
 return {ids,buttons:()=>buttons,dispatch(type,target,details={}){return Promise.all((listeners.get(type)||[]).map(listener=>listener({type,target,...details})));},document:{createElement(){return {...element(),getContext(){return {measureText:t=>({width:String(t).length*6})};}};},getElementById:id=>ids.get(id)||null,addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},querySelector(){return null;},querySelectorAll(selector){
  if(selector!=='[data-mutate]')return [];
  buttons=[...ids.values()].flatMap(n=>[...(n.innerHTML||'').matchAll(/<button\b([^>]*)>/g)].map(m=>element(attrs(m[1])))).filter(n=>n.hasAttribute('data-mutate'));return buttons;
 }},FormData:class{}};
}
function campaign(){const s=S.initial();s.initialized=true;s.bank='100000';s.actual=origin.id;s.worlds=structuredClone({[origin.id]:origin,[destination.id]:destination});s.route=[origin.id,destination.id];s.ship.armed=true;s.trader.rank=2;s.trader.soc=1;return S.validate(s);}
function harness(saved=campaign(),mapOverrides={}){
 const dom=domDouble(),calls={saves:0};let persisted=structuredClone(saved),api;
 const store={editable:true,recovery:false,save(next,expected){if(!this.editable)throw Error('This tab is read-only.');if(persisted.revision!==expected)throw Error('This preview is stale.');S.validate(next);persisted=structuredClone(next);calls.saves++;api.setState(next);api.render();},replace(next,expected){next=structuredClone(S.validate(next));next.revision=expected+1;this.save(next,expected);},read:()=>structuredClone(persisted)};
 const sandbox={...bindings,M:{...bindings.M,...mapOverrides},document:dom.document,window:{addEventListener(){},innerWidth:1440},getComputedStyle:()=>({paddingLeft:'0',paddingRight:'0'}),crypto:webcrypto,structuredClone,console,FormData:dom.FormData,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
 vm.runInContext(executable+`\nglobalThis.api={mapEmpty,mapWorld,calculateMapRoute,saveMapRoute,startMapRoute,mapRouteControls,removeMapStop,retryMapRoute,get routeDraft(){return routeDraft;},get known(){return known;},init(s,c,m,p){state=s;core=c;mp=m;store=p;known={...s.worlds};view=s.actual;tab='Trade';},get state(){return state;},get view(){return view;},setState(s){receiveCampaign(s);},setTab(t){tab=t;},render,actions};`,vm.createContext(sandbox),{filename:'app.mjs (VM; boot omitted)'});
 api=sandbox.api;api.init(structuredClone(saved),core,mp,store);api.render();
 const submit=()=>dom.ids.get('modal-form').onsubmit({preventDefault(){},currentTarget:dom.ids.get('modal-form')});
 return {api,store,calls,dom,submit,persisted:()=>structuredClone(persisted)};
}


export {harness,campaign,origin,destination};
