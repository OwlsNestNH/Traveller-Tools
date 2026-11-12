import {recoveryButton} from './recovery-actions.mjs';
import {crowAssistanceView} from './crow-assistance.mjs';
// Presentation-only validation. Never interprets transport/engine errors as omissions.
export const REQUIRED_HEADLINES=Object.freeze({
 starting:['MAKE A CHOICE, DUMMY!','ONE SMALL CHOICE. THEN THE GALAXY.','YOUR TRAVELLER IS MISSING A DETAIL.','BLANK IS NOT A CHARACTER OPTION.','IDENTITY CHECK: SOMETHING’S MISSING.','FINISH THE INTRODUCTION FIRST.'],
 skills:['PICK A SKILL, DUMMY!','WISHFUL THINKING IS NOT A SKILL.','YOUR TRAINING NEEDS A SUBJECT.','YOU LEARNED SOMETHING. PICK WHAT.','THAT SKILL SLOT IS STILL EMPTY.','THE DIPLOMA DOESN’T FILL ITSELF.'],
 rolls:['ROLL THE DICE, DUMMY!','THE DICE ARE NOT DECORATIONS.','FATE IS WAITING FOR A CLICK.','NO ROLL, NO RESULT.','THE UNIVERSE HASN’T ANSWERED YET.','LET THE DICE HAVE THEIR SAY.'],
 career:['PICK A PATH, DUMMY!','THE GALAXY NEEDS YOUR APPLICATION.','YOUR NEXT CHAPTER NEEDS A DIRECTION.','INDECISION IS NOT AN ASSIGNMENT.','CHOOSE WHERE THE TROUBLE STARTS.','A CAREER WON’T CHOOSE ITSELF.'],
 event:['PICK THE OUTCOME, DUMMY!','YOU CAN’T LEAVE FATE ON READ.','THIS CHAPTER NEEDS AN ENDING.','THE EVENT HAPPENED. NOW DECIDE.','THE CONSEQUENCES ARE WAITING.','YOUR STORY STILL HAS A LOOSE END.'],
 details:['FILL THE BLANK, DUMMY!','THE PAPERWORK HAS FOUND YOU.','EVEN SPACE NEEDS THE DETAILS.','YOUR RECORD HAS A HOLE IN IT.','THAT FIELD WON’T FILL ITSELF.','ONE MORE DETAIL. THEN FREEDOM.'],
 referee:['THE REFEREE GETS A SAY HERE.','THIS ONE NEEDS A RULING.','NICE TRY. CHECK WITH THE REFEREE.','THE RULEBOOK HAS ENTERED THE CHAT.','WE NEED A RULING, NOT A GUESS.','OFFICIAL WORD REQUIRED.'],
 generic:['MAKE A CHOICE, DUMMY!','HOLD YOUR SPACE HORSES.','NOT SO FAST, TRAVELLER.','YOU’VE SKIPPED A BIT.','ONE THING AT A TIME, HERO.','THE NEXT BUTTON IS NOT A SHORTCUT.']
});
export function requiredHeadline(type,key=''){
 const bank=REQUIRED_HEADLINES[type]??REQUIRED_HEADLINES.generic;
 let hash=0;for(const char of String(key))hash=(hash*31+char.codePointAt(0))>>>0;
 return bank[hash%bank.length];
}
const field=(selector,type,detail)=>({selector,type,detail});
// Each selector is an existing required input, not an inference from its label.
const ACTION_FIELDS={
 'resolve-prisoner-lawyer':[['#lawyer-outcome','event','Choose Hire or Decline for the lawyer opportunity.'],['#lawyer-level','details','Enter the lawyer Advocate level.'],['#lawyer-zero','referee','Confirm the referee permits a level-0 lawyer at the printed Cr0 cost.'],['#lawyer-reason','referee','Record the level-0 lawyer ruling.']],
 'spend-equipment-credit':[['#credit-category','event','Choose the item category.'],['#credit-name','details','Enter the item name.'],['#credit-cost','details','Enter the listed unit cost.'],['#credit-quantity','details','Enter the item quantity.'],['#credit-note','referee','Record the item source and restriction check.'],['#credit-confirm','referee','Confirm the item, listed price and category.']],
 'choose-skill':[['#award-skill','skills','Choose the awarded skill and its required specialisation, or use the offered deferral.']],
 'education-skill':[['#education-hobby-skill','skills','Choose a hobby skill.'],['#education-subject','skills','Choose your study subject.'],['#education-skill','skills','Choose the required study skill or specialisation.']],
 'education-check':[['#education-check-skill','skills','Choose the skill for the study challenge.']],
 'career':[['#career-assignment','career','Choose an available career assignment.']],
 'change-assignment':[['#assignment-change','career','Choose a new assignment.']],
 'request-aslan-historical-entry':[['#aslan-historical-target','career','Choose a career and assignment first.']],
 'advisory-career':[['#advisory-career','career','Choose a career.']],
 'resolve-relationship-event':[['#relationship-event-person','event','Choose the existing person affected by this consequence.'],['#relationship-event-role','event','Choose the new relationship role.'],['#relationship-event-confirm','event','Confirm this relationship consequence.']],
 'resolve-life-event':[['#life-outcome','event','Choose the life event outcome.'],['#life-relationship','event','Choose the existing relationship.'],['#life-role','event','Choose the new relationship role.'],['#life-reason','details','Record the life event decision and its reason.'],['#life-confirm','event','Confirm this life event decision.'],['#life-funding','event','Choose the testing funding.'],['#life-timing','referee','Confirm the testing timing.'],['#life-referee','referee','Confirm the source-provided testing with the referee.']],
 'resolve-aslan-territory':[['#aslan-territory-landless','event','Confirm that no personal land is held, or review the source if you own unrecorded land.']],
 'resolve-relationship-loss':[['#relationship-absent','referee','Confirm the referee decision before continuing.'],['#relationship-loss-reason','referee','Record the referee reason for the absent relationship.']],
 'resolve-aslan-origin-source':[['#aslan-family-band','referee','Choose the referee-approved family band.'],['#aslan-origin-decision','referee','Choose the referee decision.'],['#aslan-origin-gender','referee','Choose the source rules branch.'],['#aslan-origin-reason','referee','Record the source decision and reason.']],
 'choose-aslan-clan':[['#aslan-clan-name','details','Enter the clan name.'],['#aslan-clan-scope','referee','Record the clan scope.'],['#aslan-origin-reason','referee','Record the clan source ruling.']],
 'name-aslan-clan':[['#aslan-clan-name','details','Enter the clan name.']],
 'resolve-aslan-historical-entry':[['#aslan-entry-approved','referee','Record approval or denial of historical entry.'],['#aslan-entry-reason','referee','Record the historical-entry source reason.']],
 'resolve-aslan-officer-rank':[['#aslan-officer-rank','referee','Choose the printed rank-table heading.'],['#aslan-officer-rank-reason','referee','Record the referee rank-table mapping.']],
 'resolve-advisory-cash-result':[['#advisory-cash-amount','details','Enter the source-confirmed cash amount.'],['#advisory-cash-reason','referee','Record the source cash ruling.']],
 'resolve-advisory-cash-limit':[['#advisory-limit-decision','referee','Choose the cash-limit ruling.'],['#advisory-limit-reason','referee','Record the cash-limit reason.']],
 'complete-psionic-games':[['#games-event-mode','referee','Choose the ordinary career event ruling.'],['#games-event-reason','referee','Record the event ruling and outcome.'],['#games-effects-confirm','referee','Confirm that all external event consequences are represented.'],['#games-stacking-mode','referee','Choose the overlapping PSI award ruling.'],['#games-stacking-reason','referee','Record the reason for the overlapping award ruling.']],
 'companion-entry':[['#education-tl','details','Enter the homeworld technology level.'],['#education-size','details','Enter the homeworld size.'],['#education-curriculum','career','Choose the curriculum.']],
 'connection':[['#connection-person','details','Enter the person connected to this skill gain.'],['#connection-skill','skills','Choose the connection skill.']],
 'activate-aslan-access':[['#aslan-access-route','career','Choose an available source route.'],['#aslan-access-destination','details','Record the destination outside Aslan space.'],['#aslan-access-confirmed','referee','Confirm the recorded move outside Aslan space.']],
 'resolve-aslan-access-conflict':[['#aslan-access-decision','referee','Choose the expedition timing ruling.'],['#aslan-access-conflict-reason','referee','Record the expedition timing reason.']],
 'resolve-land-claim':[['#land-claim','event','Choose the land claim.'],['#land-claim-mode','referee','Choose an available claim method.'],['#land-claim-confirmed','referee','Confirm the claim is established.'],['#land-claim-reason','referee','Record the claim ruling.'],['#land-relative-name','details','Name the relative administering this claim.']],
 'verify-clan-share-lot':[['#clan-verify-target','referee','Identify the issuing clan or choose source-only verification.'],['#clan-verify-new','details','Enter the issuing clan name.'],['#clan-verify-reason','referee','Record the verification reason.']],
 'verify-clan-contact':[['#clan-contact-clan','referee','Choose the verified clan.'],['#clan-contact-reason','referee','Record the clan verification reason.']]
};
export function actionRequirements(action,state={},trigger={}){
 const result=(ACTION_FIELDS[action]??[]).map(args=>field(...args)),add=(selector,type,detail)=>result.push(field(selector,type,detail));
 if(action==='resolve-life-event'&&state.pending?.decision==='artefact')add('#life-name','details','Describe the ancient or alien artefact.');
 if(action==='setup'&&trigger.species==='aslan')add('#setup-gender','starting','Choose Male or Female physical sex before starting your Aslan.');
 if(action==='begin-aslan-officer')add('[data-officer-assignment][data-offer-id="'+trigger.offerId+'"]','career','Choose an officer assignment first.');
 if(action==='resolve-aslan-estate'&&trigger.method==='referee-baseline')for(const [id,detail] of [['parcels','Enter the referee-approved estate baseline in parcels.'],['increment','Enter the parcel increment.']])add('#aslan-estate-'+id,'details',detail);
 if(action==='resolve-aslan-estate'&&trigger.method==='referee-baseline')add('#aslan-origin-reason','referee','Record the referee estate baseline reason.');
 if((action==='resolve-aslan-restoration'&&trigger.accept==='true')||(action==='resolve-aslan-outlaw-restoration'&&trigger.decision==='restore')){
  add('#aslan-original-soc','details','Enter verified original SOC from 1 to 40.');add('#aslan-original-soc-confirmed','referee','Confirm the original SOC from the source history.');add('#aslan-status-timing','referee','Choose when the restored status takes effect.');add('#aslan-restoration-reason','referee','Record the source restoration ruling.');
 }
 if(action==='resolve-aslan-outlaw-restoration'&&trigger.decision!=='decline'){
  if(trigger.decision==='marry')add('#aslan-unmarried-confirmed','referee','Confirm current unmarried eligibility.');
  add('#aslan-outlaw-reason','referee','Record the source restoration or marriage eligibility reason.');
 }
 if(action==='resolve-book'){
  const p=state.pending??{},kind=p.kind??'';
  add('#book-confirm','referee','Confirm you checked the indicated source and recorded all effects.');
  if(!['native-effect','species-setup','mishap','precareer','education-entry-rights'].includes(kind))add('#book-note','referee','Record the '+kind.replaceAll('-',' ')+' source decision and reason.');
  for(const [id,type,detail] of [
   ['aslan-officer-status-approved','referee','Record approval or denial of this offer-specific exception.'],['ageing-psi-confirmed','referee','Confirm the referee PSI ageing ruling.'],['ageing-anagathic-terms','details','Enter the anagathic ageing credit.'],['transfer-rank-track','career','Choose an enlisted or officer rank track.'],
   ['benefit-item-name','details','Choose or name the actual source-listed item.'],['benefit-item-cost','details','Enter the listed item cost.'],['benefit-item-tl','details','Enter the item technology level.'],['benefit-weapon-skill','skills','Choose the matching weapon skill.'],['benefit-replace-asset','event','Choose the original active asset to replace.'],['benefit-ship-variant','event','Choose the awarded ship variant.'],['benefit-ship-history','rolls','Record every required ship-history result and source ruling.'],['benefit-sainthood','event','Record the sainthood check success or failure.'],['benefit-resolution','event','Choose record, effects or no award.'],
   ['pension-annual','details','Enter the annual pension amount.'],['pension-condition','details','Record the pension payment conditions.'],['psionic-approved','referee','Record whether psionic training is approved.'],['psionic-previous-checks','details','Enter the previous talent acquisition check count.'],['injury-survives','event','Record whether the Traveller survives the injury.'],['medical-covered-cost','details','Enter the source-confirmed employer contribution.'],['ageing-care','referee','Record whether ageing-crisis care is funded.'],['source-check-natural','rolls','Enter the unmodified check roll from 2 to 12.'],['source-check-total','rolls','Enter the modified check total.'],['education-psi','rolls','Enter the source-tested PSI score.'],['education-entry-decision','referee','Record whether education entry is permitted.'],['education-citizen-decision','referee','Record the Citizen branch decision.'],['education-entry-right','referee','Record the automatic-entry decision.'],['education-qualification-dm','details','Enter the qualification modifier.'],['education-commission-dm','details','Enter the commission modifier.'],['education-advancement-dm','details','Enter the advancement modifier.'],['education-age-after','details','Enter age after education.'],['education-graduation-decision','event','Record graduation and honours.'],['education-selected-names','skills','Record the adjudicated selected skills.'],['birth-order','starting','Choose the source-defined family position.']
  ])add('#'+id,type,detail);
 }
 return result;
}
export function requiredActionKey(state,control){return JSON.stringify([state.rng,state.stage,state.pending?.kind,state.pendingChoice?.selectionId,control.id||control.name]);}
export function missingField(control){
 if(control.type==='checkbox'||control.type==='radio')return !control.checked;
 return !String(control.value??'').trim()||control.validity?.valid===false;
}
let serial=0;
export function showRequiredAction(root,{control,type='generic',detail,key='',actions=[]}){
 if(!control)return;
 const scope=control.closest('dialog[open]')??root.querySelector('#workspace')??root.body;
 let warning=scope.querySelector(':scope > .required-action-warning');
 if(!warning){warning=root.createElement('div');warning.id='required-action-warning-'+(++serial);warning.className='required-action-warning';warning.dataset.crowEssential='true';warning.setAttribute('role','alert');warning.setAttribute('aria-atomic','true');scope.prepend(warning);}
 const introduction=scope.querySelector(':scope > #crow-introduction');if(introduction)introduction.hidden=true;
 const assistance=crowAssistanceView(root,{type,informationDialog:introduction?'crow-introduction-dialog':null});assistance.help.id=warning.id+'-crow-help';if(!introduction)assistance.button.setAttribute('aria-controls',assistance.help.id);
 const title=root.createElement('strong'),instruction=root.createElement('p');title.textContent=requiredHeadline(type,key);instruction.textContent=detail;
 const speech=root.createElement('div');speech.className='crow-speech';speech.append(title,instruction);
 const recovery=root.createElement('div');recovery.className='crow-recovery-actions';const dismiss=()=>{warning.hidden=true;if(introduction)introduction.hidden=false;if(control.isConnected){control.focus();control.scrollIntoView?.({block:'nearest'});}};recovery.append(recoveryButton(root,{id:'continue',label:'Continue',ariaLabel:'Continue to the missing field',run:dismiss}));for(const action of actions)recovery.append(recoveryButton(root,action));warning.replaceChildren(assistance.row,speech,assistance.help,recovery);warning.hidden=false;
 control.setAttribute('aria-invalid','true');
 const ids=new Set((control.getAttribute('aria-describedby')??'').split(/\s+/).filter(Boolean));ids.add(warning.id);control.setAttribute('aria-describedby',[...ids].join(' '));
 for(let node=control.parentElement;node&&node!==scope;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
 if(!control.matches('input,select,textarea,button,[tabindex]'))control.tabIndex=-1;
 control.focus();
 warning.scrollIntoView?.({block:'nearest'});
 return warning;
}
// Installed once. Capture blocks local popup listeners and bubbling app handlers
// before any command, draft persistence, RNG call or navigation can run.
export function mountRequiredActions({document:root,getState,isBusy,backgroundSelection,studyValid,getRecoveryActions=()=>[]}){
 const active=control=>control&&!control.disabled&&!control.closest('[hidden]');
 const fail=(control,type,detail)=>{const state=getState();showRequiredAction(root,{control,type,detail,key:requiredActionKey(state,control),actions:getRecoveryActions({control,state})});return true;};
 function validate(action,trigger){
  const state=getState();
  if(action==='background'){
   const form=root.querySelector('#background-form'),selected=[...form.querySelectorAll('[name=skills]:checked')].map(n=>n.value),s=backgroundSelection(state,selected);
   if(!s.valid)return fail(form.querySelector(s.remaining<0?'[name=skills]:checked':'[name=skills]:not(:checked)')??form.querySelector('[name=skills]')??form,'skills','Choose exactly '+s.required+' distinct background skills. '+s.skills.length+' selected; '+(s.remaining<0?'remove '+(-s.remaining):'choose '+s.remaining+' more')+'.');
  }
  if(trigger.id==='aslan-family-continue'){
   const choice=root.querySelector('#aslan-family-dialog [name=aslan-family-choice]');
   if(choice&&!root.querySelector('#aslan-family-dialog [name=aslan-family-choice]:checked'))return fail(choice,'skills','Choose one of the awarded family background skills to continue.');
  }
  if(action==='accept-statistics'&&(!state.pool?.length||state.pool.some(p=>p.base===null))){
   const p=state.pool?.find(p=>p.base===null),control=root.querySelector(p?'[data-physical-card="'+p.key+'"]':'[data-action=roll-statistics]');
   return fail(control,'rolls',state.config?.physicalDice?'Enter all six valid raw dice totals before keeping these characteristics.':'Roll the six characteristics before keeping them.');
  }
  if(action==='companion-skill'){
   const inputs=[...root.querySelectorAll('[data-companion-skill]')],values=inputs.map(n=>n.value.trim()),count=state.pendingChoice?.count??1;
   if(values.some(n=>!n)||new Set(values).size!==count)return fail(inputs.find(n=>!n.value.trim())??inputs[0],'skills','Choose exactly '+count+' distinct study skills; include a specialisation where this award requires one.');
  }
  for(const rule of actionRequirements(action,state,{...trigger.dataset,species:root.querySelector('#setup-species')?.value})){
   const control=root.querySelector(rule.selector);if(!active(control))continue;
   // The existence of optional fields is not a requirement for these branches.
   if(rule.selector==='#games-effects-confirm'&&root.querySelector('#games-event-mode')?.value!=='resolved-externally')continue;
   if(rule.selector==='#benefit-ship-history'&&!state.pending?.historyRollCount)continue;
   if(control.validity?.rangeOverflow&&['credit-cost','benefit-item-cost','benefit-item-tl'].includes(control.id))continue; // Preserve plain affordability/source-limit errors.
   if(missingField(control))return fail(control,rule.type,rule.detail+(control.type==='number'?' '+(control.validationMessage||'Use the displayed numeric limits.') :''));
   if(rule.selector==='#setup-gender'&&!['male','female'].includes(control.value))return fail(control,rule.type,rule.detail);
  }
  if(action==='education-skill'&&root.querySelector('.education-study-continue')&&!studyValid(state,root.querySelector('#education-skill')?.value))return fail(root.querySelector('#education-skill-label:not([hidden]) input')??root.querySelector('#education-speciality-label:not([hidden]) input')??root.querySelector('#education-subject'),'skills','Choose an allowed study subject and its required specialisation.');
  if(action==='resolve-book'){
   for(const row of root.querySelectorAll('[data-effect]'))for(const control of row.querySelectorAll('[data-field=name],[data-field=value]')){if(control.dataset.field==='name'&&!['skill','stat'].includes(row.querySelector('[data-field=kind]').value))continue;if(missingField(control))return fail(control,control.dataset.field==='name'?'skills':'details','Complete the entered effect name and numeric value, or remove this effect.');}
   if(root.querySelector('#benefit-resolution')?.value==='record'&&!root.querySelector('#benefit-outcome-name')?.value.trim())return fail(root.querySelector('#benefit-outcome-name'),'details','Describe the actual source-resolved entitlement.');
   if(root.querySelector('#psionic-approved')?.value==='yes')for(const selector of ['#psionic-cost','#psionic-timing']){const control=root.querySelector(selector);if(active(control)&&missingField(control))return fail(control,'referee','Record the approved cost and confirm how training fits the source chronology.');}
   if(root.querySelector('#aslan-officer-status-approved')?.value==='yes'&&!root.querySelector('#aslan-officer-status-confirmed')?.checked)return fail(root.querySelector('#aslan-officer-status-confirmed'),'referee','Confirm the source-earned restoration or applicable exception.');
  }
  if(action==='resolve-reeducation')for(const row of root.querySelectorAll('[data-reeducation-decision]'))for(const control of row.querySelectorAll('[data-reeducation-value],[data-reeducation-reason]'))if(missingField(control))return fail(control,'referee','Record the referee-approved '+row.querySelector('legend').textContent.toLowerCase()+' and its reason.');
  return false;
 }
 root.addEventListener('click',event=>{
  const trigger=event.target.closest('button');if(!trigger||trigger.disabled||isBusy())return;
  const action=trigger.dataset.action??(trigger.id==='aslan-clan-record'?'choose-aslan-clan':'');
  if(validate(action,trigger)){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 root.addEventListener('submit',event=>{
  if(isBusy())return;
  const action=event.target.id==='setup-form'?'setup':event.target.id==='background-form'?'background':null;
  if(action&&validate(action,event.submitter??event.target)){event.preventDefault();event.stopImmediatePropagation();return;}
  for(const control of event.target.querySelectorAll('[required]'))if(active(control)&&missingField(control)){event.preventDefault();event.stopImmediatePropagation();fail(control,/reason|confirm|access|timing/.test(control.id)?'referee':'details','Complete '+(control.labels?.[0]?.textContent.trim()||control.getAttribute('aria-label')||'the required field')+'. '+(control.validationMessage||'This field is required.'));return;}
 },true);
 let invalidBatch=false;
 root.addEventListener('invalid',event=>{
  if(isBusy())return;event.preventDefault();if(invalidBatch)return;invalidBatch=true;queueMicrotask(()=>invalidBatch=false);
  const control=event.target,label=control.labels?.[0]?.textContent.trim().replace(/\s+/g,' ')||control.getAttribute('aria-label')||'this field';
  fail(control,control.id==='setup-gender'?'starting':control.matches('[data-physical-stat],[data-gm-die]')?'rolls':/reason|confirm|access|timing|provider|referee/.test(control.id)?'referee':'details',control.id==='setup-gender'?'Choose Male or Female physical sex before starting your Aslan.':'Complete '+label+'. '+control.validationMessage);
 },true);
 const clear=event=>{
  const scope=event.target.closest?.('dialog[open],form')??root.querySelector('#workspace');if(!scope)return;
  clearRequiredActions(scope.closest('dialog[open]')??root.querySelector('#workspace')??scope);
 };
 root.addEventListener('input',clear);root.addEventListener('change',clear);
 return {validate};
}

// Clear by scope, even when a rerender has already removed the deficient control.
export function clearRequiredActions(scope){
 if(!scope)return;
 for(const warning of scope.querySelectorAll('.required-action-warning'))warning.hidden=true;
 const introduction=scope.querySelector('#crow-introduction');if(introduction)introduction.hidden=false;
 for(const control of scope.querySelectorAll('[aria-describedby]')){
  const ids=(control.getAttribute('aria-describedby')??'').split(/\s+/),remaining=ids.filter(id=>id&&!id.startsWith('required-action-warning-'));
  if(remaining.length===ids.length)continue;
  control.removeAttribute('aria-invalid');
  if(remaining.length)control.setAttribute('aria-describedby',remaining.join(' '));else control.removeAttribute('aria-describedby');
 }
}
