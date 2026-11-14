import assert from'node:assert/strict';import{api,RULES_REVISION}from'../engine/session.mjs';
import{assignmentSetup,settleAssignment}from'./assignment-fixtures.mjs';import{aslanTemplateEntry}from'./aslan-template-fixtures.mjs';
export function shellRun(r,type,payload={}){const n=api({operation:'command',session:r.session,command:{type,payload}});assert.equal(n.ok,true,type+': '+n.error?.message);return n;}
function fixed(r,type,payload,values){const n=shellRun(r,type,payload);return n.log.at(-1).rolls.length?shellRun(n,'gm-replay',{revision:n.revision,rollIndex:0,values,reason:'Explicit synthetic visual-regression branch'}):n;}
function settleShell(r){for(let n=0;n<40;n++){if(r.state.stage==='borrowed-event-roll'){const p=r.state.pendingBorrowedRoll,skill=p.skillOptions?.[0]?.id??p.skillOptions?.[0]?.name;r=shellRun(r,'roll-borrowed-event',{pendingId:p.id,...(skill?{skill}:{})});continue;}const next=settleAssignment(r);if(next.state.stage==='borrowed-event-roll'){r=next;continue;}return next;}throw Error('Synthetic source choices exceeded the bounded fixture');}
const cache=new Map();
export function nonhumanShellStart(species='aslan',culture='native',seedSuffix=species==='aslan'&&culture==='imperial'?'-1':''){
 const key=species+'|'+culture+'|'+seedSuffix;if(cache.has(key))return structuredClone(cache.get(key));let r;
 if(species==='aslan'&&culture==='native')r=aslanTemplateEntry('aslan.envoy','duellist');
 else{
  r=api({operation:'create',seed:'shared-shell-'+species+'-'+culture+seedSuffix});for(const[t,p]of[['setup',{species,culture,gender:'female'}],['gm-mode',{enabled:true}],['roll-statistics',{}]])r=shellRun(r,t,p);
  for(let index=0;index<6;index++)r=shellRun(r,'gm-override',{field:'pool',index,value:8,reason:'Synthetic presentation characteristics'});
  r=shellRun(r,'accept-statistics');
  if(r.state.stage==='book-step'&&r.state.pending.kind==='species-setup'){
   // Explicit synthetic referee input to the existing source-assisted setup;
   // not a claim that this is the only RAW family/land outcome.
   r=shellRun(r,'resolve-book',{confirmed:true,birthOrder:'daughter',effects:[],note:'Synthetic referee-confirmed family/land record for UI coverage; no additional effects entered.'});r=settleAssignment(r);
  }
  assert.equal(r.state.stage,'background');r=shellRun(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=shellRun(r,'skip-precareer');
  if(culture==='native')r=settleAssignment(fixed(r,'career',{id:'vargr.citizen',assignment:'worker'},[6,6]));
 }
 if(culture==='native'){
  for(let term=0;term<(species==='aslan'?3:1);term++){
   r=fixed(r,'survival-check',{},[6,6]);r=settleAssignment(fixed(r,'career-event',{},species==='aslan'?[2,3]:[4,5]));assert.equal(r.state.stage,'advancement');r=settleAssignment(fixed(r,'advancement',{},[2,3]));
   if(r.state.stage==='training')r=settleAssignment(fixed(r,'training',{table:r.state.trainingOptions[0].id},[1]));
   assert.equal(r.state.stage,'term-end');
   if(species==='aslan'&&term<2){r=shellRun(r,'continue-career');assert.equal(r.state.stage,'training');r=settleAssignment(fixed(r,'training',{table:r.state.trainingOptions[0].id},[1]));}
  }
  r=shellRun(r,'leave-career');for(let n=0;n<8&&r.state.stage==='benefits';n++)r=settleShell(shellRun(r,'benefit',{cash:(r.state.cashRollAccounting?.used??r.state.cashRollsUsed??r.state.cashRolls)<r.state.cashLimit}));assert.equal(r.state.stage,'career','Native route leaves its accepted career before switching');
 }
 assert.equal(r.state.stage,'career');assert.equal(r.session.rulesRevision,RULES_REVISION);cache.set(key,structuredClone(r));return r;
}
export const nonhumanShellCases=[
 ...['aslan','vargr'].flatMap(species=>[{species,culture:'native',career:'companion.truther',assignment:'truther'},...['mainstream','missionary','warrior'].map(assignment=>({species,culture:'native',career:'companion.believer',assignment}))]),
 ...['aslan','vargr'].flatMap(species=>[{species,culture:'imperial',career:'core.army',assignment:'infantry'},{species,culture:'imperial',career:'core.navy',assignment:'crew'},{species,culture:'imperial',career:'core.drifter',assignment:'barbarian'}])
];
