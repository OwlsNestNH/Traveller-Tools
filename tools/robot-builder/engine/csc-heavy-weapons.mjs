// Fictional Traveller game profiles. No source scans or real-world instructions.
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const mountSource=()=>({book:'Robot Handbook',edition:'Mongoose 2022',pages:'61'});

// Source categories, not mass, determine RH p61 mounts. Portable source units
// are metres/kg; vehicle source units are kilometres/tons, converted below.
// Only priced finite magazines and vehicle rows at or below 0.25 tons are here.
// Identical Core FGHP/PGHP and Light Autocannon rows retain their existing IDs.
const rows=[
 ['anti-materiel-rifle','Anti-Materiel Rifle',7,'portable',1000,'5D',15,3000,1,10,['AP 5','Scope','Very Bulky'],'160-161','161'],
 ['arl-standard','ARL (standard)',10,'portable',80,'4D',3,800,20,100,['Zero-G'],'160-161','161'],
 ['arl-support','ARL (support)',10,'portable',80,'4D',4,1300,40,200,['Auto 4','Zero-G'],'160-161','161'],
 ['arl-pdw','ARL (PDW)',10,'portable',50,'4D',2,200,20,100,['Auto 4','Zero-G'],'160-161','161'],
 ['cppg-11','CPPG-11',11,'portable',200,'6D',12,8000,6,300,['AP 6','Blast 2','Bulky','Scope'],'160-161,175','161'],
 ['cppg-12','CPPG-12',12,'portable',300,'8D',12,15000,6,450,['AP 8','Blast 3','Bulky','Scope'],'160-161,175','161'],
 ['cppg-13','CPPG-13',13,'portable',500,'1DD',10,25000,6,600,['AP 10','Blast 3','Bulky','Scope'],'160-161,175','161'],
 ['cryojet','Cryojet',11,'portable',10,'4D',14,4000,16,200,['Blast 5','Bulky'],'160-161','161'],
 ['early-machinegun','Early Machinegun',4,'portable',400,'3D',14,1200,30,100,['Auto 3','Very Bulky'],'160-161','161'],
 ['flamethrower-4','Flamethrower (TL4)',4,'portable',5,'3D',20,800,30,60,['Blast 5','Bulky','Fire'],'160-161','161'],
 ['flamethrower-6','Flamethrower (TL6)',6,'portable',5,'4D',15,1500,40,80,['Blast 5','Bulky','Fire'],'160-161','161'],
 ['flamethrower-8','Flamethrower (TL8)',8,'portable',10,'4D',10,2000,50,100,['Blast 5','Fire'],'160-161','161'],
 ['light-assault-gun','Light Assault Gun',8,'portable',800,'7D',40,4000,5,100,['AP 5','Very Bulky'],'161,163','161'],
 ['light-gatling-laser','Light Gatling Laser',9,'portable',180,'3D',18,4500,100,300,['Auto 4','Zero-G'],'161,163','161'],
 ['machinegun','Machinegun',5,'portable',500,'3D',10,1500,60,100,['Auto 4','Bulky'],'161,163','161'],
 ['rapid-fire-machinegun','Rapid-Fire Machinegun',7,'portable',500,'3D',12,3000,60,100,['Auto 4','Bulky'],'161,163','161'],
 ['rocket-launcher-6','Rocket Launcher (TL6)',6,'portable',120,'4D',8,2000,1,300,['Blast 6','Bulky'],'161,163','161'],
 ['rocket-launcher-7','Rocket Launcher (TL7)',7,'portable',150,'4D+3',8,2000,1,400,['Blast 6','Bulky','Smart'],'161,163','161'],
 ['rocket-launcher-8','Rocket Launcher (TL8)',8,'portable',200,'5D',8,2000,2,600,['Blast 6','Bulky','Scope','Smart'],'161,163','161'],
 ['rocket-launcher-9','Rocket Launcher (TL9)',9,'portable',250,'5D+6',8,2000,2,800,['Blast 6','Bulky','Scope','Smart'],'161,163','161'],
 ['heavy-machinegun','Heavy Machinegun',6,'vehicle',1,'5D',.1,4500,100,400,['Auto 3'],'167,169','167'],
 ['vrf-gauss-gun','VRF Gauss Gun',12,'vehicle',.75,'4D',.25,20000,400,1000,['AP 5','Auto 8'],'167,170','167'],
 ['vrf-machinegun','VRF Machinegun',7,'vehicle',.5,'4D',.25,12000,1000,1250,['Auto 6'],'167,170','167'],
 ['rocket-pod','Rocket Pod',6,'vehicle',1.5,'4D',.25,8000,18,8000,['Auto 3','Blast 5'],'171,173','171'],
 ['tac-launcher-anti-aircraft','Tac Launcher (Anti-aircraft)',10,'vehicle',10,'8D',.25,16000,4,8000,['Scope','Smart'],'171,173','171'],
 ['tac-launcher-anti-personnel','Tac Launcher (Anti-personnel)',10,'vehicle',6,'4D',.25,12000,4,4000,['Blast 10','Scope','Smart'],'171,173','171'],
 ['tac-launcher-armour-piercing','Tac Launcher (Armour piercing)',10,'vehicle',6,'8D',.25,15000,4,6000,['AP 10','Scope','Smart'],'171,173','171']
];

function conditions(id,tl,traits){
 const effects={scope:'Operational game conditions only',resolvedAttack:false,skillGranted:false,recipientVisionGranted:false,autoloadResolvesConditions:false};
 if(id.startsWith('arl-')){
  effects.attackModifiers=[{modifier:-1,condition:'All attacks with this profile',source:csc('160')}];
  if(id==='arl-pdw'){
   effects.attackModifiers.push({modifier:-2,condition:'Target is beyond 10 metres',rangeMetres:{minimum:10,minimumInclusive:false},source:csc('160')});
   effects.modifierInteraction={resolved:false,context:'The universal ARL and beyond-10m PDW modifiers are retained separately; their interaction is not settled by construction accounting.',source:csc('160')};
  }
  if(id!=='arl-pdw')effects.magazineInterchangeability={profiles:['csc-arl-standard','csc-arl-support'],alternateMagazineSelectionImplemented:true,source:csc('160')};
 }
 if(['anti-materiel-rifle','light-assault-gun'].includes(id))effects.bipod={included:true,additionalCost:0,setup:{action:'Minor',actions:2},condition:'Firing from the deployed bipod',ignoredTraits:['Bulky','Very Bulky'],traitsPermanentlyRemoved:false,source:csc(id==='anti-materiel-rifle'?'160,174':'163,174')};
 if(id.startsWith('cppg-')){
  effects.holographicSight={included:true,additionalCost:0,occupiesSightSlot:true,trait:'Scope',modifier:1,rangeMetres:{minimum:50,minimumInclusive:true},condition:'Target is at least 50 metres away',resolvedAttack:false,skillGranted:false,recipientVisionGranted:false,interpretation:'The p175 prose includes 50 metres; the table says beyond 50m. This profile follows the explicit prose threshold.',source:csc('160,175')};
  effects.powerSupply={kind:'chemical-cartridge-magazine',externalPowerPack:false,robotPowerConnectionSupported:false,unlimitedFire:false,source:csc('160')};
 }
 if(id==='cryojet')effects.freeze={condition:'Hit a target wearing a sealed protective suit',check:{characteristic:'STR',target:8},onFailure:'Held in place',duration:'1D rounds',universalRobotShutdown:false,source:csc('160')};
 if(id.startsWith('flamethrower-')){
  effects.reload={kind:'fuel-tank',duration:'2D rounds',source:csc('160')};
  effects.carrierHitExplosion={applies:tl<8,minimumAttackEffect:4,condition:'The carrier is hit by any attack with Effect 4 or greater',weaponDestroyed:true,damageToCarrier:'As if hit by this weapon',immediate:true,exemptFromTL:8,source:csc('160')};
 }
 if(traits.includes('Fire'))effects.fire={condition:'Target set on fire by this weapon',damageEachSubsequentRound:true,maximumConcurrentSources:1,useHighestDamageSource:true,selfExtinguish:{dice:'2D',target:8,timing:'Start of each round',refereeMayContinueWithFlammableMaterial:true},extinguishAction:{action:'Significant',actions:1,characteristic:'DEX',target:8,firefightingEquipmentDM:2},resolvedDamage:false,source:csc('131')};
 if(id==='light-gatling-laser')effects.powerSupply={kind:'chemical-cartridge-magazine',disposable:true,rechargeable:false,externalPowerPack:false,robotPowerConnectionSupported:false,unlimitedFire:false,reload:{timing:'Same as a slug magazine',action:null,actions:null},source:csc('163')};
 if(id==='rapid-fire-machinegun')effects.alternativeDischarge={id:'rapid-fire',optional:true,normalAuto:4,auto:8,traits:['Auto 8','Bulky'],coolingRounds:2,condition:'After using the doubled Auto score, leave the weapon to cool for two rounds',source:csc('161,163')};
 if(id.startsWith('rocket-launcher-')){
  effects.backblast={condition:'Anyone standing behind the launcher when it fires',damage:'3D',resolvedDamage:false,source:csc('163')};
  effects.reload={action:'Minor',actions:3,source:csc('163')};
 }
 if(id==='rocket-pod')effects.aiming={usualMethod:'Point the carrying vehicle or aircraft',independentTraverseGranted:false,firingModes:['single','salvo'],source:csc('173')};
 if(id.startsWith('tac-launcher-'))effects.fixedMissileProfile={variant:id.slice('tac-launcher-'.length),interchangeableMissileSelectionImplemented:false,source:csc('171,173')};
 return effects;
}

const initialConvention='The CSC heavy-weapon sections do not state whether an initial magazine is included. The builder separately prices one selected initial magazine as an accounting convention, not an explicit source exclusion.';
export const CSC_HEAVY_WEAPONS=rows.map(([id,name,tl,speciality,sourceRange,damage,sourceMass,cost,magazine,magazineCost,traits,pages,tablePage])=>({
 id:'csc-'+id,label:name+' (CSC 2023)',tl,weaponFamily:'heavy-'+speciality,sourceFamily:'csc-2023',mountClass:speciality==='portable'?'heavy':'vehicle',
 range:sourceRange*(speciality==='vehicle'?1000:1),damage,massKg:sourceMass*(speciality==='vehicle'?1000:1),cost,magazine,magazineCost,traits,initialIncluded:false,skill:'heavy-weapons',speciality,implemented:true,
 sourceMeasurements:{range:{value:sourceRange,unit:speciality==='vehicle'?'km':'m'},mass:{value:sourceMass,unit:speciality==='vehicle'?'tons':'kg'},source:csc(tablePage)},
 ...(speciality==='vehicle'?{requiresVehicleMount:true}:{}),
 // Explicit projectile identity supports accessory eligibility without changing
 // the required Heavy Weapons speciality to Gun Combat (slug).
 ...(['anti-materiel-rifle','light-assault-gun'].includes(id)?{slugThrower:true}:{}),
 compatibility:{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,robotPowerConnection:false},
 conditionalEffects:conditions(id,tl,traits),
 ammunitionAccounting:{initialMagazine:'separate-purchase',inclusionStatement:initialConvention,sourceInclusion:'not-stated',inclusionSource:csc('160-173'),magazinePriceSource:csc(tablePage),mountExcludesAmmunition:true,mountSource:mountSource()},
 source:csc(pages),interpretation:initialConvention+(id==='heavy-machinegun'?' CSC damage is 5D; the distinct Core profile retains 4D.':id==='machinegun'?' CSC is TL5 with Bulky; the distinct Core profile retains TL6 without Bulky.':id.startsWith('rocket-launcher-')?' CSC includes Bulky; the distinct Core profiles retain their own printed traits.':''),
 ...(id==='anti-materiel-rifle'?{sourceTableName:'Anti-Material Rifle',nameInterpretation:'The prose and illustration use Anti-Materiel Rifle; the p161 table prints Anti-Material Rifle.'}:{}),
 ...(id==='rapid-fire-machinegun'?{sourcePrintedAuto:'Auto 4 (8)'}:{})
}));
