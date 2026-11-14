import {recordedSupportChecks} from './support-roll.mjs';
import {isSupportStage} from './support-record.mjs';
import {crowSpeakingPanel} from './crow-speaking-panel.mjs';
import {showOpeningInformation} from './opening-help.mjs';
// Presentation only. Derive immediate instructions from the existing typed
// decision; retain the original explanation and recorded result in information.
export function supportInstruction(state){
 if(state.stage==='companion-admission')return 'Check admission when your details are ready.';
 if(state.stage==='companion-skill'){
  const e=state.pendingChoice;
  return 'Choose '+(e.count??1)+' distinct skill'+((e.count??1)===1?'':'s')+(e.mode==='increase'?' to increase by '+e.value:' at least level '+e.value)+'.'+(e.requiredLevel!==undefined?' Choose skills currently at level '+e.requiredLevel+'.':'')+(e.existingOnly?' Choose skills you already possess.':'');
 }
 if(state.stage==='psionic-training')return state.psionicCanFinish?'Choose a talent to attempt, or finish training.':'Choose the next talent to attempt.';
 return null;
}
export function mountSupportInformation(document,state,{event=null,sourceLabel=null}={}){
 if(!isSupportStage(state.stage))return;
 const root=document.getElementById('workspace'),instruction=[...root.children].find(n=>n.tagName==='P'&&!n.matches('.step-count,.source,.help,.warning'));
 const source=root.querySelector(':scope>.source'),help=[...root.querySelectorAll(':scope>.help')],result=root.querySelector('#last-action-result');
 const paragraphs=[instruction?.textContent,...help.map(n=>n.textContent),...(result?[result.innerText]:[])].filter(Boolean),sourceText=source?.textContent??(state.pendingChoice?.source&&sourceLabel?sourceLabel(state.pendingChoice.source.id,state.pendingChoice.source.page??state.pendingChoice.source.pages?.[0]):undefined);
 const checks=recordedSupportChecks(event,state),entry=checks.find(c=>c.kind==='admission');
 const name=entry?.success&&event.summary?.match(/^Entered (.+): total -?\d+ against \d+\.$/);
 if(name&&result?.querySelector('h3')){result.querySelector('h3').textContent='Entered '+name[1]+'.';for(const p of result.querySelectorAll(':scope>p'))if(['Education entry succeeded.',entry.label+': '+entry.natural+'.'].includes(p.textContent))p.remove();}
 const check=checks.find(c=>c.kind==='psionic');
 if(check&&result?.querySelector('h3')){
  result.querySelector('h3').textContent=check.talent+(check.success?' acquired'+(Number.isFinite(check.level)?' at level '+check.level:'')+'.':' was not acquired.');
  const duplicate=['Psionic acquisition '+check.talent+': '+check.total+' against '+check.target+'+; '+(check.success?'succeeded.':'failed.'),check.label+': '+check.natural+'.'];
  for(const p of result.querySelectorAll(':scope>p'))if(duplicate.includes(p.textContent))p.remove();
 }
 // Admission review is an unrolled prompt, not a completed check or award.
 if(state.stage==='companion-admission'&&event?.type==='precareer'&&!event.rolls?.length&&!event.changes?.length)result?.remove();
 // The explicit approved terms remain visible; the referee's full note stays
 // verbatim in information. Other results and every recorded roll stay intact.
 const ruling=event?.type==='resolve-book'&&!event.rolls?.length?(event.changes??[]).find(c=>/^psionics\.rulings\.\d+$/.test(c.path)&&c.after?.kind==='psionic-training-terms'&&c.after.approved===true)?.after:null;
 if(state.stage==='psionic-training'&&ruling&&Number.isFinite(ruling.cost)&&['cash','provided'].includes(ruling.funding)&&result?.querySelector('h3')){
  result.querySelector('h3').textContent='Psionic training approved.';
  const cost=document.createElement('p');cost.textContent='Personal cost: Cr'+ruling.cost.toLocaleString('en-US')+' ('+ruling.funding+').';result.append(cost);
 }
 const holder=document.createElement('div');holder.innerHTML=crowSpeakingPanel({message:supportInstruction(state),type:'skills',className:'support-guidance'});const panel=holder.firstElementChild,trigger=document.createElement('button');trigger.type='button';trigger.className='opening-info-trigger';trigger.dataset.supportInformation='';trigger.textContent='i';trigger.setAttribute('aria-label','About this '+(state.stage==='psionic-training'?'psionic training':'education step'));trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','opening-help-dialog');panel.querySelector('blockquote').prepend(trigger);
 if(instruction){instruction.before(panel);instruction.remove();}else root.querySelector('#step-title').after(panel);
 source?.remove();help.forEach(n=>n.remove());
 if(state.stage==='psionic-training')for(const option of state.psionicOptions){const button=[...root.querySelectorAll('[data-action="learn-talent"]')].find(n=>n.dataset.talent===option.talent),detail=button?.querySelector('small');if(!detail)continue;paragraphs.push(option.talent+': '+detail.textContent);detail.textContent=option.automatic?'Automatic; no roll':'Learning DM '+(option.learningDM>=0?'+':'')+option.learningDM+(option.previousChecks?'; prior −'+option.previousChecks:'');}
 trigger.addEventListener('click',()=>showOpeningInformation(document,{title:state.stage==='psionic-training'?'Psionic training details':'Education details',paragraphs,source:sourceText,crowType:'skills'},trigger));
}
