// Pure template/import unit checks. No browser or OS interaction.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const events={},nodes=new Map();
const node=()=>({children:[],dataset:{},style:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},showModal(){},close(){}});
const context={console,structuredClone,setTimeout(){},document:{querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return [];},addEventListener(k,fn){events[k]=fn;}},window:{},navigator:{}};
vm.createContext(context);
for(const f of ['data.js','engine.js','ui-model.js','audit-data.js','app.js'])vm.runInContext(fs.readFileSync('dist/'+f,'utf8'),context,{filename:f});
vm.runInContext(`for(const [id] of tabs){tab=id;render();if(!$('#editor').innerHTML)throw Error('Empty tab '+id);}
state={...structuredClone(F.defaults),tl:14,equipment:[{name:'Robot Manipulator Arm',quantity:3,armSize:6,strIncrease:1,dexIncrease:4}],weapons:[{weapon:'No weapon installed',mount:'Turret',quantity:1,ratedSpaces:4,reservedCrew:0}]};result=F.calculate(state);
if(!vehicleSheet().includes('STR 12 · DEX 12'))throw Error('Arm specifications lost on record');
tab='weapons';render();if(!$('#editor').innerHTML.includes('Rated weapon Spaces'))throw Error('Missing mount capacity');
const g=systemGroups.find(g=>g.name==='Robot Manipulator Arm');globalThis.armId=systemGroups.indexOf(g);systemConfigs[armId]={armSize:5,strIncrease:2,dexIncrease:3};globalThis.clickEvent={target:{closest(){return {dataset:{installSystem:String(armId)}};}}};`,context);
events.click(context.clickEvent);
vm.runInContext(`if(!state.equipment.some(e=>e.armSize===5&&e.strIncrease===2&&e.dexIncrease===3))throw Error('Install discarded arm settings');`,context);
vm.runInContext(`const roundTrip=JSON.parse(JSON.stringify(state));state=validateImport(roundTrip);result=F.calculate(state);tab='record';render();if(!vehicleSheet().includes('STR'))throw Error('Imported custom design did not render');`,context);
console.log('11 template views, custom-arm installation, empty-mount controls and a custom-design JSON round trip render without exceptions. No visual browser check implied.');
