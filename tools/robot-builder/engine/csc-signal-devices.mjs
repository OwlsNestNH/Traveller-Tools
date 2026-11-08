// Bounded, independently checked CSC signal-device subset for mass-based implants.
// Source: Update 2023 revised printing, copyright 2026, printed pp77-78.
// The printed TL+ entries are offered only at their base hardware TL here.
// A higher design TL does not upgrade these devices or their operational TL DMs.
const source=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const device=(id,label,tl,cost,pages,effects)=>({id:'csc-'+id,label:label+' (CSC)',tl,massKg:.5,cost,source:source(pages),effects:{recipientSkillGranted:false,...effects}});
const bugDetection=deluxeDM=>({rangeMetres:6,skill:'Electronics (sensors)',activelyTransmittingTarget:8,passiveTarget:12,deluxeDM,hardwareTL:5,positiveTLAdvantageDM:true,automaticDetection:false});
export const CSC_SIGNAL_DEVICES=[
 device('radio-jammer-handheld-6','Handheld radio jammer (TL6)',6,500,'77',{
  category:'communications',
  radioJamming:{rangeMetres:30,hardwareTL:6,communicationCheck:{skill:'Electronics (comms)',target:10,everyRound:true,tlDifferenceDM:true,tlDifferenceFormula:null,automaticFailure:false},blocksTightBeamLaser:false,blocksMaser:false},
  power:{source:'internal battery',continuousHours:1,externalPowerSupported:true,externalPowerIncluded:false},
  lawEnforcementAttentionPossible:true
 }),
 device('bug-sweeper-standard-5','Standard bug sweeper (TL5)',5,100,'78',{category:'sensor',detectsSurveillanceDevices:true,bugDetection:bugDetection(0)}),
 device('bug-sweeper-deluxe-5','Deluxe bug sweeper (TL5)',5,1000,'78',{category:'sensor',detectsSurveillanceDevices:true,bugDetection:bugDetection(2)})
];
