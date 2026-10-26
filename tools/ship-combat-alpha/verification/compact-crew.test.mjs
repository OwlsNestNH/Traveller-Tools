import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCrew,crewContribution,crewSkill,ROLES} from '../setup.mjs';
import {compactCrewDraft} from '../compact-crew.mjs';
import {createState,applyCommand,normalizeState} from '../engine.mjs';
const pilot={name:'',skillName:'Pilot (spacecraft)',skill:0,characteristicDM:2};
test('compact mode preserves inactive details, actual zero skill and default fallback independently',()=>{
 const old=normalizeCrew({mode:'quick',rating:'Elite',details:{pilot},overrides:{gunner:0}}),c=compactCrewDraft(old);
 assert.equal(c.rating,'Veteran');assert.equal(crewContribution(c,'pilot'),3);assert.equal(crewSkill(c,'pilot'),null);assert.deepEqual(c.details.pilot,pilot);
 c.activeDetails.push('pilot');assert.equal(crewContribution(c,'pilot'),2);assert.equal(crewSkill(c,'pilot'),0);assert.equal(crewContribution(c,'engineer'),3);assert.equal(crewContribution(c,'gunner'),0);
 assert.deepEqual(normalizeCrew(JSON.parse(JSON.stringify(c))),c);
});
test('legacy detailed unassigned remains unknown until explicit compact conversion; all roles and specialties retained',()=>{
 const old=normalizeCrew({mode:'detailed',ratingVersion:2,rating:'Heroic',details:Object.fromEntries(ROLES.filter(r=>r!=='engineer').map(r=>[r,{...pilot,skillName:r+' specialty'}]))});
 assert.equal(crewContribution(old,'engineer'),null);const c=compactCrewDraft(old);assert.equal(crewContribution(c,'engineer'),5);assert.equal(crewSkill(c,'engineer'),null);assert.deepEqual(c.details,old.details);
});
test('multiple gunner stations roundtrip through commands and unrelated edits, with atomic rejection',()=>{
 let state=createState();const id=state.ships[0].id,c=compactCrewDraft(state.ships[0].crew);c.gunnerStations=[{...pilot,mountId:'mount-a'},{...pilot,mountId:'mount-b',name:'Synthetic Gunner',skill:3}];
 state=applyCommand(state,{type:'set-crew',shipId:id,crew:c,situational:{pilot:-2},expectedRevision:state.revision});
 const before=structuredClone(state);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))),state);
 assert.equal(state.ships[0].crew.gunnerStations[1].skill,3);assert.equal(state.ships[0].situational.pilot,-2);
 assert.throws(()=>applyCommand(state,{type:'set-crew',shipId:id,crew:{...c,gunnerStations:[c.gunnerStations[0],c.gunnerStations[0]]}}),/unique/);
 assert.throws(()=>applyCommand(state,{type:'set-crew',shipId:id,crew:c,expectedRevision:0}));assert.deepEqual(state,before);
});
