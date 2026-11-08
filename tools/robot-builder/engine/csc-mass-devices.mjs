// Bounded printed-equipment subset, not a complete CSC equipment catalogue.
// Numeric printed masses only; no prototype/retrotech variants or optional accessories.
// Source inspected: Update 2023 revised printing, copyright 2026, printed pp63-65,74-76,78-79,88,90-91,125-126.
const source=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const device=(id,label,tl,massKg,cost,pages,effects)=>({id:'csc-'+id,label:label+' (CSC)',tl,massKg,cost,source:source(pages),effects:{recipientSkillGranted:false,...effects}});
const hologram=(rangeMetres,realism)=>({category:'display',holographicDisplay:true,rangeMetres,movingImage:true,realism,physicalSubstance:false,smell:false,...(realism==='realistic'?{disbeliefCheck:'INT',disbeliefTarget:null}:{}),compatibleConnectionMinimumTL:9});
const binoculars={category:'sensor',magnification:10,laserRangefinder:true,lightIntensification:true,lightIntensificationInTotalDarkness:false,seesThroughFog:false,seesThroughSmoke:false,seesThroughThickFoliage:false,infraredVision:true,thermalImaging:true};
const pris={category:'sensor',emSpectrum:['microwaves','gamma rays'],passiveNaturalEmissions:true,falseColourDisplay:true,compositeSpectralImages:true,compositeImagesMayConfuseNewUsers:true,distanceMagnification:true,closeRangeMagnification:false,electronicsSensorsSkillRequired:false};
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
 device('infrared-goggles-6','Infrared goggles (TL6)',6,1,500,'75',{category:'sensor',visibleLightVision:true,infraredVision:true,thermalImaging:true,heatClutterInterference:true,uniformTemperatureNavigation:false}),
 device('geiger-counter-5','Basic Geiger counter',5,2,250,'75',{category:'sensor',detectsRadiation:true,minimumSourceRadsPerHour:30,determinesSourceComposition:false,determinesSourceDirection:false}),
 device('light-intensifier-7','Basic light intensifier goggles',7,1,500,'75',{category:'sensor',lowLightVision:true,monochromeVision:true,rangeMetres:18,totalDarkness:false,daylightSeverelyDegradesClarity:true,infraredVision:false,automaticDaylightAdjustment:false}),
 device('pris-binoculars-12','PRIS binoculars',12,1,3500,'76',{...pris}),
 device('psi-finder-binoculars-16','Psi-finder binoculars',16,1,10000,'76',{...pris,psiDetection:{requiresFilterEnabled:true,detectsPSIPresence:true,relativeStrengthByNimbusBrightness:true,exactPSIScore:false}}),
 device('em-probe-10','EM probe',10,1,1000,'78-79',{category:'sensor',detectsElectromagneticEmissions:true,equipmentDiagnostics:true,bugDetection:{rangeMetres:6,skill:'Electronics (sensors)',activelyTransmittingTarget:8,passiveTarget:12,deluxeDM:2,hardwareTL:10,positiveTLAdvantageDM:true,automaticDetection:false}}),
 ...[[8,1000,0],[10,1500,1],[12,5000,2]].map(([tl,cost,firstAidDM])=>device('medikit-'+tl,'Medikit (TL'+tl+')',tl,1,cost,'88,90',{category:'medical',firstAidDM,fieldSurgeryDM:firstAidDM-2,condition:'Appropriate first aid or field surgery use; not a universal Medic modifier',consumables:{refereeOptional:true,approximateUses:10,replenishmentFractionOfStandardPrice:.25,replenishmentCost:cost*.25,replenishmentIncluded:false}})),
 device('portable-mediscanner-12','Portable mediscanner',12,1,2000,'91',{category:'medical',lifeSignMonitoring:['blood composition','blood sugar','body temperature'],diagnosticInformation:true,medicDM:1,condition:'Using diagnostic information after analysis of the calibrated subject',calibration:{eachNewSubject:true,duration:'1D minutes',analysisRequired:true},alienSpeciesChips:{included:false,costEach:500},automaticTreatment:false}),
 device('electronic-tool-set-7','Electronic tool set',7,2,2000,'125-126',{category:'tool',electronicAssemblyAndRepair:true,taskTechnologyGuidance:{refereeDiscretion:true,gapMustExceed:2,lowerTaskTLPotentialDM:2,higherTaskTLPenalty:'As missing or improvised tools',compatibilityRequired:true,automaticModifier:false},consumables:{refereeOptional:true,fullTimeWorkMonths:1,replenishmentFractionOfStandardPrice:.1,replenishmentCost:200,replenishmentIncluded:false}})
];
