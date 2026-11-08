import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';

// Black-box golden journeys: only exported commands, never state injection or
// imported private functions. These selected journeys are not a full rules-coverage claim.
// Source decisions below are explicit hypothetical referee inputs. In particular,
// equipment catalogue validation remains manual, rather than being proved by a test.
// Golden hashes cover commands and original dice, not version-sensitive UI wording.
const FIXTURES = [
 {
  name:"Human university, two Army terms and a second Merchant career",seed:"golden-human-4",
  commands:[
   {"type":"setup","payload":{"name":"Golden human","species":"human","gender":"female"}},
   {"type":"roll-statistics","payload":{}},
   {"type":"accept-statistics","payload":{}},
   {"type":"background","payload":{"skills":["Admin","Animals"]}},
   {"type":"precareer","payload":{"id":"core.university"}},
   {"type":"education-skill","payload":{"name":"Admin"}},
   {"type":"education-skill","payload":{"name":"Medic"}},
   {"type":"education-event","payload":{}},
   {"type":"education-graduation","payload":{}},
   {"type":"career","payload":{"id":"core.army","assignment":"support"}},
   {"type":"preterm-commission","payload":{"attempt":true}},
   {"type":"choose-effect","payload":{"index":0}},
   {"type":"survival","payload":{}},
   {"type":"choose-skill","payload":{"name":"Admin"}},
   {"type":"advancement","payload":{}},
   {"type":"training","payload":{"table":"service"}},
   {"type":"choose-skill","payload":{"name":"Melee (unarmed)"}},
   {"type":"continue-career","payload":{}},
   {"type":"training","payload":{"table":"service"}},
   {"type":"survival","payload":{}},
   {"type":"advancement","payload":{}},
   {"type":"leave-career","payload":{}},
   {"type":"benefit","payload":{"cash":true}},
   {"type":"benefit","payload":{"cash":true}},
   {"type":"benefit","payload":{"cash":true}},
   {"type":"career","payload":{"id":"core.merchant","assignment":"marine"}},
   {"type":"choose-effect","payload":{"index":0}},
   {"type":"training","payload":{"table":"service"}},
   {"type":"survival","payload":{}},
   {"type":"ageing","payload":{}},
   {"type":"leave-career","payload":{}},
   {"type":"finish","payload":{}}
  ],
  expected:{"age":34,"terms":4,"stats":{"STR":8,"DEX":7,"END":9,"INT":9,"EDU":6,"SOC":6},"skills":{"Admin":2,"Animals":0,"Medic":2,"Drive":0,"Athletics":0,"Gun Combat":0,"Recon":1,"Melee":0,"Heavy Weapons":0,"Leadership":1,"Melee (unarmed)":1,"Broker":1},"cash":20000,"debt":0,"careers":[{"id":"core.army","assignment":"support","terms":2,"rank":2,"officer":true,"exit":"voluntary","pension":0},{"id":"core.merchant","assignment":"marine","terms":1,"rank":0,"officer":false,"exit":"involuntary","pension":0}],"relationships":["Ally","Ally","Ally","Enemy","Rival"],"coverage":[]},
  auditHash:"df0168e349478ae0511fe95739eb8dc20a253202124b3eeb7a6e5f8c337d9f81"
 },
 {
  name:"Native Vargr Merchant then Agent with deferred medical debt",seed:"golden-vargr-5",
  commands:[
   {"type":"setup","payload":{"name":"Golden vargr","species":"vargr","gender":"female"}},
   {"type":"roll-statistics","payload":{}},
   {"type":"accept-statistics","payload":{}},
   {"type":"background","payload":{"skills":["Admin","Animals","Art"]}},
   {"type":"skip-precareer","payload":{}},
   {"type":"career","payload":{"id":"vargr.merchant","assignment":"free"}},
   {"type":"survival","payload":{}},
   {"type":"advancement","payload":{}},
   {"type":"continue-career","payload":{}},
   {"type":"training","payload":{"table":"service"}},
   {"type":"survival","payload":{}},
   {"type":"injury-loss","payload":{"index":0}},
   {"type":"injury-treatment","payload":{"restore":{"STR":2,"DEX":0,"END":0},"inService":false}},
   {"type":"leave-career","payload":{}},
   {"type":"benefit","payload":{"cash":true}},
   {"type":"career","payload":{"id":"vargr.agent","assignment":"investigator"}},
   {"type":"choose-effect","payload":{"index":0}},
   {"type":"training","payload":{"table":"service"}},
   {"type":"choose-skill","payload":{"name":"Gun Combat (archaic)"}},
   {"type":"survival","payload":{}},
   {"type":"leave-career","payload":{}},
   {"type":"finish","payload":{}}
  ],
  expected:{"age":30,"terms":3,"stats":{"STR":5,"DEX":4,"END":3,"INT":5,"EDU":8,"CHA":8},"skills":{"Melee":0,"Admin":0,"Animals":0,"Art":0,"Carouse":1,"Deception":0,"Electronics":0,"Persuade":0,"Vacc Suit":0,"Drive":0,"Gun Combat (archaic)":1},"cash":0,"debt":5000,"careers":[{"id":"vargr.merchant","assignment":"free","terms":2,"rank":0,"officer":false,"exit":"involuntary","pension":0},{"id":"vargr.agent","assignment":"investigator","terms":1,"rank":0,"officer":false,"exit":"involuntary","pension":0}],"relationships":["Ally","Enemy"],"coverage":[]},
  auditHash:"ed3ae3093872714717cf7f37d6df0a38380e97fb7f1cb93e6b14f33ee6111ecf"
 },
 {
  name:"Native Zhodani childhood training and commissioned Navy",seed:"golden-zho-trained-4",
  commands:[
   {"type":"setup","payload":{"name":"Golden zhodani","species":"zhodani","gender":"female"}},
   {"type":"roll-statistics","payload":{}},
   {"type":"accept-statistics","payload":{}},
   {"type":"learn-talent","payload":{"talent":"Telepathy"}},
   {"type":"finish-psionic-training","payload":{}},
   {"type":"skip-precareer","payload":{}},
   {"type":"career","payload":{"id":"zhodani.navy","assignment":"crew"}},
   {"type":"survival","payload":{}},
   {"type":"injury-loss","payload":{"index":0}},
   {"type":"injury-treatment","payload":{"restore":{"STR":2,"DEX":0,"END":0},"inService":false}},
   {"type":"commission","payload":{}},
   {"type":"continue-career","payload":{}},
   {"type":"training","payload":{"table":"service"}},
   {"type":"choose-skill","payload":{"name":"Electronics (comms)"}},
   {"type":"survival","payload":{}},
   {"type":"advancement","payload":{}},
   {"type":"training","payload":{"table":"service"}},
   {"type":"choose-skill","payload":{"name":"Electronics (comms)"}},
   {"type":"leave-career","payload":{}},
   {"type":"benefit","payload":{"cash":true}},
   {"type":"benefit","payload":{"cash":true}},
   {"type":"benefit","payload":{"cash":true}},
   {"type":"finish","payload":{}}
  ],
  expected:{"age":26,"terms":2,"stats":{"STR":10,"DEX":7,"END":8,"INT":9,"EDU":10,"SOC":10,"PSI":9},"skills":{"Telepathy":0,"Admin":0,"Athletics":0,"Electronics":0,"Gun Combat":0,"Gunner":0,"Vacc Suit":0,"Melee (blade)":1,"Electronics (comms)":2,"Leadership":1},"cash":15000,"debt":0,"careers":[{"id":"zhodani.navy","assignment":"crew","terms":2,"rank":2,"officer":true,"exit":"voluntary","pension":0}],"relationships":[],"coverage":[]},
  auditHash:"069745145b3b2d3eaf8583aeb831b0aeeaec8784ba6795f541e031cc8bdb5a45"
 },
 {
  name:"Standard Aezorgh two-term Scout",seed:"golden-aezorgh-0",
  commands:[
   {"type":"setup","payload":{"name":"Golden aezorgh","species":"aezorgh","gender":"female"}},
   {"type":"roll-statistics","payload":{}},
   {"type":"accept-statistics","payload":{}},
   {"type":"background","payload":{"skills":["Admin"]}},
   {"type":"skip-precareer","payload":{}},
   {"type":"career","payload":{"id":"core.scout","assignment":"courier"}},
   {"type":"choose-effect","payload":{"index":0}},
   {"type":"survival","payload":{}},
   {"type":"choose-effect","payload":{"index":0}},
   {"type":"advancement","payload":{}},
   {"type":"continue-career","payload":{}},
   {"type":"training","payload":{"table":"service"}},
   {"type":"survival","payload":{}},
   {"type":"advancement","payload":{}},
   {"type":"leave-career","payload":{}},
   {"type":"benefit","payload":{"cash":true}},
   {"type":"benefit","payload":{"cash":true}},
   {"type":"finish","payload":{}}
  ],
  expected:{"age":26,"terms":2,"stats":{"STR":4,"DEX":9,"END":7,"INT":10,"EDU":2,"SOC":3,"CHA":1},"skills":{"Athletics":0,"Mechanic":0,"Recon":0,"Stealth":0,"Admin":0,"Pilot":0,"Survival":0,"Astrogation":2,"Vacc Suit":0,"Gun Combat":0},"cash":50000,"debt":0,"careers":[{"id":"core.scout","assignment":"courier","terms":2,"rank":0,"officer":false,"exit":"voluntary","pension":0}],"relationships":["Contact","Contact","Enemy","Enemy"],"coverage":[]},
  auditHash:"3c2b3cd0af79bd90730b85acfc34361203c983514aee908f08b8cd57036a02f4"
 },
 {
  name:"Optional six-2D Aezorgh two-term Scout",seed:"golden-aezorgh-0",
  commands:[
   {"type":"configure","payload":{"aezorghTwoDice":true}},
   {"type":"setup","payload":{"name":"Golden aezorgh","species":"aezorgh","gender":"female"}},
   {"type":"roll-statistics","payload":{}},
   {"type":"accept-statistics","payload":{}},
   {"type":"background","payload":{"skills":["Admin"]}},
   {"type":"skip-precareer","payload":{}},
   {"type":"career","payload":{"id":"core.scout","assignment":"courier"}},
   {"type":"choose-effect","payload":{"index":0}},
   {"type":"survival","payload":{}},
   {"type":"advancement","payload":{}},
   {"type":"continue-career","payload":{}},
   {"type":"training","payload":{"table":"service"}},
   {"type":"survival","payload":{}},
   {"type":"leave-career","payload":{}},
   {"type":"benefit","payload":{"cash":true}},
   {"type":"finish","payload":{}}
  ],
  expected:{"age":26,"terms":2,"stats":{"STR":3,"DEX":12,"END":5,"INT":7,"EDU":3,"SOC":5,"CHA":2},"skills":{"Athletics":0,"Mechanic":0,"Recon":0,"Stealth":0,"Admin":0,"Pilot":0,"Survival":0,"Astrogation":1,"Vacc Suit":0,"Gun Combat":0,"Diplomat":1},"cash":20000,"debt":0,"careers":[{"id":"core.scout","assignment":"courier","terms":2,"rank":0,"officer":false,"exit":"involuntary","pension":0}],"relationships":["Contact","Enemy","Enemy","Rival"],"coverage":[]},
  auditHash:"0ee1d404e47f930eef45a05eaa962eb0833cfbb52a719c485570d692eca56cfc"
 },
 {
  name:"Native Aslan two-term Military and involuntary exit",seed:"golden-aslan-4",
  commands:[
   {"type":"setup","payload":{"name":"Golden aslan","species":"aslan","gender":"male"}},
   {"type":"roll-statistics","payload":{}},
   {"type":"accept-statistics","payload":{}},
   {"type":"resolve-book","payload":{"confirmed":true,"note":"Source-assisted golden fixture: birth order confirmed by the referee; native rite remains rolled by the engine.","birthOrder":"first-son","effects":[]}},
   {"type":"background","payload":{"skills":["Animals","Art","Athletics","Carouse"]}},
   {"type":"skip-precareer","payload":{}},
   {"type":"career","payload":{"id":"aslan.military","assignment":"warrior"}},
   {"type":"survival","payload":{}},
   {"type":"advancement","payload":{}},
   {"type":"choose-skill","payload":{"name":"Gun Combat (archaic)"}},
   {"type":"training","payload":{"table":"service"}},
   {"type":"choose-skill","payload":{"name":"Melee (unarmed)"}},
   {"type":"continue-career","payload":{}},
   {"type":"training","payload":{"table":"service"}},
   {"type":"choose-skill","payload":{"name":"Gun Combat (archaic)"}},
   {"type":"survival","payload":{}},
   {"type":"leave-career","payload":{}},
   {"type":"benefit","payload":{"cash":false}},
   {"type":"benefit","payload":{"cash":false}},
   {"type":"finish","payload":{}}
  ],
  expected:{"age":22,"terms":2,"stats":{"STR":6,"DEX":7,"END":5,"INT":6,"EDU":11,"SOC":8,"RITE":3},"skills":{"Animals":0,"Art":0,"Athletics":0,"Carouse":0,"Gun Combat":0,"Melee":0,"Navigation":0,"Survival":0,"Gun Combat (archaic)":2,"Melee (unarmed)":1},"cash":0,"debt":0,"careers":[{"id":"aslan.military","assignment":"warrior","terms":2,"rank":1,"officer":false,"exit":"involuntary","pension":0}],"relationships":["Rival"],"coverage":["species-setup"]},
  auditHash:"91ca3d4a95c4c568e2c1344d81e4b16c4a4557e3334deac350ea59715ba12b58"
 },
 {
  name:"Native Aslan early retirement with typed source-assisted equipment",seed:"golden-aslan-2",
  commands:[
   {"type":"setup","payload":{"name":"Golden aslan","species":"aslan","gender":"male"}},
   {"type":"roll-statistics","payload":{}},
   {"type":"accept-statistics","payload":{}},
   {"type":"resolve-book","payload":{"confirmed":true,"note":"Source-assisted golden fixture: birth order confirmed by the referee; native rite remains rolled by the engine.","birthOrder":"first-son","effects":[]}},
   {"type":"background","payload":{"skills":["Animals","Art","Athletics","Carouse"]}},
   {"type":"skip-precareer","payload":{}},
   {"type":"career","payload":{"id":"aslan.military","assignment":"warrior"}},
   {"type":"survival","payload":{}},
   {"type":"choose-effect","payload":{"index":0}},
   {"type":"advancement","payload":{}},
   {"type":"choose-skill","payload":{"name":"Gun Combat (archaic)"}},
   {"type":"training","payload":{"table":"service"}},
   {"type":"leave-career","payload":{"retire":true}},
   {"type":"gm-mode","payload":{"enabled":true}},
   {"type":"benefit","payload":{"cash":false}},
   {"type":"gm-replay","payload":{"revision":15,"rollIndex":0,"values":[4],"reason":"Golden regression: explicit referee roll replacement"}},
   {"type":"resolve-book","payload":{"confirmed":true,"note":"Source-assisted golden fixture: hypothetical referee-approved equipment input; catalogue verification remains manual.","benefitItemName":"Service pistol (fixture)","benefitItemCost":200,"benefitItemTL":6,"benefitWeaponSkill":"Gun Combat (slug)"}},
   {"type":"benefit","payload":{"cash":false}},
   {"type":"gm-replay","payload":{"revision":18,"rollIndex":0,"values":[1],"reason":"Golden regression: explicit referee roll replacement"}},
   {"type":"finish","payload":{}}
  ],
  expected:{"age":18,"terms":1,"stats":{"STR":7,"DEX":2,"END":9,"INT":7,"EDU":11,"SOC":5,"RITE":4},"skills":{"Animals":0,"Art":0,"Athletics":0,"Carouse":1,"Gun Combat":0,"Melee":0,"Navigation":0,"Survival":0,"Gun Combat (archaic)":1},"cash":0,"debt":0,"careers":[{"id":"aslan.military","assignment":"warrior","terms":1,"rank":1,"officer":false,"exit":"voluntary","pension":0}],"relationships":[],"coverage":["species-setup","benefit-equipment"]},
  auditHash:"7ea918b77b7304e49dd152fe81ee725a8c127f969060bfac0be43491e5011864"
 }
];

function run(fixture,commands=fixture.commands) {
 let session=createSession(fixture.seed),result=project(session);
 const states=[];
 for(const command of commands){
  const before=JSON.stringify(session);
  result=execute(session,command);
  assert.equal(JSON.stringify(session),before,'Commands must not mutate their input save.');
  session=result.session;
  // Every intermediate pending state must survive an actual disk-format roundtrip.
  const reopened=importSession(exportSession(session));
  assert.deepEqual(project(reopened),project(session));
  session=reopened;states.push(result.state);
 }
 return {...result,session,states};
}
function mechanics(state) {
 const x=state.character;
 return {age:x.age,terms:x.terms,stats:x.stats,skills:x.skills,cash:x.cash,debt:x.debt,
  careers:x.careers.map(y=>({id:y.id,assignment:y.assignment,terms:y.terms,rank:y.rank,officer:y.officer,exit:y.exit,pension:y.pension})),
  relationships:x.relationships.map(y=>y.role),coverage:state.coverage};
}
function auditHash(session) {
 return createHash('sha256').update(JSON.stringify(session.events.map(e=>({command:e.command,rolls:e.rolls})))).digest('hex');
}
for(const fixture of FIXTURES)test('golden: '+fixture.name,()=>{
 const r=run(fixture);
 assert.equal(r.state.stage,'finish');assert.equal(r.state.active,null);
 assert.deepEqual(mechanics(r.state),fixture.expected);
 assert.equal(auditHash(r.session),fixture.auditHash,'Command/roll changes require deliberate source review of this golden.');
 assert.equal(r.log.length,fixture.commands.length);
 assert.deepEqual(r.log.map(e=>e.type),fixture.commands.map(c=>c.type));
 assert.ok(r.log.every(e=>e.summary.length>0&&Array.isArray(e.rolls)&&Array.isArray(e.changes)));
 assert.ok(r.log.some(e=>e.rolls.length));
 assert.ok(r.log.some(e=>e.changes.length));
 assert.ok(r.state.character.careers.every(c=>c.benefitRolls===0));
 assert.ok((r.state.character.benefitAwards??[]).every(a=>a.status==='resolved'||a.status==='rerolled'));
 assert.equal(r.state.pending,null,'No source decision may be hidden by completion.');
 const repeated=run(fixture);
 assert.equal(exportSession(repeated.session),exportSession(r.session),'A fresh execution must match byte-for-byte.');
 const last=r.session.events.at(-1);
 const retry=execute(r.session,last.command,{id:last.id});
 assert.equal(exportSession(retry.session),exportSession(r.session),'Retry must not duplicate settlement or benefits.');
});

test('golden Human education preserves selections, commission rights, second-career training and ageing audit',()=>{
 const f=FIXTURES[0],r=run(f),c=r.state.character,e=c.educations[0];
 assert.equal(e.id,'core.university');assert.equal(e.completed,true);assert.equal(e.graduation.graduated,true);
 assert.equal(e.graduation.honours,false);assert.equal(e.entry.source.page,16);assert.equal(e.careerAttempts,2);
 assert.deepEqual(e.selections,{'university-0':'Admin','university-1':'Medic'});
 assert.equal(c.careers[0].pretermCommission.success,true);assert.equal(c.careers[0].pretermCommission.total,9);
 assert.equal(c.careers[0].successfulTerms,2);assert.equal(c.careers[0].totalBenefits,3);
 const entry=f.commands.findIndex(cmd=>cmd.type==='career'&&cmd.payload.id==='core.merchant');
 assert.equal(r.states[entry].stage,'effect-choice','Later-career basic training is a choice, not all service skills.');
 assert.equal(r.states[entry+1].stage,'training','Later-career basic training does not replace ordinary training.');
 assert.equal(c.terms,c.educations.length+c.careers.reduce((sum,x)=>sum+x.terms,0));
 assert.ok(r.log.some(e=>e.type==='ageing'&&e.rolls.some(d=>d.label==='Ageing')));
 assert.equal(r.log.some(e=>e.type==='resolve-book'),false);
});

test('golden Vargr preserves alien characteristics, injury provenance and settles its bill exactly once',()=>{
 const r=run(FIXTURES[1]),c=r.state.character,b=c.medicalBills[0],injury=c.injuries[0];
 assert.equal(Object.hasOwn(c.stats,'SOC'),false);assert.equal(c.stats.CHA,8);
 assert.equal(injury.careerId,'vargr.merchant');assert.equal(injury.contextSource.id,'aliens');
 assert.equal(injury.source.page,49);assert.deepEqual(injury.tableRolls,[4]);assert.equal(injury.selectedLossIndex,0);
 assert.deepEqual(injury.losses,{STR:2,DEX:0,END:0});assert.deepEqual(injury.restoration,injury.losses);
 assert.equal(injury.inService,false,'The fixture deliberately chooses personal treatment, not a guessed alien employer.');
 assert.equal(b.personalCost,10000);assert.equal(b.paid,5000);assert.equal(b.debt,5000);assert.equal(b.settled,true);
 assert.equal(c.medicalSettlements.length,1);assert.deepEqual(c.medicalSettlements[0].billIds,[b.id]);
 assert.ok(r.log.at(-1).changes.some(x=>x.path==='debt'&&x.before===0&&x.after===5000));
 assert.ok(c.careers.every(x=>x.pensionEntitlement.excluded===false));
});

test('golden Zhodani replaces background skills with native psionics and preserves status/commission provenance',()=>{
 const f=FIXTURES[2],r=run(f),c=r.state.character,h=c.psionics;
 assert.equal(f.commands.some(x=>x.type==='background'),false);
 assert.equal(r.states[2].stage,'psionic-training');assert.equal(r.states[2].backgroundRemaining,0);
 assert.deepEqual(h.attempts.map(a=>[a.talent,a.automatic,a.checksAdded]),[['Telepathy',true,0]]);
 assert.equal(h.checksAttempted,0);assert.equal(h.training.length,1);assert.equal(h.training[0].completed,true);
 assert.equal(h.training[0].context,'zhodani-childhood');assert.equal(h.training[0].source.page,255);
 assert.equal(h.tests[0].careerTerms,0);assert.equal(c.skills.Telepathy,0);assert.equal(c.skills.Technopathy,undefined);
 const commission=r.log.find(e=>e.type==='commission');
 assert.equal(commission.rolls.length,0,'The eligible Intendant commission is automatic.');
 assert.equal(c.careers[0].pensionExitStatusBasis.socialClass,'intendant');
 assert.match(c.careers[0].pensionCondition,/within the Zhodani Consulate/);
 assert.equal(c.injuries[0].rank,0,'Treatment retains the rank when injured, not the later officer rank.');
 assert.equal(c.medicalSettlements[0].paid,10000);assert.equal(c.medicalSettlements[0].debt,0);
});

test('golden Aslan distinguishes involuntary exit, early retirement and pending typed awards',()=>{
 const ordinary=run(FIXTURES[5]),f=FIXTURES[6],retired=run(f);
 assert.equal(ordinary.state.character.retirementFromCreation,undefined);
 assert.equal(ordinary.state.character.careers[0].exit,'involuntary');
 assert.equal(ordinary.state.character.careers[0].pensionEntitlement.excluded,true);
 assert.equal(retired.states[11].exitOptions.canRetire,true);
 assert.equal(retired.states[11].exitOptions.canLeave,false);
 assert.equal(retired.states[15].stage,'book-step');assert.equal(retired.states[15].pending.kind,'benefit-equipment');
 assert.equal(retired.states[15].character.benefitAwards[0].status,'pending');
 assert.equal(retired.states[15].character.careers[0].benefitRolls,2,'The unresolved award does not consume a roll.');
 assert.equal(retired.states[16].character.careers[0].benefitRolls,1);
 assert.equal(retired.states[18].stage,'retirement');
 const c=retired.state.character;
 assert.equal(c.birthOrder,'first-son');assert.equal(c.retirementFromCreation,true);
 assert.equal(c.retirementDecision.source.page,22);assert.equal(c.retirementDecision.terms,1);
 assert.deepEqual(retired.state.coverage,['species-setup','benefit-equipment']);
 const asset=c.assets[0],award=c.benefitAwards[0];
 assert.equal(asset.id,'asset-1');assert.equal(asset.originCareerId,'aslan.military');
 assert.equal(asset.weaponSkill,'Gun Combat (slug)');assert.equal(asset.cost,200);assert.equal(asset.techLevel,6);
 assert.equal(asset.ownership,'owned');assert.deepEqual(asset.awardIds,['award-1']);
 assert.equal(award.origin.tableContext.result,4);assert.equal(award.status,'resolved');
 assert.match(asset.sourceDecision,/Source-assisted golden fixture/);
 assert.equal(award.decisions[0].note,asset.sourceDecision);
 assert.equal(retired.log.filter(x=>x.type==='resolve-book').length,2);
 assert.equal(retired.log.filter(x=>x.type==='gm-replay').length,2,'Original and replacement rolls remain separate audit actions.');
 assert.ok(retired.state.careerChoices.every(c=>c.disabled));
 assert.throws(()=>execute(retired.session,{type:'career',payload:{id:'aslan.envoy',assignment:'duellist'}}),/start of a term/);
});

for(const optional of [false,true])test('Aezorgh '+(optional?'optional six-2D raw43':'standard mixed-dice raw30')+' threshold is fixed before placement',()=>{
 let session=createSession('golden-aezorgh-0');
 if(optional)session=execute(session,{type:'configure',payload:{aezorghTwoDice:true}}).session;
 session=execute(session,{type:'setup',payload:{species:'aezorgh'}}).session;
 let r=execute(session,{type:'roll-statistics'}),before=r.state;
 assert.equal(before.statisticsRerollThreshold,optional?43:30);
 assert.equal(before.rollTotal,optional?46:29);
 assert.equal(before.rollTotal,before.pool.reduce((sum,p)=>sum+p.base,0));
 assert.deepEqual(before.pool.map(p=>p.count),optional?[2,2,2,2,2,2]:[1,2,1,2,1,1]);
 assert.equal(before.statisticsCanReroll,!optional);
 if(optional){
  assert.throws(()=>execute(r.session,{type:'roll-statistics'}),/43/);
  r=execute(r.session,{type:'swap-statistics',payload:{a:0,b:1}});
  assert.equal(r.state.rollTotal,46);assert.equal(r.state.pool[0].base,9);assert.equal(r.state.pool[0].value,4);
  assert.equal(r.state.pool[1].base,7);assert.equal(r.state.pool[1].value,10);
 }else{
  assert.throws(()=>execute(r.session,{type:'swap-statistics',payload:{a:0,b:1}}),/formulas/);
  r=execute(r.session,{type:'swap-statistics',payload:{a:0,b:2}});
  assert.equal(r.state.rollTotal,29);assert.equal(r.state.pool[0].value,6);assert.equal(r.state.pool[2].value,5);
 }
 assert.equal(r.state.statisticsRerollThreshold,optional?43:30);
 const accepted=execute(r.session,{type:'accept-statistics'});
 assert.equal(accepted.state.character.stats.CHA,Math.floor(accepted.state.character.stats.SOC/2));
 assert.deepEqual(project(importSession(exportSession(accepted.session))),project(accepted.session));
});

test('golden export rejects altered original dice rather than accepting a different character',()=>{
 const f=FIXTURES[1],r=run(f),tampered=JSON.parse(exportSession(r.session));
 const rolled=tampered.events.find(e=>e.rolls.length);
 rolled.rolls[0].values[0]=rolled.rolls[0].values[0]===6?5:6;
 assert.throws(()=>importSession(JSON.stringify(tampered)),/audit mismatch/i);
 assert.deepEqual(mechanics(project(r.session).state),f.expected,'The current save is unchanged.');
});
