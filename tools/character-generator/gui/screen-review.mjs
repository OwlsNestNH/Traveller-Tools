import {crowSpeakingPanel} from './crow-speaking-panel.mjs';
import {currentActionNumbers} from './final-sheet-history.mjs';
const protocol='traveller-read-only-screen-v1';
let editableCommand=null;
const choiceActions={'choose-skill':['choose-skill'],'choose-effect':['choose-effect'],'education-skill':['education-skill'],'education-service':['education-service'],'companion-skill':['companion-skill'],'injury-loss':['injury-loss'],'preterm-commission':['education-commission','skip-education-commission']};
export function configureScreenReviewChoice(type){editableCommand=Object.hasOwn(choiceActions,type)?type:null;}
export function proposeScreenReviewChoice(command,win=window){if(!editableCommand||command.type!==editableCommand)return false;win.parent.postMessage({protocol,type:'propose-choice',token:new URLSearchParams(win.location.search).get('review-token'),command},win.location.origin);return true;}
const editButton=button=>editableCommand&&choiceActions[editableCommand].includes(button.dataset.action);
const editField=node=>editableCommand&&node.closest('#workspace')&&!node.matches('[type=file]');
export const isEmbeddedScreenReview=typeof window!=='undefined'&&window.parent!==window&&new URLSearchParams(window.location.search).get('screen-review')==='read-only';
const administrative=new Set(['notes','connection','configure','gm-mode','gm-psi-mode','acknowledge-education-event','acknowledge-education-result','acknowledge-aslan-family','acknowledge-aslan-birth-order','acknowledge-aslan-rite','restore']);
export function originalReviewCommand(session,event){let command=event?.command;for(let n=0;command?.type==='gm-replay'&&n<session.events.length;n++)command=session.events[command.payload.revision-1]?.command;return command;}
export function reviewRevisions(session){
 const active=currentActionNumbers(session),meaningful=[...active].sort((a,b)=>a-b).filter(n=>{const command=originalReviewCommand(session,session.events[n-1]);return command&&!administrative.has(command.type)&&!command.type.startsWith('gm-');});
 // The most recent creation action is the current screen, including when only
 // notes or administrative actions follow it. Do not review abandoned branches.
 const current=meaningful.at(-1);return current===undefined?[]:[0,...meaningful.filter(n=>n<current)];
}
export function reviewPrefix(session,revision){
 if(!Number.isInteger(revision)||revision<0||revision>session.events.length)throw new Error('Invalid recorded screen.');
 return {...structuredClone(session),events:structuredClone(session.events.slice(0,revision))};
}
export function awaitScreenReviewSession(win=window){
 return new Promise(resolve=>{const token=new URLSearchParams(win.location.search).get('review-token');const receive=event=>{if(event.source!==win.parent||event.origin!==win.location.origin||event.data?.protocol!==protocol||event.data.token!==token||event.data.type!=='session')return;win.removeEventListener('message',receive);resolve(event.data);};win.addEventListener('message',receive);win.parent.postMessage({protocol,type:'ready',token},win.location.origin);});
}
const safeButton='#crow-error-close,#crow-error-dialog button[data-recovery-action="retry-startup"],.crow-assistance-info,#crow-introduction-dialog button[aria-label="Close Crow information"],[data-award-source-information],[data-support-information],#aslan-clan-info-open,#aslan-clan-info-close,#aslan-pride-info-open,#aslan-pride-info-close,#aslan-background-info-open,#aslan-background-info-close,#aslan-rite-info-open,#aslan-rite-info-close,#aslan-rite-calculation-open,#aslan-rite-calculation-close,[data-opening-help],[data-education-info],[data-result-information],[data-career-info],[data-opening-help-close],[data-career-info-close],[data-final-close],[data-action="open-current-character-sheet"],[data-action="open-current-character-sheet-popup"],[data-action="open-character-sheet"],#precareer-dismiss,#precareer-resume,#precareer-information-close,#precareer-rules-open,#precareer-result-open,#army-career-close,#army-career-resume,#completion-close,#completion-resume,#army-rule-information button';
export function lockScreenReview(document){
 document.body.dataset.screenReview='read-only';
 for(const input of document.querySelectorAll('input,select,textarea'))if(!editField(input))input.disabled=true;
 for(const button of document.querySelectorAll('button'))if(!button.matches(safeButton)&&!editButton(button))button.disabled=true;
 for(const link of document.querySelectorAll('a')){link.target='_blank';link.rel='noopener noreferrer';}
}
export function guardScreenReviewEvents(document){
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const nested=[...document.querySelectorAll('dialog[open]')].some(d=>/info|help|error/i.test(d.id));if(nested)return;event.preventDefault();event.stopImmediatePropagation();const win=document.defaultView;win.parent.postMessage({protocol,type:'cancel',token:new URLSearchParams(win.location.search).get('review-token')},win.location.origin);},true);
 document.addEventListener('click',event=>{const button=event.target.closest('button');if(button&&!button.matches(safeButton)&&!editButton(button)){event.preventDefault();event.stopImmediatePropagation();}},true);
 for(const type of ['submit','input','change'])document.addEventListener(type,event=>{if(editField(event.target))return;event.preventDefault();event.stopImmediatePropagation();},true);
}
export function mountScreenReview({document,getSession,isBusy,onNewCharacter,onFailure=()=>{},getChoiceAccess=async()=>({editable:false,reason:'Recorded choices are read only.'}),previewChange,applyChange,getCrowType=()=>'generic'}){
 if(isEmbeddedScreenReview)return {refresh(){},close(){},available:()=>false,open:()=>false};
 const entry=document.createElement('nav');entry.className='screen-review-entry';entry.setAttribute('aria-label','Review earlier screens');const back=document.createElement('button');back.type='button';back.className='quiet';back.dataset.screenReviewBack='';back.textContent='Back';entry.append(back);
 const dialog=document.createElement('dialog');dialog.id='screen-review-dialog';dialog.setAttribute('aria-labelledby','screen-review-title');dialog.innerHTML='<div class="screen-review-heading"><h2 id="screen-review-title" tabindex="-1">Earlier screen · READ ONLY</h2><p data-review-explanation>Your current screen stays unchanged until you confirm a supported change.</p></div><p id="screen-review-status" role="status" aria-live="polite"></p><div id="screen-review-frame"></div><section data-choice-preview hidden aria-labelledby="choice-preview-title"><h3 id="choice-preview-title" tabindex="-1">Confirm changes to this unfinished term</h3><div data-choice-crow></div><ul data-choice-consequences></ul><button type="button" data-choice-confirm>Confirm these changes</button><button type="button" class="quiet" data-choice-cancel>Cancel change</button></section><nav class="screen-review-controls" aria-label="Recorded screen navigation"><button type="button" data-review-previous>Back</button><button type="button" data-review-next>Forward</button><button type="button" data-review-current>Return to current</button><button type="button" class="quiet" data-review-cancel>Cancel</button><button type="button" class="quiet" data-review-new>New Character</button></nav>';document.body.append(dialog);
 let anchor=null,positions=[],cursor=-1,token=0,frame=null,opener=null,access=null,targetRevision=null,pendingChange=null,changing=false;
 const status=dialog.querySelector('#screen-review-status'),previous=dialog.querySelector('[data-review-previous]'),next=dialog.querySelector('[data-review-next]');
 function failed(notify=false){dialog.dataset.loading='failed';status.textContent='Earlier screen unavailable. Your current character is unchanged. Use the Crow recovery controls or return to your current screen.';if(notify)onFailure({retry:()=>show(cursor),close,available:()=>dialog.open&&!!anchor});}
 function close(){token++;dialog.close();anchor=null;positions=[];cursor=-1;frame?.remove();frame=null;if(opener?.isConnected&&opener.getClientRects().length&&!opener.closest('dialog:not([open])'))opener.focus();else if(back.isConnected)back.focus();}
 async function show(index){
  pendingChange=null;dialog.querySelector('[data-choice-preview]').hidden=true;dialog.querySelector('#screen-review-frame').hidden=false;
  if(!anchor||index<0)return;if(index>=positions.length){close();return;}cursor=index;dialog.dataset.loading='true';previous.disabled=cursor===0;next.disabled=false;status.textContent='Recorded screen '+(cursor+1)+' of '+positions.length+' · loading';
  const request=String(++token);targetRevision=[...currentActionNumbers(anchor)].sort((a,b)=>a-b).find(n=>n>positions[cursor]&&!administrative.has(originalReviewCommand(anchor,anchor.events[n-1])?.type)&&!originalReviewCommand(anchor,anchor.events[n-1])?.type.startsWith('gm-'));let nextAccess;try{nextAccess=targetRevision?await getChoiceAccess(anchor,targetRevision):{editable:false,reason:'Recorded context unavailable.'};}catch{if(request===String(token)&&anchor)failed(true);return;}if(request!==String(token)||!anchor)return;access=nextAccess?.ok===false?{editable:false,reason:nextAccess.error?.message??'Recorded context unavailable.'}:nextAccess;dialog.querySelector('#screen-review-title').textContent=access.editable?'Earlier screen · CURRENT UNFINISHED TERM':'Earlier screen · READ ONLY';dialog.querySelector('[data-review-explanation]').textContent=access.reason;const url=new URL(document.location.href);url.search='';url.hash='';url.searchParams.set('screen-review','read-only');url.searchParams.set('review-token',request);
  frame?.remove();frame=document.createElement('iframe');frame.title='Recorded character-creation screen, read only';frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.src=url.href;const loadingFrame=frame;loadingFrame.addEventListener('load',()=>{if(frame!==loadingFrame||request!==String(token))return;try{if(!loadingFrame.contentDocument?.querySelector('#workspace'))failed(true);}catch{failed(true);}});dialog.querySelector('#screen-review-frame').replaceChildren(frame);dialog.dataset.loading='true';
 }
 const receive=async event=>{if(!frame||event.source!==frame.contentWindow||event.origin!==document.location.origin||event.data?.protocol!==protocol||event.data.token!==String(token))return;
  if(event.data.type==='ready')frame.contentWindow.postMessage({protocol,type:'session',token:String(token),session:access?.editable&&access.reviewSession?access.reviewSession:reviewPrefix(anchor,positions[cursor]),editableCommandType:access?.editable?originalReviewCommand(anchor,anchor.events[targetRevision-1])?.type:null,nextCommand:access?.editable&&access.nextCommand?access.nextCommand:[...currentActionNumbers(anchor)].sort((a,b)=>a-b).filter(n=>n>positions[cursor]).map(n=>originalReviewCommand(anchor,anchor.events[n-1])).find(c=>c&&!administrative.has(c.type)&&!c.type.startsWith('gm-'))??null},document.location.origin);
  if(event.data.type==='propose-choice'){
   if(!access?.editable||changing||!previewChange)return;changing=true;const request=String(token);try{const payload={revision:targetRevision,expectedRevision:anchor.events.length,replacement:event.data.command};const result=await previewChange(anchor,payload);if(request!==String(token)||!dialog.open)return;if(!result.ok){status.textContent=result.error?.message??'This choice cannot safely change.';return;}pendingChange={...payload,confirmation:result.confirmation};const list=dialog.querySelector('[data-choice-consequences]');list.replaceChildren();for(const change of [...result.consequences.changes,...result.consequences.flowChanges]){const li=document.createElement('li');const label=change.path.replace(/^skills\./,'').replace(/^stats\./,'Characteristic ').replace(/([a-z])([A-Z])/g,'$1 $2'),value=x=>x===null?'not recorded':typeof x==='object'?JSON.stringify(x):String(x);li.textContent=label+': '+value(change.before)+' → '+value(change.after);list.append(li);}for(const change of result.consequences.laterActions){const li=document.createElement('li');li.textContent='Later result '+change.number+': '+change.after;list.append(li);}if(!list.children.length){const li=document.createElement('li');li.textContent='The recorded choice changes; no character values change.';list.append(li);}dialog.querySelector('[data-choice-crow]').innerHTML=crowSpeakingPanel({message:'Check what changes below. Your recorded dice stay the same.',aside:'Read it before you blame me for the paperwork.',type:getCrowType()});dialog.querySelector('#screen-review-frame').hidden=true;dialog.querySelector('[data-choice-preview]').hidden=false;dialog.querySelector('#choice-preview-title').focus();}finally{changing=false;}return;
  }
  if(event.data.type==='cancel'){close();return;}
  if(event.data.type==='failed'){failed();return;}
  if(event.data.type==='rendered'){dialog.dataset.loading='false';status.textContent='Recorded screen '+(cursor+1)+' of '+positions.length+(access?.editable?' · CURRENT UNFINISHED TERM':' · READ ONLY');}
 };
 document.defaultView.addEventListener('message',receive);
 const available=()=>!isBusy()&&!!getSession()&&reviewRevisions(getSession()).length>0;
 function open(trigger=back){if(!available())return false;anchor=structuredClone(getSession());positions=reviewRevisions(anchor);opener=trigger;if(!dialog.open)dialog.showModal();show(positions.length-1);dialog.querySelector('#screen-review-title').focus();return true;}
 back.addEventListener('click',()=>open(back));
 dialog.querySelector('[data-choice-cancel]').addEventListener('click',()=>{pendingChange=null;dialog.querySelector('[data-choice-preview]').hidden=true;dialog.querySelector('#screen-review-frame').hidden=false;frame?.focus();});
 dialog.querySelector('[data-choice-confirm]').addEventListener('click',async()=>{if(changing||!pendingChange||!applyChange)return;changing=true;const button=dialog.querySelector('[data-choice-confirm]');button.disabled=true;try{if(await applyChange(pendingChange))close();}finally{changing=false;button.disabled=false;}});
 previous.addEventListener('click',()=>show(cursor-1));next.addEventListener('click',()=>show(cursor+1));dialog.querySelector('[data-review-current]').addEventListener('click',close);dialog.querySelector('[data-review-cancel]').addEventListener('click',close);dialog.querySelector('[data-review-new]').addEventListener('click',onNewCharacter);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 return {close,open,available,refresh(){
  const session=getSession();back.disabled=isBusy()||!session||reviewRevisions(session).length===0;
  const workspace=document.querySelector('#workspace'),isFlow=d=>d?.matches('dialog[open]')&&(/^(?:aslan-|species-skill-dialog|equipment-dialog)/.test(d.id))&&!/information|doubles|error/.test(d.id),focused=document.activeElement?.closest('dialog[open]'),flow=(isFlow(focused)?focused:[...document.querySelectorAll('dialog[open]')].filter(isFlow).at(-1))??workspace;
  if(flow===workspace&&(!session||reviewRevisions(session).length===0)){entry.remove();return;}
  if(flow?.id==='species-skill-dialog'){const footer=flow.querySelector('.species-skill-footer');if(footer){footer.prepend(entry);return;}}
  if(flow===workspace&&workspace.closest('#precareer-dialog')){const rules=workspace.querySelector('#precareer-rules-open');if(rules){let row=rules.parentElement;if(!row.classList.contains('screen-review-information-footer')){row=document.createElement('div');row.className='screen-review-information-footer';rules.before(row);row.append(rules);}row.prepend(entry);return;}}
  if(flow===workspace){
   const cancel=workspace.querySelector('#cancel-character');
   if(cancel){let row=cancel.parentElement;const other=[...row.children].filter(n=>n!==cancel&&n!==entry);
    if(other.length){row=document.createElement('div');row.className='actions screen-review-footer';workspace.append(row);row.append(cancel);}
    row.classList.add('screen-review-footer');if(entry.parentElement!==row)row.prepend(entry);return;
   }
  }
  if(flow&&entry.parentElement!==flow)flow.append(entry);else if(flow&&flow.lastElementChild!==entry)flow.append(entry);
 },dialog};
}

// Display an accepted answer on the screen immediately before that command.
// This is annotation only: it never applies the command or predicts its award.
export function recordedReviewChoice(command,state){
 const payload=command?.payload??{};
 switch(command?.type){
  case 'choose-effect':return state.pendingChoice?.options?.[payload.index]?.label??null;
  case 'choose-skill':case 'education-skill':case 'education-service':return typeof payload.name==='string'?payload.name:null;
  case 'background':return Array.isArray(payload.skills)?payload.skills.join(', '):null;
  case 'training':return state.trainingOptions?.find(t=>t.id===payload.table)?.name??payload.table??null;
  case 'benefit':return payload.cash===true?'Cash benefit':'Material benefit';
  case 'preterm-commission':return payload.attempt===false?'Declined education commission':payload.attempt===true?(state.character?.careers?.[state.active]?.educationCommission?.automatic?'Accepted offered education commission':'Applied for education commission'):null;
  default:return null;
 }
}
export function annotateRecordedReviewChoice(document,command,state){
 const text=recordedReviewChoice(command,state);if(!text)return;
 let selected=null;
 if(command.type==='choose-effect')selected=[...document.querySelectorAll('[data-action="choose-effect"]')].find(n=>n.dataset.index===String(command.payload.index));
 if(command.type==='training')selected=[...document.querySelectorAll('[data-action="training"]')].find(n=>n.dataset.table===command.payload.table);
 if(selected){selected.dataset.recordedChoice='true';selected.setAttribute('aria-pressed','true');}
 const annotation=document.createElement('p');annotation.className='screen-review-recorded-choice';annotation.setAttribute('role','note');annotation.textContent='Recorded choice: '+text+'. This screen is locked; Forward reviews the recorded result.';
 const scope=document.querySelector('dialog[open] form')??document.querySelector('#workspace');
 const guidance=scope?.querySelector('.academy-training-crow,.career-pilot-guidance,.crow-speaking-panel'),heading=scope?.querySelector('#step-title');
 if(guidance)guidance.after(annotation);else if(heading)heading.after(annotation);else scope?.prepend(annotation);
}
