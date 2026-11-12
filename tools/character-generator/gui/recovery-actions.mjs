// Shared recovery contract: views render explicit actions; only adapters navigate or mutate.
import {crowAssistanceView} from './crow-assistance.mjs';
import {currentActionNumbers} from './final-sheet-history.mjs';
export function recoveryButton(document,action){
 const button=document.createElement('button');button.type='button';button.dataset.recoveryAction=action.id;button.textContent=action.label;if(action.ariaLabel)button.setAttribute('aria-label',action.ariaLabel);
 let running=false;button.addEventListener('click',async()=>{if(running||action.available?.()===false)return;running=true;button.disabled=true;try{await action.run(button);}finally{running=false;if(button.isConnected)button.disabled=action.available?.()===false;}});return button;
}
export function rewindImpact(session,log,target){
 if(!Number.isInteger(target)||target<0||target>=session.events.length)throw new Error('Choose an earlier accepted action.');
 const current=currentActionNumbers(session),destination=currentActionNumbers({...session,events:session.events.slice(0,target)});
 const removed=log.filter(e=>current.has(e.number)&&!destination.has(e.number));
 return {target,removed,rolls:removed.reduce((sum,e)=>sum+e.rolls.length,0),reactivated:[...destination].filter(n=>!current.has(n)).length,reactivatedActions:log.filter(e=>destination.has(e.number)&&!current.has(e.number))};
}
export function mountRewindConfirmation({document,getSession,getProjection,getKey,isBusy,onRestore,onBackup}){
 let dialog,openingKey,trigger,pending=false;
 function open(opener,{technical=false}={}){
  const projection=getProjection();if(isBusy()||!projection?.state.config.gm||!projection.revision)return;
  if(dialog?.open)return;openingKey=getKey();trigger=opener;
  if(!dialog){
   dialog=document.createElement('dialog');dialog.id='crow-rewind-dialog';dialog.dataset.crowEssential='true';dialog.className='crow-error-dialog';dialog.setAttribute('aria-labelledby','crow-rewind-title');
   const title=document.createElement('h2');title.id='crow-rewind-title';title.tabIndex=-1;title.textContent='Review what going back changes';
   const label=document.createElement('label');label.textContent='Return to the state after this accepted action';
   const select=document.createElement('select');select.id='crow-rewind-target';label.append(select);
   const explanation=document.createElement('p');explanation.id='crow-rewind-impact';explanation.setAttribute('aria-live','polite');
   const list=document.createElement('ol');list.id='crow-rewind-actions';
   const stale=document.createElement('p');stale.id='crow-rewind-stale';stale.hidden=true;stale.setAttribute('role','alert');
   const restored=document.createElement('section');restored.id='crow-rewind-reactivated';const restoredHeading=document.createElement('h3');restoredHeading.textContent='Earlier results that become active again';const restoredList=document.createElement('ol');restored.append(restoredHeading,restoredList);
   const safety=document.createElement('p');safety.textContent='These later results stop applying to the active character, but every original action and roll stays in the Full Log. Randomness is not rewound. Unsaved choices and notes on this screen will be cleared. Nothing is rerolled or purchased automatically.';
   const checkLabel=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.id='crow-rewind-confirmed';checkLabel.append(check,document.createTextNode(' I understand and want to supersede these results.'));
   const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Keep current character';cancel.addEventListener('click',()=>{if(!pending)dialog.close();});
   const confirm=document.createElement('button');confirm.type='button';confirm.id='crow-rewind-accept';confirm.textContent='Confirm rewind';confirm.disabled=true;
   check.addEventListener('change',()=>confirm.disabled=!check.checked||pending);
   select.addEventListener('change',()=>{check.checked=false;confirm.disabled=true;update();});
   confirm.addEventListener('click',async()=>{if(pending||!check.checked)return;if(openingKey!==getKey()||!getProjection().state.config.gm||isBusy()){stale.textContent='The character or permission changed. Keep the current character, then open a fresh review before rewinding.';stale.hidden=false;title.textContent='The character changed';confirm.disabled=true;return;}pending=true;confirm.disabled=true;cancel.disabled=true;select.disabled=true;check.disabled=true;try{await onRestore(Number(select.value));}finally{pending=false;dialog.close();cancel.disabled=false;select.disabled=false;check.disabled=false;}});
   dialog.addEventListener('cancel',event=>{if(pending)event.preventDefault();});dialog.addEventListener('close',()=>{const active=[...document.querySelectorAll('dialog[open]')].at(-1);const target=trigger?.isConnected&&!trigger.closest('[hidden]')&&(!active||active.contains(trigger))?trigger:active?.querySelector('h2,button:not([disabled]),input:not([disabled])')??document.querySelector('#step-title')??document.querySelector('#workspace');if(target){if(!target.matches('button,input,select,textarea,a,[tabindex]'))target.tabIndex=-1;target.focus({preventScroll:true});}});
   const assistance=crowAssistanceView(document,{type:'referee'});dialog.append(assistance.row,assistance.help,title,label,explanation,list,restored,safety,stale);if(onBackup)dialog.append(recoveryButton(document,{id:'backup-before-rewind',kind:'backup',label:'Save accepted character',run:onBackup}));dialog.append(checkLabel,cancel,confirm);document.body.append(dialog);
  }
  dialog.querySelector('h2').textContent=technical?'Review what going back changes':'SECOND THOUGHTS, GENIUS?';
  const select=dialog.querySelector('select');select.replaceChildren();
  for(let revision=projection.revision-1;revision>=0;revision--){const option=document.createElement('option');option.value=revision;option.textContent=revision===0?'Before character setup':'Action '+revision+' · '+projection.log[revision-1].summary;select.append(option);}
  dialog.querySelector('#crow-rewind-stale').hidden=true;dialog.querySelector('#crow-rewind-confirmed').checked=false;dialog.querySelector('#crow-rewind-accept').disabled=true;update();dialog.showModal();dialog.querySelector('h2').focus();
 }
 function update(){const impact=rewindImpact(getSession(),getProjection().log,Number(dialog.querySelector('select').value));dialog.querySelector('#crow-rewind-impact').textContent=impact.removed.length+' currently applied actions, including '+impact.rolls+' recorded rolls, will stop applying.'+(impact.reactivated?' '+impact.reactivated+' older actions will become active again.':'');const list=dialog.querySelector('ol');list.replaceChildren();for(const event of impact.removed){const item=document.createElement('li');item.textContent='Action '+event.number+' · '+event.summary;list.append(item);}const restored=dialog.querySelector('#crow-rewind-reactivated');restored.hidden=!impact.reactivatedActions.length;const restoredList=restored.querySelector('ol');restoredList.replaceChildren();for(const event of impact.reactivatedActions){const item=document.createElement('li');item.textContent='Action '+event.number+' · '+event.summary;restoredList.append(item);}}
 return {open};
}

// In-memory view drafts, keyed by accepted revision and presentation identity.
// Restoring a view never dispatches input/change events or writes a character.
export function createNavigationDrafts(){
 const drafts=new Map();
 return {capture(root,key){const fields=[...root.querySelectorAll('input,select,textarea')].filter(n=>n.type!=='file'&&n.id).map(n=>({id:n.id,type:n.type,value:n.value,checked:n.checked,selectedIndex:n.selectedIndex}));drafts.set(key,fields);if(drafts.size>32)drafts.delete(drafts.keys().next().value);},restore(root,key){for(const saved of drafts.get(key)??[]){const node=root.querySelector('[id="'+saved.id.replaceAll('"','\\"')+'"]');if(!node||node.disabled||node.type!==saved.type)continue;if(node.tagName==='SELECT'&&saved.selectedIndex===-1){node.selectedIndex=-1;continue;}if(node.tagName==='SELECT'&&![...node.options].some(o=>o.value===saved.value&&!o.disabled))continue;node.value=saved.value;if(['checkbox','radio'].includes(node.type))node.checked=saved.checked;}},clear(){drafts.clear();}};
}
