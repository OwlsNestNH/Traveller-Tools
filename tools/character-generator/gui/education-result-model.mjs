import {educationTagline} from './education-taglines.mjs';
// HTTP mode receives all verified numbers and consequences from the projection.
export function educationResultModel(projection){
 const model=projection?.educationResultView;
 if(!model)return null;
 return {...model,tagline:educationTagline(model.id,model.kind,model.outcome,model.actionId)};
}
