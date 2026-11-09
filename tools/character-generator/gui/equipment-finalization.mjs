export function deferredEquipmentSummary(state,{esc,sourceLabel}){
 const entries=(state.character.deferredEquipment??[]).filter(e=>e.status==='pending');if(!entries.length)return '';
 return '<div class="sheet-section"><h3>Awarded assets & benefits: details pending</h3><ul>'+entries.map(e=>{const a=e.kind==='artefact'?{...e,id:e.lifeEventId}:state.character.benefitAwards.find(a=>a.id===e.awardId);return '<li><strong>'+esc(a.name)+(e.kind==='weapon-improvement'?' skill improvement':'')+'</strong> · '+esc(a.id)+' · '+esc(sourceLabel(a.source.id,a.source.page))+' · '+esc(a.origin.careerId??'Award')+' — '+(e.kind==='weapon-improvement'?'linked to earlier weapon awards; skill not yet applied':e.selection?.replaceOriginal?'trade-in of earlier armour pending':'item details pending')+'</li>';}).join('')+'</ul></div>';
}
function prerequisite(entries,e){if(e.kind==='artefact')return null;return entries.find(d=>d.status==='pending'&&d.kind==='equipment'&&e.priorAwardIds.includes(d.awardId)&&(e.kind==='weapon-improvement'?d.selection.weaponSkillOptions.some(n=>e.effect.allowedBases.includes(n.split(' (')[0])):e.selection.replaceOriginal&&d.selection.definitionId===e.selection.definitionId));}
export function equipmentFinalizationView(state,{esc,button,sourceLabel}){
 const entries=state.character.deferredEquipment??[],first=entries.find(e=>e.status==='pending');
 return '<p>Your awards are retained. Open each button to fill in its details. Linked improvements follow their earlier awards; no equipment or skill is invented.</p><div class="choice-list equipment-checklist">'+entries.map(e=>{const a=e.kind==='artefact'?{...e,id:e.lifeEventId}:state.character.benefitAwards.find(a=>a.id===e.awardId),done=e.status==='resolved',blocked=prerequisite(entries,e),label=a.name+(e.kind==='weapon-improvement'?' skill improvement':e.selection?.replaceOriginal?' trade-in':'');return button('<strong>'+esc(label)+'</strong><small>'+esc(a.id)+' · '+esc(a.origin.careerId??'Award')+' · '+esc(sourceLabel(a.source.id,a.source.page))+' · '+(done?'Completed':!blocked?'Details pending':'Resolve linked earlier award first')+'</small>','choose-deferred-equipment','choice','data-id="'+esc(e.id)+'" '+(done||blocked?'disabled':''));}).join('')+'</div><div class="actions">'+(['career','retirement'].includes(state.equipmentFinalizationReturn)?button('Finish character','finish','',first?'disabled':''):'')+button(state.equipmentFinalizationReturn==='benefits'?'Back to benefit rolls':'Back to career choices','close-equipment-finalization','quiet')+'</div>';
}
export function mountEquipmentDialog(document,onCancel){
 const dialog=document.getElementById('equipment-dialog');if(!dialog)return;
 dialog.addEventListener('cancel',event=>{event.preventDefault();onCancel();});
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey)return;
  const controls=[...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length),first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&(document.activeElement===first||!controls.includes(document.activeElement))){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 });
 dialog.showModal();document.getElementById('equipment-dialog-title').focus();
}
