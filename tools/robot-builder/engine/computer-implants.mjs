// General computer Processing is separate from robot brain bandwidth.
const source=pages=>({book:'Core Rulebook Update 2022',edition:'Mongoose 2022',pages});
const rows={interface:[[0,7,0]],'intelligent-interface':[[1,11,100]],security:[[0,8,0],[1,10,200],[2,11,1000],[3,12,20000]],intrusion:[[1,10,1000],[2,11,10000],[3,13,100000],[4,15,1000000]],expert:[[1,11,1000],[2,12,10000],[3,13,100000]],translator:[[0,9,50],[1,10,500]],agent:[[0,11,500],[1,12,2000],[2,13,100000],[3,14,250000]],intellect:[[1,12,2000],[2,13,50000],[3,14,200000]],database:[[0,7,null]]};
const labels={interface:'Interface','intelligent-interface':'Intelligent Interface',security:'Security',intrusion:'Intrusion',expert:'Expert',translator:'Translator',agent:'Agent',intellect:'Intellect',database:'Database'};
const handbookSource=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
const handbookRows={'clone-creator':[[1,8,2000],[2,10,20000],[3,13,200000]],'fab-creator':[[1,8,2000],[2,10,5000],[3,13,20000],[4,17,50000]],'drone-control':[[1,11,2000],[2,12,5000]],'swarm-control':[[1,11,15000],[2,12,30000],[3,13,60000],[4,14,120000]]};
Object.assign(rows,handbookRows);
Object.assign(labels,{'clone-creator':'Clone Creator','fab-creator':'Fab Creator','drone-control':'Drone Control','swarm-control':'Swarm Control'});
const programSource=program=>handbookRows[program]?handbookSource(program==='clone-creator'?'122':'123'):source('110-113');
const sel=(field,label,choices,value)=>({field,label,type:'select',choices:choices.map(([id,label])=>({id,label,...(field==='program'?{source:programSource(id)}:{})})),default:value});
const num=(field,label,min,max,value)=>({field,label,type:'number',min,max,default:value});
const str=(field,label)=>({field,label,type:'text',maxLength:80,default:''});
export const isComputerId=id=>id.startsWith('misc-mass-portable-computer-')||id==='misc-mass-computer-terminal-7'||['neural-comm-improved','neural-comm-advanced','neural-link-basic','neural-link-improved'].includes(id);
export function neuralComputerParameters(){return computerParameters().filter(c=>['computerRatedTL','softwareModifierBasis'].includes(c.field));}
export function computerParameters(){return[
 sel('computerVariant','Computer production variant',[['standard','Standard printed model'],['prototype-one','Prototype: one TL early'],['prototype-two','Prototype: two TL early'],['retrotech','Retrotech: lower rated TL']],'standard'),
 num('computerRatedTL','Computer rated TL (0 = printed model TL)',0,23,0),
 num('computerSpecialisation','Dedicated Processing bonus',0,2,0),
 str('computerSpeciality','Dedicated program ID or Expert skill'),
 sel('computerSoftwarePrice','Computer software price basis',[['standard','Separate software licences: ordinary price'],['device-inclusive','Explicit device-inclusive interpretation: triple price']],'standard'),
 sel('softwareModifierBasis','Software percentage-modifier basis',[['unresolved','Unresolved when percentage modifiers apply'],['include-all-fixed-costs','Include software in fixed-cost basis'],['physical-only','Exclude software by explicit interpretation']],'unresolved')
];}
export function computerSoftwareControl(design){const parents=(design.special?.augmentations??[]).filter(r=>isComputerId(r.optionId)).map((r,i)=>[r.id,'Implanted computer '+(i+1)]);return{field:'computerSoftware',type:'custom-packages',label:'General-computer programs',recordNameField:'program',recordDetailField:'subject',summaryField:'rating',summaryFields:['rating','runningBandwidth'],composerLabel:'Configure a computer program',addLabel:'Add computer program',stage:'skills',maxItems:100,default:[],description:'Purchased programs and active programs belong to this computer, not a robot brain or recipient. Active rating -1 means stored; 0 means executing at Bandwidth 0.',source:source('110-113'),itemFields:[sel('parentComputer','Installed computer',parents.length?parents:[['unassigned','Add a computer first']],'unassigned'),sel('program','Program',Object.entries(labels),'interface'),{...sel('rating','Purchased program rating',[[0,'Rating 0']],0),choicesBy:{field:'program',values:Object.fromEntries(Object.entries(rows).map(([id,tiers])=>[id,tiers.map(([rating])=>({id:rating,label:'Rating '+rating}))]))},resetWhenUnavailable:true},{...sel('runningBandwidth','Active program rating',[[-1,'Stored, not running'],[0,'Running at rating 0']],-1),maxValueField:'rating',choicesBy:{field:'program',values:Object.fromEntries(Object.entries(rows).map(([id,tiers])=>[id,[{id:-1,label:'Stored, not running'},...(id==='database'?[]:tiers.map(([rating])=>({id:rating,label:'Running at rating '+rating})))] ]))},resetWhenUnavailable:true},{...str('subject','Program subject'),labelBy:{field:'program',values:{expert:'Expert skill',translator:'Translation language',database:'Database topic'}},visibleWhen:{field:'program',oneOf:['expert','translator','database']},resetWhenHidden:true},{...num('databasePrice','Database package price (Cr)',10,10000,10),visibleWhen:{field:'program',equals:'database'},resetWhenHidden:true},{...sel('expertUse','Expert operating mode',[['assisted','User assisted'],['autonomous','Autonomous Intellect']],'assisted'),visibleWhen:{field:'program',equals:'expert'},resetWhenHidden:true}]};}
const normal=s=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function validateComputerSoftware(records,augments){
 if(!Array.isArray(records)||records.length>100)throw new TypeError('Invalid computer software records.');
 const ids=new Set(),packages=new Set();
 for(const r of records){
  if(!r||Object.keys(r).some(k=>!['id','parentComputer','program','rating','runningBandwidth','subject','databasePrice','expertUse'].includes(k))||typeof r.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(r.id)||ids.has(r.id)||!augments.some(a=>a.id===r.parentComputer&&isComputerId(a.optionId))||!rows[r.program]?.some(x=>x[0]===r.rating)||!Number.isInteger(r.runningBandwidth)||r.runningBandwidth< -1||r.runningBandwidth>r.rating||r.runningBandwidth>=0&&!rows[r.program].some(x=>x[0]===r.runningBandwidth)||typeof r.subject!=='string'||r.subject.length>80||!Number.isInteger(r.databasePrice)||r.databasePrice<10||r.databasePrice>10000||!['assisted','autonomous'].includes(r.expertUse))throw new TypeError('Invalid computer program, tier or parent.');
  if(['expert','translator','database'].includes(r.program)&&!r.subject.trim())throw new TypeError('Named program requires a specific skill, language or topic.');
  const key=r.parentComputer+':'+r.program+':'+(['expert','translator','database'].includes(r.program)?normal(r.subject):'');
  if(packages.has(key))throw new TypeError('Duplicate computer program.');packages.add(key);ids.add(r.id);
 }
}
export function evaluateComputer(device,p,records,techLevel,context={}){
 const diagnostics=[],issue=(severity,code,message,pages='110-113')=>diagnostics.push({severity,code,message,source:source(pages)});
 const variant=p.computerVariant??'standard',inputTL=p.computerRatedTL??0,bonus=p.computerSpecialisation??0,speciality=normal(p.computerSpeciality??'');
 let ratedTL=inputTL||device.tl,factor=1,constructionTL=techLevel;
 if(variant.startsWith('prototype')){
  const early=variant==='prototype-one'?1:2;constructionTL=device.tl-early;factor=10**early;
  if(inputTL&&inputTL!==device.tl)issue('error','COMPUTER_PROTOTYPE_RATING','Prototype retains the printed model technology rating.');
  ratedTL=device.tl;if(techLevel<constructionTL)issue('error','COMPUTER_PROTOTYPE_TL','Available construction technology is too low.');
 }else{
  if(ratedTL<device.tl||ratedTL>techLevel)issue('error','COMPUTER_RATED_TL','Rated TL must be between printed model TL and construction TL.');
  if(variant==='retrotech')factor=2**-(techLevel-ratedTL);
 }
 if(bonus&&!speciality)issue('error','COMPUTER_SPECIALITY','Dedicated Processing requires one named program or Expert skill.','112');
 const hardwareCost=device.cost*factor*(1+.25*bonus),massKg=device.massKg*factor,processing=device.effects.processing;
 const programs=records.map(r=>{const row=rows[r.program].find(x=>x[0]===r.rating);return{...r,label:labels[r.program],cost:r.program==='database'?r.databasePrice:row[2],minimumTL:row[1],active:r.runningBandwidth>=0,activeBandwidth:r.program==='database'?null:Math.max(0,r.runningBandwidth),scope:'computer-only',recipientSkillGranted:false,source:programSource(r.program)};});
 const active=programs.filter(r=>r.active);
 for(const r of active){
  if(r.minimumTL>ratedTL)diagnostics.push({severity:'error',code:'COMPUTER_PROGRAM_TL',message:r.label+' requires rated TL'+r.minimumTL+' even when run at a lower rating.',source:r.source});
  if(r.program==='database')issue('blocker','COMPUTER_DATABASE_EXECUTION','Database has no numeric Bandwidth. Store it as data and access it through Interface or Agent; no running Bandwidth is invented.','111');
 }
 let used=active.reduce((n,r)=>n+(r.activeBandwidth??0),0),dedicatedCredit=0;
 if(bonus){
  const matches=active.filter(r=>(r.program==='expert'?normal(r.subject):r.program)===speciality);
  if(matches.length===1)dedicatedCredit=Math.min(bonus,matches[0].activeBandwidth??0);
  if(matches.length>1)issue('blocker','COMPUTER_SPECIALISATION_ALLOCATION','Dedicated bonus must identify one active program.','112');
 }
 if(used-dedicatedCredit>processing)issue('error','COMPUTER_PROCESSING','Simultaneous programs exceed ordinary plus applicable dedicated Processing.');
 if(processing===0&&active.filter(r=>r.activeBandwidth===0).length>1)issue('error','COMPUTER_ZERO_PROCESSING','Computer/0 runs only one zero-Bandwidth program at a time.');
 const intelligent=active.some(r=>r.program==='intelligent-interface'),intellect=active.find(r=>r.program==='intellect'),autonomous=active.filter(r=>r.program==='expert'&&r.expertUse==='autonomous');
 for(const r of programs.filter(r=>handbookRows[r.program])){
  // Stored licences supply no task bonus. A lower active rating uses that
  // rating's capabilities, while purchase price and TL retain the bought tier.
  if(!r.active)continue;
  if(r.program==='clone-creator'||r.program==='fab-creator'){
   r.effects={designDM:r.runningBandwidth,taskScope:r.program==='clone-creator'?'novel-genetic-design':'novel-fabricator-design',designTier:r.runningBandwidth,canDesignNanorobots:r.program==='fab-creator'&&r.runningBandwidth>=3,manufacturingGranted:false,surgeryGranted:false,facilityIncluded:false,condition:'Only applicable design tasks while active; appropriate skills, equipment and task checks remain required.'};
  }else{
   if(!intelligent)diagnostics.push({severity:'error',code:'COMPUTER_CONTROL_INTERFACE',message:r.label+' requires active Intelligent Interface on this computer; Intellect is not a substitute.',source:r.source});
   const drone=r.program==='drone-control';
   r.effects={...(drone?{controlDM:r.runningBandwidth-1,maxDrones:1}:{maxTasks:r.runningBandwidth,maxSkill:r.runningBandwidth-1}),requiresIntelligentInterface:true,hardwareAlternatives:drone?['attached-robotic-drone-controller','transceiver-link-to-robot']:['attached-swarm-controller','high-speed-multichannel-wireless-data-link'],hardwareVerified:false,targetVerified:false,operationalControlCertified:false,condition:'Conditional software limits only. Compatible controller or link, target equipment, range and task limitations must be checked separately.'};
   diagnostics.push({severity:'warning',code:'COMPUTER_CONTROL_HARDWARE_UNVERIFIED',message:r.label+' requires a compatible controller or link and eligible targets; this software selection does not verify an operational connection.',source:r.source});
  }
 }
 for(const r of active.filter(r=>r.program==='expert')){
  if(r.expertUse==='assisted'&&!intelligent)issue('error','COMPUTER_EXPERT_INTERFACE','User-assisted Expert requires active Intelligent Interface.');
  if(r.expertUse==='autonomous'&&!intellect)issue('error','COMPUTER_EXPERT_INTELLECT','Autonomous Expert requires active Intellect.');
  r.effects={effectiveSkill:r.runningBandwidth-1,characteristics:context.neuralLink?['INT','EDU','STR','DEX','END']:['INT','EDU'],physicalAssistance:context.neuralLink===true,physicalAssistanceCondition:context.neuralLink?'Requires the installed neural link; source grants physical Expert assistance without permanently adding recipient skills.':null,alreadySkilledDM:1,listedMaximumTaskTarget:8+2*r.runningBandwidth,condition:'Contextual assistance only. Printed maximum and prose difficulty wording retained; no recipient skill or attack total granted.'};
 }
 if(intellect&&autonomous.length>intellect.runningBandwidth)issue('error','COMPUTER_INTELLECT_TASKS','Simultaneous autonomous Expert skills exceed active Intellect rating.');
 for(const r of programs){const effective=r.active?r.runningBandwidth:r.rating;if(r.program==='security')r.effects={intrusionDifficulty:8+2*effective,condition:'Defence applies while this Security program is active.'};if(r.program==='translator')r.effects={translation:effective===0?'near-real-time':'real-time',improvedNuance:effective===1,language:r.subject,condition:'Translation applies while this program is active.'};if(r.program==='agent')r.effects={electronicsComputers:r.active?r.runningBandwidth:r.rating,scope:'agent-program-only'};if(r.program==='intrusion')r.effects={intrusionDM:r.active?r.runningBandwidth:r.rating,legality:'Often illegal; setting law applies'};}
 const softwareBaseCost=programs.reduce((n,r)=>n+r.cost,0),priceRule=p.computerSoftwarePrice??'standard';
 if(softwareBaseCost&&!context.bundledNeural)issue('warning','COMPUTER_IMPLANT_SOFTWARE_INTERPRETATION',priceRule==='standard'?'Separately purchased software licences retain ordinary prices; the p92 device multiplier is applied to hardware.':'Software explicitly treated as part of the tripled miscellaneous device price by recorded interpretation.');
 return{hardwareCost,massKg,softwareCost:softwareBaseCost*(priceRule==='device-inclusive'?3:1),diagnostics,profile:{processing,ratedTL,constructionTL,variant,hardwareCost,massKg,softwareBaseCost,softwarePriceInterpretation:priceRule,activeBandwidth:used,dedicatedCredit,specialisation:{bonus,subject:speciality,allocation:'Bonus offsets only the one matching active program; not a shared Processing pool',source:source('112')},remainingProcessing:processing-used+dedicatedCredit,programs,includedSoftware:device.effects.includedSoftware,includedProgramsAutomaticallyActive:false,robotBrain:false,recipientSkillsGranted:false,scope:'computer-only',bundledNeural:context.bundledNeural===true,physicalExpertLink:context.neuralLink===true,source:source('110-113')}};
}
