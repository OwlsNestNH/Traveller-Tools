import {legacyPackets} from './player-snapshot-legacy-fixtures.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {createRecipientStore,RECIPIENT_PREFIX} from '../js/player-snapshot-storage.mjs';
import {measureSnapshotLink} from '../js/player-snapshot-codec.mjs';
import {playerSnapshotFixture as fixture} from '../js/player-snapshot-fixture.mjs';
const payload=measureSnapshotLink(fixture).payload;
function setup(){const data=new Map([['traveller-trade-route-calculator:v1','sentinel']]);const calls=[];const storage={getItem:key=>(calls.push(key),data.get(key)??null),setItem:(key,value)=>{calls.push(key);data.set(key,value);}};return {data,calls,store:createRecipientStore(()=>storage)};}
test('retains each immutable snapshot and separate Other lot annotations',()=>{
 const {data,calls,store}=setup();const first=store.open(payload);first.labels.set('cargo:1',{name:'First lot',base:'0'});first.labels.set('cargo:2',{name:null,base:null});first.labels.set('buy:1',{name:'Buy only',base:null});first.labels.set('sell:1',{name:'Sell only',base:null});assert.equal(first.save(),true);
 const next=structuredClone(fixture);next.capturedAt='New snapshot';next.ship.cashCredits='1';const secondPayload=measureSnapshotLink(next).payload;
 const second=store.open(secondPayload);assert.equal(second.labels.size,0);second.labels.set('cargo:1',{name:'Second snapshot',base:'123'});second.save();
 assert.equal(store.last().payload,secondPayload);assert.deepEqual(store.open(payload).labels.get('cargo:1'),{name:'First lot',base:'0'});assert.deepEqual(store.open(payload).labels.get('cargo:2'),{name:null,base:null});assert.equal(store.open(payload).snapshot.ship.cashCredits,'127450');assert.equal(store.open(secondPayload).snapshot.ship.cashCredits,'1');
 assert.equal(store.open(payload).labels.get('buy:1').name,'Buy only');assert.equal(store.open(payload).labels.get('sell:1').name,'Sell only');assert.equal(data.get('traveller-trade-route-calculator:v1'),'sentinel');assert.ok(calls.every(key=>key.startsWith(RECIPIENT_PREFIX)));
});
test('blocked and quota storage degrade to usable snapshot with visible notice',()=>{
 const notices=[],store=createRecipientStore(()=>{throw Error('blocked');});assert.ok(store.last().warning);const result=store.open(payload,n=>notices.push(n));assert.equal(result.snapshot.ship.cashCredits,'127450');assert.equal(result.save(),false);assert.match(notices.at(-1),/unavailable or full/);
 const quota=createRecipientStore(()=>({getItem:()=>null,setItem:()=>{throw Error('quota');}}));assert.equal(quota.open(payload,n=>notices.push(n)).save(),false);
});
test('hostile or mismatched saved records never alter transmitted data or partially import labels',()=>{
 const {data,store}=setup();const key=RECIPIENT_PREFIX+payload;
 for(const annotations of [[['cargo:0',{name:'Rename known goods',base:'1'}]],[['cargo:1',{name:'valid',base:null}],['cargo:2',{name:'bad',base:'-1'}]],[['__proto__',{name:'bad',base:'1'}]]]){
 data.set(key,JSON.stringify({version:1,payload,annotations}));const notes=[];const result=store.open(payload,n=>notes.push(n));assert.equal(result.labels.size,0);assert.ok(notes.length);assert.equal(result.snapshot.cargo[0].name,'Advanced Electronics');
 }
 data.set(RECIPIENT_PREFIX+'last','bad');assert.equal(store.last().payload,null);assert.throws(()=>store.open('bad'));
});

test('last-opened fractional legacy snapshot fails honestly without overwriting saved data',()=>{
 const records=new Map([[RECIPIENT_PREFIX+'last',legacyPackets.fractional[1]]]);
 const storage={getItem:key=>records.get(key)??null,setItem:()=>{throw Error('Unexpected mutation');}};
 const store=createRecipientStore(()=>storage);
 assert.throws(()=>store.last(),/No inventory was rounded or changed/);
 assert.throws(()=>store.open(legacyPackets.fractional[1]),/whole tons/);
 assert.equal(records.get(RECIPIENT_PREFIX+'last'),legacyPackets.fractional[1]);
});
