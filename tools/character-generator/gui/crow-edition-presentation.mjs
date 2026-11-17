import {educationSubjects,educationSpecialities,educationStudySelectionValid} from './education-skill-view.mjs';
import {educationResultDie} from './education-result-view.mjs';
import {mountCrowSpeakingContent} from './crow-speaking-panel.mjs';

// Presentation only: message arrows never issue commands or modify session state.
function messages(document,panel,detailNodes=[]){
 if(!panel||panel.dataset.pilotMessages)return;
 panel.dataset.pilotMessages='true';
 const words=panel.querySelector('blockquote');
 const first=words??document.createElement('blockquote');
 if(!words){first.append(...[...panel.children].filter(n=>n.tagName!=='STRONG'&&!n.classList.contains('crow-assistance')));}
 const second=document.createElement('blockquote'),label=document.createElement('strong');label.textContent='Crow says';second.append(label);
 const p=document.createElement('p');p.textContent='Human pilot · Separate saves. This build stops after the two University subjects. Back reviews accepted choices; it never rerolls.';
 second.append(...(detailNodes.length?detailNodes:[p]));
 const stack=document.createElement('div');stack.className='pilot-message-stack';
 const region=document.createElement('div');region.className='pilot-message-region';region.append(first,second);
 const controls=document.createElement('div');controls.className='pilot-message-controls';
 const previous=document.createElement('button'),next=document.createElement('button'),status=document.createElement('span');
 previous.type=next.type='button';previous.textContent='←';next.textContent='→';previous.setAttribute('aria-label','Previous Crow message');next.setAttribute('aria-label','Next Crow message');status.setAttribute('aria-live','polite');
 let index=0;const show=()=>{[first,second].forEach((page,i)=>{page.style.visibility=i===index?'visible':'hidden';page.inert=i!==index;page.setAttribute('aria-hidden',String(i!==index));});previous.disabled=index===0;next.disabled=index===1;status.textContent='Crow message '+(index+1)+' of 2';};
 previous.onclick=()=>{index=0;show();};next.onclick=()=>{index=1;show();};controls.append(previous,status,next);stack.append(region,controls);panel.append(stack);show();
}

export function mountCrowEditionPresentation(document,{state,projection,catalog,readOnly=false,onPanelChange}){
 const workspace=document.getElementById('workspace'),dialog=document.getElementById('precareer-dialog');if(!workspace)return;
 if(dialog){
  const title=document.getElementById('step-title');if(title)title.hidden=dialog.dataset.panel==='admission'||state.stage!=='precareer';
  const resume=document.getElementById('precareer-resume');if(resume&&!resume.dataset.pilotResumeSync){resume.dataset.pilotResumeSync='true';resume.addEventListener('click',()=>queueMicrotask(onPanelChange));}
  if(!dialog.dataset.pilotCloseSync){dialog.dataset.pilotCloseSync='true';dialog.addEventListener('close',onPanelChange);}
  if(dialog._openAdmission&&!dialog._openAdmission.pilotWrapped){const original=dialog._openAdmission;const wrapped=(...args)=>{const result=original(...args);onPanelChange();return result;};wrapped.pilotWrapped=true;dialog._openAdmission=wrapped;}
  const intro=workspace.querySelector('#precareer-standard .precareer-intro');if(intro){if(intro.textContent!=='Option to attempt a Pre-Career?')intro.textContent='Option to attempt a Pre-Career?';mountCrowSpeakingContent(document,intro,{type:'skills'});}
  for(const choice of workspace.querySelectorAll('[data-action="precareer"]'))if(choice.dataset.id!=='core.university'){choice.disabled=true;choice.title='Not included in this pilot';}
  for(const selector of ['#precareer-additional','[data-action="skip-precareer"]']){const control=workspace.querySelector(selector);if(control){control.disabled=true;control.title='Not included in this pilot';}}
  const admission=document.getElementById('precareer-admission');
  if(admission&&!admission.hidden&&!admission.querySelector('.admission-roll-details.crow-speaking-panel')){
   admission.dataset.pilotAdmission='true';admission.classList.add('education-result');
   admission.querySelector('.admission-heading').className='education-result-heading';admission.querySelector('.education-result-heading p')?.remove();
   const headline=document.createElement('div');headline.className='education-result-headline';headline.innerHTML='<h4>Ready to try?</h4>';admission.querySelector('.education-result-heading').after(headline);
   const details=admission.querySelector('.admission-roll-details'),warning=admission.querySelector('.admission-warning');
   if(details&&warning)details.append(warning);
   mountCrowSpeakingContent(document,details,{type:'skills'});
   const roll=admission.querySelector('#precareer-admission-roll'),dice=admission.querySelector('.education-pending-dice'),preview=projection.educationAdmissionPreviews?.['core.university'];
   if(roll&&dice&&preview){
    dice.remove();roll.classList.add('education-result-roll');
    const blank=educationResultDie(1).replace(/<circle[^>]*\/>/g,'').replace('</svg>','<text x="40" y="54" text-anchor="middle" fill="currentColor" font-size="40">?</text></svg>');
    roll.innerHTML='<span class="education-result-equation"><span class="education-pending-dice">'+blank+'<span aria-hidden="true">+</span>'+blank+'</span><span class="education-result-equation-tail">'+(preview.modifier<0?'− ':'+ ')+Math.abs(preview.modifier)+' = ?</span></span><span class="pilot-roll-caption">Click to roll · Target '+preview.target+'+</span>';
   }
   const back=admission.querySelector('#precareer-admission-back');if(back)back.addEventListener('click',()=>queueMicrotask(onPanelChange));
  }
  for(const control of workspace.querySelectorAll('.precareer-information-rows button')){const title=control.querySelector('strong')?.textContent;if(title)control.textContent=title;}
  const info=document.getElementById('precareer-information');
  if(info)for(const item of info.querySelectorAll('#precareer-information-rules li'))if(!item.querySelector('strong')?.textContent.startsWith('University'))item.remove();
  if(info&&!info.querySelector('.pilot-info-content')){
   info.querySelector('#precareer-information-close').textContent='Close';
   const content=document.createElement('div');content.className='pilot-info-content';
   content.append(...['result','rules','previous'].map(kind=>info.querySelector('#precareer-information-'+kind)));info.append(content);mountCrowSpeakingContent(document,content,{type:'skills'});
  }
 }
 const result=workspace.querySelector('.education-result:not(#precareer-admission)');
 if(result&&!result.dataset.pilotStudyMounted){
  result.dataset.pilotStudyMounted='true';
  result.querySelector('.education-result-continue')?.remove();
  const study=result.querySelector('.education-result-study');
  if(study){
   const guide=result.querySelector('.education-result-tagline');guide.classList.add('pilot-study-guidance');
   const words=guide.querySelector('blockquote'),heading=study.querySelector('h4');heading.textContent='Choose your university skills';words.prepend(heading);words.append(study.querySelector(':scope > p'));
   const detailNodes=[...result.querySelectorAll(':scope > .education-result-details,:scope > .education-result-source')];
   messages(document,guide,detailNodes);
   // Reuse validation and the original command input; a normal select combines
   // subjects and specialties. Open custom subjects replace it in the same slot.
   const input=study.querySelector('#education-skill'),subject=study.querySelector('#education-subject');
   const subjects=educationSubjects(state),choices=subjects.flatMap(o=>Object.hasOwn(catalog.skillSpecialities??{},o.name)?educationSpecialities(state,catalog,o.name):[o.name]);
   const select=document.createElement('select');select.id='pilot-education-choice';select.setAttribute('aria-label','Skill and specialisation');
   const add=(value,text)=>{const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);};
   add('','Choose a skill');choices.forEach(name=>add(name,name));
   for(const o of subjects)if(Object.hasOwn(catalog.skillSpecialities??{},o.name)&&!Array.isArray(o.specialities))add('__custom:'+o.name,o.name+' (custom specialisation…)');
   const label=study.querySelector('#education-speciality-label');label.hidden=false;label.firstChild.textContent='';const selector=document.createElement('span');selector.className='education-study-selector';const icon=subject.closest('.education-study-selector')?.querySelector('svg');if(icon)selector.append(icon);selector.append(select);label.prepend(selector);subject.closest('label').hidden=true;
   study.querySelector('#education-speciality-help').hidden=true;
   const back=document.createElement('button');back.type='button';back.className='pilot-skill-list';back.textContent='Return to skill list';label.after(back);
   const showCustom=custom=>{select.hidden=custom;input.hidden=!custom;back.hidden=!custom;};
   const sync=()=>{subject.value=input.value.split(' (')[0];study.querySelector('[data-action="education-skill"]').disabled=!educationStudySelectionValid(state,catalog,input.value);};
   select.addEventListener('change',()=>{if(select.value.startsWith('__custom:')){input.value=select.value.slice(9)+' (';showCustom(true);input.focus();}else input.value=select.value;sync();onPanelChange();});
   back.onclick=()=>{input.value='';select.value='';showCustom(false);sync();onPanelChange();select.focus();};
   input.addEventListener('input',()=>{sync();onPanelChange();});
   if(choices.includes(input.value))select.value=input.value;showCustom(!!input.value&&!choices.includes(input.value));sync();
   workspace.querySelector('.precareer-information-rows')?.remove();
   const title=document.getElementById('step-title');if(title)title.hidden=true;
  }else if(!result.querySelector('.pilot-admission-boundary')){
   const guide=result.querySelector('.education-result-tagline');if(guide)messages(document,guide,[...result.querySelectorAll(':scope > .education-result-details,:scope > .education-result-source')]);
   workspace.querySelector('.precareer-information-rows')?.remove();
   const p=document.createElement('p');p.className='pilot-admission-boundary';p.textContent='Admission recorded. This pilot stops here after a failed admission. Your attempt and dice are retained; Back is read-only.';result.append(p);
  }
 }

 for(const panel of workspace.querySelectorAll('#crow-introduction,.crow-speaking-panel'))if(!panel.closest('[hidden],dialog:not([open])')&&!panel.closest('.pilot-message-region'))messages(document,panel);
 // Keep guidance usable in a read-only review, without enabling any game controls.
 if(readOnly)for(const button of workspace.querySelectorAll('.pilot-message-controls button'))button.disabled=true;
}


// Animate existing pending dice, then display only the accepted engine result.
// The caller persists first and keeps the action lock held throughout.
export async function animateCrowAdmission(document,model){
 const button=document.getElementById('precareer-admission-roll'),dice=button?.querySelector('.education-pending-dice');
 if(!dice||!model?.dice?.every(n=>Number.isInteger(n)&&n>=1&&n<=6)||model.dice.length!==2)return;
 const reduced=document.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
 dice.dataset.phase='rolling';
 const faces=values=>values.map(educationResultDie).join('<span aria-hidden="true">+</span>');
 // Fixed decorative sequence, never a game roll or RNG call.
 if(!reduced)for(let frame=0;frame<6;frame++){if(!dice.isConnected)return;dice.innerHTML=faces([frame%6+1,(frame+3)%6+1]);await new Promise(resolve=>setTimeout(resolve,100));}
 if(!dice.isConnected)return;
 dice.dataset.phase='accepted';dice.dataset.recordedDice=model.dice.join(',');
 dice.innerHTML=faces(model.dice);dice.setAttribute('role','img');dice.setAttribute('aria-label','Accepted admission dice: '+model.dice.join(', '));
 button.querySelector('.education-result-equation-tail').textContent=(model.modifier<0?'− ':'+ ')+Math.abs(model.modifier)+' = '+model.total;
 button.querySelector('.pilot-roll-caption').textContent='Total '+model.total+' · Target '+model.target+'+ · '+(model.outcome==='failure'?'Not admitted':'Admitted');
 await new Promise(resolve=>setTimeout(resolve,reduced?300:900));
}
