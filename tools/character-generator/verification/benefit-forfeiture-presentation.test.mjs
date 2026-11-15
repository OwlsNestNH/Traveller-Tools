import test from 'node:test';
import assert from 'node:assert/strict';
import {characterEffectDetails} from '../gui/roll-result-view.mjs';
import {currentEvents} from '../gui/final-sheet-history.mjs';
import {buildAslanAccessFixture} from './aslan-access-fixtures.mjs';
import {exportSession} from '../engine/session.mjs';
const details=(after,before)=>characterEffectDetails({changes:[{path:'benefitAwards.0',before,after}]},{careers:[]});
test('full and partial recorded forfeitures name the loss, not a new award',()=>{
 const before={name:'Clan Share',quantity:6,status:'resolved',received:true};
 assert.deepEqual(details({...before,forfeited:true,forfeitedQuantity:6,received:false},before),['Benefit forfeited: Clan Share × 6.']);
 assert.deepEqual(details({...before,forfeited:false,forfeitedQuantity:4},{...before,forfeitedQuantity:2}),['Benefit forfeited: Clan Share × 2.']);
});
test('metadata updates and legacy missing quantities never invent another loss',()=>{
 const old={name:'Clan Share',forfeited:true,forfeitedQuantity:4,status:'resolved'};
 assert.deepEqual(details({...old,forfeitureIds:['existing']},old),['Forfeited benefit record updated: Clan Share.']);
 assert.deepEqual(details({name:'Clan Share',forfeited:true}),['Benefit forfeited: Clan Share.']);
 assert.deepEqual(details(old,{name:'Clan Share',forfeited:true}),['Forfeited benefit record updated: Clan Share.']);
});
test('ordinary received and pending awards retain existing presentation',()=>{
 assert.deepEqual(details({name:'Weapon',status:'resolved'}),['Benefit award recorded: Weapon.']);
 assert.deepEqual(details({name:'Weapon',status:'pending'}),['Benefit award pending: Weapon.']);
});
test('the real Aslan outward-access failure identifies four forfeited shares and leaves accepted state untouched',()=>{
 const r=buildAslanAccessFixture({route:'outside-failed-entry'}),raw=exportSession(r.session),event=currentEvents(r,r.session).at(-1),lines=characterEffectDetails(event,{careers:[]});
 assert.ok(event.changes.some(c=>c.path==='benefitAwards.0'&&c.after.forfeitedQuantity===4&&c.before.quantity===4));
 assert.ok(lines.includes('Benefit forfeited: Clan Share × 4.'));assert.ok(!lines.includes('Benefit award recorded: Clan Share.'));assert.equal(exportSession(r.session),raw);
});
