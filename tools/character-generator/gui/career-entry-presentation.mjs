import {nobleAutomaticQualification} from '../shared/automatic-qualification.mjs';
// UI wording only. The engine retains every eligibility and entry decision.
export function careerEntryPresentation(state,career){
 const ordinary=career.qualification?career.qualification.stat+' '+career.qualification.target+'+':'automatic',noble=nobleAutomaticQualification(career.id,state.character.stats),rights=(state.careerTransferOptions??[]).filter(right=>right.careerId===career.id&&right.available);
 let qualificationLabel=ordinary,shownInRequirements=false;
 if(career.aslanAccess?.automatic)qualificationLabel='automatic via recorded outward source right';
 else if(rights.some(right=>!right.assignmentId))qualificationLabel='automatic via recorded transfer';
 else if(rights.length)qualificationLabel='automatic transfer for '+rights.map(right=>career.assignments.find(a=>a.id===right.assignmentId)?.name??right.assignmentId).join(', ')+'; otherwise '+ordinary;
 else if(noble){qualificationLabel='automatic (SOC 10 or higher)';shownInRequirements=true;}
 return {qualificationLabel,contextual:qualificationLabel!==ordinary,shownInRequirements,actionLabel:state.forcedCareer===career.id?'Enter '+career.name+' for term '+(state.character.terms+1):!career.qualification||noble?'Enter this career':'Attempt this career'};
}
