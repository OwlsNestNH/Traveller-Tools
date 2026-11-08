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