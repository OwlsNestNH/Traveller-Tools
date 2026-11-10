// A dismissal is read-only. The app owns the confirmed, atomic draft replacement.
export function createCharacterCancel({document,onConfirm,canOpen}) {
 const dialog=document.getElementById('cancel-character-dialog');
 const keep=document.getElementById('cancel-character-keep');
 const confirm=document.getElementById('cancel-character-confirm');
 let trigger=null;
 function open(button){
  if(dialog.open||!canOpen())return;
  trigger=button;dialog.showModal();document.body.classList.add('cancel-character-open');keep.focus();
 }
 function close(){dialog.close();}
 keep.addEventListener('click',close);
 confirm.addEventListener('click',()=>{
  if(!dialog.open||!canOpen())return;
  close();onConfirm();
 });
 dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  document.body.classList.remove('cancel-character-open');
  if(trigger?.isConnected&&!trigger.disabled)trigger.focus({preventScroll:true});
 });
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey)return;
  event.preventDefault();(document.activeElement===keep?confirm:keep).focus();
 });
 return {placeButton(){
  const workspace=document.getElementById('workspace');
  let actions=workspace.querySelector('#setup-form > .actions')??[...workspace.querySelectorAll(':scope > .actions')].at(-1);
  if(!actions){actions=document.createElement('div');actions.className='actions';workspace.append(actions);}
  const button=document.createElement('button');button.type='button';button.id='cancel-character';button.className='quiet';button.textContent='Cancel';
  button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',dialog.id);button.addEventListener('click',()=>open(button));actions.append(button);
 }};
}
