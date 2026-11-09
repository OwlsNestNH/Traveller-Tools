export function relationshipEventView(state,{esc,button,sourceLabel}){
 const e=state.pendingChoice,removing=e.kind==='relationship-remove',people=state.character.relationships.filter(r=>(e.from??e.types).includes(r.role));
 const select=(id,label,options)=>'<label>'+label+'<select id="'+id+'"><option value="">Choose</option>'+options.map(([id,label])=>'<option value="'+esc(id)+'">'+esc(label)+'</option>').join('')+'</select></label>';
 return '<section><h3>'+ (removing?'Choose a relationship to remove':'Choose a relationship change')+'</h3><p class="source">'+esc(sourceLabel(e.source.id,e.source.page))+'</p>'+(people.length?select('relationship-event-person','Existing person',people.map(r=>[r.id,r.role+': '+r.name+' · '+r.id])):'<p>'+ (removing?'No Ally or Contact exists. The printed consequence removes all Benefits from this term.':'No Ally or Contact exists. The source grants a new relationship.')+'</p>')+(removing?'':select('relationship-event-role','New role',e.to.map(role=>[role,role]))+(people.length?'':'<label>Name (optional)<input id="relationship-event-name" maxlength="120"></label>'))+'<label class="check"><input id="relationship-event-confirm" type="checkbox"><span>Confirm this consequence.</span></label>'+button('Record relationship consequence','resolve-relationship-event')+'</section>';
}
export function relationshipEventPayload(state,query){
 const payload={confirmed:query('#relationship-event-confirm').checked};
 if(query('#relationship-event-person'))payload.relationshipId=query('#relationship-event-person').value;
 if(query('#relationship-event-role'))payload.role=query('#relationship-event-role').value;
 if(query('#relationship-event-name'))payload.name=query('#relationship-event-name').value;
 return payload;
}
export function relationshipEventSheet(state,{esc,sourceLabel}){
 const events=state.character.relationshipEvents??[];if(!events.length)return '';
 return '<section class="sheet-section"><h3>Relationship consequences</h3><ul>'+events.map(e=>'<li>'+esc(e.before?e.before.role+': '+e.before.name+' → '+(e.after?.role??'removed'):e.after?e.after.role+': '+e.after.name:'No eligible person; term Benefits lost')+' · '+esc(e.careerId)+' · '+esc(sourceLabel(e.source.id,e.source.page))+'</li>').join('')+'</ul></section>';
}
