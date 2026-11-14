import {knownSkillOptions} from './skill-knowledge.mjs';
import {educationTagline} from './education-taglines.mjs';
// HTTP mode receives all verified numbers and consequences from the projection.
export function educationResultModel(projection,catalog=null){
 const model=projection?.educationResultView;
 if(!model)return null;
 const state=projection.state,record=state?.character?.educations?.[state.education],career={'core.academy-army':'core.army','core.academy-marine':'core.marine','core.academy-navy':'core.navy'}[model.id];
 const alreadyKnown=model.kind==='admission'&&model.outcome!=='failure'&&record?.id===model.id?knownSkillOptions(catalog?.careerPresentation?.[career]?.basicTraining?.skillOptions,record.skillsBefore):[];
 return {...model,...(alreadyKnown.length?{alreadyKnown}:{}),tagline:educationTagline(model.id,model.kind,model.outcome,model.actionId)};
}
