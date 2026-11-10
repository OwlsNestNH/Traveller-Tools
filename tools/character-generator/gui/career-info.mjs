// Read-only career help uses the same projected assignments as career selection.
export function careerInfoButton(career,{esc}){
 const label='Specialties for '+career.name;
 return '<button type="button" class="opening-info-trigger career-info-trigger" data-career-info="'+esc(career.id)+'" aria-label="'+esc(label)+'" aria-haspopup="dialog" aria-controls="career-info-dialog" title="'+esc(label)+'"><span aria-hidden="true">i</span></button>';
}
export function mountCareerInfo(document,getCareer,sourceLabel){
 const dialog=document.createElement('dialog');dialog.id='career-info-dialog';dialog.className='opening-help-dialog career-info-dialog';dialog.setAttribute('aria-labelledby','career-info-title');dialog.innerHTML='<div class="opening-help-heading"><h2 id="career-info-title" tabindex="-1"></h2><button type="button" class="quiet" data-career-info-close>Close</button></div><p>Specialties (assignments)</p><ul id="career-info-specialties"></ul><p id="career-info-availability" class="help" hidden></p><p id="career-info-source" class="tiny source"></p>';document.body.append(dialog);let opener=null;
 const close=()=>{dialog.close();if(opener?.isConnected)opener.focus();};
 dialog.querySelector('[data-career-info-close]').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('keydown',event=>{if(event.key==='Tab'&&!event.altKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();dialog.querySelector('button').focus();}});
 document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-career-info]');if(!trigger)return;event.preventDefault();event.stopPropagation();if(dialog.open)return;
  const career=getCareer(trigger.dataset.careerInfo);if(!career)return;opener=trigger;
  dialog.querySelector('#career-info-title').textContent=career.name;
  dialog.querySelector('#career-info-specialties').replaceChildren(...career.assignments.map(assignment=>{const li=document.createElement('li');li.textContent=assignment.name+(assignment.disabled?' (unavailable)'+(assignment.reason?': '+assignment.reason:''):'');return li;}));
  const availability=dialog.querySelector('#career-info-availability');availability.hidden=!career.reason;availability.textContent=career.reason??'';
  dialog.querySelector('#career-info-source').textContent=sourceLabel(career.source,career.page);
  dialog.showModal();dialog.querySelector('h2').focus();
 });
}
