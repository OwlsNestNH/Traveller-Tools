import {educationAppliedLines} from './education-event-checkpoint-view.mjs';
import {aslanFamilyDie} from './aslan-family-popup.mjs';
import {crowSpeakingPanel} from './crow-speaking-panel.mjs';
const names={'core.university':'University','core.academy-army':'Army academy','core.academy-marine':'Marine academy','core.academy-navy':'Navy academy'};
export function educationWarDraftModel(projection){
 if(projection?.educationWarDraftView)return {...projection.educationWarDraftView,educationName:names[projection.educationWarDraftView.educationId]};
 const v=projection?.educationEventView,s=projection?.state;if(v?.row!==11||!Array.isArray(v.eventDice)||v.eventDice.length!==2||v.eventDice.reduce((a,b)=>a+b,0)!==11)return null;
 const educationId=v.educationId??'core.university';if(!names[educationId])return null;
 let mode;if(s.stage==='education-event-roll'&&v.status==='pending'&&v.roll?.id===s.pendingEducationEventRoll?.id)mode='roll';else if(s.stage==='education-event-result'&&v.status==='resolved'&&v.id===s.educationEventResult?.id)mode='result';else if(s.stage==='effect-choice'&&v.pendingChoice?.options?.length===2&&v.pendingChoice.options[0].label==='Flee'&&v.pendingChoice.options[1].label==='Draft')mode='departure-choice';else return null;
 const record=s.character.educations[v.educationIndex],child=(v.childRolls??[]).find(r=>r.label==='SOC check');
 return {...v,kind:'war-draft',mode,educationId,educationName:names[educationId],nextTerm:record.term+1,separateDraftRoll:true,check:child?.check?{...child.check,values:child.values,natural:child.total}:null};
}
const signed=n=>(n<0?'− ': '+ ')+Math.abs(n);
function dice(values,total,label,esc){
 const known=Array.isArray(values)&&values.length&&values.every(n=>Number.isInteger(n)&&n>=1&&n<=6);
 return '<section class="education-war-record"><h4>'+esc(label)+'</h4>'+(known?'<div class="education-recorded-dice" role="img" aria-label="'+esc(label+': '+values.join(' + ')+' = '+total)+'">'+values.map(n=>'<span data-recorded-face="'+n+'">'+aslanFamilyDie(n)+'</span>').join('')+'<strong>= '+esc(total)+'</strong></div>':'')+'</section>';
}
export function educationWarDraftView(model,{esc,careerLabel=id=>id}){
 const check=model.check,forced=model.forcedCareer,career=typeof forced==='string'?forced:forced?.id;
 const outcome=check?(check.success?'Draft avoided · graduation is available':'SOC check failed · no graduation this term'):'War interrupts your education';
 const message=model.mode==='departure-choice'?'Choose Drifter next term or submit to the military draft. Your SOC check is already recorded.':model.mode==='roll'?(model.roll.label==='SOC check'?'Roll SOC 9+ to see whether you can avoid the draft and attempt graduation.':'Roll the draft destination. This result determines your next career.'):career?'Your next career is '+careerLabel(career)+' in term '+model.nextTerm+'. Continue when ready.':'You avoided the draft. Continue to your graduation attempt.';
 const type=model.educationId==='core.academy-navy'?'navy':model.educationId.startsWith('core.academy-')?'military':'skills';
 let controls='';
 if(model.mode==='departure-choice')controls='<div class="education-war-choices"><button type="button" class="education-event-roll" data-action="choose-effect" data-index="0"><strong>Flee</strong><small>Drifter · next term '+esc(model.nextTerm)+'</small></button><button type="button" class="education-event-roll" data-action="choose-effect" data-index="1"><strong>Draft</strong><small>'+(model.separateDraftRoll?'Open the military draft roll':'Roll the military draft destination')+'</small></button></div>';
 else if(model.mode==='roll')controls='<p class="education-war-pending">Not rolled yet · '+esc(model.roll.dice)+(Number.isFinite(model.roll.modifier)?' '+signed(model.roll.modifier):'')+(Number.isFinite(model.roll.target)?' · Target '+model.roll.target+'+':'')+'</p><button type="button" class="education-event-roll" data-action="roll-education-event-step" data-pending-id="'+esc(model.pendingId??model.roll.id)+'">Roll '+esc(model.roll.label)+'</button>';
 else controls='<button type="button" class="education-event-roll" data-action="acknowledge-education-event" data-pending-id="'+esc(model.pendingId??model.id)+'">'+esc(career?'Continue to '+careerLabel(career)+' · term '+model.nextTerm:'Continue to graduation')+'</button>';
 const children=(model.childRolls??[]).filter(r=>r.label!=='SOC check').map(r=>dice(r.values,r.total,r.label,esc)).join('');
 return '<section class="education-war-draft" data-war-mode="'+esc(model.mode)+'"><p class="education-war-context">'+esc(model.educationName)+' · Education event 11</p><h3 class="education-war-outcome" data-tone="'+(check?.success?'success':check?'failure':'information')+'">'+esc(outcome)+'</h3>'+crowSpeakingPanel({message,aside:'The recruitment office has noticed you. A triumph of terrible timing.',type,tone:check?.success?'success':check?'failure':'information'})+'<div class="education-war-rolls">'+dice(model.eventDice,model.eventTotal,'Education event',esc)+(check?dice(check.values,check.natural,'SOC check',esc)+'<p class="education-war-equation">'+esc(check.natural+' '+signed(check.modifier)+' = '+check.total+' · Target '+check.target+'+ · '+(check.success?'Success':'Failure'))+'</p>':'')+children+'</div>'+(career?'<p class="education-war-destination">Required next career: <strong>'+esc(careerLabel(career))+'</strong> · term '+esc(model.nextTerm)+'</p>':'')+controls+'</section>';
}
export function educationWarDraftInformation(model,{esc,sourceLabel}){
 return '<h3>War and the draft</h3><p>Success on SOC 9+ permits a normal graduation attempt. Otherwise, this education term ends without graduation: Flee enters Drifter next term; Draft selects Army (1–3), Marine (4–5) or Navy (6) with 1D. This event uses its own military draft, rather than the ordinary six-career draft table.</p>'+(model.description?'<p>'+esc(model.description)+'</p>':'')+(model.summary?'<p>'+esc(model.summary)+'</p>':'')+'<ul>'+educationAppliedLines(model.appliedChanges,model.appliedStateChanges).map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul>'+'<p>'+esc(sourceLabel('core',17))+'</p><p>Accepted event and SOC results stay recorded. Viewing this information, closing the popup or reloading does not roll again.</p>';
}
