import {mountCrowIntroduction} from './crow-assistance.mjs';
import {mountRequiredActions,clearRequiredActions} from './required-action.mjs';
import {physicalSexSelectView} from './physical-sex-setup.mjs';
import {shareAwardLabel,readableFutureCondition,readableTrait} from './species-record-labels.mjs';
import {educationCheckpointModel,educationCheckpointView,educationEventStoryView} from './education-event-checkpoint-view.mjs';
import {educationEventModel,educationEventView,educationGraduationView,educationPotentialModel,educationPotentialView,educationNestedChoiceModel,educationNestedChoiceView} from './precareer-popup.mjs';
import {educationResultModel} from './education-result-model.mjs';
import {educationResultView} from './education-result-view.mjs';
import {aslanRitePopupModel,aslanRitePopupView,mountAslanRiteInformation,riteTagKey} from './aslan-rite-popup.mjs';
import {hasAslanBackgroundPopup,mountAslanBackgroundInformation} from './aslan-background-popup.mjs';
import {aslanPridePopupModel,aslanPridePopupView,mountAslanPrideInformation} from './aslan-pride-popup.mjs';
import {aslanClanPopupModel,aslanClanPopupView,mountAslanClanInformation} from './aslan-clan-popup.mjs';
import {originTagline} from './aslan-origin-taglines.mjs';
import {aslanEstatePopupModel,aslanEstatePopupView} from './aslan-estate-popup.mjs';
import {aslanBirthPopupModel,aslanBirthPopupView} from './aslan-birth-popup.mjs';
import {aslanFamilyPopupView,mountAslanFamilyPopup} from './aslan-family-popup.mjs';
import {familyTagline} from './aslan-family-taglines.mjs';
import {aslanFamilyPopupModel} from './aslan-family-presentation.mjs';
import {preCareerChoicesView,mountPreCareerPopup} from './precareer-popup.mjs';
import {mountSpeciesSkillPopup} from './species-skill-popup.mjs';
import {backgroundSelection,backgroundDraftKey,reconcileBackgroundDraft,backgroundSkillsView,syncBackgroundSkills,mountBackgroundLayout} from './background-skills.mjs';
import {physicalDiceSetting,physicalDiceCards,physicalDiceWarning,mountPhysicalDiceEditor} from './physical-dice.mjs';
import {psiCard,mountPsiChoice} from './psi-choice.mjs';
import {mountStatisticEditor} from './statistic-editor.mjs';
import {careerInfoButton,mountCareerInfo} from './career-info.mjs';
import {createCharacterCancel} from './cancel-character.mjs';
import {flatLuckSetupView,syncFlatLuckSelection} from './flat-luck-setup.mjs';
import {aezorghRollChoiceView} from './aezorgh-setup.mjs';
import {notesConnectionsView} from './notes-connections-view.mjs';
import {emptyStatisticsView,statisticsCardsView,statisticsSummaryView,statisticsControlsView,statisticsRollFeedback,statisticsRollFeedbackView} from './characteristics-presentation.mjs';
import {openingInfoButton,mountOpeningHelp} from './opening-help.mjs';
import {createSimpleLogViewer} from './simple-log-viewer.mjs';
import {ledgerDetailsView,syncCreditSelection,creditPurchasePayload} from './finalization-ledgers.mjs';
import {equipmentFinalizationView,deferredEquipmentSummary,mountEquipmentDialog} from './equipment-finalization.mjs';
import {equipmentCatalogueView,syncEquipmentCatalogue} from './equipment-catalogue.mjs';
let aslanManualReviewKey=null;
import {aslanEventOutcomesView,aslanEventOutcomesSheet} from './aslan-event-outcomes-view.mjs';
import {skillAwardView,syncAwardBase,deferredAwardsView} from './skill-award-view.mjs';
import {educationStudySelectionValid,educationSkillTitle,educationSkillView,syncEducationSubject,syncEducationStudyContinue,companionSkillSuggestions} from './education-skill-view.mjs';
import {createLogViewer} from './log-viewer.mjs';
import {prisonerEscapeTitle,prisonerEscapeView} from './prisoner-escape-view.mjs';
import {extraCharacteristicsView,gmControlsView,syncCorrectionField,syncReplacementDice,syncCorrectionTask,correctionPayload,replacementPayload} from './character-controls.mjs';
import {rollResult} from './roll-result-view.mjs';
import {conciseResult,latestResultView,isBasicTrainingChoice} from './concise-result.mjs';
import {aslanTrainingTagline,restoredAslanTrainingTagline} from './aslan-training-tagline.mjs';
let trainingTagline=null;
import {fullActionLog} from './log-download.mjs';
import {currentEffectsSheet} from './current-effects.mjs';
import {careerRankView} from './career-rank-view.mjs';
import {trainingChoiceView} from './training-information.mjs';
import {trainingContext} from './training-context.mjs';
import {createFinalSheet} from './final-sheet.mjs';
import {setupOptionalSummary,syncSetupOptionalSummary} from './setup-options.mjs';
import {relationshipEventView,relationshipEventPayload,relationshipEventSheet} from './relationship-event-view.mjs';
import {benefitWagerView,benefitWagerSheet} from './benefit-wager-view.mjs';
import {prisonerLawyerView,prisonerLawyerPayload,syncPrisonerLawyerControls,prisonerLawyerSheet} from './prisoner-lawyer-view.mjs';
import {coreLifeEventView,coreLifeEventPayload,syncCoreLifeEventControls,coreLifeEventSheet,coreLifeBenefitView} from './core-life-event-view.mjs';
import {aslanAccessSelection,aslanAccessPayload,aslanAccessView,aslanAccessSheet,cashRollDisplay,aslanAccessConflictView,fallbackView} from './aslan-access-view.mjs';
import {landSelection,landRedemptionPayload,landClaimPayload,landClaimView,landClaimSheet} from './aslan-land-view.mjs';
import {clanAssetTotals,clanAssetPayload,clanWeaponRow,clanAssetSheetDetail} from './clan-asset-view.mjs';
import {clanShareView,clanShareSheet,clanShareSelection} from './clan-share-view.mjs';
import {aslanOriginView,aslanOriginSourceView,aslanOriginSheet} from './aslan-origin-view.mjs';
import {aslanOutlawRestorationView,aslanOutlawSheet,aslanHistoricalOptionsView,aslanHistoricalDecisionView,aslanHistoricalSheet} from './aslan-outlaw-view.mjs';
import {aslanRestorationView,aslanRestorationSheet,aslanRestorationNotice} from './aslan-restoration-view.mjs';
import {aslanOfficerOffersView,aslanOfficerPendingView,aslanOfficerEntryView,aslanOfficerRankView,aslanOfficerStatusView,aslanOfficerSheet} from './aslan-officer-view.mjs';
import {assignmentChangeView,assignmentEntryView,assignmentPendingView,assignmentChangeSheet} from './assignment-view.mjs';
import {benefitCreditView} from './benefit-credit-view.mjs';
import {advisoryView,advisorySheet} from './advisory-view.mjs';
import {crossCareerCoverView,crossCareerTrainingView,crossCareerRouteSheet} from './cross-career-view.mjs';
import {relationshipLossView,relationshipLossSheet} from './relationship-loss-view.mjs';
import {merchantFineView,merchantFineSheet} from './merchant-fine-view.mjs';
import { call } from './client.mjs';
import {inspectRecordedHistory,recordedHistoryText} from './legacy-history.mjs';
import {choiceLabel,skillChoiceProgress} from './choice-labels.mjs';
import {reeducationView,readReeducationDecisions,reeducationSheet,formatCharacterAge} from './reeducation-view.mjs';
const exportSession=session=>JSON.stringify(session,null,2);
const sourceLabel=(source,page)=>(catalog?.sources?.[source]?.title??source)+' · p. '+page;
const $=selector=>document.querySelector(selector);
const numberInput=selector=>{const input=$(selector);return input&&input.value!==''?Number(input.value):undefined;};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='traveller-character-generator.v1';
let backgroundDraft=null;
let notesDraft=null,inspectionRaw=null,inspectionHistory=null,inspectionOriginal=null;
let session,projection,catalog,busy=false,selectedCareer='',effects=[],storageWarning='',operationGeneration=0,recoveryRaw=null;
const stageNames={'aslan-rite-result':'Your Rite of Passage result','aslan-pride-result':'Your pride result','aslan-clan-result':'Your clan result','aslan-family-result':'Your family result','aslan-birth-result':'Your birth-order result','equipment-finalization':'Assets & benefits','borrowed-event-roll':'Discover the next part of your story','career-event':'Discover your career event','career-mishap':'Resolve your career mishap','relationship-event':'Choose the relationship consequence','cross-career-cover':'Choose your cover career','benefit-wager':'Choose an optional benefit wager','aslan-family':'Discover your family background','aslan-birth-order':'Your place in the family','aslan-estate':'Record the family land baseline','aslan-clan':'Find your clan','aslan-pride':'Find your pride','aslan-rite':'Complete your rite','aslan-officer-entry':'Qualify for the officer career','aslan-officer-rank':'GM officer rank mapping','assignment-entry':'Qualify for your new assignment','advisory-cash-source':'Resolve the unprinted cash result','advisory-career':'Choose your advisory career','advisory-cash':'Resolve your advisory cash benefit','cross-career-training':'Choose your extra training','relationship-loss':'Choose a relationship to remove','merchant-fine-roll':'Roll the Merchant fine','merchant-fine-decision':'Resolve the Merchant fine','reeducation-roll':'Re-education outcome','reeducation-fine':'Re-education fine','reeducation-decisions':'Resolve re-education decisions','psionic-games-preliminaries':'Compete in the Psionic Games','psionic-games-final':'The Psionic Games final','psionic-games-decisions':'Resolve the Games term',retirement:'Retired from character creation','psionic-training':'Explore your psionic talents','injury-loss':'Resolve the injury','injury-treatment':'Choose injury treatment','companion-admission':'Check education admission','companion-skill':'Choose your education awards','education-skill':'Choose your study skills','education-service':'Choose academy service awards','education-event':'Your education term','education-check':'Demonstrate what you learned','education-graduation':'Graduation','preterm-commission':'Education commission opportunity',identity:'Start your Traveller',statistics:'Roll and place characteristics',background:'Choose background skills',precareer:'Before your career',career:'Choose your next career','failed-entry':'Choose a new direction','book-step':'Resolve a source step',survival:'Will you make it through?',advancement:'Your career develops',training:'Choose a training table','effect-choice':'Make a life-path choice','skill-choice':'Choose your new skill','term-end':'The end of a term',benefits:'What you take with you',finish:'Your Traveller is ready to review',ageing:'The passing years',deceased:'The end of a life path'};
const coverageLabels={'zhodani-relationship-loss':'Missing relationship source decision','zhodani-reeducation':'Re-education source decisions','zhodani-anagathic-ageing':'Anagathic ageing credit','zhodani-ageing-psi':'PSI ageing decision','career-transfer':'Career transfer rank decisions','psionic-games':'Psionic Games source decisions','native-effect':'A special event or award','benefit-equipment':'Equipment selections','benefit-ship':'Ship choices and history','benefit-source':'Special benefit rulings',pension:'Pension eligibility or payment conditions','injury-zero':'Injury survival rulings','injury-medical':'Employer medical contributions','medical-settlement':'Medical bill financing','ageing-financing':'Ageing-care financing','psionic-training-terms':'Psionic training access, costs and timing','psionic-history':'Earlier psionic attempt history','psionic-repeat-training':'Repeated psionic training','psionic-retry':'A psionic replacement award','missing-characteristic-check':'A cross-species characteristic check','species-setup':'Species upbringing details','companion-career-rights':'Education rights in a later career'};
const button=(label,action,cls='',attributes='')=>'<button type="button" data-action="'+action+'" class="'+cls+'" '+attributes+'>'+label+'</button>';
const options=(list,value)=>list.map(x=>'<option value="'+esc(x.id??x)+'" '+((x.id??x)===value?'selected':'')+(x.disabled?' disabled':'')+'>'+esc(x.name??x)+'</option>').join('');
function syncAslanAccessControls(){
 const select=$('#aslan-access-route');if(!select)return;
 const route=aslanAccessSelection(projection.state,select.value),enabled=!!route?.available;
 $('#aslan-access-selection').textContent=route?route.name+'. '+(route.reason||'Available.')+(route.automatic?' This route grants one automatic source entry.':' Ordinary qualification applies.')+(route.mandatory?' The next career attempt is required.':''):'';
 $('#aslan-access-source').textContent=route?sourceLabel(route.source.id,route.source.page):'';
 $('#aslan-access-destination').disabled=!enabled;$('#aslan-access-confirmed').disabled=!enabled;$('[data-action=activate-aslan-access]').disabled=!enabled;
}
function readLandRows(){return [...document.querySelectorAll('[data-land-lot]')].map(row=>({lotId:row.dataset.landLot,selected:row.querySelector('[data-land-selected]').checked,quantity:row.querySelector('[data-land-quantity]').value===''?undefined:Number(row.querySelector('[data-land-quantity]').value)}));}
function readLandFields(){return {worldName:$('#land-world-name')?.value,worldLocation:$('#land-world-location')?.value,worldReference:$('#land-world-reference')?.value,minimumParcels:numberInput('#land-minimum'),increment:numberInput('#land-increment'),reason:$('#land-ruling-reason')?.value};}
function syncLandControls(){
 const fields=$('#clan-land-fields');if(!fields)return;
 const state=projection.state,p=state.clanShareOptions,land=$('#clan-share-kind').value==='land',choice=p.choices.find(c=>c.id==='land');fields.hidden=!land;
 for(const id of ['clan-share-lot-field','clan-share-quantity-field','clan-share-lot-help'])$('#'+id).hidden=land;
 if(land){$('#clan-share-lot').disabled=true;$('#clan-share-quantity').disabled=true;}
 for(const input of fields.querySelectorAll('input,textarea'))input.disabled=!land||!choice?.available||!p.checkpointAvailable;
 for(const row of fields.querySelectorAll('[data-land-lot]'))row.querySelector('[data-land-quantity]').disabled=!land||!choice?.available||!p.checkpointAvailable||!row.querySelector('[data-land-selected]').checked;
 const selected=landSelection(state,readLandRows(),readLandFields());
 $('#land-value').textContent=selected.total===null?'Select awards and enter whole share quantities.':'Selected shares: '+selected.total+'. '+(selected.total<p.landRules.minimumShares?'At least '+p.landRules.minimumShares+' are required.':selected.parcels===null?'Enter a valid parcel ruling.':'Pending claim: '+selected.parcels.toLocaleString()+' parcels.');
 if(land)$('[data-action=redeem-clan-shares]').disabled=!selected.available;
}
function syncLandClaimControls(){
 const select=$('#land-claim');if(!select)return;
 const p=projection.state.landClaimOptions,c=p.claims.find(c=>c.id===select.value),mode=$('#land-claim-mode'),old=mode.value;
 mode.innerHTML='<option value="">Choose a method</option>'+options((c?.modes??[]).map(m=>({id:m.id,name:m.name+(m.available?'':' (unavailable)'),disabled:!m.available})),old);mode.disabled=!c?.available;
 const selected=c?.modes.find(m=>m.id===mode.value),enabled=!!c?.available&&!!selected?.available;
 $('#land-claim-help').textContent=c?'Claim '+(p.claims.indexOf(c)+1)+' · '+c.world.name+' · '+c.world.location+'. '+c.parcels.toLocaleString()+' parcels. '+(c.status==='claimed'?'Claim already recorded.':c.mature?'Delay elapsed.':'Remaining delay: '+c.remainingYears+' years.')+(c.reason?' '+c.reason:'')+(c.currentOutcast?' Current Outcast status is recorded separately from this converted claim.':''):p.checkpointReason||'Choose a recorded claim.';
 $('#land-mode-help').textContent=selected?.reason||(c?.modes.filter(m=>!m.available).map(m=>m.name+': '+m.reason).join(' ')??'');
 const relative=mode.value==='relative-administration';$('#land-relative-field').hidden=!relative;$('#land-relative-name').disabled=!enabled||!relative;
 $('#land-claim-confirmed').disabled=!enabled;$('#land-claim-reason').disabled=!enabled;$('[data-action=resolve-land-claim]').disabled=!enabled;
}
function readClanWeaponItems(){return [...document.querySelectorAll('[data-weapon-row]')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-weapon-field]')].map(input=>[input.dataset.weaponField,['quantity','unitCost','tl'].includes(input.dataset.weaponField)?(input.value===''?undefined:Number(input.value)):input.value])));}
function renderClanWeaponItems(items){if($('#clan-weapons-confirmed'))$('#clan-weapons-confirmed').checked=false;if($('#clan-lower-value-confirmed'))$('#clan-lower-value-confirmed').checked=false;const rules=projection.state.clanShareOptions?.assetRules;if(!rules||!$('#clan-weapon-items'))return;$('#clan-weapon-items').innerHTML=items.map((item,i)=>clanWeaponRow(i,rules,{esc,button},item)).join('');syncClanAssetControls();}
function syncClanAssetControls(){
 const rules=projection.state.clanShareOptions?.assetRules;if(!rules||!$('#clan-art-fields'))return;
 const kind=$('#clan-share-kind').value,lot=$('#clan-share-lot').value,enabled=!!lot,art=kind==='art',weapons=kind==='weapons',weaponEnabled=weapons&&enabled&&projection.state.config.gm;
 $('#clan-art-fields').hidden=!art;$('#clan-art-name').disabled=!art||!enabled;$('#clan-weapon-fields').hidden=!weapons;
 for(const input of document.querySelectorAll('#clan-weapon-fields input,#clan-weapon-fields textarea,#clan-weapon-fields button'))input.disabled=!weaponEnabled;
 const items=readClanWeaponItems();$('[data-action=clan-add-weapon]').disabled=!weaponEnabled||items.length>=rules.maxItems;for(const b of document.querySelectorAll('[data-action=clan-remove-weapon]'))b.disabled=!weaponEnabled||items.length<=1;
 const values=clanAssetTotals(numberInput('#clan-share-quantity'),rules,items),showLower=weapons&&values.unused>0;
 $('#clan-lower-value-fields').hidden=!showLower;$('#clan-lower-value-confirmed').disabled=!showLower||!weaponEnabled;$('#clan-lower-value-reason').disabled=!showLower||!weaponEnabled;
 if(!showLower)$('#clan-lower-value-confirmed').checked=false;
 const display=$('#clan-asset-value');display.hidden=!art&&!weapons;display.textContent=values.budget===null?'Choose a positive share quantity.':'Share value: Cr'+values.budget.toLocaleString()+(weapons?(values.total===null?'. Enter each item quantity and unit price.':'. Selected items: Cr'+values.total.toLocaleString()+(values.unused<0?'. Over budget by Cr'+(-values.unused).toLocaleString()+'. Cash supplements are unavailable.':values.unused>0?'. Unused value: Cr'+values.unused.toLocaleString()+'.':'. Exact value.')):'. Assessed art value; not cash.');
}
function syncClanShareControls(savedLot){
 const p=projection.state.clanShareOptions,kind=$('#clan-share-kind');if(!p||!kind)return;
 const lotInput=$('#clan-share-lot'),previous=savedLot??lotInput.value;
 const available=clanShareSelection(p,kind.value,previous);
 lotInput.innerHTML='<option value="">Choose an award</option>'+options(available.lots.map(l=>({id:l.id,name:shareAwardLabel(l,projection.state)+' · '+l.available+' held'})),previous);lotInput.disabled=!available.choice?.available;
 const selected=clanShareSelection(p,kind.value,lotInput.value),lot=selected.lot,quantity=$('#clan-share-quantity');
 quantity.disabled=!lot;quantity.readOnly=selected.favour;quantity.max=lot?.available??1;if(selected.favour||Number(quantity.value)>Number(quantity.max))quantity.value='1';
 $('#clan-share-choice-help').textContent=selected.choice?.reason||(selected.favour?'A clan favour uses exactly one share.':'');
 $('#clan-share-lot-help').textContent=lot?shareAwardLabel(lot,projection.state)+'. '+lot.available+' available. '+lot.clanName+'.':'';
 const nameField=$('#clan-share-name-field'),contactField=$('#clan-share-contact-field');nameField.hidden=kind.value!=='contact';nameField.querySelector('input').disabled=kind.value!=='contact'||!lot;contactField.hidden=kind.value!=='ally';
 const contact=$('#clan-share-contact'),oldContact=contact.value;contact.innerHTML='<option value="">Choose a Contact</option>'+options(selected.contacts.map(c=>({id:c.id,name:c.name+' · Contact '+(p.contacts.findIndex(item=>item.id===c.id)+1)})),oldContact);contact.disabled=kind.value!=='ally'||!lot;
 const person=selected.contacts.find(c=>c.id===contact.value);$('#clan-share-contact-help').textContent=kind.value==='ally'&&person?person.name+' · Contact '+(p.contacts.findIndex(item=>item.id===person.id)+1)+' · '+person.clanName:'';
 $('[data-action=redeem-clan-shares]').disabled=!p.checkpointAvailable||!selected.choice?.available||!lot||kind.value==='ally'&&!person;
 const verifyLot=$('#clan-verify-lot'),verifyTarget=$('#clan-verify-target');
 if(verifyLot){const l=p.lots.find(l=>l.id===verifyLot.value);$('#clan-verify-lot-help').textContent=l?shareAwardLabel(l,projection.state)+'. '+l.available+' held. '+l.reason:'';const sourceOnly=verifyTarget.querySelector('[value="__source"]');sourceOnly.disabled=!l?.verificationRequired;if(sourceOnly.disabled&&verifyTarget.value==='__source')verifyTarget.value='';$('#clan-verify-target-help').textContent=verifyTarget.value==='__source'?'Source only; issuing clan remains unknown.':verifyTarget.value==='__new'?'Identify another issuing clan.':p.clans.find(c=>c.id===verifyTarget.value)?.name??'';const newClan=verifyTarget.value==='__new';$('#clan-verify-new-field').hidden=!newClan;$('#clan-verify-new').disabled=!newClan||!l?.canVerify;$('[data-action=verify-clan-share-lot]').disabled=!l?.canVerify;}
 syncClanAssetControls();syncLandControls();
 const verifyContact=$('#clan-verify-contact');if(verifyContact){$('#clan-contact-clan-help').textContent=p.clans.find(c=>c.id===$('#clan-contact-clan').value)?.name??'';const c=p.contacts.find(c=>c.id===verifyContact.value);$('#clan-verify-contact-help').textContent=c?c.name+' · Contact '+(p.contacts.indexOf(c)+1)+' · '+c.clanName:'';$('[data-action=verify-clan-contact]').disabled=!c?.canVerify;}
}
function notify(message,error=false,status='info',action=false,context={}){$('#message').style.overflowWrap='anywhere';$('#message').className=error?'error':'result-'+status+(action?' action-announcement':'');$('#message').textContent=message;const popupError=$('#species-skill-error');if(popupError)popupError.textContent=error?message:'';if(error)window.CrowTechnicalError?.show(message,context);}
function clearActionNotice(){if($('#message').classList.contains('action-announcement'))notify('');}
function actionNotice(type,result){
 return statisticsRollFeedback(result.log.at(-1),result.state)??conciseResult(result.log.at(-1),result.state,catalog)?.text??'Action recorded.';
}

function updateRecovery(){
 const region=$('#recovery');region.hidden=recoveryRaw===null;
}
function inspectHistory(raw,original=null,issue=''){
 inspectionRaw=raw;inspectionOriginal=original;inspectionHistory=null;const region=$('#legacy-history');region.hidden=false;
 try{
  if(issue)throw new Error(issue);
  inspectionHistory=inspectRecordedHistory(raw);const history=inspectionHistory;
  $('#legacy-description').textContent=history.events.length+' recorded actions. Save version '+history.version+'; rules revision: '+history.rulesRevision+'.';
  $('#legacy-actions').innerHTML=history.events.map(event=>'<li><details><summary>Action '+event.number+' · '+esc(event.type)+'</summary><p class="multiline">'+esc(event.summary)+'</p><p class="tiny multiline">Recorded command: '+esc(event.command)+'</p>'+event.rolls.map(roll=>'<p class="tiny multiline">'+esc(roll)+'</p>').join('')+(event.rollsShortened?'<p class="warning">Additional rolls are only in the unchanged original file.</p>':'')+'</details></li>').join('');
 }catch(error){$('#legacy-description').textContent=error.message;$('#legacy-actions').replaceChildren();}
 $('#legacy-text').disabled=inspectionHistory===null;
}
function closeHistory(){inspectionRaw=null;inspectionOriginal=null;inspectionHistory=null;$('#legacy-history').hidden=true;$('#legacy-actions').replaceChildren();}
function setBusy(value){
 busy=value;
 if(projection?.state.stage==='background')syncBackgroundSkills(document,projection.state,backgroundDraft?.skills??[],{esc},value);
 if(value){for(const el of document.querySelectorAll('button,input[type=file],#character-notes'))if(!el.disabled){el.dataset.busyDisabled='true';el.disabled=true;}}
 else {for(const el of document.querySelectorAll('[data-busy-disabled]')){el.disabled=false;delete el.dataset.busyDisabled;}$('#legacy-text').disabled=inspectionHistory===null;}
}
function persist(){
 if(recoveryRaw!==null){storageWarning='Your unreadable stored draft is preserved. This new draft is only in memory. Save a file, or use the recovery controls to replace the stored draft.';return;}
 try{localStorage.setItem(key,exportSession(session));storageWarning='';}
 catch{storageWarning='This browser could not save the draft. Use Save character & log to keep a backup.';}
}
function focusAfterAction(previousStage,focused){
 if($('#aslan-rite-doubles-dialog')?.open){$('#aslan-rite-doubles-title')?.focus({preventScroll:true});return;}
 if($('#aslan-family-dialog')?.open){const target=$('#aslan-family-roll')??$('#aslan-family-title');if(target){if(target.tagName==='H2')target.tabIndex=-1;target.focus({preventScroll:true});}$('#aslan-family-dialog').scrollTop=0;return;}
 if($('#species-skill-dialog')?.open){$('#species-skill-search').focus();return;}
 if($('#equipment-dialog')?.open){$('#equipment-dialog-title').focus();return;}
 if(previousStage==='book-step'&&projection.state.stage==='equipment-finalization'){document.querySelector('[data-action="choose-deferred-equipment"]:not(:disabled)')?.focus();return;}
 let target;
 if(previousStage===projection.state.stage){
  if(focused.id)target=document.getElementById(focused.id);
  if(!target&&focused.action)target=[...document.querySelectorAll('[data-action]')].find(el=>el.dataset.action===focused.action&&!el.disabled);
 }
 if(!target||target.disabled)target=$('#step-title');target?.focus();
}
async function send(type,payload={}){
 if(busy)return false;
 const token=operationGeneration,previousState=projection.state,previousStage=previousState.stage;
 const focused={id:document.activeElement?.id,action:document.activeElement?.dataset.action};
 setBusy(true);
 try{
  const result=await call({operation:'command',session,command:{type,payload},id:crypto.randomUUID(),expectedRevision:projection.revision});
  if(token!==operationGeneration)return false;
  if(!result.ok)throw new Error(result.error.message);
  trainingTagline=aslanTrainingTagline(result.log.at(-1),result.state,{previousState,command:{type,payload}});
  session=result.session;projection=result;aslanManualReviewKey=null;if(type==='notes'&&notesDraft===payload.text)notesDraft=null;effects=[];persist();render();focusAfterAction(previousStage,focused);notify(storageWarning||actionNotice(type,result),!!storageWarning,rollResult(result.log.at(-1),result.state,catalog)?.status??'info',!storageWarning);return true;
 }catch(error){if(token===operationGeneration)notify(error.message,true);return false;}
 finally{if(token===operationGeneration)setBusy(false);}
}
document.addEventListener('change',event=>{if(event.target.matches('#background-form [name=skills]')&&!busy){backgroundDraft={key:backgroundDraftKey(session,projection.state),skills:selected(event.target.form,'skills')};syncBackgroundSkills(document,projection.state,backgroundDraft.skills,{esc});}});
function selected(form,name){return [...form.querySelectorAll('input[name="'+name+'"]:checked')].map(e=>e.value);}
mountOpeningHelp(document);
mountPhysicalDiceEditor({document,getProjection:()=>projection,canOpen:()=>!busy&&recoveryRaw===null,onSave:payload=>send('enter-physical-statistic',payload),getError:()=>$('#message').textContent});
const statisticEditor=mountStatisticEditor({document,getProjection:()=>projection,canOpen:()=>!busy&&recoveryRaw===null,onSave:payload=>send('gm-override',payload),getError:()=>$('#message').textContent});
mountPsiChoice({document,getProjection:()=>projection,canOpen:()=>!busy&&recoveryRaw===null,onTest:payload=>send('test-psionic-potential',payload),onTraining:()=>send('begin-psionic-training'),onEdit:trigger=>statisticEditor.open('PSI',false,trigger),getError:()=>$('#message').textContent});
mountCareerInfo(document,id=>projection?.state.careerChoices?.find(c=>c.id===id),sourceLabel);
function setupView(){
 const s=projection.state;
 return '<form id="setup-form"><div class="form-grid"><label class="wide"><span class="opening-plain-label">Traveller name</span><input name="name" maxlength="80" autocomplete="off" placeholder="What will they call you?"></label><div class="opening-info-field"><div class="opening-label-help">'+openingInfoButton('species')+'<label for="setup-species">Species / society</label></div><select id="setup-species" name="species">'+options(catalog.species,'human')+'</select></div><div id="culture-choice" class="opening-info-field" hidden><div class="opening-label-help">'+openingInfoButton('upbringing')+'<label for="setup-culture">Upbringing</label></div><select id="setup-culture" name="culture" disabled><option value="native">Native society</option><option value="imperial">Imperial upbringing</option></select></div><div id="variant-choice" class="opening-info-field" hidden><div class="opening-label-help">'+openingInfoButton('strain')+'<label for="setup-variant">Vargr strain</label></div><select id="setup-variant" name="variant" disabled>'+options(catalog.species.find(x=>x.id==='vargr').variants,'standard')+'</select></div><div class="opening-info-field"><div class="opening-label-help">'+openingInfoButton('gender')+'<label for="setup-gender">Physical sex</label></div>'+physicalSexSelectView()+'</div><label><span class="opening-plain-label">Homeworld</span><input name="homeworld" maxlength="160" placeholder="Optional name or UWP"></label></div><details id="setup-gm-controls" class="opening-gm"><summary id="opening-gm-title">GM Controls</summary><details name="opening-gm-sections" id="setup-gm-settings" open><summary>GM Settings</summary>'+physicalDiceSetting(s,{setup:true})+'<div class="opening-boons gm-boons opening-info-field"><div class="opening-label-help">'+openingInfoButton('generation')+'<label for="setup-boons">Boon rolls <span class="house-option-label">House option</span></label></div><select id="setup-boons" name="boons">'+[0,1,2,3,4,5,6].map(n=>'<option value="'+n+'">'+n+' of six rolls</option>').join('')+'</select></div><label class="check"><input type="checkbox" name="allocation" checked><span>Let the player place or swap scores</span></label><label class="check"><input type="checkbox" name="minimumReroll" checked><span id="reroll-option-text">Allow reroll below a raw total of 43</span></label><label class="threshold-field" for="minimum-total">Minimum raw total<input id="minimum-total" name="minimumTotal" required type="number" min="6" max="72" step="1" value="'+esc(s.config?.minimumTotal??43)+'" data-custom-total="'+(Object.hasOwn(s.config??{},'minimumTotal')?'true':'false')+'"></label><p id="reroll-threshold-help" class="tiny">The threshold uses the six raw scores before species modifiers. Extra characteristics do not count.</p><label class="check"><input name="gm" type="checkbox"'+(s.config?.gm?' checked':'')+'><span>Enable GM result changes. Every correction is logged.</span></label>'+(catalog.species.some(s=>s.id==='zhodani')?'<label class="check"><input name="zhodaniPsi" type="checkbox"><span>Use the Zhodani Intendant / Noble PSI option<small>Requires GM mode and a Zhodani Traveller. Source: Aliens 2026 p. 254. PSI uses the published 1D table; SOC is rolled afterwards.</small></span></label>':'')+'</details><details name="opening-gm-sections" id="setup-optional-settings"><summary>Characteristic options<span id="setup-optional-summary">'+esc(setupOptionalSummary(s.config?.extras??[],!!s.config?.gm))+'</span></summary><fieldset><legend>Optional extra characteristics '+openingInfoButton('extras')+'</legend><div class="options-list">'+catalog.extraStats.map(x=>'<label class="check"><input type="checkbox" name="extras" value="'+x.id+'"'+(s.config?.extras?.includes(x.id)?' checked':'')+'><span>'+esc(x.name)+' ('+x.id+')<small>'+esc(x.source)+(x.note?' · '+esc(x.note):'')+'</small></span></label>'+(x.id==='PSI'?'<label class="check psi-activation-setting"><input name="psiGm" type="checkbox"'+(s.config?.psiGm?' checked':'')+'><span>PSI: enable GM activation<small>Set PSI directly without enabling other corrections. No automatic roll, training or talents.</small></span></label>':'')).join('')+'</div><p class="tiny">Selected PSI is shown as Untested until testing or a GM-entered score. Optional PSI is a campaign choice; GM result changes can stay off. Required species characteristics are handled separately.</p></fieldset></details><details name="opening-gm-sections" id="setup-house-rules"><summary>House Rules</summary>'+flatLuckSetupView(s,openingInfoButton)+''+aezorghRollChoiceView(s,projection.log,{esc,infoButton:openingInfoButton})+'<label class="check"><input name="psiTestingWithoutEvent" type="checkbox"'+(s.config?.psiTestingWithoutEvent?' checked':'')+'><span>Allow PSI testing without an event<small>GM house option, off by default. Testing between careers still requires institute access, two weeks and the testing cost. Training is separate.</small></span></label><div class="opening-house-rule">'+openingInfoButton('academy')+'<input id="setup-academy-service-skill" name="academyServiceSkill" type="checkbox"'+(s.config?.academyServiceSkill?' checked':'')+(s.config?.gm?'':' disabled')+'><label for="setup-academy-service-skill">Allow Service Skill choice in the first term after Academy<small>House option. Requires GM result changes. Matching Army, Marine or Navy career only, after a completed Core Academy term. Graduation awards are unchanged.</small></label></div></details></details><div class="actions"><button type="submit">Begin character</button></div></form>';
}
function syncPsiOptions(form){const psi=form.querySelector('[name=extras][value=PSI]');if(psi){psi.disabled=form.elements.species.value==='zhodani';if(psi.disabled)psi.checked=false;const activation=form.elements.psiGm;if(activation){activation.disabled=psi.disabled;if(activation.disabled)activation.checked=false;}}}
function syncRerollOptions(form){
 const aezorgh=form.elements.species.value==='aezorgh',twoDice=aezorgh&&form.elements.aezorghTwoDice.checked;
 const input=form.elements.minimumTotal,defaultTotal=aezorgh&&!twoDice?30:43;
 if(input){

  if(input.dataset.customTotal!=='true')input.value=String(defaultTotal);
  input.dataset.defaultTotal=String(defaultTotal);
 }
 const threshold=input?.value||defaultTotal;
 $('#reroll-option-text').textContent='Allow reroll below a raw total of '+threshold;
 $('#reroll-threshold-help').textContent=twoDice?'The check uses all six raw 2D6 totals before placement, halving or species bonuses. Default: 43. Extra characteristics do not count.':aezorgh?'RAW Aezorgh default to a 30-point raw-dice minimum. One-die scores swap within their group; DEX and INT swap separately. Extra characteristics and species bonuses do not count.':'The threshold uses the six raw scores before species modifiers. Default: 43. Extra characteristics do not count.';
}
function syncIdentityOptions(form){
 const species=form.elements.species.value,culture=form.elements.culture,variant=form.elements.variant;
 const imperial=['aslan','vargr'].includes(species);$('#culture-choice').hidden=!imperial;culture.disabled=!imperial;if(!imperial)culture.value='native';
 form.elements.gender.required=species==='aslan';
 const strains=species==='vargr';$('#variant-choice').hidden=!strains;variant.disabled=!strains;if(!strains)variant.value='standard';const aezorgh=species==='aezorgh';$('#aezorgh-roll-choice').hidden=!aezorgh;form.elements.aezorghTwoDice.disabled=!aezorgh;syncPsiOptions(form);syncRerollOptions(form);
}
function statCards(state,pool=false){
 const entries=pool?state.pool.map(p=>[p.key,p.value,p]):Object.entries(state.character.stats).map(([k,v])=>[k,v,null]);
 if(!pool&&state.config.extras.includes('PSI')&&!Object.hasOwn(state.character.stats,'PSI'))entries.push(['PSI',null,null]);
 return '<div class="stats">'+entries.map(([code,value,p])=>{
  if(code==='PSI'&&!pool)return psiCard(state,{esc,infoButton:openingInfoButton},'sheet');
  const editable=state.config.gm&&(pool||state.stage!=='statistics'||state.optionalPsiRequiresTesting),tag=editable?'button':'div';
  const attrs=editable?' type="button" id="stat-edit-'+(pool?'pool-':'sheet-')+esc(code)+'" data-edit-stat="'+esc(code)+'" data-stat-pool="'+pool+'" aria-haspopup="dialog" aria-controls="statistic-editor" aria-label="Set '+esc(code)+' score, currently '+esc(value)+'"':'';
  return '<'+tag+attrs+' class="stat'+(editable?' stat-editable':'')+'"><span class="code">'+esc(code)+'</span><strong>'+(value??'-')+'</strong><span>'+(p?(p.divisor===2?'Raw '+p.base+' ÷ 2 → '+p.derivedBase:'Base '+p.base)+' · '+(p.adjustment>=0?'+':'')+p.adjustment+' species':('DM '+(state.statDMs[code]>=0?'+':'')+state.statDMs[code]))+'</span>'+(p?.finalOverride!==undefined?'<span>GM final score</span>':'')+(p?'<span>'+p.count+'D'+(p.boon?' + boon':'')+(p.divisor===2?' / 2, round '+(state.aezorghRoundUp?'up':'down'):'')+'</span>':'')+'</'+tag+'>';
 }).join('')+'</div>';
}
function statisticsView(state){
 const controls=statisticsControlsView(state,gmControlsView(state,projection.log,{esc,options}),{esc});
 const introduction='<p class="statistics-introduction">Roll a set, then decide where each compatible score belongs. All rerolls and swaps stay in the action log.</p>';
 if(!state.pool.length)return introduction+statisticsCardsView(state,catalog,physicalDiceCards(state,{html:emptyStatisticsView(state,catalog,{esc}),esc}),{esc,infoButton:openingInfoButton})+'<div class="statistics-guidance"><strong>Start with your six characteristic rolls</strong><p>Roll the selected species dice, then review each score before continuing.</p></div>'+statisticsSummaryView(state,{esc})+'<div class="actions statistics-actions">'+button('Roll six characteristics','roll-statistics','statistics-primary')+'</div>'+controls;
 let html=introduction+statisticsCardsView(state,catalog,physicalDiceCards(state,{html:statCards(state,true),esc}),{esc,infoButton:openingInfoButton});
 if(state.statisticsComplete!==false&&(state.config.allocation||state.config.gm))html+='<div class="statistics-swap"><div class="inline-fields"><label>Swap this score<select id="swap-a">'+state.pool.map((p,i)=>'<option value="'+i+'">'+p.key+' · raw '+p.base+'</option>').join('')+'</select></label><label>With this score<select id="swap-b">'+state.pool.map((p,i)=>'<option value="'+i+'" '+(i===1?'selected':'')+'>'+p.key+' · raw '+p.base+'</option>').join('')+'</select></label>'+button('Swap scores','swap-statistics','quiet')+'</div><p class="tiny">'+(state.character.species==='aezorgh'&&!state.config.aezorghTwoDice?'Standard Aezorgh: swap one-die characteristics within their group, and DEX/INT separately. GM mode permits exceptions.':state.config.aezorghTwoDice?'Swap any raw 2D6 totals. Halving and species bonuses belong to the destination characteristic.':'Swap any of the six raw scores; species modifiers remain with their characteristics.')+(state.pool.some(p=>p.finalOverride!==undefined)?' GM-set final scores stay with their characteristics; rerolling starts a new set.':'')+'</p></div>';
 return html+statisticsSummaryView(state,{esc})+'<div class="actions statistics-actions">'+button('Keep these characteristics','accept-statistics','statistics-primary','')+button(state.statisticsComplete===false?'Roll a computer set':'Reroll this set','roll-statistics','quiet',(!state.statisticsCanReroll&&state.statisticsComplete!==false?'disabled title="'+(state.config.minimumReroll?'The raw total meets the reroll threshold.':'Minimum-total rerolls are off.')+'"':''))+'</div>'+controls;
}
function backgroundView(state){
 return backgroundSkillsView(state,backgroundDraft?.skills??[],catalog,{esc});
}
function preCareerView(state){return preCareerChoicesView(state,catalog,{esc,button});}

function companionAdmissionView(state){
 const config=state.pendingEducation,id=config.id,pre=catalog.precareers.find(p=>p.id===id);
 let html='<h3>'+esc(pre.name)+'</h3><p class="source">'+esc(sourceLabel('companion',pre.page))+'</p><p>One education entry attempt is allowed this term. Failed entry leaves the term available for a career. Required world details are recorded explicitly, not guessed from the homeworld name.</p>';
 if(id==='companion.colonial')html+='<label>Homeworld technology level<input id="education-tl" type="number" min="0" max="40" step="1" value="'+esc(config.homeworld?.techLevel??'')+'" placeholder="Required number, for example 8"></label><p class="help">TL 8 or below grants entry. Other worlds require a referee decision. Normal first-term timing becomes age 22 + 2D3.</p>';
 if(id==='companion.spacer')html+='<label>Homeworld size code as a number<input id="education-size" type="number" min="0" max="40" step="1" value="'+esc(config.homeworld?.size??'')+'" placeholder="0 for a belt or space habitat"></label><p class="help">Size 0 grants entry. Other sizes use the published INT check.</p>';
 if(id==='companion.merchant')html+='<label>Academy curriculum<select id="education-curriculum"><option value="">Choose a curriculum</option><option value="business" '+(config.curriculum==='business'?'selected':'')+'>Business: Merchant broker skills</option><option value="shipboard" '+(config.curriculum==='shipboard'?'selected':'')+'>Shipboard: Merchant marine skills</option></select></label><p class="help">Your curriculum determines initial skills, graduation choices and the matching first-career branch.</p>';
 if(id==='companion.psionic')html+='<p class="warning">First-term childhood potential testing and ordered talent acquisition are automated before admission. Other timing or earlier training needs an explicit source ruling. No talent is granted by assumption.</p>'+(config.psionicTrainingComplete?'<p>Recorded PSI: '+esc(state.character.stats.PSI)+'. Acquired talents: '+esc(config.acquiredTalents.join(', ')||'none')+'.</p>':'');
 if(id==='companion.hard-knocks')html+='<p class="help">SOC 6 or below grants entry. Higher or absent SOC requires a source decision.</p>';
 return html+'<div class="actions">'+button(id==='companion.psionic'&&!config.psionicTrainingComplete?'Begin psionic testing and training':'Check entry and continue','companion-entry')+button('Back to education options','cancel-education','quiet')+'</div>';
}
function companionSkillView(state){
 const e=state.pendingChoice,choices=companionSkillSuggestions(state,catalog);
 return '<p>Choose exactly <strong>'+(e.count??1)+'</strong> distinct skills. '+(e.mode==='increase'?'Increase each by '+e.value:'Gain each at least level '+e.value)+'.</p><p class="help">Available: '+state.educationOptions.map(o=>esc(o.name)).join(', ')+'. '+(e.value>0?'Include a speciality where required, for example Engineer (power).':'Use base skill names, without specialities.')+(e.requiredLevel!==undefined?' Each choice must currently be at level '+e.requiredLevel+'.':'')+(e.existingOnly?' Choose a skill you already possess.':'')+'</p>'+Array.from({length:e.count??1},(_,i)=>'<label>Study choice '+(i+1)+'<input data-companion-skill list="companion-study-options" maxlength="80" autocomplete="off"></label>').join('')+'<datalist id="companion-study-options">'+[...new Set(choices)].map(n=>'<option value="'+esc(n)+'"></option>').join('')+'</datalist><div class="actions">'+button('Record these choices','companion-skill')+button('Cannot satisfy this printed choice','companion-choice-source','quiet')+'</div>';
}
function companionDecisionView(state){
 const p=state.pending;
 if(p.kind==='zhodani-anagathic-ageing')return '<label>Source-confirmed anagathic terms for this ageing check<input id="ageing-anagathic-terms" type="number" min="0" max="'+esc(p.ageingTerms)+'" step="1"></label><p class="help">This records the ageing-table modifier only. Drug access, costs and other consequences are separate source decisions.</p>';
 if(p.kind==='zhodani-ageing-psi')return '<label class="check"><input id="ageing-psi-confirmed" type="checkbox"><span>The referee confirms PSI as this ageing mental loss. Record the reason below.</span></label>';
 if(p.kind==='career-transfer')return '<label>Target career rank track<select id="transfer-rank-track"><option value="">Choose from source and referee ruling</option>'+p.rankTracks.map(track=>'<option value="'+esc(track)+'">'+esc(track==='officer'?'Officer':'Enlisted')+'</option>').join('')+'</select></label>';
 if(p.kind==='missing-characteristic-check')return '<p>Record the source-approved check only. Resolve its consequences after continuing. Do not enter a replacement characteristic.</p><div class="form-grid"><label>Unmodified 2D total<input id="source-check-natural" type="number" min="2" max="12" step="1"></label><label>Final modified total<input id="source-check-total" type="number" min="-100" max="100" step="1"></label></div>';
 if(p.kind==='companion-psionic-testing')return '<h3>Verified psionic training</h3><p>Use Core p. 228 and the campaign ruling. Enter the tested potential and only successfully acquired talents. No tests are automated here.</p><label>Tested PSI<input id="education-psi" type="number" min="0" max="40" step="1" value="'+esc(state.character.stats.PSI??'')+'"></label><fieldset><legend>Acquired talents</legend>'+['Telepathy','Clairvoyance','Telekinesis','Awareness','Teleportation','Technopathy'].map(n=>'<label class="check"><input type="checkbox" name="education-talents" value="'+n+'" '+(Object.hasOwn(state.character.skills,n)?'checked':'')+'><span>'+n+'</span></label>').join('')+'</fieldset><p class="tiny">Technopathy requires its own expansion source. Record acquisition rolls and training in the outcome notes.</p>';
 if(p.kind==='companion-entry')return '<label>Source admission decision<select id="education-entry-decision"><option value="">Choose the referee decision</option><option value="yes">Entry permitted</option><option value="no">Entry refused; continue to careers</option></select></label>';
 if(p.kind==='companion-career-rights')return p.citizenMapping?'<label>Does this Citizen assignment match the saved Merchant curriculum?<select id="education-citizen-decision"><option value="">Choose the referee decision</option><option value="yes">Yes, use the curriculum entry benefit</option><option value="no">No, use normal qualification</option></select></label>':'<p>Record the modifiers from this education path only, not total career modifiers.</p><div class="form-grid"><label>Qualification DM<input id="education-qualification-dm" type="number" min="-12" max="12" step="1"></label><label>Commission DM<input id="education-commission-dm" type="number" min="-12" max="12" step="1"></label><label>Advancement DM<input id="education-advancement-dm" type="number" min="-12" max="12" step="1"></label></div><label>Automatic entry?<select id="education-entry-right"><option value="">Choose the referee decision</option><option value="yes">Yes</option><option value="no">No</option></select></label>';
 if(p.kind==='companion-timing')return '<label>Age after the education term<input id="education-age-after" type="number" min="'+state.character.age+'" max="1000" step="1"></label><p class="help">One education term is recorded. Explain any additional elapsed years and species-specific timing in the notes.</p>';
 if(p.kind==='companion-graduation')return '<label>Graduation decision<select id="education-graduation-decision"><option value="">Choose the referee decision</option><option value="failed">Did not graduate</option><option value="graduate">Graduated</option><option value="honours">Graduated with honours</option></select></label><p class="help">Record all graduation awards using the effect controls. Native awards will not be added again.</p>';
 if(p.kind==='companion-skill-choice')return '<label>Adjudicated selected skill names, one per line<textarea id="education-selected-names" rows="4" maxlength="800"></textarea></label><p class="help">Also record the resulting skill effects above. Explain why the normal constrained selection could not be satisfied.</p>';
 return '';
}
function careerTransferNotice(state,careerId){
 const rights=(state.careerTransferOptions??[]).filter(right=>right.careerId===careerId&&right.available);
 if(!rights.length)return '';
 return '<div class="notice"><strong>Next-term transfer available</strong>'+rights.map(right=>'<p>'+esc(right.assignmentId?catalog.careers.find(c=>c.id===careerId)?.assignments.find(a=>a.id===right.assignmentId)?.name??right.assignmentId:'Any eligible assignment')+(right.rank!==null&&right.rank!==undefined?' · rank '+esc(right.rank):'')+(right.needsRankTrackDecision?' · rank track needs a referee ruling':'')+'</p>').join('')+'</div>';
}
function careerQualificationLabel(state,career){
 if(career.aslanAccess?.automatic)return 'automatic via recorded outward source right';
 const ordinary=career.qualification?career.qualification.stat+' '+career.qualification.target+'+':'automatic';
 const rights=(state.careerTransferOptions??[]).filter(right=>right.careerId===career.id&&right.available);
 if(rights.some(right=>!right.assignmentId))return 'automatic via recorded transfer';
 if(rights.length)return 'automatic transfer for '+rights.map(right=>career.assignments.find(a=>a.id===right.assignmentId)?.name??right.assignmentId).join(', ')+'; otherwise '+ordinary;
 return ordinary;
}
function careerView(state){
 const list=state.careerChoices;const c=list.find(c=>c.id===selectedCareer);
 if(c){
 return button('Back to career list','career-list','quiet')+'<h3>'+esc(c.name)+'</h3><p class="source">'+esc(sourceLabel(c.source,c.page))+'</p>'+careerTransferNotice(state,c.id)+(c.sourceConflict?'<p class="warning">'+esc(c.sourceConflict)+'</p>':'')+'<label>Assignment<select id="career-assignment">'+options(c.assignments,(c.assignments.find(a=>!a.disabled)??c.assignments[0]).id)+'</select></label>'+c.assignments.filter(a=>a.disabled).map(a=>'<p class="tiny">'+esc(a.name)+': '+esc(a.reason)+'</p>').join('')+'<p class="help">Qualification: '+esc(careerQualificationLabel(state,c))+'. Entry decisions and any rolls are logged.</p>'+button('Attempt this career','career','',c.disabled?'disabled':'')+(c.reason?'<p>'+esc(c.reason)+'</p>':'');
 }
 return '<p>Choose a career for term '+(state.character.terms+1)+'. Options follow your species and upbringing.</p><div class="choice-list">'+list.map(c=>'<div class="career-choice-row">'+careerInfoButton(c,{esc})+button('<span><strong>'+esc(c.name)+'</strong><small>'+esc(sourceLabel(c.source,c.page))+(c.reason?' · '+esc(c.reason):'')+'</small></span>','select-career','choice','data-id="'+c.id+'" '+(c.disabled?'disabled':''))+'</div>').join('')+'</div><div class="actions">'+button('Finish character','finish','quiet',state.finishOptions?.available===false?'disabled':'')+(state.finishOptions?.reason?'<p class="help">'+esc(state.finishOptions.reason)+'</p>':'')+(state.canChooseEducation?button('Review education options','open-precareer','quiet'):'')+'</div>';
}
function effectView(effect,index){
 const games=projection.state.stage==='psionic-games-decisions';
 const skill=effect.kind==='skill',stat=effect.kind==='stat';
 return '<div class="effect" data-effect="'+index+'"><div class="form-grid"><label>Effect<select data-field="kind">'+options([{id:'skill',name:'Skill'},{id:'stat',name:'Characteristic change'},{id:'cash',name:'Cash'},{id:'debt',name:'Debt'},{id:'relationship',name:'Contact / relationship'},{id:'benefit',name:'Benefit'}].filter(x=>!games||['stat','cash','debt','relationship'].includes(x.id)),effect.kind)+'</select></label><label>Name'+(skill?'<input data-field="name" list="skill-names" value="'+esc(effect.name)+'" placeholder="Skill or Skill (specialisation)">':stat?'<select data-field="name">'+options(Object.keys(projection.state.character.stats),effect.name)+'</select>':'<input data-field="name" value="'+esc(effect.name)+'">')+'</label><label>Value / change<input data-field="value" type="number" value="'+effect.value+'" min="-10000000" max="10000000" step="1"></label>'+ (skill?'<label>Skill award<select data-field="mode">'+options([{id:'increase',name:'Increase by'},{id:'set',name:'Gain at least this level'}],effect.mode)+'</select></label>':effect.kind==='relationship'?'<label>Relationship<select data-field="role">'+options(['Contact','Ally','Rival','Enemy'],effect.role)+'</select></label>':'')+'</div>'+button('Remove effect','remove-effect','quiet','data-index="'+index+'"')+'</div>';
}
function psionicTrainingView(state){
 const training=state.psionicTraining;
 return '<p>Choose the order of your talent attempts. Every attempt and its dice stay in your permanent action log. A successful first acquisition grants level 0.</p><p class="source">'+esc(training?.source?.id?sourceLabel(training.source.id,training.source.page??training.source.pages?.[0]):'Core 2022 pp. 228-229; Aliens 2026 pp. 254-256 where applicable')+'</p><p class="help">'+(training?.mode==='retry'?'This is the specific talent opportunity awarded by your career.':'Each available talent can be attempted once in this training period. You may finish without attempting the others.')+'</p><div class="choice-list">'+state.psionicOptions.map(o=>button('<span><strong>'+esc(o.talent)+'</strong><small>'+(o.automatic?'Automatic first-choice Telepathy; no roll':('Learning DM '+(o.learningDM>=0?'+':'')+o.learningDM+'; previous-check penalty -'+o.previousChecks))+'</small></span>','learn-talent','choice','data-talent="'+esc(o.talent)+'"')).join('')+'</div>'+(state.psionicCanFinish?'<div class="actions">'+button('Finish this training period','finish-psionic-training','quiet')+'</div>':'');
}
function injuryLossView(state){
 const injury=state.currentInjury;
 return '<p>The injury table result and severity dice are recorded. Choose which permitted characteristics take the loss.</p><p class="source">Core 2022, p. 49</p><div class="choice-list">'+state.injuryOptions.map((o,index)=>button(esc(o.label),'injury-loss','choice','data-index="'+index+'"')).join('')+'</div>';
}
function injuryTreatmentView(state){
 const loss=state.injuryRestorable;
 return '<p>Choose how many points to restore, up to the injury loss. Treatment costs Cr5,000 per point before any employer contribution. Bills are settled from cash at the end of creation; any unpaid personal balance becomes debt.</p><p class="source">Core 2022, p. 49</p><div class="form-grid">'+Object.entries(loss).filter(([,n])=>n>0).map(([key,n])=>'<label>'+esc(key)+' points to restore<input data-injury-restore="'+key+'" type="number" min="0" max="'+n+'" step="1" value="0"><small>Up to '+n+' points</small></label>').join('')+'</div><label class="check"><input id="injury-in-service" type="checkbox" checked><span>The injury occurred while serving this employer. Check any source-specific exclusions.</span></label><p class="help">Leaving all values at zero declines treatment without rolling an employer contribution.</p>'+button('Record treatment choice','injury-treatment');
}
function benefitDecisionView(state){
 const p=state.pending;
 if(p.kind==='benefit-equipment')return equipmentCatalogueView(p,esc)+'<h3>Select the awarded equipment</h3><p>Category: <strong>'+esc(p.category)+'</strong>. Limit: Cr'+p.maximumCost.toLocaleString()+' and TL '+p.maximumTL+'.'+(p.restrictions?.length?' Restrictions: '+p.restrictions.map(esc).join(', ')+'.':'')+'</p><div class="form-grid"><label>Item name<input id="benefit-item-name" maxlength="120"></label><label>Listed cost in credits<input id="benefit-item-cost" type="number" min="0" max="'+p.maximumCost+'" step="1"></label><label>Technology level<input id="benefit-item-tl" type="number" min="0" max="'+p.maximumTL+'" step="1"></label>'+(p.weaponSkillRequired?'<label>Required weapon skill<select id="benefit-weapon-skill"><option value="">Choose the matching skill</option>'+options(p.weaponSkillOptions??[],'')+'</select></label>':'')+'</div>'+(p.replacementAssetIds?.length?'<label>Original asset to replace<select id="benefit-replace-asset">'+p.replacementAssetIds.map(id=>'<option value="'+esc(id)+'">'+esc(state.character.assets?.find(a=>a.id===id)?.name??id)+'</option>').join('')+'</select></label>':'')+'<p class="help">Use your book to confirm the item, category, cost, technology and any weapon skill. The selection and source decision remain in the log.</p>';
 if(p.kind==='benefit-ship')return '<h3>Resolve the ship award</h3>'+(p.model?'<p>Model: <strong>'+esc(p.model)+'</strong></p>':'')+'<p>Ownership: '+esc(p.ownership??'See source')+'.'+(p.mortgagePaidPercent!=null?' Mortgage paid after this award: '+p.mortgagePaidPercent+'%.':'')+'</p>'+(p.variants?.length?'<label>Ship variant<select id="benefit-ship-variant">'+options(p.variants,p.variants[0])+'</select></label>':'')+(p.historyTable?'<p class="warning">History table: '+esc(p.historyTableLabel??p.historyTable)+'. Recorded rolls to resolve: '+p.historyRollCount+'. Outdated Ships and Spacecraft Quirks are different procedures.</p><label>Source-confirmed ship history<textarea id="benefit-ship-history" rows="4" maxlength="2000" placeholder="Record results and the referee ruling, not copied book text."></textarea></label>':'');
 if(p.kind==='benefit-source'&&p.sainthood)return '<h3>Resolve the sainthood check</h3><p>Candidacy '+p.sainthood.candidacy+' grants check DM +'+p.sainthood.checkBonus+'. Target: '+p.sainthood.target+'+. Use '+esc(p.sainthood.skill)+' with the actual faith speciality and record the roll and modifiers in the outcome notes.</p><label>Source-confirmed check result<select id="benefit-sainthood"><option value="">Choose the result</option><option value="yes">Succeeded</option><option value="no">Failed</option></select></label><p class="help">The resulting interaction modifier is fixed, not added repeatedly for each candidacy.</p>';
 if(p.kind==='benefit-source')return '<h3>Choose how the source outcome is recorded</h3><label>Resolution<select id="benefit-resolution"><option value="">Choose a source decision</option><option value="record">Record a named entitlement</option><option value="effects">Apply the explicit effects entered above</option><option value="none">No award, with a source explanation</option></select></label><label>Entitlement name, when recording one<input id="benefit-outcome-name" maxlength="120"></label>';
 if(p.kind==='pension')return '<h3>Record the pension ruling</h3><label>Annual pension in credits<input id="pension-annual" type="number" min="0" max="1000000000" step="1"></label><label>Payment conditions<input id="pension-condition" maxlength="300" placeholder="For example location or membership restrictions"></label>';
 return '';
}
function careerPensionLabel(record){
 if(!record.pension)return '';
 const basis=record.pensionExitStatusBasis;
 return ' | '+(record.pensionStatusReviewRequired?'Pension needs source review; recorded exit amount ':'Annual pension ')+'Cr'+record.pension.toLocaleString()+(record.pensionCondition?' ('+esc(record.pensionCondition)+')':'')+(basis?' · assessed at exit as '+esc(basis.socialClass)+' (SOC '+basis.soc+')':'')+(record.pensionStatusReviewRequired?'. Later social class changed; confirm the entitlement under Aliens p. 277.':'');
}
function ongoingBenefitSheet(state){
 const c=state.character,income=c.annualIncome??[],saint=c.sainthood;
 return (state.followingInteractionDM!=null?'<div class="sheet-section"><h3>Following</h3><p>Source-defined interaction DM: <strong>+'+state.followingInteractionDM+'</strong> (Companion p. 36). This is separate from ordinary characteristic checks.</p></div>':'')+(income.length?'<div class="sheet-section"><h3>Annual income</h3><ul class="compact-list">'+income.map(i=>'<li>'+esc(i.name)+': <strong>Cr'+i.annualCredits.toLocaleString()+' per year</strong>'+(i.condition?'. '+esc(i.condition):'')+'</li>').join('')+'</ul><p class="tiny">Recurring entitlements are separate from available cash and career pensions.</p></div>':'')+(saint?'<div class="sheet-section"><h3>Faith recognition</h3><p>Candidacies: '+saint.candidacies+'. Source-defined interaction DM: +'+saint.interactionDM+'.</p><p class="tiny">Apply only to the interactions covered by the source. The modifier is not cumulative for each candidacy.</p></div>':'');
}
function assetHistory(history){
 if(!history)return '';
 if(typeof history==='string')return esc(history);
 const label=history.table==='core.spacecraft-quirks'?'Spacecraft Quirks':history.table==='core.outdated-ships'?'Outdated Ships':history.table??'Ship history';
 return esc(label+(history.count?' ('+history.count+' recorded rolls)':'')+': '+(history.resolution??'See the recorded source decision.'));
}
function assetSheet(state){
 const assets=(state.character.assets??[]).filter(a=>a.active!==false&&a.category!=='land'),pending=deferredEquipmentSummary(state,{esc,sourceLabel});if(!assets.length)return pending;
 return pending+'<div class="sheet-section"><h3>Equipment & ships</h3><ul class="compact-list">'+assets.map(a=>'<li><strong>'+esc(a.name??a.variant??a.model??a.id)+'</strong>'+(a.creditId&&a.quantity?' × '+a.quantity:'')+(a.category?' ('+esc(a.category)+')':'')+(a.cost!==undefined?' | Cr'+a.cost.toLocaleString():'')+(a.techLevel!==undefined?' | TL '+a.techLevel:'')+(a.itemSource?' | '+esc(sourceLabel(a.itemSource.id,a.itemSource.page)):'')+(a.weaponSkill?' | '+esc(a.weaponSkill):'')+(a.mortgagePaidPercent!=null?' | Mortgage '+a.mortgagePaidPercent+'% paid':'')+(a.ownership?' | '+esc(a.ownership):'')+(a.owner?' (owner: '+esc(a.owner)+')':'')+(a.recallable?' | Subject to recall':'')+clanAssetSheetDetail(a,{esc})+(a.description?'<div class="multiline">'+esc(a.description)+'</div>':'')+(a.detailsPending?' | Description pending':'')+(a.history?'<div class="multiline">'+assetHistory(a.history)+'</div>':'')+'</li>').join('')+'</ul></div>';
}
function psionicDecisionView(state){
 const p=state.pending;
 if(p.kind==='psionic-training-terms')return '<h3>Referee approval for training</h3><p>Use the source to establish access, payment and timing. Ordinary institute training costs Cr100,000 and takes four months; testing, when needed, costs at least Cr5,000 and takes two weeks. Childhood or community training may have different arrangements.</p><label>Training decision<select id="psionic-approved"><option value="">Choose the referee decision</option><option value="yes">Approved under the recorded terms</option><option value="no">Not approved</option></select></label><div class="form-grid"><label>Total approved cost in credits<input id="psionic-cost" type="number" min="0" max="1000000000" step="1" value="'+(p.minimumCost??0)+'"></label><label>Funding<select id="psionic-funding"><option value="cash">Pay from available cash</option><option value="provided">Provided at no personal cost</option></select></label></div><p class="tiny">Provided training requires cost 0 and an explanation in the outcome notes. No loan is created automatically.</p><label class="check"><input id="psionic-timing" type="checkbox"><span>The referee confirmed how training time fits this life path.</span></label>';
 if(p.kind==='psionic-history')return '<h3>Establish earlier training history</h3><p>Existing talents do not prove how many acquisition checks were attempted. Record the referee-confirmed history before another attempt.</p><label>Previous talent acquisition checks<input id="psionic-previous-checks" type="number" min="0" max="1000" step="1"></label><label class="check"><input id="psionic-first-chosen" type="checkbox"><span>A first talent has already been chosen.</span></label><fieldset><legend>Previously attempted talents</legend>'+['Telepathy','Clairvoyance','Telekinesis','Awareness','Teleportation','Technopathy'].map(name=>'<label class="check"><input type="checkbox" name="psionic-attempted" value="'+name+'"><span>'+name+'</span></label>').join('')+'</fieldset>';
 return '';
}
function psionicSheet(state){
 const p=state.character.psionics,loss=state.character.psionicLoss?.permanent;
 if(!p&&!loss)return '';
 return '<div class="sheet-section"><h3>Psionic training record</h3>'+(loss?'<p class="warning"><strong>Permanent psionic loss from ageing.</strong> Learned talents remain as historical records and are unavailable. A GM can restore or replay the originating action to record an explicit correction.</p>':'')+(p?'<p>Acquisition checks attempted: <strong>'+p.checksAttempted+'</strong>. '+(p.historyKnown?'Prior history recorded.':'Prior history requires source confirmation.')+'</p>'+(p.attempts?.length?'<ul class="compact-list">'+p.attempts.map(a=>'<li>'+esc(a.talent)+': '+(a.success?'acquired at level 0':'not acquired')+(a.automatic?' (automatic first choice)':' (total '+a.total+' against '+a.target+'+)')+'</li>').join('')+'</ul>':''):'<p>No acquisition history is recorded.</p>')+'<p class="tiny">Talent records are shown in Skills. Original attempts and later changes remain in the action log.</p></div>';
}

function gamesCheckList(record){
 const rows=record?.audit??[];
 return rows.length?'<ol class="compact-list">'+rows.map(r=>'<li>'+esc(r.talent??r.phase)+': ['+(r.dice??[]).join(', ')+'] + '+r.modifier+' = <strong>'+r.total+'</strong> against '+r.target+'+ ('+(r.success?'success':'not successful')+')</li>').join('')+'</ol>':'';
}
function psionicGamesView(state){
 const g=state.currentPsionicGames;
 let html='<p class="source">Aliens 2026, p. 242. Ordinary checks use Core 2022.</p><p>Your successful application reserves one four-year term in your current career. There is no ordinary training, survival or advancement roll. All application and competition rolls remain in the log.</p>'+gamesCheckList(g);
 if(state.stage==='psionic-games-preliminaries')return html+'<h3>Choose the next talent check</h3><p>Check each talent you possessed when applying exactly once. Choose the order; failed checks still count.</p><div class="choice-list">'+state.psionicGamesOptions.map(o=>button('<span><strong>'+esc(o.talent)+'</strong><small>Talent level '+o.level+' · target '+o.target+'+</small></span>','psionic-games-preliminary','choice','data-talent="'+esc(o.talent)+'"')).join('')+'</div>';
 if(state.stage==='psionic-games-final')return html+'<p>Preliminary successes: '+g.preliminaries.successes+'. Failures: '+g.preliminaries.failures+'. Final competition modifier: '+(g.preliminaries.competitionModifier>=0?'+':'')+g.preliminaries.competitionModifier+'. The final uses PSI, without adding a talent level.</p>'+button('Roll the Games final','psionic-games-final');
 html+='<h3>'+(g.final?.won?'Final won':'Final not won')+'</h3><p class="warning">The source leaves ordinary event handling and overlapping PSI awards open to interpretation. Record the referee decision before the term is applied. These choices are not automatic rules.</p><label>Ordinary career event decision<select id="games-event-mode"><option value="">Choose a source ruling</option><option value="omit">Omit an ordinary event this Games term</option><option value="resolved-externally">Event resolved separately from the source</option></select></label><label>Reason and event outcome<textarea id="games-event-reason" maxlength="500" rows="3" placeholder="Record the ruling and any external check results, without copying source passages."></textarea></label><div id="games-event-effects" hidden><p>Record verified cash, debt, characteristic or relationship effects. Skill gains, rank changes, extra terms, career transfers and other complex consequences are not supported in this Games route.</p><div id="effect-list">'+effects.map(effectView).join('')+'</div>'+button('Add an event effect','add-effect','quiet')+'<label class="check"><input id="games-effects-confirm" type="checkbox"><span>All event consequences are represented here. If there are no effects, I explicitly confirm that no mechanical change is needed.</span></label></div>';
 if(state.psionicGamesNeedsStacking)html+='<label>Overlapping PSI awards<select id="games-stacking-mode"><option value="">Choose the referee ruling</option><option value="additive">Add both awards: PSI +3</option><option value="winner-replaces-preliminary">Winner award replaces the preliminary award: PSI +2</option></select></label><label>Reason for this interpretation<textarea id="games-stacking-reason" maxlength="500" rows="2"></textarea></label>';
 return html+'<div class="actions">'+button('Record decisions and complete Games term','complete-psionic-games')+'</div>';
}
function psionicGamesSheet(state){
 const applications=state.character.psionicGames?.applications??[];
 return applications.length?'<div class="sheet-section"><h3>Psionic Games record</h3><p>Lifetime application used. Restoring or replacing an earlier action requires GM mode and preserves the original history.</p>'+applications.map(g=>'<h4>'+esc(g.status.charAt(0).toUpperCase()+g.status.slice(1).replaceAll('-',' '))+'</h4>'+gamesCheckList(g)+(g.completion?'<p>One Games term recorded in the existing career, including its benefit accounting and any due ageing.</p>':'')).join('')+'</div>':'';
}
function medicalDecisionView(state){
 const p=state.pending;
 if(p.kind==='injury-medical')return '<p>This employer needs a source ruling. Total treatment cost: <strong>Cr'+p.totalCost.toLocaleString()+'</strong>. Only the uncovered balance will be charged.</p><label>Employer contribution in credits<input id="medical-covered-cost" type="number" min="0" max="'+p.totalCost+'" step="1"></label>';
 if(p.kind==='injury-zero')return '<p>The loss would reduce a characteristic to zero or below. Record the source ruling before the injury is committed.</p><label>Outcome<select id="injury-survives"><option value="">Choose the ruling</option><option value="yes">Survives</option><option value="no">Dies</option></select></label><div class="form-grid">'+Object.keys(p.rawAfter).filter(k=>p.rawAfter[k]!==p.statsBefore[k]).map(k=>'<label>Final '+k+'<input data-injury-final="'+k+'" type="number" min="0" max="'+p.statsBefore[k]+'" step="1"><small>Before: '+p.statsBefore[k]+'. Unresolved loss would leave: '+p.rawAfter[k]+'.</small></label>').join('')+'</div>';
 if(p.kind==='ageing-financing')return '<p>Immediate ageing care costs <strong>Cr'+p.cost.toLocaleString()+'</strong>; the shortfall is Cr'+p.shortfall.toLocaleString()+'. Approving care requires recording valid funding effects above so the bill can be paid. No loan is created automatically.</p><label>Source care decision<select id="ageing-care"><option value="">Choose the ruling</option><option value="yes">Care approved and funded</option><option value="no">Care unavailable; record death</option></select></label>';
 return '';
}
function medicalSheet(state){
 const bills=state.character.medicalBills??[];
 if(!bills.length)return '';
 return '<div class="sheet-section"><h3>Medical bills</h3><p>Unsettled personal balance: <strong>Cr'+(state.medicalOutstanding??0).toLocaleString()+'</strong></p><ul class="compact-list">'+bills.map(b=>'<li>Cr'+b.totalCost.toLocaleString()+' treatment; employer Cr'+b.coveredCost.toLocaleString()+'; personal Cr'+b.personalCost.toLocaleString()+'. '+(b.settled?'Paid Cr'+b.paid.toLocaleString()+', debt Cr'+b.debt.toLocaleString()+'.':'Settles when creation finishes.')+'</li>').join('')+'</ul></div>';
}
function bookView(state){
 const aslanEvent=aslanEventOutcomesView(state,{button,esc});if(aslanEvent&&aslanManualReviewKey!==JSON.stringify([projection.revision,state.pending]))return aslanEvent+button('Review exceptional source outcome','aslan-source-review','quiet');
 if(state.pending.kind==='prisoner-lawyer')return prisonerLawyerView(state,{esc,button});
 if(state.pending.kind==='core-life-decision')return coreLifeEventView(state,{esc,button,sourceLabel});
 const p=state.pending,effectAllowed=!p.sainthood&&!['zhodani-anagathic-ageing','zhodani-ageing-psi','career-transfer','companion-psionic-testing','companion-entry','companion-career-rights','missing-characteristic-check','injury-medical','injury-zero','psionic-training-terms','psionic-history','benefit-equipment','benefit-ship','pension'].includes(p.kind);

 return (aslanEvent?button('Return to event choices','aslan-event-choices','quiet'):'')+'<p class="warning"><strong>Book required for this step.</strong> This is an explicit manual source lookup, not an automated rule result.</p>'+(p.kind==='native-effect'?'<p class="help">Only the effects entered below are applied. Future roll modifiers, career permissions and other unsupported consequences must be tracked separately in your notes and with the referee; confirming this step does not automate them.</p>':'')+'<h3>'+esc(p.label)+'</h3><p class="source">'+esc(sourceLabel(p.source,p.page))+'</p><p>Read the indicated outcome. Record its effects below, including any choices or follow-up checks in your notes. Do not paste source-book passages.</p>'+skillChoiceProgress(p.effect,esc)+(effectAllowed?'<div id="effect-list">'+effects.map(effectView).join('')+'</div>'+button('Add an effect','add-effect','quiet'):'<p class="help">Use the decision fields below. Consequences are resolved separately.</p>')+'<datalist id="skill-names">'+catalog.skills.flatMap(base=>[base,...(catalog.skillSpecialities?.[base]??[]).map(speciality=>base+' ('+speciality+')')]).map(x=>'<option value="'+esc(x)+'"></option>').join('')+'</datalist><label style="margin-top:20px">Outcome notes<textarea id="book-note" rows="3" maxlength="500" placeholder="Your decision, check totals and consequences"></textarea></label>'+(p.kind==='precareer'?'<div class="inline-fields"><label>Years elapsed<input id="book-years" type="number" value="4" min="0" max="16"></label><label class="check"><input id="book-graduated" type="checkbox"><span>Graduated</span></label></div>':'')+(p.kind==='species-setup'&&state.character.species==='aslan'?'<label>Family position<select id="birth-order"><option value="">Choose from source rules</option><option value="first-son">First son</option><option value="second-son">Second son / later son</option><option value="daughter">Daughter</option></select></label>':'')+(p.kind==='mishap'?'<label class="check"><input id="book-leave" type="checkbox" checked><span>Leave career because of this mishap</span></label><label class="check"><input id="book-keep-benefit" type="checkbox"><span>The source explicitly preserves this term Benefit roll</span></label>':'')+(p.kind==='education-entry-rights'?'<label class="check"><input id="education-auto-entry" type="checkbox"><span>The referee permits automatic entry, with no first-term commission</span></label>':'')+(state.education!==undefined&&state.education!==null&&p.kind==='native-effect'?'<h3>Education consequences</h3><label class="check"><input id="education-no-graduation" type="checkbox"><span>The source prevents graduation this term</span></label><label>Required next career, only if the source specifies one<select id="education-next-career"><option value="">No required career</option>'+options(catalog.careers,'')+'</select></label>':'')+companionDecisionView(state)+medicalDecisionView(state)+psionicDecisionView(state)+benefitDecisionView(state)+'<label class="check"><input id="book-confirm" type="checkbox"><span>I checked the source and recorded all effects.</span></label><div class="actions">'+button('Record outcome and continue','resolve-book')+(p.deferredContext==='finalization'?button('Cancel','cancel-deferred-equipment','quiet'):'')+(p.kind==='career-transfer'?button('Back to career choices','cancel-career-transfer','quiet'):'')+(p.kind==='native-effect'&&['skill-choice','skill-reduction-choice'].includes(p.effect?.kind)?button('Try a different skill choice','retry-skill-choice','quiet'):'')+'</div>';
}
function equipmentDetailsView(state){const p=state.pending;if(['landhold-details','equipment-credit-details'].includes(p.kind))return ledgerDetailsView(p,{esc,button,sourceLabel});if(p.kind==='artefact-details')return '<p>'+esc(sourceLabel(p.source,p.page))+'</p><p>This artefact is already yours. A placeholder, your own description, or leaving it unknown is fine. No value or powers are assumed.</p><label>Name or placeholder (optional)<input id="artefact-name" maxlength="120" placeholder="'+esc(p.benefitName)+'"></label><label>Description (optional)<textarea id="artefact-description" rows="4" maxlength="2000"></textarea></label><div class="actions">'+button('Save details','resolve-artefact-details')+button('Cancel','cancel-deferred-equipment','quiet')+'</div>';return '<p>'+esc(sourceLabel(p.source,p.page))+'</p>'+benefitDecisionView(state)+'<label>Source or referee note<textarea id="book-note" rows="2" maxlength="500"></textarea></label><label class="check"><input id="book-confirm" type="checkbox"><span>I checked this selection and its restrictions.</span></label><div class="actions">'+button('Record outcome and continue','resolve-book')+button('Cancel','cancel-deferred-equipment','quiet')+'</div>';}
function stageView(state,insideEquipmentDialog=false){
 const standaloneEventStory=educationEventStoryView(projection.educationEventContext,{esc});
 const checkpoint=educationCheckpointModel(projection);
 if(checkpoint){let choiceHtml='';if(checkpoint.mode==='existing-choice'){if(checkpoint.row===2&&educationPotentialModel(state))choiceHtml=educationPotentialView(educationPotentialModel(state));else if(checkpoint.row===10&&educationNestedChoiceModel(state))choiceHtml=educationNestedChoiceView(educationNestedChoiceModel(state),state,{esc});}if(checkpoint.mode!=='existing-choice'||choiceHtml)return educationCheckpointView(checkpoint,{esc,sourceLabel,choiceHtml,careerLabel:id=>catalog.careers.find(c=>c.id===id)?.name??id});}

 const educationModel=educationResultModel(projection);
 if(educationModel)return educationResultView(educationModel,{esc,button,sourceLabel,studyHtml:educationModel.study?educationSkillView(state,catalog,esc,button,{result:true}):''});
 const riteModel=aslanRitePopupModel(state);if(riteModel&&!(riteModel.equipment&&aslanManualReviewKey===JSON.stringify([projection.revision,state.pending])))return '<p>Your Rite of Passage</p>'+aslanRitePopupView({...riteModel,tagline:originTagline(riteTagKey(riteModel.rite),projection.log.findLast(event=>event.type==='roll-aslan-rite')?.id)},{esc});
 const prideModel=aslanPridePopupModel(state);if(prideModel)return '<p>Your pride</p>'+aslanPridePopupView({...prideModel,tagline:prideModel.pride?originTagline('pride:'+prideModel.pride.id,projection.log.findLast(event=>event.type==='roll-aslan-pride')?.id):''},{esc});
 const clanModel=aslanClanPopupModel(state);if(clanModel)return '<p>Your clan</p>'+aslanClanPopupView({...clanModel,tagline:clanModel.clan?originTagline('clan:'+clanModel.clan.type,projection.log.findLast(event=>event.type==='roll-aslan-clan')?.id):''},{esc});
 const estateModel=aslanEstatePopupModel(state);if(estateModel)return '<p>Your family estate</p>'+aslanEstatePopupView({...estateModel,tagline:originTagline(estateModel.birthOrder==='daughter'?'daughter':estateModel.minimum===null?'no-estate':'estate',projection.log.findLast(event=>['acknowledge-aslan-family','acknowledge-aslan-birth-order'].includes(event.type))?.id)},{esc});
 const birthModel=aslanBirthPopupModel(state);if(birthModel)return '<p>Your place in the family</p>'+aslanBirthPopupView({...birthModel,tagline:birthModel.birth?originTagline(birthModel.birth.id,projection.log.findLast(event=>event.type==='roll-aslan-birth-order')?.id):''},{esc});
 const familyModel=aslanFamilyPopupModel(state);if(familyModel)return '<p>Your family background</p>'+aslanFamilyPopupView({...familyModel,tagline:familyModel.die?familyTagline(state.currentAslanOrigin.family.band,familyModel.die,projection.log.findLast(event=>event.type==='roll-aslan-family')?.id):''},{esc});
 if(!insideEquipmentDialog&&(state.pending?.deferredContext==='finalization'||state.resolvingEquipmentTask&&state.effectNext==='equipment-finalization'))return equipmentFinalizationView(state,{esc,button,sourceLabel})+'<dialog id="equipment-dialog" aria-labelledby="equipment-dialog-title"><h2 id="equipment-dialog-title" tabindex="-1">'+esc(state.pending?.benefitName??'Weapon improvement')+' details</h2>'+(['benefit-equipment','artefact-details','landhold-details','equipment-credit-details'].includes(state.pending?.kind)?equipmentDetailsView(state):stageView(state,true))+(state.resolvingEquipmentTask?button('Cancel','cancel-deferred-equipment','quiet'):'')+'</dialog>';
 switch(state.stage){
 case 'equipment-finalization':return equipmentFinalizationView(state,{esc,button,sourceLabel});
 case 'identity':return setupView();
 case 'advisory-career':case 'advisory-cash':case 'advisory-cash-source':return advisoryView(state,{esc,button,sourceLabel,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id});
 case 'borrowed-event-roll':{const p=state.pendingBorrowedRoll;return '<h3>'+esc(p.label)+'</h3><p>'+esc(sourceLabel(p.source.id,p.source.page))+'</p><p>Roll '+esc(p.dice)+(p.target?' against '+esc(p.target)+'+':'')+'. This step has not been rolled yet.</p>'+button('Roll '+p.label,'roll-borrowed-event');}
 case 'cross-career-cover':return crossCareerCoverView(state,{esc,button,sourceLabel,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id});
 case 'cross-career-training':return crossCareerTrainingView(state,{esc,button,sourceLabel,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id});
 case 'relationship-event':return relationshipEventView(state,{esc,button,sourceLabel});
 case 'relationship-loss':return relationshipLossView(state,{esc,button,sourceLabel});
 case 'merchant-fine-roll':case 'merchant-fine-decision':return merchantFineView(state,{esc,button,sourceLabel});
 case 'reeducation-roll':case 'reeducation-fine':case 'reeducation-decisions':return reeducationView(state,{esc,button,sourceLabel});
 case 'psionic-training':return psionicTrainingView(state);
 case 'psionic-games-preliminaries':case 'psionic-games-final':case 'psionic-games-decisions':return psionicGamesView(state);
 case 'injury-loss':return injuryLossView(state);
 case 'injury-treatment':return injuryTreatmentView(state);
 case 'aslan-family':case 'aslan-birth-order':case 'aslan-estate':case 'aslan-clan':case 'aslan-pride':case 'aslan-rite':return aslanOriginView(state,{esc,button,sourceLabel});
 case 'statistics':return statisticsView(state);
 case 'background':return backgroundView(state);
 case 'precareer':return preCareerView(state);
 case 'companion-admission':return companionAdmissionView(state);
 case 'companion-skill':return companionSkillView(state);
 case 'career':return aslanHistoricalOptionsView(state,{esc,button})+aslanRestorationNotice(state,{esc})+aslanOfficerOffersView(state,{esc,button,sourceLabel})+careerView(state);
 case 'retirement':return '<p>Your early retirement choice ends further career and education entry. Benefits are resolved; you can now finish this Traveller.</p>'+button('Finish character','finish');
 case 'education-event':if(educationEventModel(state,projection))return educationEventView();return '<p>Your initial education awards are recorded. Roll one pre-career event before graduation.</p>'+button('Roll education event','education-event');
 case 'education-graduation':if(educationEventModel(state,projection))return educationGraduationView(educationEventModel(state,projection),{esc});return '<p>Roll your graduation check. Your initial skills are retained even if you do not graduate.</p>'+button('Roll graduation','education-graduation');
 case 'education-skill':if(educationNestedChoiceModel(state))return standaloneEventStory+educationNestedChoiceView(educationNestedChoiceModel(state),state,{esc});return educationSkillView(state,catalog,esc,button);
 case 'education-service':return '<p>Choose '+(state.pendingChoice.count-state.pendingChoice.picked.length)+' more distinct service skill'+(state.pendingChoice.count-state.pendingChoice.picked.length===1?'':'s')+' to gain at level 1.</p><div class="choice-list">'+state.pendingChoice.options.filter(n=>!state.pendingChoice.picked.includes(n)).map(n=>button(esc(n),'education-service','choice','data-name="'+esc(n)+'"')).join('')+'</div>';
 case 'education-check':if(educationNestedChoiceModel(state))return standaloneEventStory+educationNestedChoiceView(educationNestedChoiceModel(state),state,{esc});return '<p>Choose a skill learned or improved during this education term. Success increases the skill and records the tutor as a Rival.</p><label>Skill<select id="education-check-skill">'+options(state.educationCheckSkills,state.educationCheckSkills[0])+'</select></label>'+button('Roll the study challenge','education-check');
 case 'preterm-commission':return '<p>Your education allows a commission attempt before this career term. The award and any dice are recorded separately from ordinary advancement.</p><div class="actions">'+button('Attempt education commission','education-commission')+button('Continue without it','skip-education-commission','quiet')+'</div>';
 case 'failed-entry':return fallbackView(state,{esc,button});
 case 'book-step':return state.pending?.kind==='aslan-origin-source'?aslanOriginSourceView(state,{esc,button,sourceLabel}):state.pending?.kind==='aslan-historical-entry'?aslanHistoricalDecisionView(state,{esc,button,sourceLabel}):state.pending?.kind==='aslan-outlaw-restoration'?aslanOutlawRestorationView(state,{esc,button,sourceLabel}):state.pending?.kind==='aslan-restoration'?aslanRestorationView(state,{esc,button,sourceLabel}):state.pending?.kind==='aslan-officer-status'?aslanOfficerStatusView(state,{esc,button,sourceLabel}):bookView(state);
 case 'benefit-wager':return benefitWagerView(state,{esc,button,sourceLabel});
 case 'effect-choice':if(educationPotentialModel(state))return standaloneEventStory+educationPotentialView(educationPotentialModel(state));if(state.prisonerEscape)return prisonerEscapeView(state.prisonerEscape,{esc,button});return (state.lifeEventPresentation?'<h3>'+esc(state.lifeEventPresentation.title)+'</h3>':'')+'<p>'+esc(trainingContext(state)?.description??(isBasicTrainingChoice(state)?'Choose one skill at level 0.':state.lifeEventPresentation?.description??state.pendingChoice.label??'Choose the outcome you want to apply.'))+'</p>'+'<div class="choice-list">'+state.pendingChoice.options.map((option,index)=>option.available===false?'<p class="help">'+esc(option.label)+': '+esc(option.reason)+'</p>':option.information?trainingChoiceView(choiceLabel(option),option.information,'choose-effect','data-index="'+index+'"',{esc,button}):button(esc(state.lifeEventPresentation?.optionLabels?.[index]??choiceLabel(option)),'choose-effect','choice','data-index="'+index+'"')).join('')+'</div>'+(state.pendingChoice.unavailableOptions??[]).map(option=>'<p class="help">'+esc(option.label)+': '+esc(option.reason)+'</p>').join('');
 case 'skill-choice':return skillAwardView(state,catalog,{esc,button,sourceLabel,skillChoiceProgress});

 case 'training':return '<p>'+esc(trainingContext(state)?.description??'Choose an available training table. The rules engine will roll and apply its result.')+'</p><div class="choice-list">'+state.trainingOptions.map(t=>trainingChoiceView(t.name,t.information,'training','data-table="'+esc(t.id)+'"',{esc,button})).join('')+'</div>';
 case 'ageing':return '<p>Your Traveller has reached the next ageing checkpoint. The engine applies the species schedule and modifiers.</p>'+button('Roll ageing','ageing');
 case 'deceased':return '<p>This life path ended in death. The full record remains saved. A GM can restore an earlier action and record an explicit correction.</p>';
 case 'survival':return '<p>Training is recorded. Roll to see whether you complete this term safely.</p>'+button('Roll survival','survival-check');
 case 'career-event':return '<h3>Your career event</h3><p>You survived this term. Roll separately to discover what happened, then resolve its outcome before advancement.</p>'+button('Roll career event','career-event');
 case 'career-mishap':return '<h3>Your career mishap</h3><p>The survival check failed. Roll separately to discover the mishap and resolve its consequences.</p>'+button('Roll mishap','career-mishap');
 case 'advancement':{
 const record=state.character.careers[state.active],career=catalog.careers.find(c=>c.id===record.id),commission=state.commissionAvailability??{available:false,reason:'Commission is not available.'};
 return '<p>'+(career.noRank?'This career has no rank advancement. Complete the term after its events.':'Your term events are recorded. Resolve advancement for your assignment.')+'</p><div class="actions">'+button(career.noRank?'Complete career term':'Roll advancement','advancement')+(career.commission!==undefined?button(commission.automatic?'Accept the available commission':'Attempt a commission','commission','quiet',commission.available?'':'disabled'):'')+'</div>'+(career.commission!==undefined&&!commission.available?'<p class="help">'+esc(commission.reason)+'</p>':'');
 }
 case 'aslan-officer-entry':return aslanOfficerEntryView(state,{esc,button,sourceLabel,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id,assignmentName:(id,assignment)=>catalog.careers.find(c=>c.id===id)?.assignments.find(a=>a.id===assignment)?.name??assignment});
 case 'aslan-officer-rank':return aslanOfficerRankView(state,{esc,button,sourceLabel,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id,assignmentName:(id,assignment)=>catalog.careers.find(c=>c.id===id)?.assignments.find(a=>a.id===assignment)?.name??assignment});
 case 'assignment-entry':return assignmentEntryView(state,{esc,button,sourceLabel,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id,assignmentName:(id,assignment)=>catalog.careers.find(c=>c.id===id)?.assignments.find(a=>a.id===assignment)?.name??assignment});
 case 'term-end':{
 const record=state.character.careers[state.active],exits=state.exitOptions??{canContinue:!record.forcedExit,canLeave:!record.forcedStay};
 return aslanRestorationNotice(state,{esc})+'<p>You are now <strong>'+state.character.age+'</strong>. '+(record.forcedExit?'This career must end.':record.forcedStay?'Your natural 12 requires another term.':'Continue in this career or collect your benefits.')+'</p>'+(exits.retirementRequired?'<p class="warning">Changing this native Aslan career normally requires three terms. You may instead retire from character creation, collect benefits and finish.</p>':'')+'<div class="actions">'+button('Continue this career','continue-career','',exits.canContinue?'':'disabled')+button('Leave and take benefits','leave-career','quiet',exits.canLeave?'':'disabled')+(exits.canRetire?button('Retire from creation and take benefits','retire-career','quiet'):'')+'</div>'+(state.psionicGamesAvailability?.available?'<div class="sheet-section"><h3>Psionic Games opportunity</h3><p>Apply once in your lifetime. A failed application still uses that opportunity. Success replaces your next ordinary term with a Games term in this career.</p>'+button('Apply for the Psionic Games','apply-psionic-games','quiet')+'</div>':'')+(!exits.canLeave&&exits.leaveReason?'<p class="help">'+esc(exits.leaveReason)+'</p>':'')+assignmentChangeView(state,{esc,button,sourceLabel})+aslanOfficerOffersView(state,{esc,button,sourceLabel});
 }
 case 'benefits':{const cash=cashRollDisplay(state);return aslanRestorationNotice(state,{esc})+aslanOfficerPendingView(state,{esc,button,sourceLabel,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id,assignmentName:(id,assignment)=>catalog.careers.find(c=>c.id===id)?.assignments.find(a=>a.id===assignment)?.name??assignment})+assignmentPendingView(state,{esc,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id,assignmentName:(id,assignment)=>catalog.careers.find(c=>c.id===id)?.assignments.find(a=>a.id===assignment)?.name??assignment})+'<p><strong>'+state.character.careers[state.active].benefitRolls+'</strong> benefit rolls remain. '+esc(cash.label)+': '+cash.used+' / '+(state.cashLimit===999?'unlimited':state.cashLimit)+'.</p>'+benefitCreditView(state,{esc})+coreLifeBenefitView(state,{esc})+'<div class="actions">'+button('Roll a material benefit','material-benefit')+button('Roll a cash benefit','cash-benefit','quiet',cash.disabled?'disabled':'')+'</div>';}
 case 'finish':return '<div class="final-sheet-invitation">'+button('Open your character sheet','open-character-sheet','final-sheet-button')+'<p>A compact view of your Traveller, completed terms, injuries, events and decisions.</p></div><p>Save or print your character and review the source-assisted steps with your referee. The complete action log is included.</p><p class="warning">This preview does not certify every source rule. It records which steps were manually resolved.</p><h3>Source-assisted coverage</h3><ul>'+state.coverage.map(x=>'<li>'+esc(coverageLabels[x]??x.replaceAll('-',' '))+'</li>').join('')+'</ul>';
 default:return '<p>Unsupported stage. Preserve your save and log.</p>';
 }
}
function printedNarrative(state){
 return '<section class="print-only sheet-section"><h3>Background notes</h3><p class="multiline">'+esc(state.character.notes||'No saved notes.')+'</p>'+(state.connections.length?'<h3>Connections</h3>'+state.connections.map(c=>'<p><strong>'+esc(c.person)+'</strong>: '+esc(c.note)+'<br>Connection skill: '+esc(c.skill)+'</p>').join(''):'')+'<p class="tiny">Source-assisted Beta 0.1. Review the recorded manual rulings with your referee.</p></section>';
}
function syncOpeningPortrait(form){
 const figure=$('#opening-portrait');if(!figure||!form)return;
 const species=form.elements.species.value,gender=form.elements.gender.value==='female'?'female':'male';
 $('#sheet h2').textContent=form.elements.name.value.trim()||'Your Traveller';$('#sheet .sheet-meta').textContent=(catalog.species.find(x=>x.id===species)?.name??species)+(form.elements.gender.value?' | '+form.elements.gender.value:'')+(form.elements.homeworld.value?' | '+form.elements.homeworld.value:'');
 syncCharacterPortrait(species,gender);
}
function syncCharacterPortrait(species,gender){
 const figure=$('#opening-portrait');if(!figure)return;
 const file=species==='aslan'?'aslan-pair':species==='aezorgh'?'aezorgh':(['human','vargr'].includes(species)?species+'-'+gender:null);
 figure.hidden=!file;if(file){const img=figure.querySelector('img');img.src='./assets/'+file+'.png';img.style.objectPosition=species==='aslan'?(gender==='female'?'100% center':'0% center'):'center';img.alt='Illustrative '+(catalog.species.find(x=>x.id===species)?.name??species)+' portrait';}

}
function sheetView(state){
 const c=state.character,simpleBenefits=c.benefits.filter(b=>!b.assetId&&!b.annualCredits);

 return '<p class="eyebrow">LIVE CHARACTER RECORD</p>'+button('Open character sheet','open-current-character-sheet','current-character-sheet-button','aria-haspopup="dialog" aria-controls="final-character-sheet"')+physicalDiceWarning(state)+(state.stage==='statistics'?'<div class="statistics-identity">':'')+'<h2>'+esc(c.name||'Your Traveller')+'</h2><p class="sheet-meta">'+esc(catalog.species.find(s=>s.id===c.species)?.name??c.species)+(c.variant&&c.variant!=='standard'?' | '+esc(catalog.species.find(x=>x.id===c.species)?.variants?.find(v=>v.id===c.variant)?.name??c.variant):'')+(c.culture==='imperial'?' | Imperial upbringing':'')+((c.identityGender??c.gender)?' | '+esc(c.identityGender??c.gender):'')+(c.homeworld?' · '+esc(c.homeworld):'')+'</p>'+(['identity','statistics'].includes(state.stage)?'<figure id="opening-portrait"><img width="512" height="512" alt="Illustrative Human portrait" src="./assets/human-male.png"></figure>':'')+(state.stage==='statistics'?'</div>':'')+careerRankView(state,catalog,{esc})+'<div class="sheet-facts"><span>Age<strong>'+esc(formatCharacterAge(c.age))+'</strong></span><span>Terms<strong>'+c.terms+'</strong></span><span>Cash<strong>Cr'+c.cash.toLocaleString()+'</strong></span><span>Debt<strong>Cr'+c.debt.toLocaleString()+'</strong></span></div>'+(Object.keys(c.stats).length||state.stage!=='identity'&&state.config.extras.includes('PSI')?'<div class="sheet-section">'+statCards(state)+'</div>':'')+'<div class="sheet-section"><h3>Skills</h3>'+(Object.keys(c.skills).length?'<ul class="compact-list">'+Object.entries(c.skills).sort(([a],[b])=>a.localeCompare(b)).map(([name,level])=>'<li>'+esc(name)+' <strong>'+level+'</strong>'+(c.psionicLoss?.permanent&&['Telepathy','Clairvoyance','Telekinesis','Awareness','Teleportation','Technopathy'].includes(name)?' <small>(historical; unavailable)</small>':'')+'</li>').join('')+'</ul>':'<p class="help">Your skills will appear here.</p>')+'</div><div class="sheet-section"><h3>Life path</h3>'+(c.careers.length?'<ol class="compact-list">'+c.careers.map(r=>'<li>'+esc(catalog.careers.find(x=>x.id===r.id)?.name??r.id)+' / '+esc(catalog.careers.find(x=>x.id===r.id)?.assignments.find(a=>a.id===r.assignment)?.name??r.assignment)+' · '+r.terms+' terms · '+(catalog.careers.find(x=>x.id===r.id)?.noRank?'no rank system':(r.officer?'officer rank ':'rank ')+r.rank)+careerPensionLabel(r)+'</li>').join('')+'</ol>':'<p class="help">Your story is just beginning.</p>')+'</div>'+(c.relationships.length?'<div class="sheet-section"><h3>People</h3><ul class="compact-list">'+c.relationships.map(p=>'<li>'+esc(p.role)+': '+esc(p.name)+'</li>').join('')+'</ul></div>':'')+(simpleBenefits.length?'<div class="sheet-section"><h3>Benefits</h3><ul class="compact-list">'+simpleBenefits.map(b=>'<li>'+esc(b.name)+' x '+b.quantity+'</li>').join('')+'</ul></div>':'')+(c.educations?.length?'<div class="sheet-section"><h3>Education</h3><ul class="compact-list">'+c.educations.map(e=>'<li>'+esc(catalog.precareers.find(p=>p.id===e.id)?.name??e.id)+': '+esc(e.completed?(e.graduation?.honours?'graduated with honours':e.graduation?.graduated?'graduated':'did not graduate'):'in progress')+'</li>').join('')+'</ul></div>':'')+(c.traits?.length?'<div class="sheet-section"><h3>Traits</h3><ul class="compact-list">'+c.traits.map(t=>'<li>'+esc(readableTrait(t))+'</li>').join('')+'</ul></div>':'')+(c.historyNotes?.length?'<div class="sheet-section"><h3>History notes</h3><ul class="compact-list">'+c.historyNotes.map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul></div>':'')+(c.futureConditions?.length?'<div class="sheet-section"><h3>Future conditions to review</h3><ul class="compact-list">'+c.futureConditions.map(n=>'<li>'+esc(readableFutureCondition(n))+'</li>').join('')+'</ul></div>':'')+currentEffectsSheet(state,catalog,{esc,sourceLabel})+notesConnectionsView(state,{esc,button},notesDraft)+extraCharacteristicsView(state,catalog,{esc,button,options})+(state.stage==='statistics'?'':gmControlsView(state,projection.log,{esc,options}))+'<datalist id="all-skills">'+catalog.skills.map(x=>'<option value="'+esc(x)+'"></option>').join('')+'</datalist>'+medicalSheet(state)+assetSheet(state)+ongoingBenefitSheet(state)+psionicSheet(state)+psionicGamesSheet(state)+advisorySheet(state,{esc,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id})+crossCareerRouteSheet(state,{esc,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id})+relationshipEventSheet(state,{esc,sourceLabel})+relationshipLossSheet(state,{esc})+merchantFineSheet(state,{esc,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id??'Merchant'})+reeducationSheet(state,{esc,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id??'Source event'})+aslanAccessSheet(state,{esc,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id})+clanShareSheet(state,{esc})+landClaimSheet(state,{esc})+aslanEventOutcomesSheet(state,{esc})+aslanOriginSheet(state,{esc})+aslanHistoricalSheet(state,{esc})+aslanOutlawSheet(state,{esc})+aslanRestorationSheet(state,{esc})+aslanOfficerSheet(state,{esc,button,sourceLabel,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id,assignmentName:(id,assignment)=>catalog.careers.find(c=>c.id===id)?.assignments.find(a=>a.id===assignment)?.name??assignment})+assignmentChangeSheet(state,{esc,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id,assignmentName:(id,assignment)=>catalog.careers.find(c=>c.id===id)?.assignments.find(a=>a.id===assignment)?.name??assignment})+prisonerLawyerSheet(state,{esc})+coreLifeEventSheet(state,{esc,sourceLabel,careerName:id=>catalog.careers.find(c=>c.id===id)?.name??id})+benefitWagerSheet(state,{esc,sourceLabel})+printedNarrative(state);
}

function render(){
 backgroundDraft=reconcileBackgroundDraft(backgroundDraft,backgroundDraftKey(session,projection.state),projection.state);
 const lastRollResult=conciseResult(projection.log.at(-1),projection.state,catalog);
 const lastResult=projection.state.stage==='background'||projection.state.stage==='career'&&selectedCareer?'':statisticsRollFeedbackView(projection.log.at(-1),projection.state,{esc})??latestResultView(lastRollResult,{esc,tagline:trainingTagline});
 const nestedDraft=$('.education-nested-label select')?{kind:$('.education-nested-prompt').dataset.educationChoice,key:$('#workspace').dataset.educationStudyKey,value:$('.education-nested-label select').value}:null;
 const studyDraft=$('.education-result #education-subject')?{key:$('#workspace').dataset.educationStudyKey,subject:$('#education-subject').value,skill:$('#education-skill').value}:null;
 const lawyerPanel=$('#prisoner-lawyer'),lawyerDraft=lawyerPanel?{id:lawyerPanel.dataset.lawyerId,fields:[...lawyerPanel.querySelectorAll('input,select,textarea')].map(input=>({id:input.id,value:input.value,checked:input.checked}))}:null;
 const lifePanel=$('#core-life-decision'),lifeDraft=lifePanel?{id:lifePanel.dataset.lifeEventId,fields:[...lifePanel.querySelectorAll('input,select,textarea')].map(input=>({id:input.id,value:input.value,checked:input.checked}))}:null;
 const accessOpen=$('#aslan-access-panel')?.open;
 const landOpen=$('#land-claim-panel')?.open;
 const shareDraft={open:$('#clan-share-panel')?.open,kind:$('#clan-share-kind')?.value,lot:$('#clan-share-lot')?.value};
 const state=projection.state,educationModel=educationResultModel(projection),eventModel=educationEventModel(state,projection);document.body.dataset.educationPopup=String(!!(educationModel||eventModel));document.body.dataset.stage=state.stage;document.body.dataset.familyPopup=String(!!(aslanFamilyPopupModel(state)||aslanBirthPopupModel(state)||aslanEstatePopupModel(state)||aslanClanPopupModel(state)||aslanPridePopupModel(state)||hasAslanBackgroundPopup(state)||aslanRitePopupModel(state)));$('header h1').textContent=(['identity','statistics','background','precareer'].includes(state.stage)||educationModel||eventModel||aslanFamilyPopupModel(state)||aslanBirthPopupModel(state)||aslanEstatePopupModel(state)||aslanClanPopupModel(state)||aslanPridePopupModel(state)||hasAslanBackgroundPopup(state)||aslanRitePopupModel(state))?'CHARACTER BUILDER':'A life among the stars';$('header .lead').textContent=(['identity','statistics','background','precareer'].includes(state.stage)||educationModel||eventModel||aslanFamilyPopupModel(state)||aslanBirthPopupModel(state)||aslanEstatePopupModel(state)||aslanClanPopupModel(state)||aslanPridePopupModel(state)||hasAslanBackgroundPopup(state)||aslanRitePopupModel(state))?'TRAVELLER RPG':'Build your Traveller one decision at a time.';const detailKey=d=>d.id||d.querySelector(':scope > summary')?.textContent;const previousDetails=new Map([...document.querySelectorAll('#sheet details, #statistics-gm-controls details')].map(d=>[detailKey(d),d.open]));
 const gmDraft={task:$('#gm-task')?.value,field:$('#gm-field')?.value,roll:$('#gm-roll-choice')?.value,restore:$('#gm-restore-choice')?.value};
 $('#workspace').innerHTML='<p class="step-count">COMPLETED TERMS: '+state.character.terms+' · '+esc(state.stage.toUpperCase().replaceAll('-',' '))+'</p><h2 id="step-title" tabindex="-1">'+esc(educationSkillTitle(state)??trainingContext(state)?.title??(state.prisonerEscape?prisonerEscapeTitle:null)??(isBasicTrainingChoice(state)?'Choose a basic-training skill':stageNames[state.stage]??state.stage))+'</h2>'+lastResult+aslanAccessView(state,{esc,button})+clanShareView(state,{esc,button,sourceLabel})+landClaimView(state,{esc,button,sourceLabel})+aslanAccessConflictView(state,{esc,button,sourceLabel})+stageView(state)+(['career','retirement','benefits'].includes(state.stage)&&(state.character.deferredEquipment??[]).some(e=>e.status==='pending')?button('Review assets & benefits','review-equipment','quiet'):'')+deferredAwardsView(state,{esc,button});
 if(state.stage==='statistics'){const heading=$('#step-title'),wrap=document.createElement('div');wrap.className='statistics-heading';heading.before(wrap);wrap.append(heading);wrap.insertAdjacentHTML('beforeend',openingInfoButton('generation'));}
 if(state.stage==='skill-choice')syncAwardBase(state,catalog,document,esc);
 if($('#clan-share-panel'))$('#clan-share-panel').open=shareDraft.open??false;if($('#clan-share-kind')&&shareDraft.kind)$('#clan-share-kind').value=shareDraft.kind;syncClanShareControls(shareDraft.lot);if($('#land-claim-panel'))$('#land-claim-panel').open=landOpen??false;syncLandClaimControls();if($('#aslan-access-panel'))$('#aslan-access-panel').open=accessOpen??false;syncAslanAccessControls();
 if(lifeDraft&&$('#core-life-decision')?.dataset.lifeEventId===lifeDraft.id)for(const field of lifeDraft.fields){const input=document.getElementById(field.id);if(input){input.value=field.value;input.checked=field.checked;}}syncCoreLifeEventControls($);
 if(lawyerDraft&&$('#prisoner-lawyer')?.dataset.lawyerId===lawyerDraft.id)for(const field of lawyerDraft.fields){const input=document.getElementById(field.id);if(input){input.value=field.value;input.checked=field.checked;}}syncPrisonerLawyerControls($);
 $('#sheet').innerHTML=sheetView(state);[...document.querySelectorAll('#sheet details, #statistics-gm-controls details')].forEach(d=>d.open=previousDetails.get(detailKey(d))??false);
 for(const [selector,value] of [['#gm-task',gmDraft.task],['#gm-field',gmDraft.field],['#gm-roll-choice',gmDraft.roll],['#gm-restore-choice',gmDraft.restore]]){const select=$(selector);if(select&&[...select.options].some(option=>option.value===value&&!option.disabled))select.value=value;}
 if(state.stage==='statistics')syncCharacterPortrait(state.character.species,(state.character.identityGender??state.character.gender)==='female'?'female':'male');
 syncCorrectionField(state,$);syncReplacementDice(projection.log,$,esc);syncCorrectionTask($);if(state.stage==='identity')syncRerollOptions($('#setup-form'));
 if(state.stage!=='precareer'&&!educationModel&&!eventModel)cancelCharacter.placeButton();
 if(state.stage!=='precareer'&&!educationModel&&!eventModel)mountPreCareerPopup(document,{state});
 mountBackgroundLayout(document,state,backgroundDraft?.skills??[],catalog,{esc});
 if(state.stage==='precareer'||educationModel||eventModel)mountPreCareerPopup(document,{state,catalog,projection,session,esc,sourceLabel,generation:operationGeneration,resultModel:educationModel,eventModel});
 const sheetOpener=document.querySelector('[data-action="open-current-character-sheet"]');if(sheetOpener)$('#sheet').prepend(sheetOpener);
 const activePrecareerDialog=document.getElementById('precareer-dialog');if(activePrecareerDialog&&!activePrecareerDialog.querySelector('.popup-character-sheet-button')){const access=document.createElement('button');access.type='button';access.className='popup-character-sheet-button';access.dataset.action='open-current-character-sheet-popup';access.textContent='Character sheet';access.setAttribute('aria-haspopup','dialog');access.setAttribute('aria-controls','final-character-sheet');activePrecareerDialog.prepend(access);}
 const studyKey=JSON.stringify([operationGeneration,session.seed,state.education,state.pendingChoice?.selectionId]);$('#workspace').dataset.educationStudyKey=studyKey;
 if(nestedDraft?.key===studyKey&&nestedDraft.kind===eventModel?.kind){const select=$('.education-nested-label select');if(select&&[...select.options].some(o=>o.value===nestedDraft.value)){select.value=nestedDraft.value;$('.education-nested-prompt [data-action]').disabled=false;}}
 if(educationModel?.study&&studyDraft?.key===studyKey&&[...$('#education-subject').options].some(o=>o.value===studyDraft.subject)){$('#education-subject').value=studyDraft.subject;syncEducationSubject(state,catalog,document,esc);$('#education-skill').value=studyDraft.skill;syncEducationStudyContinue(state,catalog,document);}
 $('#workspace').dataset.revision=projection.revision;
 if(state.stage==='identity')mountCrowIntroduction(document);
 mountSpeciesSkillPopup(document);
 mountAslanFamilyPopup(document,{onRoll:async()=>{if(!await send(aslanRitePopupModel(projection.state)?'roll-aslan-rite':aslanPridePopupModel(projection.state)?'roll-aslan-pride':aslanClanPopupModel(projection.state)?'roll-aslan-clan':aslanBirthPopupModel(projection.state)?'roll-aslan-birth-order':'roll-aslan-family'))throw new Error($('#message').textContent||'The family roll could not be recorded.');},onContinue:async(index)=>{
  const rite=aslanRitePopupModel(projection.state);if(rite){if(!await send(rite.equipment?'record-aslan-rite-equipment':'acknowledge-aslan-rite'))throw new Error($('#message').textContent||'Rite continuation could not be recorded.');return;}
  if(aslanPridePopupModel(projection.state)){if(!await send('acknowledge-aslan-pride'))throw new Error($('#message').textContent||'Continue could not be recorded.');return;}
  if(aslanClanPopupModel(projection.state)){if(!await send('acknowledge-aslan-clan'))throw new Error($('#message').textContent||'Continue could not be recorded.');return;}
  if(aslanEstatePopupModel(projection.state)){if(!await send('resolve-aslan-estate',{method:'printed-minimum'}))throw new Error($('#message').textContent||'Family estate could not be recorded.');return;}
  if(aslanBirthPopupModel(projection.state)){if(!await send('acknowledge-aslan-birth-order'))throw new Error($('#message').textContent||'Continue could not be recorded.');return;}
  const model=aslanFamilyPopupModel(projection.state);if(!model)return;
  if(index!==null){const option=model.choices[index];if(!option)return;if(!await send('choose-effect',{index:option.index}))throw new Error($('#message').textContent||'The skill choice could not be recorded.');}
  if(projection.state.stage==='aslan-family-result'&&!await send('acknowledge-aslan-family'))throw new Error($('#message').textContent||'Continue could not be recorded.');
 },onNameClan:async name=>{if(!await send('name-aslan-clan',{name}))throw new Error($('#message').textContent||'Clan name could not be recorded.');},onChooseClan:async payload=>{if(!await send('choose-aslan-clan',payload))throw new Error($('#message').textContent||'Clan could not be recorded.');},onToggleGM:async enabled=>{if(!await send('gm-mode',{enabled}))throw new Error($('#message').textContent||'GM setting could not be recorded.');const detail=$('#aslan-clan-record')?.closest('details');if(detail)detail.open=true;if(enabled)$('#aslan-clan-name')?.focus();}});
 mountAslanClanInformation(document);mountAslanPrideInformation(document);mountAslanBackgroundInformation(document);mountAslanRiteInformation(document,{resultKey:JSON.stringify([operationGeneration,session.seed,session.events[0]?.id,projection.log.findLast(event=>event.type==='roll-aslan-rite')?.id,state.currentAslanOrigin?.rite?.dice,state.currentAslanOrigin?.rite?.statsBefore,state.currentAslanOrigin?.rite?.modifier,state.currentAslanOrigin?.rite?.additionalRolls])});
 mountEquipmentDialog(document,()=>send('cancel-deferred-equipment'));
}
function renderEffects(){
 const list=$('#effect-list');clearRequiredActions(list.closest('dialog[open]')??$('#workspace'));
 list.innerHTML=effects.map(effectView).join('');
}
function readEffects(){
 return [...document.querySelectorAll('[data-effect]')].map(row=>{
 const value={};row.querySelectorAll('[data-field]').forEach(input=>value[input.dataset.field]=input.dataset.field==='value'?Number(input.value):input.value);
 return value;
 });
}
document.addEventListener('click',async event=>{
 const el=event.target.closest('[data-action]');if(!el||busy)return;
 const action=el.dataset.action;
 if(action==='statistics-roll-details')return simpleLogViewer.open();
 if(['record-aslan-rite-equipment','retain-aslan-secret','record-aslan-outcast-opportunity'].includes(action)){if(event.detail>1)return;return send(action,{});}
 if(action==='aslan-event-choices'){aslanManualReviewKey=null;return render();}
 if(action==='aslan-source-review'){aslanManualReviewKey=JSON.stringify([projection.revision,projection.state.pending]);return render();}
 if(action==='resolve-aslan-territory'){if(event.detail>1)return;return send(action,{skill:document.getElementById('aslan-territory-skill').value,holdingId:document.getElementById('aslan-territory-holding')?.value??null,landlessConfirmed:!!document.getElementById('aslan-territory-landless')?.checked});}
 if(action==='award-aslan-wanderer-land'){if(event.detail>1)return;return send(action,{});}
 if(action==='resolve-aslan-dishonoured'){if(event.detail>1)return;return send(action,{skill:el.dataset.skill,clanRelationshipConfirmed:!!document.getElementById('aslan-clan-defence')?.checked});}
 if(action==='prisoner-escape'){if(event.detail>1)return;return send(action,{skill:el.dataset.skill});}
 if(['open-current-character-sheet','open-current-character-sheet-popup'].includes(action)){if(event.detail>1)return;finalSheet.open(projection,session,catalog);return;}
 if(action==='open-character-sheet'){if(event.detail>1||!await saveDraftNotes())return;finalSheet.open(projection,session,catalog);return;}
 if(action==='resolve-prisoner-lawyer'){if(event.detail>1)return;return send(action,prisonerLawyerPayload($));}
 if(action==='resolve-life-event'){if(event.detail>1)return;return send(action,coreLifeEventPayload(projection.state,$));}
 if(action==='resolve-relationship-event'){if(event.detail>1)return;return send('resolve-relationship-event-step',relationshipEventPayload(projection.state,$));}
 if(['redeem-clan-shares','verify-clan-share-lot','verify-clan-contact','resolve-land-claim','activate-aslan-access','resolve-aslan-access-conflict'].includes(action)&&event.detail>1)return;
 if(action==='select-career'){selectedCareer=el.dataset.id;clearActionNotice();render();$('#step-title')?.focus();return;}
 if(action==='career-list'){selectedCareer='';clearActionNotice();render();$('#step-title')?.focus();return;}
 if(action==='add-effect'){effects=readEffects();effects.push({kind:projection.state.stage==='psionic-games-decisions'?'stat':'skill',name:'',value:1,mode:'increase',role:'Contact'});renderEffects();return;}
 if(action==='remove-effect'){effects=readEffects();effects.splice(Number(el.dataset.index),1);renderEffects();return;}
 if(action==='clan-add-weapon'){const items=readClanWeaponItems();if(items.length<projection.state.clanShareOptions.assetRules.maxItems){renderClanWeaponItems([...items,{quantity:1}]);document.querySelectorAll('[data-weapon-row]')[items.length]?.querySelector('input')?.focus();}return;}
 if(action==='clan-remove-weapon'){const items=readClanWeaponItems(),index=Number(el.dataset.index);if(items.length>1&&Number.isInteger(index)&&index>=0&&index<items.length){renderClanWeaponItems(items.filter((_,i)=>i!==index));document.querySelectorAll('[data-weapon-row]')[Math.min(index,items.length-2)]?.querySelector('input')?.focus();}return;}
 if(action==='redeem-clan-shares'&&$('#clan-share-kind').value==='land')return send(action,landRedemptionPayload(projection.state,readLandRows(),readLandFields()));
 if(action==='resolve-aslan-access-conflict')return send(action,{decision:$('#aslan-access-decision').value,reason:$('#aslan-access-conflict-reason').value});
 if(action==='activate-aslan-access')return send(action,aslanAccessPayload({routeId:$('#aslan-access-route').value,destination:$('#aslan-access-destination').value,confirmed:$('#aslan-access-confirmed').checked}));
 if(action==='resolve-land-claim')return send(action,landClaimPayload({claimId:$('#land-claim').value,mode:$('#land-claim-mode').value,claimEstablished:$('#land-claim-confirmed').checked,reason:$('#land-claim-reason').value,relativeName:$('#land-relative-name').value}));
 if(action==='redeem-clan-shares'){const kind=$('#clan-share-kind').value,payload={kind,inputs:[{lotId:$('#clan-share-lot').value,quantity:numberInput('#clan-share-quantity')}]};if(kind==='contact')payload.name=$('#clan-share-name').value;if(kind==='ally')payload.relationshipId=$('#clan-share-contact').value;if(['art','weapons'].includes(kind))Object.assign(payload,clanAssetPayload(kind,{name:$('#clan-art-name').value,items:readClanWeaponItems(),sourceConfirmed:$('#clan-weapons-confirmed').checked,sourceReason:$('#clan-weapons-reason').value,lowerValueConfirmed:$('#clan-lower-value-confirmed').checked,lowerValueReason:$('#clan-lower-value-reason').value}));return send(action,payload);}
 if(action==='verify-clan-share-lot'){const target=$('#clan-verify-target').value,payload={lotId:$('#clan-verify-lot').value,reason:$('#clan-verify-reason').value};if(target==='__new')payload.newClanName=$('#clan-verify-new').value;else if(target&&target!=='__source')payload.clanId=target;return send(action,payload);}
 if(action==='verify-clan-contact')return send(action,{relationshipId:$('#clan-verify-contact').value,clanId:$('#clan-contact-clan').value,reason:$('#clan-contact-reason').value});
 if(['roll-aslan-gender','roll-aslan-family','roll-aslan-birth-order','roll-aslan-clan','roll-aslan-pride','roll-aslan-rite'].includes(action))return send(action);
 if(action==='resolve-aslan-estate'){const method=el.dataset.method;return send(action,{method,...(method==='referee-baseline'?{parcels:numberInput('#aslan-estate-parcels'),increment:numberInput('#aslan-estate-increment'),reason:$('#aslan-origin-reason').value}:{})});}
 if(action==='choose-aslan-clan')return send(action,{name:$('#aslan-clan-name').value,scope:$('#aslan-clan-scope').value,reason:$('#aslan-origin-reason').value});
 if(action==='name-aslan-clan')return send(action,{name:$('#aslan-clan-name').value});
 if(action==='resolve-aslan-origin-source'){const kind=projection.state.currentAslanOrigin.sourceDecision.kind,payload={reason:$('#aslan-origin-reason').value};if(kind==='family-band')payload.band=$('#aslan-family-band').value;else if(kind==='female-independence')payload.decision=$('#aslan-origin-decision').value;else if(kind==='gender')payload.gender=$('#aslan-origin-gender').value;return send(action,payload);}
 if(action==='request-aslan-historical-entry'){const option=$('#aslan-historical-target').selectedOptions[0];if(!option?.dataset.careerId){notify('Choose a career and assignment first.',true);return;}return send(action,{careerId:option.dataset.careerId,assignment:option.dataset.assignment});}
 if(action==='resolve-aslan-historical-entry'){const decision=$('#aslan-entry-approved').value;return send(action,{approved:decision?decision==='yes':undefined,reason:$('#aslan-entry-reason').value});}
 if(action==='resolve-aslan-outlaw-restoration'){const decision=el.dataset.decision;if(decision==='ineligible'&&$('#aslan-unmarried-confirmed').checked){notify('Clear the unmarried confirmation before recording that this character is already married.',true);return;}const payload={decision};if(decision!=='decline')payload.reason=$('#aslan-outlaw-reason').value;if(decision==='restore')Object.assign(payload,{originalSOC:numberInput('#aslan-original-soc'),originalSOCConfirmed:$('#aslan-original-soc-confirmed').checked});if(decision==='marry'||decision==='ineligible')payload.unmarriedConfirmed=decision==='marry'?$('#aslan-unmarried-confirmed').checked:false;return send(action,payload);}
 if(action==='resolve-aslan-restoration'){const accept=el.dataset.accept==='true';return send(action,accept?{accept,originalSOC:numberInput('#aslan-original-soc'),originalSOCConfirmed:$('#aslan-original-soc-confirmed').checked,statusTiming:$('#aslan-status-timing').value,reason:$('#aslan-restoration-reason').value}:{accept});}
 if(action==='begin-aslan-officer'){const input=[...document.querySelectorAll('[data-officer-assignment]')].find(input=>input.dataset.offerId===el.dataset.offerId);if(!input?.value){notify('Choose an officer assignment first.',true);return;}return send(action,{offerId:el.dataset.offerId,assignment:input.value});}
 if(action==='cancel-aslan-officer')return send(action,{mode:el.dataset.mode});
 if(action==='resolve-aslan-officer-rank')return send(action,{tableId:$('#aslan-officer-rank').value,reason:$('#aslan-officer-rank-reason').value});
 if(action==='change-assignment'){const assignment=$('#assignment-change').value;if(!assignment){notify('Choose a new assignment first.',true);return;}return send(action,{assignment});}
 if(action==='advisory-cash')return send(action,{creditIds:[...document.querySelectorAll('[name=benefit-credit]:checked')].map(input=>input.value)});
 if(action==='resolve-advisory-cash-result')return send(action,{amount:numberInput('#advisory-cash-amount'),reason:$('#advisory-cash-reason').value});
 if(action==='advisory-career')return send(action,{careerId:$('#advisory-career').value});
 if(action==='resolve-advisory-cash-limit')return send(action,{decision:$('#advisory-limit-decision').value,reason:$('#advisory-limit-reason').value});
 if(action==='roll-borrowed-event')return send(action,{pendingId:projection.state.pendingBorrowedRoll.id});
 if(action==='cross-career-cover')return send('cross-career-cover-check',{careerId:el.dataset.career});
 if(action==='cross-career-training')return send(action,{assignment:el.dataset.assignment});
 if(action==='resolve-relationship-loss'){if(el.dataset.absent){if(!$('#relationship-absent').checked){notify('Confirm the referee decision before continuing.',true);return;}return send(action,{absent:true,reason:$('#relationship-loss-reason').value});}return send(action,{index:Number(el.dataset.index)});}
 if(action==='resolve-benefit-wager')return send(action,el.dataset.decline?{stake:0}:{stake:numberInput('#wager-stake'),skill:$('#wager-skill').value});
 if(action==='resolve-merchant-fine')return send(action,{decision:el.dataset.decision});
 if(action==='reeducation-roll')return send(action,{anagathicTerms:numberInput('#reeducation-anagathics'),anagathicsReason:$('#reeducation-anagathics-reason').value});
 if(action==='resolve-reeducation')return send(action,readReeducationDecisions());
 if(action==='learn-talent'||action==='psionic-games-preliminary')return send(action,{talent:el.dataset.talent});
 if(action==='complete-psionic-games'){
 const mode=$('#games-event-mode').value;
 if(mode==='resolved-externally'&&!$('#games-effects-confirm').checked){notify('Confirm that all external event consequences are represented before completing the Games term.',true);return;}
 const payload={ordinaryEvents:{mode,reason:$('#games-event-reason').value}};
 if(mode==='resolved-externally')payload.ordinaryEventEffects=readEffects().map(e=>e.kind==='stat'?{kind:e.kind,name:e.name,value:e.value}:e.kind==='relationship'?{kind:e.kind,name:e.name,role:e.role}:{kind:e.kind,value:e.value});
 if($('#games-stacking-mode'))payload.awardStacking={mode:$('#games-stacking-mode').value,reason:$('#games-stacking-reason').value};
 return send(action,payload);
 }
  if(action==='injury-loss')return send(action,{index:Number(el.dataset.index)});
  if(action==='injury-treatment')return send(action,{restore:Object.fromEntries([...document.querySelectorAll('[data-injury-restore]')].map(input=>[input.dataset.injuryRestore,Number(input.value)])),inService:$('#injury-in-service').checked});
  if(action==='choose-effect'){if((educationPotentialModel(projection.state)||educationCheckpointModel(projection))&&(event.detail>1||el.disabled))return;return send(action,{index:Number(el.dataset.index)});}
 if(action==='allocate-specializations')return send(action);
 if(action==='choose-skill')return send(action,{name:$('#award-skill').value});
 if(['roll-education-event-step','acknowledge-education-event'].includes(action)){if(event.detail>1||el.disabled)return;return send(action,{pendingId:el.dataset.pendingId});}
 if(['education-event','education-graduation'].includes(action)){if(event.detail>1||el.disabled)return;return send(action);}
 if(action==='acknowledge-education-result'){if(event.detail>1||el.disabled)return;return send(action);}
 if(action==='education-skill'){if((educationNestedChoiceModel(projection.state)||educationResultModel(projection)?.study)&&(event.detail>1||el.disabled))return;return send(action,{name:$('#education-hobby-skill')?.value??$('#education-skill').value});}
 if(action==='education-service')return send(action,{name:el.dataset.name});
 if(action==='education-check'){if((educationNestedChoiceModel(projection.state)||educationResultModel(projection)?.study)&&(event.detail>1||el.disabled))return;return send(action,{name:$('#education-check-skill').value});}
 if(action==='education-commission'||action==='skip-education-commission')return send('preterm-commission',{attempt:action==='education-commission'});
 if(action==='training')return send(action,{table:el.dataset.table});
 if(action==='swap-statistics')return send(action,{a:Number($('#swap-a').value),b:Number($('#swap-b').value)});
 if(action==='career'){const id=selectedCareer;selectedCareer='';return send(action,{id,assignment:$('#career-assignment').value});}
 if(action==='precareer'){
  if(catalog.precareers.find(p=>p.id===el.dataset.id)?.source==='core')return document.querySelector('#precareer-dialog')?._openAdmission(el.dataset.id);
  return send(action,{id:el.dataset.id});
 }
 if(action==='precareer-admit'){
  if(event.detail>1||el.disabled||projection.state.stage!=='precareer'||document.querySelector('#precareer-dialog')?.dataset.admission!==el.dataset.id)return;
  return send('precareer',{id:el.dataset.id});
 }
 if(action==='companion-entry')return send(action,{techLevel:numberInput('#education-tl'),size:numberInput('#education-size'),curriculum:$('#education-curriculum')?.value});
 if(action==='companion-skill')return send(action,{selected:[...document.querySelectorAll('[data-companion-skill]')].map(e=>e.value)});
 if(action==='retire-career')return send('leave-career',{retire:true});
  if(action==='draft')return send('fallback',{draft:true});
 if(action==='material-benefit'||action==='cash-benefit')return send('benefit',{cash:action==='cash-benefit',lifeBonusIds:[...document.querySelectorAll('[name=life-benefit-bonus]:checked')].map(input=>input.value),creditIds:[...document.querySelectorAll('[name=benefit-credit]:checked')].map(input=>input.value)});
 if(action==='save-notes')return send('notes',{text:$('#character-notes').value});
 if(action==='connection'){if(projection.state.stage!=='finish')return notify('Connections are available at finalization.',true);return send(action,{person:$('#connection-person').value,skill:$('#connection-skill').value,note:$('#connection-note').value});}
 if(action==='add-extra')return send(action,{id:$('#extra-stat').value});
 if(action==='resolve-landhold-details')return send(action,{name:$('#landhold-name').value,location:$('#landhold-location').value});
 if(action==='spend-equipment-credit')return send(action,creditPurchasePayload(document));
 if(action==='resolve-artefact-details')return send(action,{name:$('#artefact-name').value,description:$('#artefact-description').value});
 if(action==='choose-deferred-equipment')return send(action,{id:el.dataset.id});
 if(action==='resolve-book')return send(action,{aslanOfficerStatusApproved:$('#aslan-officer-status-approved')?.value?$('#aslan-officer-status-approved').value==='yes':undefined,aslanOfficerStatusConfirmed:$('#aslan-officer-status-confirmed')?.checked,ageingAnagathicTerms:numberInput('#ageing-anagathic-terms'),ageingPsiConfirmed:$('#ageing-psi-confirmed')?.checked,transferRankTrack:$('#transfer-rank-track')?.value,benefitSainthoodSuccess:$('#benefit-sainthood')?.value?$('#benefit-sainthood').value==='yes':undefined,benefitResolution:$('#benefit-resolution')?.value,benefitOutcomeName:$('#benefit-outcome-name')?.value,benefitItemId:$('#benefit-item-id')?.value||undefined,benefitItemName:$('#benefit-item-name')?.value,benefitItemCost:numberInput('#benefit-item-cost'),benefitItemTL:numberInput('#benefit-item-tl'),benefitReplaceAssetId:$('#benefit-replace-asset')?.value,benefitWeaponSkill:$('#benefit-weapon-skill')?.value,benefitShipVariant:$('#benefit-ship-variant')?.value,benefitShipHistory:$('#benefit-ship-history')?.value,pensionAnnualCredits:numberInput('#pension-annual'),pensionCondition:$('#pension-condition')?.value,psionicApproved:$('#psionic-approved')?.value?$('#psionic-approved').value==='yes':undefined,psionicCost:numberInput('#psionic-cost'),psionicFunding:$('#psionic-funding')?.value,psionicTimingConfirmed:$('#psionic-timing')?.checked,psionicPreviousChecks:numberInput('#psionic-previous-checks'),psionicFirstTalentChosen:$('#psionic-first-chosen')?.checked,psionicAttemptedTalents:[...document.querySelectorAll('[name=psionic-attempted]:checked')].map(e=>e.value),medicalCoveredCost:numberInput('#medical-covered-cost'),injurySurvives:$('#injury-survives')?.value?$('#injury-survives').value==='yes':undefined,injuryStats:Object.fromEntries([...document.querySelectorAll('[data-injury-final]')].map(input=>[input.dataset.injuryFinal,input.value===''?undefined:Number(input.value)])),ageingCareApproved:$('#ageing-care')?.value?$('#ageing-care').value==='yes':undefined,confirmed:$('#book-confirm').checked,effects:readEffects(),note:$('#book-note').value,years:$('#book-years')?Number($('#book-years').value):undefined,graduated:$('#education-graduation-decision')?.value?$('#education-graduation-decision').value!=='failed':$('#book-graduated')?.checked,leaveCareer:$('#book-leave')?.checked,keepBenefit:$('#book-keep-benefit')?.checked,birthOrder:$('#birth-order')?.value,educationNoGraduation:$('#education-no-graduation')?.checked,educationNextCareer:$('#education-next-career')?.value,educationAutomaticEntry:$('#education-entry-right')?($('#education-entry-right').value===''?undefined:$('#education-entry-right').value==='yes'):$('#education-auto-entry')?.checked,psionicPotential:numberInput('#education-psi'),acquiredTalents:[...document.querySelectorAll('input[name="education-talents"]:checked')].map(e=>e.value),educationEntrySuccess:$('#education-entry-decision')?.value?$('#education-entry-decision').value==='yes':undefined,citizenBranchApproved:$('#education-citizen-decision')?.value?$('#education-citizen-decision').value==='yes':undefined,qualificationModifier:numberInput('#education-qualification-dm'),commissionModifier:numberInput('#education-commission-dm'),advancementModifier:numberInput('#education-advancement-dm'),educationAgeAfter:numberInput('#education-age-after'),honours:$('#education-graduation-decision')?.value?$('#education-graduation-decision').value==='honours':undefined,checkNatural:numberInput('#source-check-natural'),checkTotal:numberInput('#source-check-total'),educationSelections:$('#education-selected-names')?.value.split(/\r?\n/).map(n=>n.trim()).filter(Boolean)});
 return send(action);
});
document.addEventListener('input',event=>{if(event.target.name==='minimumTotal')event.target.dataset.customTotal='true';if(event.target.form?.id==='setup-form'&&['name','homeworld'].includes(event.target.name))syncOpeningPortrait(event.target.form);if(event.target.id==='lawyer-level')syncPrisonerLawyerControls($);if(event.target.id==='character-notes'){notesDraft=event.target.value;const status=$('#notes-status');if(status)status.textContent=notesDraft!==projection.state.character.notes?'Unsaved notes. Save notes, save the character or print to record them.':'Notes match the saved record.';}});
window.addEventListener('beforeunload',event=>{if(notesDraft!==null&&notesDraft!==projection?.state.character.notes){event.preventDefault();event.returnValue='';}});
document.addEventListener('change',event=>{
 if(event.target.id==='aslan-historical-target')$('#aslan-historical-selection').textContent=event.target.value?event.target.selectedOptions[0].textContent:'';
 if(event.target.matches('[name=species],[name=culture]'))syncIdentityOptions(event.target.form);
 if(event.target.matches('[name=species],[name=gender]'))syncOpeningPortrait(event.target.form);
 if(event.target.matches('[name=minimumTotal]'))event.target.dataset.customTotal='true';
 if(event.target.matches('[name=aezorghTwoDice], [name=minimumTotal]'))syncRerollOptions(event.target.form);
  if(event.target.matches('[name=gm]')){syncPsiOptions(event.target.form);const academy=event.target.form.elements.academyServiceSkill;if(academy){academy.disabled=!event.target.checked;if(academy.disabled)academy.checked=false;}}
 if(event.target.matches('[name=flatLuck]'))syncFlatLuckSelection(event.target.form);
 if(event.target.matches('[name=psiGm]')&&event.target.checked)event.target.form.querySelector('[name=extras][value=PSI]').checked=true;
 if(event.target.matches('[name=extras][value=PSI]')&&!event.target.checked)event.target.form.elements.psiGm.checked=false;
 if(event.target.matches('[name=species],[name=extras],[name=gm],[name=zhodaniPsi],[name=flatLuck],[name=psiGm]'))syncSetupOptionalSummary(event.target.form);
 if(['lawyer-outcome','lawyer-level'].includes(event.target.id))syncPrisonerLawyerControls($);
  if(event.target.id==='psionic-funding')$('#psionic-cost').value=event.target.value==='provided'?0:projection.state.pending.minimumCost;
 if(event.target.id==='gm-field')syncCorrectionField(projection.state,$);
 if(event.target.id==='gm-roll-choice')syncReplacementDice(projection.log,$,esc);
 if(event.target.id==='gm-task')syncCorrectionTask($);
 if(event.target.id==='games-event-mode')$('#games-event-effects').hidden=event.target.value!=='resolved-externally';
  if(event.target.id==='gm-psi-mode')send('gm-psi-mode',{enabled:event.target.checked});
  if(event.target.id==='gm-psi-testing')send('gm-psi-testing',{enabled:event.target.checked});
  if(event.target.id==='gm-academy-training')send('gm-academy-training',{enabled:event.target.checked});
   if(event.target.id==='gm-physical-dice')send('gm-physical-dice',{enabled:event.target.checked});
   if(event.target.id==='gm-toggle')send('gm-mode',{enabled:event.target.checked});
 if(event.target.matches('[data-field="kind"]')){effects=readEffects();renderEffects();}
});
document.addEventListener('submit',async event=>{
 if(event.target.id==='gm-restore-form'){
  event.preventDefault();if(busy||!event.target.reportValidity())return;
  if(confirm('GM restore: return the character to this point? All later actions and rolls will remain in the log.'))return send('restore',{revision:Number($('#gm-restore-choice').value)});return;
 }
 if(event.target.id==='gm-value-form'||event.target.id==='gm-roll-form'){
  event.preventDefault();if(busy||!event.target.reportValidity())return;
  if(event.target.id==='gm-value-form')return send('gm-override',correctionPayload(projection.state,$));
  if(confirm('Replace this roll and undo later character progress? The complete history will stay in the log.'))return send('gm-replay',replacementPayload(projection.log,$));
  return;
 }
 if(event.target.id==='setup-form'){
  event.preventDefault();if(busy)return;const form=event.target;const values=new FormData(form);
  if(values.get('species')==='aslan'&&!['male','female'].includes(values.get('gender'))){notify('Choose Male or Female physical sex before starting your Aslan.',true);form.elements.gender.focus();return;}
   if(values.get('zhodaniPsi')&&(!values.get('gm')||values.get('species')!=='zhodani')){notify('The Zhodani PSI option needs GM mode and a Zhodani Traveller.',true);return;}
  if(!await send('configure',{...(values.get('physicalDice')||Object.hasOwn(projection.state.config,'physicalDice')?{physicalDice:!!values.get('physicalDice')}:{}),boons:Number(values.get('boons')),minimumReroll:!!values.get('minimumReroll'),minimumTotal:Number(values.get('minimumTotal')),allocation:!!values.get('allocation'),extras:values.getAll('extras'),...(values.get('psiGm')||Object.hasOwn(projection.state.config,'psiGm')?{psiGm:!!values.get('psiGm')}:{}),...(values.get('psiTestingWithoutEvent')||Object.hasOwn(projection.state.config,'psiTestingWithoutEvent')?{psiTestingWithoutEvent:!!values.get('psiTestingWithoutEvent')}:{}),...(values.get('flatLuck')||Object.hasOwn(projection.state.config,'flatLuck')?{flatLuck:!!values.get('flatLuck')}:{}),zhodaniPsi:!!values.get('zhodaniPsi'),aezorghTwoDice:values.get('species')==='aezorgh'&&!!values.get('aezorghTwoDice')}))return;
  if(projection.state.config.gm&&projection.state.config.academyServiceSkill&&!values.get('academyServiceSkill')&&!await send('gm-academy-training',{enabled:false}))return;
  if(!!values.get('gm')!==projection.state.config.gm&&!await send('gm-mode',{enabled:!!values.get('gm')}))return;
  if(values.get('academyServiceSkill')&&!projection.state.config.academyServiceSkill&&!await send('gm-academy-training',{enabled:true}))return;
  await send('setup',{name:values.get('name'),species:values.get('species'),gender:values.get('gender'),culture:values.get('culture')??'native',variant:values.get('species')==='vargr'?(values.get('variant')??'standard'):undefined,homeworld:values.get('homeworld')});
 }
 if(event.target.id==='background-form'){event.preventDefault();const selection=backgroundSelection(projection.state,selected(event.target,'skills'));if(!busy&&selection.valid&&!await send('background',{skills:selection.skills})){const error=$('#aslan-family-error');if(error){error.textContent=$('#message').textContent||'Background skills could not be recorded.';error.tabIndex=-1;error.focus();}}}
});
function download(name,contents,type='application/json'){
 const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
async function saveDraftNotes(){const notes=$('#character-notes')?.value;return notes===undefined||notes===projection.state.character.notes||await send('notes',{text:notes});}
$('#export').onclick=async()=>{if(busy||!await saveDraftNotes())return;download('traveller-character.json',exportSession(session));};
const logViewer=createLogViewer({document,getLog:()=>projection.log,onDownload:()=>$('#log-download').onclick()});
document.querySelector('.log-switch').insertAdjacentHTML('beforeend',openingInfoButton('logs'));
const simpleLogViewer=createSimpleLogViewer({document,getLog:()=>projection.log});
$('#simple-log-view').onclick=()=>{if(!busy&&projection?.ok)simpleLogViewer.open();};
$('#log-view').onclick=()=>{if(!busy&&projection?.ok)logViewer.open();};
$('#log-download').onclick=()=>download('traveller-action-log.txt',fullActionLog(projection.log),'text/plain');
let printDetails=null;
window.addEventListener('beforeprint',()=>{
 if(printDetails)return;printDetails=[...document.querySelectorAll('#final-sheet-content details')].map(element=>({element,open:element.open}));printDetails.forEach(item=>item.element.open=true);
});
window.addEventListener('afterprint',()=>{for(const item of printDetails??[])item.element.open=item.open;printDetails=null;});
$('#print').onclick=async()=>{
 if(busy)return;
 if(!await saveDraftNotes())return;
 window.print();
};
const finalSheet=createFinalSheet({document,getRecord:state=>{const record=document.createElement('div');record.innerHTML=sheetView(state);return record;},onSave:()=>download('traveller-character.json',exportSession(session)),onPrint:()=>window.print(),onLog:()=>$('#log-download').onclick()});
$('#recovery-save').onclick=()=>{if(recoveryRaw!==null)download('traveller-unreadable-draft-backup.json',recoveryRaw);};
$('#recovery-inspect').onclick=()=>{if(recoveryRaw!==null){inspectHistory(recoveryRaw);$('#legacy-title').focus();if(!inspectionHistory)notify($('#legacy-description').textContent,true);}};
$('#legacy-save').onclick=()=>{if(inspectionOriginal!==null||inspectionRaw!==null)download('traveller-legacy-original.json',inspectionOriginal??inspectionRaw);};
$('#legacy-text').onclick=()=>{if(inspectionHistory!==null)download('traveller-recorded-history.txt',recordedHistoryText(inspectionHistory),'text/plain');};
$('#legacy-close').onclick=()=>{closeHistory();$('#import').focus();};
$('#recovery-replace').onclick=()=>{
 if(busy||recoveryRaw===null)return;
 if(!confirm('Replace the unreadable stored draft with the current character? Download its raw backup first if you want to keep it.'))return;
 recoveryRaw=null;persist();updateRecovery();notify(storageWarning||'Stored draft replaced after confirmation.',!!storageWarning);
};
$('#new').onclick=async()=>{
 if(busy)return;
 if(!confirm('Start a new character? Save your current character and log first. The current browser draft will be replaced.'+(recoveryRaw!==null?' Download the unreadable draft backup before replacing it.':'')))return;
 await startNewCharacter({replaceRecovery:true});
};
const cancelCharacter=createCharacterCancel({document,canOpen:()=>!busy,onConfirm:()=>startNewCharacter()});
async function startNewCharacter({replaceRecovery=false}={}){
 if(busy)return;
 const token=++operationGeneration;setBusy(true);
 try{
  const result=await call({operation:'create',seed:crypto.randomUUID()});if(token!==operationGeneration)return;if(!result.ok)throw new Error(result.error.message);
  trainingTagline=null;session=result.session;projection=result;aslanManualReviewKey=null;notesDraft=null;backgroundDraft=null;selectedCareer='';effects=[];if(replaceRecovery)recoveryRaw=null;closeHistory();persist();updateRecovery();render();$('#step-title')?.focus();notify(storageWarning||'New character started.',!!storageWarning,'info',!storageWarning);
 }catch(error){if(token===operationGeneration)notify('Could not start a new character: '+error.message,true);}
 finally{if(token===operationGeneration)setBusy(false);}
};
$('#import').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 if(busy){event.target.value='';notify('Wait for the current action to finish before loading another character.',true);return;}
 const token=++operationGeneration;let incomingRaw=null,decodeIssue='';setBusy(true);
 try{
  if(file.size>2000000)throw new Error('This save is too large.');
  try{incomingRaw=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());}catch{decodeIssue='The original file is not valid UTF-8. Download the unchanged file; no recorded text or character was imported.';throw new Error(decodeIssue);}
  const result=await call({operation:'import',raw:incomingRaw});if(token!==operationGeneration)return;if(!result.ok)throw new Error(result.error.message);
  if((projection.revision||(notesDraft!==null&&notesDraft!==projection.state.character.notes))&&!confirm('Load this character in place of the current browser draft? Save your current character first.'))return;
  const tagline=await restoredAslanTrainingTagline(result.session,result,call);if(token!==operationGeneration)return;
  trainingTagline=tagline;session=result.session;projection=result;aslanManualReviewKey=null;notesDraft=null;backgroundDraft=null;selectedCareer='';effects=[];closeHistory();persist();render();$('#step-title')?.focus();notify(storageWarning||'Character loaded. Its complete action log was replayed and verified.',!!storageWarning);
 }catch(error){if(token===operationGeneration){inspectHistory(incomingRaw,file,decodeIssue||(file.size>2000000?'This file is too large to inspect. Download the unchanged original.':''));notify('Could not load: '+error.message+' Your current character was kept. Review the original recorded history below; it is not a verified character.',true);}}
 finally{event.target.value='';if(token===operationGeneration)setBusy(false);}
};
async function start(){
 setBusy(true);
 try{
  catalog=await call({operation:'catalog'});if(!catalog.ok)throw new Error(catalog.error.message);
  let saved;try{saved=localStorage.getItem(key);}catch{storageWarning='Browser storage unavailable. Save character & log regularly.';}
  if(saved){try{projection=await call({operation:'import',raw:saved});if(!projection.ok)throw new Error(projection.error.message);session=projection.session;}
   catch(error){recoveryRaw=saved;storageWarning='The stored draft could not be opened. Its raw file is preserved. Use the recovery controls to download it before choosing whether to replace it.';}}
  if(!projection?.ok){const result=await call({operation:'create',seed:crypto.randomUUID()});if(!result.ok)throw new Error(result.error.message);session=result.session;projection=result;aslanManualReviewKey=null;}
  trainingTagline=await restoredAslanTrainingTagline(session,projection,call);
  updateRecovery();render();if(storageWarning)notify(storageWarning,true);
 }catch(error){notify('Unable to start the rules engine: '+error.message,true,'info',false,{startup:true});}
 finally{setBusy(false);}
}
start();

document.addEventListener('change',event=>{if(['clan-share-kind','clan-share-lot'].includes(event.target.id)){if($('#clan-weapons-confirmed'))$('#clan-weapons-confirmed').checked=false;if($('#clan-lower-value-confirmed'))$('#clan-lower-value-confirmed').checked=false;}if(['clan-share-kind','clan-share-lot','clan-share-contact','clan-verify-lot','clan-verify-target','clan-verify-contact','clan-contact-clan'].includes(event.target.id))syncClanShareControls();});

document.addEventListener('input',event=>{if(event.target.id==='clan-share-quantity'||event.target.matches('[data-weapon-field]')){if($('#clan-weapons-confirmed'))$('#clan-weapons-confirmed').checked=false;if($('#clan-lower-value-confirmed'))$('#clan-lower-value-confirmed').checked=false;syncClanAssetControls();}});

document.addEventListener('change',event=>{if(event.target.matches('[data-land-selected]'))syncLandControls();if(['land-claim','land-claim-mode'].includes(event.target.id)){$('#land-claim-confirmed').checked=false;syncLandClaimControls();}});
document.addEventListener('input',event=>{if(event.target.matches('[data-land-quantity],#land-minimum,#land-increment'))syncLandControls();if(event.target.id==='land-relative-name')$('#land-claim-confirmed').checked=false;});

document.addEventListener('change',event=>{if(event.target.id==='aslan-access-route'){$('#aslan-access-confirmed').checked=false;syncAslanAccessControls();}});
document.addEventListener('input',event=>{if(event.target.id==='aslan-access-destination')$('#aslan-access-confirmed').checked=false;});

document.addEventListener('change',event=>{if(event.target.id==='aslan-access-decision'){const selected=projection.state.aslanAccessConflict?.choices.find(c=>c.id===event.target.value);$('#aslan-access-decision-help').textContent=selected?selected.name+'. '+selected.reason:'';$('[data-action=resolve-aslan-access-conflict]').disabled=!projection.state.config.gm;}});

document.addEventListener('change',event=>{if(['life-outcome','life-funding'].includes(event.target.id))syncCoreLifeEventControls($);});

document.addEventListener('change',event=>{if(event.target.id==='education-subject'){syncEducationSubject(projection.state,catalog,document,esc);syncEducationStudyContinue(projection.state,catalog,document);}});

document.addEventListener('change',event=>{if(event.target.id==='award-base')syncAwardBase(projection.state,catalog,document,esc);if(event.target.id==='award-speciality')$('#award-skill').value=event.target.value;});

document.addEventListener('change',event=>{if(event.target.id==='benefit-item-id')syncEquipmentCatalogue(projection.state.pending,document);});

document.addEventListener('change',event=>{if(['credit-category','credit-item'].includes(event.target.id))syncCreditSelection(projection.state.pending,document,event.target.id==='credit-category');});

document.addEventListener('input',event=>{if(event.target.id==='education-skill')syncEducationStudyContinue(projection.state,catalog,document);});

mountRequiredActions({document,getState:()=>projection?.state??{},isBusy:()=>busy,backgroundSelection,studyValid:(state,value)=>educationStudySelectionValid(state,catalog,value)});
