import {dashboardPanel} from './dashboard-view.mjs?v=time-completion-20261010-48';
import {recordWorldOverride,revertWorldField,worldFieldRevertEligibility,worldChangeFields,worldFieldValue,isWorldChangeAudit} from './world-change-history.mjs?v=time-completion-20261010-48';
import {createCampaignController} from './campaign-controller.mjs?v=time-completion-20261010-48';
import {ruleInfo,referenceIndex,REFERENCE_VERSION} from './rule-references.mjs?v=time-completion-20261010-48';
import {mountRulePopover,replaceReferenceContent} from './rule-popover.mjs?v=time-completion-20261010-48';
import {escapeHtml,moneyHtml} from './display.mjs?v=time-completion-20261010-48';
import {normalizeAmountFields} from './form-values.mjs?v=time-completion-20261010-48';
import {contactSearchStatus,contactSearchPeriod,contactSearchRule} from './contact-search.mjs?v=time-completion-20261010-48';
import {createPassengerUI} from './passenger-ui.mjs?v=time-completion-20261010-48';
import {passengerShip,passengerTotals,passengerSpace,passengerCapacity} from './passengers.mjs?v=time-completion-20261010-48';
import {advancePaymentDate,recordedPaymentDate} from './payment-schedule.mjs?v=time-completion-20261010-48';
import {configureMortgage,mortgageStatus} from './mortgage.mjs?v=time-completion-20261010-48';
import {configureMaintenance,maintenanceStatus} from './maintenance.mjs?v=time-completion-20261010-48';
import {createServicePanels} from './service-panels.mjs?v=time-completion-20261010-48';
import {cargoHoldPanel} from './cargo-hold.mjs?v=time-completion-20261010-48';
import {createExpensePanels} from './expense-panels.mjs?v=time-completion-20261010-48';
import {currentJumpAttempt} from './jump-attempts.mjs';
import {mountSettingsLayout,syncSettingsControls,stepSetting} from './settings-layout.mjs?v=time-completion-20261010-48';
import {configureFuel,fuelCapacities,bladderSpace,validateFuel,jumpFuel} from './fuel.mjs?v=time-completion-20261010-48';
import {refillQuote,supportStock,supportCargo,supportDisplay,anchorSupport,configureSupport} from './life-support.mjs?v=time-completion-20261010-48';
import {campaignReport} from './report.mjs?v=time-completion-20261010-48';
import {up,creditStep,roundExisting} from './rounding.mjs?v=time-completion-20261010-48';
import {tiers,luggageAllowance,occupants,passengerLuggage,manualLuggage,serviceRate,serviceLabel,roomCounts,roomTotal,personMonthlyRate,personRate} from './accommodation.mjs?v=time-completion-20261010-48';
import * as A from './amounts.mjs';
import {parseDate,displayDate} from './calendar.mjs';
import * as R from './rules.mjs?v=time-completion-20261010-48';
import * as S from './state.mjs?v=time-completion-20261010-48';
import {latestMailCheck,recordMailCheck,mailCheckHistoryStatus} from './mail-history.mjs?v=mail-history-1';
import * as E from './expenses.mjs?v=time-completion-20261010-48';
import {planetInformation,worldSheetURL} from './planet-info.mjs?v=time-completion-20261010-48';
import {worldMapFacts,worldSymbols,selectedWorldHex,mapKeyMarkup} from './world-symbols.mjs?v=time-completion-20261010-48';
import * as M from './map.mjs?v=time-completion-20261010-48';
import {MAP_GEOMETRY,setMapGeometry,visibleMapWorlds} from './map-geometry.mjs?v=map-first-1';
import {camera,viewportTiles,MapAreaCache} from './map-viewport.mjs?v=map-first-1';
import {MAP_ZOOM_STEP,nextMapZoom,mapLevel,MapOverviewCache,overviewMarkup,mapTerritories} from './map-overview.mjs?v=time-completion-20261010-48';
import {readPoliticalTerritory,savePoliticalTerritory} from './map-preferences.mjs';
import {createGlobalWorldSearch} from './global-world-search.mjs?v=time-completion-20261010-48';
import {createWorldPicker,rememberWorld} from './world-picker.mjs?v=time-completion-20261010-48';
import {Store,KEY,SaveNotCommittedError,SaveCommittedPublicationError} from './persistence.mjs?v=time-completion-20261010-48';
const $=id=>document.getElementById(id),esc=escapeHtml;
const ROOT='https://github.com/OwlsNestNH/Traveller-Tools/blob/main/tools/trade-route-calculator/';
let inputRounding=[];
let historyFilter='All';
let routeDraft=null;
// Monetary text is also used directly in HTML; keep even invalid historic values inert.
const money=moneyHtml,field=(name,label,value='',type='text',extra='',unit=null)=>{if(unit!==null&&!['credits','tons'].includes(unit))throw Error('Unknown field rounding unit: '+unit);if(unit){type='number';extra=extra.replace(/step="[^"]*"/g,'').replace(/min="0\.0[0-9]*"/g,'min="0"')+' step="1"';}return `<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${unit?'data-round="'+unit+'" data-round-label="'+esc(label)+'"':''} ${extra}></label>`;};

const select=(name,label,options,value)=>`<label class="field">${esc(label)}<select name="${name}">${options.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
const check=(name,label,value=false)=>`<label class="check"><input type="checkbox" name="${name}" ${value?'checked':''}>${esc(label)}</label>`;
const btn=(label,action,arg='',mutate=false,cls='')=>`<button class="${cls}" data-action="${action}" data-arg="${esc(arg)}" ${mutate?'data-mutate':''}>${esc(label)}</button>`;
const empty=text=>`<div class="empty">${text}</div>`,panel=(title,body,actions='')=>`<section class="panel"><div class="panel-head"><h2>${title}</h2><div class="row">${actions}</div></div>${body}</section>`;
const saleQuotes=new Map();
const saleTaxDice=new Map();
let editSale=null;
let mapLoadTimer=0,mapPaintFrame=0;
function scheduleMapPaint(){if(!mapDrag&&!mapPaintFrame)mapPaintFrame=requestAnimationFrame(()=>{mapPaintFrame=0;paintMap();});}
const mapAreas=new MapAreaCache(tile=>M.nearby(tile,12),scheduleMapPaint);
const mapOverview=new MapOverviewCache(()=>M.sectors(),(name,options)=>M.sectorOverview(name,options),scheduleMapPaint);
let showHexes=true,showUwp=true,showTerritories=readPoliticalTerritory(),mapZoom=1,mapZoomFrame=0,mapPan={x:0,y:0},mapAnchor=null,mapDrag=null,suppressMapClick=false;
let core,mp,decisions,state=S.initial(),store,known={},view=null,tab='Overview',snapshotId=null,marketFilter='active',marketSearch='',cargoSearch='',cargoSort='name',selected=new Set(),contractDrafts=[],mailCheck=null,mailPanelOpen=false,mailAcceptedDetailsOpen=true,modalRevision=0,modalGeneration=0,previewSale=null;
const campaignWrites=createCampaignController({getState:()=>state,getStore:()=>store,getKnownWorlds:()=>known,getRounding:()=>inputRounding});
let cargoHoldOpen=false;
// Expanded navigation is a local view, never part of the campaign or backup.
let mapExpanded=false,mapRestorePanel=null;
function showOverviewPanels(){worldNearbyRequest=null;mapExpanded=false;mapRestorePanel=null;tab='Overview';}
const passengers=createPassengerUI({getState:()=>state,getCore:()=>core,getWorld:world,getWorlds:()=>({...known,...state.worlds}),getView:viewed,modal,act,render,message,S,R,M});
const stockServices=createServicePanels({document,getState:()=>state,isEditable:()=>!!store?.editable&&!campaignReloadRequired,commit:act,render,showOverview:showOverviewPanels,message,onTerminalFailure:(error,guidance)=>{requireCampaignReload(error,guidance,'service-save');message(guidance,true);},nextJumpFuel:s=>{const to=s.worlds[s.route[s.routeIndex+1]];if(!to)return null;const q=jumpFuel(s.ship,M.distance(s.worlds[s.actual],to));return q?Math.max(0,q.tons-q.before):null;}});
const expenseRouteKey='traveller-expense-receipt-route';
function rememberExpenseRoute(route){try{if(route?.receiptId)sessionStorage.setItem(expenseRouteKey,JSON.stringify(route));else sessionStorage.removeItem(expenseRouteKey);}catch{/* View preference is optional; the ledger remains authoritative. */}}
const expenseServices=createExpensePanels({document,getState:()=>state,isEditable:()=>!!store?.editable,commit:act,render,showOverview:showOverviewPanels,message,openService:kind=>kind==='fuel'?refuelShortcut():refillSupport(),showSettings:kind=>{services.close({render:false});tab='Settings';settingsOpenGroups.set(kind,true);render();document.querySelector('[data-settings-group="'+kind+'"]')?.scrollIntoView({block:'start'});},onNavigate:rememberExpenseRoute});
// Switching a service has the same semantics as Back: discard only its local
// unfinished draft. Recorded payments live in the campaign ledger, not the view.
const services={
 active:()=>stockServices.active()||expenseServices.active(),
 selected:()=>stockServices.kind()||(expenseServices.active()?'expenses':null),
 committing:()=>stockServices.committing()||expenseServices.committing(),
 token:()=>stockServices.token(),
 panel:()=>expenseServices.active()?expenseServices.panel():stockServices.panel(),
 route:()=>expenseServices.route(),
 open(kind,options){if(this.committing())throw Error('Wait for this payment to finish saving.');inputRounding=[];if(['fuel','support'].includes(kind)){stockServices.open(kind);expenseServices.close({render:false});rememberExpenseRoute(null);cargoHoldOpen=false;render();}else{expenseServices.open(kind,options);stockServices.close({render:false});cargoHoldOpen=false;render();}},
 close(options={}){if(this.committing())return;inputRounding=[];stockServices.close({render:false});expenseServices.close({render:false});if(options.render!==false)render();},
 sync(){stockServices.sync();expenseServices.sync();},
 syncControls(){stockServices.syncControls();expenseServices.syncControls();},
 async action(name,arg,token){if(name?.startsWith('expense-'))return expenseServices.action(name,arg);return stockServices.action(name,arg,token);}
};
function restoreExpenseReceipt(){try{const route=JSON.parse(sessionStorage.getItem(expenseRouteKey)||'null');if(route?.receiptId&&state.ledger.some(entry=>entry.id===route.receiptId&&entry.expense?.kind===route.kind))services.open(route.kind,{receiptId:route.receiptId});else rememberExpenseRoute(null);}catch{rememberExpenseRoute(null);}}
const debugErrors=[];
const DEV_CHANGES=[
 {date:'2026-10-06',change:'Added configurable maximum commodity base retail price for speculative trade.'},
 {date:'2026-10-06',change:'Added optional RAW base-price exception for illegal goods.'},
 {date:'2026-10-06',change:'Pricing audits now show RAW base retail, effective base retail, cap and exception status.'},
 {date:'2026-10-06',change:'Added temporary Dev Tools diagnostics, validation, error log, copy report and debug-link sharing.'}
];
function world(id){return state.worlds[id]||known[id]||mapAreas.worlds[id];}function good(id){return core.commodities.find(g=>g.id===id);}function ctx(id){return R.context(world(id),core);}function viewed(){return world(view||state.actual);}function actual(){return world(state.actual);}function partyKey(id,name){return id+'|'+name.trim().toLowerCase();}
function message(text,error=false){$('message').textContent=text;$('message').className='visible'+(error?' error':'');}
function recordDebugError(error,context='runtime'){
 const entry={time:new Date().toISOString(),context,message:String(error?.message||error),stack:error?.stack?String(error.stack).slice(0,4000):null};
 debugErrors.push(entry);if(debugErrors.length>50)debugErrors.splice(0,debugErrors.length-50);
}
function safely(fn){return async(...args)=>{try{return await fn(...args);}catch(e){recordDebugError(e,fn?.name||'action');message(e.message,true);}};}
function optionalRuleFootnote(kind){return '<p class="help rule-footnote">'+(kind==='insurance'?'Insurance':'Taxes')+' · Optional adaptation '+ruleInfo(kind)+' <a href="'+ROOT+'OPTIONAL_RULES.md" target="_blank" rel="noopener">Approved adaptations and interpretations</a>.</p>';}
function roundingFootnote(changes=[],step=creditStep(state)){return '<p class="help rule-footnote">Rounding '+ruleInfo('rounding')+' · Credits round up to '+(step===100?'the next Cr100':'whole Credits')+'; tons round up to whole tons. Exact intermediate calculations and proportional cost allocations are retained.'+(changes.length?' '+changes.map(c=>esc(c.label)+': '+esc(c.before)+' → '+esc(c.after)).join('; ')+'.':'')+'</p>';}
function normaliseFields(form){normalizeAmountFields(form.querySelectorAll('[data-round]'),{creditStep:creditStep(state),rounding:inputRounding});if(form===$('modal-form')&&$('rounding-input-note'))replaceReferenceContent($('rounding-input-note'),roundingFootnote(inputRounding));}
function roundingPreview(){const draft=structuredClone(state),changes=roundExisting(draft);let error='';try{S.validate(draft);}catch(e){error=e.message;}modal('Preview rounding',`<p>Round current bank, cargo quantities and values, cargo capacity, luggage, market offers, accepted contracts and saved monthly costs. Future Credit entries and charges will round up to Cr100. Historical transactions, insurance contract terms and original audits stay unchanged.</p>${table(['Value','Before','After'],changes.map(c=>`<tr><td>${esc(c.label)}</td><td class="number">${esc(c.before)}</td><td class="number">${esc(c.after)}</td></tr>`))}${roundingFootnote([],100)}${error?'<p class="notice">Cannot apply: '+esc(error)+' Adjust cargo or capacity first.</p>':'<p>One undo restores all these changes.</p>'}`,error?null:()=>act('Round Credits to 100 and tons to whole',s=>S.applyRounding(s)),'Apply rounding',true,{annotateRounding:false});}
let activeModal=null;
let undoOperation=null;
let settingsOperation=null;
let worldWriteOperation=null,worldNearbyRequest=null;
let timeWriteOperation=null;
let replacementReview=null,importRead=null,campaignPublicationEpoch=0,editingLossEpoch=0;
let jumpPreparation=null;
let campaignReloadRequired=false,campaignReloadMessage='';
let suspendedSettings=null;
let modalPointerClick=null,modalTransitionClick=null;
function resetModalPointerGesture(){modalPointerClick=null;modalTransitionClick=null;}
function preserveModalPointerGesture(){
 const previous=modalPointerClick||modalTransitionClick,now=Date.now();
 modalTransitionClick=previous&&now>=previous.at&&now-previous.at<=750?previous:null;modalPointerClick=null;
}
function captureModalClick(e){
 const dialog=$('modal'),now=Date.now(),previous=modalTransitionClick;
 // One double-click must not cross into a replacement confirmation or the
 // underlying page. Fresh clicks, keyboard actions and ordinary repeated
 // controls remain available; only the original pointer gesture is consumed.
 if(previous&&e.detail>1&&e.button===previous.button&&e.pointerId===previous.pointerId&&now>=previous.at&&now-previous.at<=750&&Math.abs(e.clientX-previous.x)<=4&&Math.abs(e.clientY-previous.y)<=4){
  e.preventDefault();e.stopImmediatePropagation();return true;
 }
 modalTransitionClick=null;
 const button=e.target.closest?.('button');
 modalPointerClick=dialog.open&&e.detail>0&&e.button===0&&['modal-submit','modal-cancel','modal-close'].includes(button?.id)&&dialog.contains(button)?{at:now,x:e.clientX,y:e.clientY,button:e.button,pointerId:e.pointerId}:null;
 return false;
}
function suspendSettingsForm(){const form=$('settings-form');if(!form)return;captureSettingsDisclosures();const placeholder=document.createElement('div');placeholder.style.height=form.getBoundingClientRect().height+'px';form.replaceWith(placeholder);suspendedSettings={form,placeholder};}
function restoreSettingsForm(){const retained=suspendedSettings;suspendedSettings=null;if(retained?.placeholder.isConnected){retained.placeholder.replaceWith(retained.form);updateSettingsForm(retained.form);}}

function modalCurrent(session){return activeModal===session&&!session.cancelled&&$('modal').open&&(!session.mutates||store?.editable);}
function syncModalSubmit(){
 const session=activeModal;if(!session)return;
 $('modal-submit').disabled=session.busy||session.terminal||!session.valid||session.cancelled||(session.mutates&&(!store?.editable||campaignReloadRequired));
 // Readonly fields remain in FormData; disabled fields would drop elapsed hours.
 if(session.jumpCommit){const hours=$('modal-form').elements.namedItem('hours');if(hours)hours.readOnly=session.busy||session.terminal||session.cancelled||!store?.editable;}
 const pending=session.awaitSave&&session.busy;
 if($('modal-cancel'))$('modal-cancel').disabled=pending;
 if($('modal-close'))$('modal-close').disabled=pending;
}
function closeModal(){if(activeModal?.awaitSave&&activeModal.busy)return false;if(settingsOperation?.session&&settingsOperation.session===activeModal)invalidateSettingsOperation();if(worldWriteOperation?.session===activeModal)invalidateWorldWriteOperation();if(timeWriteOperation?.session&&timeWriteOperation.session===activeModal)invalidateTimeWriteOperation();preserveModalPointerGesture();activeModal=null;modalGeneration++;$('modal').close();$('modal-body').innerHTML='';restoreSettingsForm();}
function requireCampaignReload(error,guidance,context){
 // A terminal save outcome survives subsequent role callbacks and dialogs.
 // Set both application and provider guards before yielding can render/throw.
 campaignReloadRequired=true;campaignReloadMessage=guidance;
 store.reloadRequired=true;store.editable=false;
 try{store.yield();}catch(roleError){recordDebugError(roleError,context+'-read-only');}
 recordDebugError(error,context);
 $('save-status').textContent=guidance;$('save-status').className='readonly';$('takeover').disabled=true;$('takeover').hidden=true;
}
function terminalModalSaveFailure(session,error){
 // Ownership, not modalCurrent(), survives yield's read-only/cancelled status.
 // A known saved write must never be offered again; an unknown result is also
 // unsafe to retry until a real reload establishes the authoritative campaign.
 const committed=error?.code==='SAVE_COMMITTED_PUBLICATION_FAILED'&&error.committed===true&&Number.isSafeInteger(error.revision);
 const name=session.saveName||'Deposit',lower=name.toLowerCase();
 const guidance=session.saveContext==='campaign-replace'?(committed?'Campaign replacement saved, but the display could not update. Reload and verify which campaign is saved before replacing again.':'The campaign replacement save outcome could not be confirmed. Reload and verify which campaign is saved before replacing again.'):(committed?name+' saved, but the display could not update. Reload this page before continuing; do not record this '+lower+' again.':'The '+lower+' save outcome could not be confirmed. Reload this page and check History before trying again.');
 session.terminal=true;session.cancelled=true;
 requireCampaignReload(error,guidance,session.saveContext||'deposit-save');
 if(activeModal===session&&$('modal').open){$('modal-error').textContent=guidance;$('modal-cancel').textContent='Close';}
 message(guidance,true);
}
// Display titles are presentation only. Callers declare review/footnote behavior.
function modal(title,body,submit,label='Save',mutates=true,{retainRounding=false,insurance=false,tax=false,annotateRounding=true,awaitSave=false,saveName='Deposit',saveContext='deposit-save'}={}){
 if(activeModal?.awaitSave&&activeModal.busy||worldWriteOperation?.pending&&!worldWriteOperation.invalidated)return false;
 if(timeWriteOperation?.pending&&!timeWriteOperation.invalidated&&!(!timeWriteOperation.session&&!submit&&saveContext==='time-save'))return false;
 worldNearbyRequest=null;
 if(worldWriteOperation?.session===activeModal)invalidateWorldWriteOperation();if(timeWriteOperation?.session&&timeWriteOperation.session===activeModal)invalidateTimeWriteOperation();
 if(settingsOperation?.pending&&!settingsOperation.invalidated&&!(settingsOperation.inline&&!settingsOperation.session&&!submit&&saveContext==='settings-save'))return false;
 if(settingsOperation?.session&&settingsOperation.session===activeModal)invalidateSettingsOperation();
 if($('modal').open)preserveModalPointerGesture();else resetModalPointerGesture();
 suspendSettingsForm();
 if(!retainRounding)inputRounding=[];
 if(insurance)body+=optionalRuleFootnote('insurance');if(tax)body+=optionalRuleFootnote('tax');modalGeneration++;modalRevision=state.revision;
 const session={busy:false,valid:true,cancelled:false,terminal:false,awaitSave,saveName,saveContext,mutates:!!submit&&mutates};activeModal=session;
 $('modal-title').textContent=title;$('modal-body').innerHTML=body;$('modal-error').textContent='';
 $('modal-submit').textContent=label;$('modal-submit').hidden=!submit;$('modal-cancel').textContent=submit?'Cancel':'Close';syncModalSubmit();
 $('modal-form').onsubmit=async e=>{
  e.preventDefault();if(!submit||!modalCurrent(session)||session.busy||session.terminal||!session.valid||(session.mutates&&campaignReloadRequired))return;
  session.busy=true;syncModalSubmit();
  let submitted=false;
  try{
   normaliseFields(e.currentTarget);const data=new FormData(e.currentTarget);
   submitted=true;
   const result=await submit(data,()=>modalCurrent(session));
   session.busy=false;
   if(session.settingsOwner){if(result!==false)finishSettingsOperation(session.settingsOwner);}
   else if(result!==false&&(modalCurrent(session)||(session.awaitSave&&activeModal===session&&$('modal').open)))closeModal();
  }catch(err){
   // Replacement can empty History and its successful close can itself fail.
   // Its owned save outcome must stay terminal even after the dialog detached.
   if(['campaign-replace','settings-save'].includes(session.saveContext)&&submitted&&!(err?.code==='SAVE_NOT_COMMITTED'&&err.committed===false)){
    // closeModal retires its owner before native close. Restore that owner only
    // when close failed with this dialog still open and no newer owner exists.
    if(!activeModal&&$('modal').open)activeModal=session;
    try{terminalModalSaveFailure(session,Number.isSafeInteger(session.savedRevision)&&err?.code!=='SAVE_COMMITTED_PUBLICATION_FAILED'?new SaveCommittedPublicationError(session.savedRevision,err):err);}catch(reportError){if(session.saveContext!=='settings-save')throw reportError;}
   }else if(session.awaitSave&&activeModal===session&&$('modal').open){
    if(submitted&&!(err?.code==='SAVE_NOT_COMMITTED'&&err.committed===false))terminalModalSaveFailure(session,err);
    else{if(session.settingsOwner&&!session.settingsOwner.invalidated)restoreSettingsControls(session.settingsOwner);$('modal-error').textContent=err.message+(!store?.editable?' Reopen this dialog after taking over editing.':'');}
   }else if(modalCurrent(session))$('modal-error').textContent=err.message;
  }
  finally{if(activeModal===session){session.busy=false;if(session.timeOwner){try{syncModalSubmit();}catch(error){timeWriteFailure(session.timeOwner,error);}}else syncModalSubmit();}}
 };
 if(!$('modal').open)$('modal').showModal();
 if(submit&&annotateRounding){normaliseFields($('modal-form'));$('modal-body').insertAdjacentHTML('beforeend','<div id="rounding-input-note">'+roundingFootnote(inputRounding)+'</div>');}
}
// Temporary adapter: retain the established modal-test extraction boundary.
function saveCampaign(next,expected){return campaignWrites.save(next,expected);}
function receiveCampaign(next,metadata){
 // Storage updates, imports and ownership acquisition end this tab's offers,
 // even if a replacement reuses the same saved audit/offer IDs.
 campaignPublicationEpoch++;worldNearbyRequest=null;
 const local=campaignWrites.isLocalPublication(next,metadata),replacement=campaignWrites.takeReplacementPublication(next,metadata);
 // Controller provenance is one-use. A revision number by itself never owns
 // Settings completion, including a foreign publication at the same revision.
 const worldOwner=worldWriteOperation,ownWorld=local&&worldOwner?.pending&&!worldOwner.publication&&next.revision===worldOwner.revision+1;
 if(ownWorld)worldOwner.publication=next;else invalidateWorldWriteOperation();
 const timeOwner=timeWriteOperation,ownTime=local&&timeOwner?.pending&&!timeOwner.publication&&next.revision===timeOwner.revision+1;
 if(ownTime)timeOwner.publication=next;else invalidateTimeWriteOperation();
 const settingsOwner=settingsOperation,ownSettings=local&&settingsOwner?.pending&&!settingsOwner.publication&&next.revision===settingsOwner.revision+1;
 if(ownSettings){settingsOwner.publication=next;if(!settingsOwner.inline)markSettingsDraftStale();}
 else invalidateSettingsOperation(true);
 if(replacement&&replacementReview?.pending)replacementReview.publication=next;
 else invalidateReplacementReview();
 if(!local){invalidateJumpPreparation();invalidateUndoOperation();stockServices.invalidate();contractDrafts=[];mailCheck=null;passengers.clear();}
 state=next;known={...known,...next.worlds};view??=next.actual;
 // A local Undo publication is not its provider's completed save. Keep draft,
 // selection and route reconciliation in the owned completion below. Foreign
 // publications still reconcile immediately and retire that owner.
 if(ownWorld&&!worldOwner.invalidated){worldOwner.publicationDeferred=true;return;}
 if(ownTime&&!timeOwner.invalidated){timeOwner.publicationDeferred=true;return;}
 if(ownSettings&&!settingsOwner.invalidated){settingsOwner.publicationDeferred=true;return;}
 if(local&&undoOperation?.pending&&!undoOperation.invalidated){undoOperation.publicationDeferred=true;return;}
 if(replacement&&replacementReview?.pending&&!replacementReview.invalidated){replacementReview.publicationDeferred=true;return;}
 syncMailCheck();render();
}
function act(label,fn,expected=($('modal').open?modalRevision:state.revision),{announce=true,onPrepared}={}){
 if(campaignReloadRequired)throw new SaveNotCommittedError(Error('Reload this page before editing the campaign again.'));
 if(services.active()&&!services.committing())throw new SaveNotCommittedError(Error('Finish or cancel the open ship service before changing the campaign.'));
 const next=campaignWrites.transition(label,fn,expected,{onPrepared});
 if(!announce)return next;
 const completed=candidate=>{try{message(label+' saved.');}catch(cause){throw new SaveCommittedPublicationError(candidate.revision,cause);}return candidate;};
 return next&&typeof next.then==='function'?Promise.resolve(next).then(completed):completed(next);
}
function savedRoll(r){return r?.dice?.length?r.dice.join(' + ')+' = '+r.total:r?.total!=null?(r.manual?'Manual roll total: ':'Recorded total: ')+r.total:'Not recorded';}
function contractRules(){return '<p class="help">Deadlines and manual contract terms are referee inputs. Recorded overrides take precedence over generated terms. <a href="'+ROOT+'RULES_VERIFICATION.md" target="_blank" rel="noopener">Rules verification</a>.</p>';}
function contractRolls(c){
 const a=c.audit||{},d=a.dm,m=a.modifiers;let body='';
 if(a.manual)return '<h3>Referee terms '+ruleInfo('booking')+'</h3><p class="help">Referee-entered contract; no generated availability or quantity rolls.</p>'+auditFacts([['Referee terms / reason',a.reason||'Not recorded']]);
 if(c.kind==='mail'){
  body+='<h3>Recorded search inputs</h3>'+auditFacts([['Search 2D',savedRoll(a.searchDice)],['Search skill DM',signedDM(a.searchSkill)],['Search characteristic DM',signedDM(a.searchCharacteristic)],['Search target','8+']]);
  for(const [key,label]of [['origin','Origin'],['destination','Destination']]){
   const w=a.worldInputs?.[key];
   body+='<h4>'+label+' at this check</h4>'+(w?auditFacts([['World',w.name??'Not recorded'],['Population',w.population],['Starport',w.starport],['Tech Level',w.techLevel],['Travel zone',w.zone]]):'<p class="help">World inputs not recorded; saved modifiers below are retained without recalculating them.</p>');
  }
 }
 if(d){
  body+='<h3>Freight traffic DM '+ruleInfo('freight')+'</h3>'+auditFacts([['Origin world DM',signedDM(d.origin)],['Destination world DM',signedDM(d.destination)],['Distance DM',signedDM(d.distance)],['Search Effect',signedDM(d.effect)],['Combined freight traffic DM',signedDM(d.total)]]);
  for(const [key,label]of [['origin','Origin'],['destination','Destination']])if(d.components?.[key])body+='<h4>'+label+' world modifiers</h4>'+auditFacts([['Population DM',signedDM(d.components[key].population)],['Starport DM',signedDM(d.components[key].starport)],['Technology DM',signedDM(d.components[key].techLevel)],['Travel-zone DM',signedDM(d.components[key].zone)]]);
  body+='<p class="help">'+(d.components?'World and route modifiers plus search Effect.':'World DMs combine the recorded population, starport, technology and travel-zone effects. Individual components were not stored.')+' Mail excludes major/incidental freight-category DMs (INT-004).</p>';
 }
 if(c.kind==='mail'){
  body+='<h3>Mail availability '+ruleInfo('mail')+'</h3>'+auditFacts([['Direct distance',a.distance==null?'Not recorded':a.distance+' parsecs'],['Availability 2D roll',savedRoll(a.dice)],['Freight-band conversion',d?.total==null||m?.freight==null?'Not recorded':signedDM(d.total)+' traffic → '+signedDM(m.freight)+' mail DM'],['Freight-band DM',signedDM(m?.freight)],['Armed ship DM',signedDM(m?.armed)],['Low technology DM',signedDM(m?.lowTech)],['Naval / Scout rank DM',signedDM(m?.rank)],['Social Standing DM',signedDM(m?.soc)],['Final availability result',a.total??'Not recorded'],['Required result','12+'],['Outcome',a.total==null?'Not recorded':a.total>=12?'Mail available':'No mail available'],['Container-count die',a.total!=null&&a.total<12?'Not rolled: no mail available':savedRoll(a.count)],['Quantity per container','5 tons'],['Payment per container','Cr 25,000 on delivery, regardless of distance']])+'<p class="help">Freight traffic uses both endpoint totals, −1 per parsec beyond the first, and search Effect (search total + skill + characteristic − 8). Convert that combined traffic DM to the mail band before adding the mail modifiers. Freight traffic bands: ≤ −10 gives −2; −9 to −5 gives −1; −4 to +4 gives 0; +5 to +9 gives +1; ≥ +10 gives +2. Armed ship: +2 if armed, otherwise 0. Low technology: −4 only when origin TL ≤ 5, otherwise 0 (INT-002). Rank uses the highest Naval / Scout rank; SOC uses the highest crew Social Standing DM. Recorded zero modifiers are shown.</p>';
 }else if(a.traffic||a.size){
  body+='<h3>Freight quantity and payment</h3>'+auditFacts([['Direct distance',a.distance==null?'Not recorded':a.distance+' parsecs'],['Freight category',c.type||'Not recorded'],['Traffic 2D roll',savedRoll(a.traffic)],['Freight category DM',signedDM(a.typeDM)],['Traffic table result (limited to 1–20)',a.result??'Not recorded'],['Lot-count dice',savedRoll(a.count)],['This lot tonnage die',savedRoll(a.size)],['Tonnage multiplier',core.freight.lotTypes[c.type]?.multiplier??'Not recorded'],['Table rate per ton',core.freight.paymentCreditsPerTonByParsecs[a.distance]==null?'Not recorded':money(core.freight.paymentCreditsPerTonByParsecs[a.distance])]]);
 }else body+='<p class="help">No generated contract rolls were saved for this entry.</p>';
 return body;
}
function contractDetails(c){
 if(!c)return '<p class="help">This contract is no longer available.</p>';
 if(c.kind==='passenger')return passengers.details(c);
 const name=id=>world(id)?.name||'Not recorded',date=h=>h==null?'None specified':displayDate(state.dateLabel,h);
 let rate='Not recorded';if(c.payment!=null&&c.quantity!=null&&A.cmp(c.quantity,0)>0){try{rate=money(A.decimal(A.div(c.payment,c.quantity)))+' / ton';}catch{rate='Approximately '+money(A.decimal(A.div(A.floor(A.mul(A.div(c.payment,c.quantity),100)),100)))+' / ton';}}
 let body=auditFacts([['Contract type',c.kind==='mail'?'Mail':'Freight'],['Description',c.description||c.type|| (c.kind==='mail'?'Mail containers':'Freight lot')],['Status',c.status==='cancelled'?'Cancelled before first jump; no payment or penalty':c.status==='delivered'?'Delivered and paid':c.status==='accepted'?'Accepted; payment due on delivery':'Available offer; not yet accepted'],['Origin',name(c.origin)],['Destination',name(c.destination)],['Tonnage',c.quantity==null?'Not recorded':c.quantity+' t'],['Rate per ton',rate],['Agreed total revenue',c.payment==null?'Not recorded':money(c.payment)],['Delivery deadline',date(c.dueHours)]]);
 if(c.kind==='mail'&&c.status){
  const eligibility=c.status==='accepted'&&state.contracts.find(saved=>saved.id===c.id)===c?S.mailCancellationEligibility(state,c.id):null,departure=eligibility?.source==='unverified'?undefined:eligibility?.source==='legacy-undo'?eligibility.firstDeparture:c.firstDeparture;
  body+='<h3>Mail lifecycle '+ruleInfo('mail')+'</h3>'+auditFacts([[departure?.priorHistoryUnverified?'First recorded departure':'First departure',departure?name(departure.from)+' → '+name(departure.to)+' · '+date(departure.hours):departure===null?'No committed jump after acceptance':'Not verified in this older contract'],...(departure?[['Departure event',departure.eventId],['Departure revision',departure.revision],...(departure.priorHistoryUnverified?[['Earlier travel','Unverified in this older contract']]:[])]:[]),...(eligibility?.source==='legacy-undo'?[['Departure verification','Verified from retained Undo history']]:[]),['Reserved cargo',c.status==='accepted'?c.quantity+' t':'None']]);
  if(c.status==='cancelled')body+='<h3>Cancellation result</h3>'+auditFacts([['Cancelled at',date(c.cancelledHours)],['Cancellation world',name(c.cancellation?.world)],['Cancellation revision',c.cancellation?.revision??'Not recorded'],['Departure verification',c.cancellation?.source==='legacy-undo'?'Verified from retained Undo history':c.cancellation?.source==='recorded'?'Recorded lifecycle marker':'Not recorded'],['Cargo space released',c.quantity+' t'],['Income','Cr 0'],['Penalty','Cr 0']])+'<p class="help">The whole consignment was cancelled before its first committed jump. Original terms and rolls remain here for audit. Undo restores the accepted consignment. Use Check for mail for a new offer.</p>';
 }
 if(c.status==='delivered')body+='<h3>Delivery result '+ruleInfo(c.kind==='mail'?'mail':'freight-delivery')+'</h3>'+auditFacts([['Delivered at',date(c.deliveredHours)],['Late delivery',c.late?'Yes':'No'],['Late-penalty die',c.late?(c.penaltyDie??'Not recorded'):'Not required'],['Actual payment',c.payout==null?'Not recorded':money(c.payout)]]);
 body+='<p class="help">Accepting reserves cargo space. Payment is recorded on delivery. This is freight or mail carried for another party, separate from speculative cargo.</p>'+contractRolls(c);
 if(c.overrides?.length)body+='<h3>Changes to contract terms</h3>'+c.overrides.map(o=>auditFacts([['Changed at',date(o.hours)],['Reason',o.reason],['Previous description',o.before?.description||'Not recorded'],['New description',o.after?.description||'Not recorded'],['Tons before',o.before?.quantity??'Not recorded'],['Tons after',o.after?.quantity??'Not recorded'],['Payment before',o.before?.payment==null?'Not recorded':money(o.before.payment)],['Payment after',o.after?.payment==null?'Not recorded':money(o.after.payment)],['Deadline before',date(o.before?.dueHours)],['Deadline after',date(o.after?.dueHours)]])).join('');
 return body+contractRules();
}
function historyDetails(e){
 if(!e)return '<p class="help">This history entry is no longer available.</p>';
 if(e.worldChangeAudit||e.label==='World override')return worldChangeDetails(e);
 const name=id=>world(id)?.name||'Not recorded';
 let body=auditFacts([['Action',e.label],['Recorded at',e.hours==null?'Not recorded':displayDate(state.dateLabel,e.hours)],['World',name(e.world)],['Reason / notes',e.reason||'None recorded']]);
 if(e.contactSearch)return body+auditFacts([['Contact',e.partyName],['Search type',e.kind]])+contactSearchDetails(e.contactSearch,e.dateLabel||state.dateLabel);
 if(e.roundingChanges)return body+table(['Value','Before','After'],e.roundingChanges.map(c=>'<tr><td>'+esc(c.label)+'</td><td>'+esc(c.before)+'</td><td>'+esc(c.after)+'</td></tr>'))+roundingFootnote(e.roundingChanges,e.roundingStep||100);
 if(e.from!==undefined||e.to!==undefined)body+='<h3>Movement</h3>'+auditFacts([['From',name(e.from)],['To',name(e.to)]]);
 if(e.generatedHours!=null||e.effectiveHours!=null)body+=auditFacts([['Jump duration dice',savedRoll(e.dice)],['Generated jump duration',e.generatedHours==null?'Not recorded':e.generatedHours+' hours'],['Elapsed time used',e.effectiveHours==null?'Not recorded':e.effectiveHours+' hours']])+'<p class="help">Jump duration '+ruleInfo('jump-duration')+' · Any entered duration override is shown above.</p>';
 if(e.label==='Jump roll prepared'){const attempt=state.jumpAttempts?.find(a=>a.id===e.jumpAttemptId),roll=attempt?.rolls[e.rollIndex];body+=auditFacts([['Saved jump duration dice',savedRoll(roll)],['Generated duration',roll?148+roll.total+' hours':'Not recorded'],['Travel','Not committed by this preview']]);}
 if(e.jumpAttemptId)body+='<h3>Jump attempt '+ruleInfo('jump-undo')+'</h3>'+auditFacts([['Jump attempt',e.jumpAttemptId],['Mulligan status recorded',e.label.startsWith('Undo: ')?'Consumed by this undo':e.mulliganUsed?'Used · final attempt':'Original attempt']]);
 if(e.fuel)body+='<h3>Jump fuel</h3>'+auditFacts([['Ship displacement',e.fuel.displacementTons+' tons'],['Distance',e.fuel.distance+' pc'],['Calculation','10% of displacement per parsec, rounded up'],['Fuel required',e.fuel.tons+' tons'],['Fuel consumed from tank',(e.fuel.consumed??e.fuel.tons)+' tons'],['Fuel shortfall',(e.fuel.shortfall??0)+' tons'],['Fuel before',e.fuel.before+' tons'],['Fuel after',e.fuel.after+' tons']])+'<p class="help rule-footnote">Jump fuel '+ruleInfo('jump-fuel')+'</p>';
 if(e.fuelCorrection){const q=e.fuelCorrection;body+='<h3>Fuel aboard correction</h3>'+auditFacts([['Fuel before',q.before+' t'],['Actual fuel remaining',q.after+' t'],['Fuel removed',q.removed+' t'],['Reason',q.reason||'Not entered'],['Bank change','Cr 0 · no refund']])+'<p class="help">Manual actual-stock reduction. Undo restores fuel and cargo space together.</p>';}
 if(e.offers){
  if(e.mailAudit)body+=mailCheckReferenceDetails(e);
  body+='<h3>'+(e.mailOnly?'Mail check':'Freight and mail search')+'</h3>'+auditFacts([['Destination',name(e.destination)],['Generated search dice',savedRoll(e.generatedSearchDice||e.searchDice)],['Search total used',e.effectiveSearchDice??'Not recorded'],['Broker / Streetwise skill DM',e.searchSkill??'Not separately recorded'],['Characteristic DM',e.searchCharacteristic??'Not separately recorded'],['Search target','8+'],['Search Effect',signedDM(e.effect)],['Offers generated',e.offers.length],['Entered dice used',e.manualDiceConsumed??0]]);
  if(e.manualDice?.length)body+=auditFacts([['Entered dice sequence',e.manualDice.join(', ')]]);
  body+=e.offers.length?table(['Type / description','Tons / people','Destination','Revenue'],e.offers.map(c=>'<tr><td>'+esc(c.description||c.passageClass||c.type||c.kind)+'</td><td>'+esc(c.kind==='passenger'?c.count+' people':c.quantity+' t')+'</td><td>'+esc(name(c.destination))+'</td><td>'+money(c.payment)+'</td></tr>')):'<p class="help">No offers generated.</p>';
  body+=e.offers.map((c,i)=>'<details><summary>Offer '+(i+1)+' calculation</summary>'+contractDetails(c)+'</details>').join('');
  if(e.mailAudit)body+='<details><summary>Mail search result</summary>'+contractRolls({kind:'mail',audit:e.mailAudit})+contractRules()+'</details>';
 }
 if(e.beforeCapacity!==undefined)body+='<h3>Reviewed passenger allocation</h3>'+auditFacts([['Reserved cabins before',e.beforeCapacity?.reservedCabins??'Not configured'],['Reserved cabins after',e.afterCapacity.reservedCabins],['Installed Low berths',e.afterCapacity.installedLowBerths]])+'<p class="help">Capacity review only. No people, payment or supplies changed.</p>';
 if(e.offer)body+=contractDetails(e.offer);
 if(e.contract)body+=contractDetails(e.contract);
 if(['Mortgage settings audit','Maintenance settings audit'].includes(e.label)){
  const mortgage=e.label==='Mortgage settings audit',title=mortgage?'Mortgage':'Monthly maintenance';
  const configured=value=>{
   if(!value)return '<p class="help">Not configured.</p>';
   const rows=mortgage?[['Original mortgage amount',money(value.originalAmount)],['Fixed payment / 4 weeks',money(value.payment)],['Payments remaining',value.remainingPayments],['Total paid so far',money(value.totalPaid)],['Remaining scheduled payments',money(String(A.credit(value.payment)*BigInt(value.remainingPayments)))]]:[['Fixed maintenance / 4 weeks',money(value.payment)],['Paid since tracking',money(value.paidSinceTracking)]];
   rows.push(['Next unpaid due date',value.nextDueDate],['Paid through installment due',value.lastPaidDueDate||'Prior dates not recorded']);return auditFacts(rows);
  };
  return body+'<h3>'+title+' before</h3>'+configured(e.before)+'<h3>'+title+' after</h3>'+configured(e.after)+'<p class="help">Settings correction only. No payment was charged.</p>';
 }
 const cargo=l=>auditFacts([['Commodity',good(l.commodity)?.name||'Not recorded'],['Description',l.description||'Not recorded'],['Quantity',l.quantity==null?'Not recorded':l.quantity+' t'],['Goods value',l.goodsValue==null?'Not recorded':money(l.goodsValue)],['Total cost basis',l.basis==null?'Not recorded':money(l.basis)]]);
 if(e.lot)body+='<h3>Cargo recorded</h3>'+cargo(e.lot);
 if(e.before||e.after)body+='<h3>Cargo before correction</h3>'+cargo(e.before||{})+'<h3>Cargo after correction</h3>'+cargo(e.after||{});
 if(!e.fuelCorrection&&!e.roundingChanges&&!e.offers&&!e.offer&&!e.contract&&!e.lot&&!e.before&&e.generatedHours==null)body+='<p class="help">'+(e.label?.startsWith('Undo:')?'This records an undo action. It is part of the history, not another charge.':'This is the saved action summary. Related payments and calculations can be viewed under Accounts → Details. Additional inputs were not saved in this history entry.')+'</p>';
 return body;
}
function worldChangeDetails(event){
 if(!isWorldChangeAudit(event))return '<p class="notice">This older entry does not contain a complete target-world and before/after audit. Individual restore is unavailable.</p><p class="help">Select the intended world and use World override to edit its current values. The editor shows the original published UWP. No historical values are guessed and this entry remains in the audit trail.</p>';
 const audit=event.worldChangeAudit,changes=worldChangeFields(event);
 const rows=changes.map(change=>{
  const eligible=worldFieldRevertEligibility(state,event.id,change.key,core),arg=event.id+'|'+change.key;
  const control=eligible.allowed?btn('Restore previous '+change.label.toLowerCase(),'world-field-revert',arg,true,'small').replace('<button','<button '+(!store?.editable?'disabled':'')):'<span class="help">'+esc(eligible.reason)+'</span>';
  return '<tr><td>'+esc(change.label)+'</td><td>'+esc(worldFieldValue(change.key,change.before))+'</td><td>'+esc(worldFieldValue(change.key,change.after))+'</td><td>'+control+'</td></tr>';
 });
 return auditFacts([['Action',audit.kind==='revert'?'Individual world-field correction':'World override'],['World',audit.worldName+' · '+audit.sector+' '+audit.hex],['Recorded at',displayDate(state.dateLabel,event.hours)],['Reason',event.reason]])+(rows.length?table(['Field','Previous value','Recorded value',''],rows):'<p class="help">No effective world fields changed in this edit.</p>')+'<p class="help">Restore changes only the chosen field to its recorded previous value, which may itself be another override rather than a published default. Later unrelated UWP digits, world fields, jumps, transactions and saved price quotes stay as recorded. The correction and this original entry remain in History.</p>'+(!store?.editable?'<p class="notice">Read-only: take over editing before restoring a value.</p>':'');
}
function previewWorldFieldRevert(argument){
 if(!store?.editable)throw Error('This tab is read-only. Take over editing first.');
 const [eventId,key,...extra]=String(argument).split('|');if(extra.length)throw Error('Invalid world-change selection.');
 const eligible=worldFieldRevertEligibility(state,eventId,key,core);if(!eligible.allowed)throw Error(eligible.reason);
 const revision=state.revision,{world,change}=eligible;
 modal('Restore previous '+change.label.toLowerCase(),auditFacts([['World',world.name+' · '+world.sector+' '+world.hex],['Current value',worldFieldValue(key,change.after)],['Previous value to restore',worldFieldValue(key,change.before)]])+'<p>This restores only '+esc(change.label.toLowerCase())+'. The previous value may itself be an override, rather than the published default.</p><p class="help">Other world fields and UWP digits, completed jumps, bank, cargo, contracts and saved quotes remain unchanged. A new correction is recorded in History; no audit entry is deleted.</p>',()=>act('World field reverted',s=>revertWorldField(s,eventId,key,core),revision),'Restore previous value',true,{annotateRounding:false,awaitSave:true,saveName:'World correction',saveContext:'world-field-revert'});
}
function audit(title,data){modal(title,title==='History entry'?historyDetails(data):contractDetails(data),null);}
function table(headers,rows,cls=''){return `<div class="scroll ${cls}"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;}
function holdBreakdown(){
 return [['Owned trade goods',A.decimal(A.sum(state.lots.map(l=>l.quantity)))],['Freight / mail aboard',A.decimal(A.sum(state.contracts.filter(c=>c.status==='accepted'&&c.kind!=='passenger').map(c=>c.quantity)))],['Passenger luggage',passengerLuggage(passengerShip(state))],['Basic passenger accommodation',A.decimal(passengerSpace(state))],['Fuel in bladders',bladderSpace(state.ship)],['Life support overflow',supportStock(passengerShip(state)).cargoTons==null?'Unknown':supportDisplay(supportCargo(passengerShip(state)))]];
}
function holdCounter(){
 return '<div class="stat" id="hold-summary"><details class="hold-details"><summary><span class="label">Cargo</span><span class="value">'+esc(supportDisplay(S.used(state)))+' / '+esc(state.ship.capacity)+' t</span></summary><div class="hold-breakdown"><p class="help">'+holdBreakdown().map(([label,tons])=>esc(label)+': '+esc(tons)+' t').join('<br>')+'</p>'+bladderStatus()+btn('View freight / mail','tab','Contracts',false,'small')+'</div></details></div>';
}
function bladderStatus(){const f=state.ship.fuel&&{...state.ship.fuel,...fuelCapacities(state.ship)};if(!f?.bladderTons)return '';const used=bladderSpace(state.ship);return '<p class="help"><strong>'+(used?'Bladders in use: '+used+' / '+f.bladderTons+' t':'Bladders empty - no cargo space used')+'</strong><br>Base tank: '+Math.min(f.aboardTons,f.baseCapacityTons)+' / '+f.baseCapacityTons+' t. Cargo occupied by bladder fuel: '+used+' t.</p>';}
function fuelCounter(){
 const f=state.ship.fuel&&{...state.ship.fuel,...fuelCapacities(state.ship)};
 return `<div class="stat fuel-counter"><span class="label">Jump fuel</span><span class="value">${f?'Aboard '+f.aboardTons+'t · Tank '+f.baseCapacityTons+'t · Bladder '+f.bladderTons+'t'+(f.aboardTons===0?' · EMPTY':''):'Set in Settings'}</span>${f?`<progress max="${f.capacityTons}" value="${f.aboardTons}" aria-label="Jump fuel aboard" aria-valuetext="${f.aboardTons} tons aboard of ${f.capacityTons} tons total capacity"></progress>`:''}</div>`;
}
function shipActions(){
 if(!state.initialized||tab!=='Overview')return '';
 const selected=tab==='Overview'?(services.selected()||(cargoHoldOpen?'cargo':null)):null;
 const serviceButton=(label,action,kind,mutate=true)=>btn(label,action,'',mutate,'primary').replace('<button','<button aria-pressed="'+(selected===kind)+'"'+(mapExpanded?'':' aria-controls="'+(selected==='cargo'?'cargo-hold-panel':selected==='expenses'?'expense-panel':selected?'service-panel':'world-information-panel')+'"'));
 return `<div class="ship-actions" aria-label="Ship services">${serviceButton('Refuel','refuel','fuel')}${serviceButton('Refill life support','refill-support','support')}${serviceButton('Cargo Hold','cargo-hold','cargo',false)}${serviceButton('Ship expenses','ship-expenses','expenses')}${campaignTimeCounter()}</div>`;
}
function refuelShortcut(){if(!state.ship.fuel){services.close();settings();message('Enter ship size, tank capacity and fuel aboard to enable refuelling.');return;}inputRounding=[];services.open('fuel');}
function lifeSupportCounter(){
 const x=state.ship.lifeSupport,q=x?supportStock(passengerShip(state)):null,days=value=>value==null?'Unknown':String(Number(Number(value).toFixed(2)));
 return `<div class="stat life-support-counter"><span class="label">Life support</span><span class="value">${q?days(q.remainingDays)+' days'+(q.remainingUnits==='0'?' · EMPTY':''):'Set in Settings'}</span>${q?`<span class="help">${q.remainingUnits==null?'Review recorded stock':days(q.remainingUnits)+' LSS aboard'} · ${days(q.targetDays)}-day target</span>${q.remainingDays!==null?'<progress max="'+q.targetDays+'" value="'+q.remainingDays+'" aria-label="Life support endurance against standard refill target"></progress>':''}`:''}</div>`;
}
function campaignTimeCounter(){
 return `<div class="stat campaign-time"><span class="label">Campaign time</span><span class="value">${esc(displayDate(state.dateLabel,state.hours))}</span>${state.initialized?`<div class="day-controls" role="group" aria-label="Change campaign day"><button data-action="day-back" data-mutate ${state.hours<24?'data-unavailable disabled':''} title="Move the date back 24 hours without restoring supplies or reversing transactions. Use Undo to reverse an accidental advance.">&#8722;1 day</button><button data-action="day-forward" data-mutate ${!Number.isSafeInteger(state.hours+24)?'data-unavailable disabled':''} title="Advance 24 hours and consume life support supplies. Undo restores the date and supplies together.">+1 day</button></div>`:''}</div>`;
}
// Time controls own their save completion, not a second campaign snapshot.
function createTimeWriteOwner(session=null){
 const owner={session,form:session?$('modal-form'):null,campaign:state,revision:state.revision,epoch:campaignPublicationEpoch,editing:editingLossEpoch,generation:modalGeneration,tab,view,pending:false,invalidated:false,publication:null,publicationDeferred:false};
 if(session)session.timeOwner=owner;timeWriteOperation=owner;return owner;
}
function invalidateTimeWriteOperation(){
 const owner=timeWriteOperation;if(!owner)return;
 owner.invalidated=true;owner.publicationDeferred=false;
 if(owner.session)owner.session.cancelled=true;
 if(owner.session&&activeModal===owner.session&&$('modal').open){
  $('modal-error').textContent=campaignReloadRequired?campaignReloadMessage:'Campaign or editing ownership changed. Close and review the current campaign time before continuing.';
  syncModalSubmit();
 }
}
function timeWriteOwnerCurrent(owner){
 return timeWriteOperation===owner&&!owner.invalidated&&!campaignReloadRequired&&store?.editable&&editingLossEpoch===owner.editing&&tab===owner.tab&&view===owner.view&&
  (owner.session?modalCurrent(owner.session):!activeModal&&modalGeneration===owner.generation)&&
  (owner.publication?state===owner.publication&&campaignPublicationEpoch===owner.epoch+1:state===owner.campaign&&state.revision===owner.revision&&campaignPublicationEpoch===owner.epoch);
}
function restoreTimeWriteControls(owner){
 if(!owner.session||activeModal!==owner.session||!$('modal').open)return;
 for(const [control,disabled]of owner.controls||[])control.disabled=disabled;
 owner.controls=null;syncModalSubmit();
}
function timeWriteFailure(owner,error){
 if(owner.publication&&error?.code!=='SAVE_COMMITTED_PUBLICATION_FAILED')error=new SaveCommittedPublicationError(owner.publication.revision,error);
 owner.pending=false;owner.publicationDeferred=false;
 if(owner.session)owner.session.busy=false;
 const known=error?.code==='SAVE_NOT_COMMITTED'&&error.committed===false&&!owner.publication;
 if(known&&!owner.uiFailure){
  if(!timeWriteOwnerCurrent(owner))return false;
  if(!owner.session)throw error;
  try{
   owner.session.awaitSave=false;restoreTimeWriteControls(owner);
   if(!owner.form)$('modal-body').innerHTML='<p>The campaign day was not saved. Close this dialog and try the day control again if the change is still wanted.</p>';
   $('modal-error').textContent=error.message;return false;
  }catch(reportError){error=reportError;}
 }
 // Native close and report faults remain terminal even after the old dialog
 // detached. Reattach only its own failed closing generation, never newer UI.
 if(!activeModal&&$('modal').open&&modalGeneration===owner.closingGeneration)activeModal=owner.session;
 owner.invalidated=true;
 try{terminalModalSaveFailure(owner.session||{saveName:'Campaign time',saveContext:'time-save'},error);}catch{/* Reload guards precede reporting. */}
 return false;
}
function finishTimeWrite(owner,label){
 const published=owner.publication;
 if(!published||published.revision!==owner.revision+1)throw Error('Time save completion did not publish the expected campaign.');
 if(owner.session)owner.session.savedRevision=published.revision;
 if(!timeWriteOwnerCurrent(owner))return false;
 owner.publicationDeferred=false;syncMailCheck();
 if(owner.session){owner.session.busy=false;owner.closingGeneration=modalGeneration+1;closeModal();}
 if(state!==published||campaignPublicationEpoch!==owner.epoch+1||editingLossEpoch!==owner.editing||!store?.editable||campaignReloadRequired||tab!==owner.tab||view!==owner.view||activeModal||modalGeneration!==(owner.closingGeneration??owner.generation))return false;
 render();message(label+' saved.');return false;
}
function completeTimeWrite(owner,label,change){
 if(owner.pending)return false;
 if(!timeWriteOwnerCurrent(owner))throw new SaveNotCommittedError(Error('Campaign changed. Reopen campaign time before saving.'));
 owner.publication=null;owner.publicationDeferred=false;
 const fail=error=>timeWriteFailure(owner,error);
 const finish=()=>{
  try{return finishTimeWrite(owner,label);}catch(error){return fail(error);}
  finally{owner.pending=false;owner.publicationDeferred=false;if(owner.session)owner.session.busy=false;}
 };
 let result;
 try{result=act(label,change,owner.revision,{announce:false,onPrepared:()=>{
  if(!timeWriteOwnerCurrent(owner))throw Error('Campaign changed. Reopen campaign time before saving.');
  owner.pending=true;
  if(owner.session){
   owner.session.awaitSave=true;
   owner.controls=new Map([...owner.form.querySelectorAll('input,select,textarea,button')].map(control=>[control,control.disabled]));
   for(const control of owner.controls.keys())control.disabled=true;
   syncModalSubmit();
  }
 }});}catch(error){return fail(error);}
 return result&&typeof result.then==='function'?Promise.resolve(result).then(finish,fail):finish();
}
function awaitCampaignDay(owner,result){
 // Observe both outcomes before constructing the pending screen. UI failure
 // cannot abandon the provider or turn a rejected save into an unhandled one.
 const completed=Promise.resolve(result).then(value=>{
  try{if(owner.session&&activeModal===owner.session)syncModalSubmit();return value;}catch(error){return timeWriteFailure(owner,error);}
 },error=>timeWriteFailure(owner,error));
 owner.promise=completed;owner.pendingGeneration=modalGeneration+1;
 try{
  const opened=modal('Saving campaign day','<p>Saving the campaign day. Wait for the result before continuing.</p>',null,undefined,true,{retainRounding:true,awaitSave:true,saveName:'Campaign time',saveContext:'time-save',annotateRounding:false});
  if(opened===false)throw Error('Campaign time could not acquire its pending screen.');
  owner.session=activeModal;owner.session.busy=true;owner.session.mutates=true;syncModalSubmit();
 }catch(error){
  if(modalGeneration===owner.pendingGeneration&&activeModal?.saveContext==='time-save')owner.session=activeModal;
  owner.uiFailure=true;owner.invalidated=true;owner.publicationDeferred=false;
  if(owner.publication)error=new SaveCommittedPublicationError(owner.publication.revision,error);
  try{terminalModalSaveFailure(owner.session||{saveName:'Campaign time',saveContext:'time-save'},error);}catch{/* Reload guards precede reporting. */}
 }
 return completed;
}
function changeCampaignDay(direction){
 if(timeWriteOperation?.pending)return false;
 if(campaignReloadRequired)throw new SaveNotCommittedError(Error('Reload this page before editing the campaign again.'));
 if(!state.initialized||!store?.editable)throw Error('Open an editable campaign first.');
 if($('modal').open)throw new SaveNotCommittedError(Error('Close the current dialog before changing the campaign day.'));
 const hours=state.hours+direction*24;
 if(!Number.isSafeInteger(hours)||hours<0)throw Error('Cannot move outside the supported campaign time or before its start.');
 const before=displayDate(state.dateLabel,state.hours),after=displayDate(state.dateLabel,hours),owner=createTimeWriteOwner();
 const result=completeTimeWrite(owner,(direction>0?'Time advanced +1 day: ':'Time correction -1 day: ')+before+' to '+after+(direction<0?' (supplies and transactions unchanged)':''),s=>{s.hours=hours;});
 return result&&typeof result.then==='function'?awaitCampaignDay(owner,result):result;
}
function render(){if(!core)return;if(timeWriteOperation?.publicationDeferred&&!timeWriteOperation.invalidated)return;if(worldWriteOperation?.publicationDeferred&&!worldWriteOperation.invalidated)return;captureSettingsDisclosures();if(settingsOperation&&!settingsOperation.invalidated&&(settingsOperation.pending||settingsOperation.publicationDeferred))return;if(undoOperation?.pending&&undoOperation.publicationDeferred&&!undoOperation.invalidated)return;if(replacementReview?.pending&&replacementReview.publicationDeferred&&!replacementReview.invalidated)return;if(routeDraft&&(routeDraft.revision!==state.revision||!store?.editable))routeDraft=null;if(view&&!world(view))view=state.actual;selected=new Set([...selected].filter(id=>state.lots.some(l=>l.id===id)));$('summary').innerHTML=[['Ship',state.ship.name],['Current world',actual()?.name||'Not set']].map(([l,v])=>`<div class="stat"><span class="label">${esc(l)}</span><span class="value">${esc(v)}</span></div>`).join('')+fuelCounter()+lifeSupportCounter()+holdCounter()+`<div class="stat"><span class="label">Credits</span><span class="value mono">${money(state.bank)}</span></div>`;$('ship-actions').innerHTML=shipActions();$('tabs').innerHTML=['Overview','Trade','Cargo','Contracts','Accounts','Dashboard','History','Settings'].map(t=>btn(t,'tab',t,false,tab===t?'active':'').replace('<button','<button '+(tab===t?'aria-current="page"':''))).join('');if(store?.recovery){$('main').innerHTML=panel('Recover saved campaign',`<div class="panel-body"><p class="notice">${esc(store.recoveryMessage||'Saved data needs recovery.')}</p><p>The saved data has not been replaced. Export its raw contents before importing a valid backup or resetting.</p><div class="wide-actions">${btn('Export raw saved data','export')}${btn('Load campaign (JSON)','import','',true)}${btn('Reset campaign','reset','',true,'danger')}</div></div>`);}else if(!state.initialized){$('main').innerHTML=`<section class="panel welcome"><span class="eyebrow">YOUR NEXT TRADE STARTS HERE</span><h2>Bring your campaign aboard.</h2><p class="muted">Set your current world, ship and bank balance. Add cargo you already own without buying it again. Your campaign stays in this browser; export a backup whenever you need one.</p><div class="wide-actions">${btn('Set up campaign','setup','',true,'primary')}${btn('Load campaign (JSON)','import')}</div><p class="help">Free static tool · Traveller Map world data · Core Rulebook Update 2022 · Optional Merchant Prince insurance and taxes</p></section>`;}else if(tab==='Overview')$('main').innerHTML='<div class="navigation-layout'+(mapExpanded?' map-expanded':'')+'">'+mapPanel()+(mapExpanded?'':services.active()?services.panel():cargoHoldOpen?cargoHoldPanel(state,core):worldScreen(viewed()))+'</div>'+overviewCargo();else if(tab==='Trade')$('main').innerHTML=tradeLocation()+marketPanel()+cargoPanel(false);else if(tab==='Cargo')$('main').innerHTML=cargoPanel(true)+policyPanel();else if(tab==='Contracts')$('main').innerHTML=contractsPanel();else if(tab==='Accounts')$('main').innerHTML=accountsPanel();else if(tab==='Dashboard')$('main').innerHTML=dashboardPanel(state);else if(tab==='History')$('main').innerHTML=historyPanel();else $('main').innerHTML=settingsPanel();mountSettingsForm();if($('modal').open)suspendSettingsForm();document.querySelectorAll('[data-mutate]').forEach(b=>b.disabled=(!store?.editable&&!(b.closest('#ship-actions')&&b.getAttribute('aria-pressed')==='true'))||b.hasAttribute('data-unavailable')||services.active()&&!b.closest('#service-panel,#expense-panel')&&!(b.closest('#ship-actions')&&['refuel','refill-support','ship-expenses'].includes(b.dataset.action)));services.syncControls();}
function mapHexGrid(w,point,scale){
 if(!showHexes||scale<24)return '';
 const radius=scale/Math.sqrt(3),cells=[];
 const center=camera(w,mapPan,mapZoom),rx=Math.ceil(MAP_GEOMETRY.halfWidth/(scale*Math.sqrt(3)/2))+2,ry=Math.ceil(MAP_GEOMETRY.halfHeight/scale)+2;
 for(let x=Math.floor(center.x)-rx;x<=Math.ceil(center.x)+rx;x++)for(let y=Math.floor(center.y)-ry;y<=Math.ceil(center.y)+ry;y++){
  const dx=x-w.x,dy=y-w.y;const [cx,cy]=point({x,y});

  const corners=Array.from({length:6},(_,i)=>[cx+radius*Math.cos(i*Math.PI/3),cy+radius*Math.sin(i*Math.PI/3)].join(',')).join(' ');
  const hx=((Number(w.hex.slice(0,2))-1+dx)%32+32)%32+1,hy=((Number(w.hex.slice(2))-1+dy)%40+40)%40+1;
  const hex=String(hx).padStart(2,'0')+String(hy).padStart(2,'0');
  cells.push(`<polygon data-hex="${hex}" ${routeDraft?`data-action="map-empty" data-arg="${x},${y}" role="button" tabindex="0" aria-label="Choose hex ${hex}"`:""} points="${corners}"/>${scale>=40?`<text x="${cx}" y="${cy+(scale>=120?53:13)}" text-anchor="middle">${hex}</text>`:''}`);
 }
 return '<g class="hex-grid">'+cells.join('')+'</g>';
}
const mapLabelMeasure=document.createElement('canvas').getContext('2d');
function mapWorldLabel(w,x,y,scale){
 const withUwp=showUwp&&mapZoom>=2.4,close=mapZoom>=2.4;
 let uwp='';if(withUwp){try{uwp=R.context(w,core).uwp.raw;}catch{uwp=w.uwp||'Unknown UWP';}}
 mapLabelMeasure.font='10px system-ui, sans-serif';
 const width=mapLabelMeasure.measureText(w.name).width;
 let name=w.name,size=10*(scale/50)*Math.min(1,36/Math.max(1,width));
 if(close){
  size=14;mapLabelMeasure.font=size+'px system-ui, sans-serif';
  while(name.length>1&&mapLabelMeasure.measureText(name+(name!==w.name?'…':'')).width>88)name=name.slice(0,-1);
  if(name!==w.name)name+='…';
 }
 return '<text class="world-name" x="'+x+'" y="'+(close?y+25:y-Math.max(8,11*scale/50))+'" text-anchor="middle" style="font-size:'+size+'px">'+esc(name)+'</text>'+(withUwp?'<text class="world-uwp" x="'+x+'" y="'+(y+39)+'" text-anchor="middle" fill="#a6bacb" style="font:10px ui-monospace,monospace">'+esc(uwp)+'</text>':'');
}
function worldScreen(w){
 if(!w)return '';
 const published=planetInformation(w),facts=worldMapFacts(w),isActual=w.id===state.actual;
 let data=published;
 const rows=rs=>'<dl class="world-facts">'+rs.map(([label,value])=>'<dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd>').join('')+'</dl>';
 let codes='',effective='';
 if(!w.emptySpace)try{
  const c=ctx(w.id);
  codes='<div class="screen-trade"><h3>Calculator trade codes</h3><div class="badge-row">'+c.codes.map(code=>'<span title="'+esc(tradeCodeLabel(code))+'">'+esc(code)+'</span>').join('')+(c.unknown.length?'<span>Incomplete UWP</span>':!c.codes.length?'<span>No qualifying codes</span>':'')+'</div></div>';
  if(w.overrideUWP){
   data=planetInformation(w,{uwp:c.uwp.raw});
   effective='<p class="help screen-override">Campaign UWP override. Published UWP: <span class="mono">'+esc(published.uwp)+'</span>. Reason: '+esc(w.overrideReason||'Not recorded')+'. Population uses the effective UWP and published PBG multiplier. Other world data and map symbols show published values.</p>';
  }
  if(facts.zone!==null&&w.zone!==facts.zoneName)effective+='<p class="help screen-override">Calculator travel zone: '+esc(w.zone)+'. The world data and map symbols show the published zone.</p>';
 }catch(error){codes='<p class="bad">'+esc(error.message)+(w.overrideUWP?' Effective UWP unavailable; published UWP and population are shown.':'')+'</p>';}
 const body=w.emptySpace?'<p class="help">Empty space: no planet, starport or services.</p>':rows(data.summary)+'<section class="screen-uwp"><div class="screen-section-heading"><h3>'+((w.overrideUWP&&data!==published)?'Effective Universal World Profile':'Universal World Profile')+'</h3><span class="mono">'+esc(data.uwp)+'</span></div><div class="screen-uwp-scroll" tabindex="0" role="region" aria-label="Decoded World Profile table"><table aria-label="Decoded Universal World Profile"><thead><tr><th>Field</th><th>Code</th><th>Meaning</th></tr></thead><tbody>'+data.decoded.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section><div class="screen-system">'+rows(data.system.filter(([label])=>['Gas giants','Bases'].includes(label)))+'</div>'+codes+effective;
 return '<aside id="world-information-panel" class="panel world-screen world-info" aria-label="Selected world data"><div class="screen-topline"><span>● World data</span><span>'+(isActual?'Ship location':'Selected world')+'</span></div><div class="screen-title"><h2><strong>'+esc(w.name)+'</strong></h2>'+(!w.emptySpace?'<span class="tag '+(facts.zone==='R'?'illegal':facts.zone==='A'?'amber':'')+'">'+esc(facts.zoneName)+'</span>':'')+'</div><p class="screen-source help">Traveller Map · M1105'+(w.emptySpace?' · Empty hex':'')+'</p>'+body+'<div class="world-actions">'+(w.emptySpace?'':btn('Planet information','planet-info',w.id))+(w.id!==state.actual?btn('Use as starting world','set-location',w.id,true,'small'):'')+(w.emptySpace?'':btn('World override','override',w.id,true,'small'))+'<span class="help">Fuel: '+(M.fuel(w,state.ship,core)?'available':'unconfirmed / unavailable')+'</span></div>'+mapKeyMarkup()+'<p class="screen-footer help">Ship: '+esc(actual()?.name)+' · Selecting a world does not move the ship.</p></aside>';
}
// This control always follows the saved route's actual position, never the
// browsed world. It only opens the existing one-leg confirmation.
function routeJumpControl(){
 const next=routeDraft?null:world(state.route[state.routeIndex+1]);
 const reason=routeDraft?'Finish or cancel route planning before jumping.':next?'Opens the jump confirmation.':state.route.length>1?'Route complete. Plan another route for your next jump.':'Plan a route to choose your next jump.';
 const label=next?'Jump to '+next.name+' →':'Next jump';
 const button=btn(label,'jump','',true,'primary').replace('<button','<button aria-describedby="route-jump-help" '+(next?'':'data-unavailable disabled'));
 return `<div class="route-next"><div class="next-destination"><span class="help">Next destination</span><strong>${esc(next?.name||(routeDraft?'Planning route':state.route.length>1?'Route complete':'No route planned'))}</strong></div>${button}</div><p id="route-jump-help" class="help">${esc(reason)}</p>${jumpUndoControl()}`;
}
function jumpUndoControl(){
 const eligibility=S.jumpUndoEligibility(state),pending=currentJumpAttempt(state);
 const reason=pending?.mulliganUsed?'Mulligan used. The next jump is your one fresh, final attempt.':eligibility.reason;
 const allowed=eligibility.allowed&&!routeDraft;
 return '<div class="row">'+btn('Undo Jump','jump-undo','',true).replace('<button','<button aria-describedby="jump-undo-help" '+(allowed?'':'data-unavailable disabled'))+'<span id="jump-undo-help" class="help">'+esc(routeDraft?'Finish or cancel route planning before undoing a jump.':reason)+'</span></div>';
}
function clearJumpPreviews(){
 view=state.actual;mapPan={x:0,y:0};mapAnchor=null;routeDraft=null;
 previewSale=null;editSale=null;saleQuotes.clear();saleTaxDice.clear();selected.clear();snapshotId=null;
 contractDrafts=[];mailCheck=null;passengers.clear();syncMailCheck();
}
// Undo owns only its in-flight UI completion, never a second campaign snapshot.
function invalidateUndoOperation(){
 const owner=undoOperation;if(owner){owner.invalidated=true;if(owner.session)owner.session.cancelled=true;}
 if(activeModal?.undoCommit)activeModal.cancelled=true;
 if(activeModal&&$('modal').open&&(activeModal.undoCommit||activeModal===owner?.session)){
  if(campaignReloadRequired)$('modal-error').textContent=campaignReloadMessage;
  else if(!activeModal.terminal)$('modal-error').textContent='Campaign or editing ownership changed. Close and reopen Undo from the current campaign.';
  syncModalSubmit();
 }
}
function assertUndoReady(session=null){
 if(campaignReloadRequired)throw new SaveNotCommittedError(Error('Reload this page before editing the campaign again.'));
 if(!store?.editable)throw new SaveNotCommittedError(Error('This tab is read-only. Take over editing first.'));
 if(activeModal?.awaitSave&&activeModal.busy&&activeModal!==session)throw new SaveNotCommittedError(Error('Wait for the current campaign save to finish.'));
 if(services.active())throw new SaveNotCommittedError(Error('Finish or cancel the open ship service before undoing a campaign change.'));
}
function completeUndoWrite(owner,save,cleanup){
 assertUndoReady(owner.session);
 if(undoOperation?.pending)throw new SaveNotCommittedError(Error('Wait for the current Undo to finish.'));
 undoOperation=owner;owner.pending=true;
 const release=()=>{owner.pending=false;if(undoOperation===owner)undoOperation=null;};
 const fail=error=>{
  release();
  // The shared modal reports errors only while it remains open and owned. An
  // Undo Jump whose screen disappeared must still lock an uncertain save.
  if(owner.dedicated&&!(error?.code==='SAVE_NOT_COMMITTED'&&error.committed===false)&&(activeModal!==owner.session||!$('modal').open)){
   try{terminalModalSaveFailure(owner.session,error);}catch{/* Reload guards precede reporting. */}
  }
  throw error;
 };
 const finish=()=>{
  try{
   if(owner.uiFailure||owner.invalidated||!store?.editable||undoOperation!==owner||(owner.session&&!modalCurrent(owner.session)))return;
   if(state.revision!==owner.revision+1)throw Error('Undo completion did not publish the expected campaign.');
   owner.publicationDeferred=false;
   try{syncMailCheck();cleanup();}catch(cause){throw new SaveCommittedPublicationError(owner.revision+1,cause);}
  }catch(error){return fail(error);}finally{release();}
 };
 let result;try{result=save();}catch(error){return fail(error);}
 if(result&&typeof result.then==='function')return owner.promise=Promise.resolve(result).then(finish,fail);
 return finish();
}
function immediateUndoFailure(owner,error){
 const session=owner.session;if(session)session.busy=false;
 if(owner.uiFailure){if(activeModal===session)syncModalSubmit();return;}
 if(error?.code==='SAVE_NOT_COMMITTED'&&error.committed===false){
  if(session&&activeModal===session&&$('modal').open){
   $('modal-body').innerHTML='<p>This Undo was not saved. Close this dialog, review the current History, and try Undo again if it is still wanted.</p>';
   $('modal-error').textContent=error.message;syncModalSubmit();return;
  }
  throw error;
 }
 terminalModalSaveFailure(session||{saveName:'Undo',saveContext:'undo-save',terminal:false,cancelled:false},error);
 if(session&&activeModal===session)syncModalSubmit();
}
function awaitImmediateUndo(owner,result){
 // Install both handlers before rendering a pending screen, so a display fault
 // cannot abandon a write or hide a rejection. No extra confirmation is added.
 const completed=Promise.resolve(result).then(()=>{
  const session=owner.session;if(session)session.busy=false;
  if(owner.uiFailure){if(activeModal===session)syncModalSubmit();return;}
  try{
   if(session&&activeModal===session&&$('modal').open){
    if(owner.invalidated||!store?.editable){$('modal-body').innerHTML='<p>The Undo save finished after the campaign or editor changed. Close this dialog and review the current History before continuing.</p>';syncModalSubmit();}
    else closeModal();
   }
  }catch(cause){immediateUndoFailure(owner,new SaveCommittedPublicationError(owner.revision+1,cause));}
 },error=>immediateUndoFailure(owner,error));
 owner.promise=completed;owner.pendingGeneration=modalGeneration+1;
 try{
  const opened=modal('Undoing latest action','<p>Saving Undo. Wait for the result before continuing.</p>',null,undefined,true,{awaitSave:true,saveName:'Undo',saveContext:'undo-save',annotateRounding:false});
  if(opened===false)throw Error('Undo could not acquire its pending screen.');
  owner.session=activeModal;owner.session.busy=true;syncModalSubmit();
 }catch(error){
  if(modalGeneration===owner.pendingGeneration&&activeModal?.saveContext==='undo-save')owner.session=activeModal;
  owner.uiFailure=true;owner.invalidated=true;
  try{terminalModalSaveFailure(owner.session||{saveName:'Undo',saveContext:'undo-save',terminal:false,cancelled:false},error);}catch{/* Reload guards precede display and role notification. */}
 }
 return completed;
}
function undoJump(){
 if(undoOperation?.pending)return false;
 assertUndoReady();
 const eligibility=S.jumpUndoEligibility(state);if(!eligibility.allowed)throw Error(eligibility.reason);
 const revision=state.revision;
 modal('Undo Jump · one mulligan',`<p>Return to <strong>${esc(world(eligibility.jump.from)?.name||eligibility.jump.from)}</strong> and restore the pre-jump date, fuel, life support, route, contracts and insurance?</p><p>This uses this departure’s only mulligan. The next jump initiation generates one fresh roll. Cancel, reopening and reloading will keep that new roll. The repeated jump cannot be undone again.</p><p class="help">Saved suppliers and cargo are retained. Jump history remains available for audit. A later campaign change makes Undo Jump unavailable.</p>`,()=>{
  const owner={revision,session:activeModal,dedicated:true,pending:false,invalidated:false,uiFailure:false,promise:null};
  return completeUndoWrite(owner,()=>campaignWrites.undoJump(revision),()=>{clearJumpPreviews();render();message('Jump undone. Returned to the departure world. One fresh attempt remains.');});
 },'Use mulligan & return',true,{awaitSave:true,saveName:'Undo Jump',saveContext:'undo-jump-save'});
 activeModal.undoCommit=true;syncModalSubmit();
}
function undoLatestChange(){
 if(undoOperation?.pending)return false;
 assertUndoReady();
 const label=state.undo.at(-1)?.label,isJump=!!state.undo.at(-1)?.jumpEventId||label?.startsWith('Jump: '),eligibility=isJump&&S.jumpUndoEligibility(state),mulligan=eligibility?.attempt;
 if(isJump&&mulligan&&!eligibility.allowed)throw Error('Cannot undo this protected jump. '+eligibility.reason+' Nothing was changed. Use individual World Changes corrections for eligible world fields.');
 const owner={revision:state.revision,session:null,pending:false,invalidated:false,uiFailure:false,promise:null};
 try{
  const result=completeUndoWrite(owner,()=>campaignWrites.undo(owner.revision),()=>{
   passengers.clear();
   if(isJump)clearJumpPreviews();
   else if(label==='Mail check'){contractDrafts=contractDrafts.filter(c=>c.kind!=='mail');mailCheck=null;}
   else if(['Contract search','Contract offer edited'].includes(label)){contractDrafts=[];mailCheck=null;}
   render();message(isJump?'Jump undone. Returned to the departure world.'+(mulligan?' One fresh attempt remains.':''):'Latest action undone.');
  });
  if(result&&typeof result.then==='function')return awaitImmediateUndo(owner,result);
 }catch(error){return immediateUndoFailure(owner,error);}
}
function routeStops(){
 const ids=routeDraft?routeDraft.path:state.route;
 return ids.map((id,i)=>{
  const current=routeDraft?i===0&&id===state.actual:i===state.routeIndex&&id===state.actual;
  const next=!routeDraft&&i===state.routeIndex+1;
  const badge=current?'Current':next?'Next':'';
  const button=btn((i+1)+'. '+world(id)?.name,'world',id,false,(current?'current ':next?'next ':'')+(!routeDraft&&i<state.routeIndex?'done':''))
   .replace('<button','<button '+(current?'aria-current="location"':''))
   .replace('</button>',badge?' <span class="route-stop-status">'+badge+'</span></button>':'</button>');
  return '<li>'+button+(i<ids.length-1?'<span class="route-arrow" aria-hidden="true">→</span>':'')+'</li>';
 }).join('');
}
function mapPanel(){queueMapGeometry();updateMapGeometry();const w=viewed();if(!w)return '';if(mapAnchor!==w.id){mapAnchor=w.id;mapPan={x:0,y:0};scheduleMapAreas();}const worlds=visibleMapWorlds(Object.values({...mapAreas.worlds,...known,...state.worlds}),camera(w,mapPan,mapZoom),50*mapZoom);const cx=MAP_GEOMETRY.originX,cy=MAP_GEOMETRY.originY,scale=50*mapZoom;const point=x=>[cx+(x.x-w.x)*scale*Math.sqrt(3)/2,cy+((x.y+((x.x%2+2)%2)*.5)-(w.y+((w.x%2+2)%2)*.5))*scale];const route=(routeDraft?routeDraft.path:state.route).map(id=>world(id)).filter(Boolean);const path=route.map(x=>point(x).join(',')).join(' ');const level=mapLevel(mapZoom),overview=level!=='world';const svg=`<svg data-map-level="${level}" class="world-map" aria-describedby="map-zoom-hint" viewBox="0 0 ${MAP_GEOMETRY.width} ${MAP_GEOMETRY.height}" role="img" aria-label="${overview?(level==='subsector'?'Subsector map; drag to pan, zoom in to browse worlds':'Sector map; drag to pan, zoom in to browse worlds'):'Local world map; drag to pan, click a world to browse'}"><defs><pattern id="stars" width="37" height="43" patternUnits="userSpaceOnUse"><circle cx="7" cy="13" r=".6" fill="#376076"/></pattern></defs><rect width="${MAP_GEOMETRY.width}" height="${MAP_GEOMETRY.height}" fill="url(#stars)"/><g class="map-content" transform="translate(${mapPan.x} ${mapPan.y})">${overview?overviewMarkup({anchor:w,pan:mapPan,zoom:mapZoom,sectors:mapOverview.sectors||[],catalogs:mapOverview.cache,showTerritories,measure:(name,size)=>{mapLabelMeasure.font='600 '+size+'px system-ui, sans-serif';return mapLabelMeasure.measureText(name).width;}}):(showTerritories?mapTerritories({anchor:w,pan:mapPan,zoom:mapZoom,sectors:mapOverview.sectors||[],catalogs:mapOverview.cache}):'')+selectedWorldHex(cx,cy,scale)+mapHexGrid(w,point,scale)}<polyline points="${path}" fill="none" stroke="#62d3dd" stroke-width="1.5" opacity=".55"/>${(overview?[]:worlds).map(x=>{const[p,q]=point(x);return `<g class="${x.id===w.id?'selected-world':''}" role="button" tabindex="0" aria-label="Browse ${esc(x.name)}" data-action="map-world" data-arg="${x.id}"><title>${esc(x.name)} · ${esc(x.hex)}</title><circle cx="${p}" cy="${q}" r="${x.id===state.actual?(scale<24?4:7):(scale<24?2:4)}" fill="${x.id===state.actual?'#62d3dd':mapZoom>=2.4?'#bcd3df':x.zone==='Red'?'#ff959e':x.zone==='Amber'?'#f5bd6c':'#9bb7ce'}" stroke="${x.id===w.id?'#fff':'#172e40'}" stroke-width="${x.id===w.id?2:1}"/>${worldSymbols(x,p,q,{close:mapZoom>=2.4,selected:x.id===w.id,actual:x.id===state.actual,scale})}${mapWorldLabel(x,p,q,scale)}</g>`;}).join('')}${overview&&actual()?`<circle class="overview-location" cx="${point(actual())[0]}" cy="${point(actual())[1]}" r="2.5"><title>Actual location: ${esc(actual().name)}</title></circle>`:''}</g></svg>`;return `<section id="overview-navigation" class="panel navigation-panel" aria-label="Navigation">${mapRouteControls()}<div class="planned-route" role="group" aria-label="${routeDraft?'Route preview':'Planned route'}"><div class="route-heading"><div class="route-title"><strong>${routeDraft?'Route preview':'Planned route'} · ${route.length} ${route.length===1?'stop':'stops'}</strong><span class="help">Choose a stop to browse. Your ship stays at ${esc(actual()?.name)}.</span></div><div class="route-jump">${routeJumpControl()}</div></div><ol class="route-list" aria-label="${routeDraft?'Route preview':'Planned route'}">${routeStops()}</ol></div><div class="map-caption"><span>${esc(w.sector)} · ${esc(w.hex)} · <strong>${w.id===state.actual?'Viewing current location':'Browsing '+esc(w.name)+' · ship at '+esc(actual()?.name)}</strong></span><span id="map-load-status" role="status"></span>${btn(mapExpanded?'Restore panels':'Expand map','map-expand','',false,'map-expand-toggle').replace('<button','<button aria-expanded="'+mapExpanded+'" aria-controls="overview-navigation"')}</div><div class="map-viewport">${svg}</div><div class="map-toolbar"><div class="map-tools">${btn('Find world','find')}<details id="route-menu" class="route-menu"><summary>Route <span aria-hidden="true">▾</span></summary><div class="route-menu-items">${btn('Plot route','route','',true)}${btn('Auto plot','route-auto','',true)}${btn('Build route','route-build','',true)}${btn('Clear planned route','route-clear','',true)}</div></details>${btn('Current system','world',state.actual)}<label class="map-switch">UWP<input type="checkbox" role="switch" id="map-uwp" aria-label="Show UWP" ${showUwp?'checked':''}></label><label class="map-switch">Political<input type="checkbox" role="switch" id="map-territories" aria-label="Political territory" ${showTerritories?'checked':''}></label>${btn('↻','nearby').replace('<button','<button aria-label="Refresh nearby" title="Refresh nearby"')}</div><div class="map-toolbar-row"><div class="map-zoom-controls" role="group" aria-label="Map zoom">${btn('−','map-zoom-out').replace('<button','<button aria-label="Zoom out"')}${btn('+','map-zoom-in').replace('<button','<button aria-label="Zoom in"')}${btn('Reset view','map-zoom-reset')}<span class="help" aria-live="polite">${Math.round(mapZoom*100)}%</span><span class="map-level-label">${overview?(level==='subsector'?'Subsectors':'Sectors'):(showUwp&&mapZoom>=2.4?'Worlds + UWP':'Worlds')}</span></div><div class="jump-bar"><div class="row">${btn('Previous','browse-prev')}${btn('Next','browse-next')}<span class="help">Browse route</span></div></div><span id="map-zoom-hint" class="map-zoom-hint">Ctrl + scroll to zoom.</span></div></div>${routeFuelAlert(route.map(w=>w.id))}<details class="map-hint"><summary>Map controls &amp; data</summary><p>Drag to pan; click a world to browse, or choose stops during Auto plot / Build route. Ctrl + scroll to zoom. Current system returns to the ship; Reset view recenters the viewed world and resets zoom. Browsing never moves the ship. Nearby areas load as you pan. Below 20%, subsector names take priority; below 16%, sector names and A–P letters give the wider view. Political territory uses real M1105 borders; unshaded space is not a sovereignty claim. Starport, gas-giant, Naval/Scout base and travel-zone symbols display at close zoom (240–288%); the key is below World data. Missing symbols do not establish missing data. UWP labels use calculator overrides when set. Hex numbers hide below 80% and use sector-local coordinates. Route planning still loads 12 parsecs around each stop.</p></details></section>`;}
// Keep one logical map unit equal to one CSS pixel. A taller adjacent service
// changes the visible bounds, never the zoom or geographic center. The SVG stays
// absolutely positioned so its old aspect cannot feed back into the slot size.
function updateMapGeometry(){
 const viewport=document.querySelector('.map-viewport');
 if(viewport){
  const {width,height}=viewport.getBoundingClientRect();
  if(width>0&&height>0)return setMapGeometry(width,height);
 }
 const main=$('main'),style=getComputedStyle(main),available=Math.max(1,main.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight));
 const width=!mapExpanded&&window.innerWidth>=1100?Math.max(1,(available-18)*.61-2):Math.max(1,available-2);
 const height=mapExpanded?Math.max(window.innerWidth<=620?540:620,Math.min(1100,window.innerHeight*.8)):Math.max(400,Math.min(600,width*.43));
 return setMapGeometry(width,height);
}
let mapViewportElement=null,mapGeometryFrame=0;
const mapViewportObserver=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{
 if(tab==='Overview'&&viewed()&&updateMapGeometry()){scheduleMapPaint();scheduleMapAreas();}
});
function queueMapGeometry(){
 if(mapGeometryFrame)return;
 mapGeometryFrame=requestAnimationFrame(()=>{
  mapGeometryFrame=0;
  const viewport=document.querySelector('.map-viewport');
  if(viewport!==mapViewportElement){mapViewportObserver?.disconnect();mapViewportElement=viewport;if(viewport)mapViewportObserver?.observe(viewport);}
  if(tab==='Overview'&&viewport&&updateMapGeometry()){scheduleMapPaint();scheduleMapAreas();}
 });
}

function tradeLocation(){return '<div class="trade-location"><span>Trading view: <strong>'+esc(viewed()?.name)+'</strong> · Ship at '+esc(actual()?.name)+'</span>'+btn('Current system','world',state.actual)+btn('Browse map','tab','Overview')+'</div>';}
function overviewCargo(){
 const rows=state.lots.map(l=>{const p=l.audit?.price,a=p?.audit,recorded=a&&[a.skill,a.localDM,a.counterparty,a.purchase?.selected,a.sale?.selected].every(Number.isFinite),dm=recorded?a.skill+a.localDM-a.counterparty+a.purchase.selected-a.sale.selected:null;
  return '<tr><td>'+esc(good(l.commodity)?.name||l.commodity)+'</td><td class="number">'+esc(l.quantity)+'</td><td class="number">'+money(l.basis)+'</td><td class="lot-reference">'+esc(l.id)+'</td><td class="number">'+esc(a?.dice?.total??'Not recorded')+'</td><td class="number">'+esc(dm==null?'Not recorded':signedDM(dm))+'</td><td class="number">'+(a?.percent==null?'Not recorded':esc(a.percent)+'%')+'</td><td>'+esc(l.description)+'</td><td>'+btn('Audit','lot-audit',l.id,false,'small')+'</td></tr>';
 });
 return '<section class="panel overview-cargo"><div class="panel-head"><h2>Cargo hold <span class="muted">'+esc(supportDisplay(S.used(state)))+' / '+esc(state.ship.capacity)+' t</span></h2><div class="row">'+btn('Open Trade','tab','Trade',false,'small')+btn('Manage cargo','tab','Cargo',false,'small')+'</div></div>'+(rows.length?table(['Cargo','Tons','Remaining basis','Lot','Price roll','Trade DM','% retail','Description / note','Audit'],rows,'overview-cargo-scroll'):empty('No owned trade goods aboard. Freight and mail are under Contracts.'))+'</section>';
}


function tradeTable(kind,headers,widths,rows,cls=''){
 return '<div class="scroll '+cls+'"><table class="trade-table '+kind+'-table"><colgroup>'+widths.map(w=>'<col style="width:'+w+'px">').join('')+'</colgroup><thead><tr>'+headers.map((h,i)=>'<th scope="col" class="'+([1,2,3,4].includes(i)&&kind!=='freight'||kind==='freight'&&[1,3,4].includes(i)?'number':'')+'">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}
function pricingOptions(illegalGood=false){return {...R.priceLimits(state.settings),maxBaseRetailEnabled:!!state.settings.maxBaseRetailEnabled,maxBaseRetail:state.settings.maxBaseRetail,useRawIllegalPrices:!!state.settings.useRawIllegalPrices,illegalGood:!!illegalGood};}
function effectiveRetailValue(commodity,illegalGood=false){const g=good(commodity);if(!g||g.baseCreditsPerTon==null)return null;return R.effectiveBasePrice(g,pricingOptions(illegalGood)).effective;}
function retail(commodity,illegalGood=false){const value=effectiveRetailValue(commodity,illegalGood);return value==null?'Referee':money(value)+' / t';}
function currentQuote(id){const q=saleQuotes.get(id);return q&&q.worldId===state.actual&&q.revision===state.revision?q:null;}
function auditFacts(rows){return '<div class="preview"><dl>'+rows.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v??'Not recorded')+'</dd>').join('')+'</dl></div>';}
function tradeComplicationResult(a){
 return a?.tradeComplication?.version===1?a.tradeComplication.result:null;
}
function tradeComplicationLabel(a){
 const result=tradeComplicationResult(a);
 return result==='severe'?'SEVERE COMPLICATION':result==='complication'?'COMPLICATION':result==='none'?'None (no matching dice)':result==='unknown'?'Unknown · natural dice not recorded':'Not recorded for this quote';
}
function tradeComplicationFlag(a,detail=false){
 const result=tradeComplicationResult(a);
 if(!['complication','severe'].includes(result))return '';
 return '<span class="trade-complication" data-complication="'+result+'" title="House rule · GM decides the issue and consequences">'+tradeComplicationLabel(a)+'</span>'+(detail?'<p class="help">House rule · GM decides the issue and consequences. '+ruleInfo('complication')+'</p>':'');
}
function tradeCodeLabel(code){const names={Ag:'Agricultural',As:'Asteroid',Ba:'Barren',De:'Desert',Fl:'Fluid oceans',Ga:'Garden',Hi:'High population',Ht:'High technology',Ic:'Ice-capped',In:'Industrial',Lo:'Low population',Lt:'Low technology',Na:'Non-agricultural',Ni:'Non-industrial',Po:'Poor',Ri:'Rich',Va:'Vacuum',Wa:'Water world',Amber:'Amber travel zone',Red:'Red travel zone',Safe:'Safe travel zone'};return (names[code]||code)+' ('+code+')';}
const signedDM=n=>n==null?'Not recorded':(n>=0?'+':'')+n;
function tradeFootnotes(){return '<p class="help"><a href="'+ROOT+'RULES_VERIFICATION.md" target="_blank" rel="noopener">Rules verification and source evidence</a> · Saved terms and missing historical evidence are preserved.</p>';}
function priceAudit(a={},effective,commodity,snap){
 const sell=a.side==='sell',g=good(commodity),worldInfo=a.world||snap?.world;
 const groups=[['Purchase trade-code DM',a.purchase,sell?-1:1],['Sale trade-code DM',a.sale,sell?1:-1]];
 const rows=groups.map(([label,part,sign])=>{
  const matches=(part?.applicable||[]).map(x=>tradeCodeLabel(x.code)+': '+signedDM(x.value));
  if(part?.localIllegalDM!=null)matches.push('Local illegality (Law Level minus ban threshold): '+signedDM(part.localIllegalDM));
  return '<tr><td>'+label+'</td><td>'+esc(matches.join('; ')||'None recorded')+'</td><td class="number">'+esc(part?.selected??'Not recorded')+'</td><td class="number">'+esc(part?signedDM(sign*part.selected):'Not recorded')+'</td></tr>';
 });
 const known=[a.skill,a.localDM,a.counterparty,a.purchase?.selected,a.sale?.selected].every(Number.isFinite),total=known?a.skill+a.localDM-a.counterparty+(sell?a.sale.selected-a.purchase.selected:a.purchase.selected-a.sale.selected):null;
 const base=a.basePrice??g?.baseCreditsPerTon,rawBase=a.rawBasePrice??g?.baseCreditsPerTon,tablePercent=a.tablePercent??a.percent,tablePrice=base!=null&&tablePercent!=null?money(A.decimal(A.mul(base,A.div(tablePercent,100))))+' / ton':'Not recorded';
 return '<h3>'+(sell?'Sale':'Purchase')+' price calculation '+ruleInfo('trade-price')+'</h3>'+auditFacts([
 ['Pricing world',worldInfo?.world?.name],['Saved UWP',worldInfo?.uwp?.raw],['World trade codes',(worldInfo?.codes||[]).map(tradeCodeLabel).join(', ')||'None recorded'],['RAW base retail',rawBase==null?'Referee-defined':money(rawBase)+' / ton'],['Effective base retail',base==null?'Referee-defined':money(base)+' / ton'],['Retail cap',a.maxBaseRetail==null?'Off':money(a.maxBaseRetail)+' / ton'],['Cap applied',a.baseRetailCapApplied?'Yes':a.illegalRawPriceExempt?'No · illegal-goods RAW exception':'No'],['3D price roll',a.dice?.dice?.length?a.dice.dice.join(' + ')+' = '+a.dice.total:a.dice?.total!=null?'Entered total: '+a.dice.total+' (individual dice not recorded)':'Not recorded / referee-defined'],['Trade complication · house rule',tradeComplicationLabel(a)]
 ])+tradeComplicationFlag(a,true)+table(['Modifier group','Matching modifiers','Selected DM','Signed contribution'],rows)+'<p class="help">Home rule INT-024: select the greatest absolute DM in each group, retaining its sign (positive wins an equal opposing tie). '+(sell?'Selling adds the sale DM and subtracts the purchase DM.':'Buying adds the purchase DM and subtracts the sale DM.')+'</p>'+auditFacts([
 ['Trader / broker skill DM',signedDM(a.skill)],['Local broker bonus DM',signedDM(a.localDM)],['Counterparty skill DM (subtracted)',a.counterparty==null?'Not recorded':signedDM(-a.counterparty)],['Total price DM',signedDM(total)],['Modified price roll',a.modified],['Table lookup result (after table limits)',a.tableResult],['Price table percentage',tablePercent==null?'Not recorded':tablePercent+'%'],['Reduced-profit price limits',a.reducedProfitLimitsEnabled?'On · minimum buy '+a.minPurchasePercent+'% / maximum sell '+a.maxSalePercent+'%':'Off'],['Price limit applied',a.priceLimitApplied?'Yes':'No'],['Effective price percentage before fees',a.percent==null?'Not recorded':a.percent+'%'],['Base retail price',base==null?'Referee-defined':money(base)+' / ton'],['Calculated table price',tablePrice],['Effective '+(sell?'sale':'purchase')+' price',effective==null?'Not recorded':money(effective)+' / ton'],['Manual price override',a.manualPrice!=null?money(a.manualPrice)+' / ton':effective!=null&&base!=null&&a.percent!=null&&A.cmp(effective,A.mul(base,A.div(a.percent,100)))!==0?'Effective price differs from table; see recorded adjustments':'None recorded'],['Override reason',a.overrideReason||'None recorded']
 ])+((a.maxBaseRetail!=null||a.reducedProfitLimitsEnabled||a.illegalRawPriceExempt)?'<p class="help">Applied campaign price controls '+ruleInfo('profit')+'</p>':'')+(a.rounding?roundingFootnote([{label:'Price per ton',before:a.rounding.before,after:a.rounding.after}],a.rounding.creditStep):'')+(snap?.search?.localSkillDice?'<h3>Local broker skill roll '+ruleInfo('broker')+'</h3>'+auditFacts([['Broker 2D roll',(snap.search.localSkillDice.dice||[]).join(' + ')+' = '+snap.search.localSkillDice.total],['Applied broker skill',a.skill]]):'');
}
function availabilityAudit(offer,commodity){const a=offer.audit||{},g=good(commodity),codes=a.world?.codes||[];return '<h3>Availability and quantity '+ruleInfo('commodity')+'</h3><p class="help">'+esc(g?.common?'Common stock':((g?.availabilityAny||[]).filter(c=>codes.includes(c)).map(tradeCodeLabel).join(', ')||'Random goods or referee entry'))+'. Additional random draws for this commodity: '+(a.randomDraws||[]).filter(id=>id===commodity).length+'.</p>'+((a.quantityRolls||[]).length?table(['Quantity dice','Population DM','Tonnage multiplier','Tons added'],a.quantityRolls.map(q=>'<tr><td>'+esc(q.dice.join(' + ')+' = '+q.dice.reduce((x,y)=>x+y,0))+'</td><td class="number">'+esc(signedDM(q.populationDM))+'</td><td class="number">× '+esc(q.multiplier)+'</td><td class="number">'+esc(q.tons)+' t</td></tr>')):'<p class="help">No generated quantity rolls recorded.</p>');}
function offerAdjustments(offer){return '<h3>Recorded adjustments '+ruleInfo('rounding')+'</h3>'+((offer.overrides||[]).length?offer.overrides.map(o=>auditFacts([['When',displayDate(state.dateLabel,o.hours)],['Reason',o.reason],['Price before',o.before?.unitPrice==null?'Not recorded':money(o.before.unitPrice)+' / ton'],['Entered price after',o.after?.unitPrice==null?'Not recorded':money(o.after.unitPrice)+' / ton'],['Quantity before',o.before?.remaining==null?'Not recorded':o.before.remaining+' t'],['Quantity after',o.after?.remaining==null?'Not recorded':o.after.remaining+' t']])).join(''):'<p class="help">No offer adjustments recorded.</p>')+(offer.previousAudits||[]).map((a,i)=>'<details><summary>Earlier price calculation '+(i+1)+'</summary>'+priceAudit(a,null,offer.commodity)+'</details>').join('');}

function lotAudit(id){
 const lot=state.lots.find(l=>l.id===id);if(!lot)throw Error('Cargo lot no longer aboard');
 const offer=lot.audit?.price,snap=state.snapshots.find(s=>s.id===lot.snapshotId),quote=currentQuote(id),sales=state.ledger.filter(e=>e.type==='Sale'&&e.lotId===id&&e.audit);
 const corrections=state.events.filter(e=>e.before?.id===id&&e.after);
 modal('Cargo audit · '+lot.description,auditFacts([['Commodity',good(lot.commodity)?.name],['Lot description',lot.description],['Tons held',lot.quantity+' t'],['Remaining cost basis',money(lot.basis)],['Remaining goods purchase value',money(lot.goodsValue)],['Acquisition world',world(lot.world)?.name],['Acquisition date',lot.hours==null?'Not recorded':displayDate(state.dateLabel,lot.hours)],['Acquisition broker fee',lot.audit?.fee==null?'Not recorded':money(lot.audit.fee)],['Acquisition insurance premium',lot.audit?.premium==null?'Not recorded':money(lot.audit.premium)]])+(offer?priceAudit(offer.audit,offer.unitPrice,lot.commodity,snap)+availabilityAudit(offer,lot.commodity)+offerAdjustments(offer):'<p class="help">This lot has no saved generated purchase calculation. It may be opening or referee-added cargo; no dice or modifiers are inferred from its cost basis.</p>')+'<h3>Current sale quote</h3>'+(quote?priceAudit(quote.audit,quote.unitPrice,lot.commodity,state.snapshots.find(s=>s.id===quote.buyerId)):'<p class="help">No current negotiated sale quote. Use Sell to negotiate.</p>')+sales.map(e=>'<details><summary>Recorded sale · '+esc(displayDate(state.dateLabel,e.hours))+'</summary>'+priceAudit(e.audit.audit,e.audit.unitPrice,lot.commodity)+auditFacts([['Tons sold',e.audit.quantity+' t'],['Gross proceeds',money(e.audit.gross)],['Allocated cost basis',money(e.audit.basis)],['Selling fee',money(e.audit.fee)],['Tax',money(e.audit.tax)],['RAW profit',money(e.audit.raw)],['Adjusted profit',money(e.audit.adjusted)]])+'</details>').join('')+corrections.map(e=>'<h3>Cargo correction '+ruleInfo('rounding')+'</h3>'+auditFacts([['Reason',e.reason],['Previous description',e.before.description],['New description',e.after.description],['Previous quantity',e.before.quantity+' t'],['New quantity',e.after.quantity+' t'],['Previous basis',money(e.before.basis)],['New basis',money(e.after.basis)]])).join('')+tradeFootnotes(),null);
}

function marketAvailabilityRecord(c,options,offers){
 const defaults=core.commodities.filter(g=>!g.refereeDefined&&(g.common||((options.illegal?g.universallyIllegal:!g.universallyIllegal)&&g.availabilityAny.some(code=>c.codes.includes(code))))).map(g=>({id:g.id,name:g.name,reason:g.common?'Common goods: available on all worlds':g.availabilityAny.filter(code=>c.codes.includes(code)).map(tradeCodeLabel).join(', ')}));
 const draws=offers.find(o=>Array.isArray(o.audit?.randomDraws))?.audit.randomDraws;
 return {defaults,population:c.uwp.population,uwp:c.uwp.raw,codes:[...c.codes],draws:draws??null};
}
function marketAvailabilityAudit(id){
 const snap=state.snapshots.find(s=>s.id===id);if(!snap?.offers?.length)throw Error('No generated goods for this search.');
 const a=snap.availability||marketAvailabilityRecord(snap.world,snap.options||{illegal:snap.criminal},snap.offers),seen=new Set(a.defaults.map(g=>g.id));
 let newTypes=0,duplicates=0;
 const draws=(a.draws||[]).map((id,i)=>{const g=good(id),duplicate=seen.has(id);if(duplicate)duplicates++;else newTypes++;seen.add(id);return '<tr><td>'+ (i+1)+'</td><td>'+esc(id)+'</td><td>'+esc(g?.name||id)+'</td><td>'+esc(g?.refereeDefined?'Referee-defined goods; quantity required':duplicate?'Repeat commodity: adds another quantity roll':'Additional commodity type')+'</td></tr>';});
 let body='<p>Recorded supplier search: <strong>'+esc(snap.partyName)+'</strong> · '+esc(snap.world.world?.name||'')+' · hour '+esc(snap.hours)+'. This audit does not reroll goods.</p>';
 body+=contactSearchDetails(snap.search);
 if(!snap.availability)body+='<p class="help">Older snapshot: default eligibility is reconstructed from its saved world and the current commodity definitions. Random draws and quantity rolls below are the saved results.</p>';
 body+=auditFacts([['Market',snap.criminal?'Black market (includes common legal goods by campaign agreement)':'Legal market'],['UWP at search',a.uwp],['Trade codes at search',a.codes.map(tradeCodeLabel).join(', ')||'None'],['Default commodity types',a.defaults.length],['Additional rolls required',a.population+' (one per population code point)'],['Additional rolls recorded',a.draws?.length??'Not recorded'],['New types from random draws',a.draws?newTypes:'Not recorded'],['Repeated commodity draws',a.draws?duplicates:'Not recorded'],['Total distinct offered types',snap.offers.length]]);
 body+='<h3>Default goods and why they qualify '+ruleInfo('commodity')+'</h3>'+table(['Commodity','Availability reason'],a.defaults.map(g=>'<tr><td>'+esc(g.name)+'</td><td>'+esc(g.reason)+'</td></tr>'));
 body+='<h3>Additional random goods</h3><p><strong>Population code '+esc(a.uwp?.[4]??'?')+' = '+esc(a.population)+' additional goods rolls.</strong> The number of rolls comes from the world’s UWP population code; it is not rolled randomly. Each roll selects a commodity, so duplicates may mean fewer new commodity types.</p><p class="help">'+(snap.criminal?'Black-market draws use the illegal-goods row (6 plus a D6).':'Legal-market draws use D66; illegal results 61–65 are rerolled. Rejected rolls were not stored.')+' Duplicate results add stock to the same commodity. Exotics need referee-entered terms.</p>'+(a.draws?draws.length?table(['Draw','Result','Commodity','Effect'],draws):'<p>No additional rolls: population code is zero.</p>':'<p>Random draws were not recorded for this snapshot.</p>');
 body+='<h3>Generated quantities</h3><p class="help">These are the original generation rolls, before purchases, expiry or manual adjustments. Each repeat receives its own quantity roll; negative modified rolls contribute zero tons.</p>'+snap.offers.map(o=>'<h4>'+esc(good(o.commodity)?.name||o.commodity)+'</h4>'+availabilityAudit(o,o.commodity)).join('');
 modal('Market availability audit',body+tradeFootnotes(),null);
}

function marketPanel(){if(viewed()?.emptySpace)return panel('Empty space',empty('No world, starport or market here. Continue your route to trade.'));const id=viewed()?.id;const snapshots=state.snapshots.filter(s=>s.worldId===id&&s.kind!=='buyer');let snap=snapshots.find(s=>s.id===snapshotId)||snapshots.at(-1);const offers=(snap?.offers||[]).filter(o=>(marketFilter==='all'||marketFilter==='expired'&&o.expired||marketFilter==='active'&&!o.expired||marketFilter==='illegal'&&o.illegal)&&(good(o.commodity)?.name+' '+o.description).toLowerCase().includes(marketSearch.toLowerCase()));const rows=offers.map(o=>`<tr class="${o.expired?'expired-row':''}"><td>${esc(good(o.commodity)?.name)}${o.description&&o.description!==good(o.commodity)?.name?'<div class="help">'+esc(o.description)+'</div>':''}${o.illegal?'<span class="tag illegal">Illegal</span>':''}${o.manualRequired?'<span class="tag">Referee</span>':''}${tradeComplicationFlag(o.audit)}</td><td class="number">${esc(o.remaining)} t</td><td class="number">${retail(o.commodity,o.illegal)}</td><td class="number">${o.audit?.percent==null?'—':esc(o.audit.percent)+'%'}</td><td class="number">${money(o.unitPrice)} / t</td><td><span class="offer-status">${o.expired?'Expired':'Active'}</span><label class="check"><input type="checkbox" data-expire="${o.id}" ${o.expired?'checked':''} ${!store.editable?'disabled':''}>Expired</label></td><td class="table-actions">${btn('Buy','buy',o.id,true,'small').replace('<button', '<button '+(o.expired||o.manualRequired?'data-unavailable disabled':''))}${btn('Audit','offer-audit',o.id,false,'small')}${btn('Edit','offer-edit',o.id,true,'small')}</td></tr>`);return panel('Market · '+esc(viewed()?.name||''),`<div class="panel-body"><div class="toolbar">${snapshots.length?`<select id="snapshot-select" aria-label="Market search history">${snapshots.map(s=>`<option value="${s.id}" ${s.id===snap?.id?'selected':''}>${esc(s.partyName)} · hour ${esc(s.hours)} · ${s.criminal?'Black market':'Legal market'}</option>`).join('')}</select>`:''}${btn('Find supplier','search','',true,'primary')}${btn('Find buyer','buyer-search','',true,'primary')}${snap?.offers.length?btn('Availability audit','market-availability',snap.id,false,'primary'):btn('Availability audit','market-availability').replace('<button','<button disabled')}</div><div class="toolbar"><input id="market-search" aria-label="Search market" placeholder="Find a commodity…" value="${esc(marketSearch)}"><select id="market-filter" aria-label="Filter offers">${[['active','Active'],['all','All'],['expired','Expired'],['illegal','Illegal']].map(([v,l])=>`<option value="${v}" ${marketFilter===v?'selected':''}>${l}</option>`).join('')}</select><span class="help">${offers.length} / ${snap?.offers.length||0} offers</span></div></div>${rows.length?tradeTable('purchase',['Commodity','Available','Retail','Price %','Purchase Price','Offer Status','Actions'],[230,95,140,85,145,125,190],rows):empty('No matching offers. Find a supplier at your actual world to create a market.')}<div class="panel-body row">${snap?btn('Expire all','expire-all',snap.id,true,'small'):''}${snap?btn('Reject supplier’s deal','reject',snap.id,true,'small'):''}<span class="help">Offers stay active until explicitly expired or rejected.</span></div>`);}
function cargoPanel(full){
 let lots=state.lots.filter(l=>(l.description+' '+good(l.commodity)?.name).toLowerCase().includes(cargoSearch.toLowerCase()));
 lots.sort((a,b)=>cargoSort==='quantity'?-A.cmp(a.quantity,b.quantity):a.description.localeCompare(b.description));
 const rows=lots.map(l=>{const q=currentQuote(l.id);return `<tr><td><label class="check"><input type="checkbox" aria-label="Select ${esc(l.description)}" data-lot="${l.id}" ${selected.has(l.id)?'checked':''}>${esc(good(l.commodity)?.name)}</label>${l.illegal?'<span class="tag illegal">Illegal</span>':''}</td><td class="number">${esc(l.quantity)} t</td><td class="number">${retail(l.commodity,l.illegal)}</td><td class="number">${q?.audit.percent==null?'—':esc(q.audit.percent)+'%'}</td><td class="number">${q?money(q.unitPrice)+' / t':'<span class="help">Not negotiated</span>'}${tradeComplicationFlag(q?.audit)}</td><td>${esc(l.description)}<div class="help">Lot ${esc(l.id)}<br>Cost basis: ${money(l.basis)}</div></td><td class="table-actions">${btn('Sell','lot-sell',l.id,true,'small')}${btn('Audit','lot-audit',l.id,false,'small')}${btn('Edit','lot-correct',l.id,true,'small')}${state.settings.insurance?btn('Insure cargo','lot-insure',l.id,true,'small'):''}</td></tr>`;});
 return panel(full?'Owned trade goods':'Owned trade goods aboard',`<div class="panel-body toolbar"><input id="cargo-search" aria-label="Search cargo" placeholder="Search cargo lots…" value="${esc(cargoSearch)}"><select id="cargo-sort" aria-label="Sort cargo"><option value="name">Name</option><option value="quantity" ${cargoSort==='quantity'?'selected':''}>Quantity</option></select><span class="help">${lots.length} / ${state.lots.length} lots</span></div>${rows.length?tradeTable('cargo',['Commodity','Tons Held','Retail','Price %','Sale Price','Lot / Description','Actions'],[210,100,140,85,230,230,190],rows,full?'large-scroll':'cargo-scroll'):empty(state.lots.length?'No owned trade goods match this search.':'No owned trade goods aboard. Accepted freight/mail is listed under Contracts; passenger luggage is reserved separately.')}<div class="selected-preview row"><span>${selected.size} selected</span>${btn('Select all cargo','sale-all','',true)}${btn('Clear selection','sale-clear','',true)}${btn('Get sale offers','sale','',true,'primary')}${btn('Add existing / referee cargo','add-lot','',true)}${!full?btn('View all '+state.lots.length+' lots','tab','Cargo'):''}</div><div class="panel-body help">${holdBreakdown().map(([label,tons])=>esc(label)+': '+esc(tons)+' t').join(' · ')} · Available hold space: ${supportDisplay(A.sub(state.ship.capacity,S.used(state)))} t. Edit passengers in Ship, trader & options.<br>Sale prices appear after negotiation at the actual world. Quotes are previews for this session and become stale after campaign changes; reopening the same buyer’s offer keeps its price until the campaign changes.</div>`);
}
function policyPanel(){const policies=state.policies.filter(p=>p.status!=='closed');if(!policies.length)return '';return panel('Cargo insurance',policies.length?policies.map(p=>`<article class="contract-card"><div class="row"><h3>${esc(state.lots.find(l=>l.id===p.lotId)?.description||'Former cargo lot')}</h3><span class="tag">${esc(p.status)}</span></div><p>${esc(p.coverage)}% coverage · ${esc(p.remainingQuantity)} t remaining · destination ${esc(world(p.destination)?.name)} · premium ${money(p.premium)}</p><div class="row">${btn('Policy audit','policy-audit',p.id)}${btn('Loss / claim','claim',p.id,true)}${btn('Amend / close','amend',p.id,true)}</div></article>`).join(''):empty('Insurance is optional. Select Insurance in the purchase window to choose coverage and see the projected premium.'));}
function closedPolicyHistory(){
 const policies=state.policies.filter(p=>p.status==='closed');if(!policies.length)return '';
 return panel('Closed cargo insurance', '<div class="panel-body"><p class="help">Completed policies are retained for reference. Turning insurance off does not remove these records.</p></div>'+table(['Cargo / policy','Coverage','Destination','Premium','Actions'],policies.map(p=>'<tr><td>'+esc(state.lots.find(l=>l.id===p.lotId)?.description||'Former cargo lot')+'</td><td>'+esc(p.coverage)+'%</td><td>'+esc(world(p.destination)?.name||'Not recorded')+'</td><td class="number">'+money(p.premium)+'</td><td>'+btn('Policy audit','policy-audit',p.id,false,'small')+'</td></tr>')));
}
function mailSettingsSummary(){
 return '<p class="help">From Settings: armed ship '+(state.ship.armed?'Yes (+2)':'No (+0)')+' · highest Naval / Scout rank '+esc(state.trader.rank)+' · highest SOC DM '+esc(signedDM(state.trader.soc))+'. '+btn('Edit mail settings','settings-edit','',true,'small')+'</p>';
}
function mailRollSummary(a={}){
 a=a||{};
 if(a.manual)return '<div class="mail-roll-summary help"><p><strong>Availability roll:</strong> Not recorded (referee-entered terms).</p></div>';
 const recorded=value=>typeof value==='number'&&Number.isFinite(value);
 const modifiers=['freight','armed','lowTech','rank','soc'];
 const dm=recorded(a.modifierTotal)?a.modifierTotal:modifiers.every(key=>recorded(a.modifiers?.[key]))?modifiers.reduce((sum,key)=>sum+a.modifiers[key],0):null;
 const roll=(r,label)=>!recorded(r?.total)?'Not recorded':r.manual?'manual '+label+' total '+r.total:Array.isArray(r.dice)&&r.dice.length===(label==='2D'?2:1)&&r.dice.every(n=>Number.isInteger(n)&&n>=1&&n<=6)?label+' '+r.dice.join(' + ')+' = '+r.total:label+' total '+r.total+' (individual dice not recorded)';
 let text=roll(a.dice,'2D');
 if(recorded(a.dice?.total)&&recorded(dm)&&recorded(a.total))text+='; '+a.dice.total+(dm<0?' - ':' + ')+Math.abs(dm)+' DM = '+a.total+' (12+ required)';
 else text+='; total DM '+(recorded(dm)?signedDM(dm):'not recorded')+'; final result '+(recorded(a.total)?a.total:'not recorded')+' (12+ required)';
 return '<div class="mail-roll-summary help"><p><strong>Availability roll:</strong> '+esc(text)+'</p>'+(recorded(a.count?.total)?'<p><strong>Container roll:</strong> '+esc(roll(a.count,'1D'))+'</p>':'')+'</div>';
}
function mailCalculationDetails(record){
 const a=record.audit||{};
 return mailRollSummary(a)+contractRolls({kind:'mail',audit:a})+'<p class="help">Low-tech penalty uses the origin only (INT-002). All containers must be accepted together. Each is 5 tons and pays Cr 25,000 only on delivery. Mail has no automatic deadline or late penalty. This audit uses the recorded check, not current Settings or world values.</p>'+contractRules();
}
function syncMailCheck(){
 const saved=latestMailCheck(state);
 const offer=saved?.offers.find(c=>c.kind==='mail');
 // Only this session's latest draft can be actionable. Saved audits are display
 // records, including after reload, import, cross-tab replacement and Undo.
 contractDrafts=contractDrafts.filter(c=>c.kind!=='mail'||c.offerId===offer?.offerId);
 if(!saved){mailCheck=null;return;}
 if(mailCheck?.checkId!==saved.id)mailCheck={checkId:saved.id,historical:true,available:!!offer,origin:saved.world,destination:saved.destination,offerId:offer?.offerId,quantity:offer?.quantity,payment:offer?.payment,audit:structuredClone(saved.mailAudit),searchDice:saved.searchDice,searchSkill:saved.searchSkill,searchCharacteristic:saved.searchCharacteristic};
}
function mailCheckStatusText(event){
 const status=mailCheckHistoryStatus(state,event.id);
 return status.status==='latest'?'Latest mail check':status.status==='superseded'?'Superseded mail check':'Historical mail check';
}
function mailCheckReferenceDetails(event){
 const status=mailCheckHistoryStatus(state,event.id);
 return '<h3>Mail check reference</h3>'+auditFacts([['Status',mailCheckStatusText(event)],['Check reference',event.id],['Replaces check',event.supersedesMailCheckId||'None recorded'],['Replaced by check',status.supersededById||'None']])+'<p class="help">Saved checks are read-only. New checks replace the displayed result; original dice and inputs remain in History. Accepted consignments keep their own contracts.</p>';
}
function cancelledMailHistory(){
 const cancelled=state.contracts.filter(c=>c.kind==='mail'&&c.status==='cancelled');
 if(!cancelled.length)return '';
 const rows=cancelled.map(c=>'<tr><td>'+esc(c.description||'Mail containers')+'<div class="help">'+esc(c.id)+'</div></td><td>'+esc(world(c.origin)?.name||c.origin)+' → '+esc(world(c.destination)?.name||c.destination)+'</td><td>'+esc(c.quantity)+' t</td><td>'+esc(displayDate(state.dateLabel,c.cancelledHours))+'</td><td>'+btn('Audit/View','contract-audit',c.id,false,'small')+'</td></tr>');
 return '<div id="cancelled-mail-history">'+panel('Cancelled mail archive','<div class="panel-body help">Cancelled consignments are kept here for audit. They reserve no cargo space and have no payment or penalty.</div>'+table(['Consignment','Route','Tons released','Cancelled at','Audit'],rows))+'</div>';
}

function mailAudit(){syncMailCheck();if(!mailCheck)throw Error('No mail check in this session.');modal('Mail roll audit','<div class="mail-audit">'+mailCalculationDetails(mailCheck)+'</div>',null);}
function mailCancellationControl(c){
 if(c.kind!=='mail'||c.status!=='accepted')return '';
 const eligibility=S.mailCancellationEligibility(state,c.id);
 return '<button class="small" data-action="mail-cancel" data-arg="'+esc(c.id)+'" data-mutate '+(eligibility.allowed?'':'data-unavailable disabled')+'>Cancel mail</button><p class="help">'+esc(eligibility.allowed?'Before the first committed jump only. Cancels this whole consignment with no income or penalty.':eligibility.reason)+'</p>';
}
function mailPanel(){
 syncMailCheck();
 let body=mailSettingsSummary(),summary='Not checked this session';
 if(!mailCheck)body+='<p>No mail check in this session.</p><p class="help">Check at the ship’s actual world. Unaccepted offers are session-only; previous checks remain read-only in History.</p>';
 else{
  const draft=mailCheck.offerId&&contractDrafts.find(c=>c.offerId===mailCheck.offerId),accepted=mailCheck.offerId&&state.contracts.find(c=>c.offerId===mailCheck.offerId),offer=draft||accepted,quantity=offer?.quantity||mailCheck.quantity,payment=offer?.payment||mailCheck.payment;
  const free=supportDisplay(A.sub(state.ship.capacity,S.used(state))),fits=quantity!=null&&A.cmp(quantity,A.sub(state.ship.capacity,S.used(state)))<=0;
  const status=!mailCheck.available?'No mail available':accepted?.status==='cancelled'?'Mail cancelled':accepted?.status==='delivered'?'Mail delivered':accepted?'Mail accepted':draft?'Mail available':'Previous mail result';
  summary=status;
  if(mailCheck.available){
   if(accepted?.status==='cancelled')summary+=' · '+quantity+' t released · No payment';
   else if(accepted?.status==='delivered')summary+=' · '+quantity+' t delivered · '+money(accepted.payout??payment)+' paid';
   else if(accepted||draft){
    summary+=' · '+quantity+' t'+(accepted?' reserved':'')+' · '+money(payment)+' on delivery';
    if(draft&&!fits)summary+=' · Does not fit';
    else if(draft&&state.actual!==draft.origin)summary+=' · Return to origin to accept';
   }else summary+=' · Offer no longer active';
  }
  if(accepted)body='';
  body+='<div class="mail-result"><h3>'+status+'</h3><p>'+esc(world(mailCheck.origin)?.name||'Origin')+' → '+esc(world(mailCheck.destination)?.name||'Destination')+'</p>'+mailRollSummary(mailCheck.audit)+btn('Audit','mail-audit','',false,'small');
  if(mailCheck.available){
   if(accepted)body+='<details id="mail-accepted-details" class="mail-accepted-details" '+(mailAcceptedDetailsOpen?'open':'')+'><summary>'+esc(accepted.status==='cancelled'?'Cancelled mail details · '+quantity+' t released':accepted.status==='delivered'?'Delivered mail details · '+money(accepted.payout??payment)+' paid':'Accepted mail details · '+quantity+' t reserved')+'</summary>'+mailSettingsSummary();
   body+=auditFacts([['Containers rolled',mailCheck.audit.count?.total??'Not recorded'],['Total tons',quantity+' t'],[accepted?.status==='cancelled'?'Original agreed payment': 'Payment on delivery',money(payment)],['Hold capacity',accepted?.status==='cancelled'?'Released after cancellation':accepted?.status==='delivered'?'Released after delivery':accepted?quantity+' t reserved':(fits?'Fits':'Does not fit')+' · '+free+' t free']]);
   if(draft){
    const canAccept=fits&&state.actual===draft.origin;
    body+='<div class="toolbar"><button data-action="contract-accept" data-arg="'+esc(draft.offerId)+'" data-mutate '+(canAccept?'':'data-unavailable disabled')+'>Accept whole mail consignment</button>'+btn('Edit / referee override','draft-edit',draft.offerId,true,'small')+'</div>';
    if(!canAccept)body+='<p class="help">'+(!fits?'The whole consignment must fit; partial acceptance is not available.':'Return to the origin world before accepting.')+'</p>';
   }else if(accepted?.status==='accepted')body+='<p class="help">'+(state.actual===accepted.destination?'At destination. Use Deliver on the contract below to receive payment.':'Deliver explicitly at the destination to receive payment.')+'</p>'+mailCancellationControl(accepted);
   else if(accepted?.status==='cancelled')body+='<p class="help">No income or penalty. Undo restores this whole consignment. Use Check for mail for a new offer.</p>';
   else if(!accepted)body+='<p class="help">This offer is no longer active. Check again for a new offer.</p>';
   if(offer?.overrides?.length)body+='<p class="help">Referee-edited terms shown above; original container roll and changes are retained in Audit/View.</p>';
   if(accepted)body+='</details>';
  }else body+='<p>Availability result '+esc(mailCheck.audit.total)+'; 12+ required. No containers or payment offered.</p>';
  body+='</div><details><summary>How was this calculated?</summary>'+mailCalculationDetails(mailCheck)+'</details>';
 }
 return '<details id="mail-card" class="mail-card" aria-label="Mail" '+(mailPanelOpen?'open':'')+'><summary class="panel-head mail-card-summary"><span class="mail-card-chevron" aria-hidden="true">▸</span><strong>Mail</strong><span class="mail-card-status" role="status">'+esc(summary)+'</span></summary><div class="panel-body">'+body+'</div></details>';
}
function contractsPanel(){
 const visibleContracts=state.contracts.filter(c=>c.kind!=='passenger'&&!(c.kind==='mail'&&c.status==='cancelled'));
 const contractTable=(items,draft=false)=>tradeTable('freight',['Freight Lot / Description','Tons','Destination','Rate / ton','Total Revenue','Due / Delivery Date','Status','Actions'],[225,90,170,145,145,195,170,230],items.map(c=>{
  const id=draft?c.offerId:c.id;let rate;try{rate=money(A.decimal(A.div(c.payment,c.quantity)))+' / t';}catch{const r=A.auditNumber(A.div(c.payment,c.quantity));rate='Cr '+r.numerator+' / '+r.denominator+' per t';}
  const due=c.dueHours==null?'No due date':'Due: '+displayDate(state.dateLabel,c.dueHours),date=c.status==='cancelled'?'Cancelled: '+displayDate(state.dateLabel,c.cancelledHours):c.deliveredHours==null?due:due+'<br>Delivered: '+displayDate(state.dateLabel,c.deliveredHours);
  return `<tr><td>${esc(c.description||c.type||c.kind)}<div class="help">${esc(c.kind==='mail'?'Mail contract':'Freight contract')} · ${esc(id)}</div>${c.kind==='mail'?mailRollSummary(c.audit):''}</td><td class="number">${esc(c.quantity)} t</td><td>${esc(world(c.destination)?.name||c.destination)}</td><td class="number">${rate}</td><td class="number">${money(c.payment)}</td><td>${date}</td><td>${draft?'Available · unpaid':c.status==='cancelled'?'Cancelled · no payment or penalty':c.status==='delivered'?'Delivered · paid '+money(c.payout):'Accepted · unpaid'}</td><td class="table-actions">${draft?btn('Accept','contract-accept',id,true,'small'):c.status==='accepted'?btn('Deliver','deliver',id,true,'small'):''}${btn('Audit/View',draft?'draft-audit':'contract-audit',id,false,'small')}${draft?btn('Edit','draft-edit',id,true,'small'):mailCancellationControl(c)}</td></tr>`;
 }));
 return passengers.panel()+panel('Freight & mail',`<div id="contract-actions" class="panel-body toolbar">${btn('Find contracts','contracts-search','',true,'primary')}${btn('Manual contract','contract-manual','',true,'primary')}${btn('Check for mail','mail-check','',true,'primary')}</div><p class="panel-body help">Freight and mail are transport contracts, separate from owned speculative cargo. Revenue is paid only on committed delivery. Edit available offers before acceptance; accepted terms remain auditable.</p>${mailPanel()}${visibleContracts.length?contractTable(visibleContracts):empty('No accepted or delivered contracts.')}<p class="panel-body help">Cancelled mail and older checks remain available in History.</p>`)+panel('Available contracts',contractDrafts.length?contractTable(contractDrafts,true):empty('Find contracts to generate offers.'))+policyPanel();
}
function editDraft(id){
 const c=contractDrafts.find(c=>c.offerId===id);if(!c)throw Error('Offer no longer available');
 modal('Edit contract offer',field('description','Freight lot / description',c.description||c.type||c.kind)+field('quantity','Tons',c.quantity,'text','','tons')+field('payment','Total revenue · Cr',c.payment,'text','','credits')+field('due','Due at elapsed campaign hour (blank for none)',c.dueHours??'')+field('reason','Required reason',''),f=>{
  if(state.revision!==modalRevision)throw Error('Campaign changed. Reopen this offer.');
  const reason=f.get('reason').trim(),quantity=A.positive(f.get('quantity')),payment=String(A.credit(f.get('payment'))),dueHours=f.get('due').trim()===''?null:Number(f.get('due'));
  if(!reason||A.cmp(payment,0)<0||dueHours!==null&&(!Number.isSafeInteger(dueHours)||dueHours<0))throw Error('Valid terms and reason required');
  const after={description:f.get('description'),quantity,payment,dueHours};
  const edited={...c,...after,overrides:[...(c.overrides||[]),{hours:state.hours,reason,before:{description:c.description||'',quantity:c.quantity,payment:c.payment,dueHours:c.dueHours},after}]};
  act('Contract offer edited',s=>s.events.push({id:S.uid(),label:'Contract offer edit',hours:s.hours,offer:structuredClone(edited)}));
  contractDrafts=contractDrafts.map(x=>x.offerId===id?edited:x);render();
 });
}

function bankLedger(){
 const amounts=state.ledger.map(l=>A.credit(l.amount)),net=amounts.reduce((n,a)=>n+a,0n),carry=A.credit(state.bank)-net;
 let balance=carry,expense=0n,deposit=0n;
 // A 100% late-freight penalty still needs an accessible delivery audit.
 const entries=state.ledger.filter(l=>A.credit(l.amount)!==0n||l.type==='Freight delivery');
 const rows=entries.map(l=>{
  const amount=A.credit(l.amount);balance+=amount;if(amount<0n)expense-=amount;else deposit+=amount;
  const lot=state.lots.find(x=>x.id===l.lotId),contract=state.contracts.find(x=>x.id===l.contractId);
  const note=l.reason||l.expense?.notes||l.expense?.reason||l.purchase?.description||lot?.description||contract?.description||(l.type==='Opening bank'?'Starting campaign funds':l.expense?.label|| (l.audit?.commodity?good(l.audit.commodity)?.name:'')||'—');
  return '<tr><td>'+esc(l.hours==null?'—':recordedPaymentDate(state,l))+'</td><td>'+esc(world(l.world)?.name||'Campaign')+'</td><td><div class="ledger-entry">'+btn('Details',l.historicalJump||l.eventId?'event-audit':'ledger-audit',l.eventId||l.id,false,'small')+'<span class="ledger-entry-label">'+esc(l.type)+'</span></div></td><td class="number bad">'+(amount<0n?money(-amount):'—')+'</td><td class="number good">'+(amount>0n?money(amount):'—')+'</td><td class="number"><strong>'+(l.historicalJump?'—':money(balance))+'</strong></td><td>'+esc(note)+'</td></tr>';
 }).reverse();
 return '<div class="panel-body">'+auditFacts([['Total expenses',money(expense)],['Total deposits (including opening funds)',money(deposit)],['Current balance',money(state.bank)]])+'<p class="help">Newest entries first. Balance shows funds after each transaction. All amounts are Credits. Undo removes the reversed payment from this ledger; the action log retains its history.</p>'+(carry!==0n?'<p class="notice">Balance carried before listed transactions: '+money(carry)+'. This reconciles the saved bank with the available ledger records.</p>':'')+'</div>'+ (rows.length?table(['Date/Time','Planet','Entry','Expenses','Deposit','Total Balance','Note'],rows,'large-scroll bank-ledger'):empty('No payments recorded yet.'));
}
function accountsPanel(){return panel('Bank & ledger',`<div class="panel-body toolbar">${btn('Ship expenses','ship-expenses','',true)}${btn('Record expense','expense','',true)}${btn('Record deposit','deposit','',true)}${btn('Referee bank correction','bank-correct','',true)}${btn('Export report (TXT)','report')}${btn('Save campaign (JSON)','export')}</div>${bankLedger()}`);}
function historyCategory(e){
 const label=e.label||'';
 if(/^Undo:/i.test(label))return 'Undo';
 if(e.worldChangeAudit||e.worldChangeEventId||label==='World override')return 'World Changes';
 if(/^Jump(?::| audit| roll)/i.test(label))return 'Jumps';
 if(/search|^Mail check/i.test(label))return 'Searches';
 if(/expense|^Paid |^Refilled life support|berthing rate/i.test(label))return 'Expenses';
 if(/^Passenger (acceptance|delivery)/i.test(label))return 'Trade';
 if(/purchase|sale|cargo|insurance|contract|^Accepted |^Delivered |^Cancelled mail|^Mail cancellation|^Mail acceptance|market override|^Rejected |offer/i.test(label))return 'Trade';
 if(/settings|setup|world override|time correction|time advanced|ship location|round|route/i.test(label))return 'Settings';
 return 'Other';
}
function historyPanel(){
 const filters=['All','Jumps','Searches','Trade','Expenses','World Changes','Settings','Undo','Other'];
 // A jump records its detailed audit immediately before the transition summary.
 // Keep stored events intact for history exports and undo.
 const visible=state.events.filter((e,i)=>{const audit=state.events[i-1];return !(e.label?.startsWith('Jump: ')&&audit?.label==='Jump audit'&&audit.hours===e.hours&&audit.to===e.world)&&!(e.worldChangeEventId&&e.worldChangeEventId===audit?.id&&isWorldChangeAudit(audit));});
 const events=[...visible].reverse().filter(e=>historyFilter==='All'||historyCategory(e)===historyFilter);
 const controls='<div class="panel-body"><div class="toolbar" role="group" aria-label="Filter history">'+filters.map(label=>btn(label+' ('+(label==='All'?visible.length:visible.filter(e=>historyCategory(e)===label).length)+')','history-filter',label,false,historyFilter===label?'primary active':'').replace('<button','<button aria-pressed="'+(historyFilter===label)+'"')).join('')+'</div><p class="help" role="status">'+events.length+' / '+visible.length+' entries shown. Filters only change this view. Undo always reverses the latest campaign change, regardless of the filter.</p></div>';
 const rows=events.map(e=>{
  const route=e.from&&e.to?(world(e.from)?.name||e.from)+' → '+(world(e.to)?.name||e.to):'';
  const changes=worldChangeFields(e).map(c=>c.label+': '+worldFieldValue(c.key,c.before)+' → '+worldFieldValue(c.key,c.after)).join('; ');
  const note=[changes,route,e.reason].filter(Boolean).join(' · ')||'—';
  return '<tr><td>'+esc(e.hours==null?'—':displayDate(state.dateLabel,e.hours))+'</td><td>'+esc(e.worldChangeAudit?.worldName||(e.label==='World override'?'Target not recorded':world(e.to||e.world)?.name||'Campaign'))+'</td><td>'+esc(e.label)+(e.mailAudit?'<div class="help">'+mailCheckStatusText(e)+'</div>':'')+'</td><td>'+esc(note)+'</td><td>'+btn('Details','event-audit',e.id,false,'small')+'</td></tr>';
 });
 return panel('Campaign history','<div class="panel-body row">'+btn('Undo latest change','undo','',true,'primary').replace('<button','<button aria-describedby="history-undo-help" '+(!state.undo.length?'data-unavailable disabled':''))+'<span id="history-undo-help" class="help">All recorded actions: jumps, searches, purchases, sales, expenses, refills, settings and undo. Money movements and balances are in Accounts. Undo restores bank, cargo, route, contracts and policy state together. Undoing a jump uses its one mulligan; '+esc(S.jumpUndoEligibility(state).reason)+' Protected jumps cannot be removed. World Changes offers separate corrections of eligible world fields without reversing earlier transactions.</span></div>'+controls+(rows.length?table(['Date/Time','Planet','Entry','Note',''],rows,'large-scroll action-history'):empty(state.events.length?'No entries match this filter.':'Your committed actions appear here.')))+cancelledMailHistory()+closedPolicyHistory();
}

function debugValidation(){
 try{S.validate(structuredClone(state));return {ok:true,message:'Campaign state validates successfully.'};}
 catch(error){return {ok:false,message:error.message};}
}
function debugReportObject(){
 const validation=debugValidation();
 let ledgerTotal='unavailable',ledgerMatchesBank=false;
 try{ledgerTotal=String(state.ledger.reduce((n,e)=>n+A.credit(e.amount),0n));ledgerMatchesBank=A.credit(ledgerTotal)===A.credit(state.bank);}catch{}
 const currentWorld=world(state.actual),viewWorld=viewed();
 return {
  generatedAt:new Date().toISOString(),
  application:{schema:state.schema,rulesVersion:R.VERSION,revision:state.revision,editable:!!store?.editable,storageKey:KEY},
  validation,
  campaign:{
   name:state.name,initialized:state.initialized,dateLabel:state.dateLabel,hours:state.hours,
   actualWorld:currentWorld?{id:currentWorld.id,name:currentWorld.name,uwp:currentWorld.overrideUWP||currentWorld.uwp,sector:currentWorld.sector,hex:currentWorld.hex}:null,
   viewedWorld:viewWorld?{id:viewWorld.id,name:viewWorld.name,uwp:viewWorld.overrideUWP||viewWorld.uwp,sector:viewWorld.sector,hex:viewWorld.hex}:null,
   bank:state.bank,ledgerTotal,ledgerMatchesBank,
   cargoUsed:supportDisplay(S.used(state)),cargoCapacity:state.ship.capacity,
   route:[...state.route],routeIndex:state.routeIndex
  },
  ship:structuredClone(state.ship),
  trader:structuredClone(state.trader),
  settings:structuredClone(state.settings),
  counts:{worlds:Object.keys(state.worlds||{}).length,knownWorlds:Object.keys(known||{}).length,lots:state.lots.length,contracts:state.contracts.length,policies:state.policies.length,ledger:state.ledger.length,snapshots:state.snapshots.length,events:state.events.length,undo:state.undo.length},
  cargo:state.lots.map(l=>({id:l.id,commodity:l.commodity,description:l.description,quantity:l.quantity,basis:l.basis,goodsValue:l.goodsValue,world:l.world,hours:l.hours,illegal:!!l.illegal,snapshotId:l.snapshotId,offerId:l.offerId})),
  contracts:structuredClone(state.contracts),
  policies:structuredClone(state.policies),
  marketSnapshots:structuredClone(state.snapshots.slice(-20)),
  recentLedger:structuredClone(state.ledger.slice(-50)),
  recentEvents:structuredClone(state.events.slice(-50)),
  currentSaleQuotes:[...saleQuotes.entries()].map(([lotId,q])=>({lotId,...structuredClone(q)})),
  interface:{tab,view,snapshotId,marketFilter,marketSearch,cargoSearch,cargoSort,selectedLots:[...selected],mapZoom,mapPan:{...mapPan},showHexes,showUwp,showTerritories,routeDraft:routeDraft?structuredClone(routeDraft):null},
  errors:structuredClone(debugErrors),
  changeLog:structuredClone(DEV_CHANGES)
 };
}
function debugReportText(){return JSON.stringify(debugReportObject(),null,2);}
async function copyDebugReport(){
 const text=debugReportText();
 try{await navigator.clipboard.writeText(text);message('Debug report copied to clipboard.');}
 catch(error){recordDebugError(error,'copy-debug-report');modal('Debug report','<p class="help">Clipboard access was unavailable. Select and copy the report below.</p><textarea id="debug-output" rows="18" readonly style="width:100%;font-family:monospace">'+esc(text)+'</textarea>',null);setTimeout(()=>{$('debug-output')?.select();},0);}
}
function bytesToBase64Url(bytes){
 let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function encodeDebugPayload(text){
 const raw=new TextEncoder().encode(text);
 if(typeof CompressionStream==='function'){
  const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressed=new Uint8Array(await new Response(stream).arrayBuffer());
  return 'gz.'+bytesToBase64Url(compressed);
 }
 return 'raw.'+bytesToBase64Url(raw);
}
async function createDebugLink(){
 const payload=await encodeDebugPayload(debugReportText());
 const link=location.origin+location.pathname+'#debug='+payload;
 let copied=false;
 try{await navigator.clipboard.writeText(link);copied=true;}catch(error){recordDebugError(error,'copy-debug-link');}
 modal('Debug link',`<p class="help">${copied?'The debug link was copied to your clipboard. Paste the entire link into ChatGPT.':'Clipboard access was unavailable. Select and copy the entire link below.'} The report is stored in the URL fragment; the calculator does not upload it to a debug service.</p><textarea id="debug-link-output" rows="10" readonly style="width:100%;font-family:monospace">${esc(link)}</textarea><p class="help">Encoded report size: ${payload.length.toLocaleString()} characters.</p>`,null);
 setTimeout(()=>{$('debug-link-output')?.select();},0);
}
function exportDebugBundle(){
 const text=debugReportText(),url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),a=document.createElement('a');
 a.href=url;a.download='traveller-debug-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
 message('Debug bundle download requested.');
}
function devTools(){
 const r=debugReportObject(),v=r.validation,errors=debugErrors.slice(-10).reverse();
 modal('TEMPORARY DEV TOOLS',`
 <p class="${v.ok?'help':'notice'}"><strong>Validation:</strong> ${esc(v.message)}</p>
 <div class="wide-actions">
  ${btn('Validate campaign','dev-validate')}
  ${btn('Copy Debug Report','dev-copy')}
  ${btn('Create Debug Link','dev-link')}
  ${btn('Export Debug JSON','dev-export')}
  ${btn('Clear Error Log','dev-clear-errors')}
 </div>
 <h3>Current diagnostics</h3>
 ${auditFacts([
  ['Schema / rules',r.application.schema+' / '+r.application.rulesVersion],
  ['Revision',r.application.revision],
  ['Editing role',r.application.editable?'Editable':'Read-only'],
  ['Current world',r.campaign.actualWorld?.name||'None'],
  ['Campaign time',displayDate(state.dateLabel,state.hours)],
  ['Bank',money(state.bank)],
  ['Ledger total',r.campaign.ledgerTotal==='unavailable'?'Unavailable':money(r.campaign.ledgerTotal)],
  ['Ledger matches bank',r.campaign.ledgerMatchesBank?'Yes':'No'],
  ['Cargo used',r.campaign.cargoUsed+' / '+r.campaign.cargoCapacity+' t'],
  ['Lots / snapshots / ledger',r.counts.lots+' / '+r.counts.snapshots+' / '+r.counts.ledger],
  ['Loaded campaign worlds',r.counts.worlds],
  ['Known worlds this session',r.counts.knownWorlds],
  ['Captured errors',debugErrors.length]
 ])}
 <h3>Current settings</h3>
 <pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(state.settings,null,2))}</pre>
 <h3>Recent errors</h3>
 ${errors.length?errors.map(e=>'<details><summary>'+esc(e.time+' · '+e.context+' · '+e.message)+'</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(e.stack||'No stack recorded')+'</pre></details>').join(''):'<p class="help">No captured errors this session.</p>'}
 <h3>Temporary change log</h3>
 ${table(['Date','Change'],DEV_CHANGES.map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(x.change)+'</td></tr>'))}
 <p class="help">These tools are for development and diagnosis only. They do not edit campaign state.</p>
 `,null);
}

let settingsDraft=null,settingsFormRevision=0,settingsRounding=[];
// Session-only presentation state. Capture before a render as native toggle
// events can still be queued when Save, Revert or navigation replaces the DOM.
const settingsOpenGroups=new Map();
function captureSettingsDisclosures(){for(const section of document.querySelectorAll('#main details[data-settings-group]'))settingsOpenGroups.set(section.dataset.settingsGroup,section.open);}
function settingsUtilityPanel(id,title,body){return `<details class="panel settings-section" data-settings-group="${id}" ${(settingsOpenGroups.get(id)??true)?'open':''}><summary class="panel-head settings-section-heading" aria-label="${esc(title)}"><div><h2>${esc(title)}</h2></div><span class="settings-disclosure" aria-hidden="true">▸</span></summary>${body}</details>`;}
function settingsPanel(){return `<form id="settings-form" novalidate><div class="settings-heading"><div><h2>Campaign settings</h2><p class="help">One setting per row. Save changes to apply your edits.</p></div><div class="row"><button id="settings-reset" type="button" data-mutate>Revert changes</button><button id="settings-save" type="submit" class="primary" data-mutate>Save changes</button></div></div><p id="settings-error" role="alert" tabindex="-1"></p><div id="settings-fields">${settingsFields()}</div><div id="settings-rounding-note">${roundingFootnote(settingsRounding)}</div></form>`+
 settingsUtilityPanel('rounding-time','Rounding & time',`<div class="settings-aux-row"><div>Round existing Credits & tons<p class="help">Credits up to 100; tons up to whole. Review before applying.</p></div>${btn('Round up Credits to 100 & tons to whole','rounding-preview','',true)}</div><div class="settings-aux-row"><div>Campaign time<p class="help">${esc(displayDate(state.dateLabel,state.hours))}</p></div>${btn('Advance / correct time','time','',true)}</div>`)+
 settingsUtilityPanel('backup-data','Backup & data',`<div class="panel-body"><p class="help">Browser storage is local to this device and browser. Save a JSON backup before moving devices or clearing browser data.</p><div class="settings-data-actions">${btn('Save campaign (JSON)','export')}${btn('Load campaign (JSON)','import','',true)}${btn('Export report (TXT)','report')}${btn('Rules & Notes','notes')}${btn('Reset campaign','reset','',true,'danger')}</div><div class="settings-legacy-actions">${btn('Ship, trader & options','settings-edit','',true)}${btn('TEMPORARY DEV TOOLS','dev-tools')}</div></div>`);}
function captureSettingsDraft(form){settingsDraft={revision:form.settingsRevision??settingsFormRevision,stale:!!form.settingsStale,fields:[...form.querySelectorAll('[name]')].map(el=>[el.name,el.type==='checkbox'?el.checked:el.value])};}
function normaliseSettingsFields(form){const previous=inputRounding;inputRounding=settingsRounding;try{normaliseFields(form);settingsRounding=inputRounding;}finally{inputRounding=previous;}replaceReferenceContent(form.querySelector('#settings-rounding-note'),roundingFootnote(settingsRounding));}
function updateSettingsForm(form){
 for(const [control,disabled]of form.settingsPendingControls||[])control.disabled=disabled;
 for(const input of form.querySelectorAll('[name]'))input.disabled=false;
 updateAccommodationEstimate(form);updateFuelSettingsEstimate(form);updateRecurringSettings(form);
 const readOnly=!store?.editable||campaignReloadRequired||services.active();syncSettingsControls(form,readOnly);
 if(settingsOperation?.pending){
  form.settingsPendingOwner=settingsOperation;
  form.settingsPendingControls=new Map([...form.querySelectorAll('input,select,textarea,button')].map(control=>[control,control.disabled]));
  syncSettingsControls(form,true);
 }
}
// Settings owns a submitted form/draft and the controller's exact publication.
// It never keeps a second campaign or recomputes settings at completion time.
function markSettingsDraftStale(){
 if(!settingsDraft)return;settingsDraft.stale=true;
 const form=$('settings-form')||suspendedSettings?.form;if(form)form.settingsStale=true;
}
function invalidateSettingsOperation(stale=false){
 if(stale)markSettingsDraftStale();
 const owner=settingsOperation;if(!owner)return;
 owner.invalidated=true;owner.publicationDeferred=false;
 if(owner.session)owner.session.cancelled=true;
 if(owner.session&&activeModal===owner.session&&$('modal').open){
  $('modal-error').textContent=campaignReloadRequired?campaignReloadMessage:'Campaign or editing ownership changed. Close and review the current Settings before continuing.';
  syncModalSubmit();
 }
}
function settingsOwnerCurrent(owner){
 if(settingsOperation!==owner||owner.invalidated||campaignReloadRequired||!store?.editable)return false;
 if(owner.session&&!modalCurrent(owner.session))return false;
 if(owner.inline)return settingsDraft===owner.draft&&settingsRounding===owner.rounding&&tab==='Settings'&&
  (($('settings-form')===owner.form&&owner.form.isConnected)||(suspendedSettings?.form===owner.form&&suspendedSettings.placeholder.isConnected));
 return owner.session?.settingsOwner===owner;
}
function freezeSettingsForm(owner){
 owner.controls=new Map([...owner.form.querySelectorAll('input,select,textarea,button')].map(control=>[control,control.disabled]));
 for(const control of owner.controls.keys())control.disabled=true;
 if(owner.inline){owner.form.settingsPendingOwner=owner;owner.form.settingsPendingControls=owner.controls;}
}
function restoreSettingsControls(owner){for(const [control,disabled]of owner.controls||[])control.disabled=disabled;}
function releaseSettingsPendingControls(owner){
 // A forced native close or foreign publication may leave a different current
 // form behind. Release only the temporary lock this operation put on that
 // exact mounted form, never its values, draft, disclosures, focus or view.
 if(settingsOperation!==owner)return;
 const form=$('settings-form')||(suspendedSettings?.placeholder.isConnected?suspendedSettings.form:null);
 if(!form||form.settingsPendingOwner!==owner)return;
 for(const [control,disabled]of form.settingsPendingControls||[])control.disabled=disabled;
 form.settingsPendingOwner=null;form.settingsPendingControls=null;
 syncSettingsControls(form,!store?.editable||campaignReloadRequired||services.active());
}
function completeSettingsWrite(owner,data){
 if(settingsOperation?.pending||worldWriteOperation?.pending)return false;
 if(!settingsOwnerCurrent(owner)||owner.revision!==state.revision)throw new SaveNotCommittedError(Error('Campaign changed. Revert changes or reopen Settings before editing again.'));
 if(services.active())throw new SaveNotCommittedError(Error('Finish or cancel the open ship service before changing Settings.'));
 owner.pending=true;owner.publication=null;owner.publicationDeferred=false;owner.candidatePrepared=false;
 const release=()=>{owner.pending=false;releaseSettingsPendingControls(owner);};
 const fail=error=>{
  // An observed durable publication outweighs a contradictory provider result.
  if(owner.publication&&error?.code!=='SAVE_COMMITTED_PUBLICATION_FAILED')error=new SaveCommittedPublicationError(owner.publication.revision,error);
  owner.publicationDeferred=false;release();throw error;
 };
 const finish=()=>{
  try{
   if(!owner.publication||owner.publication.revision!==owner.revision+1)throw Error('Settings completion did not publish the expected campaign.');
   if(owner.session)owner.session.savedRevision=owner.publication.revision;
   return settingsOwnerCurrent(owner)&&state===owner.publication;
  }catch(error){return fail(error);}finally{release();}
 };
 let result;
 try{
  freezeSettingsForm(owner);
  const previous=inputRounding;inputRounding=owner.rounding;
  // Candidate creation and rounding capture are synchronous even for a delayed
  // provider. Never leave another dialog bound to this form's rounding array.
  try{result=saveSettings(data,owner.revision,false,()=>{owner.candidatePrepared=true;});}finally{inputRounding=previous;}
 }catch(error){return fail(error);}
 if(result&&typeof result.then==='function')return Promise.resolve(result).then(finish,fail);
 const current=finish();
 if(current&&!owner.inline){finishSettingsOperation(owner);return false;}
 return current;
}
function finishSettingsOperation(owner){
 if(!settingsOwnerCurrent(owner)||state!==owner.publication)return false;
 const revision=owner.publication.revision;
 try{
  if(owner.session)owner.session.savedRevision=revision;
  // A saved form must not be reattached by closeModal. The following render
  // builds the current state (or a separately retained stale inline draft).
  suspendedSettings=null;owner.publicationDeferred=false;settingsOperation=null;
  if(owner.inline){settingsDraft=null;settingsRounding=[];}
  if(owner.session){owner.session.busy=false;closeModal();}
  render();if(owner.inline)$('settings-save')?.focus();
  message('Ship / trader settings saved.');
  return true;
 }catch(cause){throw new SaveCommittedPublicationError(revision,cause);}
}
function settingsSaveFailure(owner,error){
 if(owner.publication&&error?.code!=='SAVE_COMMITTED_PUBLICATION_FAILED')error=new SaveCommittedPublicationError(owner.publication.revision,error);
 const session=owner.session;if(session)session.busy=false;
 if(owner.uiFailure){if(activeModal===session)syncModalSubmit();return;}
 const known=error?.code==='SAVE_NOT_COMMITTED'&&error.committed===false&&!owner.publication;
 if(!known){
  owner.invalidated=true;owner.publicationDeferred=false;
  // Terminal safety is independent of the dialog being attached. Reporting is
  // best effort only after the application and provider reload guards latch.
  try{terminalModalSaveFailure(session||{saveName:'Settings',saveContext:'settings-save'},error);}catch{/* Guards precede reporting. */}
  if(session&&activeModal===session)syncModalSubmit();
  return;
 }
 if(!settingsOwnerCurrent(owner))return;
 restoreSettingsControls(owner);
 if(!owner.candidatePrepared){for(const section of owner.form.querySelectorAll('details[data-settings-group]'))section.open=true;captureSettingsDisclosures();}
 if(session){
  $('modal-body').innerHTML='<p>Settings were not saved. Close this dialog to review your retained changes and try Save changes again.</p>';
  $('modal-error').textContent=error.message;syncModalSubmit();
 }else{
  const errorNode=owner.form.querySelector('#settings-error');errorNode.textContent=error.message;errorNode.focus();errorNode.scrollIntoView({block:'center'});
 }
}
function awaitInlineSettings(owner,result){
 // Observe fulfillment and rejection before constructing the pending screen.
 const completed=Promise.resolve(result).then(current=>{
  const session=owner.session;if(session)session.busy=false;
  if(owner.uiFailure){if(activeModal===session)syncModalSubmit();return;}
  try{if(current)finishSettingsOperation(owner);else if(session&&activeModal===session)syncModalSubmit();}
  catch(error){settingsSaveFailure(owner,error);}
 },error=>settingsSaveFailure(owner,error));
 owner.promise=completed;owner.pendingGeneration=modalGeneration+1;
 try{
  const opened=modal('Saving Settings','<p>Saving Settings. Wait for the result before continuing.</p>',null,undefined,true,{retainRounding:true,awaitSave:true,saveName:'Settings',saveContext:'settings-save',annotateRounding:false});
  if(opened===false)throw Error('Settings could not acquire its pending screen.');
  owner.session=activeModal;owner.session.busy=true;owner.session.mutates=true;syncModalSubmit();
 }catch(error){
  if(modalGeneration===owner.pendingGeneration&&activeModal?.saveContext==='settings-save')owner.session=activeModal;
  owner.uiFailure=true;owner.invalidated=true;owner.publicationDeferred=false;
  try{terminalModalSaveFailure(owner.session||{saveName:'Settings',saveContext:'settings-save'},error);}catch{/* Guards precede reporting. */}
 }
 return completed;
}
function mountSettingsForm(){
 const form=$('settings-form');if(!form)return;
 mountSettingsLayout(form,settingsOpenGroups);
 settingsFormRevision=settingsDraft?.revision??state.revision;
 const revision=settingsFormRevision;form.settingsRevision=revision;form.settingsStale=!!settingsDraft?.stale;
 const current=()=>form.isConnected&&$('settings-form')===form&&!settingsOperation?.pending&&!campaignReloadRequired;
 if(settingsDraft){for(const [name,value]of settingsDraft.fields){const el=form.elements.namedItem(name);if(el){if(el.type==='checkbox')el.checked=value;else el.value=value;}}}
 else{settingsRounding=[];normaliseSettingsFields(form);}
 updateSettingsForm(form);
 form.addEventListener('input',()=>{if(!current())return;updateSettingsForm(form);captureSettingsDraft(form);});
 form.addEventListener('change',()=>{if(!current())return;normaliseSettingsFields(form);updateSettingsForm(form);captureSettingsDraft(form);});
 form.addEventListener('click',e=>{if(!current())return;const arrow=e.target.closest('[data-setting-step]');if(!arrow)return;stepSetting(arrow);});
 $('settings-reset').onclick=()=>{if(!current()||!store?.editable||$('modal').open)return;settingsDraft=null;settingsRounding=[];render();$('settings-reset')?.focus();};
 form.onsubmit=e=>{
  e.preventDefault();if(!current()||!store?.editable||$('modal').open)return;
  const error=form.querySelector('#settings-error');error.textContent='';let owner=null;
  try{
   if(form.settingsStale||revision!==state.revision)throw Error('Campaign changed. Revert changes to load the latest settings before editing again.');
   normaliseSettingsFields(form);updateSettingsForm(form);captureSettingsDraft(form);captureSettingsDisclosures();
   const invalid=[...form.elements].find(el=>el.willValidate&&!el.validity.valid);
   if(invalid){for(let node=invalid.parentElement;node&&node!==form;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;invalid.reportValidity();invalid.focus();return;}
   const data=new FormData(form);
   owner={inline:true,form,revision,draft:settingsDraft,rounding:settingsRounding,session:null,pending:false,invalidated:false,publication:null,publicationDeferred:false};
   settingsOperation=owner;
   const result=completeSettingsWrite(owner,data);
   if(result&&typeof result.then==='function')return awaitInlineSettings(owner,result);
   if(result)finishSettingsOperation(owner);
  }catch(err){
   if(owner)return settingsSaveFailure(owner,err);
   error.textContent=err.message;error.focus();error.scrollIntoView({block:'center'});
  }
 };
}

// Setup and location share only their save-completion boundary. Lookup remains
// dismissible; the prepared candidate locks this exact dialog before save().
function createWorldWriteOwner(session){
 const owner={session,form:$('modal-form'),campaign:state,revision:state.revision,epoch:campaignPublicationEpoch,editing:editingLossEpoch,pending:false,invalidated:false,publication:null,publicationDeferred:false,rounding:null};
 worldWriteOperation=owner;return owner;
}
function invalidateWorldWriteOperation(){
 const owner=worldWriteOperation;if(!owner)return;
 owner.invalidated=true;owner.publicationDeferred=false;owner.session.cancelled=true;
 if(activeModal===owner.session&&$('modal').open){
  $('modal-error').textContent=campaignReloadRequired?campaignReloadMessage:'Campaign or editing ownership changed. Close and review the current campaign before continuing.';
  syncModalSubmit();
 }
}
function worldWriteOwnerCurrent(owner){
 return worldWriteOperation===owner&&!owner.invalidated&&!campaignReloadRequired&&store?.editable&&editingLossEpoch===owner.editing&&modalCurrent(owner.session)&&
  (owner.publication?state===owner.publication&&campaignPublicationEpoch===owner.epoch+1:state===owner.campaign&&state.revision===owner.revision&&campaignPublicationEpoch===owner.epoch);
}
function beginWorldWriteLookup(owner){
 if(!worldWriteOwnerCurrent(owner)||owner.pending)throw new SaveNotCommittedError(Error('Campaign changed. Reopen this dialog before saving.'));
 // FormData and rounding belong to this submission, not edits during lookup.
 owner.rounding=structuredClone(inputRounding);owner.publication=null;owner.publicationDeferred=false;
}
function restoreWorldWriteControls(owner){
 if(activeModal!==owner.session||!$('modal').open)return;
 for(const [control,disabled]of owner.controls||[])control.disabled=disabled;
 owner.controls=null;syncModalSubmit();
}
function worldWriteFailure(owner,error){
 if(owner.publication&&error?.code!=='SAVE_COMMITTED_PUBLICATION_FAILED')error=new SaveCommittedPublicationError(owner.publication.revision,error);
 owner.pending=false;owner.publicationDeferred=false;owner.session.busy=false;
 const known=error?.code==='SAVE_NOT_COMMITTED'&&error.committed===false&&!owner.publication;
 if(known){
  owner.session.awaitSave=false;
  if(!worldWriteOwnerCurrent(owner))return false;
  restoreWorldWriteControls(owner);throw error;
 }
 // A failed native close may leave this same dialog open after ownership was
 // cleared. Recover only its exact closing generation, never a newer dialog.
 if(!activeModal&&$('modal').open&&modalGeneration===owner.closingGeneration)activeModal=owner.session;
 // Terminal safety does not depend on the old dialog still being mounted.
 owner.invalidated=true;
 try{terminalModalSaveFailure(owner.session,error);}catch{/* Reload guards precede reporting. */}
 restoreWorldWriteControls(owner);return false;
}
function finishWorldWrite(owner,label,after){
 const published=owner.publication;
 if(!published||published.revision!==owner.revision+1)throw Error('Save completion did not publish the expected campaign.');
 owner.session.savedRevision=published.revision;
 if(!worldWriteOwnerCurrent(owner))return false;
 owner.publicationDeferred=false;
 after();syncMailCheck();owner.session.busy=false;
 owner.closingGeneration=modalGeneration+1;closeModal();
 if(state!==published||campaignPublicationEpoch!==owner.epoch+1||editingLossEpoch!==owner.editing||!store?.editable||campaignReloadRequired||activeModal||modalGeneration!==owner.closingGeneration)return false;
 render();message(label+' saved.');
 return true;
}
function completeWorldWrite(owner,label,change,after,nearby=null){
 if(!worldWriteOwnerCurrent(owner)||owner.pending)throw new SaveNotCommittedError(Error('Campaign changed. Reopen this dialog before saving.'));
 const fail=error=>worldWriteFailure(owner,error);
 const finish=()=>{
  try{
   const current=finishWorldWrite(owner,label,after);
   owner.pending=false;owner.publicationDeferred=false;
   if(current&&nearby)refreshWorldNearby(nearby,{setupOwner:owner});
   return false; // This owner already closed its dialog, never close a newer one.
  }catch(error){return fail(error);}
  finally{owner.pending=false;owner.publicationDeferred=false;owner.session.busy=false;}
 };
 let result;
 try{
  const previous=inputRounding;inputRounding=owner.rounding;
  try{result=act(label,change,owner.revision,{announce:false,onPrepared:()=>{
   if(!worldWriteOwnerCurrent(owner))throw Error('Campaign changed. Reopen this dialog before saving.');
   owner.pending=true;owner.session.awaitSave=true;
   owner.controls=new Map([...owner.form.querySelectorAll('input,select,textarea,button')].map(control=>[control,control.disabled]));
   for(const control of owner.controls.keys())control.disabled=true;
   syncModalSubmit();
  }});}finally{inputRounding=previous;}
 }catch(error){return fail(error);}
 return result&&typeof result.then==='function'?Promise.resolve(result).then(finish,fail):finish();
}
async function refreshWorldNearby(w,{setupOwner=null}={}){
 // Nearby loading is read-only enrichment. Saving setup has already completed;
 // any newer navigation/modal/publication permanently retires this request.
 const request={};worldNearbyRequest=request;
 const campaign=state,epoch=campaignPublicationEpoch,editing=editingLossEpoch,generation=modalGeneration;
 const current=()=>worldNearbyRequest===request&&state===campaign&&campaignPublicationEpoch===epoch&&editingLossEpoch===editing&&!campaignReloadRequired&&modalGeneration===generation&&view===w.id&&(!setupOwner||state===setupOwner.publication&&store?.editable);
 try{const rows=await M.nearby(w,12);if(!current())return;rows.forEach(x=>known[x.id]=x);render();if(!setupOwner)message('Live nearby worlds loaded.');}
 catch(error){if(current()){try{message((setupOwner?'Campaign setup saved. Could not load nearby worlds: ':'Could not refresh nearby worlds: ')+error.message+'. Use Refresh nearby to retry.',true);}catch{/* Optional map reporting cannot undo a completed save. */}}}
 finally{if(worldNearbyRequest===request)worldNearbyRequest=null;}
}
async function setup(){
 if(worldWriteOperation?.pending)return false;
 let picker,owner;
 const opened=modal('Start your campaign',`<div class="split">${field('name','Campaign name','My trading campaign')}${field('ship','Ship name','Independent trader')}${field('bank','Opening bank · Cr','100000','text','','credits')}${field('capacity','Cargo capacity · tons','60','text','','tons')}${field('jump','Jump rating','2','number','min="1" max="6"')}${field('date','Starting Imperial date · day-year','001-1105')}</div>${fuelFields()}${accommodationFields()}<div id="setup-world"></div>${check('scoops','Ship has fuel scoops',true)}<p class="help">Existing cargo is added separately and will not debit this opening bank.</p>`,async f=>{
  beginWorldWriteLookup(owner);
  let w,bank;
  try{w=await picker.resolve();if(!worldWriteOwnerCurrent(owner))return false;parseDate(f.get('date'));bank=A.credit(f.get('bank'));if(bank<0n)throw Error('Opening bank cannot be negative');}
  catch(error){if(!worldWriteOwnerCurrent(owner))return false;throw new SaveNotCommittedError(error);}
  known[w.id]=w;
  return completeWorldWrite(owner,'Campaign setup',s=>{s.initialized=true;s.name=f.get('name');s.ship.name=f.get('ship');s.ship.capacity=A.decimal(f.get('capacity'));s.ship.accommodation=readAccommodation(f);s.ship.fuel=readFuel(f);s.ship.lifeSupport=readSupport(f,s.ship);s.ship.staterooms=roomTotal(s.ship);s.ship.roundTons=true;s.ship.jump=Number(f.get('jump'));s.ship.scoops=f.has('scoops');s.bank=String(bank);s.dateLabel=f.get('date');s.actual=w.id;s.worlds[w.id]=w;s.route=[w.id];s.ledger.push({id:S.uid(),type:'Opening bank',amount:String(bank),hours:0,world:w.id});},()=>{view=w.id;},w);
 },'Start campaign',true,{saveName:'Campaign setup',saveContext:'setup-save'});
 if(opened===false)return false;
 owner=createWorldWriteOwner(activeModal);
 updateAccommodationEstimate();updateFuelSettingsEstimate();picker=createWorldPicker($('setup-world'),{initial:{sector:'Spinward Marches',hex:'1910'},title:'Current world'});
}
async function refreshNearby(show=true,isCurrent=()=>true){const w=viewed();if(!w)return;const rows=await M.nearby(w,12);if(!isCurrent())return;rows.forEach(x=>known[x.id]=x);render();if(show)message('Live nearby worlds loaded.');}
function findWorld(){
 let picker,selectionVersion=0;
 const claimIntent=()=>{const version=++selectionVersion;return()=>version===selectionVersion;};
 const opened=modal('Find a world','<div id="global-world-search"></div><div id="find-world"></div><p class="help">Browse to inspect this world, or use it as your ship’s starting position.</p><button type="button" id="choose-starting-world">Use as starting world</button>',async(f,isCurrent)=>{
  const ownsIntent=claimIntent(),current=()=>isCurrent()&&ownsIntent();
  try{const w=await picker.resolve();if(!current())return false;const rows=await M.nearby(w,12);if(!current())return false;
   rows.forEach(x=>known[x.id]=x);known[w.id]=w;view=w.id;render();scheduleMapAreas();
  }catch(e){if(!current())return false;throw e;}
 },'Browse world',false);
 if(opened===false)return false;
 const campaign=state,epoch=campaignPublicationEpoch,editing=editingLossEpoch,editable=!!store?.editable;
 const mutationCurrent=()=>editable&&store?.editable&&!campaignReloadRequired&&state===campaign&&campaignPublicationEpoch===epoch&&editingLossEpoch===editing;
 picker=createWorldPicker($('find-world'),{initial:viewed()||{sector:'Spinward Marches',hex:'1910'},title:'Or choose by location'});
 const session=activeModal;
 createGlobalWorldSearch($('global-world-search'),{claimIntent,onDismiss:closeModal,isCurrent:()=>modalCurrent(session),onBrowse:async(w,isCurrent)=>{
  const rows=await M.nearby(w,12);if(!isCurrent())return;
  // Browsing stays session-only: no act/save, route change, or ship movement.
  rows.forEach(x=>known[x.id]=x);known[w.id]=w;view=w.id;mapPan={x:0,y:0};mapZoom=Math.max(1,mapZoom);rememberWorld(w);
  closeModal();render();scheduleMapAreas();
 }});
 const starting=$('choose-starting-world');starting.disabled=!mutationCurrent();
 starting.onclick=async()=>{
  if(!modalCurrent(session)||starting.disabled||!mutationCurrent())return;
  const ownsIntent=claimIntent(),current=()=>modalCurrent(session)&&ownsIntent()&&mutationCurrent();starting.disabled=true;
  try{const w=await picker.resolve();if(!current())return;known[w.id]=w;setLocation(w);}
  catch(e){if(current())$('modal-error').textContent=e.message;}
  finally{if(modalCurrent(session))starting.disabled=!mutationCurrent();}
 };
}
const planetCache=new Map();
function planetInfoBody(w){
 const data=planetInformation(w),rows=rs=>table(['Field','Code','Meaning'],rs.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>'),'planet-info-table');
 return '<div class="planet-info">'+auditFacts(data.summary)+'<h3>Universal World Profile · '+esc(data.uwp)+'</h3>'+rows(data.decoded)+'<h3>System</h3>'+auditFacts(data.system)+data.sections.map(([title,items])=>'<details><summary>'+esc(title)+'</summary>'+rows(items)+'</details>').join('')+'<h3>Remarks and trade codes '+ruleInfo('commodity')+'</h3>'+(data.remarks.length?table(['Code','Meaning'],data.remarks.map(([code,meaning])=>'<tr><td>'+esc(code)+'</td><td>'+esc(meaning)+'</td></tr>'),'planet-info-table'):'<p class="help">None recorded.</p>')+'</div>';
}
async function showPlanetInfo(id){
 const w=world(id);if(!w)throw Error('Select a world first.');
 const key=w.sector+'|'+w.hex,cached=planetCache.get(key),source=worldSheetURL(w);
 const override=w.overrideUWP||w.zone!==(w.raw?.Zone==='A'?'Amber':w.raw?.Zone==='R'?'Red':'Safe');
 modal('Planet information · '+w.name,'<p class="help">Traveller Map · M1105 · '+esc(w.sector)+' '+esc(w.hex)+'</p>'+(override?'<p class="notice">This window shows Traveller Map’s published data. Campaign overrides used by the calculator remain separate.</p>':'')+'<p id="planet-load-status" role="status">'+(cached?'Loaded this session.':'Showing available data; refreshing from Traveller Map…')+'</p><div id="planet-information">'+planetInfoBody(cached||w)+'</div><p class="help rule-footnote">Source: <a href="'+esc(source)+'" target="_blank" rel="noopener">Traveller Map world sheet</a>. Decoded descriptions use Traveller Map’s definitions; missing data is marked as not supplied.</p>',null);
 const generation=modalGeneration;if(cached)return;
 try{
  const fresh=await M.loadWorld(w.sector,w.hex);
  if(fresh.id!==w.id)throw Error('World coordinates did not match the selected world.');
  planetCache.set(key,fresh);while(planetCache.size>32)planetCache.delete(planetCache.keys().next().value);
  if(generation!==modalGeneration||!$('modal').open)return;
  $('planet-information').innerHTML=planetInfoBody(fresh);$('planet-load-status').textContent='Loaded from Traveller Map.';
 }catch(error){
  if(generation!==modalGeneration||!$('modal').open)return;
  $('planet-load-status').innerHTML='Could not refresh: '+esc(error.message)+'. Available data is still shown. '+btn('Retry','planet-info',id);
 }
}
function overrideWorld(id){const w=world(id);if(!w)throw Error('Choose a world first.');known[id]=w;modal('World override · '+w.name,`${field('uwp','Effective UWP',w.overrideUWP||w.uwp)}<p class="help">Original Traveller Map UWP: ${esc(w.uwp)}</p>${select('zone','Travel zone',[['Safe','Safe'],['Amber','Amber'],['Red','Red']],w.zone)}${select('fuel','Fuel availability',[['auto','Use known facilities / ship scoops'],['yes','Referee: fuel available'],['no','Referee: unavailable']],w.fuelOverride===true?'yes':w.fuelOverride===false?'no':'auto')}${check('water','Accessible water suitable for fuel collection',w.accessibleWater)}${field('reason','Reason for override','')}`,f=>{R.parseUWP(f.get('uwp'),core);if(!f.get('reason').trim())throw Error('Reason required');return act('World override',s=>recordWorldOverride(s,id,{uwp:f.get('uwp'),zone:f.get('zone'),fuelOverride:f.get('fuel')==='yes'?true:f.get('fuel')==='no'?false:null,accessibleWater:f.has('water'),reason:f.get('reason')},core));});}
function startMapRoute(mode){
 if(!store.editable)throw Error('Take over editing first.');
 routeDraft={mode,origin:state.actual,revision:state.revision,stops:[],selections:[],selection:0,path:[state.actual],loading:false,error:'',request:0};render();
}
function mapRouteControls(){
 const d=routeDraft;if(!d)return '';
 const unavailable=d.loading||!d.stops.length||!!d.error;
 const save=btn('Save planned route','route-save','',true,'primary').replace('<button','<button '+(unavailable?'data-unavailable disabled':''));
 return `<section class="panel-body route-draft" aria-label="Route planning"><h3>${d.mode==='auto'?'Auto plot':'Build route'} · Jump-${state.ship.jump}</h3><p>${d.mode==='auto'?'Click a destination on the map.':'Click each next world or empty hex on the map. Your exact order is kept; no automatic stops are inserted.'} ${d.mode==='auto'?'The planner connects your destination using the ship’s jump rating. Fuel availability produces alerts only.':'Each direct leg must fit your ship’s jump rating. Fuel availability produces alerts only.'} Save when ready.</p><p class="help">Starting at ${esc(world(d.origin)?.name)}. Map clicks plan this route; they do not move the ship.</p><details><summary>How to use ${d.mode==='auto'?'Auto plot':'Build route'}</summary><ol>${d.mode==='auto'?'<li>Click your destination on the map. The app finds connecting stops.</li>':'<li>Click the first world you want to jump to, then click each following world in order.</li><li>Every click adds that exact next stop. The app does not insert connecting worlds.</li>'}<li>Drag to pan and scroll to zoom. Your route starts at the ship’s actual location.</li><li>Use Remove stop or Remove last stop to correct a choice. If a leg is too long, remove or change stops before saving. Fuel warnings do not block the route.</li><li>Select Save planned route, review it, then select Save route. Cancel planning leaves the saved route unchanged.</li><li>Use Jump to your next destination, then COMMIT JUMP to travel one leg. Clear planned route removes the plan and leaves the ship at its current world.</li></ol></details><ol>${d.stops.map((id,i)=>`<li>${esc(world(id)?.name||'Hex '+id)}${d.selections[i]?.pending?' (checking…)':d.selections[i]?.error?' (lookup failed)':''} ${btn('Remove stop','route-remove',i,true,'small')}</li>`).join('')}</ol><p role="status">${d.error?esc(d.error):d.loading?(d.selections.some(s=>s.pending)?'Checking selected hexes…':'Calculating route…'):d.stops.length?d.path.map(id=>esc(world(id)?.name)).join(' → '):'Choose a world to begin.'}</p><div class="wide-actions">${save}${d.stops.length?btn('Remove last stop','route-last','',true):''}${d.error?btn('Retry route','route-retry','',true):''}${btn('Cancel planning','route-cancel')}</div></section>`;
}
function currentMapDraft(d){return routeDraft===d&&state.revision===d.revision&&store.editable;}
function selectMapStop(d,id,pending=false){
 if(!currentMapDraft(d))throw Error('Route planning changed. Start a new plan after taking over editing.');
 // Reserve click order before any lookup awaits. Each occurrence owns its own
 // token, so removing a stop or choosing a newer Auto destination retires it.
 const selection={id,sequence:++d.selection,pending,error:'',anchor:pending?viewed():null};
 if(d.mode==='auto')d.selections=id===d.origin?[]:[selection];
 else if(id!==(d.stops.at(-1)||d.origin))d.selections.push(selection);
 else return null;
 d.stops=d.selections.map(s=>s.id);
 return d.selections.includes(selection)?selection:null;
}
async function loadMapSelection(d,selection){
 const current=()=>currentMapDraft(d)&&d.selections.includes(selection);
 if(!current())return;
 selection.pending=true;selection.error='';
 // This also invalidates any earlier route calculation before the lookup.
 await calculateMapRoute();if(!current())return;
 const [x,y]=selection.id.split(',').map(Number);message('Checking the selected hex...');
 try{
  const w=await M.loadMapHex(x,y,selection.anchor);if(!current())return;
  known[w.id]=w;selection.id=w.id;selection.pending=false;d.stops=d.selections.map(s=>s.id);
  await calculateMapRoute();if(current())message(w.emptySpace?'Empty-space stop selected.':'World selected: '+w.name);
 }catch(e){
  if(!current())return;
  selection.pending=false;selection.error='Could not check hex '+selection.id+': '+e.message+'. Use Retry route or remove this stop.';
  await calculateMapRoute();if(current())throw Error(selection.error);
 }
}
async function mapEmpty(id){
 if(world(id))return mapWorld(id);const d=routeDraft;if(!d)return;
 const selection=selectMapStop(d,id,true);if(!selection)return calculateMapRoute();
 return loadMapSelection(d,selection);
}
function mapWorld(id){
 worldNearbyRequest=null;
 if(!routeDraft){known[id]=world(id);view=id;mapPan={x:0,y:0};render();scheduleMapAreas();return;}
 const d=routeDraft;selectMapStop(d,id);return calculateMapRoute();
}
function removeMapStop(index){
 if(!routeDraft)return;
 routeDraft.selections.splice(Number(index),1);routeDraft.stops=routeDraft.selections.map(s=>s.id);return calculateMapRoute();
}
function retryMapRoute(){
 const d=routeDraft;if(!d)return;
 const failed=d.selections.filter(s=>s.error&&!s.pending);
 return failed.length?Promise.all(failed.map(s=>loadMapSelection(d,s))):calculateMapRoute();
}
async function calculateMapRoute(){
 const d=routeDraft;if(!d||!currentMapDraft(d))return;
 const request=++d.request,stops=[d.origin,...d.stops];
 const current=()=>routeDraft===d&&request===d.request&&state.revision===d.revision&&store.editable;
 d.path=[d.origin];d.error=d.selections.find(s=>s.error)?.error||'';d.loading=d.selections.some(s=>s.pending);
 if(d.loading||d.error){render();return;}
 d.loading=d.stops.length>0;render();if(!d.loading)return;
 try{
  const all={...mapAreas.worlds,...known,...state.worlds};
  if(d.mode==='build'){
   d.path=[...stops];
   for(let i=0;i<stops.length;i++){
    const w=all[stops[i]];
    if(!w)throw Error('Selected world is unavailable. Remove it and choose again.');
    if(i){const from=all[stops[i-1]],distance=M.distance(from,w);if(distance>state.ship.jump)throw Error(from.name+' → '+w.name+' is '+distance+' parsecs, beyond Jump-'+state.ship.jump+'. Add or change stops manually; no automatic stops will be inserted.');}
   }
   known={...known,...all};return;
  }
  for(const id of stops){const rows=await M.nearby(all[id],12);if(!current())return;for(const w of rows)all[w.id]??=w;}
  const path=M.plan(all,stops,state.ship,core);if(!current())return;
  known={...known,...all};d.path=path;
 }catch(e){if(current())d.error='Cannot connect this route: '+e.message;}
 finally{if(current()){d.loading=false;render();}}
}
function saveMapRoute(){
 const d=routeDraft;if(!d||d.loading||d.error||!d.stops.length)throw Error('Choose a valid route first.');
 const path=[...d.path],stops=[...d.stops],revision=d.revision;
 modal('Save planned route',`<p>${path.map(id=>esc(world(id)?.name)).join(' → ')}</p>${routeFuelAlert(path)}<p>${path.length-1} jumps · Jump-${state.ship.jump} ship</p><p>Legs: ${path.slice(1).map((id,i)=>M.distance(world(path[i]),world(id))+' pc').join(' → ')}</p><p class="help">This replaces future planned stops. Your ship, time, bank and cargo stay unchanged. Insurance keeps its original terms; review whether an amendment is needed.</p>`,()=>act('Route planned from map',s=>{s.worlds={...known,...s.worlds};s.route=[...s.route.slice(0,s.routeIndex),...path];s.mandatoryStops=stops;},revision),'Save route');
}
function clearPlannedRoute(){
 modal('Clear planned route',`<p>Clear future stops and start a new route from <strong>${esc(actual()?.name)}</strong>, the ship’s actual location?</p><p class="help">This does not return the ship to its original campaign starting world. Time, cargo, bank, completed travel history and insurance terms stay unchanged. You can undo this change.</p>`,()=>{act('Cleared planned route',s=>{s.route=[s.actual];s.routeIndex=0;s.mandatoryStops=[];});routeDraft=null;render();},'Clear route');
}
function plotRoute(){
 routeDraft=null;
 const origin=actual(),previous=(state.mandatoryStops||[]).map(id=>world(id)).filter(Boolean);
 const destination=previous.at(-1)||(viewed()?.id!==origin.id?viewed():{sector:origin.sector,subsector:M.subsectorForHex(origin.hex)});
 let destinationPicker;const stopRows=[];
 modal('Plan route · fewest jumps',`<div class="route-origin"><span class="eyebrow">Starting world · ship's actual location</span><p><strong>${esc(origin.name)}</strong> · ${esc(origin.sector)} · Hex ${esc(origin.hex)}</p></div><p class="help">Ship limit from Settings: <strong>Jump-${state.ship.jump}</strong> (${state.ship.jump} parsecs per jump). Automatic routing minimizes jumps and prefers longer legs first when routes tie. Shorter legs are allowed where needed to reach the destination or a required stop.</p><div id="route-stops"></div><button type="button" id="add-route-stop">Add stop</button><div id="route-destination"></div><p class="help">Use Add stop to require a visit to a particular world. Searches up to 12 parsecs around each requested stop, with alerts for unconfirmed fuel supplies. Planning does not move the ship.</p>`,async(f,isCurrent)=>{
  const revision=modalRevision;
  // Capture every selection before making requests; incomplete dropdowns cannot submit an old world.
  const selections=[...stopRows.map(row=>row.picker.selection()),destinationPicker.selection()];
  const stops=[origin];for(const choice of selections){const w=await M.loadWorld(choice.sector,choice.hex);if(!isCurrent())return false;rememberWorld(w);known[w.id]=w;stops.push(w);}
  for(const w of stops){const rows=await M.nearby(w,12);if(!isCurrent())return false;for(const x of rows)known[x.id]=x;}
  const all={...known,...state.worlds},path=M.plan(all,stops.map(w=>w.id),state.ship,core);
  const distance=path.slice(1).reduce((n,id,i)=>n+M.distance(all[path[i]],all[id]),0);
  modal('Review route',`<p>${path.map(id=>esc(all[id].name)).join(' → ')}</p>${routeFuelAlert(path,all)}<div class="preview"><dl><dt>Ship limit (Settings)</dt><dd>Jump-${state.ship.jump}</dd><dt>Jumps</dt><dd>${path.length-1}</dd><dt>Leg distances</dt><dd>${path.slice(1).map((id,i)=>M.distance(all[path[i]],all[id])+' pc').join(' → ')}</dd><dt>Total distance</dt><dd>${distance} pc</dd></dl></div><p class="help">Changing the plan does not move the ship. Insurance keeps its original route until amended.</p>`,()=>act('Route planned',s=>{s.worlds={...all};s.route=[...s.route.slice(0,s.routeIndex),...path];s.mandatoryStops=stops.slice(1).map(w=>w.id);},revision),'Save route',true,{retainRounding:true});return false;
 },'Calculate route');
 function arrange(){
  stopRows.forEach((row,i)=>{row.title.textContent='Stop '+(i+1);row.up.disabled=i===0;row.down.disabled=i===stopRows.length-1;$('route-stops').append(row.element);});
 }
 function addStop(initial={sector:origin.sector,subsector:M.subsectorForHex(origin.hex)}){
  const element=document.createElement('section');element.className='route-stop';
  const title=document.createElement('h3'),actions=document.createElement('div');actions.className='row';
  const host=document.createElement('div');element.append(title,actions,host);$('route-stops').append(element);
  const row={element,title,picker:createWorldPicker(host,{initial,title:'Stop world'})};
  for(const [label,key,offset] of [['Move up','up',-1],['Move down','down',1],['Remove stop','remove',0]]){
   const button=document.createElement('button');button.type='button';button.textContent=label;row[key]=button;actions.append(button);
   button.onclick=()=>{const i=stopRows.indexOf(row);if(!offset){stopRows.splice(i,1);element.remove();}else{const j=i+offset;if(j<0||j>=stopRows.length)return;[stopRows[i],stopRows[j]]=[stopRows[j],stopRows[i]];}arrange();};
  }
  stopRows.push(row);arrange();
 }
 $('add-route-stop').onclick=()=>addStop();
 for(const w of previous.slice(0,-1))addStop(w);
 destinationPicker=createWorldPicker($('route-destination'),{initial:destination,title:'Destination world'});
}
function routeFuelAlert(path,worlds=null){
 const missing=[...new Set(path)].map(id=>worlds?.[id]||world(id)).filter(w=>w&&!M.fuel(w,state.ship,core));
 return missing.length?'<p class="notice" role="alert"><strong>Fuel alert:</strong> Supply is unconfirmed or unavailable at '+missing.map(w=>esc(w.name)).join(', ')+'. You can continue this route; arrange fuel in play.</p>':'';
}
// Only preparation with a delayed provider needs a pending screen. The local
// synchronous path still opens the ordinary jump confirmation immediately.
function invalidateJumpPreparation(){
 const owner=jumpPreparation;
 if(owner){owner.invalidated=true;if(owner.session)owner.session.cancelled=true;}
 if(activeModal?.jumpCommit)activeModal.cancelled=true;
 if(activeModal&&$('modal').open&&(activeModal.jumpCommit||activeModal===owner?.session)){
  if(campaignReloadRequired)$('modal-error').textContent=campaignReloadMessage;
  else if(!activeModal.terminal)$('modal-error').textContent='Campaign or editing ownership changed. Reopen Jump from the current campaign.';
  syncModalSubmit();
 }
}
function preparationSession(owner){return owner.session||{saveName:'Prepared jump roll',saveContext:'jump-prepare',terminal:false,cancelled:false};}
function finishBrokenJumpPreparation(owner){
 owner.pending=false;if(owner.session){owner.session.busy=false;if(activeModal===owner.session)syncModalSubmit();}
 if(jumpPreparation===owner)jumpPreparation=null;return false;
}
function failJumpPreparation(owner,error){
 owner.pending=false;
 const session=owner.session;if(session)session.busy=false;
 if(error?.code==='SAVE_NOT_COMMITTED'&&error.committed===false){
  if(session&&activeModal===session&&$('modal').open){
   $('modal-error').textContent=error.message+(!store?.editable||owner.invalidated?' Reopen Jump from the current campaign after taking over editing.':'');
   $('modal-body').innerHTML='<p>The jump dice were not saved. Retry preparation to use the same rolled dice, or cancel. The ship has not moved.</p>';
   $('modal-submit').hidden=false;syncModalSubmit();return false;
  }
  if(jumpPreparation===owner)jumpPreparation=null;throw error;
 }
 terminalModalSaveFailure(preparationSession(owner),error);
 if(session&&activeModal===session)syncModalSubmit();
 if(jumpPreparation===owner)jumpPreparation=null;return false;
}
function finishJumpPreparation(owner,prepared){
 owner.pending=false;if(owner.session)owner.session.busy=false;
 if(owner.invalidated||!store?.editable||jumpPreparation!==owner){
  if(activeModal===owner.session&&$('modal').open){
   owner.session.cancelled=true;$('modal-body').innerHTML='<p>The campaign or editor changed while the jump dice were saving. Reopen Jump from the current campaign. No journey is confirmed by this screen.</p>';syncModalSubmit();
  }
  if(jumpPreparation===owner)jumpPreparation=null;return false;
 }
 if(state.revision!==prepared.state.revision||state.actual!==owner.from.id)return failJumpPreparation(owner,Error('Jump preparation completion did not publish the expected campaign.'));
 try{
  owner.confirmationGeneration=modalGeneration+1;showJumpConfirmation(prepared,owner);
  if(jumpPreparation===owner)jumpPreparation=null;
 }catch(cause){
  // A prepared roll is not a committed journey. Its own saved revision is
  // nevertheless durable and must not become a fresh-roll retry on UI failure.
  if(modalGeneration===owner.confirmationGeneration&&activeModal?.saveContext==='jump-commit'){owner.session=activeModal;owner.session.saveName='Prepared jump roll';owner.session.saveContext='jump-prepare';}
  return failJumpPreparation(owner,new SaveCommittedPublicationError(prepared.state.revision,cause));
 }
 return;
}
function saveJumpPreparation(owner){
 try{
  if(campaignReloadRequired||owner.invalidated||jumpPreparation!==owner||!store?.editable||state.revision!==owner.revision||state.actual!==owner.from.id)throw new SaveNotCommittedError(Error('Campaign or editing ownership changed. Reopen Jump from the current campaign.'));
  owner.pending=true;
  const result=campaignWrites.prepareJump(()=>{owner.roll??=R.roll(6);return structuredClone(owner.roll);},owner.revision);
  if(!result||typeof result.then!=='function')return finishJumpPreparation(owner,result);
  // Observe the result before rendering: even a pending-screen failure must
  // not abandon an in-flight durable write or create an unhandled rejection.
  owner.promise=Promise.resolve(result).then(prepared=>owner.uiFailure?finishBrokenJumpPreparation(owner):finishJumpPreparation(owner,prepared),error=>owner.uiFailure?finishBrokenJumpPreparation(owner):failJumpPreparation(owner,error));
  try{
   if(!owner.session){
    const opened=modal('Preparing jump','<p>Saving the jump dice. Wait for confirmation before continuing. This prepares a roll only; the ship has not moved.</p>',()=>saveJumpPreparation(owner),'Retry preparation',true,{awaitSave:true,saveName:'Prepared jump roll',saveContext:'jump-prepare',annotateRounding:false});
    if(opened===false)throw Error('Jump preparation could not acquire its pending screen.');
    owner.session=activeModal;
   }
   owner.session.busy=true;$('modal-submit').hidden=true;syncModalSubmit();
  }catch(error){
   owner.uiFailure=true;owner.invalidated=true;
   try{terminalModalSaveFailure(preparationSession(owner),error);}catch{/* Reload guards are set before publication/display reporting. */}
  }
  return owner.promise;
 }catch(error){return failJumpPreparation(owner,error);}
}
function jump(){
 if(jumpPreparation?.pending)return jumpPreparation.promise||false;
 if(campaignReloadRequired)throw new SaveNotCommittedError(Error('Reload this page before editing the campaign again.'));
 if(!store?.editable)throw new SaveNotCommittedError(Error('This tab is read-only. Take over editing first.'));
 if(activeModal?.awaitSave&&activeModal.busy)throw new SaveNotCommittedError(Error('Wait for the current campaign save to finish.'));
 if(services.active())throw new SaveNotCommittedError(Error('Finish or cancel the open ship service before preparing a jump.'));
 const to=world(state.route[state.routeIndex+1]);if(!to)throw Error('Plan a route first');const from=actual(),distance=M.distance(from,to);if(distance>state.ship.jump)throw Error('Route leg exceeds this ship’s jump rating.');const fuel=jumpFuel(state.ship,distance);
 const owner={base:state,revision:state.revision,from,to,distance,fuel,roll:null,session:null,pending:true,invalidated:false,promise:null,uiFailure:false};jumpPreparation=owner;
 return saveJumpPreparation(owner);
}
function showJumpConfirmation(prepared,owner){const {from,to,distance,fuel}=owner,revision=prepared.state.revision;const dice=prepared.roll,hours=148+dice.total,attemptId=prepared.attempt.id;modal('Commit jump · '+from.name+' → '+to.name,`<div class="preview"><dl><dt>Distance</dt><dd>${distance} pc</dd><dt>Jump dice ${ruleInfo('jump-duration')}</dt><dd>${dice.dice.join(' + ')}</dd><dt>Elapsed time</dt><dd>${hours} hours</dd></dl></div>${routeFuelAlert([from.id,to.id])}${fuel?.shortfall?'<p class="notice" role="alert"><strong>Insufficient fuel:</strong> Need '+fuel.tons+' tons; '+fuel.before+' aboard; shortfall '+fuel.shortfall+' tons. You may still commit this jump. The tank will show 0 tons; resolve the missing fuel in play.</p>':''}${fuel?auditFacts([['Ship displacement',fuel.displacementTons+' tons'],['Jump fuel required',fuel.tons+' tons'],['Fuel aboard before',fuel.before+' tons'],['Fuel aboard after',fuel.after+' tons']])+'<p class="help rule-footnote">Jump fuel '+ruleInfo('jump-fuel')+'</p>':'<p class="help">Fuel tracking is not configured. Enter ship size and fuel in Ship settings.</p>'}${field('hours','Elapsed hours · referee override',hours,'number','min="0" step="1"')}<p class="help">${ruleInfo('jump-undo')} ${prepared.attempt.mulliganUsed?'Mulligan used: this is the final attempt.':'One mulligan is available immediately after committing, before any later campaign change.'} Cancel, reopening and reloading keep these dice.</p><p class="help">This moves the ship and advances time. A policy covering a different route requires an amendment before it covers the changed route.</p>`,(f,isCurrent=()=>true)=>{
 let elapsed;try{elapsed=Number(f.get('hours'));if(!Number.isSafeInteger(elapsed)||elapsed<0)throw Error('Enter whole nonnegative hours');}catch(cause){throw new SaveNotCommittedError(cause);}
 const next=act('Jump: '+from.name+' → '+to.name,s=>S.commitJump(s,{attemptId,elapsed}),revision);
 const finish=saved=>{if(isCurrent()){try{view=to.id;render();}catch(cause){throw new SaveCommittedPublicationError(saved.revision,cause);}}return saved;};
 return next&&typeof next.then==='function'?Promise.resolve(next).then(finish):finish(next);
 },'COMMIT JUMP',true,{awaitSave:true,saveName:'Jump',saveContext:'jump-commit'});activeModal.jumpCommit=true;syncModalSubmit();}
// A map selection is only a browsing position. Offer a visible way back to the
// ship before opening a search or sale; never move the ship or trade remotely.
function returnToTradingWorld(resume){
 if(viewed()?.id===state.actual)return false;
 modal('Trade at the current system',`<p class="trade-recovery">You are browsing <strong>${esc(viewed()?.name||'another world')}</strong>. Your ship is at <strong>${esc(actual()?.name)}</strong>.</p><p>Supplier searches, buyer searches and sales take place at the ship’s current world. Continue there to open this trade action.</p><p class="help">This changes only the trading view. It does not move the ship, advance time or spend Credits.</p>`,()=>{view=state.actual;render();resume();return false;},'Continue at current system',true,{annotateRounding:false});
 return true;
}
function contactSearchPeriodText(status=contactSearchStatus(state)){
 const period=status.period;
 return status.active?'Current period: '+displayDate(state.dateLabel,period.startedHours)+'. All search penalties reset: '+displayDate(state.dateLabel,period.resetsHours)+'.':period?'Previous period ended '+displayDate(state.dateLabel,period.resetsHours)+'. All penalties cleared. The next committed search starts a new 28-day period.':'No active period. The first committed search starts this planet’s 28-day period.';
}
function contactSearchDetails(search,dateLabel=search?.dateLabel||state.dateLabel){
 if(!search)return '<p class="help">Search inputs were not recorded for this older snapshot.</p>';
 const period=search.contactPeriod;
 return '<h3>Contact search '+ruleInfo('contact-search')+'</h3>'+auditFacts([['Search dice total used',search.effectiveTotal],['Earlier attempts / penalty',search.previous==null?'Not recorded':search.previous+' / DM −'+search.previous],['Search total / target',search.total==null?'Not recorded':search.total+' / 8'],['Elapsed time',search.hours==null?'Not recorded':search.hours+' hours'],...(period?[['Timing rule',period.rule],['Period started',displayDate(dateLabel,period.startedHours)],['All penalties reset',displayDate(dateLabel,period.resetsHours)]]:[])])+'<p class="help">'+esc(period?contactSearchRule:'Legacy search: original inputs and totals are preserved. Current penalty periods are reconstructed in committed-search order from saved start times using the campaign’s 28-day Home Rule; this does not recalculate this historic result.')+'</p>';
}
function searchDialog(kind='supplier'){
 if(actual()?.emptySpace)throw Error('No local market or supplies in empty space. Continue to a world first.');
 if(returnToTradingWorld(()=>searchDialog(kind)))return;
 const c=ctx(state.actual),dice=R.roll(2),time=R.roll(1),brokerDice=R.roll(2),localSkill=Math.floor(brokerDice.total/3),status=contactSearchStatus(state),previous=status.previous,revision=state.revision;
 modal('Find a '+kind,`<p class="help">${esc(actual().name)} · previous attempts in this period: ${previous} (DM −${previous}). Search duration advances campaign time only when committed.</p><p class="help">${esc(contactSearchPeriodText(status))}</p><p class="help">Home Rule · 28-day search period ${ruleInfo('contact-search')}</p><div class="split">${field('party',kind==='buyer'?'Buyer identity':'Supplier identity',(kind==='buyer'?'Buyer ':'Supplier ')+(previous+1))}${select('method','Search method',[['normal','Broker · 1D days'],['blackMarket','Streetwise / black market · 1D days'],['online','Online Admin · 1D hours (TL8+)']],c.uwp.techLevel!==null&&c.uwp.techLevel>=8?'online':'normal')}${field('dice','Search 2D total',dice.total,'number','min="2" max="12"')}${field('duration','Duration die (1–6)',time.total,'number','min="1" max="6"')}${field('characteristic','EDU / SOC DM',state.trader.characteristic,'number','step="1"')}${field('counterparty','Counterparty Broker skill',2,'number','step="1"')}</div>${check('local','Hire a local broker / fixer')}${field('localSkill','Local skill: 2D ÷ 3, rounded down',localSkill,'number','min="0" step="1"')}<p class="help">Local broker ${ruleInfo('broker')} · Skill dice: ${brokerDice.dice.join(' + ')}. Negotiations use local skill +2; normal fee 10%, illegal trade 20%. A natural 2 for a fixer is flagged for the referee.</p>${check('success','Referee override: treat this search as successful')}`,f=>{
  const method=f.get('method'),m=core.search.methods[method];if(!m)throw Error('Invalid search method');
  if(method==='online'&&(c.uwp.techLevel===null||c.uwp.techLevel<8))throw Error('Online search requires TL8+');
  const partyName=f.get('party').trim();if(!partyName)throw Error('Counterparty identity required');
  const key=partyKey(state.actual,partyName);if((state.cooldowns[key]||0)>state.hours)throw Error('This counterparty is still in rejection cooldown.');
  const useLocal=f.has('local'),skill=useLocal&&method!=='online'?Number(f.get('localSkill')):Number(state.trader[m.skill.toLowerCase()]),rolled=Number(f.get('dice')),duration=Number(f.get('duration')),characteristic=Number(f.get('characteristic')),counterparty=Number(f.get('counterparty'));
  if(![skill,rolled,duration,characteristic,counterparty].every(Number.isInteger)||rolled<2||rolled>12||duration<1||duration>6)throw Error('Invalid search input');
  const port=core.search.starportDM[c.uwp.starport]||0,total=rolled+skill+characteristic+port-previous,success=total>=8||f.has('success'),illegal=method==='blackMarket',hours=duration*(m.durationUnit==='days'?24:1);
  const options={creditStep:creditStep(state),illegal,skill:useLocal?Number(f.get('localSkill')):state.trader.broker,local:useLocal,counterparty,...pricingOptions(false)};
  const offers=success&&kind==='supplier'?R.market(c,options,core).map(o=>({...o,id:S.uid(),remaining:o.quantity,expired:false,illegal:!!good(o.commodity).universallyIllegal,description:good(o.commodity).name,original:{quantity:o.quantity,unitPrice:o.unitPrice}})):[];
  const id=S.uid(),contactPeriod=contactSearchPeriod(state,id);
  const snap={id,kind,party:key,partyName,worldId:state.actual,world:c,startedHours:state.hours,hours:state.hours+hours,criminal:illegal,options,offers,availability:success&&kind==='supplier'?marketAvailabilityRecord(c,options,offers):null,success,rulesVersion:R.VERSION,interpretationVersion:2,search:{method,contactPeriod,dateLabel:state.dateLabel,generatedDice:dice,effectiveTotal:rolled,skill,characteristic,port,previous,total,difficulty:8,successOverride:f.has('success'),durationDie:duration,hours,localSkillDice:useLocal?brokerDice:null,fixerWarning:useLocal&&illegal&&brokerDice.total===2}};
  modal('Review '+kind+' search',`<div class="preview"><dl><dt>Search total / target</dt><dd>${total} / 8</dd><dt>Result</dt><dd>${success?'Contact found':'No contact found'}</dd><dt>Elapsed time</dt><dd>${hours} hours</dd><dt>Goods offered</dt><dd>${offers.length}</dd><dt>Home Rule · earlier attempts</dt><dd>${previous} (DM −${previous})</dd><dt>28-day period starts</dt><dd>${esc(displayDate(state.dateLabel,contactPeriod.startedHours))}</dd><dt>All penalties reset</dt><dd>${esc(displayDate(state.dateLabel,contactPeriod.resetsHours))}</dd></dl></div>${snap.search.fixerWarning?'<p class="notice">Natural 2: the fixer may be an informer. Referee adjudication required.</p>':''}<p class="help">Committing records this attempt and its elapsed time. It does not buy or sell cargo. The penalty uses the search’s start time, even when the search finishes after the reset.</p>`,()=>{
   act(kind+' search: '+partyName,s=>S.commitContactSearch(s,snap,{revision}));snapshotId=snap.id;tab='Trade';render();
   if(kind==='buyer'&&success&&selected.size){saleForm(snap);return false;}
   if(kind==='buyer'&&success){tab='Trade';render();message('Buyer found. Select cargo, then Get sale offers.');}
  },'Commit search',true,{retainRounding:true});return false;
 },'Preview search');
}
function findOffer(id){for(const snap of state.snapshots){const offer=snap.offers.find(o=>o.id===id);if(offer)return {snap,offer};}throw Error('Offer missing');}
function commodityAudit(id){const {snap,offer}=findOffer(id);modal('Commodity audit · '+offer.description,priceAudit(offer.audit,offer.unitPrice,offer.commodity,snap)+availabilityAudit(offer,offer.commodity)+auditFacts([['Available quantity',offer.remaining+' t'],['Offer status',offer.expired?'Expired':'Active'],['Expiration note',offer.expirationNote||'None']])+offerAdjustments(offer)+tradeFootnotes(),null);}
function editOffer(id){const {snap,offer}=findOffer(id);modal('Referee market override',`<p>${esc(offer.description)}</p><div class="split">${field('quantity','Remaining tons',offer.remaining,'text','','tons')}${field('price','Price per ton · Cr',offer.unitPrice,'text','','credits')}</div>${field('roll','Pricing 3D total · optional override',offer.audit.dice?.total||10,'number','step="1"')}${check('useRoll','Recalculate price from this roll instead of the price field')}${field('expirationNote','Expiration / date note',offer.expirationNote||'')}${field('description','Description',offer.description)}${check('illegal','Illegal on this world',offer.illegal)}${field('reason','Reason','')}`,f=>{if(!f.get('reason').trim()||A.cmp(f.get('quantity'),0)<0||A.cmp(f.get('price'),0)<0)throw Error('Valid values and reason required');const recalculated=f.has('useRoll')?R.quote(good(offer.commodity),snap.world,{...snap.options,creditStep:creditStep(state),side:'buy',rollTotal:Number(f.get('roll')),illegalGood:f.has('illegal')},core):null;act('Market override',s=>{const o=s.snapshots.find(x=>x.id===snap.id).offers.find(x=>x.id===id);o.overrides??=[];o.overrides.push({hours:s.hours,reason:f.get('reason'),before:{remaining:o.remaining,unitPrice:o.unitPrice},after:{remaining:A.decimal(f.get('quantity')),unitPrice:recalculated?recalculated.unitPrice:A.decimal(f.get('price'))}});o.remaining=A.decimal(f.get('quantity'));o.unitPrice=recalculated?recalculated.unitPrice:A.decimal(f.get('price'));if(recalculated){o.previousAudits??=[];o.previousAudits.push(o.audit);o.audit={...o.audit,...recalculated.audit};}o.expirationNote=f.get('expirationNote');o.description=f.get('description');o.illegal=f.has('illegal');o.manualRequired=false;});});}
function purchaseInsurance(f,offer,insuredValue=null){const plannedRoute=state.route.slice(state.routeIndex);const cost=insuredValue===null?up(A.mul(String(up(f.get('quantity'))),offer.unitPrice),creditStep(state)):A.credit(insuredValue);let insurance=null;if(f.has('insure')){if(!state.settings.insurance)throw Error('Insurance is disabled. Enable it in Settings before adding coverage.');const legs=Number(f.get('insuranceLegs'));if(!Number.isInteger(legs)||legs<1||legs>=plannedRoute.length)throw Error('Plan a route and choose the insured destination first');const route=plannedRoute.slice(0,legs+1),plannedDistance=route.slice(1).reduce((n,x,i)=>n+M.distance(world(route[i]),world(x)),0);const distanceText=f.get('insuranceDistance').trim(),distance=Number(distanceText),distanceReason=f.get('distanceReason').trim();if(!distanceText||!Number.isFinite(distance)||distance<0)throw Error('Enter a nonnegative insured distance in parsecs');if(distance!==plannedDistance&&!distanceReason)throw Error('Add a reason for overriding the planned distance');insurance={...R.insuranceQuote(cost,Number(f.get('coverage')),distance,route.map(x=>world(x).zone),mp,f.get('manualPremium').trim()||null,creditStep(state)),route,destination:route.at(-1),routeProgress:0,plannedDistance,distanceOverrideReason:distance!==plannedDistance?distanceReason:null};}return insurance;}
function updateInsuranceEstimate(){
 const target=$('insurance-estimate');if(!target)return;
 try{const f=new FormData($('modal-form'));if(!f.has('insure')){target.innerHTML='';return;}
  const lot=target.dataset.lot?state.lots.find(l=>l.id===target.dataset.lot):null;const p=lot?purchaseInsurance(f,null,lot.goodsValue):purchaseInsurance(f,findOffer(target.dataset.offer).offer);
  target.innerHTML='<dl><dt>Projected insurance premium</dt><dd class="total">'+money(p.premium)+'</dd><dt>Potential payout for total insured loss</dt><dd>'+money(p.potentialPayout)+'</dd><dt>Premium basis</dt><dd>'+ (p.manual?'Referee-entered premium':esc(p.rate)+'% of '+money(p.insuredValue))+'</dd></dl><p class="help">Charged only when you confirm. Coverage ends at '+esc(world(p.destination)?.name)+'.</p>';
 }catch(e){target.textContent=e.message;}
}
function insureHeldCargo(id){
 if(!state.settings.insurance)throw Error('Insurance is disabled. Enable it in Settings before adding coverage.');
 const lot=state.lots.find(l=>l.id===id);if(!lot)throw Error('Cargo lot no longer aboard');
 if(state.policies.some(p=>p.lotId===id&&['active','amendment-required'].includes(p.status)&&A.cmp(p.remainingQuantity,0)>0))throw Error('This cargo already has coverage. Amend or close that policy first.');
 const route=state.route.slice(state.routeIndex);
 modal('Insure cargo · '+lot.description,`<p>${esc(lot.quantity)} tons aboard · insured goods value ${money(lot.goodsValue)}.</p><p class="help">Cover this lot from your current world through the selected stop. Choose one jump to cover only the next leg, including a Red-zone leg. Only the new premium is charged.</p><input type="hidden" name="insure" value="yes"><div id="insurance-estimate" class="preview" role="status" aria-live="polite" data-lot="${esc(id)}"></div>${select('coverage','Coverage',mp.insurance.coveragePercent.map(x=>[x,x+'%']),70)}${select('insuranceLegs','Insure through',route.slice(1).map((id,i)=>[i+1,(i+1)+' jump'+(i?'s':'')+' · '+world(id).name]),1)}${field('insuranceDistance','Insured distance · parsecs',route.length>1?M.distance(world(route[0]),world(route[1])):'','number','min="0" step="any"')}${field('distanceReason','Reason if different from planned distance','')}${field('manualPremium','Referee premium · Cr (blank uses table)','','text','','credits')}`,f=>{
  const quote=purchaseInsurance(f,null,lot.goodsValue);S.insureLot(structuredClone(state),id,quote);
  modal('Confirm cargo insurance',`<div class="preview"><dl><dt>Coverage</dt><dd>${quote.coverage}%</dd><dt>Destination</dt><dd>${esc(world(quote.destination).name)}</dd><dt>Distance</dt><dd>${quote.distance} parsecs</dd><dt>Premium to pay</dt><dd class="total">${money(quote.premium)}</dd><dt>Potential total-loss payout</dt><dd>${money(quote.potentialPayout)}</dd></dl></div><p class="help">The premium is added to this lot's cost basis. Your cargo quantity and goods purchase value stay unchanged.</p>`,()=>act('Insured cargo: '+lot.description,s=>S.insureLot(s,id,quote)),'COMMIT INSURANCE',true,{retainRounding:true,insurance:true});return false;
 },'Preview insurance',true,{insurance:true});updateInsuranceEstimate();
}
function policyAudit(id){
 const p=state.policies.find(p=>p.id===id);if(!p)throw Error('Policy no longer exists');
 const lot=state.lots.find(l=>l.id===p.lotId),date=h=>h==null?'Not recorded':displayDate(state.dateLabel,h),route=r=>(r||[]).map(id=>world(id)?.name||id).join(' → ');
 const statuses={active:'Active',closed:'Closed',arrived:'Arrived — coverage ended','amendment-required':'Route changed — amendment required'};
 const row=(label,value)=>'<dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd>';
 const remainingPayout=up(A.mul(A.mul(p.insuredValue,A.div(p.remainingQuantity,p.initialQuantity)),A.div(p.coverage,100)),creditStep(state));
 modal('Insurance policy', '<h3>'+esc(lot?.description||'Former cargo lot')+'</h3><div class="preview"><dl>'+[
  ['Status',statuses[p.status]||p.status],['Coverage',p.coverage+'%'],['Insured destination',world(p.destination)?.name||p.destination],['Current insured route',route(p.route)],['Purchased',date(p.createdHours)],['Original insured cargo',p.initialQuantity+' t'],['Remaining insured cargo',p.remainingQuantity+' t'],['Original insured goods value',money(p.insuredValue)],['Remaining recorded goods value',money(p.remainingValue)],['Original premium paid',money(p.premium)],['Maximum payout on remaining cargo',p.status==='active'?money(remainingPayout):'No active coverage']
 ].map(([k,v])=>row(k,v)).join('')+'</dl></div><h3>Original premium calculation</h3><div class="preview"><dl>'+[
 ['Quoted distance',p.distance+' parsecs'],['Calculated route distance',p.plannedDistance==null?'Not separately recorded':p.plannedDistance+' parsecs'],['Travel zones used',(p.zones||[]).join(', ')],['Premium calculation',p.manual?'Referee-entered premium':p.rate+'% × '+money(p.insuredValue)+' ('+(p.roundingStep===100?'rounded up to the next Cr100':p.roundingStep===1?'rounded up to whole Credits':'rounding increment not recorded; saved premium retained')+')'],['Distance adjustment',p.distanceOverrideReason||'None']
 ].map(([k,v])=>row(k,v)).join('')+'</dl></div><p class="help">Insurance covers the goods value, excluding broker fees and insurance premiums. Claims require referee approval. Arrival at the insured destination ends coverage; it does not refund the premium.</p><h3>Claims</h3>'+((p.claims||[]).length?table(['Date','Lost cargo','Payout','Reason'],p.claims.map(c=>'<tr><td>'+esc(date(c.hours))+'</td><td class="number">'+esc(c.quantity)+' t</td><td class="number">'+money(c.payout)+'</td><td>'+esc(c.reason)+'</td></tr>')):'<p class="help">No claims recorded.</p>')+'<h3>Amendments</h3>'+((p.amendments||[]).length?p.amendments.map(a=>'<div class="preview"><p>'+esc(date(a.hours))+' · '+esc(a.reason)+'</p><p>Premium adjustment: '+money(a.adjustment)+' (negative means a refund)</p><p class="help">Previous destination: '+esc(world(a.previous?.destination)?.name||a.previous?.destination)+'<br>Previous route: '+esc(route(a.previous?.route))+'</p></div>').join(''):'<p class="help">No amendments recorded.</p>')+'<p class="help">Insurance uses the optional rules referenced below. <a href="'+ROOT+'OPTIONAL_RULES.md" target="_blank" rel="noopener">Insurance rules and notes</a> · <a href="'+ROOT+'RULES_VERIFICATION.md" target="_blank" rel="noopener">Rules verification</a></p>',null,undefined,true,{insurance:true});
}
function buyForm(id){const {snap,offer}=findOffer(id);S.assertWorld(state,snap.worldId);if(offer.expired||offer.manualRequired)throw Error('Offer is expired or needs referee values.');const plannedRoute=state.route.slice(state.routeIndex),plannedDistance=plannedRoute.length>1?plannedRoute.slice(1).reduce((n,x,i)=>n+M.distance(world(plannedRoute[i]),world(x)),0):null;const defaultFee=snap.options.local?(offer.illegal?20:10):0;modal('Purchase · '+offer.description,`${tradeComplicationFlag(offer.audit,true)}<div class="split">${field('quantity','Tons to buy',A.cmp(offer.remaining,1)<0?offer.remaining:'1','number','min="0" max="'+esc(offer.remaining)+'" step="any"','tons')}${field('fee','Broker fee · %',defaultFee,'number','min="0" max="100" step="any"')}</div>${field('description','Cargo-lot description',offer.description)}<p class="help">Price: ${money(offer.unitPrice)} per ton. Each purchase creates a separate lot.</p>${state.settings.insurance?`<fieldset class="preview"><legend>Optional</legend>${check('insure','Insurance · insure this cargo')}<div id="purchase-insurance-options" hidden><div id="insurance-estimate" class="preview" role="status" aria-live="polite" data-offer="${esc(id)}"></div>${select('coverage','Coverage',mp.insurance.coveragePercent.map(x=>[x,x+'%']),70)}${select('insuranceLegs','Insure through',plannedRoute.slice(1).map((id,i)=>[i+1,(i+1)+' jump'+(i?'s':'')+' · '+world(id).name+' · '+plannedRoute.slice(1,i+2).reduce((n,x,j)=>n+M.distance(world(plannedRoute[j]),world(x)),0)+' pc']),Math.max(1,plannedRoute.length-1))}${field('insuranceDistance','Insured distance · parsecs',plannedDistance??'','number','min="0" step="any"')}<p class="help">Distance across the selected insured legs, not the jump count. Two Jump-2 legs = 4 parsecs. Coverage ends at the selected stop; later legs and their travel zones are excluded. Plan a route first to choose a stop.</p>${field('distanceReason','Reason if different from planned distance','')}${field('manualPremium','Referee premium · Cr (required beyond 6 pc; blank uses table)','','text','','credits')}<p class="help">Uses the selected part of the planned route and its destination. Changes to the insured route require an amendment. New coverage is available while cargo insurance is enabled in Settings.</p>${optionalRuleFootnote('insurance')}</div></fieldset>`:''}`,f=>{const quantity=A.positive(f.get('quantity'),'Quantity'),feePercent=Number(f.get('fee'));const cost=up(A.mul(quantity,offer.unitPrice),creditStep(state)),fee=up(A.mul(cost,A.div(feePercent,100)),creditStep(state));const insurance=purchaseInsurance(f,offer);const args={snapshotId:snap.id,offerId:id,quantity,feePercent,description:f.get('description'),insurance};const applyPurchase=s=>S.buy(s,args);applyPurchase(structuredClone(state));modal('Confirm purchase',`${tradeComplicationFlag(offer.audit,true)}<div class="preview"><dl><dt>Cargo</dt><dd>${esc(quantity)} t</dd><dt>Goods</dt><dd>${money(cost)}</dd><dt>Broker fee</dt><dd>${money(fee)}</dd>${insurance?'<dt>Insurance premium</dt><dd>'+money(insurance.premium)+'</dd>':''}<dt>Total debit</dt><dd class="total">${money(cost+fee+A.credit(insurance?.premium||0))}</dd></dl></div>${insurance?`<p class="help">${esc(insurance.coverage)}% coverage to ${esc(world(insurance.destination).name)} over ${esc(insurance.distance)} parsecs${insurance.distanceOverrideReason?' (planned '+esc(insurance.plannedDistance)+'; override: '+esc(insurance.distanceOverrideReason)+')':''}. Potential payout ${money(insurance.potentialPayout)}. Claims require referee approval.</p>`:''}`,()=>act('Purchase: '+args.description,applyPurchase),'COMMIT PURCHASE',true,{retainRounding:true,insurance:!!insurance});return false;},'Preview purchase');}
// Existing fractional stock may be sold in full without creating an extra ton.
// Any other entered quantity still follows the whole-ton house rule.
function saleQuantityField(lot){
 const fractional=A.cmp(lot.quantity,up(lot.quantity))!==0;
 return field('qty_'+lot.id,'Tons to sell',lot.quantity,'number',fractional?'min="0" max="'+esc(lot.quantity)+'" step="any" data-round="tons" data-round-label="Tons to sell" data-round-exact="'+esc(lot.quantity)+'"':'min="1" max="'+esc(lot.quantity)+'" step="1"',fractional?null:'tons')+(fractional?'<p class="help">The exact remaining '+esc(lot.quantity)+' t can be sold without rounding. Other new quantities round up to whole tons.</p>':'');
}
function prepareSaleLine(lot,buyer,context,quote,form){
 const threshold=form.get('ban_'+lot.id).trim(),banThreshold=threshold===''?null:Number(threshold);
 const legality=R.tradeLegality(context,{illegalGood:lot.illegal,banThreshold});
 if(legality.illegal&&!buyer.criminal)throw Error(legality.locallyBanned?'Locally banned cargo needs a black-market buyer.':'Illegal cargo needs a black-market buyer.');
 let price=form.get('price_'+lot.id),benchmark=form.get('benchmark_'+lot.id),priced=quote;
 const originalBenchmark=String(effectiveRetailValue(lot.commodity,lot.illegal)),effectiveBenchmark=String(effectiveRetailValue(lot.commodity,legality.illegal));
 if(banThreshold!==null){
  priced=R.repriceQuote(good(lot.commodity),context,{...buyer.options,creditStep:creditStep(state),side:'sell',banThreshold,...pricingOptions(legality.illegal)},core,quote);
  if(price===quote.unitPrice)price=priced.unitPrice;
  if(benchmark===originalBenchmark)benchmark=effectiveBenchmark;
 }
 const manual=price!==priced.unitPrice||benchmark!==effectiveBenchmark||(form.get('taxRate')||'').trim()||priced.audit.manualRequired;
 if(manual&&!form.get('reason').trim())throw Error('Add a reason for manual values');
 return {lotId:lot.id,quantity:form.get('qty_'+lot.id),unitPrice:price,benchmarkPrice:benchmark,audit:{...priced.audit,effectiveIllegal:legality.illegal,locallyBanned:legality.locallyBanned,manualPrice:price!==priced.unitPrice?price:null,overrideReason:form.get('reason'),banThreshold:threshold||null}};
}
function saleForm(buyer,draft=null){if(!selected.size)throw Error('Select at least one cargo lot');S.assertWorld(state,buyer.worldId);const c=ctx(state.actual),lots=state.lots.filter(l=>selected.has(l.id));if(lots.some(l=>l.illegal)&&!buyer.criminal)throw Error('Illegal cargo needs a black-market buyer.');const quotes={};for(const l of lots){try{const previous=currentQuote(l.id);quotes[l.id]=previous?.buyerId===buyer.id?previous:R.quote(good(l.commodity),c,{...buyer.options,creditStep:creditStep(state),side:'sell',...pricingOptions(l.illegal)},core);}catch(e){quotes[l.id]={unitPrice:'0',audit:{manualRequired:true,reason:e.message}};}}for(const l of lots)saleQuotes.set(l.id,{...quotes[l.id],worldId:state.actual,revision:state.revision,buyerId:buyer.id});render();modal('Prepare sale · '+buyer.partyName,`<div class="toolbar">${btn('Find another buyer','buyer-search','',true)}${btn('Reject offer','reject',buyer.id,true)}</div><p class="help">Choose tons, then preview the final proceeds. Cancelling keeps this offer. Rejecting makes this buyer unavailable for 30 days. One committed sale sets one tax bracket. Each lot retains its actual cost and separate profit adjustment. ${buyer.criminal?'Criminal market: no automatic tax.':''}</p>${lots.map(l=>`<div class="preview"><h3>${esc(l.description)}</h3><p>Offer: <strong>${money(quotes[l.id].unitPrice)} / ton</strong></p>${tradeComplicationFlag(quotes[l.id].audit,true)}${saleQuantityField(l)}<details><summary>Referee options for this lot</summary><div class="split">${field('price_'+l.id,'Sale price / ton · Cr',quotes[l.id].unitPrice,'text','','credits')}${field('benchmark_'+l.id,'Normal market value / ton · Cr',effectiveRetailValue(l.commodity,l.illegal)??'','text','','credits')}${field('ban_'+l.id,'Local ban Law Level (blank if not applicable)','')}</div><p class="help">Remaining actual cost: ${money(l.basis)}. Price can be overridden. Local ban threshold is a referee input.</p></details></div>`).join('')}<div class="split">${field('fee','Total broker fee · %',buyer.options.local?(lots.some(l=>l.illegal)?20:10):0,'number','min="0" max="100" step="any"')}</div><details><summary>Referee options</summary>${state.settings.tax?field('taxRate','Referee tax rate · % (blank uses table)','','number','min="0" max="100" step="any"'):''}${field('reason','Reason for manual price / benchmark / tax overrides','')}</details>`,f=>{const lines=lots.map(l=>prepareSaleLine(l,buyer,c,quotes[l.id],f));const taxKey=buyer.id+':'+state.revision;const taxDice=saleTaxDice.get(taxKey)||[];saleTaxDice.set(taxKey,taxDice);let taxIndex=0;const p=R.salePreview(state.lots,lines,{creditStep:creditStep(state),percent:state.settings.profit,feePercent:Number(f.get('fee')),government:c.uwp.government===null?'?':core.uwp.numericAlphabet[c.uwp.government],criminal:buyer.criminal,taxEnabled:state.settings.tax,manualTaxRate:(f.get('taxRate')||'').trim()===''?null:Number(f.get('taxRate'))},core,mp,()=>{if(taxDice[taxIndex]===undefined)taxDice[taxIndex]=R.die();return taxDice[taxIndex++];});editSale=()=>saleForm(buyer,f);previewSale={...p,worldId:state.actual,party:buyer.party,revision:state.revision};modal('Confirm sale',`${btn('Edit quantities / fees','sale-edit','',true)}<div class="sale-complications">${p.lines.filter(l=>['complication','severe'].includes(tradeComplicationResult(l.audit))).map(l=>'<div class="sale-complication"><p>'+esc(l.description)+'</p>'+tradeComplicationFlag(l.audit)+'</div>').join('')}</div>${table(['Cargo','Tons','Cost basis','Offer / ton','Net proceeds','Profit / loss'],p.lines.map(l=>`<tr><td>${esc(l.description)}</td><td class="number">${esc(l.quantity)}</td><td class="number">${money(l.basis)}</td><td class="number">${money(l.unitPrice)}</td><td class="number">${money(l.bankDelta)}</td><td class="number">${money(l.adjusted)}</td></tr>`))}<div class="preview"><dl><dt>Gross sale</dt><dd>${money(p.gross)}</dd><dt>Broker fees</dt><dd>${money(p.fee)}</dd><dt>Tax · ${esc(p.tax.rate)}%</dt><dd>${money(p.tax.amount)}</dd><dt>Profit adjustment · ${esc(state.settings.profit)}% of positive profit retained ${ruleInfo('profit')}</dt><dd>${money(p.lines.reduce((n,l)=>n+BigInt(l.adjustment),0n))}</dd><dt>Bank credit</dt><dd class="total">${money(p.bankDelta)}</dd><dt>Bank after sale</dt><dd>${money(BigInt(state.bank)+BigInt(p.bankDelta))}</dd></dl></div>${p.lines.some(l=>['complication','severe'].includes(tradeComplicationResult(l.audit)))?'<p class="help">Trade complications are a house rule. The GM decides the issue and consequences.</p>':''}<details><summary>Price rolls and modifiers</summary>${p.lines.map(l=>'<h3>'+esc(l.description)+'</h3>'+priceAudit(l.audit,l.unitPrice,lots.find(x=>x.id===l.lotId).commodity,buyer)).join('')}${tradeFootnotes()}</details>${p.options.taxEnabled?'<details><summary>Tax calculation</summary>'+auditFacts([['Tax jurisdiction (government code)',p.options.government],['Taxable profit against retail value',p.tax.taxable?money(A.decimal(A.rat(p.tax.taxable.numerator,p.tax.taxable.denominator))):'Not recorded'],['Tax rate',p.tax.rate+'%'],['Tax-rate roll',p.tax.dice?p.tax.dice.dice.join(' + ')+' = '+p.tax.dice.total:'No tax dice used'],['Referee tax override',p.tax.manual?'Yes':'No'],['Tax outcome',p.tax.reason||'Calculated from the applicable bracket'],['Tax due',money(p.tax.amount)]])+'</details>':''}<p class="help"><a href="${ROOT}RULES_VERIFICATION.md" target="_blank" rel="noopener">Rules verification</a> · INT-007–021 · Cost is not debited again.</p>`,()=>{act('Sale to '+buyer.partyName,s=>S.sell(s,p,buyer.worldId,buyer.party),previewSale.revision);selected.clear();render();},'COMMIT SALE',true,{retainRounding:true,tax:p.options.taxEnabled});return false;},'Preview sale',true,{tax:state.settings.tax});if(draft)for(const [name,value] of draft){const el=$('modal-form').elements.namedItem(name);if(el)el.value=value;}}
function beginSale(){if(actual()?.emptySpace)throw Error('No local market or supplies in empty space. Continue to a world first.');if(!selected.size)throw Error('Select cargo first');if(returnToTradingWorld(beginSale))return;const buyers=state.snapshots.filter(s=>s.kind==='buyer'&&s.worldId===state.actual&&s.success&&(state.cooldowns[s.party]||0)<=state.hours);if(!buyers.length){searchDialog('buyer');return;}if(buyers.length===1){saleForm(buyers[0]);return;}modal('Choose a buyer',`${select('buyer','Previous buyer',buyers.map(b=>[b.id,b.partyName+' · hour '+b.hours]),buyers.at(-1).id)}<p class="help">Previously found buyers remain usable unless rejected. Existing offers retain their prices while the campaign is unchanged.</p>${btn('Find another buyer','buyer-search','',true)}`,f=>{saleForm(buyers.find(b=>b.id===f.get('buyer')));return false;},'Negotiate sale');}
function reject(snapId){const snap=state.snapshots.find(s=>s.id===snapId);modal('Reject this deal?',`<p>${esc(snap.partyName)} will be unavailable for 30 days (720 hours). Browsing away does not trigger this restriction.</p>`,()=>act('Rejected '+snap.partyName,s=>{s.cooldowns[snap.party]=s.hours+720;}),'Reject deal');}
function existingLot(){modal('Add existing / referee cargo',`${select('commodity','Commodity',core.commodities.map(g=>[g.id,g.name]),'11')}${field('description','Description','Existing cargo')}<div class="split">${field('quantity','Tons','1','text','','tons')}${field('basis','Remaining actual cost · Cr (including fees/premium)','0','text','','credits')}${field('goods','Remaining goods purchase value · Cr (excluding fees)','0','text','','credits')}${field('reason','Reason','Opening cargo')}</div>${check('illegal','Illegal cargo')}<p class="help">This adds owned cargo without changing the bank. All values are recorded for future partial sales.</p>`,f=>act('Cargo added',s=>S.addLot(s,{commodity:f.get('commodity'),description:f.get('description'),quantity:f.get('quantity'),basis:f.get('basis'),goodsValue:f.get('goods'),illegal:f.has('illegal')},f.get('reason'),f.get('reason')==='Opening cargo')));}
function correctCargo(id){const l=state.lots.find(l=>l.id===id);modal('Correct cargo · '+l.description,`<div class="split">${field('quantity','Remaining tons',l.quantity,'text','','tons')}${field('description','Lot description',l.description)}${field('basis','Remaining actual cost · Cr',l.basis,'text','','credits')}${field('goods','Remaining goods purchase value · Cr',l.goodsValue,'text','','credits')}${field('reason','Required reason','')}</div><p class="help">Zero quantity removes the lot only when both remaining values are zero. This is not a sale or insurance claim. For coverage that ended at arrival, a reduction also updates remaining policy quantities; original terms and claims remain recorded.</p>`,f=>act('Cargo correction',s=>{S.correctLot(s,id,f.get('quantity'),f.get('basis'),f.get('goods'),f.get('reason'));const lot=s.lots.find(x=>x.id===id);if(lot){lot.description=f.get('description');s.events.at(-1).after=structuredClone(lot);}} ));}
function claimForm(id){const p=state.policies.find(p=>p.id===id);modal('Record insured loss',`<p class="help">Remaining insured cargo: ${esc(p.remainingQuantity)} t; goods value ${money(p.remainingValue)}. Coverage ${esc(p.coverage)}%.</p>${field('quantity','Lost insured tons','1','text',A.cmp(p.remainingQuantity,up(p.remainingQuantity))?'data-round-exempt':'',A.cmp(p.remainingQuantity,up(p.remainingQuantity))?null:'tons')}${field('reason','Loss / evidence description','')}${check('approved','Referee has approved this loss and claim')}`,f=>{const args={policyId:id,quantity:f.get('quantity'),reason:f.get('reason'),approved:f.has('approved')};const test=structuredClone(state);S.claim(test,args);const result=test.policies.find(p=>p.id===id).claims.at(-1);modal('Confirm loss and claim',`<div class="preview"><dl><dt>Cargo removed</dt><dd>${esc(result.quantity)} t</dd><dt>Cost written off</dt><dd>${money(result.basisWrittenOff)}</dd><dt>Claim payout</dt><dd class="total">${money(result.payout)}</dd></dl></div><p class="help">Tax and profit reduction do not apply. This removes the lost cargo and records the payout together.</p>`,()=>act('Insurance claim',s=>S.claim(s,args)),'Commit loss & claim',true,{retainRounding:true,insurance:true});return false;},'Preview claim',true,{insurance:true});}
function amendPolicy(id){const p=state.policies.find(p=>p.id===id);modal('Amend insurance policy',`${select('mode','Action',[['amend','Cover current remaining planned route'],['close','Close remaining coverage']], 'amend')}${field('adjustment','Premium adjustment · Cr (negative = refund)','0','text','','credits')}${field('reason','Amendment reason','')}${check('approved','Referee approves the amended terms')}<p class="help">Original terms stay in the audit. Premium adjustments change both the bank and remaining lot cost basis.</p>`,f=>{if(!f.has('approved')||!f.get('reason').trim())throw Error('Referee approval and reason required');const adjustment=A.credit(f.get('adjustment')),route=state.route.slice(state.routeIndex);if(f.get('mode')==='amend'&&route.length<2)throw Error('Plan a remaining route first');act('Insurance amended',s=>{const policy=s.policies.find(x=>x.id===id),lot=s.lots.find(x=>x.id===policy.lotId);if(!lot||A.cmp(policy.remainingQuantity,0)<=0)throw Error('No remaining insured cargo');if(A.credit(s.bank)<adjustment||A.credit(lot.basis)+adjustment<0n)throw Error('Invalid premium adjustment');if(policy.amendments===undefined)policy.amendments=[];policy.amendments.push({hours:s.hours,reason:f.get('reason'),previous:{route:policy.route,destination:policy.destination,status:policy.status},adjustment:String(adjustment)});s.bank=String(A.credit(s.bank)-adjustment);lot.basis=String(A.credit(lot.basis)+adjustment);s.ledger.push({id:S.uid(),type:'Insurance amendment',amount:String(-adjustment),policyId:id,reason:f.get('reason'),hours:s.hours,world:s.actual});if(f.get('mode')==='close'){policy.status='closed';policy.remainingQuantity='0';policy.remainingValue='0';}else{policy.route=route;policy.routeProgress=0;policy.destination=route.at(-1);policy.status='active';}});},undefined,true,{insurance:true});}
function mailRollFields(){
 return '<details><summary>Manual mail rolls (optional)</summary><div class="split">'+field('mailAvailability','Mail availability · 2D total (blank rolls automatically)','','number','min="2" max="12" step="1"')+field('mailContainers','Mail containers · 1D roll (blank rolls automatically)','','number','min="1" max="6" step="1"')+'</div><p class="help">These are separate rolls. The container die is used only when mail is available. Entered totals are recorded as manual rolls.</p></details>';
}
function contractSearch(mailOnly=false){
 if(actual()?.emptySpace)throw Error('No local market or supplies in empty space. Continue to a world first.');
 if(viewed()?.id!==state.actual)throw Error('Search at the actual world');
 const destinations=Object.values({...known,...state.worlds}).filter(w=>w.id!==state.actual&&!w.emptySpace).sort((a,b)=>a.name.localeCompare(b.name));
 if(!destinations.length)throw Error('Load nearby worlds or a destination first');
 const dice=R.roll(2);
 modal(mailOnly?'Check for mail':'Find freight & mail',`${select('destination','Destination',destinations.map(w=>[w.id,w.name+' · '+w.hex]),state.route[state.routeIndex+1]||destinations[0].id)}<div class="split">${field('dice','Search 2D total',dice.total,'number','min="2" max="12" step="1" required')}${field('skill','Broker / Streetwise skill',Math.max(state.trader.broker,state.trader.streetwise),'number','step="1" required')}${field('characteristic','Search characteristic DM',state.trader.characteristic,'number','step="1" required')}${mailOnly?'':field('days','Freight deadline · days from now','14','number','min="0" step="1" required')}</div><div id="mail-dm-preview" class="preview" role="status"></div>${mailSettingsSummary()}${mailRollFields()}${mailOnly?'':`<details><summary>Override freight / mail dice</summary>${field('diceSequence','Optional dice in roll order (1–6, comma-separated)','')}<p class="help">Order: major, minor, incidental traffic (2 dice), then lot-count dice and each lot’s tonnage die; finally mail availability (2 dice) and container count. Unspecified dice roll normally. A separate manual mail total replaces that mail roll and consumes no sequence dice.</p></details><p class="help">Enter the referee-agreed freight deadline; 14 days is an editable suggestion, not a rulebook deadline. Freight uses direct origin-to-destination parsecs and requires manual terms beyond its payment table. Mail pays per container regardless of distance.</p>`}`,f=>{
  const destination=f.get('destination'),to=world(destination),distance=M.distance(actual(),to),searchTotal=Number(f.get('dice')),searchSkill=Number(f.get('skill')),searchCharacteristic=Number(f.get('characteristic')),effect=searchTotal+searchSkill+searchCharacteristic-8,days=mailOnly?0:Number(f.get('days'));
  if(!Number.isInteger(searchTotal)||searchTotal<2||searchTotal>12||![searchSkill,searchCharacteristic].every(Number.isInteger))throw Error('Enter a search total from 2–12 and whole-number skill / characteristic DMs');
  if(!Number.isSafeInteger(days)||days<0)throw Error('Enter whole nonnegative days');
  const sequence=String(f.get('diceSequence')||'').trim(),manualDice=sequence?sequence.split(',').map(x=>Number(x.trim())):[];
  if(manualDice.some(x=>!Number.isInteger(x)||x<1||x>6))throw Error('Dice overrides must be numbers 1–6');
  let usedDice=0;const rng=()=>usedDice<manualDice.length?manualDice[usedDice++]:R.die();
  const a=ctx(state.actual),b=R.context(to,core),freight=mailOnly?[]:R.freightOffers(a,b,distance,effect,core,rng),mail=R.mailOffer(a,b,distance,effect,state.ship,state.trader,core,rng,{availabilityTotal:f.get('mailAvailability'),containerRoll:f.get('mailContainers')});
  const searchDice=searchTotal===dice.total?dice:{dice:null,total:searchTotal,manual:true};
  Object.assign(mail.audit,{searchDice:structuredClone(searchDice),generatedSearchDice:structuredClone(dice),searchSkill,searchCharacteristic});
  const generated=[...freight,...(mail.available?[mail]:[])].map(o=>({...o,offerId:S.uid(),origin:state.actual,destination,dueHours:o.kind==='mail'?null:state.hours+days*24,generatedHours:state.hours,rulesVersion:R.VERSION}));
  const checkId=S.uid();
  act(mailOnly?'Mail check':'Contract search',s=>recordMailCheck(s,{id:checkId,label:mailOnly?'Mail check audit':'Contract search audit',hours:s.hours,world:s.actual,destination,mailOnly,searchDice,generatedSearchDice:dice,effectiveSearchDice:searchTotal,searchSkill,searchCharacteristic,effect,manualDice,manualDiceConsumed:usedDice,mailAudit:mail.audit,offers:structuredClone(generated)}));
  contractDrafts=mailOnly?[...contractDrafts.filter(c=>c.kind!=='mail'),...generated]:generated;
  mailAcceptedDetailsOpen=true;
  mailCheck={...mail,checkId,origin:state.actual,destination,offerId:generated.find(c=>c.kind==='mail')?.offerId,searchDice,searchSkill,searchCharacteristic};
  tab='Contracts';render();message(mail.available?'Mail available: '+mail.audit.count.total+' containers, '+mail.quantity+' tons.': 'No mail available this check.');
 },mailOnly?'Check for mail':'Generate offers');
 updateMailEstimate();
}
function updateMailEstimate(){
 const target=$('mail-dm-preview');if(!target)return;
 const form=$('modal-form'),value=name=>form.elements.namedItem(name)?.value;
 try{
  const destination=world(value('destination')),total=Number(value('dice')),skill=Number(value('skill')),characteristic=Number(value('characteristic'));
  if(![total,skill,characteristic].every(Number.isInteger)||total<2||total>12)throw Error('Enter valid search dice and whole-number DMs to calculate traffic.');
  const m=R.mailModifiers(ctx(state.actual),R.context(destination,core),M.distance(actual(),destination),total+skill+characteristic-8,state.ship,state.trader,core);
  target.textContent='Automatic freight traffic DM '+signedDM(m.dm.total)+' → mail freight-band DM '+signedDM(m.modifiers.freight)+'. All mail DMs '+signedDM(m.modifierTotal)+'; availability needs 2D + DMs ≥ 12.';
 }catch(error){target.textContent=error.message;}
}
function manualContract(){const destinations=Object.values({...known,...state.worlds}).filter(w=>w.id!==state.actual);modal('Manual freight / mail contract',`<p class="help">Referee terms ${ruleInfo('booking')}</p>${select('kind','Kind',[['freight','Freight'],['mail','Mail']],'freight')}${select('destination','Destination',destinations.map(w=>[w.id,w.name]),destinations[0]?.id)}<div class="split">${field('quantity','Whole contract · tons','5','text','','tons')}${field('payment','Payment on delivery · Cr','1000','text','','credits')}${field('days','Due in days (freight)','14','number','min="0" step="1"')}${field('reason','Referee terms / reason','')}</div>`,f=>{if(!f.get('reason').trim())throw Error('Reason required');const c={offerId:S.uid(),kind:f.get('kind'),origin:state.actual,destination:f.get('destination'),quantity:A.positive(f.get('quantity')),payment:String(A.credit(f.get('payment'))),dueHours:f.get('kind')==='mail'?null:state.hours+Number(f.get('days'))*24,audit:{manual:true,reason:f.get('reason')},rulesVersion:R.VERSION};act('Manual contract accepted',s=>S.acceptContract(s,c));});}
function accept(id){syncMailCheck();const c=contractDrafts.find(c=>c.offerId===id);if(!c)throw Error('Offer no longer available');modal('Accept '+c.kind,`<p>${esc(c.quantity)} tons to ${esc(world(c.destination).name)}, paying ${money(c.payment)} on delivery.</p><p class="help">The entire contract must fit. This reserves capacity; it does not pay you yet.</p>`,()=>{act('Accepted '+c.kind,s=>S.acceptContract(s,c));contractDrafts=contractDrafts.filter(x=>x.offerId!==id);render();},'Accept whole contract');}
function cancelMail(id){
 const c=state.contracts.find(c=>c.id===id),eligibility=S.mailCancellationEligibility(state,id);
 if(!eligibility.allowed)throw Error(eligibility.reason);
 modal('Cancel mail',`<p>Cancel this whole accepted mail consignment before its first committed jump?</p>${auditFacts([['Consignment',c.description||'Mail containers'],['Origin',world(c.origin)?.name||c.origin],['Destination',world(c.destination)?.name||c.destination],['Cargo space released',c.quantity+' t'],['Income','Cr 0'],['Penalty','Cr 0'],['Bank after cancellation',money(state.bank)]])}<p class="help">There is no income or penalty. The original contract, rolls and cancellation stay in History and Audit/View. Undo restores the accepted consignment and its reserved space. Use Check for mail afterward to get a new offer.</p>`,()=>act('Cancelled mail',s=>S.cancelMail(s,id)),'Cancel mail and start over');
}
function deliver(id){const c=state.contracts.find(c=>c.id===id);S.assertWorld(state,c.destination);const late=c.kind==='freight'&&c.dueHours!==null&&state.hours>c.dueHours,d=R.roll(1);modal('Deliver '+c.kind,`<p class="help">Delivery terms ${ruleInfo(c.kind==='mail'?'mail':'freight-delivery')}</p><p>Destination: ${esc(world(c.destination).name)} · ${esc(c.quantity)} tons · contracted ${money(c.payment)}</p>${late?`<p class="notice">Late delivery: payment is reduced by (1D + 4) × 10%.</p>${field('die','Penalty die',d.total,'number','min="1" max="6"')}`:'<p class="help">Full payment is due. Tax and profit reduction do not apply.</p>'}`,f=>act('Delivered '+c.kind,s=>S.deliver(s,id,late?Number(f.get('die')):1)),'Commit delivery & payout');}

const expenseKinds=['berthing','fuel','staterooms','passengerSupport','salary','mortgage','maintenance'];
function expenseInput(){
 const f=new FormData($('modal-form'));
 return E.payableExpenses(expenseKinds.filter(kind=>f.has('include-'+kind)).map(kind=>({kind,fuelShip:state.ship,recurringShip:state.ship,mortgagePayments:f.get('mortgagePayments'),maintenancePayments:f.get('maintenancePayments'),creditStep:creditStep(state),weeks:f.get('weeks'),tons:f.get('fuelTons'),fuelType:f.get('fuelType'),monthly:f.get(kind),months:f.get(kind+'Months'),notes:f.get('expenseNotes'),otherSupplier:f.has('otherSupplier'),staterooms:roomTotal(state.ship),rooms:roomCounts(state.ship),roomService:state.ship.accommodation?.roomService,period:f.get(kind+'Period'),units:f.get(kind+'Units'),passengers:occupants(passengerShip(state)).passengers,crew:occupants(passengerShip(state)).crew,bookedLowBerths:passengerTotals(state).low})));
}
function coveredPaymentsMarkup(expense){
 const q=expense.mortgage||expense.maintenance;if(!q)return '';
 return `<details class="covered-payments" data-payment-first="${esc(q.firstDueDate)}" data-payment-count="${q.periods}" data-payment-amount="${esc(q.before.payment)}" data-payment-rendered="0"><summary>${q.periods} installment${q.periods===1?'':'s'} covered</summary><div class="covered-payments-scroll"><table><thead><tr><th>Due date</th><th>Amount</th></tr></thead><tbody></tbody></table></div></details>`;
}
const coveredPaymentsWorking=new WeakSet();
async function renderCoveredPayments(details){
 if(!details.open||coveredPaymentsWorking.has(details))return;coveredPaymentsWorking.add(details);
 try{
  const count=Number(details.dataset.paymentCount),body=details.querySelector('tbody');
  while(details.isConnected&&details.open&&Number(details.dataset.paymentRendered)<count){
   const start=Number(details.dataset.paymentRendered),end=Math.min(count,start+100),rows=[];
   for(let i=start;i<end;i++)rows.push('<tr><td>'+esc(advancePaymentDate(details.dataset.paymentFirst,i))+'</td><td class="number">'+money(details.dataset.paymentAmount)+'</td></tr>');
   body.insertAdjacentHTML('beforeend',rows.join(''));details.dataset.paymentRendered=String(end);
   if(end<count)await new Promise(requestAnimationFrame);
  }
 }finally{coveredPaymentsWorking.delete(details);}
}
function expenseSummary(q){const reference={berthing:'berthing',fuel:'refuel',staterooms:'support-cost',passengerSupport:'support-cost',salary:'salary',mortgage:'mortgage',maintenance:'maintenance',lifeSupportRefill:'support-pricing'}[q.kind];return '<h3>Calculation '+(reference?ruleInfo(reference):'')+'</h3>'+coveredPaymentsMarkup(q)+auditFacts([['Expense',q.label],['Location',q.worldName],...E.recurringExpenseDetails(q),['Total charge',money(q.amount)],...(q.notes?[['Notes',q.notes]]:[])])+'<p class="help rule-footnote">Recorded reference: '+esc(q.reference)+'</p>'+(q.fixedAmount?'':roundingFootnote([],q.roundingStep||1));}
function expenseBundleSummary(quotes){
 const total=quotes.reduce((n,q)=>n+A.credit(q.amount),0n);
 return table(['Expense','Amount'],quotes.map(q=>'<tr><td>'+esc(q.label)+'</td><td class="number">'+money(q.amount)+'</td></tr>'))+auditFacts([['Combined total',money(String(total))]])+quotes.map(q=>'<details><summary>'+esc(q.label)+' calculation and rules</summary>'+expenseSummary(q)+'</details>').join('');
}
function updateFuelAvailability(){
 const box=$('fuel-availability');if(!box)return;
 const f=new FormData($('modal-form')),type=f.get('fuelType'),selected=f.has('include-fuel');
 const {port,water,standard}=E.fuelAvailability(actual(),type);
 const confirmed=f.has('otherSupplier')&&String(f.get('expenseNotes')||'').trim();
 let text='';
 if(selected&&!standard&&!confirmed){
  const source=type==='water'?'Usable water is not established at '+actual().name+'.':(type==='refined'?'Refined':'Purchased unrefined')+' fuel is not supplied by Starport '+port+' at '+actual().name+'.';
  const alternative=type!=='water'&&water?' Choose Collect water for free unrefined fuel, or':type==='refined'&&['C','D'].includes(port)?' Choose Purchased unrefined fuel, or':'';
  text=type==='water'?'Water availability is not established at '+actual().name+'. Advisory only: collection remains available. Access, equipment and time are resolved in play.':'Fuel unavailable: '+source+alternative+' tick Other supplier / referee confirms availability and describe the confirmed source in Notes / fuel source. Preview is disabled until a valid source is selected.';
 }
 if(box.textContent!==text)box.textContent=text;
 box.hidden=!text;
 const select=$('modal-form').elements.fuelType;
 if(text)select.setAttribute('aria-describedby','fuel-availability');else select.removeAttribute('aria-describedby');
}
function updateExpenseEstimate(){
 if(!$('expense-estimate'))return;
 document.querySelectorAll('[data-expense-kind]').forEach(e=>{const selected=$('modal-form').elements['include-'+e.dataset.expenseKind].checked;e.hidden=!selected;e.querySelectorAll('input,select').forEach(x=>x.disabled=!selected);});
 updateFuelAvailability();
 try{
  const inputs=expenseInput();if(!inputs.length)throw Error($('modal-form').elements['include-salary']?'Nothing to pay. Select another expense or enter fuel to acquire.':'No fuel to acquire. Your tank may already be full.');
  const quotes=inputs.map(input=>E.expenseQuote(actual(),input));
  const f=new FormData($('modal-form')),skipped=f.has('include-fuel')&&E.zeroFuel({kind:'fuel',tons:f.get('fuelTons')});
  replaceReferenceContent($('expense-estimate'),(skipped?'<p class="help">No fuel to purchase (0 tons). Fuel is omitted; the other selected expenses can be paid.</p>':'')+expenseBundleSummary(quotes));activeModal.valid=true;
 }catch(e){$('expense-estimate').innerHTML='<p class="notice" role="alert"><strong>Cannot preview: </strong>'+esc(e.message)+'</p>';activeModal.valid=false;}
 syncModalSubmit();
}
function expensePeriod(kind){return `<div class="split">${select(kind+'Period','Refill / billing period',[['week','Weeks'],['month','Months']],'week')}${field(kind+'Units','Number of periods',1,'number','min="1" step="1"')}</div><p class="help">Weekly cost is one quarter of the monthly rate (four-week billing month).</p>`;}
function recurringExpenseFields(){
 return ['mortgage','maintenance'].map(kind=>{
  const m=state.ship[kind],name=kind==='mortgage'?'Mortgage':'Monthly maintenance';
  if(!m)return `<fieldset class="expense-choice"><legend>${name}</legend><p class="help">Enter ${name.toLowerCase()} in Settings to track its cost and pay ahead.</p></fieldset>`;
  const paidOff=kind==='mortgage'&&!m.remainingPayments,status=kind==='mortgage'?mortgageStatus(state):maintenanceStatus(state);
  const due=status.calendarError||((Number(status.duePayments)>0?status.duePayments+' payment'+(Number(status.duePayments)===1?'':'s')+' due':'No payment due yet')+'.');
  return `<fieldset class="expense-choice"><legend>${paidOff?name:check('include-'+kind,name)}</legend><p><strong>${money(m.payment)}</strong> every 4 weeks (28 days)${paidOff?' · All scheduled payments paid':''}</p>${paidOff?'':`<p class="help">Next unpaid payment due ${esc(m.nextDueDate)}. ${esc(due)}${m.lastPaidDueDate?' Paid through installment due '+esc(m.lastPaidDueDate)+'.':''}</p><div data-expense-kind="${kind}" hidden>${field(kind+'Payments','Number of payments to pay now',1,'number','min="1" '+(kind==='mortgage'?'max="'+m.remainingPayments+'" ':'')+'step="1"')}<p class="help">Each payment covers the next unpaid installment, including overdue installments first. You may pay future installments in advance.</p></div>`}</fieldset>`;
 }).join('');
}
function shipExpenses(initialFuelType=null){
 if(!state.initialized)throw Error('Set up a campaign first.');
 const fuelOnly=!!initialFuelType;
 const w=actual(),port=E.starport(w),saved=w.berthingRate?.port===port,defaults=state.ship.expenses||{};
 modal(fuelOnly?'Refuel':'Ship expenses',`<p><strong>${esc(w.name)}</strong> · Actual ship location · Starport ${esc(port)}</p>${fuelOnly?'':`<p class="help">Select any or all expenses to pay together.</p>${btn('Select all expenses','expenses-all')}`}
 ${fuelOnly?'':`<fieldset class="expense-choice"><legend>${check('include-berthing','Berthing',!initialFuelType)}</legend><div data-expense-kind="berthing">${!saved&&E.berthMultipliers[port]?btn('Roll & save starport rate','berthing-rate','',true):''}${field('weeks','Weeks to pay',1,'number','min="1" step="1"')}<p class="help">One saved 1D roll per starport. The weekly rate is reused on later visits.</p></div></fieldset>`}
 <fieldset class="expense-choice"><legend>${fuelOnly?'<input type="checkbox" name="include-fuel" checked hidden>Fuel':check('include-fuel','Fuel',false)}</legend><div data-expense-kind="fuel" hidden>${fuelPlanning()}<div class="split">${select('fuelType','Fuel type',[['refined','Refined · Cr500/ton'],['unrefined','Purchased unrefined · Cr100/ton'],['water','Collect water · Free unrefined fuel']],initialFuelType||(['A','B'].includes(port)?'refined':'unrefined'))}${field('fuelTons','Fuel to acquire · tons',suggestedFuel(!!initialFuelType),'number','min="0" step="1"','tons')}</div><p id="fuel-availability" class="notice" role="alert" hidden></p><p class="help">A/B sell refined and unrefined; C/D sell unrefined. Usable water provides free unrefined fuel at any port, including E/X. Water collection is always selectable. Missing hydrographics or planet information is an advisory warning only. Confirming fuel expenses adds purchased or collected fuel to the configured fuel capacity. Collection equipment, time and fuel-grade effects are resolved in play. Power-plant and small-craft use are not tracked separately.</p>${check('otherSupplier','Other supplier / referee confirms purchased fuel availability (explain in notes)')}</div></fieldset>
 ${fuelOnly?'':`<fieldset class="expense-choice"><legend>${check('include-staterooms','Stateroom expenses')}</legend><div data-expense-kind="staterooms" hidden>${table(['Stateroom class','Installed (including empty)','Service provided','Cr/room/month'],tiers.map(t=>`<tr><td>${t}</td><td class="number">${roomCounts(state.ship)[t]}</td><td>${serviceLabel(t,state.ship.accommodation?.roomService?.[t])}</td><td class="number">${money(serviceRate(t,state.ship.accommodation?.roomService?.[t]))}</td></tr>`))}<p class="help">${roomTotal(state.ship)} total staterooms, including crew rooms and empty rooms. Change counts and service upgrades in Ship, trader & options.</p>${expensePeriod('staterooms')}</div></fieldset>`}
 ${fuelOnly?'':`<fieldset class="expense-choice"><legend>${check('include-passengerSupport','Passenger & crew life support')}</legend><div data-expense-kind="passengerSupport" hidden>${table(['Service (crew + passengers)','People aboard','Cr/person/month'],tiers.map(t=>'<tr><td>'+t+'</td><td>'+((occupants(passengerShip(state)).passengers?.[t]??0)+(occupants(passengerShip(state)).crew?.[t]??0))+'</td><td>'+money(personRate(t))+'</td></tr>').concat(passengerTotals(state).low?['<tr><td>Booked Low (frozen)</td><td>'+passengerTotals(state).low+'</td><td>'+money(100)+'</td></tr>']:[]))}<p class="help">Middle service costs Cr1,000 per person/month; high service costs Cr3,000, including middle-cabin upgrades. These are additional to cabin expenses. Non-booked headcounts come from Settings; accepted passenger bookings are added automatically. Booked Low passengers cost Cr100 per month each; frozen occupants are excluded from awake charges.</p>${expensePeriod('passengerSupport')}<p class="help">These expense entries record payments only. Use Refill life support to replenish tracked supplies; do not pay both for the same refill.</p></div></fieldset>`}
 ${fuelOnly?'':`<fieldset class="expense-choice"><legend>${check('include-salary','Crew salaries')}</legend><div data-expense-kind="salary" hidden><div class="split">${field('salary','Total crew salaries · Cr per month',defaults.salary||'0','number','min="1" step="1"','credits')}${field('salaryMonths','Crew salaries · months to pay',1,'number','min="1" step="1"')}</div></div></fieldset>`}
 ${fuelOnly?'':recurringExpenseFields()}
 ${fuelOnly?'':'<p class="help">Crew salary is remembered after payment. Passenger and crew headcounts come from ship settings. Choose each billing period separately.</p>'}${field('expenseNotes',fuelOnly?'Notes / fuel source (optional)':'Notes / billing period (optional)','')}<div id="expense-estimate" aria-live="polite"></div><p class="help">${fuelOnly?'Confirming records only this fuel purchase or collection. Undo reverses the fuel and bank changes.':'One confirmation pays the selected expenses together. Each charge has its own ledger entry; undo reverses the whole payment.'}</p>`,()=>{
  const inputs=expenseInput();if(!inputs.length)throw Error($('modal-form').elements['include-salary']?'Nothing to pay. Select another expense or enter fuel to acquire.':'No fuel to acquire. Your tank may already be full.');
  const quotes=inputs.map(input=>E.expenseQuote(actual(),input)),total=quotes.reduce((n,q)=>n+A.credit(q.amount),0n);
  if(total>A.credit(state.bank))throw Error('Insufficient funds for the combined expenses');
  modal(fuelOnly?'Confirm refuelling':'Confirm ship expenses',(fuelOnly?expenseSummary(quotes[0]):expenseBundleSummary(quotes))+auditFacts([['Cash before payment',money(state.bank)],['Cash remaining after payment',money(String(A.credit(state.bank)-total))]]),()=>act('Paid '+quotes.length+' ship expense'+(quotes.length===1?'':'s'),s=>S.shipExpenses(s,inputs)),'Pay '+money(String(total)),true,{retainRounding:true});return false;
 },fuelOnly?'Preview fuel':'Preview expenses');
 updateExpenseEstimate();
}
function selectAllExpenses(){for(const kind of expenseKinds){const control=$('modal-form').elements['include-'+kind];if(control&&!control.disabled)control.checked=true;}updateExpenseEstimate();}
function rollBerthingRate(){
 const die=R.roll(1).total,next=act('Saved starport berthing rate',s=>S.saveBerthingRate(s,die));modalRevision=next.revision;
 document.querySelector('#modal-body [data-action="berthing-rate"]')?.remove();updateExpenseEstimate();
}
function ledgerAudit(id){
 const index=state.ledger.findIndex(l=>l.id===id),entry=state.ledger[index];if(!entry)throw Error('Ledger entry not found');
 if(entry.expense){modal('Ship expense details',auditFacts([['Recorded at',recordedPaymentDate(state,entry)],['Bank change',money(entry.amount)]])+expenseSummary({...entry.expense,worldName:entry.expense.worldName||state.worlds[entry.world]?.name||entry.world||'Not recorded'}),null);return;}
 const later=state.ledger.slice(index+1).reduce((n,e)=>n+A.credit(e.amount),0n),after=A.credit(state.bank)-later,before=after-A.credit(entry.amount);
 const related=entry.lotId?state.ledger.slice(0,index+1).reverse().find(e=>e.lotId===entry.lotId&&['Sale','Purchase'].includes(e.type)):null;
 const purchase=entry.type==='Purchase'?entry:related?.type==='Purchase'?related:null;
 const sale=entry.type==='Sale'?entry:related?.type==='Sale'?related:null;
 const lot=state.lots.find(l=>l.id===entry.lotId),p=state.policies.find(p=>p.id===entry.policyId);
 const saved=purchase?.purchase,details=sale?.audit;
 const historicalSale=state.ledger.find(e=>entry.lotId&&e.lotId===entry.lotId&&e.type==='Sale')?.audit;
 const commodity=saved?.commodity??details?.commodity??lot?.commodity??historicalSale?.commodity;
 const historicalDescription=historicalSale?.description;
 const facts=[['Transaction',entry.type],['Recorded at',recordedPaymentDate(state,entry)],['World',world(entry.world)?.name||'Not recorded'],['Bank change',money(entry.amount)],['Bank before',money(String(before))],['Bank after',money(String(after))]];
 if(entry.lotId)facts.push(['Commodity',good(commodity)?.name||'Not recorded in this older entry'],['Cargo description',saved?.description??details?.description??lot?.description??historicalDescription??'Not recorded']);
 if(entry.reason)facts.push(['Reason / notes',entry.reason]);
 const cash=v=>v==null?'Not recorded':money(v);
 let body=auditFacts(facts),trade=false;
 if(entry.type==='Purchase'){
  trade=true;const offer=lot?.audit?.price,price=saved?.unitPrice??offer?.unitPrice;
  body+='<h3>Purchase</h3>'+auditFacts([['Tons purchased',saved?.quantity==null?'Not recorded in this older entry':saved.quantity+' t'],['Purchase price per ton',cash(price)],['Goods cost',money(String(-A.credit(entry.amount)))],['Purchase broker fee',cash(saved?.fee??lot?.audit?.fee)],['Purchase insurance premium',cash(saved?.premium??lot?.audit?.premium)]]);
  body+='<p class="help">This bank entry pays for the goods. Broker fees and insurance premiums have separate ledger entries. Current cargo quantities may be lower after sales or losses.</p>';
  const priceData=saved?.priceAudit??offer?.audit;
  if(priceData)body+=priceAudit(priceData,price,commodity);else body+='<p class="help">The original price rolls and modifiers were not retained in this older entry.</p>';
 }else if(entry.type==='Sale'){
  trade=true;const a=entry.audit||{};
  body+='<h3>Sale calculation '+ruleInfo('profit')+'</h3>'+auditFacts([['Tons sold',a.quantity==null?'Not recorded':a.quantity+' t'],['Sale price per ton',cash(a.unitPrice)],['Gross sale proceeds',cash(a.gross??entry.amount)],['Cost basis of cargo sold',cash(a.basis)],['Sale broker fee',cash(a.fee)],['Sale tax',cash(a.tax)],['Profit / loss before profit adjustment',cash(a.afterTax)],['Profit retained setting',a.profitPercent==null?'Not recorded in this older sale':a.profitPercent+'%'],['Profit adjustment',cash(a.adjustment)],['Realized profit / loss',cash(a.adjusted)],['Net bank credit after sale charges',cash(a.bankDelta)]]);
  body+='<p class="help">This entry records gross proceeds. Fees, taxes and profit adjustments appear separately in the ledger. The cargo cost was paid earlier and is not deducted from the bank again.</p>';
  if(a.audit)body+=priceAudit(a.audit,a.unitPrice,commodity);
 }else if(entry.type==='Profit adjustment'){
  trade=true;body+='<h3>Retained trading profit '+ruleInfo('profit')+'</h3>'+auditFacts([['Positive profit retained',entry.percent==null?'Not recorded':entry.percent+'%'],['Profit after fees and tax',cash(details?.afterTax)],['Amount removed from profit',money(String(-A.credit(entry.amount)))],['Final realized profit / loss',cash(details?.adjusted)]])+'<p class="help">The profit setting reduces positive profit after fees and taxes. It does not reduce the gross sale price or soften a trading loss. This is a campaign adjustment, not another purchase or tax.</p>';
 }else if(entry.type==='Broker fee'){
  trade=true;body+='<h3>Broker payment '+ruleInfo('broker')+'</h3>'+auditFacts([['Fee paid',money(String(-A.credit(entry.amount)))],['Related transaction',related?.type||'Not recorded']])+'<p class="help">Purchase broker fees become part of the cargo cost basis. Sale broker fees reduce the realized sale profit.</p>';
 }else if(entry.type==='Tax'){
  trade=true;const a=entry.audit||{};
  body+='<h3>Sale tax '+ruleInfo('tax')+'</h3>'+auditFacts([['Tax paid for this lot',money(String(-A.credit(entry.amount)))],['Tax rate',a.rate==null?'Not recorded':a.rate+'%'],['Tax roll',a.dice?.dice?.length?a.dice.dice.join(' + ')+' = '+a.dice.total:'No tax dice recorded'],['Referee override',a.manual?'Yes':'No'],['Tax outcome',a.reason||'Calculated using the applicable bracket']])+'<p class="help">Tax is applied before the positive-profit adjustment.</p>';
 }else if(['Insurance premium','Insurance claim','Insurance amendment'].includes(entry.type)){
  body+='<h3>Insurance '+ruleInfo('insurance')+'</h3>'+auditFacts([['Coverage',p?p.coverage+'%':'Not recorded'],['Original insured goods value',cash(p?.insuredValue)],['Insured destination',world(p?.destination)?.name||'Not recorded'],['Recorded premium rate',p?.manual?'Referee-entered':p?.rate==null?'Not recorded':p.rate+'%'],['Insured distance',p?.distance==null?'Not recorded':p.distance+' parsecs'],['Travel zones',(p?.zones||[]).join(', ')||'Not recorded'],...(entry.quantity?[['Lost cargo',entry.quantity+' t'],['Cost basis written off',cash(entry.basisWrittenOff)]]:[])]);
  body+='<p class="help">'+(entry.type==='Insurance premium'?'The premium is paid once and added to cargo cost basis.':entry.type==='Insurance claim'?'This is the payment recorded after referee approval. Claim processing and timing are outside this tool.':'This records the premium change or refund for an amended policy.')+'</p>';
 }else if(entry.contractId){
  const c=state.contracts.find(c=>c.id===entry.contractId);
  const linkedPenalty=c?.kind==='freight'&&c.status==='delivered'&&c.late===true&&c.deliveredHours===entry.hours&&c.payout===entry.amount?c.penaltyDie:null;
  const penalty=entry.late?(entry.penaltyDie??linkedPenalty??'Not recorded'):'Not required';
  if(c?.kind==='passenger')body+='<h3>Passenger payment</h3>'+passengers.details(c);else body+='<h3>Delivery payment '+ruleInfo(c?.kind==='mail'?'mail':'freight-delivery')+'</h3>'+auditFacts([['Cargo description',c?.description||c?.kind||'Not recorded'],['Tons delivered',c?.quantity==null?'Not recorded':c.quantity+' t'],['Destination',world(c?.destination)?.name||'Not recorded'],['Agreed payment',cash(c?.payment)],['Payment received',cash(entry.amount)],['Late delivery',entry.late?'Yes':'No'],['Late-penalty roll',penalty]])+'';
 }else if(entry.type==='Opening bank')body+='<p class="help">The funds entered when this campaign was set up. This is starting money, not trading income.</p>';
 else if(entry.type==='Manual expense')body+='<p class="help">An operating expense entered by the player. It reduces the bank balance and is kept separate from cargo cost basis.</p>';
 else if(entry.type==='Referee bank correction')body+='<p class="help">A referee adjustment to the bank balance for the reason recorded above. It is not a cargo sale.</p>';
 else if(entry.type==='Rounding adjustment')body+='<p class="help">This records the bank change from applying the previewed rounding option. It is not trading profit.</p>';
 else body+='<p class="help">Recorded bank transaction. Additional historical calculation details are not available.</p>';
 if(trade)body+=tradeFootnotes();
 if(entry.roundingStep)body+=roundingFootnote([],entry.roundingStep);
 modal(entry.type+' details',body,null);
}
function depositForm(){
 modal('Record deposit',`${field('amount','Deposit amount - Cr','0','number','min="1" step="1"','credits')}${field('reason','Description / source','')}`,f=>{
  const amount=up(f.get('amount'),creditStep(state)),reason=String(f.get('reason')||'').trim();
  if(amount<=0n||!reason)throw Error('Positive deposit and description required');
  modal('Confirm deposit',auditFacts([['Deposit',money(amount)],['Description / source',reason],['Location',actual().name],['Bank before',money(state.bank)],['Bank after',money(A.credit(state.bank)+amount)]])+roundingFootnote([],creditStep(state)),()=>act('Manual deposit',s=>S.deposit(s,String(amount),reason)),'Deposit '+money(amount),true,{retainRounding:true,awaitSave:true});return false;
 },'Preview deposit');
}
function expenseForm(correction=false){modal(correction?'Referee bank correction':'Record expense',`${field('amount',correction?'Bank change · Cr (negative removes money)':'Expense · Cr','0','text','','credits')}${field('reason','Description / reason','')}`,f=>act(correction?'Bank correction':'Manual expense',s=>correction?S.bankCorrection(s,f.get('amount'),f.get('reason')):S.expense(s,f.get('amount'),f.get('reason'))));}
function fuelFields(){const f=state.ship.fuel&&{...state.ship.fuel,...fuelCapacities(state.ship)};return `<fieldset class="expense-choice"><legend>Ship size & fuel ${ruleInfo('bladders')}</legend><div class="split">${field('shipTons','Ship displacement - tons',f?.displacementTons??'','number','min="1" step="1"')}${field('fuelCapacity','Base fuel tank capacity - tons',f?.baseCapacityTons??f?.capacityTons??'','number','min="1" step="1"')}${field('bladderTons','Fuel bladder capacity - tons',f?.bladderTons??0,'number','min="0" step="1"')}${field('fuelAboard','Fuel aboard - tons',f?.aboardTons??'','number','min="0" step="1"')}</div><p id="fuel-settings-estimate" class="help" role="status"></p><p class="help">Empty bladders use no cargo space. Only fuel above the base tank capacity occupies cargo space; this space is freed as fuel is consumed. Base tanks fill first and bladder fuel is used first. Bladder hardware is accounted for in ship specifications, not charged against cargo here. Enter the maximum bladder capacity directly in tons. This capacity stays fixed when the hull size or jump rating changes. Set zero for no bladders. Installing capacity does not add fuel or change jump range.</p><p class="help">Enter ship size, base tank and fuel aboard to enable tracking. Ship displacement is the entire hull, separate from cargo capacity. Enter the total base tank capacity you want tracked, including any power-plant or small-craft allowance. Optional bladders are added separately. Power-plant and small-craft use are not tracked separately. Initial stock and corrections here do not charge the bank. Buy or collect fuel through Ship expenses.</p><p class="help rule-footnote">Jump fuel ${ruleInfo('jump-fuel')} · Leave all fields blank only when fuel tracking is not configured.</p></fieldset>`;}
function readFuel(f){const values=['shipTons','fuelCapacity','fuelAboard'].map(k=>String(f.get(k)??'').trim());if(values.every(v=>v==='')){if(Number(f.get('bladderTons')||0)!==0)throw Error('Enter ship displacement, fuel tank capacity and fuel aboard before adding bladder capacity.');return undefined;}if(values.some(v=>v===''))throw Error('Enter ship displacement, fuel tank capacity and fuel aboard together.');const fuel=configureFuel(Number(values[0]),Number(values[1]),Number(values[2]),Number(f.get('bladderTons')||0),Number(f.get('jump'))),hold=f.get('capacity'),previous=fuelCapacities(state.ship);if(A.cmp(fuel.bladderTons,hold)>0&&!(previous?.bladderTons===fuel.bladderTons&&A.cmp(hold,state.ship.capacity)>=0))throw Error('Fuel bladder capacity exceeds cargo hold capacity. Enter no more than '+A.decimal(hold)+' tons. Empty bladders still use no cargo space.');return fuel;}
function updateFuelSettingsEstimate(form=$('modal-form')){const el=form?.querySelector('#fuel-settings-estimate');if(!el)return;try{const f=readFuel(new FormData(form));el.textContent=f?'Fuel in bladders: '+bladderSpace({fuel:f})+' t of '+f.bladderTons+' t capacity. Total fuel capacity: '+f.capacityTons+' t. Empty bladders use no cargo space.':'Fuel tracking not configured.';}catch(e){el.textContent=e.message;}}
function nextFuel(){const to=world(state.route[state.routeIndex+1]);return to&&actual()?jumpFuel(state.ship,M.distance(actual(),to)):null;}
function suggestedFuel(full=false){const f=state.ship.fuel;if(!f)return 1;let q=null;try{q=nextFuel();}catch{}return full||!q?f.capacityTons-f.aboardTons:Math.max(0,q.tons-f.aboardTons);}
function fuelPlanning(){if(!state.ship.fuel)return '<p class="help">Set ship displacement, tank capacity and fuel aboard in Ship settings to calculate and track jump fuel. Until configured, fuel expenses record payments only.</p>';const f=state.ship.fuel;let next='No next jump planned.';try{const q=nextFuel();if(q)next='Next jump: '+q.distance+' pc; '+q.displacementTons+' tons x 10% x '+q.distance+' = '+q.tons+' tons required. Need to acquire '+Math.max(0,q.tons-q.before)+' tons.'+(q.tons>f.capacityTons?' This jump needs more fuel than the tank can hold.':'');}catch(e){next=e.message;}return '<p>'+f.aboardTons+' / '+f.capacityTons+' tons aboard. '+esc(next)+'</p><div class="row">'+btn('Fuel for next jump','fuel-next')+btn('Fill tank','fuel-fill')+'</div><p class="help rule-footnote">Jump fuel '+ruleInfo('jump-fuel')+'</p>';}
function setFuelQuantity(full){const q=full?suggestedFuel(true):(nextFuel()?suggestedFuel():null);if(q===null)throw Error('Plan the next jump first.');$('modal-form').elements.fuelTons.value=q;updateExpenseEstimate();}
function supportFields(){const q=supportStock(passengerShip(state));return field('supportCapacity','Standard refill target · days',q.targetDays,'number','min="1" step="1"')+field('supportRemaining','Recorded endurance · days',q.remainingDays??q.legacyDays??0,'number','min="0" step="any"')+field('supportUnits','Set actual LSS aboard (optional; overrides days)','','number','min="0" step="any"')+'<p class="help">'+(q.remainingUnits==null?'Legacy recorded days need a confirmed complement or actual LSS count.':supportDisplay(q.stockUnits)+' LSS aboard. Endurance changes with the complement; saving unchanged days preserves those units.')+' '+(q.internalCapacityUnits==null?'Enter hull displacement to determine physical storage.':'Internal capacity: '+q.internalCapacityUnits+' LSS. Overflow: '+q.cargoTons+' t.')+'</p>';}
function readSupport(f,ship){
 const target=Number(f.get('supportCapacity')),remaining=String(f.get('supportRemaining')??'').trim(),units=String(f.get('supportUnits')??'').trim(),old=supportStock(passengerShip(state));
 if(!Number.isSafeInteger(target)||target<1)throw Error('Enter a positive whole-day standard refill target.');
 const options={targetDays:target};
 if(units!=='')options.stockUnits=units;
 else if(!state.ship.lifeSupport||remaining!==String(old.remainingDays??old.legacyDays??0)){if(remaining==='')throw Error('Enter recorded days or actual LSS aboard.');options.stockDays=remaining;}
 return configureSupport(passengerShip({...state,ship}),options);
}
function refillSupport(){if(!state.ship.lifeSupport){services.close();settings();return;}inputRounding=[];services.open('support');}
function totalAboard(a){return ['passengers','crew'].reduce((n,role)=>n+tiers.reduce((v,t)=>v+(a[role]?.[t]??0),0),0);}
function accommodationFields(){
 const a=occupants(state.ship),rooms=roomCounts(state.ship);
 return `<fieldset class="expense-choice"><legend>Cabins & people aboard ${ruleInfo('support-cost')}</legend>
 <h3>All installed cabins — crew and passengers combined</h3><p class="help">Count each cabin once, including empty cabins. These are cabin totals, not passenger numbers. Service levels determine the cabin charge.</p>
 ${tiers.map(t=>`<div class="split">${field('rooms-'+t,t[0].toUpperCase()+t.slice(1)+' service · cabins',rooms[t],'number','min="0" step="1"')}${select('roomService-'+t,'Cabin running-cost rate',[['low','Low · Cr100/month (campaign)'],['middle','Standard · Cr1,000/month'],['high','High cabin · Cr1,000/month'],['custom','Custom monthly cost']],state.ship.accommodation?.roomService?.[t]?.level??t)}${field('roomCustom-'+t,'Custom Cr/cabin/month',state.ship.accommodation?.roomService?.[t]?.monthly??E.supportRates[t],'number','min="0" step="1"','credits')}</div>`).join('')}
 <h3>Awake people aboard (including crew)</h3>${passengerTotals(state).total?'<p class="notice">These editable counts exclude the '+passengerTotals(state).total+' automatically booked passengers. Do not enter booked people twice. Review reserved crew cabins in Freight/Mail if this allocation changes.</p>':''}${field('people-middle','Awake people — Middle?',totalAboard(a)-(a.passengers?.high??0)-(a.crew?.high??0),'number','min="0" step="1"')}${field('people-high','Awake people — High?',(a.passengers?.high??0)+(a.crew?.high??0),'number','min="0" step="1"')}${field('occupiedLowBerths','Actual occupied low berths',state.ship.accommodation?.occupiedLowBerths??0,'number','min="0" step="1"')}<p class="help">Count frozen people only in occupied low berths, never in awake Middle/High counts. Crew are included once in their awake service group. Low-service cabin billing does not identify frozen occupants. People are counted separately from cabins. Middle service costs Cr1,000 per person/month; high service costs Cr3,000. Include upgraded middle-cabin occupants in the high-service count. Enter each person in one group only. The total is calculated as middle + high; for example, 4 middle + 2 high = 6 people. Sharing a cabin does not add cabins.</p>
 <p class="help">Default cargo reservation: High passengers × 1 ton. Middle passengers reserve no cargo space under your campaign rule.</p>${check('luggageOverride','Override total luggage tons',manualLuggage(state.ship))}${field('luggageTons','Total luggage · tons (automatic unless overridden)',state.ship.accommodation?.luggageTons??'0','number','min="0" step="1"','tons')}<p class="help">Leave the override off for the default. Two High passengers reserve 2 tons, deducted from available cargo. An override is a total, not a per-person multiplier.</p>
 <div id="luggage-estimate" role="status" aria-live="polite"></div><h3>Life support supplies</h3>${supportFields()}<p class="help">The standard refill target defaults to 28 days. Physical stock is measured in LSS: 1 per awake person/day, 0.1 per occupied low berth/day. Hourly consumption is exact. Changing the complement preserves supplies and recalculates endurance. Enter actual LSS to correct inventory, or edit recorded days to set it at the entered complement. Hull storage holds 4 LSS per ton; overflow reserves 0.01 cargo tons per LSS. Empty supplies warn; survival effects are resolved by the referee.</p>
 <div id="accommodation-estimate" aria-live="polite"></div>
 <details><summary>Cabin charges — rules & campaign assumptions</summary><p>Campaign rule agreed 2026-10-04: middle and high cabins cost Cr1,000/month each, occupied or empty. Middle-service people cost Cr1,000/month. <strong>Campaign change: High-passenger life support is raised from the Core Rulebook’s Cr1,000 to Cr3,000 per person per month.</strong> This includes crew receiving high service and upgraded middle-cabin occupants. Crew and passengers are combined. Custom cabin rates replace only the cabin charge.</p><p>Core Rulebook Update 2022, pp. 154, 158, 184 and 238; High Guard Update 2022, p. 51. High Guard lists Cr3,000/month for a high stateroom; the campaign uses Cr1,000/month per high cabin. Separately, the Core Rulebook’s normal life-support charge is Cr1,000/month per person; this campaign raises it to Cr3,000/month for each person receiving high service. RAW high passage reserves 1 cargo ton per passenger. Campaign luggage reserves only high-service people at the editable allowance; middle service reserves none.</p><p>Low-service cabin Cr100 and low-service person Cr1,000 remain campaign settings. RAW low berths instead cost Cr100 per occupied berth and exclude frozen occupants from the normal per-person charge. Monthly billing and quarter-month weekly billing are retained; past payments do not change.</p></details></fieldset>`;
}
function readAccommodation(f){
 const middle=Number(f.get('people-middle')),high=Number(f.get('people-high')),occupiedLowBerths=Number(f.get('occupiedLowBerths')||0);if(!Number.isSafeInteger(occupiedLowBerths)||occupiedLowBerths<0)throw Error('Occupied low berths must be a non-negative whole number.');
 if(!Number.isSafeInteger(middle)||middle<0||!Number.isSafeInteger(high)||high<0||!Number.isSafeInteger(middle+high))throw Error('Middle and high service counts must be non-negative whole numbers.');
 if(f.has('luggageOverride')&&A.cmp(f.get('luggageTons'),0)<0)throw Error('Luggage override must be zero or more.');
 const groups={passengers:{low:0,middle,high},crew:{low:0,middle:0,high:0}};
 return {...state.ship.accommodation,...groups,occupiedLowBerths,combinedPeople:true,rooms:Object.fromEntries(tiers.map(t=>[t,Number(f.get('rooms-'+t))])),roomService:Object.fromEntries(tiers.map(t=>[t,{level:f.get('roomService-'+t),monthly:f.get('roomCustom-'+t)??String(E.supportRates[t])}])),luggageMode:f.has('luggageOverride')?'manual':'auto',luggageTons:f.has('luggageOverride')?String(up(f.get('luggageTons'))):String(high)};
}
function updateAccommodationEstimate(form=$('modal-form')){
 const estimate=id=>form?.querySelector('#'+id);
 // Other dialogs also have a mode selector (for example insurance actions).
 const profitMode=form?.elements.mode,customProfit=form?.elements.custom;
 if(profitMode&&customProfit)customProfit.disabled=profitMode.value!=='custom';
 if(!estimate('accommodation-estimate'))return;
 form.elements.luggageTons.disabled=!form.elements.luggageOverride.checked;if(!form.elements.luggageOverride.checked){const high=Number(form.elements['people-high'].value);form.elements.luggageTons.value=Number.isSafeInteger(high)&&high>=0?String(high):'';}for(const t of tiers)form.elements['roomCustom-'+t].disabled=form.elements['roomService-'+t].value!=='custom';
 try{
  const f=new FormData(form),a=readAccommodation(f),anchored=structuredClone(state.ship);anchorSupport(anchored,{complementShip:passengerShip(state)});const rawShip={...anchored,accommodation:a,fuel:readFuel(f),roundTons:true};rawShip.lifeSupport=readSupport(f,rawShip);const ship=passengerShip({...state,ship:rawShip}),effective=ship.accommodation;const luggage=passengerLuggage(ship),other=A.sub(S.used(state),A.sum([passengerLuggage(passengerShip(state)),bladderSpace(state.ship),supportCargo(passengerShip(state))])),available=A.sub(f.get('capacity'),A.sum([other,luggage,bladderSpace(ship),supportCargo(ship)]));
  if(!form.elements.luggageOverride.checked)form.elements.luggageTons.value=luggage;
  estimate('luggage-estimate').textContent='Luggage reserved: '+luggage+' tons'+(a.luggageMode==='manual'?' (total override)':passengerTotals(state).total?' (booked allowances included automatically)':' = '+a.passengers.high+' High passengers × 1 ton')+'. Cargo space remaining: '+supportDisplay(available)+' tons.';
  const monthly=tiers.reduce((n,t)=>n+BigInt((effective.passengers[t]??0)+(effective.crew[t]??0))*BigInt(personRate(t)),0n)+BigInt(passengerTotals(state).low)*100n,roomMonthly=tiers.reduce((n,t)=>n+BigInt(a.rooms[t])*BigInt(serviceRate(t,a.roomService[t])),0n);
  estimate('accommodation-estimate').textContent=roomTotal(ship)+' total cabins ('+a.rooms.low+' low, '+a.rooms.middle+' middle, '+a.rooms.high+' high) · '+totalAboard(effective)+' total people · Cabin charges: '+money(roomMonthly)+' / month · People life support: '+money(monthly)+' / month · Combined: '+money(roomMonthly+monthly)+' / month · Luggage: '+luggage+' t'+(a.luggageMode==='manual'?' (total override)':passengerTotals(state).total?' (booked allowances included)':' ('+a.passengers.high+' High × 1 t)')+' · Cargo space remaining: '+supportDisplay(available)+' t';
 }catch{estimate('accommodation-estimate').textContent='Enter valid counts and cargo capacity.';estimate('luggage-estimate').textContent='Enter valid passenger counts and cargo capacity.';}
}
function readMortgage(f){return configureMortgage({originalAmount:f.get('mortgageOriginal')??'',payment:f.get('mortgagePayment')??'',remainingPayments:f.get('mortgageRemaining')??'',totalPaid:f.get('mortgagePaid')??'',nextDueDate:f.get('mortgageDueDate')??''},state.ship.mortgage);}
function readMaintenance(f){return configureMaintenance({payment:f.get('maintenancePayment')??'',nextDueDate:f.get('maintenanceDueDate')??''},state.ship.maintenance);}
function mortgageFields(){
 const m=state.ship.mortgage,numeric='inputmode="numeric" pattern="[0-9]+"';
 return `<fieldset class="expense-choice"><legend>Mortgage ${ruleInfo('mortgage')}</legend><div class="split">${field('mortgageOriginal','Original mortgage amount · Cr',m?.originalAmount??'','text',numeric)}${field('mortgagePayment','Fixed payment · Cr every 4 weeks',m?.payment??'','text',numeric)}${field('mortgageRemaining','Payments remaining',m?.remainingPayments??'','number','min="0" step="1" placeholder="480 for a new mortgage"')}${field('mortgagePaid','Total paid so far · Cr',m?.totalPaid??'','text',numeric)}${field('mortgageDueDate','First / next unpaid payment due',m?.nextDueDate??'','text','placeholder="029-1105"')}</div><p id="mortgage-settings-summary" class="help" role="status"></p><p id="mortgage-settings-help" class="help">A new mortgage normally has 480 payments, each original amount ÷ 240. Enter the actual remaining count and prior total paid for an existing ship; use 0 paid for a new loan. Four-week (28-day) payment intervals are a campaign rule. These figures track scheduled payments, not principal or equity. Saving does not charge the bank. Pay through Ship expenses. Fixed amounts are unaffected by Credit rounding. Leave all five fields blank for no mortgage tracking.</p></fieldset>`;
}
function maintenanceFields(){
 const m=state.ship.maintenance;
 return `<fieldset class="expense-choice"><legend>Monthly maintenance ${ruleInfo('maintenance')}</legend><div class="split">${field('maintenancePayment','Maintenance · Cr every 4 weeks',m?.payment??'','text','inputmode="numeric" pattern="[0-9]+"')}${field('maintenanceDueDate','First / next unpaid maintenance due',m?.nextDueDate??'','text','placeholder="029-1105"')}</div><p id="maintenance-settings-summary" class="help" role="status"></p><p id="maintenance-settings-help" class="help">A fixed cost every 4 weeks (28 days), with its own payment schedule. Pay one or more periods ahead through Ship expenses. No annual overhaul, penalties or automatic charges are simulated. Saving does not charge the bank. Fixed costs are unaffected by Credit rounding. Leave both fields blank for no maintenance tracking.</p></fieldset>`;
}
function updateRecurringSettings(form=$('modal-form')){
 for(const kind of ['mortgage','maintenance']){
  const el=form?.querySelector('#'+kind+'-settings-summary');if(!el)continue;
  const names=kind==='mortgage'?['mortgageOriginal','mortgagePayment','mortgageRemaining','mortgagePaid','mortgageDueDate']:['maintenancePayment','maintenanceDueDate'];
  const fields=names.map(name=>form.elements.namedItem(name)),configured=fields.some(field=>field.value.trim()!=='');
  fields.forEach(field=>field.required=configured);
  try{
   const m=kind==='mortgage'?readMortgage(new FormData(form)):readMaintenance(new FormData(form));
   if(!m){el.textContent=kind==='mortgage'?'Mortgage tracking not configured.':'Monthly maintenance not configured.';continue;}
   el.textContent=kind==='mortgage'?'Remaining scheduled payments: '+money(String(A.credit(m.payment)*BigInt(m.remainingPayments)))+' ('+m.remainingPayments+' × '+money(m.payment)+'). Original ÷ 240: '+money(String(up(A.div(m.originalAmount,240))))+' per payment, rounded up to whole Credits.':'Recorded maintenance paid since tracking: '+money(m.paidSinceTracking)+'.';
   if(m.lastPaidDueDate)el.textContent+=' Paid through installment due '+m.lastPaidDueDate+'.';
  }catch(error){el.textContent=error.message;}
 }
}
function settingsFields(){return `<div class="split">${field('name','Campaign',state.name)}${field('ship','Ship name',state.ship.name)}${field('capacity','Cargo capacity · tons',state.ship.capacity,'text','','tons')}${field('jump','Jump rating',state.ship.jump,'number','min="1" max="6"')}${field('broker','Broker skill',state.trader.broker,'number','step="1"')}${field('streetwise','Streetwise skill',state.trader.streetwise,'number','step="1"')}${field('admin','Admin skill',state.trader.admin,'number','step="1"')}${field('characteristic','Default EDU / SOC DM',state.trader.characteristic,'number','step="1"')}${field('rank','Highest Naval / Scout rank',state.trader.rank,'number','min="0" step="1"')}${field('soc','Highest SOC DM',state.trader.soc,'number','step="1"')}${select('mode','Profit mode',[['100','RAW · 100%'],['75','Reduced · 75%'],['custom','Custom']],state.settings.profit===75||state.settings.profit===100?String(state.settings.profit):'custom')}${field('custom','Custom profit % — only used in Custom mode',state.settings.profit,'number','min="0" max="100" step="any"')}</div>${fuelFields()}${accommodationFields()}${mortgageFields()}${maintenanceFields()}${select('creditStep','Credit rounding for new entries',[['1','Up to whole Credits'],['100','Up to Cr100']],creditStep(state))}${check('scoops','Fuel scoops fitted',state.ship.scoops)}${check('armed','Ship is armed (mail modifier)',state.ship.armed)}${check('reducedProfitLimitsEnabled','Enable reduced-profit price limits',state.settings.reducedProfitLimitsEnabled)}<div class="split">${field('minPurchasePercent','Minimum buy · % of base retail',state.settings.minPurchasePercent??85,'number','min="0" max="400" step="1" required')}${field('maxSalePercent','Maximum sell · % of base retail',state.settings.maxSalePercent??115,'number','min="0" max="400" step="1" required')}</div><p class="help">Minimum buy is a purchase-price floor; maximum sell is a sale-price ceiling, before broker fees. Whole percentages 0–400, in one-point steps. Values stay editable and are retained while off. Applies to new quotes; saved offers retain their prices. This option is independent of profit mode and the base retail cap.</p>${check('maxBaseRetailEnabled','Cap commodity base retail price',state.settings.maxBaseRetailEnabled)}${field('maxBaseRetail','Maximum base retail · Cr / ton',state.settings.maxBaseRetail??'100000','number','min="1" step="1"','credits')}${check('useRawIllegalPrices','Use original RAW base prices for illegal goods',state.settings.useRawIllegalPrices)}${check('tax','Enable optional Merchant Prince taxes',state.settings.tax)}${check('insurance','Enable optional Merchant Prince cargo insurance',state.settings.insurance)}<p class="help">The retail cap changes the base price used before normal Traveller buy/sell percentages. Final sale prices may exceed the cap. The illegal-goods option bypasses the cap only for goods treated as illegal. Options affect future transactions. Turning cargo insurance off hides new-coverage controls. Existing policies, claims and amendments remain available; closed policies stay in History.</p>`;}
function saveSettings(f,expected,announce=true,onPrepared){return act('Ship / trader settings',s=>{S.setMortgage(s,readMortgage(f));S.setMaintenance(s,readMaintenance(f));s.name=f.get('name');s.ship={...s.ship,name:f.get('ship'),capacity:A.decimal(f.get('capacity')),staterooms:roomTotal({accommodation:readAccommodation(f)}),accommodation:readAccommodation(f),fuel:readFuel(f),roundTons:true,jump:Number(f.get('jump')),scoops:f.has('scoops'),armed:f.has('armed')};s.ship.lifeSupport=readSupport(f,s.ship);for(const key of ['broker','streetwise','admin','characteristic','rank','soc']){const n=Number(f.get(key));if(!Number.isInteger(n))throw Error('Skills and DMs must be whole numbers');s.trader[key]=n;}const maxBaseRetail=Number(f.get('maxBaseRetail'));if(!Number.isFinite(maxBaseRetail)||maxBaseRetail<=0)throw Error('Maximum base retail must be a positive number');s.settings={...s.settings,...R.priceLimits({reducedProfitLimitsEnabled:f.has('reducedProfitLimitsEnabled'),minPurchasePercent:f.get('minPurchasePercent'),maxSalePercent:f.get('maxSalePercent')}),creditStep:Number(f.get('creditStep')),profit:Number(f.get('mode')==='custom'?f.get('custom'):f.get('mode')),maxBaseRetailEnabled:f.has('maxBaseRetailEnabled'),maxBaseRetail:String(Math.ceil(maxBaseRetail)),useRawIllegalPrices:f.has('useRawIllegalPrices'),tax:f.has('tax'),insurance:f.has('insurance')};},expected,{announce,onPrepared});}
function settings(){
 if(settingsOperation?.pending||activeModal?.awaitSave&&activeModal.busy)return false;
 const owner={inline:false,revision:state.revision,form:null,session:null,pending:false,invalidated:false,publication:null,publicationDeferred:false};
 const opened=modal('Ship, trader & options',settingsFields(),f=>completeSettingsWrite(owner,f),'Save',true,{awaitSave:true,saveName:'Settings',saveContext:'settings-save'});
 if(opened===false)return false;
 owner.session=activeModal;owner.form=$('modal-form');owner.rounding=inputRounding;owner.session.settingsOwner=owner;settingsOperation=owner;
 updateAccommodationEstimate();updateFuelSettingsEstimate();updateRecurringSettings();
}
function timeForm(){
 if(timeWriteOperation?.pending)return false;
 let owner;const opened=modal('Campaign time',`${field('date','Starting Imperial date · day-year',state.dateLabel)}${field('hours','Total elapsed hours from starting date',state.hours,'number','min="0" step="1"')}${field('reason','Reason for time change','')}`,f=>{
  try{if(!f.get('reason').trim())throw Error('Reason required');parseDate(f.get('date'));}catch(error){throw new SaveNotCommittedError(error);}
  return completeTimeWrite(owner,'Time correction: '+f.get('reason'),s=>{s.dateLabel=f.get('date');s.hours=Number(f.get('hours'));});
 },'Save',true,{saveName:'Time correction',saveContext:'time-save'});
 if(opened===false)return false;
 owner=createTimeWriteOwner(activeModal);
}
function notes(){modal('Rules & Notes',`<div class="notes-list"><article><h3>Rules and verification</h3><p>UI 2026.10.10.48 · rules data ${R.VERSION} · reference catalogue ${REFERENCE_VERSION}. Source checks and runtime test results, with their applicable revisions and scope, are recorded in the public verification record.</p><p>Traveller Core Rulebook Update 2022, examined copyright 2024 revision. Book 7: Merchant Prince (Mongoose Traveller First Edition, 2010), insurance pp.82–83, taxation pp.86–87 (table p.87). Cluster Truck (Mongoose Publishing, ©2026), physical life-support supplies p.14. Optional first-edition adaptations are off by default.</p><p><a href="${ROOT}RULES_VERIFICATION.md" target="_blank" rel="noopener">Rules verification status and evidence</a> · <a href="${ROOT}rules/README.md" target="_blank" rel="noopener">Sources and worked examples</a></p></article><article><h3>Calculation references</h3><p>Published rules, Home rules, App conventions and Referee inputs are labelled separately. References explain the current policy; saved audits retain their recorded terms and missing evidence.</p>${referenceIndex()}</article><article><h3>House rules</h3><p>Each departure allows one jump mulligan before any later campaign change. Undo Jump returns to the origin and restores the pre-jump state. Reopening or reloading keeps saved jump dice; the mulligan permits one fresh roll and cannot be reset by Undo. On new purchase and sale price rolls, exactly two matching natural dice flag Complication; three matching dice flag Severe complication. The GM decides the issue and consequences. These flags do not change time, prices or cargo. Entered totals without natural dice are unknown; historical quotes are not flagged retroactively.</p><p>RAW retains 100% of positive actual profit; Reduced retains 75%; Custom accepts 0–100%. A configurable maximum commodity base retail value may be applied before normal purchase/sale percentage modifiers; final prices may exceed the cap. Illegal goods can optionally retain their original RAW base prices. Independent reduced-profit price limits optionally floor purchase percentages (default 85%) and ceiling sale percentages (default 115%) before broker fees, using the applicable base retail. Whole percentages 0–400 are retained when off. Existing offers and explicit referee price overrides retain their recorded terms. Tax is deducted first. Losses are unchanged by the profit setting. Each lot is adjusted separately. New monetary amounts round up to whole Credits, or Cr100 when enabled; new tons round up to whole tons. The Settings rounding button previews changes to existing values before applying them. Historical transactions are retained. Operating expenses remain separate.</p></article>${decisions.map(d=>`<article id="${esc(d.id)}"><h3>${esc(d.id)} · ${esc(d.topic)}</h3><p>${esc(d.conclusion)}</p>${d.id==='INT-021'?'<p class="help">Historical decision: later campaign rounding uses upward rounding for new final charges. Partial cost-basis allocation remains separate; saved amounts are not rewritten. '+ruleInfo('rounding')+'</p>':''}<p class="help">Agreed ${esc(d.date)} · revision ${d.revision}</p></article>`).join('')}<article><h3>Copyright and credits</h3><p>Traveller and the source publications are owned by Mongoose Publishing and their respective rights holders. This is an unofficial campaign tool, not a publisher-endorsed product. Rulebook PDFs, scans and descriptive source prose are not distributed with this tool.</p><p>Live world data: <a href="https://travellermap.com" target="_blank" rel="noopener">Traveller Map</a>. Source and calculation references are retained for review. The existing spec-trade tool is not a rules authority.</p></article><article><h3>Calendar and map era</h3><p>World data stays in the M1105 era. The campaign starts at its chosen Imperial day-year date, default 001-1105, and advances in 24-hour days and 365-day years as searches and jumps consume time. Advancing the campaign year never switches map eras. The +1 day control advances 24 hours and consumes life support. The -1 day control corrects the date without restoring supplies or reversing transactions; it cannot go before the campaign start. Both actions appear in History. Use Undo to reverse an accidental advance and restore supplies together. Browsing, route previews and setting a starting world do not advance time.</p></article><article><h3>About your data</h3><p>Your campaign stays in this browser’s local storage. Export JSON backups to keep a portable copy. Traveller Map requests disclose the worlds/sectors being requested; campaign bank and cargo data are not sent to it. Route searches cover a bounded loaded area. Route previews do not consume fuel; committed jumps track configured jump fuel under the campaign rules.</p></article></div>`,null);}
// Replacement owns completion separately from ordinary local saves: its
// publication still invalidates every old campaign offer and service session.
function invalidateReplacementReview(){
 const owner=replacementReview;if(!owner)return;
 owner.invalidated=true;owner.publicationDeferred=false;if(owner.session)owner.session.cancelled=true;
 if(activeModal===owner.session&&$('modal').open){
  $('modal-error').textContent=campaignReloadRequired?campaignReloadMessage:'Campaign or editing ownership changed. Close and review the replacement again.';
  syncModalSubmit();
 }
}
function invalidateReplacementEditing(){editingLossEpoch++;invalidateReplacementReview();}
function assertReplacementReady(session=null){
 if(replacementReview?.pending&&replacementReview.session!==session)throw new SaveNotCommittedError(Error('Wait for the current campaign replacement to finish.'));
 if(campaignReloadRequired)throw new SaveNotCommittedError(Error('Reload this page before editing the campaign again.'));
 if(!store?.editable)throw new SaveNotCommittedError(Error('This tab is read-only. Take over editing first.'));
 if(activeModal?.awaitSave&&activeModal.busy&&activeModal!==session)throw new SaveNotCommittedError(Error('Wait for the current campaign save to finish.'));
 if(services.active())throw new SaveNotCommittedError(Error('Finish or cancel the open ship service before replacing the campaign.'));
}
function saveReplacement(owner,next,form){
 assertReplacementReady(owner.session);
 if(replacementReview!==owner||owner.invalidated||!modalCurrent(owner.session))throw new SaveNotCommittedError(Error('Campaign changed. Close and review the replacement again.'));
 if(owner.pending)return false;
 if(!form.has('backed'))throw new SaveNotCommittedError(Error('Export a backup or explicitly choose to proceed without one'));
 owner.pending=true;owner.publication=null;
 const release=()=>{owner.pending=false;owner.publicationDeferred=false;};
 const fail=error=>{
  // An observed durable publication outranks a contradictory provider failure.
  if(owner.publication&&error?.code!=='SAVE_COMMITTED_PUBLICATION_FAILED')error=new SaveCommittedPublicationError(owner.revision+1,error);
  release();throw error;
 };
 const finish=()=>{
  try{
   const published=owner.publication;
   if(!published||published.revision!==owner.revision+1)throw Error('Campaign replacement completion did not publish the expected campaign.');
   owner.session.savedRevision=published.revision;
   if(owner.invalidated||!store?.editable||replacementReview!==owner||!modalCurrent(owner.session)||state!==published)return false;
   owner.publicationDeferred=false;
   try{known={...published.worlds};view=published.actual;selected.clear();contractDrafts=[];mailCheck=null;syncMailCheck();render();message('Campaign replaced.');}
   catch(cause){throw new SaveCommittedPublicationError(published.revision,cause);}
  }catch(error){return fail(error);}finally{release();}
 };
 let result;try{result=campaignWrites.replace(next,owner.revision);}catch(error){return fail(error);}
 return result&&typeof result.then==='function'?Promise.resolve(result).then(finish,fail):finish();
}
function backupReplace(title,next){
 if(replacementReview?.pending||activeModal?.awaitSave&&activeModal.busy)return false;
 assertReplacementReady();
 const owner={revision:state.revision,session:null,pending:false,invalidated:false,publication:null,publicationDeferred:false};
 const opened=modal(title,`<p class="notice">This replaces the current campaign in this browser. Export a backup before continuing.</p><div class="wide-actions">${btn('Export current backup','export')}</div>${check('backed','I saved a backup, or explicitly choose to proceed without one')}<p class="help">Cancel keeps the current campaign. The replacement is validated before it is saved.</p>`,f=>saveReplacement(owner,next,f),'Replace campaign',true,{awaitSave:true,saveName:'Campaign replacement',saveContext:'campaign-replace',annotateRounding:false});
 if(opened===false)return false;
 owner.session=activeModal;replacementReview=owner;
}
async function importCampaignFile(e){
 // File reading is not a campaign write. A late read (including its error)
 // must not open a review on a newer campaign, dialog or editing tenure.
 const request={};importRead=request;
 const file=e.target.files[0];e.target.value='';if(!file)return;
 assertReplacementReady();
 const publication=campaignPublicationEpoch,generation=modalGeneration,editing=editingLossEpoch;
 const current=()=>importRead===request&&campaignPublicationEpoch===publication&&modalGeneration===generation&&editingLossEpoch===editing&&store?.editable&&!campaignReloadRequired;
 if(file.size>20000000)throw Error('Import exceeds the 20 MB review limit');
 let text;try{text=await file.text();}catch(error){if(current())throw error;return;}
 if(!current())return;
 const data=S.validate(JSON.parse(text));backupReplace('Load campaign (JSON)',data);
}
function zoomMap(factor,reset=false){
 worldNearbyRequest=null;
 scheduleMapAreas();const previousZoom=mapZoom;mapZoom=reset?1:nextMapZoom(mapZoom,factor);
 mapPan=reset?{x:0,y:0}:{x:mapPan.x*mapZoom/previousZoom,y:mapPan.y*mapZoom/previousZoom};
 if(!mapZoomFrame)mapZoomFrame=requestAnimationFrame(()=>{mapZoomFrame=0;const action=document.activeElement?.dataset.action;render();if(action?.startsWith('map-zoom-'))document.querySelector('[data-action="'+action+'"]')?.focus({preventScroll:true});});
}
function setLocation(w){
 if(worldWriteOperation?.pending||activeModal?.awaitSave&&activeModal.busy)return false;
 worldNearbyRequest=null;
 if(typeof w==='string')w=world(w);
 if(!w)throw Error('Choose a world first');
 if(w.id===state.actual){view=w.id;return refreshWorldNearby(w);}
 const from=actual();let owner;
 const opened=modal('Set ship location',`<p>Use <strong>${esc(w.name)}</strong> · ${esc(w.sector)} · Hex ${esc(w.hex)} as the ship’s actual location?</p><p class="notice">This sets or corrects your starting position. It does not simulate a jump or advance time. The current route will be cleared. Bank, cargo and contract payments stay unchanged. Active insurance will require a route amendment.</p>${field('reason','Reason',state.hours===0&&state.lots.length===0?'Choose campaign starting world':'')}`,async f=>{
  beginWorldWriteLookup(owner);
  const reason=f.get('reason').trim();let neighbors;
  try{if(!reason)throw Error('Enter a reason for changing the ship location.');neighbors=await M.nearby(w,12);if(!worldWriteOwnerCurrent(owner))return false;}
  catch(error){if(!worldWriteOwnerCurrent(owner))return false;throw new SaveNotCommittedError(error);}
  neighbors.forEach(x=>known[x.id]=x);
  return completeWorldWrite(owner,'Ship location set: '+w.name,s=>{s.worlds[w.id]=w;s.actual=w.id;s.route=[w.id];s.routeIndex=0;s.mandatoryStops=[];s.events.push({id:S.uid(),label:'Starting-world / location correction',from:from?.id||null,to:w.id,reason,hours:s.hours});for(const p of s.policies.filter(p=>p.status==='active'))p.status='amendment-required';},()=>{view=w.id;contractDrafts=[];mailCheck=null;passengers.clear();});
 },'Confirm starting world',true,{saveName:'Ship location',saveContext:'location-save'});
 if(opened===false)return false;
 owner=createWorldWriteOwner(activeModal);
}
function paintMap(){
 // Background map callbacks must respect the same owned-publication boundary
 // as render(), including ship/route markers drawn from the installed state.
 if(worldWriteOperation?.publicationDeferred&&!worldWriteOperation.invalidated)return;
 if(undoOperation?.pending&&undoOperation.publicationDeferred&&!undoOperation.invalidated)return;
 if(replacementReview?.pending&&replacementReview.publicationDeferred&&!replacementReview.invalidated)return;
 if(mapDrag||tab!=='Overview')return;
 const old=document.querySelector('.world-map');if(!old||!viewed())return;
 const holder=document.createElement('div');holder.innerHTML=mapPanel();
 old.replaceWith(holder.querySelector('.world-map'));
 const sources=mapLevel(mapZoom)==='world'?[mapAreas,...(showTerritories?[mapOverview]:[])]:[mapOverview];
 const status=$('map-load-status');if(status)status.textContent=sources.some(s=>s.error)?' Some map data could not load. Use Refresh nearby to retry.':sources.some(s=>s.pending)?' Loading map data…':'';
}
function requestMapAreas(){
 if(tab!=='Overview'||!viewed()||mapDrag)return;
 mapOverview.request(viewed(),mapPan,mapZoom,showTerritories);
 mapAreas.request(mapLevel(mapZoom)==='world'?viewportTiles(viewed(),mapPan,mapZoom):[]);
}
function scheduleMapAreas(){
 clearTimeout(mapLoadTimer);mapLoadTimer=setTimeout(requestMapAreas,250);
}
// Move only the map layer during dragging, preserving pointer capture and the rest of the UI.
function mapPosition(svg,event){return new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());}
document.addEventListener('pointerdown',e=>{
 suppressMapClick=false;
 const svg=e.target.closest?.('.world-map');
 if(!svg||e.button!==0||!e.isPrimary||$('modal').open)return;
 mapDrag={svg,id:e.pointerId,start:mapPosition(svg,e),clientX:e.clientX,clientY:e.clientY,pan:{...mapPan},moved:false};
});
document.addEventListener('pointermove',e=>{
 const d=mapDrag;if(!d||d.id!==e.pointerId)return;
 if(!d.svg.isConnected){mapDrag=null;return;}
 if(!d.moved&&Math.hypot(e.clientX-d.clientX,e.clientY-d.clientY)<5)return;
 if(!d.moved){d.moved=true;d.svg.setPointerCapture(e.pointerId);d.svg.classList.add('panning');}
 e.preventDefault();const p=mapPosition(d.svg,e);
 mapPan={x:d.pan.x+p.x-d.start.x,y:d.pan.y+p.y-d.start.y};
 d.svg.querySelector('.map-content').setAttribute('transform','translate('+mapPan.x+' '+mapPan.y+')');
},{passive:false});
function finishMapDrag(e){
 const d=mapDrag;if(!d||d.id!==e.pointerId)return;
 suppressMapClick=d.moved;d.svg.classList.remove('panning');mapDrag=null;
 if(d.svg.hasPointerCapture(e.pointerId))d.svg.releasePointerCapture(e.pointerId);
 if(d.moved){scheduleMapAreas();requestAnimationFrame(paintMap);}
}
document.addEventListener('pointerup',finishMapDrag);
document.addEventListener('pointercancel',finishMapDrag);
document.addEventListener('lostpointercapture',finishMapDrag);
document.addEventListener('click',e=>{
 if(suppressMapClick&&e.detail!==0){suppressMapClick=false;e.preventDefault();e.stopImmediatePropagation();}
},true);
document.addEventListener('wheel',e=>{
 // Leave ordinary wheel events to the page. Intercept only intentional map zoom.
 if(mapDrag||!e.ctrlKey||!e.target.closest?.('.world-map')||$('modal').open)return;
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?MAP_GEOMETRY.height:1);
 if(!delta)return;
 e.preventDefault();zoomMap(Math.exp(-Math.max(-200,Math.min(200,delta))*.002));
},{passive:false});
function exportReport(){
 const now=new Date(),text=campaignReport(store.read(),core,{exportedAt:now});
 const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');
 a.href=url;a.download='traveller-report-'+now.toISOString().slice(0,10)+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
 message('TXT report download requested. Use Save campaign (JSON) for a restorable backup.');
}
// Leaving an unpaid service uses Back's existing token invalidation, but only
// after an explicit discard choice. Receipt navigation is saved separately from
// the ledger, so restoring a screen can never repeat or reverse its payment.
function setMapExpanded(expanded){
 if(services.committing())throw Error('Wait for this payment to finish saving.');
 if(expanded===mapExpanded)return;
 if(expanded){
  const route=services.route();
  mapRestorePanel=cargoHoldOpen?{kind:'cargo'}:route&&(route.receiptId||route.kind==='expenses')?{kind:'expense',route}:null;
  services.close({render:false});cargoHoldOpen=false;
  if(mapRestorePanel?.route?.receiptId)rememberExpenseRoute(mapRestorePanel.route);
  mapExpanded=true;render();
 }else{
  const previous=mapRestorePanel;mapRestorePanel=null;mapExpanded=false;
  if(previous?.kind==='cargo')cargoHoldOpen=true;
  if(previous?.kind==='expense')services.open(previous.route.kind,{receiptId:previous.route.receiptId});
  else render();
 }
 requestAnimationFrame(()=>document.querySelector('[data-action="map-expand"]')?.focus({preventScroll:true}));
 queueMapGeometry();scheduleMapAreas();
}
function toggleMapExpanded(){
 if(services.committing())throw Error('Wait for this payment to finish saving.');
 if(mapExpanded){setMapExpanded(false);return;}
 const route=services.route(),unpaid=services.active()&&!route?.receiptId&&route?.kind!=='expenses';
 if(unpaid){
  modal('Expand map?','<p>Expanding closes this service and discards its unsaved changes, just like Back. No payment will be made.</p><p>Cancel keeps your draft open and unchanged.</p>',()=>setMapExpanded(true),'Discard draft and expand',false,{retainRounding:true,annotateRounding:false});
 }else setMapExpanded(true);
}
// Top-level service navigation is separate from opening a fresh local draft.
// Closing a selected button uses the same controllers as Back, so no saved
// transaction is replayed or undone and all detached draft tokens become inert.
function toggleShipPanel(action){
 if(services.committing())throw Error('Wait for this payment to finish saving.');
 const kind={refuel:'fuel','refill-support':'support','cargo-hold':'cargo','ship-expenses':'expenses'}[action];
 const selected=tab==='Overview'?(services.selected()||(cargoHoldOpen?'cargo':null)):null;
 if(kind===selected){services.close({render:false});cargoHoldOpen=false;inputRounding=[];render();}
 else if(kind==='cargo')openCargoHold();
 else if(kind==='fuel')refuelShortcut();
 else if(kind==='support')refillSupport();
 else services.open('expenses');
 document.querySelector('#ship-actions [data-action="'+action+'"]')?.focus({preventScroll:true});
}
function closeCargoHold(){cargoHoldOpen=false;render();document.querySelector('#ship-actions [data-action="cargo-hold"]')?.focus();}
function openCargoHold(){if(services.committing())throw Error('Wait for this payment to finish saving.');services.close({render:false});inputRounding=[];cargoHoldOpen=true;showOverviewPanels();render();document.querySelector('#cargo-hold-panel h2')?.focus({preventScroll:true});if(document.defaultView?.matchMedia?.('(max-width:1099px)').matches)$('cargo-hold-panel')?.scrollIntoView({block:'start',behavior:'instant'});}
const actions={'passenger-search':()=>passengers.search(),'passenger-setup':()=>passengers.setup(),'passenger-board':id=>passengers.board(id),'passenger-deliver':id=>passengers.deliver(id),'passenger-offer-audit':id=>passengers.auditOffer(id),'cargo-hold':openCargoHold,'cargo-hold-close':closeCargoHold,'cargo-hold-tab':id=>{cargoHoldOpen=false;actions.tab(id);},'dev-tools':devTools,'dev-validate':()=>{const v=debugValidation();message(v.message,!v.ok);devTools();},'dev-copy':copyDebugReport,'dev-link':createDebugLink,'dev-export':exportDebugBundle,'dev-clear-errors':()=>{debugErrors.length=0;message('Debug error log cleared.');devTools();},refuel:refuelShortcut,'fuel-next':()=>setFuelQuantity(false),'fuel-fill':()=>setFuelQuantity(true),'day-back':()=>changeCampaignDay(-1),'day-forward':()=>changeCampaignDay(1),'history-filter':id=>{historyFilter=id;render();},'market-availability':marketAvailabilityAudit,'refill-support':refillSupport,'route-auto':()=>startMapRoute('auto'),'route-build':()=>startMapRoute('build'),'route-cancel':()=>{routeDraft=null;render();},'route-remove':removeMapStop,'route-last':()=>removeMapStop(routeDraft?.stops.length-1),'route-save':saveMapRoute,'route-retry':retryMapRoute,'route-clear':clearPlannedRoute,'map-world':mapWorld,'map-empty':mapEmpty,report:exportReport,'rounding-preview':roundingPreview,'map-expand':toggleMapExpanded,'map-zoom-in':()=>zoomMap(MAP_ZOOM_STEP),'map-zoom-out':()=>zoomMap(1/MAP_ZOOM_STEP),'map-zoom-reset':()=>zoomMap(1,true),'set-location':setLocation,tab:id=>{if(settingsOperation?.pending||worldWriteOperation?.pending||timeWriteOperation?.pending)return false;worldNearbyRequest=null;if(services.committing())throw Error('Wait for this payment to finish saving.');if(id!=='Overview'){mapExpanded=false;mapRestorePanel=null;cargoHoldOpen=false;services.close({render:false});}tab=id;render();document.querySelector('#tabs [data-arg="'+id+'"]')?.focus();scheduleMapAreas();},notes,setup,find:findWorld,nearby:()=>{worldNearbyRequest=null;scheduleMapAreas();return refreshNearby();},world:id=>{worldNearbyRequest=null;known[id]=world(id);view=id;mapPan={x:0,y:0};render();scheduleMapAreas();},'browse-prev':()=>{worldNearbyRequest=null;const i=state.route.indexOf(view||state.actual);view=state.route[Math.max(0,i-1)]||state.actual;render();},'browse-next':()=>{worldNearbyRequest=null;const i=state.route.indexOf(view||state.actual);view=state.route[Math.min(state.route.length-1,i+1)]||state.actual;render();},'planet-info':showPlanetInfo,override:overrideWorld,route:plotRoute,jump,search:()=>searchDialog(),'buyer-search':()=>searchDialog('buyer'),buy:buyForm,'offer-edit':editOffer,'offer-audit':commodityAudit,'expire-all':id=>act('Expired all snapshot offers',s=>s.snapshots.find(x=>x.id===id).offers.forEach(o=>o.expired=true)),reject,'sale-edit':()=>editSale?.(),'sale-all':()=>{selected=new Set(state.lots.map(l=>l.id));render();},'sale-clear':()=>{selected.clear();render();},sale:beginSale,'add-lot':existingLot,'lot-correct':correctCargo,'lot-sell':id=>{selected=new Set([id]);beginSale();},'lot-audit':lotAudit,'lot-insure':insureHeldCargo,'policy-audit':policyAudit,claim:claimForm,amend:amendPolicy,'contracts-search':()=>contractSearch(false),'mail-check':()=>contractSearch(true),'mail-audit':mailAudit,'mail-cancel':cancelMail,'contract-manual':manualContract,'contract-accept':accept,'draft-edit':editDraft,'draft-audit':id=>audit('Contract offer',contractDrafts.find(c=>c.offerId===id)),'contract-audit':id=>audit('Contract',state.contracts.find(c=>c.id===id)),deliver,'ship-expenses':()=>tab==='Accounts'?shipExpenses():services.open('expenses'),'expenses-all':selectAllExpenses,'berthing-rate':rollBerthingRate,deposit:depositForm,expense:()=>expenseForm(),'bank-correct':()=>expenseForm(true),'ledger-audit':ledgerAudit,'world-field-revert':previewWorldFieldRevert,'event-audit':id=>audit('History entry',state.events.find(e=>e.id===id)),'jump-undo':undoJump,undo:undoLatestChange,'settings-edit':settings,time:timeForm,export:()=>{store.backup();message('Backup download requested. Check that the file was saved.');},import:()=>$('import-file').click(),reset:()=>backupReplace('Reset campaign',S.initial())};
document.addEventListener('click',captureModalClick,true);
document.addEventListener('keydown',resetModalPointerGesture,true);
// Undo and day controls claim/check ownership before async service dispatch.
// A click made while saving must not queue a second change after completion.
document.addEventListener('click',safely(async e=>{if(settingsOperation?.pending||worldWriteOperation?.pending||timeWriteOperation?.pending)return;const b=e.target.closest('[data-action]');if(b&&!b.disabled){worldNearbyRequest=null;e.preventDefault();if(['undo','jump-undo','day-back','day-forward','time'].includes(b.dataset.action))return actions[b.dataset.action]?.(b.dataset.arg);if(b.closest('#ship-actions')&&['refuel','refill-support','cargo-hold','ship-expenses'].includes(b.dataset.action)){toggleShipPanel(b.dataset.action);return;}if(await services.action(b.dataset.action,b.dataset.arg,b.dataset.serviceToken))return;if(timeWriteOperation?.pending)return;const menu=b.closest('#route-menu');if(menu)menu.open=false;await actions[b.dataset.action]?.(b.dataset.arg);}}));
document.addEventListener('toggle',e=>{if(!e.target.isConnected)return;if(e.target.dataset?.settingsGroup)settingsOpenGroups.set(e.target.dataset.settingsGroup,e.target.open);if(e.target.id==='mail-card')mailPanelOpen=e.target.open;else if(e.target.id==='mail-accepted-details')mailAcceptedDetailsOpen=e.target.open;},true);
document.addEventListener('toggle',safely(e=>{if(e.target.classList?.contains('covered-payments'))return renderCoveredPayments(e.target);}),true);
document.addEventListener('keydown',safely(e=>{if(settingsOperation?.pending||worldWriteOperation?.pending||timeWriteOperation?.pending)return;if(e.key==='Escape'&&!$('modal').open){const menu=$('route-menu');if(menu?.open){e.preventDefault();menu.open=false;menu.querySelector('summary').focus();}else if(mapExpanded){e.preventDefault();setMapExpanded(false);}else if(services.active()){e.preventDefault();services.close();}else if(cargoHoldOpen){e.preventDefault();closeCargoHold();}}if((e.key==='Enter'||e.key===' ')&&e.target.matches('svg [data-action]')){e.preventDefault();return actions[e.target.dataset.action]?.(e.target.dataset.arg);}}));
document.addEventListener('change',safely(e=>{const t=e.target;if(settingsOperation?.pending||worldWriteOperation?.pending||timeWriteOperation?.pending)return;if(t.closest('#service-form,#expense-form'))services.sync();if(t.name==='insuranceLegs'){const route=state.route.slice(state.routeIndex, state.routeIndex+Number(t.value)+1);const distance=route.slice(1).reduce((n,x,i)=>n+M.distance(world(route[i]),world(x)),0);$('modal-form').elements.insuranceDistance.value=distance;$('modal-form').elements.distanceReason.value='';}if(t.name==='insure'&&$('purchase-insurance-options'))$('purchase-insurance-options').hidden=!t.checked;if(t.closest('#modal-form')){if(t.dataset.round)normaliseFields($('modal-form'));updateAccommodationEstimate();updateFuelSettingsEstimate();updateRecurringSettings();updateInsuranceEstimate();updateExpenseEstimate();updateMailEstimate();}if(t.id==='map-territories'){showTerritories=t.checked;savePoliticalTerritory(showTerritories);render();$('map-territories')?.focus();clearTimeout(mapLoadTimer);requestMapAreas();}if(t.id==='map-hexes'){showHexes=t.checked;render();}if(t.id==='map-uwp'){showUwp=t.checked;render();$('map-uwp')?.focus();}if(t.dataset.expire){const {snap}=findOffer(t.dataset.expire);act(t.checked?'Offer expired':'Offer reactivated',s=>s.snapshots.find(x=>x.id===snap.id).offers.find(o=>o.id===t.dataset.expire).expired=t.checked);}if(t.dataset.lot){t.checked?selected.add(t.dataset.lot):selected.delete(t.dataset.lot);render();}if(t.id==='market-filter'){marketFilter=t.value;render();}if(t.id==='snapshot-select'){snapshotId=t.value;render();}if(t.id==='cargo-sort'){cargoSort=t.value;render();}}));
document.addEventListener('input',e=>{if(settingsOperation?.pending||worldWriteOperation?.pending||timeWriteOperation?.pending)return;if(e.target.closest('#service-form,#expense-form'))services.sync();if(e.target.closest('#modal-form')){updateAccommodationEstimate();updateFuelSettingsEstimate();updateRecurringSettings();updateInsuranceEstimate();updateExpenseEstimate();updateMailEstimate();}if(!['market-search','cargo-search'].includes(e.target.id))return;const id=e.target.id,pos=e.target.selectionStart;if(id==='market-search')marketSearch=e.target.value;else cargoSearch=e.target.value;render();$(id)?.focus();$(id)?.setSelectionRange(pos,pos);});
// Modal forms are application controls, never native document navigations.
// Keep this fallback even when partial dialog construction failed before its
// owned onsubmit handler was installed, including after terminal settlement.
document.addEventListener('submit',safely(async e=>{if(e.target.id==='modal-form'){e.preventDefault();return;}if(settingsOperation?.pending||worldWriteOperation?.pending||timeWriteOperation?.pending){e.preventDefault();return;}if(e.target.id==='service-form'){e.preventDefault();await services.action('service-review','',e.target.dataset.serviceToken);}else if(e.target.id==='expense-form'){e.preventDefault();await services.action('expense-pay',e.target.dataset.expenseSession+':');}}));
$('modal-close').onclick=closeModal;$('modal-cancel').onclick=closeModal;
$('modal').addEventListener('cancel',e=>{e.preventDefault();closeModal();});
$('modal').addEventListener('close',()=>{if(!$('modal').open){if(settingsOperation?.session&&settingsOperation.session===activeModal)invalidateSettingsOperation();if(worldWriteOperation?.session===activeModal)invalidateWorldWriteOperation();if(timeWriteOperation?.session&&timeWriteOperation.session===activeModal)invalidateTimeWriteOperation();if(activeModal){activeModal=null;modalGeneration++;}$('modal-body').innerHTML='';restoreSettingsForm();}});
$('notes').onclick=safely(notes);$('takeover').onclick=safely(()=>{if(campaignReloadRequired)throw Error('Reload this page before editing the campaign again.');return store.acquire(true);});
$('import-file').onchange=safely(importCampaignFile);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(tab==='Overview'&&viewed()&&updateMapGeometry()){scheduleMapPaint();scheduleMapAreas();}}).observe($('main'));
window.addEventListener('error',e=>recordDebugError(e.error||e.message,'window-error'));
window.addEventListener('unhandledrejection',e=>recordDebugError(e.reason,'unhandled-rejection'));
async function boot(){mountRulePopover(document);[core,mp,decisions]=await Promise.all(['rules/core-2022.json?v=time-completion-20261010-48','rules/merchant-prince-1e.json','rules/decisions.json'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('Could not load '+url);return r.json();}));store=new Store(receiveCampaign,(editable,text)=>{if(!editable){worldNearbyRequest=null;invalidateWorldWriteOperation();invalidateTimeWriteOperation();invalidateSettingsOperation(true);invalidateJumpPreparation();invalidateUndoOperation();invalidateReplacementEditing();stockServices.invalidate();}$('save-status').textContent=campaignReloadRequired?campaignReloadMessage:text;$('save-status').className=editable&&!campaignReloadRequired?'muted':'readonly';$('takeover').hidden=editable||campaignReloadRequired;$('takeover').disabled=campaignReloadRequired;if(!editable&&activeModal?.mutates){activeModal.cancelled=true;$('modal-error').textContent=campaignReloadRequired?campaignReloadMessage:'Editing moved to another tab. Reopen this dialog after taking over editing.';}syncModalSubmit();render();});try{state=store.read();}catch(error){store.recovery=true;store.recoveryMessage=error.message;state=S.initial();}known={...state.worlds};view=state.actual;render();await store.acquire();if(state.initialized)restoreExpenseReceipt();if(state.initialized)refreshNearby(false).catch(e=>message('Could not load nearby worlds: '+e.message+'. Use Refresh nearby to retry.',true));}
boot().catch(e=>{message(e.message,true);$('main').innerHTML=empty('The calculator could not start. Your saved campaign has not been replaced. Reload after checking the error above.');});
