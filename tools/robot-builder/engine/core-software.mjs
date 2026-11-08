import {source} from './catalogue.mjs';
// Hard-coded package rules shared by ordinary robots and source-defined microbrains.
// Callers provide installed equipment and weapon skill identities; no hardware is inferred.
export function evaluateCoreSoftware({brain,core,selection,options=[],weaponSkills=[],primaryLocomotion='none',agility=0}){
 const diagnostics=[],coreSkills=[];let coreBandwidth=core.bandwidth;
 const issue=(severity,code,path,message,pages)=>diagnostics.push({severity,code,path,message,source:source(pages)});
 const error=(...args)=>issue('error',...args),block=(...args)=>issue('blocker',...args);
 if((brain.rank>=2&&core.id!=='none')||(brain.rank<2&&brain.id!=='none'&&core.family!==brain.family))error('CORE_PACKAGE_FAMILY','skills.corePackage','Hard-coded package does not match the selected brain family.','69–73');
 if(!core.implemented)block('CORE_PACKAGE_PENDING','skills.corePackage',core.reason,'69–73');
 if(core.id==='primitive-clean'&&!options.some(o=>o.id.includes('clean')))error('CLEANING_EQUIPMENT','skills.corePackage','Primitive cleaning requires a domestic or industrial cleaning option.','69');
 if(core.family==='hunter-killer'){
  if(selection.hunterBandwidth==='unresolved')block('HUNTER_BANDWIDTH_INTERPRETATION','skills.hunterBandwidth','The Hunter/Killer package section does not explicitly state bandwidth occupancy. Select a disclosed referee interpretation.','72-73');
  else{coreBandwidth=selection.hunterBandwidth==='zero'?0:1;issue('warning','HUNTER_BANDWIDTH_INTERPRETATION','skills.hunterBandwidth','Using the explicitly chosen '+coreBandwidth+' BW interpretation for the hard-coded package.','72-73');}
 }
 const coreSkillEntries=core.id==='basic-servant'?[['profession-'+selection.servantProfession,2]]:core.id==='basic-target'&&selection.targetMode==='weapon'?[['weapon',1],['recon',0],...(options.some(o=>o.exclusive==='self-destruct')?[['explosives',0]]:[])]:core.skills;
 if(core.id==='basic-target'&&selection.targetMode==='weapon'&&!weaponSkills.includes(selection.coreWeapon))error('TARGET_WEAPON_REQUIRED','skills.coreWeapon','The target package weapon speciality must match an installed melee or ranged weapon.','72');
 for(const [id,level] of coreSkillEntries){
  let skillId=id;if(id==='weapon'){
   if(selection.coreWeapon==='unspecified')block('CORE_WEAPON_REQUIRED','skills.coreWeapon','Choose the hard-coded weapon speciality.','69-73');
   else{skillId=selection.coreWeapon;if(core.family==='hunter-killer'&&!['gun-combat','melee'].includes(skillId.split(':')[0]))error('HUNTER_WEAPON','skills.coreWeapon','Hunter/Killer standard packages specify Gun Combat or Melee.','73');}
  }
  coreSkills.push({id:skillId,level,characteristic:'hard-coded',modifier:0,effectiveLevel:level});
 }
 if(core.id==='basic-locomotion'){coreSkills.push({id:'athletics-dexterity',level:agility,characteristic:'hard-coded',modifier:0,effectiveLevel:agility},{id:'vehicle-'+primaryLocomotion,level:agility,characteristic:'hard-coded',modifier:0,effectiveLevel:agility});}
 return {coreBandwidth,coreSkills,diagnostics};
}
