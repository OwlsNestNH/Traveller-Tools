// Combat duty is separate from setup assignments and immutable critical history.
// Core 2022 pp.171–172; the extra full round in transit is the adopted home rule.
export const DUTIES=Object.freeze(['captain','pilot','astrogator','sensors','comms','engineer','gunner','medic','steward']);
export const isDuty=r=>DUTIES.includes(r)||/^mount:[-a-z0-9]{1,32}$/.test(r);
export const shipDuties=ship=>[...DUTIES,...new Set([...(ship.crew.gunnerStations??[]).map(s=>'mount:'+s.mountId),...Object.keys(ship.crew.roster?.assignments??{}).filter(k=>k.startsWith('mount:'))])];
const bridge=new Set(['captain','pilot','astrogator','sensors','engineer']);
const whole=(v,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error('Invalid crew duty number.');return v;};
const operator=v=>{if(typeof v!=='string'||! /^(?:member:[-a-z0-9]{1,40}|station:(?:mount:)?[-a-z0-9]{1,32})$/.test(v))throw Error('Invalid crew operator identity.');return v;};
const text=(v,max=300)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Enter a crew action description.');return v.trim();};
export function freshDuty(round){return {version:1,round,actions:[],moves:[],repairReviews:[]};}
export function normalizeDuty(v){
 if(v==null)return null;
 if(v.version!==1||!Array.isArray(v.actions)||!Array.isArray(v.moves)||v.actions.length>4096||v.moves.length>1024)throw Error('Invalid crew duty ledger.');
 const round=whole(v.round,0,1000001),actions=v.actions.map(a=>{
  if(!isDuty(a.role)||!['manual','roll','repair','move','ew'].includes(a.kind))throw Error('Invalid crew action.');
  const row={round:whole(a.round,0,round),role:a.role,operator:operator(a.operator),kind:a.kind,note:text(a.note),id:text(a.id,120)};
  if(a.roll){const r=a.roll,dice=r.dice;if(!Array.isArray(dice)||dice.length!==2||dice.some(d=>!Number.isInteger(d)||d<1||d>6))throw Error('Invalid crew dice.');const modifier=whole(r.modifier,-100,100),difficulty=whole(r.difficulty,2,20),total=dice[0]+dice[1]+modifier;if(r.total!==total||r.effect!==total-difficulty)throw Error('Crew roll breakdown mismatch.');row.roll={dice:[...dice],modifier,difficulty,total,effect:total-difficulty,source:text(r.source)};}
  if(a.repair){const r=a.repair;row.repair={eventId:text(r.eventId,120),location:text(r.location,60),severity:whole(r.severity,1,6),effort:whole(r.effort,0,100),roundMinutes:whole(r.roundMinutes,1,60),durationDie:r.durationDie==null?null:whole(r.durationDie,1,6),expiresRound:r.expiresRound==null?null:whole(r.expiresRound,row.round+1,1001000)};if(!row.roll||((row.roll.effect>=0)!==(row.repair.durationDie!=null)))throw Error('Repair duration does not match result.');if(row.repair.durationDie!=null&&row.repair.expiresRound!==row.round+Math.ceil(row.repair.durationDie*60/row.repair.roundMinutes))throw Error('Repair expiry disagrees with recorded duration.');}
  if((a.kind==='roll'||a.kind==='repair')!==!!row.roll||(a.kind==='repair')!==!!row.repair)throw Error('Crew action is missing its roll or repair record.');
  return row;
 });
 const moves=v.moves.map(m=>{if(!isDuty(m.from)||!isDuty(m.to)||!isDuty(m.origin??m.from)||m.from===m.to)throw Error('Choose different crew duties.');const chosenRound=whole(m.chosenRound,0,round);return {id:text(m.id,120),from:m.from,to:m.to,operator:operator(m.operator),chosenRound,availableRound:chosenRound+2,origin:m.origin??m.from,skillId:m.skillId==null?null:text(m.skillId,40)};});
 if(new Set(actions.map(a=>a.id)).size!==actions.length||new Set(moves.map(m=>m.id)).size!==moves.length)throw Error('Duplicate crew record.');
 for(const a of actions)if(a.kind==='move'&&!moves.some(m=>m.id===a.id))throw Error('Committed crew move is missing.');
 for(const m of moves)if(!actions.some(a=>a.id===m.id&&a.kind==='move'&&a.round===m.chosenRound&&a.operator===m.operator&&a.role===m.from))throw Error('Reassignment is missing its committed action.');
 for(let i=0;i<actions.length;i++){const a=actions[i],used=actions.slice(0,i).filter(x=>x.round===a.round&&x.operator===a.operator);if(used.some(x=>x.role===a.role||x.kind==='move')||used.length>=2||used.length&&a.kind==='move'||used.length&&!(used[0].role==='comms'||a.role==='comms'))throw Error('Duplicate operator action in crew ledger.');}
 const repairReviews=(v.repairReviews??[]).map(r=>{const a=actions.find(a=>a.id===r.actionId&&a.repair?.durationDie);if(!a)throw Error('Unknown temporary repair review.');return {actionId:a.id,note:text(r.note)};});if(new Set(repairReviews.map(r=>r.actionId)).size!==repairReviews.length)throw Error('Duplicate repair expiry review.');
 return {version:1,round,actions,moves,repairReviews};
}
function baseAssignment(ship,role){const a=ship.crew.roster?.assignments?.[role];return {operator:a?'member:'+a.memberId:'station:'+role,skillId:a?.skillId??null,origin:role};}
export function dutyAssignment(ship,role,round=ship.crewDuty?.round??0){
 let found=baseAssignment(ship,role);
 for(const m of ship.crewDuty?.moves??[]){
  if(m.chosenRound>=round)continue;
  if(found?.operator===m.operator)found=null;
  if(m.to===role&&round>=m.availableRound)found={operator:m.operator,skillId:m.skillId,origin:m.origin??m.from,moved:true};
 }
 return found;
}
export function dutyPenalty(ship,role){const a=dutyAssignment(ship,role);if(!a)return {available:false,penalty:0,reason:'Station vacant or operator changing position.'};const roles=shipDuties(ship).filter(r=>dutyAssignment(ship,r)?.operator===a.operator);if(roles.length<2)return {available:true,penalty:0};if(roles.length!==2||!roles.includes('comms')||!bridge.has(roles.find(r=>r!=='comms')))return {available:false,penalty:0,reason:'One operator cannot serve these simultaneous duties. Reassign the crew.'};return {available:true,penalty:roles.some(r=>r==='captain'||r==='sensors')?0:-2};}
export function actionIssue(ship,role){
 const p=dutyPenalty(ship,role);if(!p.available)return p.reason;
 const a=dutyAssignment(ship,role),used=(ship.crewDuty?.actions??[]).filter(x=>x.round===ship.crewDuty.round&&x.operator===a.operator);
 if(used.some(x=>x.role===role||x.kind==='move')||used.length>=2)return 'This operator’s action is already committed.';
 if(used.length&&!(used[0].role==='comms'||role==='comms'))return 'This operator already acted at another station.';
 return null;
}
export function dutySkill(ship,role,skillId=null){
 const a=dutyAssignment(ship,role);if(!a)return null;
 if(a.operator.startsWith('member:')){const m=ship.crew.roster?.members.find(m=>'member:'+m.id===a.operator);return m?.skills.find(s=>s.id===(skillId??a.skillId))??null;}
 return null;
}
export function commitDutyAction(ship,{role,kind,note,roll,repair,to,skillId},round){
 if(!isDuty(role))throw Error('Choose a crew station.');ship.crewDuty??=freshDuty(round);ship.crewDuty.round=round;
 const issue=actionIssue(ship,role);if(issue)throw Error(issue);
 const operator=dutyAssignment(ship,role).operator,id='crew:'+round+':'+ship.crewDuty.actions.length;
 if(kind==='move'){
  if(!isDuty(to)||to===role)throw Error('Choose a different destination station.');
  if(ship.crewDuty.moves.some(m=>m.chosenRound===round&&(m.operator===operator||m.to===to)))throw Error('Operator or destination already has a pending move.');
  if(operator.startsWith('member:')&&!dutySkill(ship,role,skillId))throw Error('Choose a recorded skill for the new duty.');
  ship.crewDuty.moves.push({id,from:role,to,operator,chosenRound:round,availableRound:round+2,origin:dutyAssignment(ship,role).origin,skillId:skillId??null});
 }
 ship.crewDuty.actions.push({id,round,role,operator,kind,note,...(roll?{roll}:{}),...(repair?{repair}:{})});
 ship.crewDuty=normalizeDuty(ship.crewDuty);return ship.crewDuty.actions.at(-1);
}

export function expiredRepairs(ship,completedRound){return (ship.crewDuty?.actions??[]).filter(a=>a.repair?.expiresRound!=null&&completedRound>=a.repair.expiresRound&&!ship.crewDuty.repairReviews.some(r=>r.actionId===a.id));}
