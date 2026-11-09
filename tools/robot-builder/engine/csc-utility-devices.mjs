// Independently extracted and visually checked: CSC Update 2023, revised printing
// copyright 2026, printed pp82-83,86,106. Fixed-mass miscellaneous implants only.
// Flashtray uses the printed minimum-price model, not a priced decorative upgrade.
const source=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const device=(id,label,tl,massKg,cost,pages,effects)=>({id:'csc-'+id,label:label+' (CSC)',tl,massKg,cost,source:source(pages),effects:{recipientSkillGranted:false,...effects}});
export const CSC_UTILITY_DEVICES=[
 device('flashtray-8','Flashtray (base model)',8,.5,80,'82-83',{
  category:'utility',priceBasis:'printed-minimum',decorativeUpgradesIncluded:false,
  incineration:{requiresItemPlacedInside:true,smallItemsOnly:true,flammableItemsOnly:true,duration:'seconds',exactDurationSeconds:null,builtInSmokeAndOdourFans:true},
  automaticTaskSuccess:false,weaponDamage:null,powerDuration:null
 }),
 device('sonic-sweat-and-stain-remover-13','Sonic sweat and stain remover',13,1,125,'86',{
  category:'utility',cleaning:{targets:['clothes','armour'],removes:['stains','odours'],requiresSwipingOverTarget:true,action:'Significant Action'},
  automaticTaskSuccess:false,decontaminationGranted:false,armourRepairGranted:false,powerDuration:null
 }),
 device('sphere-of-solace-10','Sphere of Solace',10,1,500,'86',{
  category:'utility',soundCancellation:{requiresActivation:true,adjustableRadius:true,maximumRadiusMetres:5,loudestSoundsCanPenetrate:true,highFidelityMusicContest:{higherHardwareTLWins:true,hardwareTL:10,tieOutcome:null}},
  absoluteSilence:false,stealthDM:null,sonicProtectionGranted:false,powerDuration:null
 }),
 device('gas-oil-lamp-2','Gas/oil lamp',2,1,10,'106',{
  category:'lighting',illumination:{requiresLitAndFuelled:true,radiusMetres:5,brightness:'daylight-equivalent'},
  fuel:{types:['gas','oil'],litresPerFill:.5,approximateHoursPerFill:6,refillCost:1,refillsIncluded:false,initialFuelIncluded:null,spillageFireHazard:true},
  unlimitedPower:false,automaticTaskSuccess:false
 })
];
