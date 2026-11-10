// Read-only release information. No character commands, storage or history changes.
export function mountBetaNotice(document) {
 const trigger=document.getElementById('beta-notice-open');
 const dialog=document.getElementById('beta-notice');
 const closeButton=document.getElementById('beta-notice-close');
 if(!trigger||!dialog||!closeButton)return;
 trigger.addEventListener('click',()=>{
  if(dialog.open)return;
  dialog.showModal();document.body.classList.add('beta-notice-open');
  dialog.scrollTop=0;document.getElementById('beta-notice-title').focus({preventScroll:true});
 });
 closeButton.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  document.body.classList.remove('beta-notice-open');
  if(trigger.isConnected)trigger.focus({preventScroll:true});
 });
 // There is only one interactive control inside this read-only dialog.
 dialog.addEventListener('keydown',event=>{
  if(event.key==='Tab'&&!event.altKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();closeButton.focus();}
 });
}
if(typeof document!=='undefined')mountBetaNotice(document);
