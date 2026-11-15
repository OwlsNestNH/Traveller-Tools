// Explain projected restrictions; never derive or change assignment eligibility.
const generic='This assignment has additional source prerequisites.';
export function assignmentRestrictionReason(assignment,character,assignmentGenders={}){
 const gender=assignmentGenders?.[assignment.id];
 if(assignment.disabled&&assignment.reason===generic&&['male','female'].includes(gender)&&character?.gender!==gender)return 'Requires '+gender+' Aslan.';
 return assignment.reason??'Unavailable for this character.';
}
export function assignmentRestrictionGroups(career,character){
 const groups=new Map();for(const assignment of career.assignments.filter(a=>a.disabled)){
  const reason=assignmentRestrictionReason(assignment,character,career.eligibility),key=assignment.reason===generic&&reason!==generic?reason:Symbol(assignment.id);if(!groups.has(key))groups.set(key,{reason,ids:[],names:[]});const group=groups.get(key);group.ids.push(assignment.id);group.names.push(assignment.name);
 }return [...groups.values()];
}
