import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXPANSION_PACK} from '../engine/expansion-pack.mjs';
import {culturalSkillAward,culturalAwardLabel,aslanSkillLabel,ASLAN_SKILL_LEGEND} from '../engine/aslan-skill-culture.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,url).href));source+='\nexport const audit={initial,queueEffects};';const {audit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(modern=true){const s=a.initial('aslan-cultural');s.deferredSpecializations=modern;s.character.species='aslan';s.character.gender='male';s.character.stats={STR:7,DEX:7,END:7,INT:7,EDU:7,SOC:7};s.stage='career';return s;}
function collect(value,path='',out=[]){if(culturalSkillAward(value))out.push({effect:value,path});if(Array.isArray(value))value.forEach((v,i)=>collect(v,path+'.'+i,out));else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))collect(v,path+'.'+k,out);return out;}
const marked=Object.entries(EXPANSION_PACK).filter(([id])=>id.startsWith('aslan.')).flatMap(([id,pack])=>collect({events:pack.events,mishaps:pack.mishaps},id));
test('every printed cultural marker permits the opposite gender in current rules and preserves old routing',()=>{assert.ok(marked.length>=20);for(const {effect,path} of marked){const s=fixture();s.character.gender=effect.condition.gender==='female'?'male':'female';a.queueEffects(s,[effect],'career',[]);assert.equal(s.stage,'career',path);for(const award of effect.then)assert.ok(Object.hasOwn(s.character.skills,award.name)||(s.character.deferredSkillAwards??[]).some(a=>a.name===award.name),path+' '+award.name);assert.match(s.character.historyNotes.at(-1),/Aliens 2026 p. 19/);const old=fixture(false);old.character.gender=s.character.gender;a.queueEffects(old,[effect],'career',[]);assert.equal(old.stage,'book-step',path);assert.match(old.pending.label,/restricted by gender/);}});
test('male-only Wanderer still learns the printed female-associated Mechanic mishap award',()=>{const s=fixture();a.queueEffects(s,EXPANSION_PACK['aslan.wanderer'].mishaps[5],'career',[]);assert.equal(s.character.skills.Mechanic,1);assert.equal(s.character.relationships.at(-1).role,'Rival');assert.equal(s.stage,'career');});
test('gender alternatives and Independence remain actual restrictions',()=>{const s=fixture();s.character.gender='female';const conditional={kind:'conditional',condition:{gender:'male'},then:[{kind:'skill',name:'Independence',value:1,mode:'set'}],otherwise:[{kind:'stat',name:'EDU',value:1}]};assert.equal(culturalSkillAward(conditional),false);a.queueEffects(s,[conditional],'career',[]);assert.equal(s.character.stats.EDU,8);assert.equal(s.character.skills.Independence,undefined);});
test('preference labels identify culture without removing choices or claiming a ban',()=>{const choice=EXPANSION_PACK['aslan.spacer'].events[6][0].options[0],label=culturalAwardLabel(choice);assert.equal(label.label,'Science (female-associated)');assert.equal(label.culturalPreference.restricted,false);assert.deepEqual(label.culturalPreference.source,{id:'aliens',page:19});assert.deepEqual(label.effects,choice.effects);assert.equal(choice.label,'Science');});

import {trainingInformation} from '../engine/training-information.mjs';
import {trainingInformationView} from '../gui/training-information.mjs';
import {api,exportSession,project} from '../engine/session.mjs';
import {aslanSetup,aslanEvent,force,settle} from './aslan-officer-fixtures.mjs';
test('p19 mapping distinguishes specialties and genuine Independence restriction',()=>{
 for(const name of ['Leadership','Tactics (military)','Gunner (turret)','Gunner (capital)','Heavy Weapons (portable)','Heavy Weapons (vehicle)'])assert.match(aslanSkillLabel(name),/\[male-associated\]/);
 for(const name of ['Animals (veterinary)','Astrogation','Broker','Electronics (comms)','Engineer (power)','Mechanic','Profession (construction)','Science (physics)','Steward'])assert.match(aslanSkillLabel(name),/\[female-associated\]/);
 for(const name of ['Gambler','Melee (blade)','Melee (unarmed)'])assert.match(aslanSkillLabel(name),/\[rare\]/);
 for(const name of ['Animals (handling)','Electronics (sensors)','Gunner (screen)','Heavy Weapons (artillery)','Melee (natural)','Medic','Tolerance'])assert.equal(aslanSkillLabel(name),name);
 assert.match(aslanSkillLabel('Independence'),/male-only; acquisition check/);
 assert.match(aslanSkillLabel('Electronics'),/all except sensors/);
});
test('table details expose accessible association text and legend without changing effects',()=>{
 const rows=EXPANSION_PACK['aslan.envoy'].training.advanced,before=structuredClone(rows),info=trainingInformation(rows,()=>true,{skillLabel:aslanSkillLabel,legend:ASLAN_SKILL_LEGEND});
 assert.ok(info.entries.some(e=>e.includes('Broker [female-associated]')));assert.ok(info.entries.some(e=>e.includes('Leadership [male-associated]')));assert.deepEqual(rows,before);
 const html=trainingInformationView(info,'Advanced',s=>String(s).replaceAll('<','&lt;'));assert.match(html,/female-associated/);assert.match(html,/may be learned by other genders/);assert.match(html,/Aliens 2026 p. 19/);assert.match(html,/role="dialog"/);
});
test('current Aslan training projection has labels and legend without changing saved commands',()=>{
 let r=settle(force(aslanSetup('culture-training'),'career',{id:'aslan.military',assignment:'warrior'},[6,6]));if(r.state.stage!=='training')r=settle(force(settle(aslanEvent(r,8)),'advancement',{},[6,6]));assert.equal(r.state.stage,'training');const info=r.state.trainingOptions.find(t=>t.id==='advanced').information;assert.equal(info.legend,ASLAN_SKILL_LEGEND);assert.ok(info.entries.some(e=>e.includes('female-associated')));
 const raw=exportSession(r.session),restored=api({operation:'import',raw});assert.equal(restored.ok,true);assert.equal(exportSession(restored.session),raw);assert.deepEqual(restored.state.trainingOptions,r.state.trainingOptions);
 const legacy=trainingInformation(EXPANSION_PACK['aslan.military'].training.advanced);assert.equal(legacy.legend,undefined);assert.ok(legacy.entries.every(e=>!e.includes('-associated')));
});
