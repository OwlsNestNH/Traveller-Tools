// Fictional Traveller game profiles. No source scans or real-world instructions.
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const common=()=>({sourceFamily:'csc-2023',initialIncluded:false,skill:'gun-combat',speciality:'slug',implemented:true,
 compatibility:{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null}});
const conditions=()=>({scope:'Operational game conditions only',resolvedAttack:false,skillGranted:false,autoloadResolvesConditions:false});
const accounting=pages=>({initialMagazine:'separate-purchase',sourceInitialInclusion:'unstated',inclusionStatement:'Initial-load inclusion is unstated; separately purchasing the selected initial load is a construction convention, not a source exclusion.',magazinePriceSource:csc(pages),mountExcludesAmmunition:true,mountSource:{book:'Robot Handbook',edition:'Mongoose 2022',pages:'61'}});

// Each barrel choice is a fixed source-table configuration, not a custom capacity.
// The table gives one whole-load price and Auto 4 throughout the printed range.
export const CSC_ADDITIONAL_SLUG_WEAPONS=[
 {...common(),id:'csc-heavy-advanced-combat-rifle',label:'Heavy Advanced Combat Rifle (CSC 2023)',tl:10,weaponFamily:'rifle',mountClass:'medium',
  range:450,damage:'4D',massKg:5,cost:2000,magazine:30,magazineCost:20,traits:['Auto 2','Bulky','Scope'],source:csc('145-146'),
  ammunitionAccounting:accounting('145'),
  conditionalEffects:{...conditions(),
   weaponSight:{lightAmplification:true,passiveInfrared:true,visualMagnification:true,laserRangefinder:true,targetPaintingAvailable:true,scope:'Weapon sight only',recipientVisionGranted:false,automaticDesignationDM:false,source:csc('146')},
   includedEquipment:{sling:true,integralFlashSuppressor:true,gyroscopicStabilisation:true,retainsBulky:true,source:csc('146')},
   includedGrenadeAdaptor:{type:'40mm RAM shoot-through muzzle adaptor',includedInWeaponPrice:true,additionalHardwareCost:0,underbarrelLauncher:false,attackSupported:false,ammunitionConfigurationSupported:false,mountConfigurationSupported:false,source:csc('146,174')}
  },
  interpretation:'Primary slug attack only. The included muzzle adaptor is not the separately priced under-barrel RAM launcher; no extra hardware price or mass is added. Its grenade attack, ammunition and combined mount configuration remain unsupported. Initial-load inclusion is unstated; the selected initial load is purchased separately by convention.'
 },
 ...[4,5,6,7,8].map(barrels=>({...common(),id:'csc-ducks-foot-pistol-'+barrels,label:"Duck's Foot Pistol ("+barrels+' barrels, CSC 2023)',tl:3,weaponFamily:'pistol',mountClass:'small',
  range:5,damage:'3D-3',massKg:2,cost:300,magazine:barrels,magazineCost:25,traits:['Auto 4','Dangerous'],source:csc('142-143'),
  ammunitionAccounting:{...accounting('143'),priceUnit:'whole load',roundsPerLoad:barrels},
  conditionalEffects:{...conditions(),
   firingMode:{allowed:['full-auto'],barrels,allBarrelsDischargeTogether:true,maximumAttacksPerTarget:1,extraShotsWasted:true,autoRating:4,autoExpenditureInteractionResolved:false,source:csc('142-143')},
   reload:{action:'Minor',actions:'2D3',skill:'gun-combat:slug',skillCheckRequired:true,successfulCheckRequired:true,source:csc('142')},
   dangerous:{maximumAttackEffect:-5,damageToUser:true,weaponInoperable:true,condition:'Failed attack at or below the listed Effect',source:csc('131')}
  },
  interpretation:'Fixed barrel count and whole-load purchase at the printed price. The detailed interaction of generic Auto 4 expenditure with simultaneous discharge remains unresolved during combat, not a construction blocker. Autoloader accounting does not bypass the reload check or actions. Initial-load inclusion is unstated; the selected initial load is purchased separately by convention.'
 }))
];
