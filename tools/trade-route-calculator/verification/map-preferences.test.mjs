import test from 'node:test';
import assert from 'node:assert/strict';
import {POLITICAL_TERRITORY_KEY,readPoliticalTerritory,savePoliticalTerritory} from '../js/map-preferences.mjs';

function withStorage(descriptor,run){
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,...descriptor});
 try{run();}
 finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
}

test('political territory defaults on without a saved choice and only explicit false disables it',()=>{
 for(const stored of [null,'true','','invalid','null','0']){
  withStorage({value:{getItem:key=>{assert.equal(key,POLITICAL_TERRITORY_KEY);return stored;}}},()=>assert.equal(readPoliticalTerritory(),true));
 }
 withStorage({value:{getItem:()=> 'false'}},()=>assert.equal(readPoliticalTerritory(),false));
});

test('political territory saves both choices separately from campaign data',()=>{
 const campaignKey='traveller-trade-route-calculator:v1',campaign='{"revision":7}';
 const saved=new Map([[campaignKey,campaign]]),writes=[];
 withStorage({value:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>{writes.push(key);saved.set(key,value);}}},()=>{
  savePoliticalTerritory(false);
  assert.equal(saved.get(POLITICAL_TERRITORY_KEY),'false');assert.equal(readPoliticalTerritory(),false);
  saved.set(campaignKey,'{"revision":8}'); // Import/reset replaces only the campaign key.
  assert.equal(readPoliticalTerritory(),false);
  savePoliticalTerritory(true);
  assert.equal(saved.get(POLITICAL_TERRITORY_KEY),'true');assert.equal(readPoliticalTerritory(),true);
  assert.equal(saved.get(campaignKey),'{"revision":8}');
  assert.deepEqual(writes,[POLITICAL_TERRITORY_KEY,POLITICAL_TERRITORY_KEY]);
 });
});

test('unavailable, blocked or full browser storage does not throw',()=>{
 for(const descriptor of [
  {value:undefined},
  {get(){throw Error('Storage denied');}},
  {value:{getItem(){throw Error('Read denied');},setItem(){throw Error('Quota exceeded');}}}
 ])withStorage(descriptor,()=>{
  assert.equal(readPoliticalTerritory(),true);
  assert.doesNotThrow(()=>savePoliticalTerritory(false));
  assert.doesNotThrow(()=>savePoliticalTerritory(true));
 });
});
