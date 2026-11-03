// Pure template/import unit checks. No browser or OS interaction.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const events={},nodes=new Map();
const node=()=>({children:[],dataset:{},style:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});
const context={console,structuredClone,setTimeout(){},document:{querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return [];},addEventListener(k,fn){events[k]=fn;}},window:{},navigator:{}};
vm.createContext(context);
for(const f of ['data.js','engine.js','ui-model.js','option-help.js','audit-data.js','app.js'])vm.runInContext(fs.readFileSync('dist/'+f,'utf8'),context,{filename:f});
vm.runInContext(`for(const [id] of tabs){tab=id;render();if(!$('#editor').innerHTML)throw Error('Empty tab '+id);}
state={...structuredClone(F.defaults),tl:14,equipment:[{name:'Robot Manipulator Arm',quantity:3,armSize:6,strIncrease:1,dexIncrease:4}],weapons:[{weapon:'No weapon installed',mount:'Turret',quantity:1,ratedSpaces:4,reservedCrew:0}]};result=F.calculate(state);
if(!vehicleSheet().includes('STR 12 · DEX 12'))throw Error('Arm specifications lost on record');
tab='weapons';render();if(!$('#editor').innerHTML.includes('Rated weapon Spaces'))throw Error('Missing mount capacity');
const g=systemGroups.find(g=>g.name==='Robot Manipulator Arm');globalThis.armId=systemGroups.indexOf(g);systemConfigs[armId]={armSize:5,strIncrease:2,dexIncrease:3};globalThis.clickEvent={target:{closest(){return {dataset:{installSystem:String(armId)}};}}};`,context);
events.click(context.clickEvent);
vm.runInContext(`if(!state.equipment.some(e=>e.armSize===5&&e.strIncrease===2&&e.dexIncrease===3))throw Error('Install discarded arm settings');`,context);
vm.runInContext(`const roundTrip=JSON.parse(JSON.stringify(state));state=validateImport(roundTrip);result=F.calculate(state);tab='record';render();if(!vehicleSheet().includes('STR'))throw Error('Imported custom design did not render');`,context);
console.log('11 template views, custom-arm installation, empty-mount controls and a custom-design JSON round trip render without exceptions. No visual browser check implied.');

// Exercise the redesigned controls through the same delegated events as the UI.
const click=dataset=>events.click({target:{closest(){return {dataset};}}});
const change=(dataset,value,type='select-one')=>events.change({target:{dataset,value,type}});
vm.runInContext("state=structuredClone(F.defaults);tab='features';render();globalThis.featureName=U.availableFeatures(F,state).find(f=>!state.features.includes(f['Feature Effect']))['Feature Effect'];",context);
change({featureChoice:context.featureName},'yes');
change({featureChoice:context.featureName},'yes');
vm.runInContext("if(state.features.filter(x=>x===featureName).length!==1)throw Error('Repeated feature selection duplicated state');",context);
change({featureChoice:context.featureName},'no');
vm.runInContext("if(state.features.includes(featureName))throw Error('Feature removal failed');",context);
click({infoTitle:'Selected equipment',info:'<p>Explanation &amp; source</p>'});
assert.equal(nodes.get('#info-dialog').open,true);
assert.equal(nodes.get('#info-title').textContent,'Selected equipment');
assert.equal(nodes.get('#info-content').innerHTML,'<p>Explanation &amp; source</p>');
click({action:'close-info'});assert.equal(nodes.get('#info-dialog').open,false);
vm.runInContext("tab='equipment';render();globalThis.systemId=systemGroups.findIndex(g=>g.options.some(o=>o.TL<=state.tl));globalThis.systemName=systemGroups[systemId].options.find(o=>o.TL<=state.tl).Name;",context);
change({system:String(context.systemId)},context.systemName);
change({systemQty:String(context.systemId)},'3','number');
click({installSystem:String(context.systemId)});
vm.runInContext("if(!state.equipment.some(e=>e.name===systemName&&e.quantity===3))throw Error('System selection lost quantity');state.cargo=100000;tab='crew';render();if(!$('#editor').innerHTML.includes('SPACE_BUDGET'))throw Error('Missing inline capacity warning');if(!info('A \"quoted\" title','<p>Source</p>').includes('&quot;'))throw Error('Explanation attributes are not escaped');",context);
console.log('Worksheet feature toggles, repeated selections, popup open/close, equipment quantity/install, escaped help and inline capacity warnings passed. Native keyboard, focus and responsive layout still require browser QA.');
