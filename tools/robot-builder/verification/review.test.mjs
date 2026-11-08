import test from 'node:test';
import assert from 'node:assert/strict';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
import {renderReview} from '../js/review.mjs';
import {createRobotApi} from '../js/api.mjs';
const catalogue={kinds:[{id:'standard',label:'Ordinary robot'}],stages:[],coverage:{complete:false,gaps:[]}};
const design={name:'Review fixture',kind:'standard',techLevel:12,selections:{physical:{}}};
const evaluate=totals=>({status:'verified',totals,ledger:[],diagnostics:[],coverage:{complete:false,gaps:[]}});
const text=(totals,extra={})=>formatStatblock(projectReview(design,catalogue,{...evaluate(totals),...extra}));

test('review preserves construction and custom list prices without computing either',()=>{
 const output=text({cost:35000,constructionCost:31800,costLabel:'List price',slots:{used:3,capacity:8,remaining:5}});
 assert.match(output,/List price: Cr 35,000/);assert.match(output,/Construction cost: Cr 31,800/);
 assert.match(output,/Slots: 3 \/ 8 used · 5 free/);assert.match(output,/coverage incomplete/);
});
test('weapon output retains damage, range, magazine, modifiers and source',()=>{
 const output=text({weapons:[{id:'arm-weapon',label:'Stunner',damage:'3D',range:10,magazine:100,traits:['Stun','Zero-G'],linkedDamageBonus:0,fireControlDM:2,manipulatorDM:1,softwareLevel:0,attackModifier:null,source:{book:'Robot Handbook',pages:'64'}}]});
 for(const expected of ['Weapons','Stunner','3D','Range: 10','Magazine: 100','Stun','Fire Control DM: 2','Manipulator DM: 1','Software Level: 0','Attack Modifier: Not calculated','p. 64'])assert.ok(output.includes(expected),expected);
});
test('hardware skills, skill equivalents and tool limits remain distinct from software',()=>{
 const output=text({skills:[{id:'medic',level:0,effectiveLevel:2}],hardwareSkills:[{skill:'recon',level:2,characteristicModifier:0}],skillEquivalents:[{skill:'athletics',speciality:'strength',level:-1,manipulatorId:'arm-1'}],toolCaps:[{id:'medikit',optionId:'medikit',skills:{Medic:2},grantsSkill:false}]});
 for(const expected of ['Skill packages','Hardware skills','Characteristic-based equivalents','Level: -1','Tool skill limits','Grants Skill: No','do not grant software skill levels'])assert.ok(output.includes(expected),expected);
});
test('provisional values and null accounting are never shown as verified or zero',()=>{
 const output=text(null,{status:'invalid',previewTotals:{cost:123,provisional:true},ledger:[{label:'Unknown component',cost:null,slots:null}],diagnostics:[{severity:'error',message:'Capacity exceeded'}]});
 assert.match(output,/Provisional values only/);assert.match(output,/Needs correction/);assert.match(output,/Cost unresolved/);assert.match(output,/Slots unresolved/);assert.match(output,/Capacity exceeded/);assert.doesNotMatch(output,/Unknown component: Cr 0/);
});
test('blocked designs print selected equipment with no invented totals',()=>{
 const c={...catalogue,stages:[{id:'physical',controls:[{field:'options',choices:[{id:'sensor',label:'Sensor',source:{book:'Robot Handbook',pages:39}}]}]}]};
 const d={...design,selections:{physical:{options:['sensor'],optionParameters:{sensor:{detail:'Custom species'}}}}};
 const output=formatStatblock(projectReview(d,c,{...evaluate(null),status:'blocked',diagnostics:[{severity:'blocker',message:'Needs referee decision'}]}));
 assert.match(output,/Totals are not calculated/);assert.match(output,/Construction cost: Not calculated/);assert.match(output,/Sensor/);assert.match(output,/Custom species/);assert.match(output,/Needs referee decision/);
});
test('type catalogue prevents ordinary defaults leaking into clone review',()=>{
 const d={...design,kind:'clone',special:{growth:'accelerated'},selections:{physical:{defaultSuite:['sensor'],options:['sensor']}}};
 const c={...catalogue,kinds:[{id:'clone',label:'Clone'}],stages:[{id:'chassis',controls:[{field:'growth',target:'special',type:'select',label:'Growth',choices:[{id:'accelerated',label:'Accelerated growth'}]}]}]};
 const output=formatStatblock(projectReview(d,c,{...evaluate({cost:50000,characteristics:{STR:7,DEX:7}}),notApplicableMetrics:['slots','bandwidth']}));
 assert.match(output,/Clone/);assert.match(output,/Accelerated growth/);assert.match(output,/STR: 7/);assert.doesNotMatch(output,/Installed equipment|Sensor|Slots:|Bandwidth:/);
});
test('independent equipment instances retain distinct settings and ledger sources',()=>{
 const c={...catalogue,stages:[{id:'physical',controls:[{field:'optionInstances',choices:[{id:'tool',label:'Toolkit'}]}]}]};
 const d={...design,selections:{physical:{optionInstances:[{id:'one',optionId:'tool',parameters:{detail:'Biology'}},{id:'two',optionId:'tool',parameters:{detail:'Chemistry',quantity:2}}]}}};
 const ev={...evaluate({cost:5}),ledger:[{id:'instance-one',label:'Toolkit',cost:1,slots:1,quantity:1,source:{book:'Robot Handbook',pages:50}},{id:'instance-two',label:'Toolkit',cost:4,slots:2,quantity:2,source:{book:'Robot Handbook',pages:50}}]};
 const review=projectReview(d,c,ev),equipment=review.sections.find(item=>item.id==='equipment');
 assert.equal(equipment.rows.length,2);assert.match(equipment.rows[0].value,/Biology/);assert.match(equipment.rows[1].value,/Chemistry/);assert.match(equipment.rows[1].value,/Quantity: 2/);assert.match(equipment.rows[0].source,/p. 50/);
});
test('projection preserves unknown future arrays and nested operating values',()=>{
 const output=text({powerModes:[{label:'Solar',conditions:'Full sunlight',effects:{limited:true}}],futureFeatures:[{name:'New feature',value:7}]});
 assert.match(output,/Full sunlight/);assert.match(output,/Limited: Yes/);assert.match(output,/New feature/);assert.match(output,/Value: 7/);
});
test('review projection does not mutate engine inputs',()=>{
 const inputs=[structuredClone(design),structuredClone(catalogue),evaluate({cost:12,weapons:[{label:'Test',traits:['Stun']}]})];
 const snapshot=JSON.stringify(inputs);projectReview(...inputs);assert.equal(JSON.stringify(inputs),snapshot);
});
test('actual StarTek API review includes weapon and toolkit detail and remains detached',()=>{
 const api=createRobotApi();api.loadExample('startek');const view=api.getView();
 assert.match(view.statblock,/Stunner \(Handbook example\)/);assert.match(view.statblock,/Magazine: 100/);assert.match(view.statblock,/Starship Engineering Toolkit/);assert.match(view.statblock,/Tool skill limits/);
 view.review.sections[0].rows[0].value='tampered';assert.doesNotMatch(api.getStatblock(),/tampered/);
 assert.equal(api.getStatblock(),api.getView().statblock);
});
test('actual Steward Droid preserves list price and separate construction accounting',()=>{
 const api=createRobotApi();api.loadExample('steward-droid');const output=api.getStatblock();
 assert.match(output,/List price: Cr 35,000/);assert.match(output,/Construction cost: Cr /);assert.match(output,/Refrigerated Storage Compartment/);assert.match(output,/Allocated slots: 2/);
});
test('renderer uses safe text nodes, metric grids and expandable ledger',()=>{
 class Node{constructor(tag){this.tag=tag;this.children=[];this.textContent='';}append(...items){this.children.push(...items);}}
 const fakeDocument={createElement:tag=>new Node(tag)};
 const review=projectReview({...design,name:'<script>unsafe</script>'},catalogue,{...evaluate({cost:1}),ledger:[{label:'<img onerror=bad>',cost:1,slots:0}]});
 const root=renderReview(review,fakeDocument);const all=[];const visit=node=>{all.push(node);node.children.forEach(visit);};visit(root);
 assert.ok(all.some(node=>node.tag==='details'&&node.className.includes('review-ledger')));assert.ok(all.some(node=>node.tag==='dl'&&node.className==='review-metrics'));assert.ok(all.some(node=>node.textContent==='<img onerror=bad>'));assert.ok(all.every(node=>!Object.hasOwn(node,'innerHTML')));
});

test('suite and extra installation counts obey parameter appliesTo metadata',()=>{
 const choice={id:'wireless',label:'Wireless Data Link',source:{book:'Robot Handbook',pages:36},parameterControls:[{field:'quantity',label:'Quantity',appliesTo:'options'},{field:'suiteQuantity',label:'Default-suite copies',appliesTo:'defaultSuite'}]};
 const c={...catalogue,stages:[{id:'physical',controls:[{field:'defaultSuite',choices:[choice]},{field:'options',choices:[choice]}]}]};
 const d={...design,selections:{physical:{defaultSuite:['wireless'],options:['wireless'],optionParameters:{wireless:{suiteQuantity:2,quantity:3}}}}};
 const review=projectReview(d,c,evaluate({cost:30}));const rows=review.sections.find(item=>item.id==='equipment').rows;
 assert.match(rows[0].value,/Default suite copies: 2/);assert.doesNotMatch(rows[0].value,/Quantity: 3/);
 assert.match(rows[1].value,/Quantity: 3/);assert.doesNotMatch(rows[1].value,/suite copies|Suite Quantity/);
 assert.ok(rows.every(item=>item.source.includes('p. 36')));
});

test('primary profiles are human-first while secondary accounting remains printable',()=>{
 const api=createRobotApi();api.loadExample('startek');const view=api.getView();
 const rows=id=>view.review.sections.find(section=>section.id===id).rows;
 const weapon=rows('weapons')[0];assert.match(weapon.value,/3D damage/);assert.match(weapon.value,/Range: 10 m/);assert.match(weapon.detail,/Software Level: 0/);assert.match(weapon.detail,/FCS DM: 0/);assert.match(weapon.detail,/DEX DM: 2/);
 assert.doesNotMatch(weapon.value+weapon.detail,/wpn-startek|handbook-stunner|Weapon Id|Linked Weapons/);assert.ok(weapon.details.some(detail=>detail.label==='Magazine'&&detail.value==='100'));
 const skill=rows('skills')[0];assert.equal(skill.label,'Electronics (all)');assert.match(skill.value,/Installed level 1/);assert.match(skill.value,/Effective 3/);assert.match(skill.value,/INT/);assert.doesNotMatch(skill.value,/Id:|Grants Other/);
 const arm=rows('manipulators')[0];assert.equal(arm.label,'Base arm 1');assert.equal(arm.value,'Size 5 · STR 12 · DEX 8');assert.doesNotMatch(arm.value,/Increase|Kind/);
 const tool=rows('tool-caps')[0];assert.match(tool.value,/Engineer up to 3/);assert.doesNotMatch(tool.value,/Option Id|Grants Skill|Not calculated/);
 assert.match(view.statblock,/Magazine: 100/);assert.match(view.statblock,/Grants Skill: No/);assert.match(view.statblock,/Attack Modifier: Not calculated/);
});
test('skill context and unresolved weapon values are explicit rather than invented',()=>{
 const review=projectReview(design,catalogue,evaluate({skills:[{id:'gun-combat',level:0,characteristic:'DEX',effectiveLevel:null,modifierOptions:[{manipulatorId:'a',effectiveLevel:2,modifier:2}]}],manipulators:[{id:'a',kind:'additional',size:3,strength:5,dexterity:12}],weapons:[{label:'Pending weapon',damage:null,range:null,softwareLevel:null,fireControlDM:0,manipulatorDM:null}]}));
 const skill=review.sections.find(section=>section.id==='skills').rows[0];assert.match(skill.value,/Effective level unresolved/);assert.match(skill.details.find(item=>item.label==='Modifier Options').value,/Additional arm 1/);
 const weapon=review.sections.find(section=>section.id==='weapons').rows[0];assert.match(weapon.value,/Damage not calculated/);assert.match(weapon.detail,/Software Level: Not calculated/);assert.match(weapon.detail,/FCS DM: 0/);
});

test('weapon accessory names and sources survive secondary review and print',()=>{
 const api=createRobotApi();api.loadExample('startek');const draft=api.getView().design;
 api.select({stage:'physical',field:'weapons',value:draft.selections.physical.weapons.map(weapon=>({...weapon,accessories:['laser-sight-8']}))});
 const view=api.getView(),weapon=view.review.sections.find(section=>section.id==='weapons').rows[0];
 assert.ok(weapon.details.some(detail=>detail.label==='Accessory'&&detail.value==='Laser sight'&&detail.source.includes('135')));
 assert.match(view.statblock,/Accessory: Laser sight.*Core Rulebook.*135/);
 assert.doesNotMatch(weapon.details.find(detail=>detail.label==='Accessory Effects').value,/laser-sight-8/);
});

test('diagnostic context uses user-facing stage and field names instead of internal paths',()=>{
 const c={...catalogue,stages:[{id:'chassis',label:'Chassis Size',controls:[{field:'baseSTR',label:'Base STR',target:'special',type:'select',choices:[]}]}]};
 const review=projectReview(design,c,{status:'invalid',totals:null,diagnostics:[{severity:'error',path:'special.baseSTR',message:'Unavailable base score.'}],ledger:[],coverage:{complete:false}});
 const warning=review.sections.find(section=>section.id==='warnings').rows[0];
 assert.equal(warning.detail,'Chassis Size · Base STR');assert.doesNotMatch(formatStatblock(review),/special\.baseSTR/);
});
import {createDesign,updateDesign,getCatalogue,evaluateDesign} from '../engine/index.mjs';
test('individual cybernetic parts retain choices and contextual profiles through the API',()=>{
 let d=createDesign({kind:'cyborg',techLevel:8});
 d=updateDesign(d,{special:{cyborgMode:'augments',limbPriceInterpretation:'worked',augmentations:[{id:'arm',optionId:'cybernetic-arm',parameters:{strengthIncrease:1,dexterityIncrease:2}}]}});
 const api=createRobotApi();api.importDesign(JSON.stringify(d));const view=api.getView();
 const equipment=view.review.sections.find(s=>s.id==='equipment'),profiles=view.review.sections.find(s=>s.id==='augmentations');
 assert.equal(equipment.rows.length,1);assert.match(equipment.rows[0].label,/arm/i);
 assert.match(profiles.rows[0].value,/Cr 24,500/);assert.ok(profiles.rows[0].value.includes('STR '+view.evaluation.totals.augmentations[0].characteristics.strength+' / DEX 6'));
 assert.ok(view.statblock.includes('Nominal Dexterity: '+view.evaluation.totals.augmentations[0].characteristics.nominalDexterity));assert.match(view.statblock,/Interface Dexterity Cap: 6/);
 assert.doesNotMatch(view.statblock,/Slots: Not calculated|Bandwidth: Not calculated/);
});
test('biological cybernetic profiles are not lost inside generic operating details',()=>{
 let d=createDesign({kind:'biological',techLevel:13});
 d=updateDesign(d,{special:{genomeLocomotion:'confirmed',augmentations:[{id:'kidney',optionId:'organ-advanced',parameters:{complexity:'simple'}}]}});
 const review=projectReview(d,getCatalogue(d),evaluateDesign(d));
 assert.equal(review.sections.find(s=>s.id==='augmentations').rows.length,1);
 assert.ok(review.sections.find(s=>s.id==='augmentation-effects').rows.some(r=>r.label==='Overall Endurance Modifier'&&r.value==='2'));
 assert.ok(review.sections.find(s=>s.id==='equipment').rows.some(r=>/organ/i.test(r.label)));
 assert.ok(!review.sections.find(s=>s.id==='additional')?.rows.some(r=>r.label==='Augmentation'));
});
test('blocked augmentation records remain visible without invented part totals',()=>{
 let d=createDesign({kind:'cyborg',techLevel:8});
 d=updateDesign(d,{special:{cyborgMode:'augments',augmentations:[{id:'arm',optionId:'cybernetic-arm',parameters:{strengthIncrease:1}}]}});
 const result=evaluateDesign(d);assert.equal(result.status,'blocked');
 const review=projectReview(d,getCatalogue(d),result),output=formatStatblock(review);
 assert.match(output,/Cybernetic arm/i);assert.match(output,/Limb STR increase: 1/i);
 assert.equal(review.sections.some(s=>s.id==='augmentations'),false);
 assert.match(output,/Selected augmentations only: Not calculated/);
});
test('external option review keeps qualified source inputs and estimates outside certified totals',()=>{
 let d=createDesign({techLevel:12});d=updateDesign(d,{selections:{physical:{externalVehicleOptions:[{id:'test',name:'Source-specific fixture',sourceTitle:'Vehicle Handbook',sourceEdition:'Unverified edition',sourcePage:'12',minimumTL:10,quantity:2,spaceRule:'fixed',spaceValue:.125,percentageBasis:'unresolved',pricePerInstallation:1234,handbookEquivalent:'none'}]}}});
 const result=evaluateDesign(d),review=projectReview(d,getCatalogue(d),result),output=formatStatblock(review);
 assert.equal(result.status,'blocked');assert.equal(review.unavailable,true);
 const external=review.sections.find(s=>s.id==='external-options');assert.equal(external.rows.length,1);
 assert.match(external.rows[0].value,/Cr 2,468 quoted; 16 converted Slots/);
 assert.match(external.rows[0].source,/Unverified edition/);
 assert.match(output,/Construction cost: Not calculated/);assert.match(output,/do not certify the design/);
});
test('operating capabilities are grouped and preserve explicit readiness and unknown dependencies',()=>{
 const totals={equipmentCapabilities:[{id:'controller-a',optionId:'controller',label:'Controller',category:'controller',status:'inactive',targetLinkVerified:false,taskCapacity:0,condition:'Requires Remote Ops software',source:{book:'Robot Handbook',pages:44}},{id:'environment-summary',category:'environment',radiationProtection:500,depthMetres:100,source:{book:'Robot Handbook',pages:42}}]};
 const review=projectReview(design,catalogue,evaluate(totals)),output=formatStatblock(review);
 assert.equal(review.sections.find(s=>s.id==='capabilities-controller').collapsed,true);
 assert.match(output,/Requires Remote Ops software/);assert.match(output,/Target Link Verified: No/);assert.match(output,/Task Capacity: 0/);assert.match(output,/Radiation Protection: 500/);assert.match(output,/Depth Metres: 100/);
 assert.ok(!review.sections.find(s=>s.id==='additional')?.rows.some(r=>r.label==='Equipment Capabilities'));
});
test('microbot capability projections use the same source-cited review groups',()=>{
 let d=createDesign({kind:'microbot',techLevel:14});d=updateDesign(d,{special:{options:['vacuum-environment-protection','transceiver-500km-advanced']}});
 const review=projectReview(d,getCatalogue(d),evaluateDesign(d)),output=formatStatblock(review);
 assert.ok(review.sections.some(s=>s.id==='capabilities-communications'));assert.match(output,/Range Km: 500/);assert.match(output,/Vacuum: Yes/);
 assert.ok(!review.sections.find(s=>s.id==='additional')?.rows.some(r=>r.label==='Capabilities'));
});
test('blocked special paths retain selected custom skills with readable parent choices',()=>{
 const d={...design,kind:'cyborg',special:{brainCustomPackages:[{id:'skill',parentBrain:'brain-record',skill:'language',speciality:'Vilani',level:1}]}};
 const c={...catalogue,stages:[{id:'skills',controls:[{field:'brainCustomPackages',target:'special',type:'custom-packages',label:'Implant custom software',source:{book:'Robot Handbook',pages:'72,92'},itemFields:[{field:'parentBrain',label:'Implant',choices:[{id:'brain-record',label:'Basic brain implant 1'}]},{field:'skill',label:'Skill',choices:[{id:'language',label:'Language'}]},{field:'speciality',label:'Speciality'},{field:'level',label:'Level'}]}]}]};
 const review=projectReview(d,c,{...evaluate(null),status:'blocked'}),output=formatStatblock(review);
 assert.match(output,/Language \(Vilani\)/);assert.match(output,/Selected level 1/);assert.match(output,/Basic brain implant 1/);assert.doesNotMatch(output,/brain-record/);
});
test('implant brain and skill profiles stay readable and separate from recipient skills',()=>{
 let d=createDesign({kind:'cyborg',techLevel:15});d=updateDesign(d,{special:{cyborgMode:'augments',augmentations:[{id:'link',optionId:'neural-link-basic',parameters:{}},{id:'brain',optionId:'brain-implant-basic',parameters:{bandwidthUpgrade:'bw-1',softwarePackages:['admin-1']}}],brainCustomPackages:[{id:'language',parentBrain:'brain',skill:'language',speciality:'Vilani',level:1}]}});
 const result=evaluateDesign(d);assert.equal(result.status,'verified');
 const review=projectReview(d,getCatalogue(d),result),output=formatStatblock(review);
 assert.match(review.sections.find(s=>s.id==='implant-brains').rows[0].value,/INT 8/);
 assert.equal(review.sections.find(s=>s.id==='implant-skills').rows.length,2);
 assert.equal(review.sections.some(s=>s.id==='skills'),false);
 assert.match(output,/not automatically granted to the recipient/);assert.match(output,/Language \(Vilani\)/);
});
test('special legacy and per-instance equipment both survive a blocked review without ordinary leakage',()=>{
 let d=createDesign({kind:'microbot',techLevel:14});d=updateDesign(d,{special:{options:['wireless'],optionInstances:[{id:'radio',optionId:'transceiver-500km-advanced',parameters:{quantity:2}}]}});
 const result=evaluateDesign(d);assert.equal(result.status,'verified');
 const review=projectReview(d,getCatalogue(d),{...result,status:'blocked',totals:null}),rows=review.sections.find(s=>s.id==='equipment').rows;
 assert.equal(rows.length,2);assert.ok(rows.some(r=>r.label==='Wireless Data Link'));assert.ok(rows.some(r=>r.label.includes('500km')&&r.value.includes('Quantity: 2')));
 assert.ok(!rows.some(r=>r.label==='Visual Spectrum Sensor'));
});
test('auxiliary attacks and shared ammunition reservations have readable separate review rows',()=>{
 const c={...catalogue,stages:[{id:'physical',controls:[{field:'weapons',type:'weapons',itemFields:[{field:'ammunitionStorageId',choices:[{id:'instance:box',label:'Storage compartment 1'}]},{field:'auxiliaryAmmunition',choices:[{id:'smoke',label:'Smoke grenade'}]}]}]}]};
 const totals={weapons:[{id:'rifle',label:'Rifle',damage:'3D',range:500,placement:'held',auxiliary:{parentWeaponId:'rifle',mode:'attached',range:100,damage:'Smoke',ammunition:'smoke',cost:1015,fireControlAssociationVerified:false,context:'Separate attack.',source:{book:'Core Rulebook Update 2022',pages:135}},looseAmmunition:{storageId:'instance:box',grenade:'smoke',count:2,massKg:1}}],ammunitionStorage:[{storageId:'instance:box',capacityKg:2,reservedKg:1,remainingKg:1,scope:'Approximate capacity.',source:{book:'Robot Handbook',pages:55}}]};
 const review=projectReview(design,c,evaluate(totals)),output=formatStatblock(review);
 assert.equal(review.sections.find(s=>s.id==='weapons').rows.length,2);
 assert.match(output,/Rifle \/ secondary launcher/);assert.match(output,/Smoke grenade/);assert.match(output,/Fire Control Association Verified: No/);assert.match(output,/Storage compartment 1/);assert.match(output,/1 \/ 2 kg reserved/);assert.doesNotMatch(output,/instance:box/);
});
test('both ACR attacks appear once with distinct ranges and ammunition',()=>{
 const c={...catalogue,stages:[{id:'physical',controls:[{field:'weapons',type:'weapons',itemFields:[{field:'auxiliaryAmmunition',choices:[{id:'smoke',label:'Smoke grenade'},{id:'stun',label:'Stun grenade'}]}]}]}]};
 const attached={profileId:'gun:attached',parentWeaponId:'gun',mode:'attached',range:100,ammunition:'smoke',damage:'Smoke',context:'Separate attack.'};
 const integral={profileId:'gun:integral',parentWeaponId:'gun',mode:'integral-acr',range:250,ammunition:'stun',damage:'Stun',context:'Separate attack.'};
 const r=projectReview(design,c,evaluate({weapons:[{id:'gun',label:'Advanced Combat Rifle',auxiliary:attached,associatedAttacks:[attached,integral]}]}));
 const rows=r.sections.find(s=>s.id==='weapons').rows,output=formatStatblock(r);
 assert.equal(rows.length,3);assert.match(rows[1].value,/100 m/);assert.match(rows[2].value,/250 m/);
 assert.match(output,/Smoke grenade/);assert.match(output,/Stun grenade/);assert.doesNotMatch(output,/gun:attached|gun:integral/);
});

test('cyberlimb weapon profiles preserve parent, independent capacity and unknown recipient attacks',()=>{
 let d=createDesign({kind:'cyborg',techLevel:13});d=updateDesign(d,{special:{cyborgMode:'augments',augmentations:[{id:'arm',optionId:'cybernetic-arm',parameters:{quantity:2}}],augmentWeapons:[{id:'gun',parentLimb:'arm',weaponId:'handbook-stunner-12',placement:'arm',linkedWeapons:1,fireControl:'basic',autoload:true,extraMagazines:2,initialMagazines:1}]}});
 const result=evaluateDesign(d);assert.equal(result.status,'verified');
 const r=projectReview(d,getCatalogue(d),result),s=r.sections.find(s=>s.id==='limb-weapons'),output=formatStatblock(r);
 assert.equal(s.rows.length,2);assert.match(s.rows[0].value,/Cr 25,000/);assert.match(s.rows[0].label,/Cybernetic arm/i);
 assert.match(output,/Copies: 2/);assert.match(output,/Per Limb Slots: 3/);assert.match(output,/Base Attack Modifier: Not calculated/);
 assert.match(output,/Recipient skill and total attack modifiers remain uncalculated/);
 assert.ok(!r.sections.find(s=>s.id==='augmentations').rows[0].details.some(row=>row.label==='Weapons'));
});

test('blocked limb weapon selection remains readable without invented costs',()=>{
 let d=createDesign({kind:'cyborg',techLevel:13});d=updateDesign(d,{special:{cyborgMode:'augments',augmentations:[{id:'arm',optionId:'cybernetic-arm',parameters:{strengthIncrease:1}}],augmentWeapons:[{id:'gun',parentLimb:'arm',weaponId:'handbook-stunner-12',placement:'body',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1}]}});
 const result=evaluateDesign(d);assert.equal(result.status,'blocked');
 const r=projectReview(d,getCatalogue(d),result),s=r.sections.find(s=>s.id==='limb-weapons');
 assert.equal(s.rows.length,1);assert.match(s.rows[0].label,/Stunner/i);assert.match(s.rows[0].detail,/Cybernetic arm/i);
 assert.match(s.note,/Performance and costs have not been calculated/);
});
test('composite review exposes source-derived integration values without dumping nested designs',()=>{
 const child=createDesign({techLevel:13});child.name='Reference robot';
 const d=updateDesign(createDesign({kind:'ship-brain',techLevel:13}),{special:{designReferences:[{id:'reference',role:'installed-robot',quantity:1,design:child}]}});
 const evaluation=evaluateDesign(d),review=projectReview(d,getCatalogue(d),evaluation),output=formatStatblock(review);
 const component=review.sections.find(s=>s.id==='components');assert.equal(component.rows.length,1);assert.match(component.rows[0].value,/Cr 12,000 construction/);
 assert.match(output,/Cr 512,000/);assert.match(output,/External hull, vehicle or biological-host legality/);assert.match(output,/Integration values from component designs/);assert.match(output,/Referenced robot profiles/);assert.match(output,/Hits: 20/);assert.match(output,/Arm: 1/);assert.match(output,/not automatically to its host/);
 assert.ok(!review.sections.find(s=>s.id==='additional')?.rows.some(row=>row.label==='Composite'));
 assert.doesNotMatch(output,/Schema Version|designReferences|selections\./);
});

test('equipment summaries show changed settings while default options remain in disclosure',()=>{
 let d=createDesign({kind:'cyborg',techLevel:13});d=updateDesign(d,{special:{cyborgMode:'augments',augmentations:[{id:'arm',optionId:'cybernetic-arm',parameters:{}}]}});
 const review=projectReview(d,getCatalogue(d),evaluateDesign(d));const equipment=review.sections.find(s=>s.id==='equipment').rows[0];
 assert.doesNotMatch(equipment.value,/Ruggedised circuitry: No|Detachable socket/);assert.ok(equipment.details.some(row=>row.label.includes('Installation reference')));
});
test('general computer program states stay separate from robot brains and recipient skills',()=>{
 const d=updateDesign(createDesign({kind:'cyborg',techLevel:14}),{special:{cyborgMode:'augments',augmentations:[{id:'computer',optionId:'misc-mass-portable-computer-14',parameters:{}}],computerSoftware:[{id:'interface',parentComputer:'computer',program:'interface',rating:0,runningBandwidth:0,subject:'',databasePrice:10,expertUse:'assisted'},{id:'security',parentComputer:'computer',program:'security',rating:0,runningBandwidth:-1,subject:'',databasePrice:10,expertUse:'assisted'}]}});
 const result=evaluateDesign(d);assert.equal(result.status,'verified');const review=projectReview(d,getCatalogue(d),result),output=formatStatblock(review);
 assert.equal(review.sections.find(s=>s.id==='computer-programs').rows.length,2);assert.match(output,/Running at rating 0/);assert.match(output,/Stored, not running/);assert.match(output,/Processing 0 active \/ 5 available/);
 assert.match(output,/separate from robot brain software and recipient skills/);assert.ok(!review.sections.some(s=>s.id==='skills'||s.id==='implant-skills'));
 assert.doesNotMatch(output,/Parent Computer: computer/);
});
test('blocked clone review preserves calendar and due ageing without certifying characteristics',()=>{
 const d=updateDesign(createDesign({kind:'clone',techLevel:15}),{special:{growth:'accelerated',eduAccounting:'separate',trainingYears:15,baseINT:11,rollINT:3}});
 const result=evaluateDesign(d);assert.equal(result.status,'blocked');const review=projectReview(d,getCatalogue(d),result),output=formatStatblock(review);
 assert.match(output,/Apparent age 33 at training completion/);assert.match(output,/2 checks due/);assert.match(output,/15 elapsed adult years/);assert.match(output,/no unresolved ageing losses or current-character legality are certified/);
 assert.ok(!review.sections.some(s=>s.id==='clone-characteristics'));assert.equal(review.unavailable,true);
});

test('early clone review shows structured training and mature characteristics separately',()=>{
 const d=updateDesign(createDesign({kind:'clone',techLevel:15}),{special:{growth:'accelerated',eduAccounting:'separate',acceleratedStop:'early6',earlyGrowthPrice:'first-year-included',baseINT:11,rollINT:3,trainingYears:12}});
 const result=evaluateDesign(d);assert.equal(result.status,'verified');const review=projectReview(d,getCatalogue(d),result),output=formatStatblock(review);
 assert.match(output,/Apparent age 18 at training completion/);assert.equal(review.sections.find(s=>s.id==='clone-training-years').rows.length,12);assert.ok(review.sections.some(s=>s.id==='clone-characteristics'));
 assert.ok(!review.sections.find(s=>s.id==='additional')?.rows.some(r=>r.label==='Clone'));
});

test('composite review and statblock retain list price separately from construction costs',()=>{
 const child=createDesign({kind:'avatar',techLevel:13});
 const design=updateDesign(createDesign({kind:'avatar',techLevel:13}),{special:{avatarRole:'controller',controllerTier:'improved',designReferences:[{id:'receiver',role:'receiver',quantity:1,design:child}]},selections:{finalisation:{priceMode:'custom',customPrice:1}}});
 const result=evaluateDesign(design),review=projectReview(design,getCatalogue(design),result),output=formatStatblock(review);
 assert.equal(result.status,'verified');assert.match(output,/List price \(combined design\): Cr 1/);
 assert.match(output,/Construction cost: Cr 234,000/);assert.match(output,/Cr 22,000 construction/);
});
