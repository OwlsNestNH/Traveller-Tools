import {trainingChoiceView} from './training-information.mjs';
export function crossCareerCoverView(state,{esc,button,sourceLabel,careerName}){
 const current=state.currentCrossCareerCover;
 if(!current?.options?.length)return '<p class="warning">Cover choices are unavailable. Keep the character pending and reload.</p>';
 return '<p class="source">'+esc(sourceLabel(current.source.id,current.source.page))+'</p><p>Choose a cover for this operation. Your career remains '+esc(careerName(current.originCareerId))+'.</p><div class="choice-list">'+current.options.map(c=>button(esc(c.name),'cross-career-cover','choice','data-career="'+esc(c.id)+'"')).join('')+'</div>';
}
// Present an engine-projected borrowed training award without sending rule tables.
export function crossCareerTrainingView(state,{esc,button,sourceLabel,careerName}){
 const current=state.currentCrossCareerTraining;
 if(!current||!Array.isArray(current.options)||!current.options.length)return '<p class="warning">The borrowed training choices are unavailable. Keep the character pending and reload.</p>';
 return '<p class="source">'+esc(sourceLabel(current.source?.id??'aliens',current.source?.page??259))+'</p><p>Extra training from <strong>'+esc(careerName(current.sourceCareerId))+'</strong>.</p><p class="help">Current career: '+esc(careerName(current.originCareerId))+'. Choose the assignment table for this award.</p><div class="choice-list">'+current.options.map(option=>trainingChoiceView(option.name,option.information,'cross-career-training','data-assignment="'+esc(option.id)+'"',{esc,button,skills:state.character?.skills})).join('')+'</div>';
}

export function crossCareerRouteSheet(state,{esc,careerName}){
 const records=state.character.crossCareerRoutes??[];if(!records.length)return '';
 return '<div class="sheet-section"><h3>Borrowed career results</h3>'+records.map(record=>'<h4>'+esc(careerName(record.originCareerId))+' / '+esc(record.status)+'</h4>'+(record.coverCareerId?'<p>Cover: '+esc(careerName(record.coverCareerId))+'.</p>':'')+(record.check?'<p>'+esc(record.check.skill??'Investigate')+' check: '+esc(record.check.total)+' against '+esc(record.check.target)+'.</p>':'')+(record.tables??[]).map(table=>'<p>'+esc(careerName(table.careerId))+' / '+esc(table.table)+' result '+esc(table.row)+'.</p>').join('')+(record.training?'<p>Extra training: '+esc(careerName(record.training.careerId))+' / '+esc(record.training.assignment)+'. Die: '+esc(record.training.die)+'.</p>':'')).join('')+'</div>';
}
