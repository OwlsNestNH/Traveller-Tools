import {workflowRound} from './workflow.mjs';
import {roundReviewHTML,shipConditionHTML,reportDocument} from './combat-report.mjs';
import {escapeHTML as esc} from './ui-format.mjs';
export function createCombatReports({getState,getSelected,dispatch,onNextRound}){
 const dialog=document.createElement('dialog');dialog.id='combat-report';dialog.setAttribute('aria-labelledby','combat-report-title');document.body.append(dialog);
 let mode='review',trigger=null,revision=0,entry=null,index=0;
 const button=(action,name,disabled=false)=>`<button type="button" data-report="${action}" ${disabled?'disabled':''}>${name}</button>`;
 function render(){
  const state=getState(),report=mode==='report',title=report?'After-action ship condition':mode==='end'?'End this combat?':'End Round · review before advancing';
  let body=report?(entry.snapshot.ships[index]?shipConditionHTML(entry.snapshot.ships[index],entry.snapshot):'<p>No ships recorded.</p>'):roundReviewHTML(state);
  if(mode==='end')body='<p>GM only · ending combat captures the current encounter and exits its workflow. It does not resolve outstanding attacks, move missiles, repair ships or delete encounter data. Unfinished declarations and all saved results remain in the captured record.</p>'+body+'<label>Ending note (optional: surrender, escape or other GM outcome)<textarea data-ending-note maxlength="300" rows="3"></textarea></label><p>Save the report and encounter before resetting or leaving this page; no automatic browser storage is used.</p>';
  if(report)body='<p>Captured round '+workflowRound(entry.snapshot)+' · '+esc(entry.note||'No ending note recorded')+' · Ship '+(index+1)+' of '+entry.snapshot.ships.length+'. Referee information: review before sharing.</p>'+body;
  dialog.innerHTML='<div class="report-shell"><header><h2 id="combat-report-title">'+title+'</h2>'+(report?'<label>Completed combat<select data-report-entry>'+state.completedCombats.map(e=>'<option value="'+esc(e.id)+'" '+(e.id===entry.id?'selected':'')+'>'+esc(e.id)+'</option>').join('')+'</select></label>':'')+'</header><div class="report-body">'+body+'<p data-report-error role="alert"></p></div><footer>'+(report?button('previous','Previous Ship',index===0)+button('next','Next Ship',index>=entry.snapshot.ships.length-1)+button('print','Print / PDF · all ships')+button('save','Save report · HTML')+button('snapshot','Save encounter · JSON'):mode==='end'?button('confirm','End Combat'):button('advance','Begin Next Round')+button('end','End Combat…'))+button('close',report?'Close':'Cancel')+'</footer></div>';
 }
 function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function showReport(){mode='report';entry=structuredClone(getState().completedCombats.at(-1));index=Math.max(0,entry.snapshot.ships.findIndex(s=>s.id===getSelected()));render();dialog.querySelector('[data-report="close"]').focus();}
 dialog.addEventListener('change',e=>{if(e.target.matches('[data-report-entry]')){entry=structuredClone(getState().completedCombats.find(x=>x.id===e.target.value));index=0;render();dialog.querySelector('[data-report-entry]').focus();}});
 dialog.addEventListener('click',e=>{
  const b=e.target.closest('[data-report]'),action=b?.dataset.report;if(!b||b.disabled||e.detail>1)return;
  if(action==='close'){dialog.close();return;}
  if(action==='previous'||action==='next'){index+=action==='next'?1:-1;render();dialog.querySelector('[data-report="close"]').focus();return;}
  if(action==='end'){mode='end';render();dialog.querySelector('[data-report="close"]').focus();return;}
  if(action==='save'){download(reportDocument(entry),'text/html;charset=utf-8','ship-condition-'+entry.id+'.html');return;}
  if(action==='snapshot'){download(JSON.stringify(getState(),null,2),'application/json','ship-encounter-'+getState().revision+'.json');return;}
  if(action==='print'){const frame=document.createElement('iframe');frame.className='report-print-frame';frame.title='Printable ship condition report';frame.srcdoc=reportDocument(entry);frame.addEventListener('load',()=>{frame.contentWindow.focus();frame.contentWindow.print();});document.querySelector('.report-print-frame')?.remove();document.body.append(frame);return;}
  if(action==='advance'||action==='confirm'){
   b.disabled=true;const command=action==='advance'?{type:'next-battle-phase',phase:'crew',expectedRevision:revision}:{type:'end-combat',expectedRevision:revision,note:dialog.querySelector('[data-ending-note]').value};
   if(dispatch(command,action==='advance'?'Next round ready.':'Combat ended; condition report captured and encounter retained.')){if(action==='advance'){dialog.close();onNextRound();}else showReport();}else{b.disabled=false;dialog.querySelector('[data-report-error]').textContent='Transition not applied. Review the status message and current encounter; cancel to return to the station controls.';}
  }
 });
 dialog.addEventListener('close',()=>{if(trigger?.isConnected)trigger.focus({preventScroll:true});});
 return {open:(kind='review')=>{if(dialog.open)return;trigger=document.activeElement;revision=getState().revision;mode=kind;if(kind==='report'){if(!getState().completedCombats?.length)return;showReport();}else render();dialog.showModal();dialog.querySelector('[data-report="close"]').focus();},isOpen:()=>dialog.open};
}
