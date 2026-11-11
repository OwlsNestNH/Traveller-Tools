import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalog,createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
import {outcomeTaglines,outcomeTagline,statisticsTailBounds,statisticsTotalOutcome,statisticsTagline} from '../gui/outcome-taglines.mjs';
import {statisticsRollFeedbackView} from '../gui/characteristics-presentation.mjs';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const profiles=(counts,boons=0)=>counts.map((count,i)=>({count,boon:i<boons}));
const normal=[2,2,2,2,2,2],mixed=[1,2,1,2,1,1];

// Independent BigInt reference: explicitly enumerate each kept-score pair or
// triple, then multiply polynomials. Do not use production distribution code.
function referenceDistribution(methods){
 let totals=new Map([[0,1n]]);
 for(const {count,boon} of methods){
  const scores=[];
  for(let a=1;a<=6;a++)for(let b=1;b<=(count+Number(boon)>=2?6:1);b++)for(let c=1;c<=(count+Number(boon)===3?6:1);c++){
   scores.push(count===1?(boon?Math.max(a,b):a):boon?a+b+c-Math.min(a,b,c):a+b);
  }
  const next=new Map();
  for(const [total,weight] of totals)for(const score of scores)next.set(total+score,(next.get(total+score)??0n)+weight);
  totals=next;
 }
 return totals;
}

for(const counts of [normal,mixed])for(let boons=0;boons<=6;boons++)test('exact 5% tail boundaries: '+counts+'/'+boons+' boons',()=>{
 const methods=profiles(counts,boons),bounds=statisticsTailBounds(methods),reference=referenceDistribution(methods);
 const weight=[...reference.values()].reduce((a,b)=>a+b,0n);
 const low=[...reference].filter(([score])=>score<=bounds.low).reduce((a,[,b])=>a+b,0n);
 const high=[...reference].filter(([score])=>score>=bounds.high).reduce((a,[,b])=>a+b,0n);
 assert.ok(low>0n&&low*20n<=weight);
 assert.ok((low+reference.get(bounds.low+1))*20n>weight);
 assert.ok(high>0n&&high*20n<=weight);
 assert.ok((high+reference.get(bounds.high-1))*20n>weight);
 assert.deepEqual(statisticsTailBounds([...methods].reverse()),bounds);
 if(counts===normal)assert.deepEqual(bounds,[{low:31,high:53},{low:33,high:54},{low:34,high:55},{low:36,high:57},{low:37,high:58},{low:39,high:59},{low:41,high:60}][boons]);
 if(counts===mixed&&boons===0)assert.deepEqual(bounds,{low:19,high:37});
});

test('unsupported dice profiles fail closed',()=>{
 for(const invalid of [undefined,[],profiles([3,2,2,2,2,2]),profiles(normal).map(p=>({...p,boon:1}))])assert.equal(statisticsTailBounds(invalid),null);
});

test('each outcome has six distinct lines, selected independently from the rules RNG',()=>{
 for(const [outcome,lines] of Object.entries(outcomeTaglines)){
  assert.equal(lines.length,6);assert.equal(new Set(lines).size,6);
  const selected=new Set(Array.from({length:100},(_,i)=>outcomeTagline(outcome,'independent-action-id-'+i)));
  assert.deepEqual([...selected].sort(),[...lines].sort());
  assert.equal(outcomeTagline(outcome,'fixed-action'),outcomeTagline(outcome,'fixed-action'));
 }
 for(const unknown of ['unclassified','constructor','__proto__','toString'])assert.equal(outcomeTagline(unknown,'fixed-action'),null);
 assert.equal(outcomeTagline('statistics.low',undefined),null);
 const source=readFileSync(new URL('../gui/outcome-taglines.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/import .*engine|state\.rng|Math\.random|localStorage|sessionStorage/);
 assert.match(readFileSync(new URL('../gui/app.mjs',import.meta.url),'utf8'),/id:crypto\.randomUUID\(\)/);
});

function rolled(species='human',config={},seed='tagline-fixture',id='random-presentation-action'){
 let session=createSession(seed);
 session=execute(session,{type:'configure',payload:config}).session;
 session=execute(session,{type:'setup',payload:{species,...(species==='aslan'?{gender:'male'}:{})}}).session;
 return execute(session,{type:'roll-statistics'},{id});
}

function atTotal(result,total){
 const {state,log}=structuredClone(result),event=log.at(-1);
 let remaining=total-state.pool.reduce((sum,p)=>sum+p.count,0);
 state.pool.forEach((score,i)=>{
  const kept=Array.from({length:score.count},()=>{const extra=Math.min(5,remaining);remaining-=extra;return 1+extra;});
  const values=score.boon?[...kept,1]:kept;
  score.base=kept.reduce((a,b)=>a+b,0);
  Object.assign(event.rolls[i],{values,kept,total:score.base});
 });
 assert.equal(remaining,0);state.rollTotal=total;
 return {state,event};
}

for(const species of ['human','aslan','vargr','aezorgh'])for(const boons of [0,1,3,6])for(const alternative of species==='aezorgh'?[false,true]:[false])test('thresholds use recorded dice, not species modifiers, extras or reroll cutoff: '+[species,boons,alternative],()=>{
 const result=rolled(species,{boons,aezorghTwoDice:alternative,extras:['PSI','CHA','LCK','MRL','STY','WLT'],minimumTotal:72});
 const bounds=statisticsTailBounds(result.state.pool);
 assert.deepEqual(result.state.pool.map(p=>p.count),species==='aezorgh'&&!alternative?mixed:normal);
 for(const [total,expected] of [[bounds.low,'statistics.low'],[bounds.low+1,null],[bounds.high-1,null],[bounds.high,'statistics.high']]){
  const {event,state}=atTotal(result,total);
  assert.equal(statisticsTotalOutcome(event,state),expected);
  state.config.boons=6-boons;state.config.minimumTotal=12;state.character.stats.PSI=100;
  state.pool.forEach(p=>{p.value=99;p.adjustment=90;});
  assert.equal(statisticsTotalOutcome(event,state),expected,'presentation uses actual raw dice, not current settings or final scores');
 }
});

test('manual, incomplete, mismatched, replaced and non-roll results remain factual only',()=>{
 const fixture=atTotal(rolled(),24);
 const mutations=[
  f=>f.state.stage='background',f=>f.event.type='swap-statistics',f=>f.event.type='gm-replay',f=>f.event.type='gm-override',f=>f.event.type='restore',f=>f.event.type='physical-dice',
  f=>f.state.pool.pop(),f=>f.event.rolls.pop(),f=>f.event.rolls.push({...f.event.rolls[0],label:'PSI'}),
  f=>f.state.pool[0].physicalDiceEntered=true,f=>f.state.pool[0].finalOverride=12,f=>f.state.pool[0].base=null,
  f=>f.state.pool[0].count=3,f=>delete f.state.pool[0].boon,f=>f.event.rolls[0].values[0]=0,
  f=>f.event.rolls[0].total++,f=>f.event.rolls[0].kept=[1,1],f=>f.event.rolls[0].label='PSI',f=>f.state.rollTotal++,
 ];
 for(const mutate of mutations){const f=structuredClone(fixture);mutate(f);assert.equal(statisticsTagline(f.event,f.state),null,String(mutate));}
});

test('rendering is stable across replay, reload and import; saved bytes, RNG and next results are unchanged',()=>{
 let result;
 for(let i=0;i<1000;i++){result=rolled('human',{},'tagline-rare-'+i);if(statisticsTagline(result.log.at(-1),result.state))break;}
 const raw=exportSession(result.session),projection=JSON.stringify(project(result.session)),rng=result.state.rng;
 const event=result.log.at(-1),expected=statisticsRollFeedbackView(event,result.state,{esc});
 assert.match(expected,/class="outcome-tagline"/);assert.match(expected,/Six characteristics rolled\./);
 assert.match(expected,/aria-label="Latest result"/);assert.match(expected,/Roll details/);
 assert.doesNotMatch(expected,/role="alert"|aria-live|tabindex|<dialog/);
 for(let i=0;i<20;i++)assert.equal(statisticsRollFeedbackView(event,result.state,{esc}),expected);
 for(const session of [structuredClone(result.session),importSession(raw)]){
  const p=project(session);assert.equal(statisticsRollFeedbackView(p.log.at(-1),p.state,{esc}),expected);
 }
 assert.equal(exportSession(result.session),raw);assert.equal(JSON.stringify(project(result.session)),projection);assert.equal(result.state.rng,rng);
 const command={type:'accept-statistics'};
 assert.deepEqual(execute(result.session,command),execute(importSession(raw),command));
 const swapped=execute(result.session,{type:'swap-statistics',payload:{a:0,b:1}});
 assert.equal(statisticsTagline(swapped.log.at(-1),swapped.state),null);
});

test('all supported released species have only verified one/two-die pools',()=>{
 for(const species of catalog().species.filter(s=>s.id!=='zhodani')){
  const result=rolled(species.id);assert.notEqual(statisticsTailBounds(result.state.pool),null);
 }
});
