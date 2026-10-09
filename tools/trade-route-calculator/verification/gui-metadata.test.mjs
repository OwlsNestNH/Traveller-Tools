import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {up,creditStep} from '../js/rounding.mjs';
import * as A from '../js/amounts.mjs';
import * as R from '../js/rules.mjs';
const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=runInNewContext(app.slice(app.indexOf('const money='),app.indexOf('\nconst select='))+'\nfield;', {esc:escape});
const rounding=app.slice(app.indexOf('function roundingFootnote('),app.indexOf('\nfunction roundingPreview('));
function modalHarness(step=1){
 const nodes={modal:{open:false,showModal(){this.open=true;},close(){this.open=false;}},'modal-body':{innerHTML:'',insertAdjacentHTML(_where,html){this.innerHTML+=html;}},'modal-title':{},'modal-error':{},'modal-submit':{},'modal-cancel':{},'modal-form':{querySelectorAll:()=>[]}};
 const context={state:{revision:17,settings:{creditStep:step}},store:{editable:true},inputRounding:[],modalGeneration:0,modalRevision:0,$:id=>nodes[id],esc:escape,creditStep,up,A,optionalRuleFootnote:kind=>'<p>'+kind+' reference</p>'};
 const api=runInNewContext(rounding+'\n'+app.slice(app.indexOf('let activeModal=null;'),app.indexOf('\nfunction saveCampaign('))+'\n({modal,closeModal,normaliseFields});',context);
 return {api,context,nodes};
}
function element(value,round,label='Amount',disabled=false){return {value,disabled,dataset:{round,roundLabel:label}};}

test('explicit units preserve numeric fields when labels and input names change',()=>{
 for(const unit of ['credits','tons'])for(const label of ['Price / ton · Cr','Amount','Valeur <test>','Credits %']){
  const html=field('renamed',label,'10.1','text','min="0.01" max="20" step="any"',unit);
  assert.match(html,/type="number"/);assert.match(html,new RegExp('data-round="'+unit+'"'));
  assert.match(html,/min="0" max="20"/);assert.equal((html.match(/step=/g)||[]).length,1);assert.match(html,/step="1"/);
  assert.ok(html.includes('data-round-label="'+escape(label)+'"'));
 }
 const noMetadata=field('quantity','Credits','0.25');assert.match(noMetadata,/type="text"/);assert.doesNotMatch(noMetadata,/data-round=/);
 assert.throws(()=>field('amount','Amount','1','text','','credit'),/Unknown field rounding unit/);
});

test('metadata normalization preserves upward Cr1/Cr100, tons, refunds, zero, blanks and disabled inputs',()=>{
 for(const [step,values,want]of [[1,['10.1','-10.1','0','100','0.01'],['11','-10','0','100','1']],[100,['10.1','-149','0','100','100.01'],['100','-100','0','100','200']]]){
  const {api,context}=modalHarness(step),fields=values.map(v=>element(v,'credits'));
  fields.push(element('1.01','tons'),element('','credits'),element('10.1','credits','Disabled',true));
  api.normaliseFields({querySelectorAll:()=>fields});
  assert.deepEqual(fields.map(f=>f.value),[...want,'2','','10.1']);
  assert.ok(context.inputRounding.every(x=>x.before!==x.after));
 }
 for(const invalid of ['NaN','Infinity','oops'])assert.throws(()=>modalHarness().api.normaliseFields({querySelectorAll:()=>[element(invalid,'credits')]}));
});

test('fractional legacy claims explicitly opt out while normal quantities still round',()=>{
 const fractional=field('quantity','Lost insured tons','0.25','text','data-round-exempt',null);
 assert.match(fractional,/type="text"/);assert.doesNotMatch(fractional,/data-round=/);
 assert.match(field('anything','Lost','1','text','','tons'),/data-round="tons"/);
 assert.match(app,/A\.cmp\(p\.remainingQuantity,up\(p\.remainingQuantity\)\)\?null:'tons'/);
});

test('modal flags survive renamed titles and alone control annotation retention and optional footnotes',()=>{
 const {api,context,nodes}=modalHarness();
 context.inputRounding=[{label:'Amount',before:'10.1',after:'11'}];
 api.modal('Incoming funds review','<p>preview</p>',()=>{},'Commit',true,{retainRounding:true,insurance:true,tax:true});
 assert.equal(context.inputRounding.length,1);assert.match(nodes['modal-body'].innerHTML,/Amount: 10.1 → 11/);
 assert.match(nodes['modal-body'].innerHTML,/insurance reference/);assert.match(nodes['modal-body'].innerHTML,/tax reference/);
 assert.equal(nodes.modal.open,true);assert.equal(context.modalRevision,17);
 api.modal('Confirm cargo insurance','coverage to anywhere',()=>{});
 assert.equal(context.inputRounding.length,0);assert.doesNotMatch(nodes['modal-body'].innerHTML,/insurance reference|tax reference/);
 api.modal('Adjust existing values','Preview with its own note',()=>{},'Apply',true,{annotateRounding:false});
 assert.doesNotMatch(nodes['modal-body'].innerHTML,/rounding-input-note/);
 api.modal('Preview rounding','An ordinary form',()=>{});
 assert.match(nodes['modal-body'].innerHTML,/rounding-input-note/);
 api.closeModal();assert.equal(nodes.modal.open,false);
});

test('unchanged engine examples: Cr101 at 75% becomes Cr76 and a 1% premium on Cr1001 becomes Cr11',async()=>{
 const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url),'utf8'));
 const mp=JSON.parse(await readFile(new URL('../rules/merchant-prince-1e.json',import.meta.url),'utf8'));
 const result=R.salePreview([{id:'lot',commodity:'11',quantity:'1',basis:'1249',description:'Example'}],[{lotId:'lot',quantity:'1',unitPrice:'1500'}],{percent:75,feePercent:10,taxEnabled:false},core,mp);
 assert.equal(result.lines[0].raw,'101');assert.equal(result.lines[0].adjusted,'76');assert.equal(result.lines[0].adjustment,'-25');assert.equal(result.bankDelta,'1325');
 const row=mp.insurance.premiumRows.find(r=>r.premiumPercent.includes(1));
 const q=R.insuranceQuote('1001',mp.insurance.coveragePercent[row.premiumPercent.indexOf(1)],row.distance==='less-than-1'?.5:Number(row.distance),[],mp);
 assert.equal(q.rate,1);assert.equal(q.premium,'11');
});
