import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE_PACK, CORE_PACK_VERSION, CORE_EFFECT_SCHEMA, getCoreCareerPack } from '../engine/core-pack.mjs';

// Independent expected mechanical values checked against the printed source pages.
// These tests deliberately do not import catalog/session/UI, keeping the pack portable.
const ids = ['agent','army','citizen','drifter','entertainer','marine','merchant','navy','noble','rogue','scholar','scout','prisoner','psion'].map(x=>'core.'+x);
function visit(value,fn) {
 if(Array.isArray(value)) return value.forEach(x=>visit(x,fn));
 if(value&&typeof value==='object') { fn(value); Object.values(value).forEach(x=>visit(x,fn)); }
}
function rowLabel(row) {
 return row.map(x=>{
  if(x.kind==='choice') return x.options.map(o=>rowLabel(o.effects)).join('|');
  if(x.kind==='skill'||x.kind==='psionic-talent') return x.name+(x.mode==='set'?'='+x.value:'');
  if(x.kind==='skill-choice') return '?'+x.scope+(x.mode==='set'?'='+x.value:'');
  if(x.kind==='stat') return x.name+(x.value>=0?'+':'')+x.value+(x.minimum?' minimum '+x.minimum:'');
  if(x.kind==='benefit') return '@'+x.name+':'+(x.dice??x.value);
  if(x.kind==='relationship') return '@'+x.type;
  throw new Error('Unexpected table effect: '+x.kind);
 }).join('&');
}
const expectedService = {
 agent:'Streetwise;Drive;Investigate;Flyer;Recon;Gun Combat',
 army:'Drive|Vacc Suit;Athletics;Gun Combat;Recon;Melee;Heavy Weapons',
 citizen:'Drive;Flyer;Streetwise;Melee;Steward;Profession',
 drifter:'Athletics;Melee (unarmed);Recon;Streetwise;Stealth;Survival',
 entertainer:'Art;Carouse;Deception;Drive;Persuade;Steward',
 marine:'Athletics;Vacc Suit;Tactics;Heavy Weapons;Gun Combat;Stealth',
 merchant:'Drive;Vacc Suit;Broker;Steward;Electronics;Persuade',
 navy:'Pilot;Vacc Suit;Athletics;Gunner;Mechanic;Gun Combat',
 noble:'Admin;Advocate;Electronics;Diplomat;Investigate;Persuade',
 rogue:'Deception;Recon;Athletics;Gun Combat;Stealth;Streetwise',
 scholar:'Drive|Flyer;Electronics;Diplomat;Medic;Investigate;Science',
 scout:'Pilot (small craft)|Pilot (spacecraft);Survival;Mechanic;Astrogation;Vacc Suit;Gun Combat',
 prisoner:'Athletics;Deception;Profession;Streetwise;Melee (unarmed);Persuade',
 psion:'Telepathy;Clairvoyance;Telekinesis;Awareness;Teleportation;?psionic-talents'
};
const expectedCash = {
 agent:[1000,2000,5000,7500,10000,25000,50000],
 army:[2000,5000,10000,10000,10000,20000,30000],
 citizen:[2000,5000,10000,10000,10000,50000,100000],
 drifter:[0,0,1000,2000,3000,4000,8000],
 entertainer:[0,0,10000,10000,40000,40000,80000],
 marine:[2000,5000,5000,10000,20000,30000,40000],
 merchant:[1000,5000,10000,20000,20000,40000,40000],
 navy:[1000,5000,5000,10000,20000,50000,50000],
 noble:[10000,10000,50000,50000,100000,100000,200000],
 rogue:[0,0,10000,10000,50000,100000,100000],
 scholar:[5000,10000,20000,30000,40000,60000,100000],
 scout:[20000,20000,30000,30000,50000,50000,50000],
 prisoner:[0,0,100,200,500,1000,2500],
 psion:[1000,2000,4000,4000,8000,8000,16000]
};
const assignments = {
 agent:['law','intelligence','corporate'], army:['support','infantry','cavalry'],
 citizen:['corporate','worker','colonist'], drifter:['barbarian','wanderer','scavenger'],
 entertainer:['artist','journalist','performer'], marine:['support','star','ground'],
 merchant:['marine','free','broker'], navy:['crew','technical','flight'],
 noble:['administrator','diplomat','dilettante'], rogue:['thief','enforcer','pirate'],
 scholar:['field','scientist','physician'], scout:['courier','surveyor','explorer'],
 prisoner:['inmate','thug','fixer'], psion:['wild','adept','warrior']
};
test('the pack has exactly twelve main careers plus Prisoner and Psion',()=>{
 assert.equal(CORE_PACK_VERSION,1);
 assert.deepEqual(Object.keys(CORE_PACK),ids);
 assert.equal(getCoreCareerPack('core.agent'),CORE_PACK['core.agent']);
 assert.equal(getCoreCareerPack('not-a-career'),null);
});
for(const [index,id] of ids.entries()) test(id+' has complete, source-grounded tables',()=>{
 const c=CORE_PACK[id],name=id.split('.')[1];
 assert.equal(c.source.title,'Core Rulebook Update 2022');
 assert.equal(c.source.id,'core');
 assert.deepEqual(c.source.pages,index<12?[22+index*2,23+index*2]:name==='prisoner'?[56,57]:[236,237]);
 for(const [table,rows] of Object.entries(c.training)) {
  if(table==='assignments') continue;
  assert.equal(rows.length,6,id+' '+table);
  rows.forEach(row=>assert.ok(Array.isArray(row)&&row.length>0));
 }
 assert.deepEqual(Object.keys(c.training.assignments),assignments[name]);
 for(const rows of Object.values(c.training.assignments)) {
  assert.equal(rows.length,6);
  rows.forEach(row=>assert.ok(Array.isArray(row)&&row.length>0));
 }
 assert.equal(c.training.service.map(rowLabel).join(';'),expectedService[name]);
 assert.deepEqual(c.benefits.cash,expectedCash[name]);
 assert.equal(c.benefits.material.length,7);
 c.benefits.material.forEach(row=>assert.ok(Array.isArray(row)&&row.length));
 const rankTables=c.ranks.assignments?Object.values(c.ranks.assignments):Object.values(c.ranks);
 for(const rows of rankTables) {
  assert.equal(rows.length,7);
  rows.forEach((row,i)=>{assert.equal(row.rank,i);assert.equal(typeof row.title,'string');assert.ok(Array.isArray(row.effects));});
 }
 assert.deepEqual(Object.keys(c.events).map(Number),[2,3,4,5,6,7,8,9,10,11,12]);
 assert.deepEqual(Object.keys(c.mishaps).map(Number),[1,2,3,4,5,6]);
});
test('basic training exceptions use assignment tables',()=>{
 const exception=['core.citizen','core.drifter','core.psion'];
 for(const id of ids) assert.equal(CORE_PACK[id].basicTraining.table,exception.includes(id)?'assignment':'service');
});
test('advanced education thresholds and absence are exact',()=>{
 for(const id of ids) {
  const c=CORE_PACK[id];
  if(['core.drifter','core.prisoner'].includes(id)) {
   assert.equal(c.training.advanced,undefined);
   assert.equal(c.prerequisites.advanced,undefined);
  } else {
   assert.equal(c.prerequisites.advanced.stat,'EDU');
   assert.equal(c.prerequisites.advanced.min,['core.citizen','core.entertainer','core.rogue','core.scholar'].includes(id)?10:8);
  }
 }
});
test('only Army, Marine and Navy expose commissioned training',()=>{
 for(const id of ids) {
  const has=['core.army','core.marine','core.navy'].includes(id);
  assert.equal(!!CORE_PACK[id].training.officer,has);
  assert.equal(!!CORE_PACK[id].prerequisites.officer?.commissioned,has);
 }
 assert.equal(CORE_PACK['core.army'].training.officer.map(rowLabel).join(';'),'Tactics (military);Leadership;Advocate;Diplomat;Electronics;Admin');
 assert.equal(CORE_PACK['core.marine'].training.officer.map(rowLabel).join(';'),'Electronics;Tactics;Admin;Advocate;Diplomat;Leadership');
 assert.equal(CORE_PACK['core.navy'].training.officer.map(rowLabel).join(';'),'Leadership;Electronics;Pilot;Melee (blade);Admin;Tactics (naval)');
});
test('assignment tables preserve duplicate outcomes, choices and specialisations',()=>{
 assert.equal(CORE_PACK['core.scholar'].training.assignments.scientist.map(rowLabel).join(';'),'Admin;Engineer;Science;Science;Electronics;Science');
 assert.equal(CORE_PACK['core.prisoner'].training.assignments.thug.map(rowLabel).join(';'),'Persuade;Melee (unarmed);Melee (unarmed);Melee (blade);Athletics (strength);Athletics (strength)');
 assert.equal(rowLabel(CORE_PACK['core.drifter'].training.assignments.barbarian[4]),'Seafarer (personal)|Seafarer (sail)');
 assert.equal(rowLabel(CORE_PACK['core.entertainer'].training.assignments.journalist[0]),'Art (holography)|Art (write)');
 assert.equal(rowLabel(CORE_PACK['core.army'].training.assignments.cavalry[4]),'Heavy Weapons (vehicle)');
});
test('rank bonuses include rank zero, minimum skill levels and characteristic floors',()=>{
 assert.equal(rowLabel(CORE_PACK['core.army'].ranks.enlisted[0].effects),'Gun Combat=1');
 assert.equal(rowLabel(CORE_PACK['core.marine'].ranks.enlisted[0].effects),'Gun Combat=1|Melee (blade)=1');
 assert.equal(rowLabel(CORE_PACK['core.prisoner'].ranks.default[0].effects),'Melee (unarmed)=1');
 assert.equal(rowLabel(CORE_PACK['core.scholar'].ranks.assignments.field[5].effects),'Science=2');
 assert.equal(rowLabel(CORE_PACK['core.navy'].ranks.officer[5].effects),'SOC+1 minimum 10');
 assert.equal(rowLabel(CORE_PACK['core.navy'].ranks.officer[6].effects),'SOC+1 minimum 12');
 assert.equal(rowLabel(CORE_PACK['core.army'].ranks.officer[6].effects),'SOC+1 minimum 10');
 assert.equal(rowLabel(CORE_PACK['core.marine'].ranks.officer[5].effects),'SOC+1 minimum 10');
 assert.equal(rowLabel(CORE_PACK['core.entertainer'].ranks.assignments.performer[3].effects),'STR+1');
});
test('material benefits preserve quantities, dice, conjunctions and alternatives',()=>{
 assert.equal(rowLabel(CORE_PACK['core.noble'].benefits.material[6]),'SOC+1&@Yacht:1');
 assert.equal(rowLabel(CORE_PACK['core.entertainer'].benefits.material[6]),'SOC+1&EDU+1');
 assert.equal(rowLabel(CORE_PACK['core.navy'].benefits.material[2]),'EDU+1|@Ship Share:2');
 assert.equal(rowLabel(CORE_PACK['core.rogue'].benefits.material[3]),'@Ship Share:1D');
 assert.equal(rowLabel(CORE_PACK['core.rogue'].benefits.material[6]),'@Ship Share:2D');
 assert.equal(rowLabel(CORE_PACK['core.prisoner'].benefits.material[6]),'Deception&Persuade&Stealth');
 assert.equal(rowLabel(CORE_PACK['core.psion'].benefits.material[6]),'@Ship Share:10');
});
test('Psion checks use source career page, not incorrect summary assumptions',()=>{
 const c=CORE_PACK['core.psion'];
 assert.deepEqual(c.progression.wild.advancement,{stat:'INT',target:8});
 assert.deepEqual(c.progression.warrior.advancement,{stat:'END',target:6});
 assert.equal(c.specialRules.refereePermission,true);
 assert.equal(c.specialRules.assignmentsAreSeparateCareers,true);
 assert.equal(c.specialRules.sourcePage,229);
 c.training.service.forEach(row=>row.forEach(effect=>assert.equal(effect.untrained,'acquisition-check')));
 assert.equal(rowLabel(c.ranks.assignments.adept[1].effects),'Science (psionicology)=1');
});

test('Prisoner release is strict and mishaps do not eject',()=>{
 const r=CORE_PACK['core.prisoner'].specialRules;
 assert.equal(r.forcedEntry,true);
 assert.equal(r.assignmentChangeEachTerm,true);
 assert.deepEqual(r.parole,{initialDice:'1D+2',maximum:12,release:'advancement-total-strictly-greater'});
 assert.equal(r.mishapsDoNotEject,true);
 assert.equal(r.anagathics,false);
 assert.notEqual(CORE_PACK['core.prisoner'].events[7][0].kind,'table-roll');
 assert.notEqual(CORE_PACK['core.prisoner'].events[12][0].kind,'promotion');
});
test('all effects have explicit, documented handlers and valid mechanics',()=>{
 visit(CORE_PACK,e=>{
  if(!e.kind) return;
  assert.ok(Object.hasOwn(CORE_EFFECT_SCHEMA,e.kind),'Undocumented effect '+e.kind);
  if(e.kind==='skill'||e.kind==='psionic-talent') {
   assert.ok(['increase','set'].includes(e.mode));
   assert.ok(Number.isInteger(e.value)&&e.value>=0&&e.value<=4);
   assert.ok(e.name.length>0);
  }
  if(e.kind==='stat') {
   assert.ok(['STR','DEX','END','INT','EDU','SOC','PSI'].includes(e.name));
   assert.ok(Number.isInteger(e.value)&&e.value!==0);
  }
  if(e.kind==='choice') {
   assert.ok(e.options.length>=2);
   e.options.forEach(o=>{assert.equal(typeof o.label,'string');assert.ok(Array.isArray(o.effects));});
  }
  if(e.kind==='check') {
   assert.ok(e.stat||e.skills);
   assert.ok(Number.isInteger(e.target));
   assert.ok(Array.isArray(e.success)&&Array.isArray(e.failure));
  }
  if(e.kind==='random') {
   const max=e.dice==='1D'?6:12,min=e.dice==='1D'?1:2;
   const used=e.outcomes.flatMap(o=>Array.from({length:o.max-o.min+1},(_,i)=>o.min+i));
   assert.deepEqual(used,Array.from({length:max-min+1},(_,i)=>i+min));
  }
 });
});
test('survival-disaster events explicitly preserve the career',()=>{
 ids.forEach(id=>assert.deepEqual(CORE_PACK[id].events[2],[{kind:'table-roll',table:'mishap',dice:'1D',keepCareer:true}]));
});
test('training events distinguish existing-skill increments from level-one awards',()=>{
 const agent=CORE_PACK['core.agent'].events[6][0];
 assert.equal(agent.target,8);
 assert.deepEqual(agent.success,[{kind:'skill-choice',scope:'existing',mode:'increase',value:1}]);
 const citizen=CORE_PACK['core.citizen'].events[6][0];
 assert.equal(citizen.target,10);
 assert.equal(citizen.success[0].mode,'set');
 assert.deepEqual(CORE_PACK['core.psion'].events[9][0].success[0].exclude,['Jack-of-all-Trades']);
});
test('injury choices and stay exceptions are not replaced by generic ejection',()=>{
 assert.equal(CORE_PACK['core.agent'].mishaps[1][0].options[0].effects[0].result,2);
 assert.equal(CORE_PACK['core.agent'].mishaps[1][0].options[1].effects[0].take,'lower');
 assert.equal(CORE_PACK['core.scholar'].mishaps[2][0].take,'higher');
 assert.ok(CORE_PACK['core.navy'].mishaps[2].some(e=>e.kind==='career-status'&&e.action==='stay'));
 assert.ok(CORE_PACK['core.scholar'].mishaps[6].some(e=>e.kind==='career-status'&&e.action==='stay'));
});
test('complex unresolved handlers stay explicit and locatable',()=>{
 const expected=['core.agent','core.citizen','core.merchant','core.navy','core.rogue','core.prisoner'];
 assert.deepEqual(ids.filter(id=>CORE_PACK[id].unsupported.length),expected);
 for(const id of expected) {
  const c=CORE_PACK[id];
  c.unsupported.forEach(e=>{
   assert.equal(e.kind,'unsupported');
   assert.equal(e.source.id,'core');
   assert.ok(c.source.pages.includes(e.source.page));
   assert.ok(e.reason.length>20);
  });
 }
});
test('data is recursively immutable, JSON-serializable, deterministic and source-safe',()=>{
 visit(CORE_PACK,value=>assert.equal(Object.isFrozen(value),true));
 assert.throws(()=>{CORE_PACK['core.agent'].benefits.cash[0]=999;},TypeError);
 const raw=JSON.stringify(CORE_PACK);
 assert.deepEqual(JSON.parse(raw),CORE_PACK);
 assert.ok(!/https?:\/\/|drive\.google|libfile_|Order #|Tremlas/i.test(raw));
 assert.ok(raw.length<150000);
});
