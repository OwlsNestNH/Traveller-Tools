// Fictional Traveller game profiles. No source scans or real-world instructions.
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const silent=()=>({soundSourceDetectionDM:-6,condition:'Detecting the source of this weapon sound',source:csc('131')});
const dangerous=()=>({maximumAttackEffect:-5,damageToUser:true,weaponInoperable:true,condition:'Failed attack at or below the listed Effect',source:csc('131')});
const pellets=()=>({condition:'Using pellet ammunition',ignoreDodgeDM:true,armourProtectionMultiplier:2,damageBeyondListedRangeMultiplier:.5,source:csc('148')});

// The source groups these as slug pistols/rifles. Mounts follow RH p61 categories,
// not the miscellaneous-implant mass threshold (the 1 kg Snub Carbine is a rifle).
const rows=[
 ['assault-pistol','Assault Pistol',6,'pistol',10,'3D-3',1,250,15,10,['Auto 2'],'142-143'],
 ['cartridge-pistol','Cartridge Pistol',7,'pistol',10,'4D',1.5,300,6,10,['Bulky'],'142-143'],
 ['coach-pistol','Coach Pistol',3,'pistol',5,'4D-3',2,200,2,10,['Dangerous'],'142-143'],
 ['flechette-pistol','Flechette Pistol',9,'pistol',10,'3D-2',1,275,2,10,['Silent'],'142-143'],
 ['heavy-revolver','Heavy Revolver',5,'pistol',10,'4D-3',1.5,400,6,15,['Bulky'],'143-144'],
 ['magrail-pistol','Magrail Pistol',14,'pistol',15,'3D+3',1,750,20,60,['Auto 4'],'143-144'],
 ['shot-pistol','Shot Pistol',5,'pistol',2,'3D',.5,60,1,5,[],'143-144'],
 ['universal-auto-pistol','Universal Auto Pistol',8,'pistol',10,'3D-3',1,300,10,10,[],'143-144'],
 ['zip-gun','Zip Gun',3,'pistol',5,'2D-3',null,50,1,5,['Dangerous'],'143-144'],
 ['accelerator-rifle-11','Accelerator Rifle (TL11)',11,'rifle',400,'3D',2,1500,20,40,['Zero-G'],'145'],
 ['air-rifle-3','Air Rifle (TL3)',3,'rifle',50,'2D',3,225,1,1,['Silent'],'145-146'],
 ['air-rifle-4','Air Rifle (TL4)',4,'rifle',75,'3D-2',3,350,1,1,['Silent'],'145-146'],
 ['assault-shotgun','Assault Shotgun',6,'rifle',50,'4D',5,500,24,40,['Auto 2','Bulky'],'145-146,148'],
 ['big-game-rifle','Big Game Rifle',5,'rifle',200,'3D+3',8,1250,5,50,['Very Bulky'],'145-146'],
 ['flechette-submachine-gun','Flechette Submachine Gun',9,'rifle',20,'3D-2',3,500,40,20,['Auto 3','Silent'],'145-146'],
 ['gauss-assault-gun','Gauss Assault Gun',12,'rifle',20,'4D',2,1300,36,35,['AP 5','Auto 2'],'145-146'],
 ['gauss-rifle','Gauss Rifle',12,'rifle',600,'4D',4,1500,80,80,['AP 5','Auto 3','Scope'],'145-146'],
 ['gauss-sniper-rifle','Gauss Sniper Rifle',12,'rifle',1000,'5D',4,2500,12,20,['AP 6','Scope'],'145-146'],
 ['gauss-submachinegun','Gauss Submachinegun',12,'rifle',50,'3D+2',3,1000,60,60,['AP 3','Auto 4'],'145-146'],
 ['magrail-rifle','Magrail Rifle',14,'rifle',150,'4D+3',4,2500,30,100,['Auto 6'],'145-146'],
 ['sawn-off-shotgun','Sawn-off Shotgun',4,'rifle',10,'4D',2,200,6,10,['Bulky'],'145,148'],
 ['light-shotgun','Light Shotgun',4,'rifle',40,'3D',3,150,6,10,[],'145,148'],
 ['sniper-rifle','Sniper Rifle',8,'rifle',500,'3D',5,700,4,10,['AP 5','Scope','Silent'],'145,148'],
 ['snub-carbine','Snub Carbine',11,'rifle',75,'3D-3',1,500,20,30,['Zero-G'],'145,148'],
 ['spear-gun','Spear Gun',6,'rifle',25,'3D',2,50,1,10,['Silent'],'145,148']
];

function conditions(id,traits){
 const effects={scope:'Operational game conditions only',resolvedAttack:false,skillGranted:false,autoloadResolvesConditions:false};
 if(traits.includes('Silent'))effects.silent=silent();
 if(traits.includes('Dangerous'))effects.dangerous=dangerous();
 if(id==='assault-pistol')effects.attackModifiers=[{modifier:-2,modes:['burst','full-auto'],source:csc('142')}];
 if(id==='coach-pistol'){
  effects.alternativeDischarge={id:'both-barrels',damage:'4D',roundsConsumed:2,optional:true,source:csc('142')};
  effects.reload={action:'Significant',actions:1,skill:'gun-combat:slug',skillCheckRequired:true,source:csc('142')};
 }
 if(id==='zip-gun')effects.attackModifiers=[{modifier:-1,condition:'All attacks with this profile',source:csc('144')}];
 if(id==='air-rifle-3')effects.airReservoir={shots:1,rechargeMinorActions:10,ammunitionCapacity:1,source:csc('146')};
 if(id==='air-rifle-4')effects.airReservoir={shots:5,ammunitionCapacity:1,reloadAfterEachShot:true,detachable:true,refillCost:0,refillContext:'Outside combat',refillDuration:'A few minutes manually',refillMinutes:null,source:csc('146')};
 if(id==='gauss-sniper-rifle')effects.weaponSight={lightAmplification:true,passiveInfrared:true,visualMagnification:true,laserRangefinder:true,targetPaintingAvailable:true,scope:'Weapon sight only',recipientVisionGranted:false,automaticDesignationDM:false,source:csc('146')};
 if(['assault-shotgun','sawn-off-shotgun','light-shotgun'].includes(id))effects.pelletAmmunition=pellets();
 if(id==='sawn-off-shotgun')effects.attackModifiers=[{modifier:2,condition:'Short range',replacesNormalShortRangeBonus:true,source:csc('148')}];
 if(id==='spear-gun'){
  effects.intendedEnvironment={id:'underwater',source:csc('148')};
  effects.reload={action:'Significant',actions:1,source:csc('148')};
 }
 return effects;
}

export const CSC_SLUG_WEAPONS=rows.map(([id,name,tl,weaponFamily,range,damage,massKg,cost,magazine,magazineCost,traits,pages])=>({
 id:'csc-'+id,label:name+' (CSC 2023)',tl,weaponFamily,sourceFamily:'csc-2023',mountClass:weaponFamily==='pistol'?'small':'medium',
 range,damage,massKg,cost,magazine,magazineCost,traits,initialIncluded:false,skill:'gun-combat',speciality:'slug',implemented:true,
 compatibility:{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null},
 conditionalEffects:conditions(id,traits),
 ammunitionAccounting:{initialMagazine:'separate-purchase',inclusionStatement:'No included initial magazine stated in the CSC slug section',magazinePriceSource:csc(weaponFamily==='pistol'?'143':'145'),mountExcludesAmmunition:true,mountSource:{book:'Robot Handbook',edition:'Mongoose 2022',pages:'61'}},
 source:csc(pages),
 ...(id==='gauss-rifle'?{interpretation:'The CSC table specifies TL12 and Cr80 per magazine. The descriptive text says replacement of conventional rifles by TL13; the printed table controls this profile. The separate Core profile retains Cr40 magazines.'}:{}),
 ...(id==='assault-shotgun'?{interpretation:'The magazine-cost cell prints 40 without a currency prefix; it is treated as Cr40 within the surrounding credit-priced column.'}:{})
}));
