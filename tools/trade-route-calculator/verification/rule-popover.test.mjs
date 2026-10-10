import test from 'node:test';
import assert from 'node:assert/strict';
import {mountRulePopover,replaceReferenceContent} from '../js/rule-popover.mjs';

// A small DOM/event double exercises controller ordering and fallback selection.
// Native focus trapping, actual clicks, geometry and screen QA remain in Chromium.
function harness(){
 const listeners=new Map(),nodes=new Map();let active=null,blur=null;
 const element=(id='')=>({id,dataset:{},isConnected:true,disabled:false,open:false,innerHTML:'',textContent:'',children:[],attributes:{},listeners:new Map(),setAttribute(k,v){this.attributes[k]=v;},append(el){this.children.push(el);},remove(){this.isConnected=false;},getClientRects(){return this.isConnected?[{}]:[];},focus(){active=this;},addEventListener(type,fn){this.listeners.set(type,fn);},removeEventListener(type){this.listeners.delete(type);},querySelectorAll(){return this.references||[];},contains(el){return this.children.includes(el);}});
 const dialog=element('rule-reference-popup'),title=element(),body=element(),close=element();dialog.children=[title,body,close];
 dialog.querySelector=selector=>selector==='h2'?title:selector==='button'?close:body;
 dialog.showModal=()=>{dialog.open=true;blur?.();};dialog.close=()=>{dialog.open=false;};
 const main=element('main'),modal=element('modal'),modalClose=element('modal-close'),nav=element('tab-overview'),notes=element('notes');modal.children=[modalClose];
 for(const el of [main,modal,modalClose,notes])nodes.set(el.id,el);
 const document={body:element('body'),get activeElement(){return active;},createElement:tag=>{assert.equal(tag,'dialog');return dialog;},getElementById:id=>nodes.get(id),querySelector:()=>nav,querySelectorAll:()=>[],addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);}};
 const api=mountRulePopover(document);
 function marker(id='jump-duration',scope=main){const b=element();b.dataset.ruleInfo=id;b.closest=selector=>selector==='[data-rule-info]'?b:selector==='[id]'?scope:null;scope.references=[...(scope.references||[]),b];scope.children.push(b);return b;}
 close.closest=selector=>selector==='.rule-reference-close'?close:null;
 function event(type,target,extra={}){const e={target,key:'',detail:0,button:0,pointerId:1,clientX:20,clientY:30,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},stopPropagation(){this.stopped=true;},...extra};listeners.get(type)?.(e);return e;}
 return {api,marker,event,dialog,title,body,close,main,modal,modalClose,nav,document,listeners,active:()=>active,blur:fn=>blur=fn};
}
test('click and keyboard Escape isolate the popup and restore its exact connected opener',()=>{
 const h=harness(),b=h.marker();
 const click=h.event('click',b);assert.equal(click.prevented,true);assert.equal(click.stopped,true);assert.equal(h.api.isOpen(),true);assert.equal(h.active(),h.close);assert.match(h.body.innerHTML,/Core 2022 p\. 157/);
 const escape=h.event('keydown',h.close,{key:'Escape'});assert.equal(escape.prevented,true);assert.equal(escape.stopped,true);assert.equal(h.api.isOpen(),false);assert.equal(h.active(),b);
});
test('opening over a transaction does not close or submit it',()=>{
 const h=harness();h.modal.open=true;const b=h.marker('tax',h.modal);
 h.event('click',b);assert.equal(h.modal.open,true);h.event('click',h.close);assert.equal(h.modal.open,true);assert.equal(h.active(),b);
});
test('Tab and Shift+Tab wrap between Close and scrollable reference text',()=>{
 const h=harness(),b=h.marker();assert.equal(h.event('keydown',b,{key:'Tab'}).prevented,false);
 h.event('click',b);
 for(const shiftKey of [false,true])for(let n=0;n<4;n++){
  const before=h.active(),e=h.event('keydown',before,{key:'Tab',shiftKey});
  assert.equal(e.prevented,true);assert.equal(e.stopped,true);assert.equal(h.active(),before===h.close?h.body:h.close);
 }
 h.event('keydown',h.active(),{key:'Escape'});assert.equal(h.active(),b);
});
test('a marker replaced during ordinary blur or a background render has a logical focus successor',()=>{
 const h=harness(),b=h.marker('refuel');let replacement;
 h.blur(()=>{b.isConnected=false;h.main.references=[];replacement=h.marker('refuel');});
 const down=h.event('pointerdown',b);assert.equal(down.prevented,true);assert.equal(h.api.isOpen(),false,'Pointerdown alone does not activate the reference');
 h.event('click',b);assert.equal(h.api.isOpen(),true);assert.equal(b.isConnected,false);
 h.event('keydown',h.close,{key:'Escape'});assert.equal(h.active(),replacement);
});
test('fallback stays in a transaction dialog, otherwise returns to visible navigation',()=>{
 const h=harness(),b=h.marker();h.event('click',b);b.isConnected=false;h.main.references=[];h.modal.open=true;
 h.api.close();assert.equal(h.active(),h.modalClose);
 h.modal.open=false;const c=h.marker();h.event('click',c);c.isConnected=false;h.main.references=[];h.api.close();assert.equal(h.active(),h.nav);
});
test('the second click of a close gesture cannot activate the page underneath',()=>{
 const h=harness(),b=h.marker();h.event('click',b,{detail:1});h.event('click',h.close,{detail:1});
 const repeated=h.event('click',b,{detail:2});assert.equal(repeated.prevented,true);assert.equal(repeated.stopped,true);assert.equal(h.api.isOpen(),false);
 const fresh=h.event('click',b,{detail:1});assert.equal(fresh.prevented,true);assert.equal(h.api.isOpen(),true);
});
test('disabled markers are inert and destroying the controller removes its listeners',()=>{
 const h=harness(),b=h.marker();b.disabled=true;assert.equal(h.event('click',b).prevented,false);assert.equal(h.api.isOpen(),false);
 h.api.destroy();assert.equal(h.dialog.isConnected,false);assert.equal(h.listeners.size,0);
});

test('dynamic audit text retains repeated reference nodes in order and preserves focus',()=>{
 let active=null,children=[];
 const button=(id,label)=>({dataset:{ruleInfo:id},label,isConnected:true,matches:selector=>selector==='[data-rule-info]',focus(){active=this;},replaceWith(kept){const at=children.indexOf(this);assert.notEqual(at,-1);children[at]=kept;kept.isConnected=true;this.isConnected=false;}});
 const oldA=button('rounding','first'),oldB=button('rounding','second'),oldC=button('tax','third');children=[oldA,oldB,oldC];active=oldB;
 const box={ownerDocument:{get activeElement(){return active;}},querySelectorAll:()=>[...children],contains:el=>children.includes(el),set innerHTML(html){assert.equal(html,'new audit text');children.forEach(el=>el.isConnected=false);active=null;children=[button('rounding','new-first'),button('rounding','new-second'),button('insurance','new-insurance')];}};
 replaceReferenceContent(box,'new audit text');assert.equal(children[0],oldA);assert.equal(children[1],oldB);assert.equal(children[2].dataset.ruleInfo,'insurance');assert.equal(oldC.isConnected,false);assert.equal(active,oldB);
});
