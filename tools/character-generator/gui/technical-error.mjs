/* Dependency-independent: keep recovery available even when the module graph fails. */
(()=>{
 const document=window.document;let dialog,trigger,last='';
 function show(message,{startup=false}={}){
  message=String(message||'An unexpected error occurred.');
  if(!dialog){
   dialog=document.getElementById('crow-error-dialog');
   document.getElementById('crow-error-close').addEventListener('click',()=>dialog.close());
   dialog.addEventListener('close',()=>{last='';if(trigger?.isConnected&&!trigger.disabled)trigger.focus({preventScroll:true});});
  }
  if(dialog.open&&last===message)return;
  last=message;if(!dialog.open)trigger=document.activeElement;
  document.getElementById('crow-error-detail').textContent=message;
  document.getElementById('crow-error-guidance').textContent=startup?'The builder could not finish loading. Check your connection and try a normal reload. Do not clear site data: that could remove saved characters. No recovery action has been run automatically.':'Review the explanation above. Check the character and action log before repeating an action: it may already have been recorded. Keep a backup with Save character & log when available. Do not clear site data; saved characters may be stored there. No action is retried automatically.';
  if(!dialog.open)dialog.showModal();document.getElementById('crow-error-title').focus({preventScroll:true});
 }
 window.CrowTechnicalError=Object.freeze({show});
 window.addEventListener('error',event=>{if(event.error)show(event.error.message||event.message);});
 window.addEventListener('unhandledrejection',event=>show(event.reason?.message||String(event.reason)));
 // Legacy local popup errors remain in place; mirror their exact detail without changing commands.
 new MutationObserver(records=>{
  const nodes=new Set();for(const record of records){const element=record.target.nodeType===1?record.target:record.target.parentElement;const error=element?.closest('[id$="-error"],.physical-stat-error');if(error)nodes.add(error);}
  for(const node of nodes){const message=node.textContent.trim();if(node.closest('#crow-error-dialog')||node.closest('[hidden]')||!message)continue;show(message);}
 }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});
})();
