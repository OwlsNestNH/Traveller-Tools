import {fullActionLog} from './log-download.mjs';
export function createLogViewer({document,getLog,onDownload}){
 const dialog=document.getElementById('full-action-log'),content=document.getElementById('full-log-content');
 let opener=null;
 function close(){dialog.close();if(opener?.isConnected)opener.focus();}
 dialog.querySelector('[data-log-close]').addEventListener('click',close);
 dialog.querySelector('[data-log-download]').addEventListener('click',onDownload);
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
  content.textContent=fullActionLog(getLog())||'No actions recorded yet.';
  dialog.showModal();dialog.scrollTop=0;document.getElementById('full-log-title').focus();
 }};
}
