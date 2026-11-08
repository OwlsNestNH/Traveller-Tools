import {PACKAGES,LOCOMOTION,OPTIONS,DEFAULT_ITEMS,CORE_PACKAGES} from './catalogue.mjs';
// Pure special-construction API. Rules data, not reproduced source prose.
const copy = value => JSON.parse(JSON.stringify(value));
const source = pages => ({book:'Robot Handbook',edition:'Mongoose 2022',pages});
const specialKinds = [
 ['clone','Clone','96-99','Template, growth and training budget implemented; character generation and ageing resolution remain external.'],
 ['microbot','Microbot','79-81','Miniature chassis, mass, movement, protection and p81 microbrain table implemented; source conflicts remain explicit.'],
 ['nanorobot','Nanorobot','82-85','Swarm-scale construction and capabilities not implemented.'],
 ['android','Android','86-87','Body tiers, half-slot reservation and physical-only price multiplier implemented.'],
 ['biological','Biological robot','88-89','Genome-dependent body tiers and three-quarter-slot reservation implemented; bespoke genomes require referee confirmation.'],
 ['cyborg','Cyborg','90-93','Organic brain, life support and body integration not implemented.'],
 ['avatar','Avatar','94-95','Controller and remote body integration not implemented.'],
 ['drone','Drone','78-79','Control interface, communications and external controller validation not implemented.'],
 ['missile','Missile robot','100-101','Missile-specific propulsion and payload construction not implemented.'],
 ['vehicle-brain','Vehicle brain','102-103','Vehicle Handbook integration not implemented.'],
 ['ship-brain','Ship brain','104-105','High Guard integration not implemented.']
].map(([id,label,pages,reason])=>({id,label,source:source(pages),implemented:['clone','microbot','android','biological'].includes(id),reason}));
export function getSpecialKinds(){return copy(specialKinds);}
const number=(field,label,min,max,value)=>({field,label,type:'number',min,max,default:value,source:source('96-99')});
const select=(field,label,values,value)=>({field,label,type:'select',choices:values.map(([id,label])=>({id,label})),default:value,source:source('96-99')});
const controls=[
 select('templateMode','Template source',[['catalogue','Catalogue template'],['donor','Donor sample']],'catalogue'),
 ...['STR','DEX','END','INT'].flatMap(stat=>[number('base'+stat,stat+' catalogue base (TL13+: 6–11; earlier: 3–8)',3,11,6),number('donor'+stat,stat+' donor at age 18',1,30,8),number('roll'+stat,stat+' recorded die (TL13+: D3; earlier: D6)',1,6,1)]),
 select('growth','Growth method',[['natural','Natural'],['spare','Spare body'],['accelerated','Accelerated (12×)'],['quick','Quick (50×)']],'quick'),
 select('procurement','Growth procurement',[['commercial','Commercial service'],['self','Own bioreaction chamber']],'commercial'),
 number('storageYears','Spare body storage years',0,200,0),
 number('trainingYears','Additional creche training years',0,16,0),
 number('adultYears','Years since reaching adulthood',0,200,0),
 select('eduAccounting','Automatic EDU point interpretation',[['unresolved','Not resolved'],['separate','Automatic EDU separate from four selectable points'],['included','Automatic EDU charged against four points']],'unresolved'),
 {field:'trainingSkills',label:'Creche skills (select final level once per skill or specialty)',type:'multiselect',default:[],choices:PACKAGES.filter(p=>p.implemented&&p.speciality!=='all').map(p=>({id:p.id,label:p.label,skill:p.skill,speciality:p.speciality,level:p.level})),source:source('98-99')},
 ...['STR','DEX','END','INT'].map(stat=>number('increase'+stat,stat+' additional creche increase',0,4,0)),
 number('intTrainingYear','Year when purchased INT increase is completed (end of year)',1,16,1),
 select('quickEducation','Quick clone creche initial EDU interpretation',[['unresolved','Not resolved'],['zero','Referee: start at EDU0 with annual catch-up']],'unresolved')
];
const skillChoices=controls.find(c=>c.field==='trainingSkills').choices;
skillChoices.push(...skillChoices.filter(p=>p.level===3).map(p=>({...p,id:p.id.replace(/-3$/,'-4'),label:p.label.replace(/ 3$/,' 4'),level:4})));
for(const c of controls){
 c.stage=['growth','procurement','storageYears'].includes(c.field)?'physical':c.field==='adultYears'?'finalisation':['eduAccounting','quickEducation'].includes(c.field)||/INT$/.test(c.field)&&!c.field.startsWith('increase')?'brain':c.field.startsWith('training')||c.field==='intTrainingYear'||c.field.startsWith('increase')?'skills':'chassis';
 c.category=c.stage==='skills'?'Creche training':c.stage==='brain'?'Biological cognition':c.stage==='physical'?'Growth service':'Clone template';
 if(c.field.startsWith('base'))c.visibleWhen={field:'templateMode',equals:'catalogue'};
 if(c.field.startsWith('donor'))c.visibleWhen={field:'templateMode',equals:'donor'};
 if(c.field==='quickEducation')c.visibleWhen={field:'growth',equals:'quick'};
 if(c.field==='storageYears')c.visibleWhen={field:'growth',equals:'spare'};
}
export function getSpecialControls(kind){return kind==='clone'?copy(controls):kind==='microbot'?copy(microControls):['android','biological'].includes(kind)?copy(bodyControls(kind).map(c=>({...c,source:source(kind==='android'?'86-87':'88-89')}))):[];}
export function createSpecialDesignFields(kind){return Object.fromEntries(getSpecialControls(kind).map(c=>[c.field,c.default]));}
export function validateSpecialFields(kind,fields){
 if(!fields||typeof fields!=='object'||Array.isArray(fields))throw new TypeError('special must be an object.');
 const cs=getSpecialControls(kind),allowed=new Set(cs.map(c=>c.field));
 if(Object.keys(fields).some(k=>!allowed.has(k)))throw new TypeError('Unknown special field.');
 for(const c of cs){const v=fields[c.field];if(c.type==='number'&&(!Number.isInteger(v)||v<c.min||v>c.max))throw new TypeError(`special.${c.field} must be an integer from ${c.min} to ${c.max}.`);if(c.type==='multiselect'&&(!Array.isArray(v)||v.length>200||new Set(v).size!==v.length||v.some(id=>!c.choices.some(x=>x.id===id))))throw new TypeError(`special. has invalid selections.`);if(c.type==='select'&&!c.choices.some(x=>x.id===v))throw new TypeError(`special.${c.field} has an unknown choice.`);}
 return true;
}
export function cloneSkillPointCost(level){if(!Number.isInteger(level)||level<0||level>4)throw new TypeError('Skill level must be 0–4.');return 2**level;}
export function cloneCharacteristicPointCost(increase){if(!Number.isInteger(increase)||increase<0||increase>4)throw new TypeError('Characteristic increase must be 0–4.');return 2**(increase+1)-2;}
const priceRows=[0,5000,15000,30000,50000,75000];
export function evaluateSpecialDesign(design){
 if(design.kind==='microbot')return evaluateMicrobot(design);
 const diagnostics=[],ledger=[],coverage={implemented:['Clone template characteristics and prices','Clone growth service prices','Clone training point budget','Accelerated and quick first ageing schedule'],gaps:specialKinds.filter(k=>k.id!=='clone').map(k=>({id:k.id,reason:k.reason,source:k.source}))};
 const issue=(severity,code,path,message,pages='96-99')=>diagnostics.push({severity,code,path,message,source:source(pages)});
 const entry=(id,label,cost,pages)=>ledger.push({id,label,cost,slots:0,source:source(pages)});
 const result=totals=>({status:diagnostics.some(d=>d.severity==='error')?'invalid':diagnostics.some(d=>d.severity==='blocker')?'blocked':'verified',diagnostics,totals:diagnostics.some(d=>['error','blocker'].includes(d.severity))?null:totals,ledger,coverage});
 if(design.kind!=='clone'){const kind=specialKinds.find(k=>k.id===design.kind);issue('blocker','SPECIAL_NOT_IMPLEMENTED','kind',kind?.reason??'This special construction path is not implemented.',kind?.source.pages??'79-105');return result(null);}
 try{validateSpecialFields('clone',design.special);}catch(e){issue('error','SCHEMA','special',e.message);return result(null);}
 const s=design.special,tl=design.techLevel,high=tl>=13,stats={};let templateCost=10000;
 const selectedSkills=s.trainingSkills.map(id=>controls.find(c=>c.field==='trainingSkills').choices.find(p=>p.id===id));
 const spent=selectedSkills.reduce((n,p)=>n+cloneSkillPointCost(p.level),0)+['STR','DEX','END','INT'].reduce((n,stat)=>n+cloneCharacteristicPointCost(s['increase'+stat]),0);
 const skillKeys=new Set();
 for(const p of selectedSkills){const key=p.skill+':'+(p.speciality??'');if(skillKeys.has(key))issue('error','CLONE_SKILL_DUPLICATE','special.trainingSkills','Choose a single final level for each skill or specialty.','99');skillKeys.add(key);if(!s.trainingYears&&p.level>1)issue('error','CLONE_INITIAL_SKILL','special.trainingSkills','Skills above level1 require subsequent creche years.','98-99');}
 if(!s.trainingYears&&['STR','DEX','END','INT'].some(stat=>s['increase'+stat]))issue('error','CLONE_INITIAL_CHARACTERISTIC','special','Initial creche points buy skills only; characteristic increases require subsequent years.','98-99');
 for(const stat of ['STR','DEX','END','INT']){
  const roll=s['roll'+stat];if(roll>(high?3:6))issue('error','CLONE_DIE','special.roll'+stat,high?'TL13+ templates require a recorded D3 result.':'Template requires a recorded D6 result.');
  if(s.templateMode==='donor')stats[stat]=Math.floor(s['donor'+stat]/2)+roll+(high?3:0);
  else{const base=s['base'+stat],row=base-(high?6:3),minTL=high?[13,13,13,13,14,15][row]:[8,8,8,9,10,12][row];
   if(minTL===undefined||tl<minTL)issue('error','CLONE_TEMPLATE_TL','special.base'+stat,'Catalogue base is unavailable at this technology.','97');
   else{templateCost+=priceRows[row];entry('template-'+stat,stat+' template adjustment',priceRows[row],'97');}
   stats[stat]=base+roll;
  }
 }
 entry('template','Template acquisition',10000,'96-97');
 const methods={natural:{tl:8,cost:50000,years:18},spare:{tl:9,cost:50000,years:null},accelerated:{tl:10,cost:tl>=13?150000:200000,years:1.5},quick:{tl:13,cost:50000,years:18/50}};
 const growth=methods[s.growth];if(tl<growth.tl)issue('error','CLONE_GROWTH_TL','special.growth','Growth method exceeds design technology.','98');
 let growthCost=growth.cost;
 if(s.procurement==='self'){growthCost=10000;issue('blocker','CLONE_FACILITY','special.procurement','Own-chamber consumables can be estimated, but chamber capability, acquisition cost, feedstock and legal growth setup require separate validation.','49,98');}
 else issue('warning','CLONE_SERVICE_INCLUSION','special.procurement','Estimate treats the commercial growth charge as including growth consumables; the book does not explicitly settle inclusion. Template acquisition is separate.','98');
 entry('growth','Growth '+(s.procurement==='self'?'consumables':'service'),growthCost,'98');
 let storageCost=s.storageYears*12000;if(s.storageYears&&s.growth!=='spare')issue('error','CLONE_STORAGE_METHOD','special.storageYears','Annual storage charge applies to spare bodies.','98');
 if(storageCost)entry('storage','Spare body storage',storageCost,'98');
 if(s.growth==='spare'&&(s.trainingYears||spent||s.adultYears))issue('error','CLONE_SPARE_MIND','special','Spare bodies have no higher mental function; training and playable adult age do not apply.','98');
 if(s.growth==='natural'&&(s.trainingYears||spent))issue('blocker','CLONE_NATURAL_TRAINING','special.trainingYears','Natural growth uses ordinary character education; creche rules are not substituted.','98-99');
 let edu=s.growth==='accelerated'?Math.ceil(stats.INT/2):s.growth==='quick'?0:null;
 let points=s.growth==='accelerated'?4:0,autoEduSpent=0;
 if(s.trainingYears&&s.eduAccounting==='unresolved')issue('blocker','CLONE_EDU_INTERPRETATION','special.eduAccounting','Choose how automatic EDU spending relates to the annual four selectable points. This interpretation must be agreed with the referee.','99');
 const initialEdu=edu;
 if(s.growth==='accelerated'&&s.trainingYears>15)issue('error','CLONE_CRECHE_LIMIT','special.trainingYears','Accelerated maturation already includes one creche year; at most fifteen additional years fit the sixteen-year total.','98-99');
 if(s.growth==='quick'&&s.trainingYears&&s.quickEducation==='unresolved')issue('blocker','CLONE_QUICK_EDU','special.trainingYears','Quick clones may train, but the initial EDU grant on entering a creche is not explicitly settled. The estimate starts from EDU0; referee resolution is required.','98-99');
 let trainedINT=stats.INT,above=0;const annualTraining=[];
 if(s.increaseINT&&s.intTrainingYear>s.trainingYears)issue('error','CLONE_INT_YEAR','special.intTrainingYear','INT completion year must fall within the additional training years.','99');
 if(edu!==null)for(let y=1;y<=s.trainingYears;y++){
  points+=4;autoEduSpent+=2;
  if(edu<trainedINT)edu++;
  else{above+=2;let n=0;while(n<4&&cloneCharacteristicPointCost(n+1)<=above)n++;edu=trainedINT+n;if(above>30)issue('blocker','CLONE_EDU_TABLE_LIMIT','special.trainingYears','Automatic EDU progression beyond the printed +4 characteristic table is unresolved.','99');}
  if(s.increaseINT&&y===s.intTrainingYear){
   const budget=points-(s.eduAccounting==='included'?autoEduSpent:0);
   if(cloneCharacteristicPointCost(s.increaseINT)>budget)issue('error','CLONE_INT_YEAR_BUDGET','special.intTrainingYear','Insufficient banked points in the selected year to complete this INT increase.','99');
   trainedINT=stats.INT+s.increaseINT;
   if(above)issue('blocker','CLONE_INT_EDU_REBASE','special.intTrainingYear','INT increases after EDU has exceeded the old INT need referee resolution of previously spent automatic EDU points.','99');
  }
  annualTraining.push({additionalYear:y,education:edu,intelligence:trainedINT,selectablePointsAccrued:points-(s.eduAccounting==='included'?autoEduSpent:0)});
 } if(s.eduAccounting==='included')points-=autoEduSpent;
 if(spent>points)issue('error','CLONE_TRAINING_BUDGET','special.trainingSkills','Allocated points exceed the available training budget.','99');

 const trainingCost=s.trainingYears*20000;if(trainingCost)entry('training','Additional creche training',trainingCost,'99');
 let ageing=null;
 if(['accelerated','quick'].includes(s.growth)){const quick=s.growth==='quick',interval=quick?2:4;ageing={firstCheckAdultYears:8,intervalYears:interval,firstDM:quick?-4:null,extraDM:quick?null:-2,checksDue:s.adultYears<8?0:Math.floor((s.adultYears-8)/interval)+1,postMaturityRate:quick?2:1};if(ageing.checksDue)issue('blocker','CLONE_AGEING_ROLLS','special.adultYears','Ageing checks are due; characteristic losses and survival must be resolved before certifying the current adult.','97-98');}
 issue('warning','CLONE_SCOPE','coverage','This verifies the selected clone construction subset. SOC, ordinary character generation, unlisted skill specialties, genetic modifications, transplants and ageing outcomes are outside this evaluator.','96-99');
 coverage.gaps.push({id:'clone-character',reason:'SOC; natural EDU and careers; genetic changes; unlisted skill specialties; transplant surgery; ageing rolls; facility construction.',source:source('96-99')});
 const cost=templateCost+growthCost+storageCost+trainingCost;
 const trainedStats=Object.fromEntries(Object.entries(stats).map(([stat,value])=>[stat,value+s['increase'+stat]]));

 return result({cost,slots:null,bandwidth:null,intelligence:s.growth==='spare'?null:trainedStats.INT,clone:{characteristics:trainedStats,templateCharacteristics:stats,templateCost,growthCost,storageCost,trainingCost,maturityYears:growth.years,education:edu,initialEducation:initialEdu,annualTraining,trainingPoints:points,unspentTrainingPoints:points-spent,ageing,spareBody:s.growth==='spare'},traits:['Biological clone'],skills:copy(selectedSkills),manipulators:[]});
}



const BODY_TIERS={
 android:[['basic',8,1000,1],['improved',10,2000,2],['enhanced',12,5000,3],['advanced',14,10000,3],['superior',16,20000,4]],
 biological:[['basic',11,2000,1],['improved',13,5000,2],['enhanced',15,10000,3],['advanced',17,20000,4]]
};
function bodyControls(kind){return [
 {...select('bodyTier','Biological likeness tier',BODY_TIERS[kind].map(([id,tl])=>[id,`${id} (TL${tl})`]),'basic'),stage:'chassis'},
 ...(kind==='biological'?[
 {...select('genomeLocomotion','Locomotion supported by selected genome',[['unresolved','Not confirmed'],['confirmed','Confirmed by referee / template']],'unresolved'),stage:'locomotion'},
 {...select('genomeOptions','Coatings and protection encoded in genome',[['unresolved','Not confirmed'],['confirmed','Confirmed by referee / template']],'unresolved'),stage:'physical'},
 {...number('bodyTLReduction','Referee-approved biotechnology body TL reduction',0,4,0),stage:'chassis'}]:[])
 ];}
export function evaluateBodyType(design,{baseSlots,brainRank,physicalCost,softwareCost,armourSlots}){
 const kind=design.kind,s=design.special,diagnostics=[],traits=[];
 const issue=(severity,code,path,message)=>diagnostics.push({severity,code,path,message,source:source(kind==='android'?'86-87':'88-89')});
 if(!['android','biological'].includes(kind))throw new TypeError('Body decorator requires android or biological kind.');
 const row=BODY_TIERS[kind].find(r=>r[0]===s.bodyTier);
 if(!row)throw new TypeError('Unknown body tier.');
 const [tier,minTL,perSlot,recommendedRank]=row;
 const reduction=kind==='biological'?s.bodyTLReduction:0;
 if(reduction===1)issue('error','BIO_TL_EXCEPTION','special.bodyTLReduction','The referee exception permits a two-to-four-level reduction, or none.');
 if(design.techLevel<minTL-reduction)issue('error','BODY_TL','special.bodyTier','Body tier exceeds the design technology, after any explicitly approved body-only exception.');
 if(reduction)issue('warning','BIO_REFEREE_EXCEPTION','special.bodyTLReduction','Biotechnology exception requires referee agreement and never lowers brain technology requirements.');
 if(design.selections.physical.armourRemoved)issue('error','BODY_ARMOUR_REMOVAL','physical.armourRemoved','This body already has zero base armour; base armour cannot be removed for a saving.');
 if(kind==='android'&&armourSlots>2)issue('error','ANDROID_ARMOUR_SLOTS','physical.armourAdded','Android internal armour is limited to two Slots.');
 if(brainRank<recommendedRank){traits.push('Additional social DM -2 (brain below body recommendation)');issue('warning','BODY_BRAIN_SOCIAL','brain.model','A less capable brain is permitted but incurs an additional social DM−2.');}
 if(kind==='android'){
  traits.push(['basic','improved'].includes(tier)?(tier==='basic'?'Uncanny appearance: social DM -2':'Close scrutiny within 5m: social DM -2'):tier==='enhanced'?'Appearance failure on natural 2':tier==='advanced'?'Passes without scanning':'Passes most scans');
  if(['enhanced','advanced','superior'].includes(tier))traits.push('Invisitech');
  if(['advanced','superior'].includes(tier))traits.push('Self-repairing');
  if(design.selections.physical.options.length)issue('warning','ANDROID_EXTERNAL_APPEARANCE','physical.options','Conspicuous external equipment or coatings can compromise biological appearance.');
 }else{
  const p=design.selections.physical;
  if(s.genomeLocomotion!=='confirmed')issue('blocker','BIO_GENOME_LOCOMOTION','special.genomeLocomotion','Confirm that the chosen organism supports the selected locomotion.');
  if(p.options.length&&s.genomeOptions!=='confirmed')issue('blocker','BIO_GENOME_OPTIONS','special.genomeOptions','Biological coatings and protection must be encoded in the genome, not freely added as mechanical options.');
  if(p.powerPacks||p.efficiency)issue('blocker','BIO_POWER_OPTIONS','physical','Conventional power packs and efficiency cannot be substituted for biological feeding without verified source support.');
  if(p.armourAdded)issue('blocker','BIO_ARMOUR_GENOME','physical.armourAdded','Genome-specific armour requires source verification; the android two-Slot cap is not automatically applied to biological bodies.');
  traits.push('Requires food, water and air','Natural healing DM '+[-2,0,2,4][BODY_TIERS.biological.findIndex(r=>r[0]===tier)]);
  issue('warning','BIO_FABRICATION_CONFLICT','special.bodyTier','Living-body fabrication technology differs between p87 (TL16) and pp105/121 (TL17); a self-fabrication claim requires reconciliation.');
 }
 const bodyFee=baseSlots*perSlot;
 return {diagnostics,reservedSlots:Math.ceil(baseSlots*(kind==='android'?.5:.75)),bodyFee,cost:3*(physicalCost+bodyFee)+softwareCost,baseArmour:0,traits,source:source(kind==='android'?'86-87':'88-89')};
}




const MICRO_BRAINS=[
 {id:'primitive',label:'Primitive',tl:8,bandwidth:0,intelligence:1,cost:100,family:'primitive',rank:0},
 {id:'basic',label:'Basic',tl:11,bandwidth:1,intelligence:4,cost:4000,family:'basic',rank:1},
 {id:'hunter-killer',label:'Hunter/Killer',tl:11,bandwidth:1,intelligence:4,cost:6000,family:'hunter-killer',rank:1},
 {id:'advanced',label:'Advanced (p81 microbot row)',tl:12,bandwidth:2,intelligence:6,cost:10000,family:'advanced',rank:2},
 {id:'very-advanced',label:'Very Advanced',tl:15,bandwidth:3,intelligence:9,cost:500000,family:'very-advanced',rank:3}
];
const MICRO_OPTIONS=[...DEFAULT_ITEMS,...OPTIONS.filter(o=>o.id!=='hostile-environment'&&o.id!=='reflec')].filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i);
const microControls=[
 {...number('massMg','Mass (milligrams)',2,30000,1000),stage:'chassis'},
 {...select('locomotion','Microbot locomotion',LOCOMOTION.map(l=>[l.id,l.label]),'walker'),stage:'locomotion'},
 {...number('speedIncrease','Additional tactical movement (metres)',0,12,0),stage:'locomotion'},
 {...select('efficiency','Power efficiency',[['normal','Normal'],['improved','Improved efficiency']],'normal'),stage:'physical'},
 {...number('arms','Size0 arms (no free arms)',0,18,0),stage:'physical'},
 {...number('armDexIncrease','DEX increase for each arm',0,13,0),stage:'physical'},
 {...select('environment','Environmental protection',[['none','None'],['corrosive','Corrosive'],['insidious','Insidious']],'none'),stage:'physical'},
 {...number('radiationLevels','Radiation protection levels',0,18,0),stage:'physical'},
 {field:'options',label:'Microbot zero-slot hardware',type:'multiselect',default:[],choices:MICRO_OPTIONS,stage:'physical'},
 {...select('brain','Microbot brain',MICRO_BRAINS.map(b=>[b.id,`${b.label} (TL${b.tl})`]),'primitive'),stage:'brain'},
 {...number('intellectUpgrade','Intellect increase',0,3,0),stage:'brain'},
 {...select('hardened','Brain hardening',[['no','None'],['yes','Hardened']],'no'),stage:'brain'},
 {...select('advancedBrainInterpretation','Advanced brain source discrepancy',[['unresolved','Not resolved'],['micro-table','Use the explicit p81 microbot table (INT6, TL12)']],'unresolved'),stage:'brain',visibleWhen:{field:'brain',equals:'advanced'}},
 {...select('corePackage','Hard-coded skill package',CORE_PACKAGES.map(p=>[p.id,p.label]),'primitive-alert'),stage:'skills'},
 {field:'packages',label:'Installed microbot software',type:'multiselect',default:[],choices:PACKAGES,stage:'skills'}
].map(c=>({...c,source:source('79-81')}));
function evaluateMicrobot(design){
 const diagnostics=[],ledger=[];
 const issue=(severity,code,path,message,pages='79-81')=>diagnostics.push({severity,code,path,message,source:source(pages)});
 const entry=(id,label,cost,pages='79-81')=>ledger.push({id,label,cost,slots:0,source:source(pages)});
 const coverage={complete:false,scope:'Microbot construction with implemented zero-slot catalogue',gaps:[{id:'micro-options',message:'Additional zero-slot equipment, self-destruct prices and swarm operations are not implemented.',source:source('79-81')},{id:'micro-brain-conflict',message:'Advanced brain table p81 differs from ordinary p66; a recorded interpretation is required.',source:source('66,81')}]};
 const finish=totals=>{const status=diagnostics.some(d=>d.severity==='error')?'invalid':diagnostics.some(d=>d.severity==='blocker')?'blocked':'verified';return{status,diagnostics,ledger,totals:status==='verified'?totals:null,coverage};};
 try{validateSpecialFields('microbot',design.special);}catch(e){issue('error','SCHEMA','special',e.message);return finish(null);}
 const s=design.special,tl=design.techLevel,b=MICRO_BRAINS.find(b=>b.id===s.brain),l=LOCOMOTION.find(l=>l.id===s.locomotion),core=CORE_PACKAGES.find(p=>p.id===s.corePackage);
 if(tl<8)issue('error','MICRO_TL','techLevel','Microbots require TL8 or later.');
 const masses=[1000,500,250,125,60,30,15,8,4,2];const minMass=masses[Math.max(0,Math.min(9,tl-8))];
 if(s.massMg<minMass)issue('error','MICRO_MASS','special.massMg','Mass is below the minimum for this technology.');
 if(tl>17)issue('warning','MICRO_HIGH_TL_MASS','special.massMg','Minimum mass uses the last printed table row (TL17); smaller higher-TL extrapolations are not assumed.');
 if(l.tl>tl)issue('error','MICRO_LOCOMOTION_TL','special.locomotion','Locomotion exceeds design technology.');
 if(l.id==='aeroplane')issue('blocker','MICRO_AEROPLANE_CONFLICT','special.locomotion','Microbots allow locomotion options generally, but aeroplane movement requires vehicle movement, which microbots prohibit. Referee reconciliation is required.','17,80');
 if(l.id==='thruster')issue('blocker','MICRO_THRUSTER_PRIMARY','special.locomotion','Microbot general locomotion permission conflicts with the ordinary primary-thruster restriction; source reconciliation is required.','17,80');
 if(l.id==='none'&&s.speedIncrease)issue('error','MICRO_STATIONARY_SPEED','special.speedIncrease','Stationary microbots cannot buy tactical movement.');
 const baseCost=50*l.multiplier,baseSpeed=l.id==='none'?0:Math.ceil((5+l.agility)/2),speed=baseSpeed+s.speedIncrease;
 if(speed>12)issue('error','MICRO_SPEED_CAP','special.speedIncrease','Microbot tactical movement cannot exceed 12 metres.');
 if(s.speedIncrease>=10)issue('warning','MICRO_ENDURANCE','special.speedIncrease','Tactical increase leaves no positive internal endurance; an external power operating interpretation may be needed. The book does not explicitly ban this configuration.');
 let hardware=baseCost,software=0;entry('micro-body','Microbot chassis and locomotion',baseCost);
 if(s.efficiency==='improved'){hardware+=baseCost*.5;entry('efficiency','Improved efficiency',baseCost*.5);}
 if(s.speedIncrease){const cost=25*l.multiplier*s.speedIncrease;hardware+=cost;entry('movement','Increased tactical movement',cost);}
 if(s.armDexIncrease&&!s.arms)issue('error','MICRO_ARMS_REQUIRED','special.armDexIncrease','DEX upgrades require at least one arm.');
 const armDEX=Math.ceil(tl/2+1)+s.armDexIncrease;
 if(armDEX>tl+3)issue('error','MICRO_ARM_DEX','special.armDexIncrease','Manipulator DEX cannot exceed TL+3.','26,80');
 if(s.armDexIncrease)issue('blocker','MICRO_ARM_UPGRADE_PRICE','special.armDexIncrease','Size0 manipulator upgrade pricing is not resolved; do not apply the ordinary size multiplier to create free upgrades.','26,80');
 if(s.arms){hardware+=s.arms*10;entry('arms','Size0 manipulators',s.arms*10);}
 if(b.tl>tl)issue('error','MICRO_BRAIN_TL','special.brain','The microbot brain table availability exceeds design technology.');
 if(b.id==='advanced'){
  if(s.advancedBrainInterpretation==='unresolved')issue('blocker','MICRO_BRAIN_CONFLICT','special.advancedBrainInterpretation','p81 lists Advanced TL12 / INT6 / BW2 / Cr10000, unlike the ordinary p66 brain and shrink-fit rule. Choose the explicit microbot table to record that interpretation.','66,81');
  else issue('warning','MICRO_BRAIN_TABLE','special.brain','Using the explicit p81 microbot table: TL12, INT6, BW2, Cr10000; ordinary-brain INT8 and fit TL14 are not silently substituted.','66,81');
 }
 if(b.rank>=3&&tl>b.tl)issue('warning','MICRO_BRAIN_PRICE_INTERPRETATION','special.brain','Uses the printed microbot table price at higher TL; the book does not explicitly define a new retro-brain discount clock after microbot fit.','67,81');
 const brainCost=b.cost*(s.hardened==='yes'?1.5:1);hardware+=brainCost;entry('brain','Microbot brain',brainCost,'67,81');
 const intellectBW=s.intellectUpgrade*(s.intellectUpgrade+1)/2,intelligence=b.intelligence+s.intellectUpgrade;
 let intellectCost=s.intellectUpgrade?1000:0;for(let n=1;n<=s.intellectUpgrade;n++)intellectCost*=b.intelligence+n;if(intelligence>=12)intellectCost*=2;
 if(intellectCost){hardware+=intellectCost;entry('intellect','Intellect upgrade',intellectCost,'67');}
 let bw=intellectBW,zeroBW=0;const installed=[];
 if(b.rank<2){
  if(core.family!==b.family)issue('error','MICRO_CORE_FAMILY','special.corePackage','Hard-coded package does not match the selected brain.','69-73');
  if(s.packages.length)issue('blocker','MICRO_CORE_ADDONS','special.packages','Additional hard-coded skills and bandwidth interpretation require their dedicated package rules.','69-73');
  if(core.reason||core.implemented===false)issue('blocker','MICRO_CORE_DETAIL','special.corePackage',core.reason??'The selected hard-coded package requires unresolved detail.','69-73');
  software+=core.cost;bw+=core.bandwidth;installed.push(...core.skills.map(([skill,level])=>({skill,level})));entry('core-package','Hard-coded skill package',core.cost,'69-73');
 }else{
  if(core.id!=='none')issue('error','MICRO_CORE_ADVANCED','special.corePackage','Advanced brains use installed skill packages rather than hard-coded primitive packages.','69-73');
  const selected=s.packages.map(id=>PACKAGES.find(p=>p.id===id));const seen=new Set();
  for(const p of selected){
   const key=p.skill+':'+(p.speciality??'');if(seen.has(key))issue('error','MICRO_SKILL_DUPLICATE','special.packages','Install a single level of each skill or specialty.','73');seen.add(key);
   if(p.implemented===false)issue('blocker','MICRO_SKILL_SPECIALTY','special.packages',p.reason??'This package requires specialty details.','73-75');
   if(p.tl>tl)issue('error','MICRO_SKILL_TL','special.packages','Skill software exceeds design technology.','73');
   if((p.perPackageBandwidth??p.bandwidth)>b.bandwidth)issue('error','MICRO_SKILL_BW','special.packages','Skill exceeds inherent brain bandwidth.','73');
   if(p.bandwidth===0)zeroBW++;else bw+=p.bandwidth;
   software+=p.cost;entry(p.id,p.label,p.cost,'73-75');installed.push(copy(p));
  }
 }
 const zeroBWAllowance=tl+b.bandwidth;if(zeroBW>zeroBWAllowance)bw+=zeroBW-zeroBWAllowance;
 if(bw>b.bandwidth)issue('error','MICRO_BANDWIDTH','special','Intellect and software exceed inherent bandwidth; microbots cannot add memory modules.','67,80-81');
 let zeroCount=s.arms+(s.environment==='none'?0:1)+s.radiationLevels;
 const exclusive=new Set();
 for(const id of s.options){const o=MICRO_OPTIONS.find(o=>o.id===id);zeroCount++;if(o.tl>tl)issue('error','MICRO_OPTION_TL','special.options','Selected hardware exceeds design technology.');if(o.exclusive){if(exclusive.has(o.exclusive))issue('error','MICRO_OPTION_EXCLUSIVE','special.options','Select at most one grade from each hardware family.');exclusive.add(o.exclusive);}const cost=o.costPerBaseSlot!==undefined?o.costPerBaseSlot*.5:o.cost;hardware+=cost;entry(o.id,o.label,cost,o.source.pages);}
 if(zeroCount>tl)issue('error','MICRO_ZERO_SLOTS','special','Microbot zero-slot choices exceed TL; no actual Slots are available for overflow.');
 const env=s.environment==='corrosive'?{tl:9,multiplier:2}:s.environment==='insidious'?{tl:11,multiplier:5}:{tl:0,multiplier:1};
 if(env.tl>tl)issue('error','MICRO_ENV_TL','special.environment','Environmental protection exceeds design technology.');
 const protectionMultiplier=env.multiplier*2**s.radiationLevels;
 if(protectionMultiplier>1)entry('protection','Cumulative protection hardware multiplier',hardware*(protectionMultiplier-1));
 hardware*=protectionMultiplier;
 const endurance=Math.round(l.endurance*(tl>=15?2:tl>=12?1.5:1)*(s.efficiency==='improved'?2:1)*(1-s.speedIncrease*.1));
 issue('warning','MICRO_SCOPE','coverage','Checks the implemented microbot table and selected zero-slot hardware, not every Handbook device. No default suite, secondary locomotion, armour, memory module or power pack is included.');
 return finish({cost:hardware+software,slots:{base:0,capacity:0,used:0,remaining:0},bandwidth:{inherent:b.bandwidth,capacity:b.bandwidth,used:bw,remaining:b.bandwidth-bw},zeroSlot:{allowance:tl,used:zeroCount,overflow:0},zeroBandwidth:{allowance:zeroBWAllowance,used:zeroBW,overflow:Math.max(0,zeroBW-zeroBWAllowance)},hits:1,armour:0,tacticalSpeed:speed,endurance,intelligence,skills:installed,manipulators:Array.from({length:s.arms},(_,i)=>({id:'micro-'+(i+1),size:0,strength:0,dexterity:armDEX})),traits:['Small (-4)',...l.traits],microbot:{massMg:s.massMg,minMassMg:minMass,hardwareCost:hardware,softwareCost:software,protectionMultiplier}});
}
