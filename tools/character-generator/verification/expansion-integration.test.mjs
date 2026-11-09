
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXPANSION_PACK as pack} from '../engine/expansion-pack.mjs';

// White-box regression probes use a read-only in-memory copy.
// No production source is rewritten and no random fixture depends on a seed search.
const sourceURL=new URL('../engine/session.mjs',import.meta.url);
let source=await readFile(sourceURL,'utf8');
source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,sourceURL).href));
source+='\nexport const expansionAudit={initial,queueEffects,apply,rankEffects,modifierTotal,asBasic,rulesCheck};\n';
const {expansionAudit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(species,id,assignment){
 const s=a.initial('expansion-integration');
 s.stage='term-end';s.character.species=species;s.character.gender='male';s.character.culture='native';
 s.character.stats={STR:10,DEX:10,END:10,INT:8,EDU:10,SOC:8,CHA:8,PSI:8,FOL:0,RITE:6};
 s.character.skills={Admin:0,Telepathy:0};
 s.character.careers=[{id,assignment,terms:1,rank:0,officer:false,benefitRolls:5,totalBenefits:0,successfulTerms:1}];
 s.active=0;return s;
}
test('Vargr Merchant bankruptcy subtracts D3 benefit rolls',()=>{
 const s=fixture('vargr','vargr.merchant','free');s._override={index:0,values:[6]};
 a.queueEffects(s,pack['vargr.merchant'].mishaps[6],'term-end',[]);
 assert.equal(s.character.careers[0].benefitRolls,2);
});
test('next-career qualification bonus reaches and is consumed by the next qualification',()=>{
 const s=fixture('vargr','vargr.loner','prospector');
 a.queueEffects(s,[{kind:'modifier',target:'qualification',value:4,scope:'next',career:'next'}],'career',[]);
 s.active=null;s.stage='career';s._override={index:0,values:[2,2]};
 const summary=a.apply(s,{type:'career',payload:{id:'vargr.agent',assignment:'enforcer'}},[]);
 assert.notEqual(s.stage,'failed-entry');
 assert.match(summary,/"modifier":4/);
 assert.ok(!(s.modifiers??[]).some(m=>m.target==='qualification'&&m.scope==='next'));
});
test('Zhodani Navy age penalty is applied once',()=>{
 const s=fixture('zhodani','zhodani.merchant','broker');s.active=null;s.stage='career';s.character.age=34;
 s._override={index:0,values:[4,4]};
 const summary=a.apply(s,{type:'career',payload:{id:'zhodani.navy',assignment:'crew'}},[]);
 assert.match(summary,/"modifier":-2/);assert.notEqual(s.stage,'failed-entry');
});
test('Aezorgh SOC changes update the CHA used in later checks immediately',()=>{
 const s=fixture('aezorgh','vargr.agent','enforcer');s.character.stats.SOC=6;s.character.stats.CHA=3;
 a.queueEffects(s,[{kind:'stat',name:'SOC',value:6}],'term-end',[]);
 s._override={index:0,values:[3,3]};
 const check=a.rulesCheck(s,{stat:'CHA',target:6},[],'CHA after SOC change');
 assert.equal(check.dm,0);assert.equal(check.success,true);
});
test('Zhodani Prole crossing PSI9 is elevated and routed to training',()=>{
 const s=fixture('zhodani','zhodani.prole','worker');s.character.stats.PSI=8;s.character.stats.SOC=9;
 a.queueEffects(s,[{kind:'stat',name:'PSI',value:1}],'term-end',[]);
 assert.equal(s.character.stats.SOC,10);
 assert.notEqual(s.stage,'term-end','Immediate psionic training must not be silently skipped.');
});
test('nested Aslan Outlaw mishap ejects unless the source explicitly permits staying',()=>{
 const s=fixture('aslan','aslan.outlaw','pirate');s._override={index:0,values:[2]};
 a.queueEffects(s,pack['aslan.outlaw'].events[2],'advancement',[]);
 assert.equal(s.character.careers[0].forcedExit,true);
});
test('psionic-talent choice cannot silently grant an unlearned talent',()=>{
 const s=fixture('vargr','vargr.psion','institute');
 a.queueEffects(s,pack['vargr.psion'].training.service[0],'term-end',[]);
 if(s.stage==='skill-choice'){
  try {a.apply(s,{type:'choose-skill',payload:{name:'Teleportation'}},[]);}
  catch(error){assert.match(error.message,/talent|learn|train|available|acqui/i);}
 }
 assert.equal(s.character.skills.Teleportation,undefined);
});
test('Vargr Psion basic training grants talent level0, not an ordinary level increase',()=>{
 const [effect]=a.asBasic(pack['vargr.psion'].training.service[0]);
 assert.equal(effect.mode,'set');assert.equal(effect.value,0);
});
test('Zhodani Guard commission receives the shared rank1 Leadership award',()=>{
 const s=fixture('zhodani','zhodani.guard','support');s.stage='advancement';s.character.stats.SOC=10;
 s.character.careers[0].terms=0;
 a.apply(s,{type:'commission',payload:{}},[]);
 assert.equal(s.character.careers[0].rank,1);assert.equal(s.character.skills.Leadership,1);
});
test('advancement at the maximum rank does not repeat the same rank benefit',()=>{
 const s=fixture('aslan','aslan.military','warrior');s.stage='advancement';
 s.character.careers[0].rank=6;s.character.careers[0].automaticPromotion=true;
 a.apply(s,{type:'advancement',payload:{}},[]);
 assert.equal(s.character.careers[0].rank,6);
 assert.equal(s.character.benefits.filter(b=>b.name==='Clan Share').length,0);
});


test('Imperial Vargr use SOC in the six-stat allocation and minimum-reroll pool',()=>{
 const s=a.initial('imperial-vargr-statistics');
 s.character.species='vargr';s.character.culture='imperial';s.stage='statistics';
 a.apply(s,{type:'roll-statistics',payload:{}},[]);
 assert.deepEqual(s.pool.map(p=>p.key),['STR','DEX','END','INT','EDU','SOC']);
});
test('cross-species SOC benefit requests explicit resolution rather than crashing for native Vargr',()=>{
 const s=fixture('vargr','companion.believer','adherent');delete s.character.stats.SOC;
 assert.doesNotThrow(()=>a.queueEffects(s,pack['companion.believer'].benefits.material[3],'benefits',[]));
 assert.equal(s.stage,'book-step');
 assert.equal(s.character.stats.SOC,undefined,'Do not invent an unrolled SOC value.');
});

test('GM SOC correction updates Aezorgh derived CHA before the next rule check',()=>{
 const s=fixture('aezorgh','vargr.agent','enforcer');s.config.gm=true;s.character.stats.SOC=6;s.character.stats.CHA=3;
 a.apply(s,{type:'gm-override',payload:{field:'stat.SOC',value:12,reason:'Correct source result'}},[]);
 s._override={index:0,values:[3,3]};const check=a.rulesCheck(s,{stat:'CHA',target:6},[],'Derived CHA after GM correction');assert.equal(check.dm,0);assert.equal(check.success,true);
 assert.throws(()=>a.apply(s,{type:'gm-override',payload:{field:'stat.CHA',value:12,reason:'Would be silently overwritten'}},[]),/derived from SOC/);
});
