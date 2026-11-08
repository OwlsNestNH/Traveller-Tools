// Derived, deterministic audit detail. The command history remains the saved authority.
const clone=value=>value===undefined?null:structuredClone(value);
export function characterChanges(before,after){
 const changes=[];
 const add=(path,a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))changes.push({path,before:clone(a),after:clone(b)});};
 for(const field of ['name','species','variant','culture','gender','homeworld','age','terms','cash','debt','sentenced','outcast','deceased','qualificationBanned','psionEntryPermission','preCareer','birthOrder','medicalCosts'])add(field,before[field],after[field]);
 for(const field of ['stats','skills'])for(const key of new Set([...Object.keys(before[field]??{}),...Object.keys(after[field]??{})]))add(field+'.'+key,before[field]?.[key],after[field]?.[key]);
 for(const field of ['benefits','relationships','historyNotes','futureConditions','traits','injuries','medicalBills','medicalSettlements','ageingCrises']){
  const old=before[field]??[],next=after[field]??[];for(let i=0;i<Math.max(old.length,next.length);i++)add(field+'.'+i,old[i],next[i]);
 }
 const old=before.careers??[],next=after.careers??[];
 for(let i=0;i<Math.max(old.length,next.length);i++)for(const field of ['id','assignment','terms','rank','officer','benefitRolls','forcedExit','forcedStay','parole','released','pension'])add('careers.'+i+'.'+field,old[i]?.[field],next[i]?.[field]);
 const oldEducation=before.educations??[],newEducation=after.educations??[];
 for(let i=0;i<Math.max(oldEducation.length,newEducation.length);i++){
  const a=oldEducation[i]??{},b=newEducation[i]??{};
  for(const field of ['id','term','completed','graduationAllowed','serviceAwardUsed','careerAttempts','curriculum','citizenBranch'])add('educations.'+i+'.'+field,a[field],b[field]);
  for(const field of ['entry','graduation'])for(const key of ['success','total','target','graduated','honours'])add('educations.'+i+'.'+field+'.'+key,a[field]?.[key],b[field]?.[key]);
  for(const key of new Set([...Object.keys(a.selections??{}),...Object.keys(b.selections??{})]))add('educations.'+i+'.selections.'+key,a.selections?.[key],b.selections?.[key]);
 }
 return changes;
}
