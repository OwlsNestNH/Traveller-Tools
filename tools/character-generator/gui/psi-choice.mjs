// PSI interaction is separate from optional-stat information and from training.
export function psiCard(state,{esc,infoButton},location='sheet'){
 const known=Object.hasOwn(state.character.stats,'PSI'),score=known?state.character.stats.PSI:'Untested';
 return '<div class="stat stat-extra stat-psi'+(known?'':' stat-pending')+'"'+(location==='optional'?' data-optional-stat="PSI"':'')+'><div class="stat-psi-heading"><span class="code">PSI</span>'+infoButton('extras')+'</div><button type="button" id="psi-choice-'+location+'" data-psi-choice class="stat-psi-score" aria-label="PSI '+esc(score)+': testing and GM options" aria-haspopup="dialog" aria-controls="psi-choice-dialog"><strong>'+esc(score)+'</strong><span>Psionic strength</span><span>'+(known?'View options':'Testing options')+'</span></button></div>';
}
export function mountPsiChoice({document,getProjection,canOpen,onTest,onTraining,onEdit,getError}){
 const dialog=document.createElement('dialog');dialog.id='psi-choice-dialog';dialog.className='statistic-editor';dialog.setAttribute('aria-labelledby','psi-choice-title');
 dialog.innerHTML='<h2 id="psi-choice-title">Psionic strength</h2><p id="psi-choice-status"></p><p class="help">Core testing takes two weeks and usually costs at least Cr5,000. Training is separate: four months and Cr100,000. Testing grants no talents or automatic career entry.</p><div id="psi-choice-actions" class="actions"><button type="button" id="psi-choice-edit">Enter PSI score (GM)</button><button type="button" id="psi-choice-test">Arrange testing</button><button type="button" id="psi-choice-training">Arrange training</button></div><p id="psi-choice-availability" class="help"></p><form id="psi-testing-form" hidden><h3>Core institute testing</h3><label class="check"><input type="checkbox" id="psi-testing-access" required><span>The referee confirms access to an institute or teacher.</span></label><label class="check"><input type="checkbox" id="psi-testing-timing" required><span>The two-week testing period fits the character chronology.</span></label><label>Testing funding<select id="psi-testing-funding"><option value="cash">Pay cash (minimum Cr5,000)</option><option value="provided">Source-provided testing</option></select></label><label>Testing cost (Cr)<input id="psi-testing-cost" type="number" min="5000" max="10000000" step="1" required value="5000"></label><label id="psi-testing-provider-label" class="check" hidden><input id="psi-testing-provider" type="checkbox"><span>The referee confirms testing is provided without personal cost.</span></label><label>Access and timing notes<input id="psi-testing-reason" maxlength="500" required placeholder="Identify the teacher and source arrangement"></label><p class="help">Roll 2D minus completed career terms, minimum PSI 0. No debt or training is added.</p><div class="actions"><button type="submit" id="psi-testing-confirm">Pay and test PSI</button><button type="button" id="psi-testing-back" class="quiet">Back</button></div></form><p id="psi-choice-error" role="alert" hidden></p><div class="actions"><button type="button" id="psi-choice-close" class="quiet">Close</button></div>';document.body.append(dialog);
 const q=id=>dialog.querySelector('#'+id);let triggerId=null,revision=null,saving=false;
 function close(){if(saving)return;dialog.close();document.getElementById(triggerId)?.focus({preventScroll:true});}
 function syncFunding(){const provided=q('psi-testing-funding').value==='provided',cost=q('psi-testing-cost');cost.value=provided?'0':'5000';cost.min=provided?'0':'5000';cost.readOnly=provided;q('psi-testing-provider-label').hidden=!provided;q('psi-testing-provider').required=provided;q('psi-testing-confirm').textContent=provided?'Record provided testing':'Pay and test PSI';}
 function error(message){q('psi-choice-error').textContent=message;q('psi-choice-error').hidden=false;}
 q('psi-choice-close').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 q('psi-choice-edit').addEventListener('click',()=>{if(!canOpen())return;close();onEdit(document.getElementById(triggerId));});
 q('psi-choice-test').addEventListener('click',()=>{q('psi-choice-actions').hidden=true;q('psi-testing-form').hidden=false;q('psi-testing-access').focus();});
 q('psi-testing-back').addEventListener('click',()=>{q('psi-testing-form').hidden=true;q('psi-choice-actions').hidden=false;q('psi-choice-test').focus();});
 q('psi-testing-funding').addEventListener('change',syncFunding);
 q('psi-choice-training').addEventListener('click',async()=>{if(!canOpen()||saving)return;saving=true;try{if(await onTraining()){saving=false;close();}else error(getError());}finally{saving=false;}});
 q('psi-testing-form').addEventListener('submit',async event=>{
  event.preventDefault();if(saving||!canOpen()||!event.target.reportValidity())return;
  if(getProjection().revision!==revision){error('The character changed. Close and reopen PSI options.');return;}
  const reason=q('psi-testing-reason').value.trim();if(!reason){error('Record the access and timing arrangement.');return;}
  saving=true;
  try{const ok=await onTest({accessConfirmed:q('psi-testing-access').checked,timingConfirmed:q('psi-testing-timing').checked,funding:q('psi-testing-funding').value,cost:Number(q('psi-testing-cost').value),providedConfirmed:q('psi-testing-provider').checked,reason});if(ok){saving=false;close();}else error(getError());}finally{saving=false;}
 });
 document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-psi-choice]');if(!trigger||dialog.open||!canOpen())return;
  event.preventDefault();const p=getProjection(),s=p.state,known=Object.hasOwn(s.character.stats,'PSI');triggerId=trigger.id;revision=p.revision;
  q('psi-choice-status').textContent=known?'Current PSI: '+s.character.stats.PSI+'. This score is retained, not rerolled.':'PSI is untested. A valid event or confirmed institute test is needed unless the GM enters a score.';
  q('psi-choice-edit').hidden=!s.config.gm||!!s.character.psionicLoss;q('psi-choice-edit').textContent=known?'Change PSI score (GM)':'Enter PSI score (GM)';
  q('psi-choice-test').hidden=known;q('psi-choice-test').disabled=!s.psionicTestingOptions?.available;
  q('psi-choice-training').hidden=!known||!s.canStartPsionicTraining;
  q('psi-choice-availability').textContent=s.psionicTestingOptions?.reason??'Testing is available at a quiet between-careers checkpoint after background skills. Event testing follows the event controls.';
  q('psi-choice-actions').hidden=false;q('psi-testing-form').hidden=true;q('psi-testing-form').reset();syncFunding();q('psi-choice-error').hidden=true;
  dialog.showModal();q('psi-choice-close').focus();
 });
}

