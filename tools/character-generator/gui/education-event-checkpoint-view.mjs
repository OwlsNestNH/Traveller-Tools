import {aslanFamilyDie} from './aslan-family-popup.mjs';
const validFaces=values=>Array.isArray(values)&&values.length>0&&values.every(n=>Number.isInteger(n)&&n>=1&&n<=6);
export function educationCheckpointModel(projection){
 const view=projection?.educationEventView,state=projection?.state;
 if(!view||!state||!validFaces(view.eventDice)||view.eventDice.length!==2||view.eventDice.reduce((a,b)=>a+b,0)!==view.eventTotal)return null;
 const base={...view,kind:'checkpoint',name:'University',eventName:view.name,forcedCareer:view.forcedCareer??state.forcedCareer??null};
 if(state.stage==='education-event-roll'&&view.status==='pending'&&view.roll?.id===state.pendingEducationEventRoll?.id&&['1D','2D','D3'].includes(view.roll.dice))return {...base,mode:'roll',pendingId:view.roll.id};
 if(state.stage==='education-event-result'&&view.status==='resolved'&&view.id===state.educationEventResult?.id)return {...base,mode:'result',pendingId:view.id};
 if(view.status==='pending'&&((view.row===2&&state.stage==='effect-choice')||(view.row===10&&state.stage==='education-check')))return {...base,mode:'existing-choice'};
 if(view.status==='pending'&&view.row===11&&state.stage==='effect-choice'&&view.pendingChoice?.options?.length===2&&view.pendingChoice.options[0].label==='Flee'&&view.pendingChoice.options[1].label==='Draft')return {...base,mode:'departure-choice'};
 return null; // Source, injury and other uncovered decisions retain their native UI.
}
function faces(values,esc){return values.map(n=>'<span data-recorded-face="'+esc(n)+'">'+aslanFamilyDie(n)+'</span>').join('');}
function checkSummary(check){
 if(!check)return '';
 const rule=check.comparison==='greater-than'?'Raw 2D > '+check.comparisonStat+' '+check.comparisonScore:(check.skill??check.stat??'Check')+' '+(check.modifier<0?'− '+Math.abs(check.modifier):'+ '+check.modifier)+' · Target '+check.target+'+';
 return rule+' · Total '+check.total+' · '+(check.success?'Success':'Failure');
}
function scalar(value){if(value===null||value===undefined)return 'none';if(typeof value==='object')return value.name??value.role??value.id??JSON.stringify(value);return String(value);}
export function educationAppliedLines(groups){
 const lines=[];
 for(const group of groups??[])for(const change of group.changes??[]){
  const {path,before,after}=change;
  if(path==='relationshipSequence'||/^educations\.\d+\.(event|checkedSkill|graduation\.)/.test(path))continue;
  if(path.startsWith('relationships.')&&after?.role){lines.push(after.role+': '+(after.name??'Recorded relationship'));continue;}
  const label=path.startsWith('skills.')?path.slice(7):path.startsWith('stats.')?path.slice(6):path==='psionEntryPermission'?'Future Psion career attempt permitted':path==='terms'?'Completed terms':path==='age'?'Age':path.replace(/^educations\.\d+\./,'Education: ').replaceAll('.',' · ');
  lines.push(label+': '+scalar(before)+' → '+scalar(after));
 }
 return lines;
}
export function educationCheckpointView(model,{esc,sourceLabel,choiceHtml='',careerLabel=id=>id}){
 const initial='<section class="education-checkpoint-record"><h4>Recorded education event</h4><div class="education-recorded-dice" role="img" aria-label="'+esc(model.eventDice.join(' + ')+' = '+model.eventTotal)+'">'+faces(model.eventDice,esc)+'<strong>= '+esc(model.eventTotal)+'</strong></div></section>';
 const children=(model.childRolls??[]).map(roll=>'<section class="education-checkpoint-child"><h4>'+esc(roll.label)+'</h4>'+(validFaces(roll.values)?'<div class="education-recorded-dice" role="img" aria-label="Recorded dice '+esc(roll.values.join(', '))+'">'+faces(roll.values,esc)+'</div>':'')+'<p>Recorded total: '+esc(roll.total)+(JSON.stringify(roll.kept)!==JSON.stringify(roll.values)?' · Kept/converted: '+esc((roll.kept??[]).join(', ')):'')+'</p>'+(roll.check?'<p class="education-checkpoint-check">'+esc(checkSummary(roll.check))+'</p>':'')+(roll.source?'<small>'+esc(sourceLabel(roll.source.id,roll.source.page))+'</small>':'')+'</section>').join('');
 const changes=educationAppliedLines(model.appliedChanges),applied=changes.length?'<section class="education-checkpoint-applied"><h4>Applied results</h4><ul>'+changes.map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul></section>':model.mode==='result'?'<p class="education-checkpoint-neutral">No character changes recorded for this event.</p>':'';
 let control='';
 if(model.mode==='roll'){
  const r=model.roll,count=r.dice==='2D'?2:1;
  control='<section class="education-checkpoint-next"><h4>'+esc(r.label)+'</h4><p>Roll '+esc(r.dice)+(Number.isFinite(r.modifier)?' '+(r.modifier<0?'− '+Math.abs(r.modifier):'+ '+r.modifier):'')+(Number.isFinite(r.target)?' · Target '+esc(r.target)+'+':'')+'</p>'+(r.comparison==='greater-than'?'<p>Raw 2D must exceed '+esc(r.comparisonStat)+' '+esc(r.comparisonScore)+'. No characteristic DM is added.</p>':'')+(r.dice==='D3'?'<p class="help">Roll one die; convert its face to a D3 result.</p>':'')+'<div class="education-pending-dice" role="img" aria-label="'+count+' '+(count===1?'die':'dice')+', not rolled yet">'+Array.from({length:count},()=>aslanFamilyDie()).join('')+'</div><button type="button" class="education-event-roll" data-action="roll-education-event-step" data-pending-id="'+esc(model.pendingId)+'">Roll '+esc(r.label)+'</button><p>Only this pending roll is performed.</p><small>'+esc(sourceLabel(r.source?.id??'core',r.source?.page??17))+'</small></section>';
 }else if(model.mode==='result')control='<p class="education-checkpoint-neutral">'+(model.pending?(model.pending.kind==='education-ageing'?'The existing source-assisted ageing decision remains after this result.':'A source decision remains after this result.'):model.nextStage==='deceased'?'This event ended character creation.':'This event is resolved. Continue when you are ready.')+'</p><button type="button" class="education-event-roll" data-action="acknowledge-education-event" data-pending-id="'+esc(model.pendingId)+'">Continue →</button>';
 else if(model.mode==='departure-choice')control='<section class="education-checkpoint-next"><h4>Choose your next direction</h4><p>Graduation is no longer permitted for this education term.</p><div class="education-checkpoint-choices"><button type="button" class="education-event-roll" data-action="choose-effect" data-index="0">Flee</button><button type="button" class="education-event-roll" data-action="choose-effect" data-index="1">Draft</button></div><p>Draft opens a separate 1D roll. Choosing it does not roll.</p></section>';
 else control='<div class="education-checkpoint-controls">'+choiceHtml+'</div>';
 const departure=model.mode==='result'&&model.row===3?'<p>Education ended without a graduation attempt. Initial awards and recorded event effects are retained.</p>':'';
 const destination=model.mode==='result'&&model.forcedCareer?'<p class="education-checkpoint-destination">Required next career: '+esc(careerLabel(typeof model.forcedCareer==='string'?model.forcedCareer:model.forcedCareer.id))+'.</p>':'';
 return '<section class="education-checkpoint" data-checkpoint-mode="'+esc(model.mode)+'"><div class="education-event-heading"><h3>University education event</h3></div><p class="education-potential-label">Event '+esc(model.row)+' · '+esc(model.eventName)+'</p>'+initial+children+applied+departure+destination+control+'<p class="education-checkpoint-source">'+esc(sourceLabel(model.source.id,model.source.page))+'</p></section>';
}
