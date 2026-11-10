// Direct stat-card access to the existing audited GM correction command.
export function statisticEditTarget(state,code,pool=false){
 if(!state?.config.gm)return null;
 if(pool){
  const index=state.pool.findIndex(p=>p.key===code);if(index<0)return null;
  const p=state.pool[index];return {code,field:'pool-score',index,value:p.value,min:0,max:40,pool:p};
 }
 if(!Object.hasOwn(state.character.stats,code)&&!(code==='PSI'&&state.config.extras?.includes('PSI')))return null;
 const derived=state.character.species==='aezorgh'&&code==='CHA';
 return {code,field:'stat.'+(derived?'SOC':code),value:state.character.stats[derived?'SOC':code],min:0,max:40,derived};
}
export function statisticPreview(target,state,value){
 if(!Number.isInteger(value)||value<target.min||value>target.max)return 'Enter a whole number from '+target.min+' to '+target.max+'.';
 if(target.pool)return 'Final '+target.code+': '+value+'. No species modifier is added. Original dice and raw total stay recorded. Raw swaps retain this final score; rerolling starts a new set.';
 if(target.derived)return 'Resulting CHA: '+Math.floor(value/2)+'. Aezorgh Charisma is derived from Social Standing.';
 if(target.code==='SOC'&&state.character.species==='aezorgh')return 'Resulting CHA: '+Math.floor(value/2)+'. Social Standing also updates derived Charisma.';
 if(target.code==='PSI')return 'This changes psionic potential only, not trained talents.';
 return 'The current score changes. Earlier rolls and the reason stay in the full log.';
}
export function mountStatisticEditor({document,getProjection,canOpen,onSave,getError}){
 const dialog=document.createElement('dialog');dialog.id='statistic-editor';dialog.className='statistic-editor';dialog.setAttribute('aria-labelledby','statistic-editor-title');
 dialog.innerHTML='<form id="statistic-editor-form"><h2 id="statistic-editor-title"></h2><p id="statistic-editor-current"></p><label id="statistic-editor-label" for="statistic-editor-value"></label><input id="statistic-editor-value" type="number" step="1" required aria-describedby="statistic-editor-preview"><p id="statistic-editor-preview" class="help"></p><label for="statistic-editor-reason">Reason</label><input id="statistic-editor-reason" maxlength="300" required placeholder="Why is this changing?"><p id="statistic-editor-error" role="alert" hidden></p><div class="actions"><button type="submit" id="statistic-editor-save">Save score</button><button type="button" id="statistic-editor-cancel" class="quiet">Cancel</button></div></form>';document.body.append(dialog);
 const find=id=>dialog.querySelector('#statistic-editor-'+id),value=find('value'),reason=find('reason'),error=find('error');
 let target=null,openedRevision=null,triggerId=null,saving=false;
 function close(){if(saving)return;dialog.close();document.getElementById(triggerId)?.focus({preventScroll:true});}
 function preview(){find('preview').textContent=statisticPreview(target,getProjection().state,value.value===''?NaN:Number(value.value));}
 find('cancel').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 value.addEventListener('input',preview);
 function open(code,pool=false,trigger=null){
  if(dialog.open||!canOpen())return;
  const projection=getProjection(),next=statisticEditTarget(projection.state,code,pool);if(!next)return;
  target=next;openedRevision=projection.revision;triggerId=trigger?.id;
  find('title').textContent='Set '+target.code+' score';find('current').textContent='Current '+(target.derived?'SOC':target.code)+': '+(target.value??'Untested');
  find('label').textContent=target.derived?'New SOC score':'New final score';value.min=target.min;value.max=target.max;value.value=target.value??'';reason.value='';error.hidden=true;preview();dialog.showModal();value.focus();value.select();
 }
 document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-edit-stat]');if(!trigger)return;event.preventDefault();open(trigger.dataset.editStat,trigger.dataset.statPool==='true',trigger);
 });
 find('form').addEventListener('submit',async event=>{
  event.preventDefault();if(saving||!dialog.open||!canOpen()||!find('form').reportValidity())return;
  if(getProjection().revision!==openedRevision){error.textContent='The character changed. Close this window and select the score again.';error.hidden=false;return;}
  if(!reason.value.trim()){reason.setCustomValidity('Enter a reason for this correction.');reason.reportValidity();return;}
  saving=true;error.hidden=true;
  try{
   const ok=await onSave({field:target.field,value:Number(value.value),...(target.index!==undefined?{index:target.index}:{}),reason:reason.value.trim()});
   if(ok){saving=false;close();}
   else{error.textContent=getError()||'The correction could not be saved.';error.hidden=false;reason.focus();}
  }finally{saving=false;}
 });
 reason.addEventListener('input',()=>reason.setCustomValidity(''));
 return {close,open};
}

