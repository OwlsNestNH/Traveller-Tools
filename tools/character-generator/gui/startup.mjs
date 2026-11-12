/* One bootstrap per document. A user-requested reload gives every module a fresh
   realm, including failed transitive imports, without duplicating app handlers. */
(()=>{
 if(window.CrowStartupRecovery)return;
 let phase='loading',dirty=false,retrying=false;
 const refresh=()=>window.CrowTechnicalError?.refresh();
 window.CrowStartupRecovery=Object.freeze({
  markFailed(){if(phase!=='ready')phase='failed';},
  lock(){phase='ready';refresh();},
  canRetry(){return phase==='failed'&&!dirty&&!retrying&&navigator.onLine!==false;},
  retry(){if(!this.canRetry())return false;retrying=true;refresh();location.reload();return true;},
  status(){return {phase,dirty,retrying};}
 });
 for(const event of ['input','change'])document.addEventListener(event,e=>{if(phase==='failed'&&!e.target.closest('#crow-error-dialog')){dirty=true;refresh();}},true);
 document.addEventListener('click',event=>{if(phase==='failed'&&!event.target.closest('#crow-error-dialog')&&event.target.closest('#workspace button,#sheet button,.toolbar button')){dirty=true;refresh();}},true);
 for(const control of document.querySelectorAll('.toolbar button,.toolbar input'))if(!control.disabled){control.dataset.busyDisabled='true';control.disabled=true;}
 import('./app.mjs').then(async app=>{if(await app.startupReady)window.CrowStartupRecovery.lock();}).catch(error=>{window.CrowStartupRecovery.markFailed();window.CrowTechnicalError.show('Unable to load the character builder: '+error.message,{startup:true});});
})();
