// Player-facing presentation only. Never alter summaries, audit records or mechanics.
import {survivalResult} from './survival-result.mjs';
import {advancementResult} from './advancement-result.mjs';
import {lifeEventIdentity,lifeEventLogDetails} from './life-event-presentation.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const words=s=>typeof s==='string'?s.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[._-]+/g,' ').trim():'';
const stats={STR:'Strength',DEX:'Dexterity',END:'Endurance',INT:'Intellect',EDU:'Education',SOC:'Social standing',CHA:'Charisma',PSI:'Psionic strength'};
const unique=items=>{const seen=new Set();return items.filter(Boolean).filter(item=>{const key=item.replace(/[.!]$/, '').trim();if(seen.has(key))return false;seen.add(key);return true;});};
const amount=n=>'Cr'+n.toLocaleString('en-US');
const change=(label,before,after)=>label+': '+(before??'none')+' → '+(after??'none')+'.';
const nameOf=(id,catalog)=>catalog?.careers?.find(c=>c.id===id)?.name??words(id);
const scalarLabels={age:'Age',terms:'Completed terms',nonCareerMonths:'Time outside careers (months)',treatmentAgeingTerms:'Treatment ageing terms',birthOrder:'Birth order'};
const flagLabels={qualificationBanned:['Career qualification is barred.','Career qualification ban lifted.'],sentenced:['Prison sentence recorded.','Prison sentence cleared.'],outcast:['Outcast status recorded.','Outcast status removed.'],deceased:['Character has died.','Character is alive.'],psionEntryPermission:['Psion career entry permission granted.','Psion career entry permission removed.'],retirementFromCreation:['Character creation retirement recorded.','Character creation retirement removed.']};
const careerNumbers={rank:'Rank',terms:'Career terms',benefitRolls:'Benefit rolls',parole:'Parole target',pension:'Annual pension'};
const careerFlags={officer:['Commissioned as an officer.','Officer commission removed.'],forcedExit:['Must leave this career.','Required career departure removed.'],forcedStay:['Must stay in this career.','Required extra term removed.'],released:['Released from prison.','Prison release removed.'],pensionStatusReviewRequired:['Pension needs a status review.','Pension status review resolved.']};
const ledgerNames={aslanCareerAccess:'Career access',landClaims:'Land claim',clanShareLots:'Clan Shares',aslanOutlawRestorations:'Outlaw restoration',aslanHistoricalEntries:'Historical career entry',aslanRestorations:'Status restoration',aslanOfficerOffers:'Officer opportunity',careerTransitions:'Career transition',assignmentChanges:'Assignment change',sourceTraining:'Training opportunity',benefitCredits:'Benefit credit',advisoryServices:'Advisory service',benefitWagers:'Benefit wager',crossCareerRoutes:'Cross-career opportunity',prisonerLawyers:'Prison lawyer',merchantFines:'Merchant fine',reeducations:'Re-education'};
function checkText(label,check){
 if(!check||typeof check.success!=='boolean'||(!finite(check.total)&&check.automatic!==true))return null;
 return label+(check.automatic===true?' succeeded automatically.':': '+check.total+(finite(check.target)?' against '+check.target+'+':'')+'; '+(check.success?'succeeded.':'failed.'));
}
function futureEffect(effect){
 if(!effect||typeof effect!=='object')return '';
 if(effect.kind==='relationship')return (finite(effect.count)?effect.count+' ':'')+(effect.role??effect.type??effect.name??'relationship');
 if(effect.kind==='skill')return effect.name+(finite(effect.value)?' '+effect.value:'');
 if(effect.kind==='stat')return (stats[effect.name]??effect.name)+' '+(effect.value>=0?'+':'')+effect.value;
 if(effect.kind==='benefit'||effect.kind==='deferred-benefit')return (effect.dice??effect.value??1)+' '+effect.name;
 if(effect.kind==='note')return effect.text;
 return '';
}
function recordDetails(field,value,before){
 if(typeof value==='string')return [field==='historyNotes'?value:words(field)+': '+value+'.'];
 if(!value||typeof value!=='object')return [];
 switch(field){
  case 'relationships':return [(before?'Relationship updated: ':'Relationship gained: ')+(value.role??'Relationship')+(value.name?' — '+value.name:'')+(value.status?' ('+words(value.status)+')':'')+'.'];
  case 'benefits':return ['Benefit: '+(value.name??'award')+(finite(value.quantity)?' × '+value.quantity:'')+(value.ownership?' ('+(value.ownership==='use'?'use only':words(value.ownership))+')':'')+'.',value.condition?'Benefit condition: '+value.condition+'.':null,finite(value.annualCredits)?'Benefit annual income: '+amount(value.annualCredits)+'.':null,value.redeemableForCash===false?'This benefit cannot be redeemed for cash.':null,value.redemption?'Redemption: '+words(value.redemption)+'.':null];
  case 'assets':return ['Asset: '+(value.name??'award')+(value.ownership?' ('+(value.ownership==='use'?'use only':words(value.ownership))+')':'')+(finite(value.quantity)?' × '+value.quantity:'')+(finite(value.mortgagePaidPercent)?'; mortgage '+value.mortgagePaidPercent+'% paid':'')+'.',value.owner?'Owned by '+value.owner+'.':null,value.recallable===true?'May be recalled by the owner.':null,value.condition? 'Asset condition: '+value.condition+'.':null];
  case 'injuries':return ['Injury'+(finite(value.tableResult)?' result '+value.tableResult:'')+(value.completed?' recorded.':' pending resolution.'),...Object.entries(value.losses??{}).filter(([,n])=>finite(n)&&n>0).map(([key,n])=>'Injury loss: '+(stats[key]??words(key))+' −'+n+'.'),...Object.entries(value.restoration??{}).filter(([,n])=>finite(n)&&n>0).map(([key,n])=>(value.statsAfterTreatment?'Treatment restores ':'Proposed treatment (pending): ')+(stats[key]??words(key))+' +'+n+'.')];
  case 'medicalBills':return [finite(value.personalCost)?'Medical bill: '+amount(value.personalCost)+' owed personally'+(finite(value.coveredCost)?'; '+amount(value.coveredCost)+' covered':'')+'.':null,value.settled?'Medical bill settled'+(finite(value.paid)?': '+amount(value.paid)+' paid':'')+(finite(value.debt)?', '+amount(value.debt)+' debt':'')+'.':null];
  case 'medicalSettlements':return ['Medical settlement recorded'+(finite(value.paid)?': '+amount(value.paid)+' paid':'')+(finite(value.debt)?', '+amount(value.debt)+' debt':'')+'.'];
  case 'futureConditions':return ['Future condition: '+words(value.trigger)+(value.effects?.length?' → '+value.effects.map(futureEffect).filter(Boolean).join(', '):'')+'.'];
  case 'traits':return ['Trait: '+(value.name??value.text??words(value.kind)??'recorded')+'.'];
  case 'annualIncome':return ['Annual income'+(value.name?' ('+value.name+')':'')+': '+(finite(value.amount)?amount(value.amount):finite(value.annualCredits)?amount(value.annualCredits):value.name??'recorded')+(value.condition?' ('+value.condition+')':'')+'.'];
  case 'benefitAwards':return [(value.status==='resolved'?'Benefit award recorded: ':'Benefit award pending: ')+(value.name??(value.definitionId?words(value.definitionId):'award'))+'.'];
  case 'lifeBenefitBonuses':return ['Life event benefit bonus'+(finite(value.value)?' +'+value.value:'')+(value.status?' ('+words(value.status)+')':'')+'.'];
  case 'lifeBenefitLosses':return ['Life event benefit loss recorded.'];
  case 'relationshipLosses':return ['Relationship loss recorded'+(value.role?': '+value.role:'')+'.'];
  case 'statusReviews':return ['Social status review recorded'+(value.elevated===true?': elevated status':'')+'.'];
  case 'careerTransfers':return ['Career transfer '+words(value.status??'recorded')+'.'];
  case 'ageingCrises':return ['Ageing crisis recorded'+(value.resolved?' and resolved':'')+'.'];
  default:return [];
 }
}
export function characterEffectDetails(event,catalog){
 const details=[];
 for(const {path,before,after} of event?.changes??[]){
  if(before===after)continue;
  if(path.startsWith('skills.')&&after==null&&finite(before)){details.push('Skill '+path.slice(7)+': '+before+' → untrained.');continue;}
  if(path.startsWith('skills.')&&finite(after)){details.push(change('Skill '+path.slice(7),finite(before)?before:'untrained',after));continue;}
  if(path.startsWith('stats.')&&finite(after)){details.push(change(stats[path.slice(6)]??words(path.slice(6)),before,after));continue;}
  if(['cash','debt','medicalCosts'].includes(path)&&finite(after)){details.push(change({cash:'Cash',debt:'Debt',medicalCosts:'Medical costs'}[path],finite(before)?amount(before):amount(0),amount(after)));continue;}
  if(scalarLabels[path]&&finite(after)){details.push(change(scalarLabels[path],before,after));continue;}
  if(flagLabels[path]&&typeof after==='boolean'){details.push(flagLabels[path][after?0:1]);continue;}
  if(path==='psionicLoss'&&after?.permanent){details.push('Permanent loss of psionic abilities recorded.');continue;}
  if(path==='lifePsionAccess'&&after){details.push('Life event psionic access recorded.');continue;}
  const career=path.match(/^careers\.\d+\.(\w+)$/);
  if(career){const field=career[1];if(careerNumbers[field]&&finite(after))details.push(change(careerNumbers[field],before,field==='pension'?amount(after):after));
   else if(careerFlags[field]&&typeof after==='boolean')details.push(careerFlags[field][after?0:1]);
   else if(field==='id'&&after)details.push('Career: '+nameOf(after,catalog)+'.');
   else if(field==='assignment'&&after)details.push('Assignment: '+words(after)+'.');
   else if(field==='pensionCondition'&&after)details.push('Pension condition: '+after+'.');
   else if(field==='pensionEntitlement'&&after)details.push(after.needsAdjudication?'Pension entitlement pending source resolution.':finite(after.annualCredits)?'Pension entitlement: '+amount(after.annualCredits)+' annually.':'Pension entitlement recorded.');
   continue;
  }
  const record=path.match(/^([A-Za-z]+)\.(\d+)$/);
  if(record){if(after==null&&before){const label=before.name??before.role??(typeof before==='string'?before:words(record[1]));details.push('Removed: '+label+'.');}else details.push(...recordDetails(record[1],after,before));continue;}
  const ledger=path.match(/^(\w+)\.\d+\.(\w+)$/);
  if(ledger&&ledgerNames[ledger[1]]){const label=ledgerNames[ledger[1]],field=ledger[2];
   if(field==='status'&&typeof after==='string')details.push(label+': '+words(after)+'.');
   else if(ledger[1]==='benefitWagers'&&field==='delta'&&finite(after))details.push('Benefit rolls: '+(after>=0?'+':'')+after+'.');
   else if(['amount','cash'].includes(field)&&finite(after))details.push(label+': '+amount(after)+'.');
   else if(['available','awarded','spent','forfeited','value','quantity','clanShares'].includes(field)&&finite(after))details.push(label+' '+words(field)+': '+after+'.');
   else if(field==='check')details.push(checkText(label,after));
   else if(field==='attempt'&&after?.check)details.push(checkText(label,after.check));
   else if(['socBefore','socAfter'].includes(field)&&finite(after)&&field==='socAfter')details.push('Social standing after '+label.toLowerCase()+': '+after+'.');
   else if(field==='mandatory'&&after===true)details.push(label+' is mandatory.');
   else if(field==='careerIds'&&Array.isArray(after))details.push(label+': '+after.map(id=>nameOf(id,catalog)).join(', ')+'.');
  }
 }
 return unique(details);
}
function rollLabel(roll,catalog){
 const identity=lifeEventIdentity(roll.label?.replace(/ \(.*\)$/,''),roll.total);
 if(identity)return identity.title+'.';
 const label=String(roll.label??'Roll');
 // Preserve natural player-facing labels while resolving catalog IDs in table labels.
 const readable=label.replace(/\b(core|aslan|vargr|zhodani)\.([a-z-]+)/g,id=>nameOf(id,catalog));
 return readable+(/check|survival|advancement|commission|qualification/i.test(label)?' dice total: ':': ')+roll.total+'.';
}
function summaryCheck(summary){
 const match=summary?.match(/^(Survival|Education entry failed|Assignment qualification): (\{.*\})\./);
 if(!match)return null;try{return checkText(match[1]==='Education entry failed'?'Education entry':match[1],JSON.parse(match[2]));}catch{return null;}
}
export function modifierEffectDetails(beforeState,state,catalog){
 if(!beforeState)return [];
 const previous=[...(beforeState.modifiers??[])];
 const targets={advancement:'Advancement',commission:'Commission',survival:'Survival',qualification:'Qualification',benefit:'Benefit',benefits:'Benefits',reenlistment:'Re-enlistment'};
 const describe=(modifier,removed=false)=>{
  if(!targets[modifier.target]||!finite(modifier.value??modifier.dm))return null;
  const n=modifier.value??modifier.dm;
  return targets[modifier.target]+' modifier '+(n>=0?'+':'')+n+(removed?' is no longer available':modifier.scope==='all'?' for all applicable checks':' for the next applicable check')+(modifier.careerId&&!['any','next'].includes(modifier.careerId)?' in '+nameOf(modifier.careerId,catalog):modifier.careerId==='next'?' in the next career':'')+'.';
 };
 const details=[];
 for(const modifier of state?.modifiers??[]){const index=previous.findIndex(m=>JSON.stringify(m)===JSON.stringify(modifier));if(index>=0)previous.splice(index,1);else details.push(describe(modifier));}
 details.push(...previous.map(modifier=>describe(modifier,true)));
 return details.filter(Boolean);
}
export function pendingEffectDetails(event,catalog){
 const delta=event?.pendingEffectChanges;if(!delta)return [];
 const before=delta.before??{},after=delta.after??{},details=[];
 if(before.forcedCareer!==after.forcedCareer){
  if(after.forcedCareer)details.push('Required next career: '+nameOf(after.forcedCareer,catalog)+'.');
  else if(before.forcedCareer)details.push('Required next career '+nameOf(before.forcedCareer,catalog)+' is no longer pending.');
 }
 for(const id of after.automaticCareers??[])if(!(before.automaticCareers??[]).includes(id))details.push('Automatic entry available: '+nameOf(id,catalog)+'.');
 for(const id of before.automaticCareers??[])if(!(after.automaticCareers??[]).includes(id))details.push('Automatic entry right no longer available: '+nameOf(id,catalog)+'.');
 const flags={automaticPromotion:'Automatic promotion',automaticCommission:'Automatic commission',commissionBlockedFirstTerm:'First-term commission restriction'};
 const length=Math.max(before.careers?.length??0,after.careers?.length??0);
 for(let index=0;index<length;index++){
  const a=before.careers?.[index]??{},b=after.careers?.[index]??{};
  for(const [flag,label] of Object.entries(flags))if(!!a[flag]!==!!b[flag])details.push(label+(b[flag]?(flag==='commissionBlockedFirstTerm'?' applies':' is pending'):' is no longer pending')+' in '+nameOf(b.id??a.id,catalog)+'.');
 }
 return details;
}
export function rollResult(event,state,catalog,options={}){
 if(!event)return null;
 const advancement=advancementResult(event);
 const survival=survivalResult(event,state);
 const specialized=advancement??survival;
 const modifierBefore=event.modifierChanges?{modifiers:event.modifierChanges.before}:options.beforeState;
 const modifierAfter=event.modifierChanges?{modifiers:event.modifierChanges.after}:state;
 const primaryLabels=advancement?['Advancement','Commission','Education commission']:survival?['Survival','Event table','Mishap table']:[];
 // Specialized helpers already identify the adjusted check and observed rank/skill gains.
 const effectEvent=advancement?{...event,changes:(event.changes??[]).filter(c=>!(((c.path.startsWith('skills.')||c.path.startsWith('stats.')&&finite(c.before))&&finite(c.after))||(/^careers\.\d+\.(rank|officer|forcedExit|forcedStay|released)$/.test(c.path)&&((finite(c.before)&&finite(c.after))||c.after===true))))}:event;
 const details=[...(event.rolls??[]).filter(r=>finite(r.total)&&!primaryLabels.includes(r.label)).map(r=>rollLabel(r,catalog)),...lifeEventLogDetails(event),...characterEffectDetails(effectEvent,catalog),...modifierEffectDetails(modifierBefore,modifierAfter,catalog),...pendingEffectDetails(event,catalog)];
 const check=summaryCheck(event.summary);if(check&&!specialized)details.unshift(check);
 if(specialized)details.unshift(...specialized.details);
 const choice=state?.pendingChoice;
 if(choice&&typeof state?.lifeEventPresentation?.description==='string')details.push('Pending: '+state.lifeEventPresentation.description);
 if(choice&&['effect-choice','skill-choice','relationship-loss','relationship-event','injury-loss'].includes(state.stage))details.push('Pending: '+(choice.label??(state.stage==='skill-choice'?'choose a skill or specialisation':'choose an event outcome'))+'.');
 if(state?.stage==='injury-loss')details.push('Pending: choose the injury losses.');
 if(state?.pending&&(state.stage==='book-step'||state.stage?.includes('source')))details.push('Pending source resolution: '+(state.pending.label??state.pending.description??'confirm the outcome before its effects can be applied')+'.');
 const sourcePending=state?.stage==='book-step'||(typeof event.summary==='string'&&/requires? source resolution|source decisions are required|requires? source decisions|source resolution for/.test(event.summary));
 if(sourcePending)details.push('Pending source resolution; unresolved effects have not been awarded.');
 let title=specialized?.title??(words(event.type)||'Action')+' result.';
 // Use only prose-only summaries; never leak serialized rules or property paths.
 if(!specialized&&event.summary&&!/[{}\[\]]/.test(event.summary)&&!/[A-Za-z]+\.[A-Za-z]+/.test(event.summary))title=event.summary;
 const result={title,details:unique(details),status:sourcePending?'pending':specialized?.status??'info'};
 result.text=[result.title,...result.details].join(' ');return result;
}
