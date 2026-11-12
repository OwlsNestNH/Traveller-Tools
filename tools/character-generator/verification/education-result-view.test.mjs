import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {educationResultView} from '../gui/education-result-view.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const helpers={esc,button:(label,action,cls)=>'<button type="button" data-action="'+action+'" class="'+cls+'">'+label+'</button>',sourceLabel:(id,page)=>id+' p. '+page};
const base={id:'core.university',name:'University',kind:'graduation',outcome:'success',dice:[4,4],modifier:0,total:8,target:6,honoursTarget:10,tagline:'Approved line.',source:{id:'core',page:16},benefits:['Admin +1','EDU +1'],details:[],retained:[],missed:[],years:4,terms:1};
test('ordinary, honours and failure keep their supplied facts inside one grouped outcome panel',()=>{
 for(const outcome of ['success','honours','failure']){
  const model={...base,outcome,...(outcome==='honours'?{dice:[5,5],total:10}:outcome==='failure'?{dice:[2,3],total:5,benefits:[],retained:['Study skills retained'],missed:['No graduation awards']}: {})};
  const view=educationResultView(model,helpers);assert.equal((view.match(/class="education-result-benefits"/g)??[]).length,1);assert.match(view,/data-action="acknowledge-education-result"/);assert.match(view,/4 years completed · 1 education term/);assert.match(view,/core p\. 16/);
  if(outcome==='success')assert.match(view,/You graduated!/);if(outcome==='honours')assert.match(view,/Graduated with honours!/);if(outcome==='failure'){assert.match(view,/You didn’t graduate/);assert.match(view,/You keep/);assert.match(view,/You miss/);assert.doesNotMatch(view,/Admin \+1/);}
 }
});
test('dice artwork and accessible equation show the exact recorded signed arithmetic',()=>{
 const view=educationResultView({...base,dice:[6,3],modifier:-1,total:8},helpers);assert.match(view,/aria-label="6 \+ 3 − 1 = 8"/);assert.equal((view.match(/class="education-result-die"/g)??[]).length,2);assert.match(view,/Total 8 · Target 6\+ · Graduated/);
 const honours=educationResultView({...base,outcome:'honours',dice:[6,6],total:12},helpers);assert.match(honours,/Honours 10\+/);
});
test('study result uses only the supplied study command without adding an acknowledgement or roll',()=>{
 for(const studyStep of [1,2]){
  const view=educationResultView({...base,kind:'admission',study:true,studyStep},{...helpers,studyHtml:'<select id="education-subject"><option value="">Choose</option></select><button data-action="education-skill">Continue</button>'});
  assert.match(view,new RegExp('Level '+(studyStep-1)+' · Skill '+studyStep+' of 2'));assert.match(view,/data-action="education-skill"/);assert.doesNotMatch(view,/acknowledge-education-result|data-action="education-event"|education-result-benefits/);
 }
});
test('no incomplete, source-pending or fabricated dice are rendered as a result',()=>{
 for(const model of [null,{...base,kind:'pending'},{...base,outcome:'pending'},{...base,dice:[]},{...base,dice:[7,1]},{...base,dice:[2,2]},{...base,modifier:undefined},{...base,kind:'admission',outcome:'honours'}])assert.equal(educationResultView(model,helpers),'');
});
test('names, tagline, facts, and source are escaped without modifying the model',()=>{
 const model={...base,name:'<name>',tagline:'<tagline>',benefits:['<benefit>'],details:['<detail>'],source:{id:'<source>',page:'<page>'}};const before=structuredClone(model);const view=educationResultView(model,helpers);assert.doesNotMatch(view,/<name>|<tagline>|<benefit>|<detail>|<source>|<page>/);assert.match(view,/&lt;benefit&gt;/);assert.deepEqual(model,before);assert.equal(educationResultView(model,helpers),view);
});
test('pure presentation imports no engine and has no RNG or persistence operations',()=>{
 const source=readFileSync(new URL('../gui/education-result-view.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/from ['"].*engine|Math\.random|localStorage|crypto\.randomUUID|fetch\(/);
});
test('study selector retains its native accessible control beside decorative cartoon book art',()=>{
 const view=educationResultView({...base,kind:'admission',study:true,studyStep:1},{...helpers,studyHtml:'<label>Study subject<select id="education-subject"><option value="">Choose</option></select></label>'});
 assert.match(view,/class="education-study-selector"/);assert.match(view,/<select id="education-subject">/);assert.match(view,/Study subject/);assert.equal((view.match(/id="education-subject"/g)??[]).length,1);
});
test('mobile honours groups illustrated bonuses while retaining canonical desktop and detail wording',()=>{
 const qualification='Qualification DM +2 in eligible careers.',commission='First-career military commission +2; roll required before term 1.';
 const model={...base,outcome:'honours',dice:[6,6],total:12,benefits:['Admin 0 → 1',qualification,commission],actualAwardChanges:[{path:'skills.Admin'}],honoursBonuses:[{kind:'qualification',modifier:2,text:qualification},{kind:'commission',modifier:2,scope:'military',automatic:false,firstCareer:true,beforeTerm:1,text:commission}]};
 const html=educationResultView(model,helpers);assert.match(html,/Honours bonuses/);assert.match(html,/education-bonus-qualification/);assert.match(html,/education-bonus-commission/);assert.match(html,/Roll required · First career/);assert.match(html,/Before term 1/);assert.ok(html.includes(qualification));assert.ok(html.includes(commission));assert.equal((html.match(/class="education-result-benefits"/g)||[]).length,1);
});
