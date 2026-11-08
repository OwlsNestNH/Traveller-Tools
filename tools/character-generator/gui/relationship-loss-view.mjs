// The API owns eligibility and the source decision; this module only presents it.
export function relationshipLossView(state,{esc,button,sourceLabel}){
 const pending=state.pendingChoice??{},source=pending.source??{id:'aliens',page:273};
 if(!Array.isArray(state.relationshipLossOptions))return '<p class="warning">The eligible relationships are unavailable. Keep the character pending and reload.</p>';
 const choices=state.relationshipLossOptions;
 let html='<p class="source">'+esc(sourceLabel(source.id??'aliens',source.page??273))+'</p><p>Choose the relationship to remove. The original entry remains in the action log.</p>';
 if(choices.length)return html+'<div class="choice-list">'+choices.map(choice=>button('Person '+esc(choice.index+1)+' / '+esc(choice.role)+': '+esc(choice.name||'Unnamed relationship'),'resolve-relationship-loss','choice','data-index="'+esc(choice.index)+'"')).join('')+'</div>';
 return html+'<p class="warning">There is no eligible Ally or Contact in this record. Confirm the source ruling before continuing.</p><label class="check"><input id="relationship-absent" type="checkbox"><span>Referee confirms that no eligible relationship is recorded.</span></label><label>Referee reason<textarea id="relationship-loss-reason" rows="3" maxlength="500" placeholder="Required; saved in the action log"></textarea></label>'+button('Record source decision','resolve-relationship-loss','','data-absent="true"');
}
export function relationshipLossSheet(state,{esc}){
 const records=state.character.relationshipLosses??[];if(!records.length)return '';
 return '<div class="sheet-section"><h3>Removed relationships</h3>'+records.map(record=>'<p>'+esc(record.removed?record.removed.role+': '+(record.removed.name||'Unnamed relationship'):'No eligible relationship recorded')+'</p>'+(record.reason?'<p class="multiline">'+esc(record.reason)+'</p>':'')).join('')+'</div>';
}
