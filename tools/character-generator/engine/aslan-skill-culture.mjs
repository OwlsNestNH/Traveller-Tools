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
