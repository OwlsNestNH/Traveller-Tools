// Cosmetic context only. Never infer a missing historical specialty.
export function crowCareerAssignment(state,careerId,event=null){
 const transition=state?.character?.careerTransitions?.at(-1);
 if(state?.stage==='failed-entry'||event?.type==='career'&&transition?.status==='failed'){
  return transition?.status==='failed'&&transition.toCareerId===careerId?transition.toAssignment??null:null;
 }
 const records=state?.character?.careers??[],active=records[state?.active];
 const record=active?.id===careerId?active:event?.type==='benefit'&&records.at(-1)?.id===careerId?records.at(-1):null;
 return record?.assignment??null;
}
