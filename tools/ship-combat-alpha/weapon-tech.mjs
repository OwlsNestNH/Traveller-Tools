import {DRIVE_TECH_PROFILES} from './design-drive-power.mjs';
// The component profile table is shared: High Guard Update 2022 pp70–72.
export const WEAPON_TECH_PROFILES=DRIVE_TECH_PROFILES;
export const WEAPON_TECH_OPTIONS=[
 {id:'accurate',name:'Accurate',side:'advantage',points:2,note:'Attack modifier recorded; no attack automation'},
 {id:'repair',name:'Easy to Repair',side:'advantage',points:1,note:'Repair modifier recorded'},
 {id:'efficient',name:'Energy Efficient',side:'advantage',points:1,power:-.25,note:'25% less weapon Power'},
 {id:'yield',name:'High Yield',side:'advantage',points:1,note:'Damage-die improvement recorded; no damage automation'},
 {id:'veryYield',name:'Very High Yield',side:'advantage',points:2,note:'Damage-die improvement recorded; no damage automation'},
 {id:'focus',name:'Intense Focus',side:'advantage',points:2,note:'Armour piercing recorded; lasers and particle weapons only'},
 {id:'range',name:'Long Range',side:'advantage',points:2,note:'One range-band improvement, capped at Very Long; recorded only'},
 {id:'resilient',name:'Resilient',side:'advantage',points:1,note:'Critical severity reduction recorded'},
 {id:'smaller',name:'Size Reduction',side:'advantage',points:1,note:'10% smaller; not turret weapons; no size automation'},
 {id:'inefficient',name:'Energy Inefficient',side:'disadvantage',points:1,power:.30,note:'30% more weapon Power; not turret weapons'},
 {id:'inaccurate',name:'Inaccurate',side:'disadvantage',points:1,note:'Attack penalty recorded; no attack automation'},
 {id:'larger',name:'Increased Size',side:'disadvantage',points:1,note:'20% larger; no size automation'}
];
export function normalizeWeaponTech(value){
 if(value==null)return null;
 if(typeof value!=='object'||!Object.hasOwn(WEAPON_TECH_PROFILES,value.profile)||!Array.isArray(value.options)||value.options.length>3||typeof value.repeatApproved!=='boolean')throw Error('Invalid weapon tech record.');
 const rows=value.options.map(id=>{const o=WEAPON_TECH_OPTIONS.find(x=>x.id===id);if(!o)throw Error('Choose a verified weapon tech option.');return o;});
 if(new Set(rows.map(o=>o.side)).size>1)throw Error('A weapon cannot mix advantages and disadvantages.');
 const profile=WEAPON_TECH_PROFILES[value.profile],points=rows.reduce((n,o)=>n+o.points,0);
 if(profile.points!=null&&(points>profile.points||rows.some(o=>o.side!==profile.side)))throw Error('Weapon options exceed or conflict with the component profile.');
 if(rows.filter(o=>o.id==='range').length>1)throw Error('Long Range may only be selected once.');
 if(new Set(value.options).size<rows.length&&!value.repeatApproved)throw Error('Repeated weapon options require explicit referee approval.');
 if(value.legacyText!=null&&(typeof value.legacyText!=='string'||value.legacyText.length>100))throw Error('Invalid retained weapon description.');
 return {profile:value.profile,options:[...value.options],repeatApproved:value.repeatApproved,legacyText:value.legacyText??null};
}
export function techCompatible(option,fact,kind){
 if(['yield','veryYield'].includes(option.id))return !!fact&&!['missile','torpedo'].includes(fact.ammo);
 if(option.id==='focus')return !!fact&&/laser|particle/i.test(fact.name);
 if(['smaller','inefficient'].includes(option.id))return ['barbette','bay'].includes(kind);
 return true;
}
export function weaponTechReason(tech,fact,kind){
 if(!tech)return '';
 try{normalizeWeaponTech(tech);}catch(error){return error.message;}
 const rows=tech.options.map(id=>WEAPON_TECH_OPTIONS.find(o=>o.id===id));
 const bad=rows.find(o=>!techCompatible(o,fact,kind));if(bad)return bad.name+' is not verified for this weapon / mount class.';
 const profile=WEAPON_TECH_PROFILES[tech.profile];
 if(profile.points==null)return 'Component tech profile is unverified.';
 if(rows.reduce((n,o)=>n+o.points,0)!==profile.points)return 'Select all options required by the component tech profile.';
 return '';
}
export function legacyWeaponTech(type,kind,facts){
 const parts=type.split(/\s*[,—]\s*/);if(parts.length<2)return null;
 let base=parts.shift().trim();
 if(kind==='barbette')base=({'particle beam':'Particle barbette','beam laser':'Beam laser barbette','pulse laser':'Pulse laser barbette','fusion gun':'Fusion barbette','plasma gun':'Plasma barbette'})[base.toLowerCase()]??base;
 const fact=facts.find(x=>x.name.toLowerCase()===base.toLowerCase());if(!fact)return null;
 const options=parts.map(name=>WEAPON_TECH_OPTIONS.find(o=>o.name.toLowerCase()===name.toLowerCase())?.id);if(options.some(x=>!x)||options.length>3)return null;
 const tech={profile:'unknown',options,repeatApproved:false,legacyText:type};
 try{normalizeWeaponTech(tech);}catch{return null;}
 return {base:fact.name,tech};
}
