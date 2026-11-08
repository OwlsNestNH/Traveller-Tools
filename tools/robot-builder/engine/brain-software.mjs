import {PACKAGES,SKILLS,source} from './catalogue.mjs';
import {characteristicDM} from './characteristics.mjs';
import {normalSpeciality} from './skill-coverage.mjs';
import {assertKeys,integer,clone} from './schema.mjs';
const lookup=(rows,id)=>{const row=rows.find(r=>r.id===id);if(!row)throw new TypeError('Unknown software choice: '+id);return row;};
const specialityCoverage=pkg=>pkg.coveredSpecialities?.map(normalSpeciality)??[normalSpeciality(pkg.speciality??'')];
export function validateSoftwareSelection(selection){
 assertKeys(selection,['packages','customPackages'],'software');
 if(!Array.isArray(selection.packages)||selection.packages.length>100||new Set(selection.packages).size!==selection.packages.length)throw new TypeError('Invalid package collection');
 for(const id of selection.packages)lookup(PACKAGES,id);
 if(!Array.isArray(selection.customPackages)||selection.customPackages.length>100)throw new TypeError('Invalid custom package collection');
 const ids=new Set();for(const pkg of selection.customPackages){assertKeys(pkg,['id','skill','speciality','level'],'custom package');if(typeof pkg.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(pkg.id)||ids.has(pkg.id))throw new TypeError('Invalid custom package ID');ids.add(pkg.id);if(!['language','profession','science','art-instrument'].includes(pkg.skill))throw new TypeError('Custom speciality not permitted');if(typeof pkg.speciality!=='string'||!pkg.speciality.trim()||pkg.speciality.length>120)throw new TypeError('Custom speciality required');integer(pkg.level,0,3,'custom package level');}
}
// Callers supply a source-defined brain and module, never a user-supplied price override.
export function evaluateBrainSoftware({brain,upgrade,techLevel:tl,settings,selection,core={id:'none',family:'none',bandwidth:0},coreBandwidth=core.bandwidth,coreSkills=[],manipulators=[],brainSlots=0,retrotech=true}){
 validateSoftwareSelection(selection);integer(settings.intellectUpgrade,0,3,'intellectUpgrade');if(typeof settings.hardened!=='boolean')throw new TypeError('hardened must be boolean');
 const s={brain:settings,skills:selection},diagnostics=[],ledger=[];let cost=0,used=0;
 const issue=(severity,code,path,message,pages)=>diagnostics.push({severity,code,path,message,source:source(pages)});
 const error=(...args)=>issue('error',...args),block=(...args)=>issue('blocker',...args);
 const entry=(id,label,cost,slots,pages,extra={})=>ledger.push({id,label,cost,slots,source:source(pages),accountingDomain:'brain-software',...extra});
 if(upgrade.tl>tl||upgrade.rank>brain.rank)error('BANDWIDTH_UPGRADE','brain.bandwidthUpgrade','This bandwidth module requires higher technology or brain capability.','67');
 if(s.brain.hardened&&tl<8)error('MIN_TL','brain.hardened','Brain hardening requires TL8.','67');
 const brainCost=brain.cost*(retrotech&&brain.rank>=3?.5**(tl-brain.tl):1)*(s.brain.hardened?1.5:1),upgradeCost=upgrade.cost*(s.brain.hardened?1.5:1);
 used+=brainSlots+(upgrade.bandwidth?1:0);cost+=brainCost+upgradeCost;entry('brain','Robot brain',brainCost,brainSlots,'66–67');if(upgrade.bandwidth)entry('bandwidth','Bandwidth upgrade',upgradeCost,1,'67');
 const intellect=s.brain.intellectUpgrade,intelligence=brain.intelligence+intellect,intellectBW=intellect*(intellect+1)/2;
 let intellectCost=intellect?1000:0;for(let n=1;n<=intellect;n++)intellectCost*=brain.intelligence+n;if(intelligence>=12)intellectCost*=2;cost+=intellectCost;if(intellect)entry('intellect','Intellect upgrade',intellectCost,0,'67',{bandwidth:intellectBW});
 let bwUsed=intellectBW+coreBandwidth,zeroBW=0;const packages=[...s.skills.packages.map(id=>lookup(PACKAGES,id)),...s.skills.customPackages.map(custom=>{
  const base=SKILLS.find(skill=>skill.id===(custom.skill==='art-instrument'?'art':custom.skill)),speciality=(custom.skill==='art-instrument'?'instrument: ':'')+custom.speciality.trim();
  return{id:'custom-'+custom.id,label:base.label+' ('+speciality+') '+custom.level,skill:base.id,speciality,level:custom.level,tl:base.tl+custom.level,bandwidth:base.bandwidth+custom.level,cost:base.cost*10**custom.level,characteristic:base.characteristic,implemented:true,custom:true};
 })],skillIds=new Set(),skillScopes=[],skills=[...coreSkills];
 if(brain.rank===0&&packages.length)error('PRIMITIVE_STANDARD_SKILLS','skills.packages','Primitive brains cannot install standard skill packages.','69');
 if(brain.family==='basic'&&core.id!=='basic-none'&&packages.length)error('BASIC_FIXED_SKILLS','skills.packages','This Basic brain uses its fixed function rather than general skill packages.','70–71');
 for(const pkg of packages){
  if(brain.family==='basic'&&pkg.level>1)error('BASIC_SKILL_LEVEL','skills.packages','Basic (none) is limited to skill level one.','71');
  if(pkg.refereeBroad)issue('warning','REFEREE_BROAD_SKILL','skills.packages','Using the explicitly selected '+pkg.packageCount+'-package referee rule for '+pkg.skill+': '+(pkg.coversAllSpecialities?'all specialities, including open/custom specialities. Referee approval is required.':'legacy listed specialities only; saved scope is unchanged. Select a full-coverage choice separately for all specialities.'),'73');
  if(!pkg.implemented)block('SPECIALITY_REQUIRED','skills.packages',pkg.reason,'73–74');
  const skillKey=pkg.skill+(pkg.speciality?':'+pkg.speciality.trim().toLowerCase().replaceAll(' ','-'):'');
  const coverage=specialityCoverage(pkg);
  if(skillIds.has(skillKey)||skillScopes.some(previous=>previous.skill===pkg.skill&&(previous.coversAllSpecialities||pkg.coversAllSpecialities||previous.coverage.some(speciality=>coverage.includes(speciality)))))error('DUPLICATE_SKILL','skills.packages','Install only one level of each covered skill speciality.','73');
  skillIds.add(skillKey);skillScopes.push({skill:pkg.skill,coverage,coversAllSpecialities:pkg.coversAllSpecialities===true});
  if(pkg.tl>tl)error('MIN_TL','skills.packages',`${pkg.label} exceeds design technology.`,'73–74');
  if((pkg.perPackageBandwidth??pkg.bandwidth)>brain.bandwidth)error('INHERENT_BANDWIDTH','skills.packages',`${pkg.label} exceeds inherent brain bandwidth; storage upgrades do not raise this limit.`,'67,73');
  if(pkg.bandwidth===0)zeroBW++;else bwUsed+=pkg.bandwidth;
  cost+=pkg.cost;entry(pkg.id,pkg.label,pkg.cost,0,'73–74',{bandwidth:pkg.bandwidth});
  const modifier=pkg.characteristic==='INT'?characteristicDM(intelligence):null;
  const modifierOptions=pkg.characteristic==='DEX'?manipulators.map(a=>({manipulatorId:a.id,modifier:characteristicDM(a.dexterity),effectiveLevel:pkg.level+characteristicDM(a.dexterity)})):[];
  skills.push({id:skillKey,skill:pkg.skill,...(pkg.refereeBroad?{label:pkg.label}:{}),source:pkg.source??source('73-74'),...(pkg.speciality?{speciality:pkg.speciality,grantsOtherSpecialitiesAtZero:pkg.level>0&&pkg.skill!=='profession'}:{}),...(pkg.coveredSpecialities?{coveredSpecialities:pkg.coveredSpecialities}:{}),...(pkg.refereeBroad?{refereeBroad:true,packageCount:pkg.packageCount,coversAllSpecialities:pkg.coversAllSpecialities===true}:{}),level:pkg.level,characteristic:pkg.characteristic,modifier,effectiveLevel:modifier===null?null:pkg.level+modifier,...(modifierOptions.length?{modifierOptions}:{})});
 }
 const zeroBWAllowance=brain.rank>=2?brain.bandwidth:0;bwUsed+=Math.max(0,zeroBW-zeroBWAllowance);
 const bandwidthCapacity=brain.bandwidth+upgrade.bandwidth;
 if(bwUsed>bandwidthCapacity)error('BANDWIDTH_EXCEEDED','skills.packages','Installed packages and intellect upgrade exceed available bandwidth.','67,73');
 return clone({cost,softwareCost:packages.reduce((sum,pkg)=>sum+pkg.cost,0),slots:used,brainCost,upgradeCost,intellectCost,intellectBW,intelligence,bwUsed,zeroBW,zeroBWAllowance,bandwidthCapacity,packages,skills,diagnostics,ledger});
}
