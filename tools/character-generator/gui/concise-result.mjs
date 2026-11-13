import {crowSpeakingPanel} from './crow-speaking-panel.mjs';
import {eventResultDetails} from './event-result-view.mjs';
// Presentation only. The full result and immutable action log remain available.
import {rollResult,characterEffectDetails,modifierEffectDetails,pendingEffectDetails} from './roll-result-view.mjs';
import {survivalResult} from './survival-result.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const unique=values=>[...new Set(values.filter(Boolean))];
const amount=n=>'Cr'+n.toLocaleString('en-US');
const label=id=>String(id??'').replaceAll('-',' ');
export function isBasicTrainingChoice(state){
 return state?.stage==='effect-choice'&&state.pendingChoice?.options?.length>0&&(state.pendingChoice.basicTraining===true||state.pendingChoice.options.every(option=>/^Basic-training option \d+$/.test(option.label)));
}
function diceDetails(event){
 return (event.rolls??[]).filter(roll=>finite(roll.total)).map(roll=>roll.label+': ['+(roll.values??[]).join(', ')+']'+(roll.kept&&JSON.stringify(roll.kept)!==JSON.stringify(roll.values)?' → keep ['+roll.kept.join(', ')+']':'')+' = '+roll.total+'.');
}
function otherEffects(event,catalog,keep){
 return [...characterEffectDetails({...event,changes:(event.changes??[]).filter(keep)},catalog),...modifierEffectDetails(event.modifierChanges?{modifiers:event.modifierChanges.before}:null,{modifiers:event.modifierChanges?.after},catalog),...pendingEffectDetails(event,catalog)];
}
export function conciseResult(event,state,catalog){
 const full=rollResult(event,state,catalog);if(!full)return null;
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
export function latestResultView(result,{esc,tagline=null}){
 if(!result)return '';
 const paragraphs=details=>details.map(detail=>'<p>'+esc(detail)+'</p>').join('');
 return '<section id="last-action-result" class="result-panel result-'+result.status+'" data-result-status="'+result.status+'" aria-label="Latest result"><p class="result-status">'+({success:'Success',failure:'Failure',pending:'Pending resolution',info:'Information'}[result.status]??'Information')+'</p><h3>'+esc(result.title)+'</h3>'+paragraphs(result.details)+(tagline&&result.status!=='error'?crowSpeakingPanel({message:tagline,tone:result.status==='success'?'success':result.status==='failure'?'failure':'information',className:'outcome-tagline'}):'')+(result.compact?'<details class="result-information"><summary><span aria-hidden="true">ⓘ</span> Result details</summary><h4>'+esc(result.full.title)+'</h4>'+paragraphs(result.full.details)+'</details>':'')+'</section>';
}
