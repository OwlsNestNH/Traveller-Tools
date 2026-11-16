export function canChooseDrifterFallback(state){return state.stage==='failed-entry'&&!state.fallbackOptions?.forced&&state.fallbackOptions?.normal?.careerId==='core.drifter'&&state.fallbackOptions.normal.available;}
export function drifterFallbackChoiceView(state,catalog,{esc,button}){
 const career=catalog.careers.find(c=>c.id==='core.drifter');
 return '<label>Assignment<select id="career-assignment"><option value="">Choose your specialty</option>'+career.assignments.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('')+'</select></label>'+button('Enter Drifter','confirm-drifter-fallback','','disabled');
}
