// Robot Handbook pp26,73; Core Rulebook Update 2022 p58 (Profession pp70-71).
// Resolve installed software levels only. Characteristic and fire-control DMs stay with callers.
export const normalSpeciality=value=>String(value??'').trim().toLowerCase().replaceAll(' ','-');
function identity(row){
 const id=String(row.id??''),[base,...parts]=id.split(':');
 if(row.skill)return {skill:normalSpeciality(row.skill),speciality:normalSpeciality(row.speciality)};
 if(parts.length)return {skill:base,speciality:normalSpeciality(row.speciality??parts.join(':'))};
 // Legacy hard-coded packages retain their saved/output IDs and narrow task scope.
 if(row.characteristic==='hard-coded')for(const skill of ['athletics','profession','tactics'])if(id.startsWith(skill+'-'))return {skill,speciality:normalSpeciality(id.slice(skill.length+1))};
 return {skill:base,speciality:normalSpeciality(row.speciality)};
}
export function resolveSkillLevel(rows,skill,speciality,{untrained=-3}={}){
 const target=normalSpeciality(skill),wanted=normalSpeciality(speciality);let best=null;
 const include=level=>{best=best===null?level:Math.max(best,level);};
 for(const row of rows??[]){
  if(!Number.isFinite(row.level))continue;
  const current=identity(row);if(current.skill!==target)continue;
  const coverage=row.coveredSpecialities?.map(normalSpeciality)??[];
  if(!wanted||current.speciality===wanted||row.coversAllSpecialities===true||coverage.includes(wanted))include(row.level);
  // A generic standard level-zero package covers ordinary specialities, never Profession.
  else if(!current.speciality&&row.level===0&&target!=='profession'&&row.characteristic!=='hard-coded')include(0);
  // Core's zero fallback never grants a positive level or widens a hard-coded function.
  else if(row.level>0&&row.grantsOtherSpecialitiesAtZero===true&&target!=='profession'&&row.characteristic!=='hard-coded')include(0);
 }
 return best??untrained;
}
