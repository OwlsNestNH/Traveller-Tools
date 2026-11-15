// Display only: a recorded requirement is not permission to change eligibility.
export function requiredCareerPresentation(state){
 if(state?.stage!=='career'||state.forcedCareerDraft||typeof state.forcedCareer!=='string'||state.forcedCareer==='draft'||!Array.isArray(state.careerChoices)||!Number.isInteger(state.character?.terms)||state.character.terms<0)return null;
 const enabled=state.careerChoices.filter(c=>!c.disabled),career=enabled.find(c=>c.id===state.forcedCareer);
 if(!career||enabled.length!==1)return null;
 return {career,term:state.character.terms+1,others:state.careerChoices.filter(c=>c.id!==career.id)};
}
export function requiredCareerInformation(state,sourceLabel){
 const model=requiredCareerPresentation(state);if(!model)return null;
 return {title:'Required next career',crowType:'referee',paragraphs:['The recorded outcome requires '+model.career.name+' for term '+model.term+'. Other careers cannot replace that required entry. Choosing a specialty does not reroll the earlier result.',...model.others.map(c=>c.name+': '+(c.reason??'The recorded outcome requires a different career.')+' '+sourceLabel(c.source,c.page))],source:sourceLabel(model.career.source,model.career.page)};
}

export function requiredCareerInformationButton(){return '<button type="button" class="opening-info-trigger required-career-information quiet" data-action="required-career-information" aria-label="Why other careers are unavailable" aria-haspopup="dialog" aria-controls="opening-help-dialog" title="Why other careers are unavailable"><span aria-hidden="true">i</span></button>';}
