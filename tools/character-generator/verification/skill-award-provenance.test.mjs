import test from'node:test';import assert from'node:assert/strict';import{api}from'../engine/session.mjs';
import{skillAwardSource,pendingSkillAwardSource,skillAwardResult,pendingAwardInformation}from'../gui/skill-award-provenance.mjs';
const catalog=api({operation:'catalog'}),rank={kind:'rank',careerId:'core.army',rank:0,track:'enlisted',title:'Private',source:{id:'core',pages:[24,25]}},esc=String;
test('rank and academy labels distinguish entry, graduation and the actually held track',()=>{
 assert.equal(skillAwardSource(rank,catalog),'Army enlisted rank 0 · Private award');
 assert.equal(skillAwardSource({...rank,rank:1,track:'officer',title:'Lieutenant'},catalog),'Army officer rank 1 · Lieutenant award');
 assert.match(skillAwardSource({kind:'academy-entry',educationId:'core.academy-army',careerId:'core.army'},catalog),/Army academy admission basic-training award/);
 assert.match(skillAwardSource({kind:'academy-service',educationId:'core.academy-army',careerId:'core.army'},catalog),/Army academy graduation service award/);
 assert.equal(skillAwardSource(null,catalog),null);assert.equal(skillAwardSource({kind:'unknown',careerId:'core.army',rank:0},catalog),null);
});
test('pending source makes the earned level explicit without changing the offered choice',()=>{
 const state={pendingChoice:{name:'Gun Combat',mode:'set',value:1}},before=JSON.stringify(state),html=pendingSkillAwardSource({pending:rank},state,catalog,{esc});assert.match(html,/Private award/);assert.match(html,/<h3>Gun Combat 1<\/h3>/);assert.equal(JSON.stringify(state),before);assert.equal(pendingSkillAwardSource({},state,catalog,{esc}),'');
});
test('already-satisfied awards preserve higher skills and never advertise a new increase',()=>{
 const result={title:'Selected skill',details:['Another actual consequence'],status:'info'},before=JSON.stringify(result),award={origin:rank,name:'Gun Combat (slug)',before:3,after:3,changed:false,mode:'set',value:1};const shown=skillAwardResult(result,[award],catalog);assert.equal(shown.title,'Gun Combat (slug) 3 retained');assert.match(shown.details[0],/Private award; no skill increase/);assert.ok(shown.details.includes('Another actual consequence'));assert.equal(JSON.stringify(result),before);assert.equal(shown.full,result);assert.match(shown.information.source,/Core Rulebook Update 2022.*24–25/);
});
test('concurrent academy and officer rewards remain equally visible and individually sourced',()=>{
 const result={title:'Selected Vacc Suit',details:[],status:'info'},shown=skillAwardResult(result,[{origin:{kind:'academy-service',educationId:'core.academy-army',careerId:'core.army'},name:'Vacc Suit',after:1,changed:true},{origin:{...rank,rank:1,track:'officer',title:'Lieutenant'},name:'Leadership',after:1,changed:true}],catalog);assert.equal(shown.title,'Vacc Suit 1 · Leadership 1');assert.match(shown.details[0],/graduation service award/);assert.ok(shown.details.some(d=>/Leadership 1.*officer rank 1.*Lieutenant/.test(d)));assert.equal(shown.information.retainCrow,true);
});
test('unknown evidence and existing admission presentation are retained without guessing provenance',()=>{
 const result={title:'Admission succeeded',details:['Recorded academy service skills at level 0'],status:'success'};assert.equal(skillAwardResult(result,[{origin:{kind:'unknown'},name:'Gun Combat',after:1}],catalog),result);assert.equal(skillAwardResult(result,[{origin:{kind:'academy-entry',educationId:'core.academy-army'},name:'Gun Combat',after:0}],catalog),result);
});

test('information identifies the fixed-level rule and source without claiming talent acquisition',()=>{const fixed=pendingAwardInformation({pending:rank},{pendingChoice:{mode:'set',value:1}},catalog);assert.match(fixed.paragraphs.join(' '),/not an extra \+1/);assert.match(fixed.source,/Core Rulebook Update 2022.*24–25/);const psi=pendingAwardInformation({pending:rank},{stage:'psionic-training',psionicTraining:{award:{mode:'set',value:1}}},catalog);assert.match(psi.paragraphs.join(' '),/does not grant a free talent/);assert.equal(pendingAwardInformation({}, {},catalog),null);});

test('only exact duplicate skill consequences are condensed; other consequences remain visible',()=>{
 const award={origin:rank,name:'Gun Combat (slug)',before:null,after:1,changed:true};
 const result={title:'Award applied',details:['Skill Gun Combat (slug): untrained → 1.','Education: 8 → 9.'],status:'success'};
 const event={changes:[{path:'skills.Gun Combat (slug)',before:null,after:1},{path:'stats.EDU',before:8,after:9}]};
 const shown=skillAwardResult(result,[award],catalog,{event});
 assert.ok(!shown.details.includes(result.details[0]));assert.ok(shown.details.includes(result.details[1]));assert.equal(shown.full,result);
 const later={...result,details:['Skill Gun Combat (slug): untrained → 2.']};
 assert.ok(skillAwardResult(later,[award],catalog,{event:{changes:[{path:'skills.Gun Combat (slug)',after:2}]}}).details.includes(later.details[0]));
});
test('concurrent entitlements to the same skill retain both sources and one headline',()=>{
 const shown=skillAwardResult({title:'Skills',details:[]},[{origin:{kind:'academy-service',educationId:'core.academy-army',careerId:'core.army'},name:'Gun Combat (slug)',before:null,after:1,changed:true},{origin:rank,name:'Gun Combat (slug)',before:1,after:1,changed:false}],catalog);
 assert.equal(shown.title,'Gun Combat (slug) 1');assert.ok(shown.details.some(d=>d.includes('Private award; already satisfied, no increase.')));assert.ok(shown.information.paragraphs.some(d=>d.includes('graduation service award')));
});

 test('an earned rank skill never hides the actual advancement or commission outcome',()=>{for(const type of ['advancement','commission','preterm-commission']){const result={title:type==='advancement'?'Advancement succeeded.':'Commission succeeded automatically.',status:'success',details:['Check total 10 against target 8+.']},shown=skillAwardResult(result,[{origin:rank,name:'Gun Combat',before:null,after:1,changed:true}],catalog,{event:{type,changes:[]}});assert.equal(shown.title,'Gun Combat 1');assert.ok(shown.details.includes(result.title));assert.ok(shown.text.includes(result.title));assert.ok(shown.details.includes(result.details[0]));assert.equal(shown.status,'success');assert.equal(shown.full,result);}});

test('routine term bookkeeping moves to information without hiding actual consequences',()=>{
 const event={type:'commission',changes:[{path:'age',before:18,after:22},{path:'terms',before:0,after:1},{path:'careers.0.terms',before:0,after:1},{path:'careers.0.benefitRolls',before:0,after:1},{path:'stats.END',before:8,after:7},{path:'debt',before:0,after:1000}],pendingEffectChanges:{before:{careers:[{id:'core.army',automaticCommission:true}]},after:{careers:[{id:'core.army',automaticCommission:false}]}}},details=['Age: 18 → 22.','Completed terms: 0 → 1.','Career terms: 0 → 1.','Benefit rolls: 0 → 1.','Automatic commission is no longer pending in Army.','Endurance: 8 → 7.','Debt: Cr0 → Cr1,000.','Commissioned as an officer.'],result={title:'Commission succeeded automatically.',status:'success',details},shown=skillAwardResult(result,[{origin:{...rank,rank:1,track:'officer',title:'Lieutenant'},name:'Leadership',after:1,changed:true}],catalog,{event});
 for(const text of details.slice(0,5)){assert.ok(!shown.details.includes(text),text);assert.ok(shown.information.paragraphs.includes(text),text);}
 for(const text of details.slice(5))assert.ok(shown.details.includes(text),text);assert.ok(shown.details.includes(result.title));assert.equal(shown.full,result);
});
