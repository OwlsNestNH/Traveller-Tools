// Source-derived robot equipment accounting. Mechanics paraphrased from Robot Handbook (2022), pp29-64.
// Costs are credits. Source prose/PDFs are not distributed with the application.
const source = pages => ({book:'Robot Handbook',edition:'Mongoose 2022',pages:String(pages)});
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const rows = [];
function add(label,tl,cost,slots,page,extra={}) {
 const zeroSlot=slots===0;
 const row={id:slug(label),label,tl,category:zeroSlot?'Zero-Slot Options':'Slot Cost Options',zeroSlot,cost,slots,costBasis:'each',slotsBasis:'fixed',quantityKind:'copies',repeatable:true,implemented:true,source:source(page),...extra};
 if(row.costBasis==='baseSlots'){row.costPerBaseSlot=cost;delete row.cost;}
 if(row.slotsBasis==='basePercent'){row.slotPercent=slots;delete row.slots;row.zeroSlot=false;}
 if(row.slotsBasis==='allocated'){delete row.slots;row.zeroSlot=false;row.quantityKind='allocatedSlots';}
 if(row.costBasis==='allocatedSlots')row.costPerAllocatedSlot=cost;
 rows.push(row);return row;
}
function family(name,page,data,extra={}) {
 return data.map(([grade,tl,slots,cost,effects={}])=>add(`${name} (${grade})`,tl,cost,slots,page,{family:slug(name),effects,...extra}));
}
function zeroFamily(name,page,data,extra={}) {return family(name,page,data.map(([g,tl,c,e])=>[g,tl,0,c,e]),extra);}
const singleton={maxCopies:1,repeatable:false};
const perBase={costBasis:'baseSlots'};
const environment={environment:true,requiresBaseArmour:true};
const tool=(skills,max)=>({toolSkillCaps:Object.fromEntries(skills.map(s=>[s,max])),doesNotGrantSkill:true});
const sensorNeeds={operationRequiresSkills:[{skill:'Electronics',specialty:'sensors',minimumLevel:0}]};

// Default-suite components and paid substitutions. Only the eight explicitly listed free choices qualify.
add('Visual Spectrum Sensor',7,50,0,39,{defaultSuiteFree:true,effects:{vision:'visual'}});
add('Voder Speaker',8,100,0,36,{defaultSuiteFree:true});
add('Auditory Sensor',5,10,0,38,{defaultSuiteFree:true});
add('Wireless Data Link',8,10,0,36,{defaultSuiteFree:true,effects:{rangeM:50,security:0}});
add('Drone Interface',6,100,0,'34-35',{defaultSuiteFree:true,dependenciesAny:['transceiver','wireless-data-link'],effects:{droneInterface:true}});
add('Encryption Module',6,4000,0,35,{family:'encryption',...singleton,effects:{requiresDecryptionBeforeHacking:true}});

// Surface coatings. Detection DMs are conditional; none is a universal additive skill bonus.
zeroFamily('Visual Camouflage',31,[['Primitive',1,1,{detectionDM:-1,minimumRangeM:500}],['Basic',4,4,{detectionDM:-2,minimumRangeM:250}],['Improved',7,40,{detectionDM:-2,minimumRangeM:100}],['Enhanced',11,100,{detectionDM:-3,minimumRangeM:50}],['Advanced',12,500,{detectionDM:-4,minimumRangeM:10}],['Superior',13,2500,{detectionDM:-4,minimumRangeM:1}]],{...perBase,...singleton,exclusive:'visual-camouflage',incompatibilities:['reflec']});
zeroFamily('Audible Camouflage',32,[['Basic',5,5,{detectionDM:-1,minimumRangeM:50}],['Improved',8,10,{detectionDM:-2,minimumRangeM:10}],['Advanced',10,50,{detectionDM:-3,minimumRangeM:5}]],{...perBase,...singleton,exclusive:'audible-camouflage',operationalNotes:'Applies when not visible or protected by visilight; use primary detecting sense, not summed audible and olfactory bonuses.'});
zeroFamily('Olfactory Camouflage',32,[['Basic',7,10,{detectionDM:-1,minimumRangeM:100}],['Improved',9,20,{detectionDM:-2,minimumRangeM:20}],['Advanced',12,100,{detectionDM:-3,minimumRangeM:10}]],{...perBase,...singleton,exclusive:'olfactory-camouflage'});
add('Hostile Environment Protection',6,300,0,32,{...perBase,...environment,...singleton,effects:{radiationProtection:500,temperatureC:[-50,50],atmospheres:['2','3','4','5','6','7','8','9','A','D','E']}});
add('Reflec',10,100,0,32,{...perBase,...singleton,effects:{laserProtectionBonus:10,stealthDM:-2},incompatibilities:['visual-camouflage','solar-coating'],operationalNotes:'Laser protection only. Stealth penalty is DM-2, not Bane. Conventional electronic stealth is ineffective except concealed-component checks.'});
zeroFamily('Solar Coating',33,[['Basic',6,500,{solarOnlyFlyingSpeed:0,solarOnlyGroundSpeed:1}],['Improved',8,100,{solarOnlyFlyingSpeed:0,solarOnlyGroundSpeed:2}],['Enhanced',10,200,{solarOnlyFlyingSpeed:1,solarOnlyGroundSpeed:4}],['Advanced',12,500,{solarOnlyFlyingSpeed:2,solarOnlyGroundSpeed:'full'}]],{...perBase,...singleton,exclusive:'solar-coating',incompatibilities:['visual-camouflage','reflec'],operationalReview:true,operationalNotes:'Solar-only limits apply when conventional power is absent/depleted. Lighting and distance reduce performance; this does not grant unconditional infinite powered endurance.'});
add('Vacuum Environment Protection',7,600,0,34,{...perBase,...environment,...singleton,effects:{includes:['hostile-environment-protection'],radiationProtection:500,vacuum:true,temperatureC:[-250,250],safeDepthM:10,corrosiveHours:'TL',insidiousMinutes:'TL'},sourceConflict:'Main table TL7; some worked examples say TL6. Uses table.'});
add('Vacuum Environment Protection (biological)',10,50000,0,34,{...perBase,...environment,...singleton,allowedKinds:['biological'],requiresGenome:true,effects:{includes:['hostile-environment-protection'],radiationProtection:500,vacuum:true,temperatureC:[-250,250],safeDepthM:10}});

const transceivers=[
 ['Basic',5,7,0,250],['Improved',5,8,0,100],['Improved',50,8,0,500],['Enhanced',50,10,0,250],['Advanced',50,13,0,100],
 ['Improved',500,9,0,1000],['Enhanced',500,11,0,500],['Advanced',500,14,0,250],['Improved',5000,9,0,5000],['Enhanced',5000,12,0,1000],['Advanced',5000,15,0,500],
 ['Basic',50,7,1,1000],['Basic',500,7,1,2000],['Basic',5000,7,2,10000],['Basic',50000,8,4,20000],['Improved',50000,10,2,10000],['Enhanced',50000,12,1,5000],['Advanced',50000,15,1,2500],
 ['Basic',500000,9,8,50000],['Improved',500000,11,4,25000],['Enhanced',500000,13,2,10000],['Advanced',500000,16,1,5000]
];
for(const [grade,range,tl,slots,cost] of transceivers)add(`Transceiver ${range}km (${grade})`,tl,cost,slots,slots?46:35,{family:'transceiver',defaultSuiteFree:range===5&&['Basic','Improved'].includes(grade),effects:{rangeKm:range,transceiver:true}});
for(const [grade,tl,cost] of [['Basic',7,200],['Improved',8,500],['Advanced',10,2000]]){
 add(`Video Screen (${grade})`,tl,cost,0,35,{family:'video-screen',defaultSuiteFree:grade==='Basic'});
 add(`Full-Surface Video Screen (${grade})`,tl,cost,0,35,{...perBase,family:'full-surface-video-screen',...singleton,effects:{adaptiveBasicVisualCamouflage:true}});
}
add('Voder Speaker (broad spectrum)',10,500,0,36,{family:'voder-speaker'});
add('Gecko Grippers',9,500,0,36,{...perBase,...singleton,effects:{surfaceAdhesion:true},operationalNotes:'Compatible surfaces and gravity determine adhesion; locomotion still matters.'});
add('Injector Needle',7,20,0,36,{effects:{injection:true,maximumCluster:4},operationalNotes:'Each needle consumes one zero-slot choice; payload drug/poison cost is separate.'});
add('Laser Designator',7,500,0,37,{effects:{designator:true}});
add('Magnetic Grippers',8,10,0,37,{...perBase,...singleton,effects:{maximumGravityG:1.5,metalSurfaceMovementFactor:.5}});
add('Parasitic Link',10,10000,0,37,{...singleton,effects:{contactAccess:true},operationalNotes:'Target needs drone interface; access is not automatic successful control.'});
zeroFamily('Self-Maintenance Enhancement',37,[['Basic',7,20000,{maintenanceYears:12,malfunctionYears:1}],['Improved',8,50000,{maintenanceYears:24,malfunctionYears:2}]],{...perBase,...singleton,exclusive:'self-maintenance-enhancement'});
add('Stinger',7,10,0,38,{effects:{injection:true},operationalNotes:'Stinger consumables and any carried substance are separate.'});
add('Auditory Sensor (broad spectrum)',8,200,0,38,{traits:['Heightened Senses'],effects:{includes:['auditory-sensor']}});
add('Atmospheric Sensor',8,100,0,38,{effects:{atmosphericAnalysis:true}});
add('Environment Processor',10,10000,0,38,{traits:['Heightened Senses'],effects:{includes:['auditory-sensor-broad-spectrum','atmospheric-sensor','geiger-counter','light-intensifier-sensor-advanced']}});
add('Geiger Counter',8,400,0,39,{effects:{radiationSensor:true}});
zeroFamily('Light Intensifier Sensor',39,[['Basic',7,500,{darkVisionRangeM:18}],['Advanced',9,1250,{darkVisionRangeM:18,includes:['visual-spectrum-sensor','thermal-sensor']}]],{family:'light-intensifier-sensor'});
zeroFamily('Olfactory Sensor',39,[['Basic',8,1000,{}],['Improved',10,3500,{heightenedSenses:true}],['Advanced',12,10000,{heightenedSenses:true,traceChemicalDetection:true}]],{family:'olfactory-sensor'});
add('PRIS Sensor',12,2000,0,39,{traits:['IR/UV Vision'],effects:{includes:['visual-spectrum-sensor','thermal-sensor','geiger-counter'],passiveLightAmplification:true}});
add('Thermal Sensor',6,500,0,39,{traits:['IR Vision']});

// Slotted surface options. Price generally uses immutable base slots, not installed option slots.
add('Active Camouflage',15,10000,1,41,{...perBase,...singleton,traits:['Invisible'],effects:{reconDetectionDM:-4,electronicsDetectionDM:-4,stealthHardware:4}});
add('Corrosive Environment Protection',9,600,1,41,{...perBase,...environment,...singleton,effects:{corrosive:true,includes:['hostile-environment-protection']}});
add('Insidious Environment Protection',11,3000,1,41,{...perBase,...environment,...singleton,effects:{insidiousDays:'TL',temperatureC:[-270,800],maximumPressureAtmospheres:'10*TL',includes:['hostile-environment-protection']},operationalNotes:'Does not include vacuum or corrosive protection. Refurbishment after protection is exhausted costs5% of robot price.'});
add('Radiation Environment Protection',7,600,1,42,{...perBase,...environment,effects:{additionalRadiationProtection:'50*TL'},operationalNotes:'May repeat; additional protection stacks with the500rad baseline, counted once.'});
add('Self-Repairing Chassis',11,1000,.05,42,{...perBase,slotsBasis:'basePercent',...singleton,effects:{repairHitsPerPenetration:1,repairMinutesPerPenetration:1}});
family('Submersible Environment Protection',42,[['Basic',4,.05,200,{safeDepthM:50}],['Improved',6,.02,400,{safeDepthM:200}],['Enhanced',9,.02,800,{safeDepthM:600}],['Advanced',12,.02,1000,{safeDepthM:2000}],['Superior',15,.02,2000,{safeDepthM:4000}]],{...perBase,...environment,slotsBasis:'basePercent',roundingGroup:'submersible-environment-protection',rounding:'sum-all-family-fractions-before-ceiling',operationalNotes:'Safe depths add. Does not itself include hostile protection. Underwater non-aquatic speed halves rounded down and agility is reduced by2.'});

family('Domestic Cleaning Equipment',43,[['Small',5,1,100,{squareMetersPerHour:10}],['Medium',5,4,1000,{squareMetersPerHour:50}],['Large',5,8,5000,{squareMetersPerHour:120}]],{operationalNotes:'Only one cleaning set operates concurrently; roughly20productive hours/day.'});
family('Industrial Cleaning Equipment',43,[['Small',5,2,500,{squareMetersPerHour:10}],['Medium',5,8,5000,{squareMetersPerHour:50}],['Large',5,16,20000,{squareMetersPerHour:120}]],{operationalNotes:'Only one cleaning set operates concurrently; consumables separate.'});
family('High Fidelity Sound System',44,[['Basic',6,4,1500],['Improved',8,3,2500],['Enhanced',11,3,4000],['Advanced',12,2,5000]]);
family('Robotic Drone Controller',44,[['Basic',7,2,2000,{maxDrones:1,remoteOpsCap:0}],['Improved',9,1,10000,{maxDrones:2,remoteOpsCap:1}],['Enhanced',10,1,20000,{maxDrones:4,remoteOpsCap:2}],['Advanced',11,1,50000,{maxDrones:8,remoteOpsCap:3}]],{dependencies:['transceiver'],operationRequiresSkills:[{skill:'Electronics',specialty:'remote ops',minimumLevel:0}],operationalNotes:'DM−1 to all controlled-drone checks for each drone beyond first; range limited by controller transceiver.'});
add('Satellite Uplink',6,1000,2,45,{minimumTransceiverRangeKm:500,dependencies:['transceiver'],effects:{satelliteUplink:true}});
family('Swarm Controller',45,[['Basic',8,3,10000,{maxTasks:1,remoteOpsCap:0,maxTaskTarget:8}],['Improved',10,2,20000,{maxTasks:2,remoteOpsCap:1,maxTaskTarget:10}],['Enhanced',12,1,50000,{maxTasks:3,remoteOpsCap:2,maxTaskTarget:12}],['Advanced',14,1,100000,{maxTasks:4,remoteOpsCap:3,maxTaskTarget:14}]],{dependencies:['wireless-data-link'],operationRequiresSkills:[{skill:'Electronics',specialty:'remote ops',minimumLevel:0}],operationalNotes:'50m wireless range. Each extra simultaneous task reduces all checks by1 and maximum complexity by one level. Brain complexity also limits tasks.'});
add('Tightbeam Communicator',8,2000,1,46,{effects:{rangeKm:5000,rangeWithSatelliteUplinkKm:500000},operationalNotes:'Line of sight required.'});

add('Medical Chamber',8,200,null,46,{slotsBasis:'allocated',costBasis:'allocatedSlots',family:'medical-chamber',effects:{medikitMaximumBonus:1},operationalNotes:'Quantity is allocated chamber Slots, not copies. Adult human minimum32Slots, standard low berth50; species sizes vary. Suitable patient-handling arm recommended.'});
for(const [label,tl,slots,cost,effects] of [
 ['Cryoberth (basic)',10,8,20000,{survivalDM:0}],['Cryoberth (improved)',12,8,20000,{survivalDM:1}],['Low Berth (basic)',10,8,20000,{survivalDM:0}],['Low Berth (improved)',12,8,20000,{survivalDM:1}],['Nanorobot Applicator',13,4,100000,{medicalNanosLitres:2}],['Nanorobot Generator',13,8,200000,{medicalNanosLitres:2,includesEnhancedFabricator:true}],['Reanimation',14,8,900000,{reanimation:true}],['Species-specific Medical Add-on',10,4,10000,{additionalSpecies:1}]
])add(label,tl,cost,slots,47,{dependencies:['medical-chamber'],family:label.startsWith('Cryo')?'cryoberth':label.startsWith('Low')?'low-berth':slug(label),...(effects.additionalSpecies?{requiresDetail:'Additional species'}:{}),effects});
family('Medikit',48,[['Basic',8,1,1000,tool(['Medic'],0)],['Improved',10,1,1500,tool(['Medic'],1)],['Enhanced',12,1,5000,tool(['Medic'],2)],['Advanced',14,1,10000,tool(['Medic'],3)]],{operationalNotes:'Tool cap, not software or unconditionalDM. Supplies cost500 per replenishment.'});
family('Agricultural Equipment',48,[['Small',5,1,100,{squareMetersPerHour:20}],['Medium',5,4,1000,{squareMetersPerHour:100}],['Large',5,16,10000,{squareMetersPerHour:500}]]);
family('Autobar',49,[['Basic',8,2,500,tool(['Steward','Profession (bartender)'],0)],['Improved',9,2,1000,tool(['Steward','Profession (bartender)'],1)],['Enhanced',10,2,2000,tool(['Steward','Profession (bartender)'],2)],['Advanced',11,2,5000,tool(['Steward','Profession (bartender)'],3)]],{operationalNotes:'Internal beverage capacity2L; replenishment half initial option price.'});
family('Autochef',49,[['Basic',9,3,500,tool(['Steward','Profession (chef)'],0)],['Improved',10,3,2000,tool(['Steward','Profession (chef)'],1)],['Enhanced',11,3,5000,tool(['Steward','Profession (chef)'],2)],['Advanced',12,3,10000,tool(['Steward','Profession (chef)'],3)]]);
family('Autopilot',49,[['Improved',7,1,7500,{vehicleSkill:1}],['Enhanced',9,1,10000,{vehicleSkill:2}],['Advanced',11,1,15000,{vehicleSkill:3}]],{...singleton,exclusive:'autopilot',requiresVehicleSpeed:true,operationalNotes:'Use higher of installed autopilot and appropriate skill package; never sum them.'});
family('Bioreaction Chamber',50,[['Basic',6,null,1000,{complexity:'microbes'}],['Improved',8,null,2000,{complexity:'tissues'}],['Enhanced',10,null,5000,{growthMultiplier:12}],['Advanced',13,null,20000,{growthMultiplier:50}]],{slotsBasis:'allocated',costBasis:'allocatedSlots',operationalNotes:'Quantity is chamber Slots. Human gestation requires8; adult human clone32. Does not itself supply hostile/vacuum protection; feedstock is separate.'});
family('Construction Equipment',50,[['Small',5,2,500,{cubicMetersPerHour:.2}],['Medium',5,8,5000,{cubicMetersPerHour:1}],['Large',5,32,50000,{cubicMetersPerHour:5}]]);
family('Fabrication Chamber',52,[['Basic',8,null,2000,{hours:2,complexity:'mechanical'}],['Improved',10,null,10000,{hours:2,brainLimit:'Primitive/Basic/Hunter-Killer'}],['Enhanced',13,null,50000,{hours:1,brainLimit:'Advanced'}],['Advanced',17,null,200000,{hours:1,brainLimit:'Any'}]],{slotsBasis:'allocated',costBasis:'allocatedSlots',operationalReview:true,operationalNotes:'Quantity is chamber Slots. Whole robot manufacture requires4×target Base Slots. Feedstock, productTL and brain limits are separate operational constraints; table prices do not grant unrestricted fabrication.'});
family('Forklift',52,[['Small',5,8,3000,{maximumLoadDisplacementTons:.5}],['Medium',5,12,5000,{maximumLoadDisplacementTons:1}],['Large',5,60,20000,{maximumLoadDisplacementTons:5}]]);
family('Mining Equipment',52,[['Small',5,5,2000,{cubicMetersPerHour:.5}],['Medium',5,15,5000,{cubicMetersPerHour:2}],['Large',5,45,15000,{cubicMetersPerHour:8}]]);
add('Holographic Projector',10,1000,1,52,{effects:{includesSound:true}});
family('Navigation System',53,[['Basic',8,2,2000,{navigationSkill:1}],['Improved',10,2,10000,{navigationSkill:2}],['Enhanced',12,1,25000,{navigationSkill:3}],['Advanced',14,1,50000,{navigationSkill:4}]],{...singleton,exclusive:'navigation-system',operationalNotes:'Hardware skill is not modified by INT.'});
family('Self-Destruct System',53,[['Defensive',8,.05,500,{selfDamageDice:'ceil(Hits/3)',brainCriticalHits:3,externalDamageDice:'floor(ceil(Hits/3)/2)',externalArmourReduction:'robot armour',blast:3}],['Offensive',6,.1,1000,{selfDamageDice:'ceil(Hits/3)',brainCriticalHits:3,externalDamageDice:'floor(2*Hits/3)',blast:'Size'}],['TDX',12,.1,5000,{selfDamageDice:'ceil(Hits/3)',brainCriticalHits:3,externalDamageDice:'Hits',blast:15}]],{...perBase,slotsBasis:'basePercent',...singleton,exclusive:'self-destruct',operationalNotes:'Game rules only. Setting legality/permits restrict these systems; no real-world construction instructions.'});
add('Self-Destruct System (nuclear)',12,500000,4,53,{family:'self-destruct',...singleton,exclusive:'self-destruct',effects:{damage:'10DD',blast:1000,radiation:true},operationalNotes:'Fictional catalogue statistic. Subject to severe in-setting legal restrictions.'});
family('Self-Maintenance Enhancement',54,[['Enhanced',13,.1,200000,{maintenanceYears:60,malfunctionYears:5}],['Advanced',15,.1,500000,{maintenanceYears:null,malfunctionYears:null}]],{...perBase,slotsBasis:'basePercent',...singleton,exclusive:'self-maintenance-enhancement'});
family('Stealth',54,[['Basic',7,1,300,{stealthHardware:1}],['Improved',9,2,600,{stealthHardware:2}],['Enhanced',11,3,900,{stealthHardware:3}],['Advanced',13,3,1200,{stealthHardware:4}]],{...perBase,...singleton,exclusive:'stealth',operationalNotes:'Electronic detection modifiers also depend on relativeTL; Reflec negates most external concealment.'});
for(const [name,cost] of [['Storage Compartment',50],['Refrigerated Storage Compartment',100],['Hazardous Material Storage Compartment',500]])add(name,6,cost,null,55,{slotsBasis:'allocated',costBasis:'allocatedSlots',family:slug(name),effects:{litresPerSlot:2,kgPerSlot:2},operationalNotes:'Quantity is allocated Slots. Hazardous material should be named; an airlock requires separate adequate space.'});
add('Video Projector',7,500,1,55,{effects:{includesSound:true}});
add('External Power',9,100,.05,55,{...perBase,slotsBasis:'basePercent',...singleton,effects:{powerSource:'external'},operationalReview:true,operationalNotes:'Unlimited endurance only while within external supply range; charge state remains separate.'});
add('No Internal Power',6,0,-.1,56,{slotsBasis:'basePercent',slotCredit:true,...singleton,effects:{removesInternalPower:true},requiresWholeDesignEffect:true,operationalNotes:'Frees ceil(10% Base Slots), not negative ceil or minimum1 consumption. Conventional base endurance is removed, but added power packs can still operate.'});
family('RTG Long Duration',56,[['Basic',7,.2,20000,{halfLifeYears:25}],['Improved',9,.15,50000,{halfLifeYears:50}],['Advanced',11,.1,100000,{halfLifeYears:100}]],{...perBase,slotsBasis:'basePercent',...singleton,exclusive:'rtg-long-duration',operationalReview:true,operationalNotes:'Half-life years are not conventional endurance hours. RTG-only operation halves STR/movement rounded down, agility−2, no vehicle speed unless two full-capability sources operate simultaneously. Operating age matters.'});
family('RTG Short Duration',56,[['Basic',8,.15,50000,{halfLifeYears:3}],['Improved',10,.1,100000,{halfLifeYears:4}],['Advanced',12,.05,200000,{halfLifeYears:5}]],{slotsBasis:'basePercent',costBasis:'unresolved',...singleton,exclusive:'rtg-short-duration',implemented:false,reason:'p56 table says cost per installed Slot, prose says Base Slots. Explicit interpretation required.',sourceConflict:'per Slot versus per Base Slot',operationalReview:true});
family('Solar Power Unit',57,[['Basic',6,.2,2000,{serviceLifeYears:10}],['Improved',8,.15,5000,{serviceLifeYears:25}],['Enhanced',10,.1,10000,{serviceLifeYears:50}],['Advanced',12,.05,20000,{serviceLifeYears:100}]],{...perBase,slotsBasis:'basePercent',...singleton,exclusive:'solar-power-unit',operationalReview:true,operationalNotes:'Solar-only power has low-power limits. Deployed panels add effectiveSize1 and StealthDM−2; panelHits=ceil(10%robotHits), base armour only. Lighting, distance and deployment state matter.'});
add('Quick Charger',8,200,1,57,{...singleton,effects:{rechargeHours:1},operationalNotes:'High-amperage external source required.'});

add('Bioscanner Sensor',15,350000,2,57,{...sensorNeeds,effects:{rangeM:3}});
add('Densitometer Sensor',14,20000,3,57,{...sensorNeeds,effects:{rangeM:100}});
add('Neural Activity Sensor',15,35000,5,58,{...sensorNeeds,effects:{rangeM:500}});
add('Planetology Sensor Suite',12,25000,5,58,{...sensorNeeds,effects:{includes:['atmospheric-sensor','olfactory-sensor-advanced'],planetologyToolCapBonus:1,planetologyCheckDM:1}});
family('Recon Sensor',58,[['Basic',7,2,1000,{reconSkill:1}],['Improved',8,1,100,{reconSkill:1}],['Enhanced',10,1,10000,{reconSkill:2}],['Advanced',12,1,20000,{reconSkill:3}]],{...singleton,exclusive:'recon-sensor',operationalNotes:'Hardware Recon is not modified by INT. Includes visual/auditory/chemical/electronic sensing; may detect electronic signatures without Electronics(sensors).'});
family('Cutting Torch',58,[['Basic',5,2,500],['Improved',9,2,5000],['Advanced',13,1,5000]],{effects:{improvisedMeleeDamage:'3D',armourPiercing:4}});
family('Electronics Toolkit',58,[['Basic',6,1,2000,tool(['Electronics'],0)],['Improved',8,1,4000,tool(['Electronics'],1)],['Enhanced',10,1,6000,tool(['Electronics'],2)],['Advanced',12,1,8000,tool(['Electronics'],3)]],{operationalNotes:'Toolkit must be at least equipmentTL for a positive repairDM; skill cap is not a granted skill.'});
add('Fire Extinguisher',5,100,1,59,{effects:{extinguishesFire:true}});
family('Scientific Toolkit',59,[['Basic',5,4,2000,tool(['Science'],0)],['Improved',8,3,4000,tool(['Science'],1)],['Enhanced',11,3,6000,tool(['Science'],2)],['Advanced',14,3,8000,tool(['Science'],3)]],{requiresDetail:'Science specialty',operationalNotes:'One specified scientific specialty, not all Science subjects.'});
family('Forensic Toolkit',59,[['Basic',8,5,2000,tool(['Investigate'],0)],['Improved',10,4,4000,tool(['Investigate'],1)],['Enhanced',12,4,8000,tool(['Investigate'],2)],['Advanced',14,3,10000,tool(['Investigate'],3)]]);
family('Mechanical Toolkit',59,[['Basic',4,6,1000],['Improved',8,4,2000],['Advanced',12,2,4000]],{operationalNotes:'No fixed skill cap; equipment more than2TL above both toolkit and robot imposesDM−2.'});
family('Starship Engineering Toolkit',60,[['Basic',8,6,1000,tool(['Engineer','Electronics','Mechanic'],0)],['Improved',10,5,2000,tool(['Engineer','Electronics','Mechanic'],1)],['Enhanced',12,5,4000,tool(['Engineer','Electronics','Mechanic'],2)],['Advanced',14,4,10000,tool(['Engineer','Electronics','Mechanic'],3)]],{operationalNotes:'Includes cutting torch and mechanical/electronic/gravitic repair tools. Cap applies to starship work; general-purpose use may have a lower cap by referee decision.'});
add('Stylist Toolkit',6,2000,3,60,{requiresDetail:'Species',effects:{includedProductLitres:2,sessions:10,replenishmentCost:500},operationalNotes:'Product price doubles perSOC above8; unsuitable species can imposeDM−3 or worse.'});
family('Fire Control System',60,[['Basic',6,1,10000,{weaponDM:1}],['Improved',8,1,25000,{weaponDM:2}],['Enhanced',10,1,50000,{weaponDM:3}],['Advanced',12,1,100000,{weaponDM:4}]],{category:'Weapons',traits:['Scope'],requiresDetail:'Weapon or linked weapon group',operationalNotes:'Integrated weapon uses fire-control skill; manipulator-held/mounted weapon adds skill plus max(armDEXDM,fireControlDM), never both modifiers. One system per weapon/linked group.'});
for(const [grade,slots,minArm,cost,maxKg] of [['Small',1,3,500,3],['Medium',2,5,1000,6],['Heavy',10,7,5000,null],['Vehicle',15,null,10000,250]]){
 add(`Weapon Mount (${grade})`,5,cost,slots,61,{category:'Weapons',family:'weapon-mount',effects:{minimumManipulatorSize:minArm,maximumWeaponKg:maxKg,maximumLinkedWeapons:4},sourceConflict:'Main mount table omitsTL; p64 example supportsTL5.',operationalNotes:'Mount price excludes weapon and ammunition. Torso mount does not require an arm. Manipulator mounting requires stated arm size. Linked weapons must be same type.'});
 add(`Weapon Mount Autoloader (${grade})`,6,0,slots,61,{category:'Weapons',family:'weapon-autoloader',costBasis:'weaponMagazine',implemented:false,reason:'Requires associated mount, magazine unit price and ammunition count.',effects:{additionalSlots:slots,minimumManipulatorSize:minArm===null?null:minArm+1,maximumAdditionalMagazines:10},operationalNotes:'Adds100% associated mount Slots. Full10-magazine load costs20×magazine price; weapon and mount remain separate. Do not treat as free.'});
}

// Stable aliases for IDs used by the original small prototype.
for(const row of rows){if(row.id==='hostile-environment-protection')row.id='hostile-environment';if(row.id.startsWith('visual-camouflage-'))row.exclusive='visual-camouflage';}
for(const row of rows)if(['rtg-long-duration','rtg-short-duration','solar-power-unit'].includes(row.family)){
 delete row.maxCopies;delete row.exclusive;row.repeatable=true;
 if(row.family==='rtg-short-duration'){row.implemented=true;row.costBasis='interpretation';row.requiresPriceInterpretation=true;delete row.reason;}
 row.operationalNotes=(row.operationalNotes??'')+' Two full-capability RTG or solar units in any combination remove the single-source performance penalty.';
}
export const OPTIONS_ARRAY=rows;
export const OPTION_RULES={defaultSuiteSlots:5,freeAdditionalZeroSlots:'Size + TL',zeroSlotOverflow:'One Slot per additional item',rounding:'Positive fractional slot requirements round up; aggregate all submersible fractions first.',costBase:'Immutable chassis Base Slots',coverage:'Source-derived ordinary pp29–64 catalogue accounting. Operational states, prerequisites, equipment use and special construction modes require evaluator integration; unresolved rows explicitly blocked.'};
