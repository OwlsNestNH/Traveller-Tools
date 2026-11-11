// Presentation-only catalogue. Every supported outcome has six alternatives.
export const outcomeTaglines = Object.freeze({
 'statistics.low': Object.freeze([
  'The dice have selected “character development.”',
  'Your strongest attribute appears to be optimism.',
  'You brought a backstory to a stat fight.',
  'Nobody can accuse you of min-maxing.',
  'The universe has supplied room for improvement.',
  'Have you considered a career behind someone larger?',
 ]),
 'statistics.high': Object.freeze([
  'Save some competence for the rest of the crew.',
  'The recruitment poster just became a person.',
  'Your dump stat appears to be modesty.',
  'Did you bribe the dice, or are you related?',
  'Somewhere, a referee is adding another turret.',
  'Your character sheet may need a smugness warning.',
 ]),
});

export function outcomeTagline(outcome, actionId) {
 const lines=Object.hasOwn(outcomeTaglines,outcome)?outcomeTaglines[outcome]:null;
 if(!lines||typeof actionId!=='string'||!actionId)return null;
 // The GUI already assigns each action a crypto.randomUUID(), independently of
 // the seeded rules RNG. Domain-separated selection stays stable on rerender,
 // reload and import, without new saved fields or any generation RNG calls.
 let hash=2166136261;
 for(const char of 'outcome-tagline/v1/'+outcome+'/'+actionId)hash=Math.imul(hash^char.charCodeAt(0),16777619);
 return lines[(hash>>>0)%lines.length];
}

const distributionCache=new Map(),tailCache=new Map();
function dieDistribution(count,boon) {
 const key=count+':'+boon;
 if(distributionCache.has(key))return distributionCache.get(key);
 const frequencies=Array(count*6+1).fill(0);
 function enumerate(values) {
  if(values.length===count+Number(boon)){
   const total=values.reduce((a,b)=>a+b,0)-(boon?Math.min(...values):0);
   frequencies[total]++;return;
  }
  for(let value=1;value<=6;value++)enumerate([...values,value]);
 }
 enumerate([]);distributionCache.set(key,frequencies);return frequencies;
}

// Exact inclusive tails, each no more than 5% of this six-roll distribution.
// Supports the verified 1D/2D methods, with one extra die dropped for a boon.
// Integer weights remain exact: at most 18 dice, or 6^18 possible outcomes.
export function statisticsTailBounds(profiles) {
 if(!Array.isArray(profiles)||profiles.length!==6||profiles.some(p=>!p||![1,2].includes(p.count)||typeof p.boon!=='boolean'))return null;
 const key=profiles.map(p=>p.count+':'+p.boon).sort().join('/');
 if(tailCache.has(key))return tailCache.get(key);
 let frequencies=[1];
 for(const {count,boon} of profiles){
  const next=dieDistribution(count,boon),combined=Array(frequencies.length+next.length-1).fill(0);
  frequencies.forEach((weight,total)=>next.forEach((other,score)=>{combined[total+score]+=weight*other;}));
  frequencies=combined;
 }
 const weight=frequencies.reduce((a,b)=>a+b,0);
 let low=null,high=null,cumulative=0;
 for(let score=0;score<frequencies.length;score++){
  cumulative+=frequencies[score];
  if(cumulative&&cumulative*20<=weight)low=score;
 }
 cumulative=0;
 for(let score=frequencies.length-1;score>=0;score--){
  cumulative+=frequencies[score];
  if(cumulative&&cumulative*20<=weight)high=score;
 }
 const bounds=Object.freeze({low,high});tailCache.set(key,bounds);return bounds;
}

export function statisticsTotalOutcome(event,state) {
 if(state?.stage!=='statistics'||event?.type!=='roll-statistics'||event.rolls?.length!==6||state.pool?.length!==6)return null;
 const profiles=[];let total=0;
 for(let i=0;i<6;i++){
  const roll=event.rolls[i],score=state.pool[i];
  if(!roll||!score||roll.label!==score.key||score.physicalDiceEntered||score.finalOverride!==undefined||![1,2].includes(score.count)||typeof score.boon!=='boolean')return null;
  if(!Array.isArray(roll.values)||roll.values.length!==score.count+Number(score.boon)||roll.values.some(v=>!Number.isInteger(v)||v<1||v>6))return null;
  const kept=score.boon?[...roll.values].sort((a,b)=>b-a).slice(0,score.count):roll.values;
  const sum=kept.reduce((a,b)=>a+b,0);
  if(JSON.stringify(kept)!==JSON.stringify(roll.kept)||sum!==roll.total||sum!==score.base)return null;
  total+=sum;profiles.push({count:score.count,boon:score.boon});
 }
 if(new Set(event.rolls.map(r=>r.label)).size!==6||total!==state.rollTotal)return null;
 const bounds=statisticsTailBounds(profiles);
 return total<=bounds.low?'statistics.low':total>=bounds.high?'statistics.high':null;
}

export function statisticsTagline(event,state) {
 return outcomeTagline(statisticsTotalOutcome(event,state),event?.id);
}
