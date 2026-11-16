import {undercoverEventProgression} from './undercover-event-progression.mjs';
import {eventStoryIdentity} from './event-story-presentation.mjs';
import {crowSpeakingPanel} from './crow-speaking-panel.mjs';
import {characterEffectDetails,modifierEffectDetails,pendingEffectDetails} from './roll-result-view.mjs';
export function careerEventReviewModel(projection,catalog){
 const review=projection?.careerEventReview;if(!review)return null;
 const event=review.effectEvent??projection.log.find(e=>e.id===review.id);if(!event)return null;
 if(!undercoverEventProgression(projection,event))return null;
 const result=event.eventResults?.at(-1),story=eventStoryIdentity(result,event.eventResults),roles={};
 const before=event.relationshipChanges?.before??[],after=event.relationshipChanges?.after??[],relationshipUpdates=[];
 for(const r of after){const previous=before.find(p=>p.id===r.id);if(!previous)roles[r.role]=(roles[r.role]??0)+1;else if(previous.role!==r.role)relationshipUpdates.push((r.name||previous.name||'Unnamed person')+': '+previous.role+' becomes '+r.role+'.');}
 for(const r of before)if(!after.some(p=>p.id===r.id))relationshipUpdates.push('Lose '+r.role+': '+(r.name||'Unnamed person')+'.');
 const gains=Object.entries(roles).map(([role,n])=>'Gain '+n+' '+role+(n>1?'s':'')+'.');
 const credits=(event.changes??[]).filter(c=>/^benefitCredits\.\d+(\.value)?$/.test(c.path)&&c.before==null&&(c.after?.value??c.after)>0).map(c=>'Benefit roll DM +'+(c.after?.value??c.after)+' available.');
 const rest=characterEffectDetails({...event,changes:event.changes.filter(c=>!c.path.startsWith('relationships.')&&!c.path.startsWith('benefitCredits.')&&!c.path.startsWith('crossCareerRoutes.')&&!/^careers\.\d+\.(terms|successfulTerms)$/.test(c.path)&&!['terms','age'].includes(c.path))},catalog);
 const relationships=(projection.state.character.relationships??[]).filter(r=>(event.changes??[]).some(c=>c.path.startsWith('relationships.')&&!c.before&&c.after?.id===r.id));
 return {projection,id:review.id,event,relationships,nextLabel:projection.state.stage==='term-end'?'Continue to term end':projection.state.stage==='cross-career-training'?'Continue to training':'Continue to advancement',eventNumber:result?.row,title:story.name,eventLabel:story.label,description:story.description,total:result?.roll?.total??event.rolls?.at(-1)?.total,results:[...(result?.title?.startsWith('Event random result')&&result.summary==='No automatic mechanical effect.'?['No additional consequence from this follow-up roll.']:[]),...gains,...relationshipUpdates,...credits,...rest,...modifierEffectDetails({modifiers:event.modifierChanges?.before},{modifiers:event.modifierChanges?.after},catalog),...pendingEffectDetails(event,catalog)],detail:result?.summary??'',source:result?.source};
}
export function careerEventReviewView(model,{esc,crowType='generic',step=0}){
 const progression=undercoverEventProgression(model.projection,model.event);
 if(progression){const current=progression[Math.min(step,progression.length-1)];model={...model,...current,relationships:current.relationshipStep?model.relationships:[],eventLabel:current.label,results:current.relationshipStep?model.results.filter(line=>!/^Benefit rolls:|No additional consequence/.test(line)):current.results};if(step<progression.length-1){model.nextLabel='Continue';model.progressing=true;}}

 const fields=model.relationships.map(r=>'<label class="education-relationship-name">'+esc(r.role)+' name<input maxlength="120" data-career-event-relationship="'+esc(r.id)+'" data-pending-id="'+esc(model.id)+'" value="'+esc(r.name?.startsWith('Unnamed ')?'':r.name)+'" placeholder="Optional name"></label>').join('');
 const die=Number.isFinite(model.total)?'<svg class="aslan-family-die" viewBox="0 0 100 100" role="img" aria-label="Recorded total '+esc(model.total)+'"><rect x="3" y="3" width="94" height="94" rx="16" fill="none" stroke="currentColor" stroke-width="5"/><text x="50" y="68" text-anchor="middle" fill="currentColor" font-size="52" font-weight="800">'+esc(model.total)+'</text></svg>':'';
 return '<section id="career-event-review"><p class="education-war-context">'+esc(model.eventLabel)+'</p><h3>'+esc(model.title)+'</h3>'+crowSpeakingPanel({message:model.description||'Your event is resolved.',type:crowType})+'<div class="education-recorded-dice" style="color:#ffd34b">'+die+'</div><div class="event-result-gains"><p><strong>Result: '+esc(model.results.length?model.results.join(' '):'No character changes recorded.')+'</strong></p></div>'+fields+'<button type="button" class="education-event-roll" data-action="'+(model.progressing?'next-career-event-review':'acknowledge-career-event-result')+'" data-pending-id="'+esc(model.id)+'">'+esc(model.nextLabel)+'</button><button type="button" data-action="career-event-result-info" class="crow-assistance-info" aria-haspopup="dialog" aria-label="Event information">&#9432;</button></section>';
}
