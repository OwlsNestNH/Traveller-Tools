// Aliens of Charted Space Volume 1 Update 2026 pp.19–20.
// Page 19 explicitly permits culturally atypical skills; p.20 separately restricts
// Independence to males. Symbol-only event awards on pp.31,33,35,37,39,41,45
// use cultural associations, including Mechanic for the male-only Wanderer.
export const ASLAN_CULTURAL_SKILL_SOURCE=Object.freeze({id:'aliens',page:19});
const MARKED_SKILLS=new Set(['Heavy Weapons','Leadership','Electronics (comms)','Mechanic','Tactics (military)','Engineer','Gunner','Science','Astrogation','Steward','Tactics (naval)','Broker','Gunner (turret)']);
// Recognize only the historical genderAward wrapper, not real conditional awards.
// Its original shape remains intact so .16/.17 saved characters replay unchanged.
export function culturalSkillAward(effect){
 return effect?.kind==='conditional'&&Object.keys(effect.condition??{}).length===1&&['male','female'].includes(effect.condition.gender)&&effect.then?.length>0&&effect.then.every(e=>e.kind==='skill'&&MARKED_SKILLS.has(e.name))&&effect.otherwise?.length===1&&effect.otherwise[0].kind==='source-required'&&effect.otherwise[0].reason==='This award is restricted by gender. Choose another permitted award.';
}
export function culturalAwardLabel(option){
 const marked=option.effects?.filter(culturalSkillAward)??[];
 if(!marked.length)return option;
 const gender=[...new Set(marked.map(e=>e.condition.gender))].join('/');
 return {...option,label:option.label+' ('+gender+'-associated)',culturalPreference:{gender,restricted:false,source:ASLAN_CULTURAL_SKILL_SOURCE,note:'Cultural preference, not a prohibition. Other genders may learn this skill.'}};
}

// Read directly from the orange/blue/gray Aslan Skills table, Aliens 2026 p.19.
// Unqualified base skills can contain both culturally marked and common specialties.
export const ASLAN_SKILL_LEGEND='Aslan cultural associations (Aliens 2026 p. 19): male-associated and female-associated skills may be learned by other genders; rare skills are permitted. Common skills are unmarked. Independence alone is male-only and requires its acquisition check (p. 20). Career and background eligibility are separate rules.';
export function aslanSkillLabel(name){
 const base=name.split(' (')[0],subject=name.match(/ \(([^)]+)\)$/)?.[1];let label;
 if(base==='Independence')label='male-only; acquisition check';
 else if(['Leadership','Tactics'].includes(base))label='male-associated';
 else if(['Astrogation','Broker','Engineer','Mechanic','Profession','Science','Steward'].includes(base))label='female-associated';
 else if(base==='Gunner')label=subject?(['capital','turret'].includes(subject)?'male-associated':null):'capital/turret male-associated';
 else if(base==='Heavy Weapons')label=subject?(['portable','vehicle'].includes(subject)?'male-associated':null):'portable/vehicle male-associated';
 else if(base==='Animals')label=subject?(subject==='veterinary'?'female-associated':null):'veterinary female-associated';
 else if(base==='Electronics')label=subject?(subject!=='sensors'?'female-associated':null):'all except sensors female-associated';
 else if(base==='Gambler')label='rare';
 else if(base==='Melee')label=subject?(['blade','unarmed'].includes(subject)?'rare':null):'blade/unarmed rare';
 return label?name+' ['+label+']':name;
}
