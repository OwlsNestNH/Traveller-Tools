import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {SaveNotCommittedError} from '../js/persistence.mjs';
import {settingsGroups,mountSettingsLayout,stepSetting,syncSettingsControls} from '../js/settings-layout.mjs';

const names=['name','ship','capacity','jump','broker','streetwise','admin','characteristic','rank','soc','mode','custom','shipTons','fuelCapacity','bladderTons','fuelAboard','rooms-low','roomService-low','roomCustom-low','rooms-middle','roomService-middle','roomCustom-middle','rooms-high','roomService-high','roomCustom-high','people-middle','people-high','occupiedLowBerths','luggageOverride','luggageTons','supportCapacity','supportRemaining','supportUnits','creditStep','scoops','armed','reducedProfitLimitsEnabled','minPurchasePercent','maxSalePercent','maxBaseRetailEnabled','maxBaseRetail','useRawIllegalPrices','tax','insurance','mortgageOriginal','mortgagePayment','mortgageRemaining','mortgagePaid','mortgageDueDate','maintenancePayment','maintenanceDueDate'];
test('compact Settings groups retain all 51 controls once, with existing disclosure defaults',()=>{
 const grouped=settingsGroups.flatMap(group=>group.names);
 assert.equal(grouped.length,51);assert.deepEqual([...grouped].sort(),[...names].sort());
 assert.deepEqual(settingsGroups.filter(group=>group.advanced).map(group=>group.id),['mortgage','maintenance','trader','pricing','optional','rounding']);
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
 assert.match(source,/function saveSettings\(f,expected,announce=true,onPrepared\)\{return act\('Ship \/ trader settings'/);
 assert.match(source,/settingsFields\(\),f=>completeSettingsWrite\(owner,f\)/);
 assert.match(source,/const data=new FormData\(form\)/);
 assert.match(source,/completeSettingsWrite\(owner,data\)/);
 assert.match(source,/return awaitInlineSettings\(owner,result\)/);
 assert.match(source,/saveSettings\(data,owner\.revision,false,\(\)=>\{owner\.candidatePrepared=true;\}\)/);
 assert.match(source,/revision!==state\.revision/);
 assert.match(source,/function updateAccommodationEstimate\(form=/);
 assert.match(source,/function updateFuelSettingsEstimate\(form=/);
});

// Minimal element double exercises the real layout builder. Native disclosure
// interaction, visibility and focus are verified separately in Chromium.
function layoutFixture(){
 const element=(tag='div')=>({tagName:tag.toUpperCase(),children:[],dataset:{},attributes:{},className:'',classList:{add(){}},setAttribute(name,value){this.attributes[name]=value;},append(...children){this.children.push(...children);},insertAdjacentHTML(position,html){assert.equal(position,'beforeend');this.referenceHTML=(this.referenceHTML||'')+html;},replaceChildren(...children){this.children=children;}});
 const inputs=names.map((name,i)=>Object.assign(element('input'),{name,type:'text',value:'preserved-'+i,disabled:i===3}));
 const fuelEstimate=element(),luggageEstimate=element(),costEstimate=element();
 const fuel={querySelector:()=>fuelEstimate,querySelectorAll:()=>[fuelEstimate,element('p')]};
 const accommodation={querySelector:selector=>selector==='#luggage-estimate'?luggageEstimate:costEstimate,querySelectorAll:()=>[element('p')]};
 const source=Object.assign(element(),{querySelector:()=>element('p'),querySelectorAll:selector=>selector==='[name]'?inputs:selector==='fieldset'?[fuel,accommodation]:[element('p')]});
 return {inputs,source,form:{querySelector:()=>source},document:{createElement:element}};
}
test('all eleven Settings groups mount as labelled native disclosures without replacing field values',()=>{
 const previous=globalThis.document;
 try{
  for(const override of [undefined,new Map([['campaign',false],['fuel',false],['trader',true]])]){
   const fixture=layoutFixture();globalThis.document=fixture.document;
   mountSettingsLayout(fixture.form,override);
   const groups=fixture.source.children[0].children.flatMap(column=>column.children);
   assert.equal(groups.length,11);
   for(const section of groups){
    const definition=settingsGroups.find(group=>group.id===section.dataset.settingsGroup),summary=section.children[0];
    assert.equal(section.tagName,'DETAILS');assert.equal(summary.tagName,'SUMMARY');
    assert.equal(summary.attributes['aria-label'],definition.title);
    assert.equal(summary.children.at(-1).attributes['aria-hidden'],'true');
    assert.equal(section.open,override?.get(definition.id)??!definition.advanced);
    const preserved=section.children.filter(child=>child.className==='setting-row').map(row=>row.children[1].children[0]);
    assert.deepEqual(preserved,definition.names.map(name=>fixture.inputs.find(input=>input.name===name)));
   }
   assert.deepEqual(fixture.inputs.map(input=>input.value),names.map((_,i)=>'preserved-'+i));
   assert.equal(fixture.inputs[3].disabled,true,'Layout does not unlock a disabled setting');
  }
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
test('all settings disclosures remember both states before replacement and ignore detached toggle events',async()=>{
 const source=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
 const capture=source.match(/^function captureSettingsDisclosures.*$/m)[0];
 const listen=source.match(/^document.addEventListener\('toggle'.*$/m)[0];
 const sections=[{dataset:{settingsGroup:'campaign'},open:false},{dataset:{settingsGroup:'trader'},open:true},{dataset:{settingsGroup:'backup-data'},open:false}];
 let onToggle;
 const sandbox={Map,document:{querySelectorAll:selector=>{assert.equal(selector,'#main details[data-settings-group]');return sections;},addEventListener:(type,handler,capture)=>{assert.equal(type,'toggle');assert.equal(capture,true);onToggle=handler;}}};
 vm.runInNewContext('const settingsOpenGroups=new Map();'+capture+listen+';globalThis.saved=settingsOpenGroups;globalThis.capture=captureSettingsDisclosures;',sandbox);
 sandbox.capture();assert.deepEqual([...sandbox.saved],[['campaign',false],['trader',true],['backup-data',false]]);
 // Delayed events from the old markup cannot reverse the current choice.
 onToggle({target:{isConnected:false,dataset:{settingsGroup:'campaign'},open:true}});
 assert.equal(sandbox.saved.get('campaign'),false);
 onToggle({target:{isConnected:true,dataset:{settingsGroup:'campaign'},open:true}});
 assert.equal(sandbox.saved.get('campaign'),true);
 onToggle({target:{isConnected:true,dataset:{},open:true}});
 assert.equal(sandbox.saved.size,3,'Nested disclosures do not enter top-level presentation state');
 assert.match(source,/function render\(\)\{if\(!core\)return;captureSettingsDisclosures\(\)/);
 assert.match(source,/settingsUtilityPanel\('rounding-time','Rounding & time'/);
 assert.match(source,/settingsUtilityPanel\('backup-data','Backup & data'/);
});
test('cross-field settings failures reveal the form, while stale drafts keep disclosure choices',async()=>{
 const source=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
 // Isolated layout/error boundary only: run the unchanged production owner,
 // submit and failure helpers, with storage represented by a known-prewrite
 // validation stub. Deferred persistence and real DOM live in completion suites.
 const ownerStart=source.indexOf('function invalidateSettingsOperation('),mountEnd=source.indexOf('\n\nasync function setup()');
 assert.ok(ownerStart>=0&&mountEnd>ownerStart,'Production owner and inline mount extraction boundaries exist');
 const mount=source.slice(ownerStart,mountEnd);
 const readFuel=source.match(/^function readFuel.*$/m)[0];
 const groups=[{open:false},{open:false}],events=[],field={name:'shipTons',value:'',type:'number',disabled:false,willValidate:true,validity:{valid:true}};
 const error={textContent:'',focus:()=>events.push('focus-error'),scrollIntoView:()=>events.push('show-error')};
 const form={isConnected:true,elements:[field],querySelector:()=>error,querySelectorAll:selector=>selector==='details[data-settings-group]'?groups:[field],addEventListener(){}};
 form.elements.namedItem=name=>name===field.name?field:null;
 const ids={'settings-form':form,'settings-error':error,'settings-reset':{},'settings-save':{},modal:{open:false}};
 const state={revision:1,ship:{}};
 const sandbox={Map,document:{},SaveNotCommittedError,$:id=>ids[id],state,settingsDraft:null,settingsFormRevision:0,settingsOpenGroups:new Map(),settingsRounding:[],inputRounding:[],store:{editable:true},settingsOperation:null,campaignReloadRequired:false,tab:'Settings',suspendedSettings:null,services:{active:()=>false},
  mountSettingsLayout(){},normaliseSettingsFields(){},updateSettingsForm(){},syncSettingsControls(){},captureSettingsDraft(){},captureSettingsDisclosures(){},render(){throw Error('An invalid form must not render a committed state');},
  FormData:class{get(name){return {shipTons:'',fuelCapacity:'40',fuelAboard:'10'}[name]??null;}}};
 vm.runInNewContext(readFuel+';function saveSettings(data){try{readFuel(data);}catch(error){throw new SaveNotCommittedError(error);}throw Error("Validation should have failed");}'+mount+';globalThis.mount=mountSettingsForm;',sandbox);
 sandbox.mount();form.onsubmit({preventDefault(){}});
 assert.ok(groups.every(group=>group.open),'Individually valid fields with a cross-field error are revealed');
 assert.match(error.textContent,/ship displacement, fuel tank capacity and fuel aboard together/);
 assert.deepEqual(events,['focus-error','show-error']);
 groups.forEach(group=>group.open=false);events.length=0;state.revision++;
 form.onsubmit({preventDefault(){}});
 assert.ok(groups.every(group=>!group.open),'A stale draft is not a field validation failure');
 assert.match(error.textContent,/Campaign changed.*Revert changes/);
 assert.deepEqual(events,['focus-error','show-error']);
});
test('a queued disclosure choice is captured before a settings modal detaches the form',async()=>{
 const source=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
 const capture=source.match(/^function captureSettingsDisclosures.*$/m)[0];
 const suspend=source.match(/^function suspendSettingsForm.*$/m)[0];
 const section={dataset:{settingsGroup:'campaign'},open:false};let connected=true;
 const form={getBoundingClientRect:()=>({height:123}),replaceWith:()=>{connected=false;}};
 const sandbox={Map,settingsOpenGroups:new Map([['campaign',true]]),suspendedSettings:null,$:()=>form,document:{querySelectorAll:()=>connected?[section]:[],createElement:()=>({style:{}})}};
 vm.runInNewContext(capture+suspend+';suspendSettingsForm();captureSettingsDisclosures();',sandbox);
 assert.equal(connected,false);
 assert.equal(sandbox.settingsOpenGroups.get('campaign'),false,'The current DOM choice survives a render with the form detached');
 assert.equal(sandbox.suspendedSettings.form,form);
 assert.equal(sandbox.suspendedSettings.placeholder.style.height,'123px');
});

test('fuel settings describe total configured capacity without adding separate tank tracking',async()=>{
 const layout=await readFile(new URL('../js/settings-layout.mjs',import.meta.url),'utf8');
 const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
 const fuel=await readFile(new URL('../js/fuel.mjs',import.meta.url),'utf8');
 assert.match(layout,/Base fuel tank capacity/);assert.match(layout,/Total configured fuel capacity; no separate tank tracking/);
 assert.match(app,/including any power-plant or small-craft allowance\. Optional bladders are added separately/);
 assert.match(app,/Power-plant and small-craft use are not tracked separately/);
 assert.match(fuel,/Power-plant and small-craft use are not tracked separately/);
 for(const source of [layout,app,fuel])assert.doesNotMatch(source,/power-plant fuel is (?:excluded|outside this tool)|Base jump-fuel tank capacity/i);
});
