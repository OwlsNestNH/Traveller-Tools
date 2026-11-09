// Assignment choices are projected by the rules API; this view does not classify careers.
export function assignmentChangeView(state,{esc,button,sourceLabel}){
 const choices=state.assignmentChangeOptions??[];if(!choices.length)return '';
 const mode=choices[0].mode,available=choices.some(choice=>choice.available);
 const label=mode==='retain'?'Start next term and try assignment':'Leave for this assignment';
 return '<details class="sheet-section assignment-options"><summary>Change assignment</summary><p class="source">'+esc(sourceLabel('core',20))+'</p><p>'+(mode==='retain'?'Keep your career and rank. The next term starts after the check, using the new assignment on success or the current one on failure.':'Take your benefits first, then qualify for the new assignment at rank 0.')+'</p><label>New assignment<select id="assignment-change"><option value="">Choose an assignment</option>'+choices.map(choice=>'<option value="'+esc(choice.id)+'"'+(choice.available?'':' disabled')+'>'+esc(choice.name)+'</option>').join('')+'</select></label>'+button(label,'change-assignment','quiet',available?'':'disabled')+(!available?'<p class="help">'+[...new Set(choices.map(choice=>choice.reason).filter(Boolean))].map(esc).join(' ')+'</p>':'')+'</details>';
}
export function assignmentEntryView(state,{esc,button,sourceLabel,careerName,assignmentName}){
 const current=state.currentAssignmentChange;
 if(!current||current.mode!=='restart'||current.status!=='ready')return '<p class="warning">This assignment entry is not ready. Preserve your character and reload.</p>';
 return '<p class="source">'+esc(sourceLabel(current.source?.id??'core',current.source?.page??20))+'</p><p>Next assignment: <strong>'+esc(careerName(current.careerId))+' / '+esc(assignmentName(current.careerId,current.toAssignment))+'</strong>.</p><p>Your previous benefits are complete. Qualification uses your current characteristics. Success starts a new career record at rank 0; failure leads to the available fallback choices.</p><div class="actions">'+button('Check qualification','qualify-assignment')+button('Choose another career instead','abandon-assignment-change','quiet')+'</div><p class="help">Choosing another career keeps all benefits already received.</p>';
}
export function assignmentPendingView(state,{esc,careerName,assignmentName}){
 const current=state.currentAssignmentChange;
 if(!current||current.status!=='mustering-out')return '';
 return '<p class="warning">Assignment change pending: '+esc(careerName(current.careerId))+' / '+esc(assignmentName(current.careerId,current.toAssignment))+'. Finish these benefits before qualification.</p>';
}
export function assignmentChangeSheet(state,{esc,careerName,assignmentName}){
 const records=state.character.assignmentChanges??[];if(!records.length)return '';
 const termList=career=>'<ol class="compact-list">'+career.termHistory.map(term=>'<li>Career term '+esc(term.careerTerm)+': '+esc(assignmentName(career.id,term.assignment))+', '+(term.officer?'officer rank ':'rank ')+esc(term.rank)+', age '+esc(term.age)+'.</li>').join('')+'</ol>';
 const label={completed:'Completed',failed:'Not successful',abandoned:'Abandoned','mustering-out':'Collecting benefits',ready:'Ready to qualify','awaiting-source':'Source decision pending'};
 return '<div class="sheet-section"><h3>Assignment history</h3>'+records.map(record=>'<p><strong>'+esc(careerName(record.careerId))+'</strong>: '+esc(assignmentName(record.careerId,record.fromAssignment))+' to '+esc(assignmentName(record.careerId,record.toAssignment))+'. '+esc(label[record.status]??record.status)+'.'+(record.check?'<br>Qualification: '+(record.check.automatic?'automatic':esc(record.check.total)+' against '+esc(record.check.target)+'+')+'.':'')+'</p>').join('')+(state.character.careers??[]).filter(career=>career.termHistory?.length).map(career=>'<details><summary>'+esc(careerName(career.id))+' completed terms</summary>'+termList(career)+'</details><section class="print-only"><h4>'+esc(careerName(career.id))+' completed terms</h4>'+termList(career)+'</section>').join('')+'</div>';
}
