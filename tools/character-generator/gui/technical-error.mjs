/* No engine or application-module dependency: startup recovery must survive a
   rejected module graph. Recovery adapters provide explicit typed actions. */
(()=>{
 if(window.CrowTechnicalError)return;
 const document=window.document;let dialog,trigger,lastControl,last='',provider=()=>({}),context={},actions=[];
 document.addEventListener('focusin',event=>{if(event.target.matches('button,input,select,textarea,a,[tabindex]')&&!event.target.closest('#crow-error-dialog'))lastControl=event.target;});
 document.addEventListener('pointerdown',event=>{const control=event.target.closest('button,input,select,textarea,a,[tabindex]');if(control&&!control.closest('#crow-error-dialog'))lastControl=control;},true);
 function refresh(){
  if(!dialog)return;
  document.getElementById('crow-error-connectivity').textContent=navigator.onLine===false?'Your browser reports that this device is offline. Reconnect before trying a startup reload.':'Your browser reports network access. This does not prove that the site or rules API is reachable.';
  const diagnostics=document.getElementById('crow-error-diagnostics');if(diagnostics&&last)diagnostics.textContent=JSON.stringify({message:last,...(provider(context)?.diagnostics??{}),browserReportsOnline:navigator.onLine!==false,startup:window.CrowStartupRecovery?.status()??'unavailable'},null,2);
  for(const {button,action,running} of actions)button.disabled=running.value||action.available?.()===false;
 }
 function show(message,options={}){
  message=String(message||'An unexpected error occurred.');
  if(options.startup)window.CrowStartupRecovery?.markFailed();
  if(!dialog){
   dialog=document.getElementById('crow-error-dialog');dialog.dataset.crowEssential='true';
   const connection=document.createElement('p');connection.id='crow-error-connectivity';connection.setAttribute('aria-live','polite');
   const recovery=document.createElement('div');recovery.id='crow-error-actions';recovery.className='crow-recovery-actions';
   const details=document.createElement('details'),summary=document.createElement('summary'),diagnostics=document.createElement('pre');summary.textContent='Diagnostics';diagnostics.id='crow-error-diagnostics';diagnostics.tabIndex=0;details.append(summary,diagnostics);dialog.insertBefore(connection,document.getElementById('crow-error-guidance'));dialog.insertBefore(recovery,document.getElementById('crow-error-close'));dialog.insertBefore(details,document.getElementById('crow-error-close'));
   document.getElementById('crow-error-close').addEventListener('click',()=>dialog.close());
   dialog.addEventListener('close',()=>{last='';const target=trigger?.isConnected&&!trigger.disabled?trigger:document.querySelector('dialog[open] button:not([disabled]),dialog[open] input:not([disabled])')??document.querySelector('#step-title')??document.querySelector('#workspace');if(target){if(!target.matches('button,input,select,textarea,a,[tabindex]'))target.tabIndex=-1;target.focus({preventScroll:true});}});
  }
  if(dialog.open&&last===message)return;
  context=options;last=message;if(!dialog.open)trigger=document.activeElement.matches('button,input,select,textarea,a,[tabindex]')?document.activeElement:lastControl;
  document.getElementById('crow-error-detail').textContent=message;
  document.getElementById('crow-error-guidance').textContent=options.guidance??(options.startup?'The builder could not finish loading. Try again performs a normal reload in a fresh page before any new action has been accepted. Saved drafts and files stay intact. It is unavailable after editing or using character controls on this failed page. Do not clear site data: that could remove saved characters.':'Check the character and action log before repeating an action: it may already have been recorded. Save accepted character backs up accepted results; unsaved fields stay on this page. No roll, purchase or action is retried automatically.');
  const supplied=provider(options)??{},available=[...(options.actions??[]),...(supplied.actions??[])];
  if(options.startup&&window.CrowStartupRecovery)available.unshift({id:'retry-startup',kind:'reload',label:'Try again',available:()=>window.CrowStartupRecovery.canRetry(),run:()=>window.CrowStartupRecovery.retry()});
  document.getElementById('crow-error-diagnostics').textContent=JSON.stringify({message,occurredAt:new Date().toISOString(),browserReportsOnline:navigator.onLine!==false,...(supplied.diagnostics??{}),...(options.startup?{startup:window.CrowStartupRecovery?.status()??'unavailable'}:{})},null,2);
  const region=document.getElementById('crow-error-actions');region.replaceChildren();actions=[];const ids=new Set();
  for(const action of available){if(ids.has(action.id))continue;ids.add(action.id);const button=document.createElement('button'),running={value:false};button.type='button';button.dataset.recoveryAction=action.id;button.textContent=action.label;button.addEventListener('click',async()=>{if(running.value||action.available?.()===false)return;running.value=true;refresh();try{const result=await action.run(button);if(action.kind==='navigate'&&result!==false&&dialog.open)dialog.close();}catch(error){show(error.message,{...context,actions:[]});}finally{running.value=false;refresh();}});actions.push({button,action,running});region.append(button);}
  refresh();queueMicrotask(refresh);if(!dialog.open)dialog.showModal();document.getElementById('crow-error-title').focus({preventScroll:true});
 }
 window.CrowTechnicalError=Object.freeze({show,refresh,close(){if(dialog?.open)dialog.close();},setRecoveryProvider(value){provider=value;}});
 for(const event of ['online','offline'])window.addEventListener(event,refresh);
 window.addEventListener('error',event=>{if(event.error)show(event.error.message||event.message);});
 window.addEventListener('unhandledrejection',event=>show(event.reason?.message||String(event.reason)));
 new MutationObserver(records=>{const nodes=new Set();for(const record of records){const element=record.target.nodeType===1?record.target:record.target.parentElement;const error=element?.closest('[id$="-error"],.physical-stat-error');if(error)nodes.add(error);}for(const node of nodes){const message=node.textContent.trim();if(node.closest('#crow-error-dialog')||node.closest('[hidden]')||!message)continue;show(message);}}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});
})();
