import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCrew,crewContribution,crewSkill} from '../setup.mjs';
import {rosterDraft,assignMember,projectRoster} from '../crew-roster.mjs';
import {createState,applyCommand,normalizeState} from '../engine.mjs';
import {beginSetup,editSetup,saveSetup} from '../setup-session.mjs';
import {renderCompactCrew} from '../compact-crew.mjs';
const legacy=()=>normalizeCrew({mode:'detailed',details:{pilot:{name:'',skillName:'Pilot (spacecraft)',skill:0,characteristicDM:2}}});
test('identity migration retains unnamed level zero and unknown aggregate modifier',()=>{
 const c=rosterDraft(legacy()),m=c.roster.members[0];assert.equal(m.name,'');assert.deepEqual(m.skills[0],{id:'skill-1',name:'Pilot (spacecraft)',level:0,stat:null,other:2});assert.equal(crewSkill(c,'pilot'),0);assert.equal(crewContribution(c,'pilot'),2);assert.deepEqual(normalizeCrew(c),c);
});
test('skills survive station reassignment and independent legacy detail edits',()=>{
 let c=rosterDraft(legacy());const m=c.roster.members[0];m.skills.push({id:'skill-2',name:'Mechanic',level:3,stat:1,other:0});c=assignMember(c,'engineer',m.id,'skill-2');assert.equal(crewContribution(c,'engineer'),4);assert.equal(c.roster.members[0].skills.length,2);c.details.engineer.skill=4;c=normalizeCrew(c);assert.equal(c.roster.members[0].skills[1].level,4);assert.equal(c.roster.members[0].skills[1].stat,1);assert.equal(c.details.pilot.skill,0);
 c.details.engineer.characteristicDM=2;c=normalizeCrew(c);assert.equal(c.roster.members[0].skills[1].stat,null);assert.equal(c.roster.members[0].skills[1].other,2);
});
test('roster persists through commands and old encounters remain unchanged',()=>{
 let s=createState(),c=rosterDraft(legacy());const before=structuredClone(s);assert.deepEqual(normalizeState(s),before);s=applyCommand(s,{type:'set-crew',shipId:s.ships[0].id,crew:c});assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s))),s);const invalid=structuredClone(c);invalid.roster.assignments.pilot.skillId='missing';assert.throws(()=>normalizeCrew(invalid),/missing/);assert.deepEqual(c,projectRoster(c));
});
test('unassigning a legacy station retains its crew identity and training',()=>{
 const c=rosterDraft(legacy());c.details.pilot=null;const saved=normalizeCrew(c);assert.equal(saved.details.pilot,null);assert.equal(saved.roster.assignments.pilot,undefined);assert.equal(saved.roster.members[0].skills[0].level,0);
});
test('out-of-menu legacy skill and Other values remain visible and roundtrip',()=>{
 const ship=createState().ships[0];ship.crew=normalizeCrew({mode:'detailed',details:{pilot:{name:'',skillName:'Pilot (retained specialty)',skill:9,characteristicDM:-5}}});const html=renderCompactCrew(ship);assert.match(html,/value="9" selected>9 · retained/);assert.match(html,/value="-5" selected>-5 · retained/);assert.match(html,/Pilot \(retained specialty\)/);const c=normalizeCrew(rosterDraft(ship.crew));assert.equal(c.details.pilot.skill,9);assert.equal(c.details.pilot.characteristicDM,-5);assert.equal(c.roster.members[0].skills[0].stat,null);
});
test('setup current quantities and basic allocation are transactional and capacity checked',()=>{
 const state=createState(),before=structuredClone(state);let draft=beginSetup(state);
 draft=editSetup(draft,{type:'add-ship',presetId:'core-194',name:'Synthetic setup ship',position:{q:0,r:0},velocity:{q:0,r:0},identity:{allegiance:'Test'},condition:{hull:79,fuel:null,cargo:0},systems:{mode:'allocated',basic:50}});
 assert.deepEqual(state,before);const added=draft.draft.ships.at(-1);assert.equal(added.template.hull,80);assert.equal(added.condition.hull,79);assert.equal(added.condition.fuel,null);assert.equal(added.systems.basic,50);
 assert.throws(()=>editSetup(draft,{type:'set-condition',shipId:added.id,condition:{...added.condition,hull:81}}));assert.equal(draft.draft.ships.at(-1).condition.hull,79);
 const saved=saveSetup(state,draft);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(saved))),saved);assert.equal(saved.ships.at(-1).identity.allegiance,'Test');assert.deepEqual(state,before);
});
