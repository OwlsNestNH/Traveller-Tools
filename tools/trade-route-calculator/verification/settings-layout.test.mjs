import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {settingsGroups,stepSetting,syncSettingsControls} from '../js/settings-layout.mjs';

const names=['name','ship','capacity','jump','broker','streetwise','admin','characteristic','rank','soc','mode','custom','shipTons','fuelCapacity','bladderJumps','fuelAboard','rooms-low','roomService-low','roomCustom-low','rooms-middle','roomService-middle','roomCustom-middle','rooms-high','roomService-high','roomCustom-high','people-middle','people-high','occupiedLowBerths','luggageOverride','luggageTons','supportCapacity','supportRemaining','supportUnits','creditStep','scoops','armed','reducedProfitLimitsEnabled','minPurchasePercent','maxSalePercent','maxBaseRetailEnabled','maxBaseRetail','useRawIllegalPrices','tax','insurance'];
test('compact Settings groups retain all 44 controls once, with rare groups collapsed',()=>{
 const grouped=settingsGroups.flatMap(group=>group.names);
 assert.equal(grouped.length,44);assert.deepEqual([...grouped].sort(),[...names].sort());
 assert.deepEqual(settingsGroups.filter(group=>group.advanced).map(group=>group.id),['trader','pricing','optional','rounding']);
});
test('numeric arrows retain native bounds and preserve fractional custom input',()=>{
 const events=[],input={value:'62.5',step:'any',min:'0',max:'100',disabled:false,dispatchEvent:event=>events.push(event.type)};
 const button={disabled:false,dataset:{settingStep:'1'},closest:()=>({querySelector:()=>input})};
 stepSetting(button);assert.equal(input.value,'63.5');button.dataset.settingStep='-1';stepSetting(button);assert.equal(input.value,'62.5');
 input.value='0';stepSetting(button);assert.equal(input.value,'0');input.value='100';button.dataset.settingStep='1';stepSetting(button);assert.equal(input.value,'100');
 assert.deepEqual(events,['input','change','input','change','input','change','input','change']);
 let nativeSteps=0;input.step='1';input.stepUp=()=>nativeSteps++;input.stepDown=()=>nativeSteps--;
 stepSetting(button);assert.equal(nativeSteps,1);button.dataset.settingStep='-1';stepSetting(button);assert.equal(nativeSteps,0);
 input.disabled=true;stepSetting(button);assert.equal(nativeSteps,0);input.disabled=false;button.disabled=true;stepSetting(button);assert.equal(nativeSteps,0);
});
test('read-only controls and stepper buttons share the editing lock',()=>{
 const arrows=[{disabled:false},{disabled:false}],classes=[],number={classList:{toggle:(...args)=>classes.push(args)},querySelectorAll:()=>arrows};
 const input={disabled:false,type:'number',closest:()=>number},save={disabled:false,hasAttribute:()=>false};
 const form={querySelectorAll:selector=>selector==='[name]'?[input]:[save]};
 syncSettingsControls(form,true);assert.equal(input.disabled,true);assert.equal(save.disabled,true);assert.ok(arrows.every(b=>b.disabled));assert.deepEqual(classes,[['is-disabled',true]]);
});
test('inline and modal Settings share the original save path and scoped estimates',async()=>{
 const source=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
 assert.match(source,/function settingsFields\(\)/);
 assert.match(source,/function saveSettings\(f,expected\)\{return act\('Ship \/ trader settings'/);
 assert.match(source,/settingsFields\(\),f=>saveSettings\(f,modalRevision\)/);
 assert.match(source,/saveSettings\(new FormData\(form\),settingsFormRevision\)/);
 assert.match(source,/settingsFormRevision!==state\.revision/);
 assert.match(source,/function updateAccommodationEstimate\(form=/);
 assert.match(source,/function updateFuelSettingsEstimate\(form=/);
});
