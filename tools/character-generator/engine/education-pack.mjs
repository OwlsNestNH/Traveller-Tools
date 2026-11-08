// Original mechanical data and pure helpers: Core Rulebook Update 2022, pp.16-17.
// No source prose, private source URLs, UI dependencies, or hidden random rolls.
export const EDUCATION_PACK_VERSION=1;
export const EDUCATION_EFFECT_SCHEMA=Object.freeze({
 skill:'name, mode (set/increase), value',
 stat:'name, value: characteristic delta',
 choice:'options: [{label,effects}]',
 check:'stat or skillScope, target, success/failure; optional total keyed by modified result',
 relationship:'type, count, optional dice',
 random:'dice, outcomes:[{min,max,effects}]',
 'table-roll':'table, dice, sourcePage',
 'career-status':'action, career; optional viaDraft and exceptionToLifetimeLimit',
 'education-status':'graduationAllowed:false; no graduation roll or awards',
 'education-skill-choice':'selectionId, options, mode, value; retain chosen skill for graduation',
 'education-selected-skill':'selectionId, mode, value; applies to the saved university selection',
 'service-training':'career, selection (all/choose), optional count, mode, value; chosen skills must be distinct',
 'checked-skill':'mode, value; the exact skill used by the enclosing successful check',
 'psionic-test':'termPenalty; tests potential only, not training or talents',
 'career-permission':'career, scope',
 'qualification-modifier':'value, careers:[{career,assignment?}], scope',
 'commission-access':'careers, scope, beforeFirstTerm, rankOnSuccess, modifier, automatic',
 'automatic-entry':'career, scope',
 'commission-prohibition':'career, terms'
});
const src=page=>({id:'core',title:'Core Rulebook Update 2022',page});
const skill=(name,value=1,mode='set')=>({kind:'skill',name,mode,value});
const stat=(name,value=1)=>({kind:'stat',name,value});
const relation=(type,count=1,dice)=>({kind:'relationship',type,count,...(dice?{dice}:{})});
const choice=options=>({kind:'choice',options:options.map(([label,effects])=>({label,effects}))});
const check=(stat,target,success=[],failure=[],extra={})=>({kind:'check',stat,target,success,failure,...extra});
const noGraduation=()=>({kind:'education-status',graduationAllowed:false});
const nextCareer=(career,viaDraft=false)=>({kind:'career-status',action:'next',career,...(viaDraft?{viaDraft:true,exceptionToLifetimeLimit:true}:{})});
const MILITARY=['core.army','core.marine','core.navy'];
const QUALIFICATION_CAREERS=[
 {career:'core.agent'},{career:'core.army'},{career:'core.citizen',assignment:'corporate'},
 {career:'core.entertainer',assignment:'journalist'},{career:'core.marine'},{career:'core.navy'},
 {career:'core.scholar'},{career:'core.scout'}
];
const universityChoices=[
 {name:'Admin'},{name:'Advocate'},{name:'Animals',specialities:['training','veterinary']},
 {name:'Art',specialities:'any'},{name:'Astrogation'},{name:'Electronics',specialities:'any'},
 {name:'Engineer',specialities:'any'},{name:'Language',specialities:'any'},
 {name:'Medic'},{name:'Navigation'},{name:'Profession',specialities:'any'},{name:'Science',specialities:'any'}
];
const commonTermRules={
 years:4,firstTerm:1,lastTerm:3,entryAttemptsPerTerm:1,
 entryFailure:{consumesTerm:false,next:'career-qualification'},
 successfulEntry:{consumesTerm:true,keepInitialAwardsOnFailure:true},
 musteringOut:false,eventBeforeGraduation:true
};
const service=(career,selection,value,count)=>({
 kind:'service-training',career,selection,mode:'set',value,...(count?{count}:{})
});

export const PRECAREER_EVENTS=deepFreeze({
 2:[choice([
  ['Test potential',[
   {kind:'psionic-test',termPenalty:'completed-career-terms'},
   {kind:'career-permission',career:'core.psion',scope:'future-terms'}
  ]],['Decline',[]]
 ])],
 3:[noGraduation()],
 4:[check('SOC',8,[relation('Rival')],[relation('Enemy')],{
  total:{2:[noGraduation(),nextCareer('core.prisoner')]}
 })],
 5:[skill('Carouse')],
 6:[relation('Ally',1,'D3')],
 7:[{kind:'table-roll',table:'core.life-events',dice:'2D',sourcePage:46}],
 8:[check('SOC',8,[relation('Ally'),relation('Enemy')])],
 9:[{kind:'education-skill-choice',selectionId:'hobby',options:'any',exclude:['Jack-of-all-Trades'],mode:'set',value:0}],
 10:[{
  kind:'check',skillScope:'learned-this-term',target:9,
  success:[{kind:'checked-skill',mode:'increase',value:1},relation('Rival')],failure:[]
 }],
 11:[check('SOC',9,[],[
  noGraduation(),choice([
   ['Flee',[nextCareer('core.drifter')]],
   ['Draft',[{kind:'random',dice:'1D',outcomes:[
    {min:1,max:3,effects:[nextCareer('core.army',true)]},
    {min:4,max:5,effects:[nextCareer('core.marine',true)]},
    {min:6,max:6,effects:[nextCareer('core.navy',true)]}
   ]}]]
  ])
 ])],
 12:[stat('SOC')]
});

const data={
 'core.university':{
  id:'core.university',name:'University',source:src(16),termRules:commonTermRules,
  entry:{stat:'EDU',target:6,termDM:{1:0,2:-1,3:-2},thresholdDM:[{stat:'SOC',minimum:9,value:1}]},
  initialEffects:[
   {kind:'education-skill-choice',selectionId:'university-0',options:universityChoices,mode:'set',value:0},
   {kind:'education-skill-choice',selectionId:'university-1',options:universityChoices,mode:'set',value:1},
   stat('EDU')
  ],
  graduation:{stat:'INT',target:6,honoursTarget:10,thresholdDM:[],
   effects:[
    {kind:'education-selected-skill',selectionId:'university-0',mode:'increase',value:1},
    {kind:'education-selected-skill',selectionId:'university-1',mode:'increase',value:1},
    stat('EDU')
   ],honoursEffects:[]
  },
  careerRules:{
   qualification:{scope:'persistent',careers:QUALIFICATION_CAREERS,modifier:1,honoursModifier:2},
   commission:{scope:'first-career-after-education',careers:MILITARY,beforeFirstTerm:true,rankOnSuccess:1,modifier:0,honoursModifier:2,automaticHonours:false}
  },
  events:PRECAREER_EVENTS,
  sourceNotes:[{page:16,issue:'Store both chosen skills. Overlapping selections need adjudication rather than silently granting the same graduation increase twice.'}]
 }
};
for(const [suffix,name,statName,target] of [
 ['army','Army academy','END',7],['marine','Marine academy','END',8],['navy','Navy academy','INT',8]
]) {
 const career='core.'+suffix,id='core.academy-'+suffix;
 data[id]={
  id,name,source:src(16),termRules:commonTermRules,
  entry:{stat:statName,target,termDM:{1:0,2:-2,3:-4},thresholdDM:[]},
  initialEffects:[service(career,'all',0)],
  graduation:{stat:'INT',target:7,honoursTarget:11,thresholdDM:[{stat:'END',minimum:8,value:1},{stat:'SOC',minimum:8,value:1}],
   effects:[stat('EDU')],honoursEffects:[stat('SOC')]
  },
  careerRules:{
   serviceAward:{career,once:true,when:'entering-matching-career',effects:[service(career,'choose',1,3)]},
   automaticEntry:{career,scope:'first-career-attempt-after-education'},
   commission:{scope:'first-career-after-education',careers:MILITARY,beforeFirstTerm:true,rankOnSuccess:1,modifier:2,honoursModifier:2,automaticHonours:true},
   failedGraduation:{career,totalMustExceed:2,automaticEntry:true,commissionForbiddenTerms:1,delayedUse:'needs-adjudication'}
  },
  events:PRECAREER_EVENTS,
  sourceNotes:[{page:17,issue:'The academy commission paragraph says university; this pack applies that paragraph to the academy that contains it.'}]
 };
}
export const EDUCATION_PACK=deepFreeze(data);
export const UNIVERSITY_SKILL_CHOICES=EDUCATION_PACK['core.university'].initialEffects[0].options;

function deepFreeze(value) {
 if(value&&typeof value==='object'&&!Object.isFrozen(value)) {
  Object.values(value).forEach(deepFreeze);Object.freeze(value);
 }
 return value;
}
function integer(value,min,max,name) {
 if(!Number.isSafeInteger(value)||value<min||value>max) throw new RangeError(name+' must be an integer from '+min+' to '+max+'.');
 return value;
}
function needBoolean(value,name) { if(typeof value!=='boolean') throw new TypeError(name+' must be boolean.'); }
function get(id) { if(typeof id!=='string'||!Object.hasOwn(EDUCATION_PACK,id)) throw new Error('Unknown Core education option.'); return EDUCATION_PACK[id]; }
function score(stats,name) {
 if(!stats||typeof stats!=='object'||Array.isArray(stats)) throw new TypeError('Characteristic scores are required.');
 return integer(stats[name],0,40,name);
}
function dm(value) { return value===0?-3:value<3?-2:value<6?-1:value<9?0:value<12?1:value<15?2:3; }
function thresholdDM(rows,stats) { return rows.reduce((sum,row)=>sum+(score(stats,row.stat)>=row.minimum?row.value:0),0); }
function outcome(page,effects,extra={}) { return {source:src(page),effects:structuredClone(effects),needsAdjudication:false,...extra}; }

/** term is one-based, including prior education or career terms. */
export function educationEntryCheck({id,term,stats,roll}={}) {
 const education=get(id),rule=education.entry;
 integer(term,1,3,'Current term');integer(roll,2,12,'Entry roll');
 const characteristicDM=dm(score(stats,rule.stat)),termDM=rule.termDM[term],thresholdModifier=thresholdDM(rule.thresholdDM,stats);
 const total=roll+characteristicDM+termDM+thresholdModifier,success=total>=rule.target;
 return outcome(16,success?education.initialEffects:[],{
  id,term,roll,stat:rule.stat,characteristicDM,termDM,thresholdModifier,total,target:rule.target,success,
  consumesTerm:success,next:success?'education-event':'career-qualification'
 });
}

/** A blocked graduation neither rolls nor creates failure-roll auto-entry rights. */
export function educationGraduationCheck({id,stats,roll,graduationAllowed=true}={}) {
 const education=get(id),rule=education.graduation;
 needBoolean(graduationAllowed,'graduationAllowed');
 if(!graduationAllowed) return outcome(17,[],{id,attempted:false,graduated:false,honours:false,total:null,target:rule.target,reason:'education-event'});
 integer(roll,2,12,'Graduation roll');
 const characteristicDM=dm(score(stats,rule.stat)),thresholdModifier=thresholdDM(rule.thresholdDM,stats);
 const total=roll+characteristicDM+thresholdModifier,graduated=total>=rule.target,honours=total>=rule.honoursTarget;
 const effects=graduated?[...rule.effects,...(honours?rule.honoursEffects:[])]:[];

 return outcome(16,effects,{id,attempted:true,roll,stat:rule.stat,characteristicDM,thresholdModifier,total,target:rule.target,honoursTarget:rule.honoursTarget,graduated,honours});
}

/** Resolve persistent and one-shot rights when a career is attempted/entered.
 * after a failed first attempt, firstCareerAttempt is false even before a career is chosen.
 * serviceAwardUsed prevents reissuing the matching-academy three-skill award.
 */
export function educationCareerBenefits({
 id,graduation,careerId,assignment,firstCareerAfterEducation=true,firstCareerAttempt=true,
 serviceAwardUsed=false,enteringCareer=true,forcedNextCareer=null
}={}) {
 const education=get(id),rules=education.careerRules;
 if(typeof careerId!=='string') throw new TypeError('Career ID is required.');
 if(assignment!==undefined&&typeof assignment!=='string') throw new TypeError('Assignment must be a string.');
 for(const [name,value] of Object.entries({firstCareerAfterEducation,firstCareerAttempt,serviceAwardUsed,enteringCareer})) needBoolean(value,name);
 if(!graduation||typeof graduation!=='object'||graduation.id!==id) throw new TypeError('Use this education option’s graduation result.');
 needBoolean(graduation.graduated,'graduated');needBoolean(graduation.honours,'honours');needBoolean(graduation.attempted,'attempted');
 if(graduation.honours&&!graduation.graduated) throw new TypeError('Honours require graduation.');
 const meta={id,careerId,...(assignment!==undefined?{assignment}:{}),qualificationModifier:0,automaticEntry:false,commission:null,serviceAward:false};
 if(forcedNextCareer&&forcedNextCareer!==careerId) return outcome(17,[],{...meta,needsAdjudication:true,reason:'A required next career takes precedence over educational entry benefits.'});
 if(!graduation.attempted) return outcome(17,[],meta);
 const effects=[];
 if(graduation.graduated) {
  if(rules.qualification) {
   const matching=rules.qualification.careers.some(row=>row.career===careerId&&(!row.assignment||row.assignment===assignment));
   if(matching) meta.qualificationModifier=graduation.honours?rules.qualification.honoursModifier:rules.qualification.modifier;
  }
  if(rules.automaticEntry?.career===careerId&&firstCareerAttempt) {
   meta.automaticEntry=true;effects.push({kind:'automatic-entry',career:careerId,scope:'first-career-attempt-after-education'});
  }
  if(rules.serviceAward?.career===careerId&&!serviceAwardUsed&&enteringCareer) {
   effects.push(...rules.serviceAward.effects);meta.serviceAward=true;
  }
  if(rules.commission.careers.includes(careerId)&&firstCareerAfterEducation) {
   meta.commission={allowed:true,beforeFirstTerm:true,rankOnSuccess:1,
    modifier:graduation.honours?rules.commission.honoursModifier:rules.commission.modifier,
    automatic:graduation.honours&&rules.commission.automaticHonours};
   effects.push({kind:'commission-access',careers:[careerId],scope:'first-career-after-education',...meta.commission});
  }
 } else if(rules.failedGraduation?.career===careerId) {
  if(!Number.isFinite(graduation.total)) throw new TypeError('A failed graduation needs its modified total.');
  if(graduation.total>rules.failedGraduation.totalMustExceed) {
   if(!firstCareerAfterEducation) return outcome(17,[],{...meta,needsAdjudication:true,reason:'Delayed use of failed-academy automatic entry is not specified by the source.'});
   meta.automaticEntry=true;
   meta.commission={allowed:false,forbiddenTerms:1};
   effects.push({kind:'automatic-entry',career:careerId,scope:'after-failed-academy'},
    {kind:'commission-prohibition',career:careerId,terms:1});
  }
 }
 return outcome(education.id==='core.university'?16:17,effects,meta);
}

/** Evaluate event 4's exceptional modified result without treating it as natural 2. */
export function educationEventFour({roll,socialStanding}={}) {
 integer(roll,2,12,'Event roll');integer(socialStanding,0,40,'SOC');
 const total=roll+dm(socialStanding),success=total>=8;
 const effects=[relation(success?'Rival':'Enemy'),...(total===2?[noGraduation(),nextCareer('core.prisoner')]:[])];
 return outcome(17,effects,{roll,total,success,graduationAllowed:total!==2,forcedNextCareer:total===2?'core.prisoner':null});
}
