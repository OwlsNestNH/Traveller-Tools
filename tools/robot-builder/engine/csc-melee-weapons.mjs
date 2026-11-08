// Fictional Traveller game profiles. No source scans or real-world instructions.
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const rh=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
// Bounded unpowered profiles with explicit handedness. Staff is only the
// two-handed configuration supported by its shield-parry prose, not all staves.
// Mount sizes follow RH p61 handedness, never weapon mass.
const rows=[
 ['mace','Mace',1,'small','2D+2',3,20,'bludgeon',['Bulky','Smasher'],'132-133','133',false],
 ['staff','Staff (two-handed)',1,'medium','2D',2,5,'bludgeon',[],'133-134,140','133',true],
 ['battle-axe','Battle Axe',1,'small','3D',4,225,'blade',['AP 2','Bulky'],'134-135','135',false],
 ['broadsword','Broadsword',1,'medium','4D',3,500,'blade',['Bulky'],'134-135','135',true],
 ['great-axe','Great Axe',1,'medium','4D+2',8,750,'blade',['Smasher','Very Bulky'],'134-135','135',true],
 ['long-blade-1','Long Blade (TL1)',1,'small','3D',2,200,'blade',[],'134-135','135',false],
 ['long-blade-3','Long Blade (TL3)',3,'small','3D+2',2,300,'blade',[],'134-135','135',false],
 ['monoblade','Monoblade',12,'small','3D',1,2500,'blade',['AP 10'],'134-135','135',false],
 ['buckler','Buckler',1,'small','1D',1,10,'bludgeon',[],'140','140',false]
];
function conditions(id,traits){
 const effects={scope:'Operational game conditions only',resolvedAttack:false,skillGranted:false,defenceGranted:false,bodyMountedDefenceGranted:false};
 if(traits.includes('Smasher'))effects.smasher={targetMayParry:false,condition:'The target is attacked with this Smasher weapon',armourPenetrationGranted:false,source:csc('131')};
 if(id==='staff'||id==='buckler')effects.parry={effectiveMeleeBonus:1,requiresMeleeSkill:true,unskilledEffectiveMelee:null,requiresHeld:true,requiresTwoHands:id==='staff',automaticBonusApplied:false,resolved:false,attackBonus:0,protectionGranted:0,condition:id==='staff'?'Parrying with the staff held in two hands by a wielder with Melee skill':'Parrying with the buckler held in a hand by a wielder with Melee skill',source:csc(id==='staff'?'134,140':'140')};
 return effects;
}
export const CSC_MELEE_WEAPONS=rows.map(([id,name,tl,mountClass,damage,massKg,cost,speciality,traits,pages,tablePage,requiresTwoHands])=>({
 id:'csc-'+id,label:name+' (CSC 2023)',tl,weaponFamily:'melee',sourceFamily:'csc-2023',mountClass,
 range:'Melee',damage,massKg,cost,magazine:null,magazineCost:0,initialIncluded:true,skill:'melee',speciality,traits,implemented:true,requiresTwoHands,
 sourceMeasurements:{mass:{value:massKg,unit:'kg'},source:csc(tablePage)},
 handedness:{hands:requiresTwoHands?2:1,alternateTwoHandedUse:['battle-axe','long-blade-1','long-blade-3'].includes(id),source:csc(id==='mace'?'132':id==='buckler'?'140':id.startsWith('long-blade')||id==='monoblade'?'135':'134'),mountSource:rh('61')},
 // Only source-supported melee accessory families are admitted by the shared rules.
 compatibility:{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,robotPowerConnection:false},
 conditionalEffects:conditions(id,traits),
 ammunitionAccounting:{initialMagazine:'not-applicable',sourceInclusion:'not-applicable',separatelyPricedAmmunition:false,autoloadSupported:false,source:csc(tablePage)},
 source:csc(pages),
 ...(id==='staff'?{interpretation:'This profile represents two-handed staff use. Shield parrying remains conditional on held two-handed use and Melee skill; no mounted defence benefit is granted.'}:{}),
 ...(id==='broadsword'?{interpretation:'The CSC profile is TL1 and 3kg; the distinct Core profile retains its printed TL2 and other source values.'}:{})
}));
