import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createDesign,updateDesign,getCatalogue,evaluateDesign} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
import {renderReview} from '../js/review.mjs';
import {diagnosticLabel,diagnosticContext,coverageLabel,presentationFacts,sourceReference,sourceExampleLabel} from '../js/rules-presentation.mjs';
const source={book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages:'142,175'};
const rawProse='An arbitrary full source explanation must never become displayed content merely because a returned object contains it. '.repeat(8);
const record=(id,weaponId,patch={})=>({id,weaponId,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const projection=d=>projectReview(d,getCatalogue(d),evaluateDesign(d));
const paired=()=>{
 let d=createDesign({techLevel:14});
 return updateDesign(d,{selections:{physical:{manipulators:[...d.selections.physical.manipulators,...['private-third','private-fourth'].map(id=>({id,kind:'additional',size:'chassis',strengthIncrease:0,dexterityIncrease:0}))],weapons:[record('private-blade','csc-broadsword',{placement:'held',manipulatorId:'base-1',supportManipulatorId:'base-2'}),record('private-bow','csc-compound-cam-bow',{placement:'held',manipulatorId:'private-third',supportManipulatorId:'private-fourth'})]}}});
};
class Node {
 constructor(tag,text){this.tag=tag;this.textContent=text??'';this.children=[];}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=[...items];}
}
const visibleText=node=>[node.textContent,...node.children.map(visibleText)].join('\n');
const rendered=review=>visibleText(renderReview(review,{createElement:tag=>new Node(tag)}));
const summary=view=>{
 const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,new Node('div'));return nodes.get(id);};
 const code=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8').match(/function renderSummary\(\) \{[\s\S]*?\n\}/)[0];
 const context={view,$,el:(tag,text)=>new Node(tag,text),metric:(label,value)=>new Node('div',label+': '+value),formatted:value=>String(value),sourceText:sourceReference,diagnosticLabel,coverageLabel};
 runInNewContext(code+'\nrenderSummary();',context);
 return [...nodes.values()].map(visibleText).join('\n');
};

test('labels-only: real paired grips retain source-qualified unknowns and readable distinct weapon contexts',()=>{
 const d=paired(),e=evaluateDesign(d),before=structuredClone(e),review=projectReview(d,getCatalogue(d),e),print=formatStatblock(review),ui=rendered(review),compact=summary({design:d,catalogue:getCatalogue(d),evaluation:e,review});
 assert.equal(e.status,'verified');
 for(const output of [print,ui,compact]){
  for(const label of ['Combined-arm characteristics unresolved','Carrying/reach unresolved','referee approval required','Broadsword (CSC 2023) 1','Compound Cam Bow (CSC 2023) 2','p. 25-28,60,115','Coverage incomplete'])assert.ok(output.includes(label),label);
  for(const issue of e.diagnostics.filter(item=>item.message.length>80))assert.ok(!output.includes(issue.message),issue.code);
  assert.doesNotMatch(output,/private-blade|private-bow|private-third|private-fourth/);
 }
 assert.match(print,/Effective Dexterity: Not calculated/);assert.match(print,/Effective Strength: Not calculated/);
 assert.match(print,/Additional arm 4/);assert.deepEqual(e,before);
});

test('labels-only: unknown diagnostics are bounded and retain severity, source and copy correction context',()=>{
 const d=updateDesign(createDesign({techLevel:14}),{selections:{physical:{weapons:[record('private-weapon','csc-assault-pistol',{linkedWeapons:2})]}}}),catalogue=getCatalogue(d);
 const codes=['AUTOLOAD_ALLOCATION_LIMIT','AMMUNITION_COPY_NOT_INSTALLED','SPARE_AMMO_STORAGE_REQUIRED','FUTURE_SUPPLY_LIMIT'];
 const evaluation={status:'invalid',totals:null,ledger:[],coverage:{complete:false,gaps:[{id:'future-path',message:rawProse,source}]},diagnostics:codes.map((code,index)=>({severity:index===3?'blocker':'error',code,path:'physical.weapons.private-weapon.ammunitionOverrides.'+(index+1),message:rawProse,source}))};
 const review=projectReview(d,catalogue,evaluation),rows=review.sections.find(s=>s.id==='warnings').rows,print=formatStatblock(review);
 assert.deepEqual(rows.map(row=>row.label),['Error','Error','Error','Blocker']);
 for(let i=0;i<4;i++){assert.match(rows[i].detail,/Assault Pistol \(CSC 2023\) 1/);assert.ok(rows[i].detail.includes('Copy '+(i+1)));assert.match(rows[i].source,/copyright 2026.*p. 142,175/);}
 for(const text of [print,rendered(review),summary({design:d,catalogue,evaluation,review})]){
  assert.match(text,/Loader limit exceeded; maximum 10/);assert.match(text,/Retained copy not installed; restore count or remove override/);assert.match(text,/Future supply limit; check selection\/source/);assert.doesNotMatch(text,/arbitrary full source explanation|private-weapon/);
 }
 assert.equal(diagnosticLabel({severity:'error',code:rawProse,message:rawProse}),'Unspecified construction check; check selection/source');
 assert.equal(coverageLabel(rawProse),'Coverage incomplete; source review required');
});

test('labels-only: ordinary and component nested metadata preserves facts, estimates, sources and user-selected content',()=>{
 const d=paired();d.name='My robot: a user-authored name.';
 const e=evaluateDesign(d),weapon=e.totals.weapons[1]; // Finite-ammunition bow for injected magazine metadata.
 weapon.unexpectedMetadata={description:rawProse,arbitraryNarrative:rawProse,rule:{damage:999,label:rawProse},tables:[{label:rawProse,cost:99}],count:3,status:'unresolved',source:{...source,note:rawProse}};
 weapon.magazineVariants={highCapacity:{capacity:30,unitCost:30,estimatedUnitMassKg:.15,qualification:{refereeMayReject:true,shotgunReview:true,source},estimate:{estimated:true,unitMassKg:.15,scope:rawProse,source}}};
 weapon.attackContext=rawProse;
 const c=getCatalogue(d),before=structuredClone(e),r=projectReview(d,c,e),print=formatStatblock(r);
 for(const text of [print,rendered(r)]){assert.doesNotMatch(text,/arbitrary full source explanation/);for(const label of ['Count: 3','Status: Unresolved','Capacity: 30','Unit Cost: 30','Source estimate','Referee approval required','copyright 2026','p. 142,175'])assert.ok(text.includes(label),label);}
 assert.match(print,/My robot: a user-authored name\./);assert.deepEqual(e,before);
 r.sections.find(s=>s.id==='weapons').rows[0].details[0].value='edited projection';assert.doesNotMatch(JSON.stringify(e),/edited projection/);
 const host=updateDesign(createDesign({kind:'ship-brain',techLevel:23}),{special:{designReferences:[{id:'private-component',role:'installed-robot',quantity:1,design:d}]}}),hostEvaluation=evaluateDesign(host);
 hostEvaluation.composite.components[0].profile.weapons[0]=structuredClone(weapon);
 const hostReview=projectReview(host,getCatalogue(host),hostEvaluation),hostText=formatStatblock(hostReview);
 assert.doesNotMatch(hostText,/arbitrary full source explanation|private-component|private-blade/);assert.match(hostText,/Component-only weapon/);assert.match(hostText,/Source estimate/);assert.match(hostText,/Referee approval required/);assert.match(hostText,/p. 142,175/);
 const context=diagnosticContext({path:'special.designReferences.private-component.physical.weapons.private-blade.ammunitionOverrides.2'},host,getCatalogue(host));assert.match(context,/My robot: a user-authored name/);assert.match(context,/Broadsword|broadsword/i);assert.match(context,/Copy 2/);assert.doesNotMatch(context,/private-/);
});

test('labels-only: explicit storage estimates and high-capacity approval remain detached from audit messages',()=>{
 const d=updateDesign(createDesign({techLevel:14}),{selections:{physical:{optionInstances:[{id:'private-locker',optionId:'storage-compartment',parameters:{quantity:1}}],weapons:[record('private-gun','csc-assault-pistol',{extraMagazines:2,spareMagazineStorageId:'instance:private-locker',initialMagazineType:'high-capacity'})]}}});
 const api=createRobotApi();api.importDesign(JSON.stringify(d));const view=api.getView(),before=structuredClone(view.evaluation),output=view.statblock;
 assert.equal(view.evaluation.status,'verified');assert.match(output,/Source estimate/);assert.match(output,/Storage Compartment 1/);assert.match(output,/0.075/);assert.match(output,/High-capacity suitability: referee approval required/);assert.match(output,/copyright 2026.*p. 142/);assert.doesNotMatch(output,/private-locker|private-gun|CSC rule-of-thumb estimate; not an independently measured magazine mass/);
 assert.ok(view.evaluation.diagnostics.find(d=>d.code==='CSC_HIGH_CAPACITY_REFEREE').message.includes('suitability remains subject to referee approval'));
 view.review.sections[0].rows[0].value='not shared';assert.deepEqual(api.getView().evaluation,before);assert.doesNotMatch(api.getStatblock(),/not shared/);
});

test('labels-only: preserves selected user descriptions and concrete conditional timing without generic prose',()=>{
 const d=createDesign(),c={kinds:[],stages:[{id:'physical',controls:[{field:'optionInstances',choices:[{id:'custom-tool',label:'Custom tool'}]}]}]};
 d.selections.physical.optionInstances=[{id:'private-tool',optionId:'custom-tool',parameters:{detail:rawProse,quantity:2}}];
 const r=projectReview(d,c,{status:'blocked',totals:null,ledger:[],diagnostics:[],coverage:{complete:false}});
 assert.ok(formatStatblock(r).includes(rawProse));assert.doesNotMatch(formatStatblock(r),/private-tool/);
 const facts=presentationFacts({action:'Significant',actions:1,bonusRound:'following round',initialMagazine:'separate-purchase',duration:'1D rounds',timing:'Start of each round',notes:rawProse});
 assert.equal(facts.action,'Significant');assert.equal(facts.bonusRound,'following round');assert.equal(facts.initialMagazine,'separate-purchase');assert.equal(facts.timing,'Start of each round');assert.equal(facts.notes,undefined);
});

test('labels-only: nanotech scope, numeric END consequence and implant-only ownership remain explicit',()=>{
 const nano=updateDesign(createDesign({kind:'nanorobot',techLevel:15}),{special:{packageType:'nanotech-defence',packages:17}}),r=projection(nano),text=formatStatblock(r);
 for(const label of ['Permanent END loss; above 15 active medical packages','Permanent Endurance Loss: 2','Nanotech-infection resistance only; active packages','Automatic Immunity: No','Application Verified: No'])assert.ok(text.includes(label),label);
 const implant=updateDesign(createDesign({kind:'cyborg',techLevel:14}),{special:{cyborgMode:'augments',augmentations:[{id:'private-part',optionId:'misc-mass-portable-computer-14',parameters:{}}]}}),print=formatStatblock(projection(implant));
 assert.match(print,/Part-specific effects; no automatic recipient grant/);assert.match(print,/Computer-only software; no robot\/recipient skill grant/);assert.doesNotMatch(print,/private-part/);
});

test('labels-only: editor does not expose source reference tables or raw source description fields',()=>{
 const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(app,/referenceRows|\.highTechnology|el\([^\n]*issue\.message|el\([^\n]*stage\.description|el\([^\n]*stage\.note|el\([^\n]*control\.description|el\([^\n]*control\.help/);
 assert.match(app,/view\.review\?\.sections\.find\(section=>section\.id==='warnings'\)/);
});
import {WEAPONS,WEAPON_ACCESSORIES,evaluateWeapons} from '../engine/weapons.mjs';
import {OPTIONS} from '../engine/catalogue.mjs';
import {equipmentCapabilities} from '../engine/capabilities.mjs';
import {readdirSync} from 'node:fs';

const assertSemanticStrings=(value,path=[])=>{
 if(typeof value==='string'){
  const key=path.at(-1);
  if(['id','optionId','weaponId','label','book','edition','pages','page','title','description','reason','note','interpretation','accessoryRules','associatedLauncherRules'].includes(key))return;
  const projected=presentationFacts(value,key);
  assert.notEqual(projected,undefined,path.join('.')+': '+value);
  assert.notEqual(projected,'Operating condition unresolved; check source',path.join('.')+': '+value);
 }else if(Array.isArray(value))for(const item of value)assertSemanticStrings(item,path);
 else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value))assertSemanticStrings(item,[...path,key]);
};

test('labels-only: every current weapon profile and generated accessory effect retains its semantic predicates',()=>{
 const arms=[{id:'private-arm',size:9,dexterity:8,strength:12},{id:'private-support',size:9,dexterity:8,strength:12}];
 for(const weapon of WEAPONS){
  assertSemanticStrings(weapon,[weapon.id]);
  for(const accessory of [null,...WEAPON_ACCESSORIES]){
   const selected=record('private-weapon',weapon.id,{placement:'held',manipulatorId:'private-arm',supportManipulatorId:'private-support',accessories:accessory?[accessory.id]:[]});
   const result=evaluateWeapons({kind:'standard',techLevel:23,selections:{physical:{weapons:[selected]}}},arms,[]);
   assertSemanticStrings(result.weapons[0]?.accessoryEffects,[weapon.id,accessory?.id||'none']);
  }
 }
});

test('labels-only: all catalogue effect blocks and generated equipment capabilities retain short operational values',async()=>{
 const visit=value=>{
  if(!value||typeof value!=='object')return;
  for(const [key,item]of Object.entries(value)){
   if(['effects','conditionalEffects','operation','operating'].includes(key))assertSemanticStrings(item,[key]);
   else visit(item);
  }
 };
 for(const name of readdirSync(new URL('../engine/',import.meta.url)).filter(name=>name.endsWith('.mjs'))){
  const exports=await import(new URL('../engine/'+name,import.meta.url));
  for(const value of Object.values(exports))visit(value);
 }
 assertSemanticStrings(equipmentCapabilities(OPTIONS.map(option=>({...option,quantity:1,parameters:{}})),{techLevel:15,primary:'wheels',tacticalSpeed:5,brainFamily:'advanced',operations:[]}));
});

test('labels-only: effect numbers keep EMP, poison, cloud and bipod limits',()=>{
 const emp=WEAPONS.find(w=>w.id==='csc-direct-grenade-emp'),chemical=WEAPONS.find(w=>w.id==='csc-direct-grenade-chemical'),smoke=WEAPONS.find(w=>w.id==='csc-direct-grenade-thermal-smoke');
 assert.ok(emp&&chemical&&smoke);
 const a=presentationFacts(emp.conditionalEffects),b=presentationFacts(chemical.conditionalEffects),c=presentationFacts(smoke.conditionalEffects);
 assert.match(JSON.stringify(a),/Unshielded electronics only/);assert.match(JSON.stringify(a),/Unshielded electronics; more than 2 TL below grenade/);
 const poison=JSON.stringify(b);for(const predicate of ['Living target in cloud; no respirator/sealed suit','1 round','Stun','Injury','lung contact','skin contact','Heavy winds or rain'])assert.ok(poison.includes(predicate),predicate);
 assert.match(JSON.stringify(c),/Targets within cloud only/);assert.ok(JSON.stringify(c).includes('"attackDM":-2'));
 const r=evaluateWeapons({kind:'standard',techLevel:23,selections:{physical:{weapons:[record('private-bipod','csc-air-rifle-4',{accessories:['csc-bipod']})]}}},[],[]);
 const effects=JSON.stringify(presentationFacts(r.weapons[0].accessoryEffects));assert.match(effects,/Deployed-bipod firing only/);assert.match(effects,/Bulky/);assert.match(effects,/Very Bulky/);
});

test('labels-only: annual clone timing preserves selected convention without its explanation',()=>{
 const d=updateDesign(createDesign({kind:'clone',techLevel:15}),{special:{growth:'accelerated',eduAccounting:'separate',acceleratedStop:'early6',earlyGrowthPrice:'first-year-included',baseINT:11,rollINT:3,trainingYears:12}}),evaluation=evaluateDesign(d),review=projectReview(d,getCatalogue(d),evaluation),print=formatStatblock(review);
 assert.match(print,/EDU before year-end INT; selected convention/);assert.match(print,/EDU before year-end INT; other purchases by graduation/);assert.doesNotMatch(print,/the book does not specify within-year order/);
 for(const year of review.sections.find(s=>s.id==='clone-training-years').rows)assert.match(year.detail,/before year-end/);
});

test('labels-only: published examples retain price discrepancies before loading',()=>{
 const api=createRobotApi(),examples=api.listExamples();
 const star=sourceExampleLabel(examples.find(item=>item.id==='startek'));
 for(const fact of ['printed Cr697,100','calculated Cr697,300','initial power pack Cr200'])assert.ok(star.includes(fact),fact);
 assert.match(sourceExampleLabel(examples.find(item=>item.id==='steward-droid')),/Cr39,800.*Cr35,000/);
 assert.match(coverageLabel({id:'nano-mixed-medical-inventory'}),/Active package types unknown/);
});
