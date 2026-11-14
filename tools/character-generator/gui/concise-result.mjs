import {crowSpeakingPanel} from './crow-speaking-panel.mjs';
import {showOpeningInformation} from './opening-help.mjs';
import {eventResultDetails} from './event-result-view.mjs';
// Presentation only. The full result and immutable action log remain available.
import {rollResult,characterEffectDetails,modifierEffectDetails,pendingEffectDetails} from './roll-result-view.mjs';
import {survivalResult} from './survival-result.mjs';
import {recordedCoverCheck} from './check-outcome.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const unique=values=>[...new Set(values.filter(Boolean))];
const amount=n=>'Cr'+n.toLocaleString('en-US');
const label=id=>String(id??'').replaceAll('-',' ');
function awardedBenefitCredits(event){
 const records=new Map();
 for(const c of event.changes??[]){
  const match=c.path.match(/^benefitCredits\.(\d+)(?:\.(\w+))?$/);
  if(!match||c.before!=null)continue;
  const record=records.get(match[1])??{};
  if(match[2])record[match[2]]=c.after;else Object.assign(record,c.after);
  records.set(match[1],record);
 }
 return [...records.values()].filter(c=>c.status==='available'&&finite(c.value)&&['any','career'].includes(c.scope));
}
export function isBasicTrainingChoice(state){
 return state?.stage==='effect-choice'&&state.pendingChoice?.options?.length>0&&(state.pendingChoice.basicTraining===true||state.pendingChoice.options.every(option=>/^Basic-training option \d+$/.test(option.label)));
}
function diceDetails(event){
 return (event.rolls??[]).filter(roll=>finite(roll.total)).map(roll=>roll.label+': ['+(roll.values??[]).join(', ')+']'+(roll.kept&&JSON.stringify(roll.kept)!==JSON.stringify(roll.values)?' → keep ['+roll.kept.join(', ')+']':'')+' = '+roll.total+'.');
}
function otherEffects(event,catalog,keep){
 return [...characterEffectDetails({...event,changes:(event.changes??[]).filter(keep)},catalog),...modifierEffectDetails(event.modifierChanges?{modifiers:event.modifierChanges.before}:null,{modifiers:event.modifierChanges?.after},catalog),...pendingEffectDetails(event,catalog)];
}
export function conciseResult(event,state,catalog,{recordedDiceVisible=false}={}){
 const full=rollResult(event,state,catalog);if(!full)return null;
 const cover=recordedCoverCheck(event);
 if(cover&&!['deceased','finish','retirement'].includes(state?.stage)){
  const title='Undercover Deception check '+(cover.success?'succeeded.':'failed.'),details=['Total '+cover.total+' against '+cover.target+'+.',state?.stage==='borrowed-event-roll'?'Roll the pending '+state.pendingBorrowedRoll.label+' before continuing.':state?.stage==='cross-career-training'?'Choose an offered training table below.':'Follow the offered next step.'];
  return {title,details,status:cover.success?'success':'failure',text:[title,...details].join(' '),full,compact:true,information:{title:'About your undercover result',label:'About your undercover result',paragraphs:unique([title,...details,full.title,...full.details]),contextual:true}};
 }
 if(event?.type==='fallback'&&state?.pending?.kind==='vargr-draft'&&event.rolls?.some(r=>r.label==='Vargr draft')){const title='Draft result: '+state.pending.vargrDraft.label+'.',details=['The die is recorded. Confirm a source/referee mapping before entering a career.'];return {title,details,status:'pending',text:[title,...details].join(' '),full,compact:true};}
 if(event?.type==='fallback'&&state?.stage==='vargr-fallback-choice'){const career=catalog.careers.find(c=>c.id===state.pendingVargrFallback?.careerId),title=(career?.name??'Fallback')+' selected.',details=['Choose a specialty; no new qualification roll is needed.'];return {title,details,status:'info',text:[title,...details].join(' '),full,compact:true};}
 // Project awarded credits from the recorded changes; never rewrite replay-verified summaries.
 const credits=awardedBenefitCredits(event);
 if(credits.length){
  const merchant=(event.eventResults??[]).find(r=>r.table==='core.merchant.events'&&r.row===10);
  const title=merchant?'A profitable deal lets you live well for a few years.':'Benefit roll bonus saved.';
  const details=unique([
   ...credits.map(c=>(c.value>=0?'+':'')+c.value+' to one future Benefit roll'+(c.scope==='career'?' from this career'+(catalog?.careers?.find(career=>career.id===c.originCareerId)?.name?' ('+catalog.careers.find(career=>career.id===c.originCareerId).name+')':''):' from any career')+'.'),
   'The bonus is saved. Select it under “Bonuses for this roll” when rolling benefits. It is neither money nor an extra roll.',
   ...(state?.stage==='advancement'?['Continue with Advancement below.']:[]),
   ...(merchant?otherEffects(event,catalog,c=>!/^benefitCredits\./.test(c.path)):full.details.filter(line=>!line.startsWith('Benefit credit')).map(line=>line.replaceAll('Resolve benefit credit.','Benefit roll bonus saved.'))),
   ...(merchant?['Merchant event 10 · Core Rulebook Update 2022 p. 35.',...diceDetails(event)]:[])
  ]);
  if(merchant){
   const mainDetails=[...credits.map(c=>(c.value>=0?'+':'')+c.value+' to one future Benefit roll.'),...otherEffects(event,catalog,c=>!/^benefitCredits\./.test(c.path))];
   return {title,details:mainDetails,status:full.status,text:[title,...mainDetails].join(' '),full,compact:true,information:{title:'Your Benefit roll bonus',paragraphs:unique([...details,...full.details]),crowType:'merchant'}};
  }
  return {title,details,status:full.status,text:[title,...details].join(' '),full,compact:true};
 }
 // A resolved table's alternatives are provenance, not awards. Keep the story
 // and actual changes here; the unchanged complete result belongs in the info.
 if(full.status!=='error'&&!['deceased','finish','retirement'].includes(state?.stage)&&(['career-event','choose-effect','choose-skill'].includes(event?.type)||event?.type==='roll-borrowed-event'&&recordedDiceVisible)&&event.eventResults?.length&&event.eventResults.every(r=>/^(core|aslan|vargr)\./.test(r.table)&&r.table!=='core.pre-career-events')){
  const nested=event.type==='roll-borrowed-event',narratives=unique(event.eventResults.map(r=>r.description)),title=nested?event.eventResults.at(-1)?.description:narratives[0];
  if(typeof title==='string'&&title.trim()){
   // The parent table explains why the nested roll happened, not what just
   // happened. Its complete provenance stays in the information dialog.
   // Pending controls below remain the authority for the next required action.
   const details=nested?unique(otherEffects(event,catalog,()=>true)):unique([...narratives.slice(1),...otherEffects(event,catalog,()=>true),...(state?.stage==='book-step'?['Source resolution is pending; unresolved effects have not been awarded.']:[])]);
   return {title,details,status:full.status,text:[title,...details].join(' '),full,compact:true,information:{title:'About your career event',label:'About your career event',paragraphs:unique([title,full.title,...full.details]),contextual:true,...(nested?{keepGuidance:true,compactDecision:state?.pending?.kind==='core-life-decision'}:{})}};
  }
 }
 if(full.status!=='error'&&state?.stage==='deceased'&&state.character?.deceased===true){const title='This life path ended in death.',injury=state.character.injuries?.findLast(i=>i.deceased&&i.zeroRuling?.survives===false),details=state.character.ironManDeath?['Iron Man: failed Survival was fatal instead of rolling a mishap. Companion Update 2024 p. 13.',...diceDetails(event)]:injury?['Recorded referee injury ruling; this was not automatic death from a failed Survival check or a single zero score.','Referee reason: '+injury.zeroRuling.note]:[];return {title,details,status:'failure',text:[title,...details].join(' '),full,compact:true};}
 if(full.status!=='error'&&state?.stage==='finish'){const title='Recorded character ready for review.',details=['Source-assisted steps remain listed in the record.'];return {title,details,status:'info',text:[title,...details].join(' '),full,compact:true};}
 if(full.status!=='error'&&state?.stage==='retirement'&&state.character?.retirementFromCreation===true){
  const title='Retired from character creation.';let details=[];
  if(event.type==='benefit'){
   const awards=(event.changes??[]).filter(c=>/^benefitAwards\.\d+$/.test(c.path)&&!c.before&&c.after?.definitionId==='aslan.clan-share').map(c=>c.after);
   const quantity=awards.length&&awards.every(a=>Number.isSafeInteger(a.quantity)&&a.quantity>=0)?awards.reduce((sum,a)=>sum+a.quantity,0):null,known=Number.isSafeInteger(quantity);
   const changes=known?(event.changes??[]).filter(c=>!/^clanShareLots\./.test(c.path)&&!(/^benefits\.\d+$|^benefitAwards\.\d+$/.test(c.path)&&c.after?.definitionId==='aslan.clan-share')):event.changes;
   details=unique([...diceDetails(event),...(known?['Clan Shares awarded: '+quantity+'.']:[]),...characterEffectDetails({...event,changes},catalog),...(known&&Number.isSafeInteger(state.clanShareOptions?.balance)?['Unspent Clan Shares: '+state.clanShareOptions.balance+'.']:[])]);
  }
  details=details.filter(detail=>!detail.startsWith('Benefit rolls:'));
  return {title,details,status:'info',text:[title,...details].join(' '),full,compact:true};
 }

 const changes=event.changes??[];let title,details=[];
 if(['acknowledge-education-result','acknowledge-education-event'].includes(event.type)){title='Previous education result acknowledged';details=['Continue preserved that result without rolling dice or granting awards. Follow the next step below; it may offer a separate roll.'];}
 const survival=event.type==='survival'&&state?.stage==='term-end'?survivalResult(event,state):null;
 if(survival?.status==='failure'){
  title=full.title;
  // The term-end prompt already gives age and mandatory departure. Keep the
  // actual check, mishap and consequences here, not duplicate term counters.
  const forcedExit=state.character?.careers?.[state.active]?.forcedExit===true;
  const dice=event.rolls?.find(roll=>roll.label==='Survival');
  details=full.details.filter(detail=>!/^Age:|^Completed terms:|^Career terms:/.test(detail)&&!(forcedExit&&detail==='Must leave this career.')).map(detail=>dice&&detail.startsWith('Check total ')?detail.replace('Check total ','Check ['+dice.values.join(', ')+']: total '):detail);
 }
 if(event.type==='career'){
  const delta=changes.find(change=>/^careerTransitions\.\d+\.status$/.test(change.path)&&['entered','failed'].includes(change.after)&&change.before==null);
  const transition=delta&&state?.character?.careerTransitions?.[Number(delta.path.split('.')[1])];
  if(transition){
   const career=catalog?.careers?.find(c=>c.id===transition.toCareerId),assignment=career?.assignments?.find(a=>a.id===transition.toAssignment);
   title=(transition.status==='entered'?'Entered ':'Did not qualify for ')+(career?.name??label(transition.toCareerId))+(assignment?' / '+assignment.name:'')+'.';
   const check=transition.check;
   const roll=event.rolls?.find(roll=>roll.label==='Qualification');
   details.push(check&&finite(check.total)?'Qualification'+(roll?' ['+roll.values.join(', ')+']':'')+': total '+check.total+' against '+check.target+'+; '+(check.success?'succeeded.':'failed.'):'Automatic entry.');
   details.push(...diceDetails({...event,rolls:event.rolls?.filter(roll=>roll.label!=='Qualification')}),...otherEffects(event,catalog,change=>{
    if(/^careerTransitions\./.test(change.path))return false;
    if(/^careers\.\d+\.(id|assignment)$/.test(change.path))return false;
    if(/^careers\.\d+\./.test(change.path)&&change.before==null&&(change.after===0||change.after===false))return false;
    return true;
   }));
  }
 }
 const bills=changes.filter(change=>/^medicalBills\.\d+$/.test(change.path)&&!change.before&&finite(change.after?.personalCost)).map(change=>change.after);
 if(['injury-treatment','resolve-book'].includes(event.type)&&bills.length){
  title='Injury treatment complete.';
  details=[...diceDetails(event),...otherEffects(event,catalog,change=>!/^injuries\.|^medicalBills\.|^terms$|^careers\.\d+\.terms$/.test(change.path)),...bills.map(bill=>bill.personalCost?'Medical bill: '+amount(bill.personalCost)+' due at the end of character creation.':'No personal medical bill.')];
 }
 const assets=changes.filter(change=>/^assets\.\d+$/.test(change.path)&&!change.before&&change.after?.name).map(change=>change.after);
 if(!title&&!['restore','gm-replay'].includes(event.type)&&assets.length){
  const assetIds=new Set(assets.map(asset=>asset.id).filter(Boolean));
  const linkedBenefit=change=>/^benefits\.\d+$/.test(change.path)&&!change.before&&change.after&&(assetIds.has(change.after.assetId)||!change.after.assetId&&assets.some(asset=>asset.name===change.after.name));
  const traded=changes.filter(change=>/^assets\.\d+$/.test(change.path)&&change.before?.active&&change.after?.active===false);
  title='Received '+assets.map(asset=>asset.name+(finite(asset.quantity)&&asset.quantity!==1?' × '+asset.quantity:'')).join(', ')+'.';
  details=[...diceDetails(event),...traded.map(change=>'Traded in '+change.before.name+'.'),...assets.flatMap(asset=>[
   asset.ownership==='use'?'Use only'+(asset.owner?'; owned by '+asset.owner:'')+'.':asset.owner&&asset.owner!=='Traveller'?'Owned by '+asset.owner+'.':null,
   asset.recallable?'The owner may recall this item.':null,asset.condition?'Condition: '+asset.condition:null,
   finite(asset.mortgagePaidPercent)?'Mortgage '+asset.mortgagePaidPercent+'% paid.':null
  ]),...otherEffects(event,catalog,change=>{
   if(/^assets\.\d+$/.test(change.path)&&(!change.before||traded.includes(change)))return false;
   if(linkedBenefit(change))return false;
   if(/^benefitAwards\.\d+$/.test(change.path)&&change.after?.assetIds?.some(id=>assetIds.has(id)))return false;
   return !/^careers\.\d+\.benefitRolls$/.test(change.path);
  }),
  // Financial restrictions and ongoing benefits are not merely audit detail.
  ...characterEffectDetails({changes:changes.filter(linkedBenefit)},catalog).filter(detail=>!detail.startsWith('Benefit: '))];
 }
 if(!title)return {...full,full,compact:false};
 const basicSkills=details.filter(detail=>/^Skill .*: untrained → 0\.$/.test(detail));
 if(basicSkills.length>1)details=[...details.filter(detail=>!basicSkills.includes(detail)),'Basic training: '+basicSkills.map(detail=>detail.slice(6).replace(': untrained → 0.',' 0')).join(', ')+'.'];
 details=unique([...eventResultDetails(event),...details]);return {title,details,status:full.status,text:[title,...details].join(' '),full,compact:true};
}
export function latestResultView(result,{esc,tagline=null,crowType='generic'}){
 if(!result)return '';
 const paragraphs=details=>details.map(detail=>'<p>'+esc(detail)+'</p>').join('');
 if(result.information)return '<section id="last-action-result" class="result-panel result-'+result.status+' merchant-benefit-result'+(result.information.keepGuidance?' nested-career-result':'')+'" data-result-status="'+result.status+'" aria-label="Latest result">'+(result.information.contextual&&['success','failure'].includes(result.status)?'<p class="result-status">'+(result.status==='success'?'Success':'Failure')+'</p>':'')+'<div class="merchant-benefit-heading"><h3>'+esc(result.title)+'</h3><button type="button" class="opening-info-trigger" data-result-information aria-label="'+esc(result.information.label??'About your Benefit roll bonus')+'" aria-haspopup="dialog" aria-controls="opening-help-dialog"><span aria-hidden="true">i</span></button></div>'+paragraphs(result.details)+'</section>';
 return '<section id="last-action-result" class="result-panel result-'+result.status+'" data-result-status="'+result.status+'" aria-label="Latest result"><p class="result-status">'+({success:'Success',failure:'Failure',pending:'Pending resolution',info:'Information'}[result.status]??'Information')+'</p><h3>'+esc(result.title)+'</h3>'+paragraphs(result.details)+(tagline&&result.status!=='error'?crowSpeakingPanel({message:tagline,type:crowType,tone:result.status==='success'?'success':result.status==='failure'?'failure':'information',className:'outcome-tagline'}):'')+(result.compact?'<details class="result-information"><summary>Result details</summary><h4>'+esc(result.full.title)+'</h4>'+paragraphs(result.full.details)+'</details>':'')+'</section>';
}
export function mountResultInformation(document,result,{crowType='generic',tagline=null}={}){
 const trigger=document.querySelector('[data-result-information]');if(!trigger||!result?.information)return;
 const info=result.information.contextual?{...result.information,crowType,paragraphs:unique([tagline,...result.information.paragraphs])}:result.information;
 trigger.addEventListener('click',()=>showOpeningInformation(document,info,trigger));
 // The existing career popup has already supplied the progression control and recorded dice.
 // Supporting Crow guidance normally belongs in the informational. Nested
 // pending decisions retain their existing pictured next-step instruction.
 const guidance=document.querySelector('#workspace>.career-pilot-guidance');
 if(result.information.keepGuidance){
  guidance?.classList.add('nested-event-guidance');
  if(result.information.compactDecision){const title=document.getElementById('step-title');if(title)title.textContent='Your career event';const decision=document.getElementById('core-life-decision');const heading=decision?.querySelector(':scope > h3');if(heading)heading.textContent='Your decision';decision?.querySelector(':scope > .source')?.remove();}
  // These references duplicate the accepted event's complete informational.
  document.querySelector('#workspace > .army-career-source')?.remove();
 }else guidance?.remove();
 for(const p of document.querySelectorAll('#workspace>p'))if(p.textContent==='Your term events are recorded. Resolve advancement for your assignment.')p.remove();
}
