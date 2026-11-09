// Read-only presentation of the validated projection. Never infer missing outcomes.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const careerName=(catalog,id)=>catalog.careers.find(c=>c.id===id)?.name??id??'Outside a career';
const assignmentName=(catalog,id,assignment)=>catalog.careers.find(c=>c.id===id)?.assignments.find(a=>a.id===assignment)?.name??assignment;

// A restore can restore an earlier restore, so retain each historical branch.
// The saved commands are validated by the engine before this view is called.
export function currentActionNumbers(session){
 const branches=[[]];
 for(const [index,event] of session.events.entries()){
  const command=event.command,number=index+1;
  if(command.type==='restore')branches.push([...branches[command.payload.revision]]);
  else if(command.type==='gm-replay')branches.push([...branches[command.payload.revision-1],number]);
  else branches.push([...branches.at(-1),number]);
 }
 return new Set(branches.at(-1));
}

export function completedTermRows(state,catalog){
 const rows=[];
 for(const career of state.character.careers??[])for(const term of career.termHistory??[]){
  rows.push({number:term.generationTerm,label:careerName(catalog,career.id)+' / '+assignmentName(catalog,career.id,term.assignment),detail:'Career term '+term.careerTerm+' · '+(catalog.careers.find(c=>c.id===career.id)?.noRank?'No rank system':(term.officer?'Officer rank ':'Rank ')+term.rank)+(term.age!==undefined?' · Age at term completion '+term.age:'')});
 }
 for(const education of state.character.educations??[])if(education.completed){
  rows.push({number:education.term,label:catalog.precareers.find(p=>p.id===education.id)?.name??education.id,detail:education.graduation?.honours?'Graduated with honours':education.graduation?.graduated?'Graduated':education.graduation?.graduated===false?'Completed education term; did not graduate':'Completed education term; graduation outcome not recorded'});
 }
 return rows.sort((a,b)=>a.number-b.number);
}

export function completedTermsView(state,catalog){
 const rows=completedTermRows(state,catalog),missing=Math.max(0,state.character.terms-new Set(rows.map(r=>r.number)).size);
 return '<section class="sheet-section"><h3>Completed terms</h3>'+(rows.length?'<ol class="final-term-list">'+rows.map(row=>'<li value="'+esc(row.number)+'"><strong>Term '+esc(row.number)+' · '+esc(row.label)+'</strong><span>'+esc(row.detail)+'</span></li>').join('')+'</ol>':'<p>No completed term details recorded.</p>')+(missing?'<p class="help">'+esc(missing)+' completed term'+(missing===1?' has':'s have')+' no separate term entry. See the recorded events below; no details have been inferred.</p>':'')+'</section>';
}

export function finalEventsView(projection,session){
 const current=currentActionNumbers(session);
 // Notes and connections are already shown as current character fields. All
 // other current-branch actions keep their original, validated summaries.
 const actions=projection.log.filter(event=>current.has(event.number)&&!['notes','connection','gm-mode','configure'].includes(event.type));
 const superseded=projection.log.filter(event=>!current.has(event.number)&&!['restore'].includes(event.type)).length;
 return '<section class="sheet-section final-events"><h3>Events &amp; decisions</h3><p class="help">Recorded in action order. The full action log keeps the detailed dice, corrections and earlier branches.'+(superseded?' '+superseded+' superseded action'+(superseded===1?' is':'s are')+' excluded from this current life path.':'')+'</p>'+(actions.length?'<ol class="final-event-list">'+actions.map(event=>'<li><span class="final-action-number">Action '+esc(event.number)+'</span> '+esc(event.summary)+'</li>').join('')+'</ol>':'<p>No events recorded.</p>')+'</section>';
}
