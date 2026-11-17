import {educationSubjects,educationSpecialities,educationStudySelectionValid} from './education-skill-view.mjs';
import {educationResultDie} from './education-result-view.mjs';
import {mountCrowSpeakingContent} from './crow-speaking-panel.mjs';

// Presentation only: message arrows never issue commands or modify session state.
function messages(document,panel,detailNodes=[]){
 if(!panel||panel.dataset.pilotMessages)return;
 panel.dataset.pilotMessages='true';
 const words=panel.querySelector('blockquote')??panel;
 const content=[...words.children].filter(n=>n.tagName!=='STRONG'&&!n.classList.contains('crow-assistance'));
 const pages=document.createElement('div');pages.className='pilot-message-pages';
 const first=document.createElement('div');first.className='pilot-message-page';first.append(...content);
 const scope=document.createElement('div');scope.className='pilot-message-page';
 const p=document.createElement('p');p.textContent='Crow Edition Beta 0.1 · Human only. Your pilot save is separate from the original generator. This build includes background skills and University admission and its two subject choices; education events, graduation and careers come later.';
 const link=document.createElement('a');link.href='./index.html';link.textContent='Original Character Generator';scope.append(...(detailNodes.length?detailNodes:[p,link]));pages.append(first,scope);
 const controls=document.createElement('div');controls.className='pilot-message-controls';
 const previous=document.createElement('button'),next=document.createElement('button'),status=document.createElement('span');
 previous.type=next.type='button';previous.textContent='←';next.textContent='→';previous.setAttribute('aria-label','Previous Crow message');next.setAttribute('aria-label','Next Crow message');status.setAttribute('aria-live','polite');
 let index=0;const show=()=>{[first,scope].forEach((page,i)=>{page.style.visibility=i===index?'visible':'hidden';page.inert=i!==index;page.setAttribute('aria-hidden',String(i!==index));});previous.disabled=index===0;next.disabled=index===1;status.textContent='Crow message '+(index+1)+' of 2';};
 previous.onclick=()=>{index=0;show();};next.onclick=()=>{index=1;show();};controls.append(previous,status,next);words.append(pages,controls);show();
}

export function mountCrowEditionPresentation(document,{state,projection,catalog,readOnly=false,onPanelChange}){
 const workspace=document.getElementById('workspace'),dialog=document.getElementById('precareer-dialog');if(!workspace)return;
 if(dialog){
  const resume=document.getElementById('precareer-resume');if(resume&&!resume.dataset.pilotResumeSync){resume.dataset.pilotResumeSync='true';resume.addEventListener('click',()=>queueMicrotask(onPanelChange));}
  if(!dialog.dataset.pilotCloseSync){dialog.dataset.pilotCloseSync='true';dialog.addEventListener('close',onPanelChange);}
  if(dialog._openAdmission&&!dialog._openAdmission.pilotWrapped){const original=dialog._openAdmission;const wrapped=(...args)=>{const result=original(...args);onPanelChange();return result;};wrapped.pilotWrapped=true;dialog._openAdmission=wrapped;}
  const intro=workspace.querySelector('#precareer-standard .precareer-intro');if(intro)mountCrowSpeakingContent(document,intro,{type:'skills'});
  for(const choice of workspace.querySelectorAll('[data-action="precareer"]'))if(choice.dataset.id!=='core.university'){choice.disabled=true;choice.title='Not included in this pilot';}
  for(const selector of ['#precareer-additional','[data-action="skip-precareer"]']){const control=workspace.querySelector(selector);if(control){control.disabled=true;control.title='Not included in this pilot';}}
  const admission=document.getElementById('precareer-admission');
  if(admission&&!admission.hidden&&!admission.querySelector('.admission-roll-details.crow-speaking-panel')){
   admission.dataset.pilotAdmission='true';
   const details=admission.querySelector('.admission-roll-details'),warning=admission.querySelector('.admission-warning');
   if(details&&warning)details.append(warning);
   mountCrowSpeakingContent(document,details,{type:'skills'});
   const roll=admission.querySelector('#precareer-admission-roll'),dice=admission.querySelector('.education-pending-dice');
   if(roll&&dice){roll.prepend(dice);roll.querySelector('span:last-child').textContent='Click to roll · Admission';}
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
 const result=workspace.querySelector('.education-result');
 if(result&&!result.dataset.pilotStudyMounted){
  result.dataset.pilotStudyMounted='true';
  result.querySelector('.education-result-continue')?.remove();
  const study=result.querySelector('.education-result-study');
  if(study){
   const guide=document.createElement('div');guide.className='pilot-study-guidance';
   const heading=study.querySelector('h4');heading.textContent='Choose your university skills';guide.append(heading,study.querySelector(':scope > p'));
   result.prepend(guide);mountCrowSpeakingContent(document,guide,{type:'skills',tone:'success'});
   const detailNodes=[...result.children].filter(node=>node!==guide&&node!==study);
   messages(document,guide,detailNodes);
   // Keep the original command input and validator. One editable dropdown offers
   // complete skill names, including allowed open specialities, without a second field.
   const input=study.querySelector('#education-skill'),subject=study.querySelector('#education-subject');
   const choices=educationSubjects(state).flatMap(o=>Object.hasOwn(catalog.skillSpecialities??{},o.name)?educationSpecialities(state,catalog,o.name):[o.name]);
   const list=study.querySelector('#education-skills');list.replaceChildren(...choices.map(name=>{const option=document.createElement('option');option.value=name;return option;}));
   const oldLabel=study.querySelector('#education-speciality-label');oldLabel.hidden=false;oldLabel.firstChild.textContent='Skill and specialisation';
   const subjectLabel=subject.closest('label');subjectLabel.hidden=true;
   study.querySelector('#education-speciality-help').hidden=true;
   input.placeholder='Choose or type a skill and specialisation';
   const help=document.createElement('p');help.className='help';help.textContent='Choose a listed skill. Cascading subjects include their specialisation, including the first subject retained for graduation. Open specialities may be typed where the existing rules allow them.';oldLabel.after(help);
   const sync=()=>{subject.value=input.value.split(' (')[0];const button=study.querySelector('[data-action="education-skill"]');button.disabled=!educationStudySelectionValid(state,catalog,input.value);};
   input.addEventListener('input',()=>{sync();onPanelChange();});sync();
   workspace.querySelector('.precareer-information-rows')?.remove();
   const title=document.getElementById('step-title');if(title)title.hidden=true;
  }else if(!result.querySelector('.pilot-admission-boundary')){
   const p=document.createElement('p');p.className='pilot-admission-boundary';p.textContent='Admission recorded. This pilot stops here after a failed admission. Your attempt and dice are retained; Back is read-only.';result.append(p);
  }
 }

 for(const panel of workspace.querySelectorAll('#crow-introduction,.crow-speaking-panel'))if(!panel.closest('[hidden],dialog:not([open])')&&!panel.closest('.pilot-message-page'))messages(document,panel);
 // Keep guidance usable in a read-only review, without enabling any game controls.
 if(readOnly)for(const button of workspace.querySelectorAll('.pilot-message-controls button'))button.disabled=true;
}


// Animate existing pending dice, then display only the accepted engine result.
// The caller persists first and keeps the action lock held throughout.
export async function animateCrowAdmission(document,model){
 const button=document.getElementById('precareer-admission-roll'),dice=button?.querySelector('.education-pending-dice');
 if(!dice||!model?.dice?.every(n=>Number.isInteger(n)&&n>=1&&n<=6)||model.dice.length!==2)return;
 const reduced=document.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
 dice.dataset.phase='rolling';dice.classList.add('pilot-dice-rolling');
 await new Promise(resolve=>setTimeout(resolve,reduced?0:650));
 if(!dice.isConnected)return;
 dice.classList.remove('pilot-dice-rolling');dice.dataset.phase='accepted';dice.dataset.recordedDice=model.dice.join(',');
 dice.innerHTML=model.dice.map(educationResultDie).join('');dice.setAttribute('role','img');dice.setAttribute('aria-label','Accepted admission dice: '+model.dice.join(', '));
 button.querySelector('span:last-child').textContent='Recorded: '+model.dice.join(' + ')+' · '+(model.outcome==='failure'?'Not admitted':'Admitted');
 await new Promise(resolve=>setTimeout(resolve,reduced?300:900));
}
