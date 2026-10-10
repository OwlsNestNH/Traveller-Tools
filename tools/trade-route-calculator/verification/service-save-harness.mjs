import assert from 'node:assert/strict';
import {depositHarness,campaign,S,same,flush} from './deposit-save-harness.mjs';
import {attrs,element} from './app-harness.mjs';
import {configureFuel} from '../js/fuel.mjs';
export {S,same,flush};

// These are application-function tests, not browser/visual or Web Locks tests.
// Execute the real app, controller, state and Store with private synthetic
// localStorage. The only added double is DOM parsing for the service screen.
export function serviceCampaign({full=false,creditStep=1}={}){
 const s=campaign();s.ship.capacity='120';s.ship.fuel=configureFuel(200,43,20,40,2);
 s.settings.creditStep=creditStep;
 s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:4,high:0},occupiedLowBerths:2,luggageTons:'0'};
 s.ship.lifeSupport={capacityHours:672,remainingHours:full?672:336,elapsedHours:0};
 return S.validate(s);
}
export function serviceHarness(saved=serviceCampaign()){
 // Map loading is outside this private-storage test: omit background timers so
 // entering Overview cannot issue unrelated external map requests.
 const h=depositHarness(saved,{setTimeout:()=>0,clearTimeout(){}}),document=h.dom.document;
 const baseQuery=document.querySelector,baseQueryAll=document.querySelectorAll;
 let markup='',fields=new Map(),buttons=[],form=null,panel=null;
 const parse=html=>{
  for(const id of ['service-panel','service-form','service-status','service-quote','fuel-custom-fields','fuel-purchase-fields','fuel-availability'])h.dom.ids.delete(id);
  markup=html;fields=new Map();buttons=[];form=null;panel=null;
  const section=html.match(/<aside\b[^>]*id="service-panel"[^>]*>[\s\S]*?<\/aside>/)?.[0];if(!section)return;
  panel=element(attrs(section.match(/^<aside\b([^>]*)>/)[1]));panel.innerHTML=section;h.dom.ids.set('service-panel',panel);
  for(const match of section.matchAll(/<input\b([^>]*)>/g)){const n=element(attrs(match[1]));n.type=n.attributes.type??'text';n.checked='checked'in n.attributes;fields.set(n.name,n);}
  for(const match of section.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)){
   const options=[...match[2].matchAll(/<option\b([^>]*)>/g)].map(m=>attrs(m[1])),chosen=options.find(o=>'selected'in o)||options[0]||{};
   const n=element({...attrs(match[1]),value:chosen.value??''});n.type='select-one';fields.set(n.name,n);
  }
  buttons=[...section.matchAll(/<button\b([^>]*)>/g)].map(m=>element(attrs(m[1])));
  const formTag=section.match(/<form\b([^>]*id="service-form"[^>]*)>/);
  if(formTag){form=element(attrs(formTag[1]));form.id='service-form';form.elements=[...fields.values()];h.dom.ids.set('service-form',form);}
  for(const id of ['service-status','service-quote','fuel-custom-fields','fuel-purchase-fields','fuel-availability']){
   const tag=section.match(new RegExp('<[a-z]+\\b([^>]*id="'+id+'"[^>]*)>'));
   if(tag){const n=element(attrs(tag[1]));n.hidden='hidden'in n.attributes;h.dom.ids.set(id,n);}
  }
 };
 const main=h.dom.ids.get('main');markup=main.innerHTML;
 Object.defineProperty(main,'innerHTML',{configurable:true,get:()=>markup,set:parse});
 document.querySelector=selector=>{
  if(selector.startsWith('#service-form')){const name=selector.match(/\[name="([^"]+)"\]/)?.[1];return name?fields.get(name)??null:form;}
  return baseQuery(selector);
 };
 document.querySelectorAll=selector=>{
  if(selector.includes('#service-panel')){
   const found=new Set();
   for(const part of selector.split(',')){
    if(/\binput\b/.test(part))for(const field of fields.values())if(field.attributes.type)found.add(field);
    if(/\bselect\b/.test(part))for(const field of fields.values())if(!field.attributes.type)found.add(field);
    if(/\bbutton\b|\[data-action/.test(part)){
     const action=part.match(/\[data-action="([^"]+)"\]/)?.[1];
     for(const button of buttons)if(!action||button.dataset.action===action)found.add(button);
    }
   }
   return [...found];
  }
  return baseQueryAll(selector);
 };
 h.api.render();
 const action=(name,arg='',token=h.api.services.token())=>h.api.safely(()=>h.api.services.action(name,arg,token))();
 return {...h,serviceFields:()=>fields,serviceButtons:()=>buttons,serviceForm:()=>form,servicePanel:()=>panel,
  serviceAction:action,
  fillService(values){for(const [name,value]of Object.entries(values)){const field=fields.get(name);assert.ok(field,'Expected actual rendered service field '+name);if(field.attributes.type==='checkbox')field.checked=Boolean(value);else field.value=String(value);}h.api.services.sync();},
  submitService(target=form){assert.ok(target,'Expected rendered service form');h.dom.dispatch('submit',target,{preventDefault(){}});},
  escapeService(){h.dom.dispatch('keydown',{matches:()=>false},{key:'Escape',preventDefault(){}});},
  serviceButton:name=>buttons.find(b=>b.dataset.action===name)
 };
}

// A completion provider must fulfill only after the real durable write AND
// publication have completed. Splitting write() and fulfill() lets tests verify
// the UI's await boundary; this does not certify an arbitrary async backend.
// No production write or publication body is copied or replaced here.
export function serviceSaveGate(store){
 const original=store.save,entries=[],observed=[];
 store.save=function(...args){
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const entry={args,promise,wrote:false,settled:false,result:undefined,error:null,
   write(){assert.equal(this.wrote,false,'Actual provider called only once');this.wrote=true;try{this.result=original.apply(store,args);}catch(error){this.error=error;}return this;},
   fulfill(){assert.equal(this.settled,false);if(!this.wrote)this.write();this.settled=true;if(this.error)reject(this.error);else resolve(this.result);},
   reject(error=Error('Unclassified service provider failure')){assert.equal(this.settled,false);this.settled=true;reject(error);}
  };
  promise.catch(error=>observed.push(error));entries.push(entry);return promise;
 };
 return {entries,observed,restore(){store.save=original;}};
}
export const serviceUI=h=>({active:h.api.services.active(),busy:h.api.services.committing(),token:h.api.services.token(),html:h.api.services.panel(),message:h.dom.ids.get('message').textContent,confirmDisabled:h.serviceButton('service-confirm')?.disabled,fields:[...h.serviceFields()].map(([name,field])=>({name,value:field.type==='checkbox'?field.checked:field.value,disabled:field.disabled}))});
