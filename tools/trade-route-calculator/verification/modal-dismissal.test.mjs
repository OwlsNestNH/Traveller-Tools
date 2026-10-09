import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

// Execute the actual application's modal lifecycle and click guard. Browser
// geometry/click-through reproduction remains in campaign-stress-browser.
const source=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const modalSource=source.slice(source.indexOf('let activeModal=null;'),source.indexOf('\nfunction saveCampaign('));
function harness(){
 let now=1000;
 const nodes={modal:{open:true,contains:el=>!!el?.insideModal,showModal(){this.open=true;},close(){this.open=false;}},'modal-body':{innerHTML:'',insertAdjacentHTML(){}},'modal-title':{},'modal-error':{},'modal-submit':{},'modal-cancel':{},'modal-form':{}};
 const context={$:id=>nodes[id],Date:{now:()=>now},modalGeneration:0,modalRevision:0,inputRounding:[],state:{revision:1},store:{editable:true},normaliseFields(){},roundingFootnote:()=>'',optionalRuleFootnote:()=>''};
 const api=runInNewContext(modalSource+'\n({captureModalClick,closeModal,modal,resetModalPointerGesture});',context);
 const click=({id='background-increment',detail=1,x=100,y=200,pointerId=1,button=0,insideModal=false}={})=>{
  const target={id,insideModal};target.closest=()=>target;
  return {target,detail,clientX:x,clientY:y,pointerId,button,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
 };
 const dismiss=(id='modal-submit')=>{nodes.modal.open=true;const e=click({id,insideModal:true});assert.equal(api.captureModalClick(e),false);api.closeModal();now+=20;};
 return {api,nodes,click,dismiss,advance:ms=>{now+=ms;}};
}

test('same-point follow-up pointer clicks after Submit, Cancel and Close cannot reach the underlying page',()=>{
 for(const id of ['modal-submit','modal-cancel','modal-close']){
  const h=harness();h.dismiss(id);
  for(const detail of [2,3]){const e=h.click({detail});assert.equal(h.api.captureModalClick(e),true,id+' blocks click '+detail);assert.equal(e.prevented,true);assert.equal(e.stopped,true);}
 }
});

test('fresh single clicks and their normal double-click increments remain available immediately',()=>{
 const h=harness();h.dismiss();
 for(const detail of [1,2,3]){const e=h.click({detail});assert.equal(h.api.captureModalClick(e),false);assert.equal(e.prevented,false);assert.equal(e.stopped,false);}
 const ordinary=harness();ordinary.nodes.modal.open=false;
 for(const detail of [1,2,3])assert.equal(ordinary.api.captureModalClick(ordinary.click({detail})),false);
});

test('keyboard actions and replacement dialogs reset the narrow pointer guard',()=>{
 const h=harness();h.dismiss();const keyboard=h.click({detail:0});assert.equal(h.api.captureModalClick(keyboard),false);assert.equal(h.api.captureModalClick(h.click({detail:2})),false);
 h.dismiss();h.api.resetModalPointerGesture();assert.equal(h.api.captureModalClick(h.click({detail:2})),false,'Escape/keydown clears gesture history');
 h.dismiss();h.api.modal('New independent dialog','<p>Review</p>',null);assert.equal(h.api.captureModalClick(h.click({id:'modal-submit',insideModal:true,detail:2})),false,'A new dialog receives normal clicks');
});

test('different points, pointers, buttons, expired sequences and non-dismissal controls are not suppressed',()=>{
 for(const change of [{x:110},{y:210},{pointerId:2},{button:1}]){const h=harness();h.dismiss();assert.equal(h.api.captureModalClick(h.click({detail:2,...change})),false);}
 const expired=harness();expired.dismiss();expired.advance(751);assert.equal(expired.api.captureModalClick(expired.click({detail:2})),false);
 const delayed=harness();delayed.api.captureModalClick(delayed.click({id:'modal-submit',insideModal:true}));delayed.advance(751);delayed.api.closeModal();assert.equal(delayed.api.captureModalClick(delayed.click({detail:2})),false,'A slow completed request does not arm an unrelated gesture');
 const ordinary=harness();ordinary.api.captureModalClick(ordinary.click({id:'quantity-step',insideModal:true}));ordinary.api.closeModal();assert.equal(ordinary.api.captureModalClick(ordinary.click({detail:2})),false,'Ordinary modal controls do not arm the dismissal guard');
});

test('guard is capture-phase before application actions and mobile audit tracks can shrink and wrap',async()=>{
 assert.match(source,/document\.addEventListener\('click',captureModalClick,true\);/);
 assert.match(source,/document\.addEventListener\('keydown',resetModalPointerGesture,true\);/);
 assert.ok(source.indexOf("document.addEventListener('click',captureModalClick,true)")<source.indexOf("document.addEventListener('click',safely(async e=>"));
 const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:620px\)\{#modal \.preview dl\{grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)\}#modal \.preview dt,#modal \.preview dd\{min-width:0;overflow-wrap:anywhere\}\}/);
});
