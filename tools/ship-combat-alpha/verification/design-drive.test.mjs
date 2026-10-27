import test from 'node:test';
import assert from 'node:assert/strict';
import {designDrivePower,normalizeManoeuvre,initialManoeuvre} from '../design-drive-power.mjs';
import {normalizeTemplate,effectiveDesign} from '../setup.mjs';
import {createState,applyCommand,normalizeState} from '../engine.mjs';
import {applySetupFields} from '../setup-session.mjs';
import {powerReport} from '../systems.mjs';
const config=(overrides={})=>({...initialManoeuvre(null),mode:'auto',kind:'mdrive',tech:{profile:'standard',options:[],repeatApproved:false},...overrides});
const design=(c=config(),overrides={})=>({name:'Synthetic drive',tons:200,thrust:6,hull:80,armour:0,...overrides,record:{tl:15,...overrides.record,manoeuvre:c}});
test('rated design thrust recalculates exact Power; ship TL alone selects no tech effects',()=>{
 assert.equal(designDrivePower(design()).value,120);
 assert.equal(designDrivePower(design(config(),{thrust:3})).value,60);
 assert.equal(designDrivePower(design(config(),{record:{tl:100}})).value,120);
 const r=designDrivePower(design(config({tech:{profile:'advanced',options:['efficient'],repeatApproved:false}}),{tons:199.9,thrust:3}));assert.equal(r.exact,'44.9775');assert.equal(r.value,44.9775);
});
test('tech budgets, sides and referee-approved additive stacking are explicit',()=>{
 const twice={profile:'veryAdvanced',options:['efficient','efficient'],repeatApproved:false};
 assert.throws(()=>normalizeManoeuvre(config({tech:twice})),/referee approval/);
 assert.equal(designDrivePower(design(config({tech:{...twice,repeatApproved:true}}))).value,60);
 assert.equal(designDrivePower(design(config({tech:{profile:'early',options:['inefficient','inefficient'],repeatApproved:true}}))).value,192);
 assert.throws(()=>normalizeManoeuvre(config({tech:{profile:'unknown',options:['efficient','inefficient'],repeatApproved:true}})),/cannot mix/);
 assert.throws(()=>normalizeManoeuvre(config({tech:{profile:'prototype',options:['orbital'],repeatApproved:false}})),/exceed/);
 assert.throws(()=>normalizeManoeuvre(config({tech:{profile:'budget',options:['efficient'],repeatApproved:false}})),/conflict/);
});
test('size and range choices do not alter Power or silently apply movement effects',()=>{
 assert.equal(designDrivePower(design(config({tech:{profile:'advanced',options:['smaller'],repeatApproved:false}}))).value,120);
 assert.equal(designDrivePower(design(config({tech:{profile:'early',options:['orbital'],repeatApproved:false}}))).value,120);
});
test('unverified or incomplete component options remain unknown',()=>{
 assert.match(designDrivePower(design(config({tech:{profile:'unknown',options:[],repeatApproved:false}}))).reason,/unverified/);
 assert.equal(designDrivePower(design(config({tech:{profile:'highTechnology',options:['efficient'],repeatApproved:false}}))).value,null);
 const low=designDrivePower(design(config(),{record:{tl:8}}));assert.equal(low.value,120);assert.match(low.warnings.join(' '),/requires TL 12/);
});
test('station keeping, absent drives, reaction assistance and concealed drives stay distinct',()=>{
 assert.equal(designDrivePower(design(config(),{thrust:0})).value,5);
 assert.equal(designDrivePower(design(config({kind:'none'}),{thrust:0})).value,0);
 assert.equal(designDrivePower(design(config({kind:'reaction'}))).value,0);
 assert.equal(designDrivePower(design(config({kind:'combined',mdriveThrust:2}))).value,40);
 assert.equal(designDrivePower(design(config({kind:'combined',mdriveThrust:null}))).value,null);
 assert.equal(designDrivePower(design(config({kind:'concealed'}))).value,null);
 assert.equal(designDrivePower(design(config({kind:'concealed',mode:'manual',manualPower:87}))).value,87);
});
test('manual and recorded values survive rated-thrust changes without silent replacement',()=>{
 const manual=config({mode:'manual',manualPower:87});assert.equal(designDrivePower(design(manual,{thrust:2})).value,87);assert.equal(designDrivePower(design(manual,{thrust:6})).value,87);
 assert.equal(designDrivePower(design(config({mode:'manual',manualPower:0}))).value,0);
 const recorded=normalizeTemplate({name:'Synthetic retained',tons:200,thrust:6,hull:80,armour:0,record:{requirements:[{name:'Manoeuvre drive',power:87,source:null,basis:'manual override'}]}});
 assert.equal(designDrivePower(recorded).value,87);assert.equal(designDrivePower({...recorded,thrust:3}).value,87);assert.equal(Object.hasOwn(recorded.record,'manoeuvre'),false);
});
test('new optional design records round-trip without changing source, operating overrides, motion or old saves',()=>{
 let state=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:'core-194',name:'Synthetic retained ship',position:{q:2,r:3},velocity:{q:1,r:0}});
 const id=state.ships[0].id;state=applyCommand(state,{type:'set-systems',shipId:id,systems:{...state.ships[0].systems,driveOverride:7}});
 const before=structuredClone(state),d=effectiveDesign(state.ships[0]);d.thrust=3;d.record.manoeuvre=config();
 const next=applySetupFields(state,id,{design:d});assert.deepEqual(state,before);assert.deepEqual(next.ships[0].template,before.ships[0].template);assert.deepEqual(next.ships[0].motion,before.ships[0].motion);assert.equal(next.ships[0].systems.driveOverride,7);assert.equal(next.ships[0].designOverrides.record.manoeuvre.mode,'auto');
 assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(next))),next);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(before))),before);assert.throws(()=>applySetupFields(next,id,{design:{...d,thrust:4}},before.revision),/changed|revision/i);
 assert.equal(powerReport(next.ships[0]).rows.find(r=>r.id==='drive').power,7);
});
test('explicit unknown efficiency does not fall back to an invented operational draw',()=>{
 const state=applyCommand(createState({ships:[]}),{type:'add-ship',name:'Synthetic unknown',template:design(config({tech:{profile:'unknown',options:[],repeatApproved:false}})),position:{q:0,r:0},velocity:{q:0,r:0}}),ship=state.ships[0];
 assert.equal(powerReport(ship).rows.find(r=>r.id==='drive').power,null);
 const d=effectiveDesign(ship);ship.systems.driveThrust=1;assert.equal(designDrivePower(d).value,null);
});

test('unconfigured Custom Ship does not invent an installed M-drive or verified tech profile',()=>{const c=initialManoeuvre(null);assert.equal(c.kind,'unknown');assert.equal(c.mode,'recorded');assert.equal(c.tech.profile,'unknown');});

test('manual requirement provenance never inherits the ship publication citation',()=>{const d={thrust:2,source:{book:'Synthetic source',page:1},record:{requirements:[{name:'Manoeuvre drive',power:87,source:null,basis:'manual override'}]}};const r=designDrivePower(d);assert.equal(r.source,null);assert.equal(r.basis,'Manual recorded');});
