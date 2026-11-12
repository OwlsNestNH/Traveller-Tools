// Projection-only chronology. Never stored in commands, rolled, or used by rules.
const integer=n=>Number.isInteger(n)&&n>=0;
const boundaryStages=new Set(['term-end','ageing','benefits','benefit-wager','career','finish','retirement','equipment-finalization']);
function context(state){
 const completed=state?.character?.terms;
 if(!integer(completed))return {phase:'unknown',term:null};
 const education=state.character.educations?.[state.education];
 if(education&&!education.completed&&integer(education.term))return {phase:'term',term:education.term,educationId:education.id};
 const career=state.character.careers?.[state.active];
 const next=state.stage==='book-step'?state.pending?.next:state.effectNext;
 // Exiting/mustering-out records retain `active`, but do not start another term.
 if(career&&!career.exit&&!boundaryStages.has(state.stage)&&!boundaryStages.has(next))return {phase:'term',term:completed+1,careerId:career.id};
 return {phase:completed===0?'before':'after',term:completed===0?1:completed,...(career?{careerId:career.id}:{})};
}
export function characterSheetTiming(before,after){
 const a=context(before),b=context(after),beforeTerms=before?.character?.terms,afterTerms=after?.character?.terms;
 // A command completing an education/career term belongs to the term it closes.
 const at=Number.isInteger(beforeTerms)&&Number.isInteger(afterTerms)&&afterTerms>beforeTerms
  ?{phase:'term',term:afterTerms,...(a.educationId?{educationId:a.educationId}:{}),...(a.careerId?{careerId:a.careerId}:{})}
  :a.phase==='term'?a:b.phase==='term'?b:a;
 return {...at,beforeTerms,afterTerms,stageBefore:before?.stage??null,stageAfter:after?.stage??null};
}
