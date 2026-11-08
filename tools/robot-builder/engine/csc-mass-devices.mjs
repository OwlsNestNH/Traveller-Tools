// Bounded printed-equipment subset, not a complete CSC equipment catalogue.
// Numeric printed masses only; no prototype/retrotech variants or optional accessories.
// Source inspected: Update 2023 revised printing, copyright 2026, printed pp63-65,74-75.
const source=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const device=(id,label,tl,massKg,cost,pages,effects)=>({id:'csc-'+id,label:label+' (CSC)',tl,massKg,cost,source:source(pages),effects:{recipientSkillGranted:false,...effects}});
const hologram=(rangeMetres,realism)=>({category:'display',holographicDisplay:true,rangeMetres,movingImage:true,realism,physicalSubstance:false,smell:false,...(realism==='realistic'?{disbeliefCheck:'INT',disbeliefTarget:null}:{}),compatibleConnectionMinimumTL:9});
const binoculars={category:'sensor',magnification:10,laserRangefinder:true,lightIntensification:true,lightIntensificationInTotalDarkness:false,seesThroughFog:false,seesThroughSmoke:false,seesThroughThickFoliage:false,infraredVision:true,thermalImaging:true};
const wide={mode:'wide',rangeMetres:18,radiusMetres:6};
const tight={mode:'tight',rangeMetres:36,radiusMetres:1};
const area={mode:'area',radiusMetres:10};
export const CSC_MASS_DEVICES=[
 device('holographic-display-9','Basic holographic display',9,2,800,'63',hologram(.3,'translucent')),
 device('holographic-display-11','Improved holographic display',11,1,1000,'63',hologram(.3,'realistic')),
 device('holographic-projector-12','Enhanced holographic projector',12,1,10000,'63',hologram(3,'true-to-life')),
 device('radio-transceiver-7','Radio transceiver, 5 km (TL7)',7,1,100,'64-65',{category:'communications',medium:'radio',twoWay:true,rangeKm:5,networkRequired:false,integralComputer:false,hardwareEncryptionIncluded:false,satelliteUplinkIncluded:false}),
 device('laser-transceiver-9','Laser transceiver (TL9)',9,1.5,2500,'64-65',{category:'communications',medium:'laser',twoWay:true,rangeKm:500,lineOfSightRequired:true,atmosphericAndHorizonLimits:true,openSpaceRangeKm:null,openSpaceRangeConditions:['diffraction','precise endpoint location and tracking'],networkRequired:false,integralComputer:false,integralPointToPointTracking:true,defaultEncryption:true,defaultDecryptionCheck:{skill:'Electronics (comms) or Electronics (computers)',target:10},hardwareEncryptionIncluded:false,satelliteUplinkRequired:false}),
 device('electronic-binoculars-9','Improved electronic binoculars',9,1,750,'74',{...binoculars,imageProcessing:false}),
 device('electronic-binoculars-10','Advanced electronic binoculars',10,1,750,'74',{...binoculars,imageProcessing:true,partiallyHiddenObjectIdentification:true}),
 device('cold-light-lantern-6','Cold light lantern',6,.25,20,'74',{category:'lighting',powerSource:'fuel cell',continuousHours:72,lightModes:[wide,tight,area]}),
 ...[6,7,8].map(tl=>device('flashlight-'+tl,'Flashlight (TL'+tl+')',tl,.5,10,'75',{category:'lighting',powerSource:'battery',continuousHours:tl===8?24:6,lightModes:tl===6?[wide]:tl===7?[wide,tight,area]:[wide,tight,area,{mode:'strobe'},{mode:'narrow',rangeMetres:250}],...(tl===8?{quickRecharge:true,rechargeable:true}:{})})),
 device('infrared-goggles-6','Infrared goggles (TL6)',6,1,500,'75',{category:'sensor',visibleLightVision:true,infraredVision:true,thermalImaging:true,heatClutterInterference:true,uniformTemperatureNavigation:false})
];
