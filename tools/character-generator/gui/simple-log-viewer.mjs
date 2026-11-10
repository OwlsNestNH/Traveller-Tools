import {simpleActionLog} from './simple-log.mjs';
export function createSimpleLogViewer({document,getLog}){
 const dialog=document.getElementById('simple-action-log'),content=document.getElementById('simple-log-content');
 let opener=null;
 function close(){dialog.close();if(opener?.isConnected)opener.focus();}
 dialog.querySelector('[data-simple-log-close]').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey)return;
  const controls=[...dialog.querySelectorAll('button,[tabindex="0"]')].filter(node=>!node.disabled);
  const first=controls[0],last=controls.at(-1),current=document.activeElement;
  if(event.shiftKey&&(current===first||!controls.includes(current))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&current===last){event.preventDefault();first.focus();}
 });
 return {open(){
  if(dialog.open)return;
  opener=document.activeElement;
  content.textContent=simpleActionLog(getLog())||'No dice rolls recorded yet.';
  dialog.showModal();dialog.scrollTop=0;document.getElementById('simple-log-title').focus();
 }};
}
