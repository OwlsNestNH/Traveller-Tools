import {crowSpeakingPanel} from './crow-speaking-panel.mjs';
import {showOpeningInformation} from './opening-help.mjs';
const credits=n=>'Cr'+n.toLocaleString('en-US');
export function psionicTrainingTile(state){
 return '<div class="career-choice-row"><button type="button" class="opening-info-trigger career-info-trigger" data-action="psionic-training-info" aria-label="About Psi Training" aria-haspopup="dialog"><span aria-hidden="true">i</span></button><button type="button" class="choice" aria-label="Psi Training" data-action="begin-psionic-training" '+(state.canStartPsionicTraining?'':'disabled')+'><span><strong>Psi Training</strong><small>CORE · p. 228</small></span></button></div>';
}
export function showPsionicTrainingAccess(document,trigger){
 showOpeningInformation(document,{title:'Psi Training',crowType:'skills',source:'Core Rulebook Update 2022, p. 228. Access option: campaign ruling.',paragraphs:['A qualifying event or the specific GM house option permits this separate course. A known PSI score or general GM mode alone does not unlock it.','Complete PSI testing first: positive PSI is required. Training becomes available between careers, after resolving mandatory choices. Completed initial training cannot be purchased again for free talent retries.','The course costs Cr100,000 and takes four months. Choose payment and any approved credit before starting. This is training, not a career; it does not automatically enrol you as a Psion.']},trigger);
}
export const isPsionicCourse=state=>state.pending?.kind==='psionic-training-terms'&&!state.pending.testingNeeded;
export function psionicCourseView(state){
 return '<button type="button" id="psionic-course-reopen">Review psionic training</button><dialog id="psionic-course-dialog" class="psionic-course-dialog" aria-labelledby="psionic-course-title"><p class="eyebrow">PSIONIC TRAINING</p><h2 id="psionic-course-title">Train your potential</h2>'+crowSpeakingPanel({message:'Four months. One expensive education. Choose how to pay before you start.',type:'skills'})+'<button type="button" id="psionic-course-info" class="opening-info-trigger" aria-label="About psionic training">i</button><p class="psionic-course-price"><strong>Cr100,000</strong> · 4 months</p><label>Payment<select id="psionic-course-funding"><option value="cash">Pay cash</option><option value="finance-training">Use cash and borrow the rest</option><option value="provided">Provided at no personal cost</option></select></label><p id="psionic-course-quote" aria-live="polite"></p><label class="check"><input type="checkbox" id="psionic-course-access"><span>Teacher access and four-month timing confirmed</span></label><label class="check" id="psionic-course-credit" hidden><input type="checkbox" id="psionic-course-debt"><span>I accept the added debt</span></label><label>Teacher / arrangement<input id="psionic-course-note" maxlength="500" placeholder="Institute or referee-approved arrangement"></label><p id="psionic-course-feedback" role="status" hidden></p><div class="actions"><button type="button" id="psionic-course-accept">Start training</button><button type="button" id="psionic-course-decline" class="quiet">Not now</button><button type="button" id="psionic-course-close" class="quiet">Cancel</button></div></dialog>';
}
export function mountPsionicCourse(document,state,{send,getError}){
 const dialog=document.getElementById('psionic-course-dialog');if(!dialog)return;
 const title=document.getElementById('step-title');if(title)title.textContent='Psionic training';
 const previous=document.getElementById('last-action-result');if(previous)previous.hidden=true;
 const step=document.querySelector('#workspace .step-count');if(step)step.textContent='PSIONIC TRAINING';
 const q=id=>dialog.querySelector('#psionic-course-'+id),cash=state.character.cash;let saving=false;
 dialog.querySelector('.crow-speaking-panel blockquote').append(q('feedback'));
 const fail=(message,field)=>{q('feedback').textContent=message;q('feedback').hidden=false;if(field)q(field).focus();};
 function sync(){const funding=q('funding').value,financed=funding==='finance-training',provided=funding==='provided',paid=provided?0:Math.min(cash,100000),debt=financed?100000-paid:0;
  q('credit').hidden=!financed;q('debt').checked=false;q('feedback').hidden=true;
  q('quote').textContent=provided?'No cash spent. No debt added.':funding==='cash'&&cash<100000?'Available '+credits(cash)+'. Choose credit or a provided course.':'Cash paid '+credits(paid)+' · Debt added '+credits(debt);
  q('accept').disabled=funding==='cash'&&cash<100000;
 }
 async function record(approved){if(saving)return;const funding=q('funding').value,note=q('note').value.trim();
  if(approved&&!q('access').checked)return fail('Confirm teacher access and timing.','access');
  if(approved&&!note)return fail('Name the teacher or training arrangement.','note');
  if(approved&&funding==='finance-training'&&!q('debt').checked)return fail('Accept the displayed debt before starting.','debt');
  saving=true;try{if(!await send('resolve-book',{confirmed:true,psionicApproved:approved,psionicFunding:funding,psionicCost:funding==='provided'?0:100000,psionicDebtConfirmed:q('debt').checked,psionicTimingConfirmed:q('access').checked,note:note||'Deferred institute training; no course accepted.'}))fail(getError());}finally{saving=false;}
 }
 dialog.addEventListener('input',()=>{q('feedback').hidden=true;});
 q('funding').addEventListener('change',sync);q('accept').addEventListener('click',()=>record(true));q('decline').addEventListener('click',()=>record(false));
 q('close').addEventListener('click',()=>{if(!saving)dialog.close();});dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
 document.getElementById('psionic-course-reopen').addEventListener('click',()=>dialog.showModal());
 q('info').addEventListener('click',()=>showOpeningInformation(document,{title:'Psionic training',crowType:'skills',source:'Core Rulebook Update 2022, p. 228. Credit: campaign financing policy.',paragraphs:['Testing and training are separate. This course uses your recorded positive PSI, costs Cr100,000 and takes four months. It does not enrol you in the Psion career or count as a four-year career term.','Choose talents during training. First-choice Telepathy is automatic; other talents use the printed acquisition checks and previous-check penalties. Acquired talents begin at level 0.','Credit spends available cash first and records the remaining course price as debt. This financing option is a campaign policy, not a credit entitlement printed in the institute rules. No interest is added.','Provided training needs an identified provider. Confirm where the four months fit in your life path. Cancel closes this window; Not now declines the course without a charge.']},q('info')));
 sync();dialog.showModal();
}
