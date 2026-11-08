import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
import {namedBenefitPlan,pensionEntitlement} from '../engine/benefits.mjs';
import {findCareer} from '../engine/catalog.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));source+='\nexport const audit={initial,apply,queueEffects,applyEffects,startPsionicTraining};';
const {audit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(id='core.scout',assignment){
 const s=a.initial('benefit-fixture');s.stage='benefits';s.character.species='human';s.character.gender='male';s.character.stats={STR:8,DEX:8,END:8,INT:8,EDU:8,SOC:10,PSI:9,FOL:0};
 s.character.careers=[{id,assignment:assignment??findCareer(id).assignments[0].id,terms:1,rank:0,benefitRolls:12,totalBenefits:0,successfulTerms:1}];s.active=0;return s;
}
function cmd(s,type,payload={},values){const rolls=[];if(values)s._override={index:0,values};const summary=a.apply(s,{type,payload},rolls);delete s._override;return {summary,rolls};}
const equipment=(s,changes={})=>cmd(s,'resolve-book',{confirmed:true,note:'Verified actual equipment entry and all printed restrictions',benefitItemName:'Service pistol',benefitItemCost:1000,benefitItemTL:10,benefitWeaponSkill:'Gun Combat (slug)',...changes});
const ship=(s,changes={})=>cmd(s,'resolve-book',{confirmed:true,note:'Source ship and history verified',benefitShipVariant:s.pending.variants[0],benefitShipHistory:'Recorded each required history result; referee resolved age and price interpretation.',...changes});
const sourceNone=s=>cmd(s,'resolve-book',{confirmed:true,note:'Referee resolved the unsupported award without another asset',benefitResolution:'none'});
const award=(s,name,next='benefit-complete',extra={})=>a.queueEffects(s,[{kind:'benefit',name,...extra}],next,[]);
function finishSource(s){if(s.pending?.kind==='benefit-equipment')equipment(s);else if(s.pending?.kind==='benefit-ship')ship(s);else if(s.pending?.kind==='benefit-source')sourceNone(s);}
const run=(r,type,payload={},options)=>execute(r.session??r,{type,payload},options);
const force=(r,type,payload,values)=>{const first=run(r,type,payload);return run(first,'gm-replay',{revision:first.revision,rollIndex:0,values,reason:'Source regression fixture'});};
function publicBenefits(seed,id,assignment){
 let r=run(createSession(seed),'setup',{species:'human'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'background',{skills:['Admin','Animals','Art']});r=run(r,'skip-precareer');r=run(r,'career',{id,assignment});if(id==='core.scout')r=run(r,'choose-effect',{index:0});r=run(r,'survival');r=run(r,'choose-effect',{index:0});r=run(r,'advancement');r=run(r,'training',{table:'service'});r=run(r,'leave-career');return run(r,'gm-mode',{enabled:true});
}
test('public Core Scout repro creates one borrowed asset and rerolls duplicate, with complete replay',()=>{
 let r=publicBenefits('benefit-public-4','core.scout','courier');r=force(r,'benefit',{cash:false},[6]);assert.equal(r.state.character.assets.length,1);assert.equal(r.state.character.assets[0].ownership,'use');assert.equal(r.state.character.assets[0].owner,'Scout Service');
 r=force(r,'benefit',{cash:false},[6]);assert.equal(r.state.character.assets.filter(a=>a.type==='ship').length,1);assert.ok(r.log.at(-1).rolls.some(d=>d.label==='Repeated ship: material benefit'));assert.ok(r.state.character.benefitAwards.some(a=>a.status==='rerolled'));
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('public Merchant repro pauses first award and progresses one same-asset mortgage',()=>{
 let r=publicBenefits('benefit-public-1','core.merchant','marine');const before=r.state.character.careers[0].benefitRolls;r=force(r,'benefit',{cash:false},[6]);
 assert.equal(r.state.pending.kind,'benefit-ship');assert.equal(r.state.character.assets,undefined);assert.equal(r.state.character.careers[0].benefitRolls,before);assert.equal(r.state.character.benefitAwards[0].status,'pending');
 const payload={confirmed:true,note:'Source variant and all quirks recorded',benefitShipVariant:'Far Trader',benefitShipHistory:'Every required Spacecraft Quirks result recorded by the referee'};
 r=run(r,'resolve-book',payload,{id:'ship-once'});const stable=r.state.character.assets[0].id;assert.equal(r.state.character.assets[0].mortgagePaidPercent,25);
 assert.deepEqual(run(r,'resolve-book',payload,{id:'ship-once'}).state,r.state);
 r=force(r,'benefit',{cash:false},[6]);assert.equal(r.state.character.assets.length,1);assert.equal(r.state.character.assets[0].id,stable);assert.equal(r.state.character.assets[0].mortgagePaidPercent,50);assert.equal(r.state.character.assets[0].name,'Far Trader');assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('Core duplicate Scout preserves original modifier and consumes only one benefit roll',()=>{
 const s=fixture();s.character.careers[0].benefitDM=1;cmd(s,'benefit',{cash:false},[5]);const count=s.character.careers[0].benefitRolls;const r=cmd(s,'benefit',{cash:false},[5]);assert.ok(r.rolls.length>=2);finishSource(s);assert.equal(s.character.careers[0].benefitRolls,count-1);assert.equal(s.character.careers[0].totalBenefits,2);
 const context=s.character.benefitRollHistory.at(-1);assert.equal(context.modifier,1);assert.ok(context.rolls.length>=2);assert.ok(context.rolls.every(x=>x.modifier===1&&x.result===x.natural+1));assert.equal(s.cashRolls,0);
});
for(const [id,assignment,model,owner]of[['aslan.wanderer','explorer','Ihateisho','Clan'],['vargr.spacer','explorer','Aetin','Pack']])test(id+' duplicate scout uses its own borrowed definition and same-table reroll',()=>{
 const s=fixture(id,id.startsWith('aslan.')?undefined:assignment);if(id.startsWith('aslan.'))s.character.stats.SOC=8;cmd(s,'benefit',{cash:false},[6]);if(s.pending)ship(s);const asset=s.character.assets[0];assert.equal(asset.name,model);assert.equal(asset.owner,owner);assert.equal(asset.ownership,'use');const r=cmd(s,'benefit',{cash:false},[6]);assert.ok(r.rolls.some(x=>x.label.includes('Repeated ship')));assert.equal(s.character.assets.filter(a=>a.type==='ship').length,1);
});
test('Zhodani Scout is owned Ninz with mortgage progress and Outdated Ships, never borrowed reroll',()=>{
 const s=fixture('zhodani.scholar');cmd(s,'benefit',{cash:false},[6]);assert.equal(s.pending.historyTable,'core.outdated-ships');assert.match(s.pending.historyTableLabel,/Outdated Ships/);assert.ok(s.pending.historyRollCount>=1&&s.pending.historyRollCount<=6);ship(s);
 const r=cmd(s,'benefit',{cash:false},[6]);assert.equal(r.rolls.length,1);assert.equal(s.character.assets.length,1);assert.equal(s.character.assets[0].name,'Ninz');assert.equal(s.character.assets[0].ownership,'owned');assert.equal(s.character.assets[0].mortgagePaidPercent,50);
});
test('same display name uses originating career/source, not character species',()=>{
 const s=fixture('zhodani.scholar');s.character.species='vargr';award(s,'Scout');assert.equal(s.pending.model,'Ninz');
 const v=fixture('vargr.spacer','explorer');v.character.species='zhodani';award(v,'Scout');assert.equal(v.pending.model,'Aetin');assert.equal(v.pending.ownership,'use');
});
for(const [id,name,model]of[['vargr.spacer','Corsair','Ueknou'],['vargr.intermediary','Courier','Avouz'],['vargr.merchant','Trader','Rourrghksue Aeknaek'],['zhodani.government','Courier','Yetsasl'],['zhodani.merchant','Trader','Zdebr']])test(name+' from '+id+' uses its exact model and alien history table',()=>{
 const s=fixture(id);award(s,name);assert.equal(s.pending.model,model);assert.equal(s.pending.historyTable,'core.outdated-ships');ship(s);award(s,name);assert.equal(s.character.assets.length,1);assert.equal(s.character.assets[0].mortgagePaidPercent,50);
});
test('Core ship repeat never adds another quirk roll and fifth award is unresolved',()=>{
 const s=fixture('core.merchant');award(s,'Free Trader');assert.equal(s.pending.historyTable,'core.spacecraft-quirks');ship(s,{benefitShipVariant:'Far Trader'});const assetId=s.character.assets[0].id;
 for(let n=2;n<=4;n++){award(s,'Free Trader');assert.equal(s.character.assets[0].mortgagePaidPercent,25*n);}
 award(s,'Free Trader');assert.equal(s.pending.kind,'benefit-source');assert.equal(s.character.assets.length,1);assert.equal(s.character.assets[0].id,assetId);assert.equal(s.character.assets[0].mortgagePaidPercent,100);assert.equal(s.character.benefitAwards.at(-1).status,'pending');sourceNone(s);
});
test('Vargr Lab Ship inherits Core Spacecraft Quirks and mortgage definition',()=>{
 const s=fixture('vargr.scientist');award(s,'Lab Ship');assert.equal(s.pending.historyTable,'core.spacecraft-quirks');ship(s);assert.equal(s.character.assets[0].definitionId,'core.material.Lab Ship');
});
test('TAS repeat grants exactly two terminal Ship Shares without recursive benefit dispatch',()=>{
 const s=fixture('core.agent');award(s,'TAS Membership');award(s,'TAS Membership');assert.equal(s.character.benefits.find(b=>b.name==='TAS Membership').quantity,1);assert.equal(s.character.benefits.find(b=>b.name==='Ship Share').quantity,2);assert.equal(s.character.benefitAwards.length,2);assert.ok(s.character.benefitAwards.every(a=>a.status==='resolved'));assert.ok(s.effectSteps<10);
});
test('equipment award is not completed or inventoried before source selection and limits are checked',()=>{
 const s=fixture('core.army');award(s,'Weapon');assert.equal(s.pending.kind,'benefit-equipment');assert.equal(s.character.benefits.length,0);assert.equal(s.character.careers[0].benefitRolls,12);
 assert.throws(()=>equipment(s,{benefitItemCost:3001}),/cost/);assert.throws(()=>equipment(s,{benefitItemTL:13}),/technology/);assert.throws(()=>equipment(s,{benefitWeaponSkill:'Gun Combat (invented)'}),/speciali|canonical/);
 equipment(s);assert.equal(s.character.assets[0].weaponSkill,'Gun Combat (slug)');assert.equal(s.character.careers[0].benefitRolls,11);assert.equal(s.character.benefitAwards[0].status,'resolved');
});
test('repeated Weapon improvement is restricted to an actual previously received weapon skill',()=>{
 const s=fixture('core.army');award(s,'Weapon');equipment(s);award(s,'Weapon');assert.equal(s.stage,'effect-choice');cmd(s,'choose-effect',{index:1});assert.equal(s.stage,'skill-choice');assert.throws(()=>cmd(s,'choose-skill',{name:'Melee (blade)'}),/available/);cmd(s,'choose-skill',{name:'Gun Combat (slug)'});assert.equal(s.character.skills['Gun Combat (slug)'],1);assert.equal(s.character.assets.length,1);
});
test('Armour trade-in preserves retired asset history and enforces Cr25000 maximum',()=>{
 const s=fixture('core.army');award(s,'Armour');equipment(s,{benefitItemName:'Original armour'});const first=s.character.assets[0].id;award(s,'Armour');cmd(s,'choose-effect',{index:1});assert.equal(s.pending.maximumCost,25000);assert.deepEqual(s.pending.replacementAssetIds,[first]);
 assert.throws(()=>equipment(s,{benefitItemName:'Replacement',benefitItemCost:25000}),/original active/);
 equipment(s,{benefitItemName:'Replacement',benefitItemCost:25000,benefitReplaceAssetId:first});assert.equal(s.character.assets.length,2);assert.equal(s.character.assets[0].active,false);assert.equal(s.character.assets[1].replacesAssetId,first);
});
test('Vargr repeated boat grants Pilot small craft without Core Ship Share alternative',()=>{
 const s=fixture('vargr.spacer','navy');award(s,"Ship's Boat");equipment(s,{benefitItemName:'Pinnace',benefitItemCost:9000000});award(s,"Ship's Boat");assert.equal(s.character.skills['Pilot (small craft)'],1);assert.equal(s.character.assets.length,1);assert.equal(s.character.benefits.some(b=>b.name==='Ship Share'),false);
});
test('Core first boat wording and undefined Combat Implant stop explicitly',()=>{
 for(const name of ["Ship's Boat",'Combat Implant']){const s=fixture('core.psion');award(s,name);assert.equal(s.pending.kind,'benefit-source');assert.equal(s.character.benefits.length,0);assert.equal(s.character.careers[0].benefitRolls,12);assert.throws(()=>cmd(s,'resolve-book',{confirmed:true,note:'Checked'}),/Choose record/);sourceNone(s);assert.equal(s.character.careers[0].benefitRolls,11);}
});
test('Clan Shares stay unconverted; bespoke kinship and Nenj do not receive TAS conversions',()=>{
 const s=fixture('aslan.guardian');award(s,'Clan Share','benefit-complete',{value:3});assert.equal(s.character.benefits[0].quantity,3);assert.equal(s.character.benefits[0].redemption,'source-required');assert.equal(s.character.cash,0);assert.equal(s.character.benefits.some(b=>b.name==='Ship Share'),false);
 award(s,'Ceremonial Kinship');assert.equal(s.pending.kind,'benefit-source');sourceNone(s);const z=fixture('zhodani.army');award(z,'Nenj');assert.equal(z.pending.kind,'benefit-source');assert.equal(z.character.benefits.length,0);
});
test('Following awards apply relationships and FOL; Patronage is annual, never cash',()=>{
 const s=fixture('companion.truther');award(s,'Minor Following');assert.equal(s.character.relationships[0].role,'Contact');assert.ok(s.character.stats.FOL>=1&&s.character.stats.FOL<=3);const old=s.character.stats.FOL;award(s,'Major Following');assert.equal(s.character.relationships[1].role,'Ally');assert.ok(s.character.stats.FOL>=old+2&&s.character.stats.FOL<=old+7);award(s,'Patronage');assert.equal(s.character.cash,0);assert.equal(s.character.annualIncome[0].annualCredits,10000);assert.ok(s.character.annualIncome[0].condition);
});
test('Sainthood candidacy bonus accumulates but interaction modifiers stay fixed2/4',()=>{
 const s=fixture('companion.believer');award(s,'Sainthood candidacy');assert.equal(s.pending.sainthood.checkBonus,1);assert.equal(s.character.sainthood.interactionDM,2);
 cmd(s,'resolve-book',{confirmed:true,note:'Belief-specific Science check failed at target14',benefitSainthoodSuccess:false});award(s,'Sainthood candidacy');assert.equal(s.pending.sainthood.checkBonus,2);assert.equal(s.character.sainthood.interactionDM,2);cmd(s,'resolve-book',{confirmed:true,note:'Belief-specific Science check succeeded with candidacy DM2',benefitSainthoodSuccess:true});
 award(s,'Sainthood candidacy');assert.equal(s.pending.sainthood.checkBonus,3);assert.equal(s.character.sainthood.interactionDM,4);cmd(s,'resolve-book',{confirmed:true,note:'Further check failed without removing existing sainthood',benefitSainthoodSuccess:false});assert.equal(s.character.sainthood.interactionDM,4);
});
test('Spiritual awards remain nonnumeric entitlements without invented cash/stat changes',()=>{
 const s=fixture('companion.believer');const before={...s.character.stats};award(s,'Spiritual assurance');award(s,'Spiritual assurance');assert.deepEqual(s.character.stats,before);assert.equal(s.character.cash,0);assert.equal(s.character.benefits[0].quantity,1);assert.equal(s.character.benefits[0].nonnumeric,true);
});
for(const [id,terms,soc,amount]of[['core.army',4,10,0],['core.army',5,10,10000],['core.psion',7,10,14000],['core.scout',6,10,0],['core.rogue',6,10,0],['aslan.military',6,10,0],['vargr.spacer',5,10,10000],['companion.truther',6,10,12000],['zhodani.navy',5,10,10000],['zhodani.navy',5,11,20000]])test('source pension '+id+' terms'+terms+' SOC'+soc+' is '+amount,()=>{
 const s=fixture(id,id==='vargr.spacer'?'corsair':undefined);s.stage='term-end';s.character.careers[0].terms=terms;s.character.stats.SOC=soc;cmd(s,'leave-career');assert.equal(s.character.careers[0].pension,amount);assert.equal(s.character.cash,0);assert.ok(s.character.careers[0].pensionCondition);if(id.startsWith('zhodani'))assert.match(s.character.careers[0].pensionCondition,/only within.*Consulate/);
});
test('unresolved pension pauses rather than disappearing and does not duplicate exit bonuses',()=>{
 const s=fixture('zhodani.navy');s.stage='term-end';s.character.careers[0].terms=5;s.character.careers[0].rank=1;delete s.character.stats.SOC;cmd(s,'leave-career');assert.equal(s.pending.kind,'pension');const rolls=s.character.careers[0].benefitRolls;
 cmd(s,'resolve-book',{confirmed:true,note:'Referee confirmed status and entitlement',pensionAnnualCredits:20000,pensionCondition:'Only within the Consulate'});assert.equal(s.character.careers[0].benefitRolls,rolls);assert.equal(s.character.careers[0].pension,20000);
 assert.equal(pensionEntitlement({careerId:'unknown.career',terms:6}).needsAdjudication,true);
});
test('named benefit dispatch without known provenance cannot invent a source definition',()=>{
 assert.equal(namedBenefitPlan({name:'Scout',careerId:'unknown.scout',source:{id:'aliens',page:277}}).needsAdjudication,true);
 assert.equal(namedBenefitPlan({name:'Combat Implant',careerId:'core.psion',source:{id:'core',page:236}}).needsAdjudication,true);
});
test('imported psionic failed attempts cannot be forgotten, and completed community training is reused',()=>{
 const s=a.initial('manual-history-review');s.stage='precareer';Object.assign(s.character,{stats:{STR:8,DEX:8,END:8,INT:8,EDU:8,SOC:8,PSI:9},skills:{Telepathy:0}});
 a.startPsionicTraining(s,{context:'companion-community',source:{id:'companion',page:33},next:'precareer'},[]);cmd(s,'resolve-book',{confirmed:true,note:'Original automatic Telepathy and failed Clairvoyance',psionicPreviousChecks:1,psionicFirstTalentChosen:true,psionicAttemptedTalents:['Telepathy','Clairvoyance']});cmd(s,'finish-psionic-training');
 a.applyEffects(s,[{kind:'skill',name:'Telekinesis',mode:'set',value:0}]);s.pendingEducation={id:'companion.psionic'};s.stage='companion-admission';cmd(s,'companion-entry');
 assert.throws(()=>cmd(s,'resolve-book',{confirmed:true,note:'Invalid omission',psionicPreviousChecks:1,psionicFirstTalentChosen:true,psionicAttemptedTalents:['Telepathy','Telekinesis']}),/erased|fewer/);
 cmd(s,'resolve-book',{confirmed:true,note:'Complete prior history preserved',psionicPreviousChecks:2,psionicFirstTalentChosen:true,psionicAttemptedTalents:['Telepathy','Clairvoyance','Telekinesis']});assert.equal(s.stage,'companion-admission');assert.equal(s.pendingEducation.psionicTrainingComplete,true);assert.equal(s.character.psionics.training.length,1);assert.throws(()=>cmd(s,'learn-talent',{talent:'Clairvoyance'}),/No psionic/);
});

test('TAS uniqueness includes a source-confirmed prior membership without native award history',()=>{
 const s=fixture('core.agent');s.character.benefits.push({name:'TAS Membership',quantity:1});award(s,'TAS Membership');assert.equal(s.character.benefits.filter(b=>b.name==='TAS Membership').length,1);assert.equal(s.character.benefits.find(b=>b.name==='Ship Share').quantity,2);
});
test('a source-confirmed no-award does not count as an actual prior equipment receipt',()=>{
 const s=fixture('core.navy');award(s,"Ship's Boat");sourceNone(s);award(s,"Ship's Boat");assert.equal(s.pending.kind,'benefit-source');assert.equal(s.character.benefitAwards.at(-1).previousCount,0);
});
test('mismatched book provenance cannot silently select an ordinary same-name benefit',()=>{
 assert.equal(namedBenefitPlan({name:'Weapon',careerId:'core.army',source:{id:'aliens',page:47}}).needsAdjudication,true);
});

test('ordinary Human can enter Truther with source-created FOL0 exactly once',()=>{
 let r=run(createSession('truther-entry'),'setup',{species:'human'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');
 assert.equal(Object.hasOwn(r.state.character.stats,'FOL'),false);assert.equal(r.state.careerChoices.find(c=>c.id==='companion.truther').disabled,false);
 const payload={id:'companion.truther',assignment:findCareer('companion.truther').assignments[0].id};r=run(r,'career',payload,{id:'enter-truther'});assert.equal(r.state.character.stats.FOL,0);r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-override',{field:'stat.FOL',value:3,reason:'Later earned following regression'});r=run(r,'career',payload,{id:'enter-truther'});assert.equal(r.state.character.stats.FOL,3);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
