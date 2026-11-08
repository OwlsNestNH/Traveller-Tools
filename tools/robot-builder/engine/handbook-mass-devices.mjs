// Bounded fixed-purpose devices; Robot Handbook (2022), printed pp119,122.
// p92 admission uses published mass only, never inferred Slots or body geometry.
const source=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
const device=(id,label,tl,massKg,cost,pages,effects)=>({id:'handbook-'+id,label:label+' (Robot Handbook)',tl,massKg,cost,source:source(pages),effects:{category:'control',recipientSkillGranted:false,attachedTargetVerified:false,operationalLinkVerified:false,...effects}});
export const HANDBOOK_MASS_DEVICES=[
 ...[['basic',7,2,2500,-2],['improved',8,2,1000,0],['enhanced',10,.5,1000,0],['advanced',11,.5,5000,1]].map(([grade,tl,mass,cost,controlDM])=>device('drone-console-'+grade,grade[0].toUpperCase()+grade.slice(1)+' drone control console',tl,mass,cost,'119',{
  droneControl:true,maximumDrones:1,controlDM,requiredOperatorSkill:'Electronics (remote ops)',
  transceiverRangeKm:50,externalTransceiverInterface:true,externalTransceiverIncluded:false,
  distanceControlPenalty:{perKm:5000,dm:-1},
  sensoryChannels:{video:true,audio:tl>=8,olfactory:tl>=11,requiresCorrespondingDroneSensors:true},
  droneVoder:{usable:tl>=8,requiresTargetVoder:true},
  condition:'Compatible drone and working communication link; sensory channels require corresponding target hardware. Range extension requires a separate compatible transceiver.'
 })),
 device('swarm-console-advanced','Advanced swarm controller console',14,2,200000,'45,79,122',{
  swarmControl:true,fixedPurposeComputer:true,bundledExpertSystem:true,bundledSwarmControlSoftware:true,
  verbalCommands:true,maximumTasks:4,maximumSkill:3,maximumTaskTarget:14,
  taskComplexityLimitedByController:true,relatedTasksRequired:true,identicalLargerRobotsSupported:true,coordinatedMilitaryForce:false,
  swarmRangeMetres:50,multiChannelWirelessDataLink:true,targetWirelessDataLinksRequired:true,targetControlComponentsRequired:true,
  simultaneousTasks:{complexityReductionLevels:1,dmPerAdditionalTask:-1},
  droneMode:{maximumDrones:8,interfaceGrade:'improved',controlDM:0,unskilledEffectiveRemoteOps:0,skilledOperatorUsesFullSkill:true,rangeKm:50,extendedDistanceModifier:null,multipleDroneModifier:null,modifierScope:'Additional extended-distance and simultaneous-drone modifiers are not specified by pp79/122; referee resolution remains separate'},
  multiChannelTransceiver:true,externalTransceiverIncluded:false,
  externalTransceiver:{multiChannelRequired:true,standardEquivalentRangePriceMultiplier:10},
  condition:'Swarm or drone mode, subject to compatible targets and working links; bundled expertise applies only to console operation. Swarm task complexity remains controller-limited.'
 })
];
