// Explicit numeric-mass rows only. These are device capabilities, not recipient skills.
// Source visually checked: CSC Update 2023, revised printing copyright 2026.
const source=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const device=(id,label,tl,massKg,cost,pages,effects)=>({id:'csc-'+id,label:label+' (CSC)',tl,massKg,cost,source:source(pages),effects:{recipientSkillGranted:false,...effects}});
export const CSC_COMPACT_TOOLS=[
 device('thrust-pistol-7','Thrust pistol',7,1,1000,'121',{category:'mobility',reactionJet:true,propellant:'compressed gas',operation:{zeroGravityRequired:true,vacuumRequired:true,loadScope:'One person with vacc suit and equipment',moderateManoeuvringMinutes:60,continuousThrustMinutes:3,continuousAccelerationG:.1,alternativeUsageBudgets:true},generalRobotAccelerationGranted:false,robotChassisMassRatingKg:null,refillCost:null,refillIncluded:false}),
 device('return-mirror-4','Return mirror',4,.5,500,'129',{category:'tool',surveyingReflector:true,returnArcDegrees:15,reflectsAlongIncomingPath:true,foldingTripodIncluded:true,laserRangefinderIncluded:false,automaticNavigationDM:false}),
 device('spade-shovel-1','Spade/shovel',1,1,5,'129',{category:'tool',diggingTool:true,powered:false,automaticTaskSuccess:false,diggingRate:null}),
 device('tool-laser-12','Basic tool laser',12,.5,500,'130',{category:'tool',variableOutput:true,uses:['electronic welding','small-scale metalwork','cutting several centimetres of steel'],largerWorkRequiresSeparateEquipment:true,power:{source:'internal powerpack',continuousUseMinutes:20,shotConsumptionMinutes:1,sharedToolAndWeaponBudget:true,rechargeTime:null,replacementCost:null},improvisedWeapon:{attackDM:-2,effectiveRangeMetres:5,fullOutputDamage:'1D',automaticWeaponMount:false,recipientSkillGranted:false},unlimitedPower:false})
];
