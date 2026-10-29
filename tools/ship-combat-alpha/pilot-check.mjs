import {combatCrew} from './direct-fire-profile.mjs';
import {dutyPenalty} from './crew-duty.mjs';
import {normalizeCrew,crewContribution,crewSkill,normalizeSituational} from './setup.mjs';
import {assignedSkill} from './crew-roster.mjs';

export const PILOT_DIFFICULTIES=Object.freeze([4,6,8,10,12,14]);
// Core Rulebook Update 2022, printed pp. 60–61: generic 2D task check.
// This does not resolve docking, task chains, evasive reactions or combat effects.
export function pilotCheckProfile(ship){
 const duty=ship.crewDuty?dutyPenalty(ship,'pilot'):{available:true,penalty:0};
 if(ship.crewDuty?.moves.length){const p=combatCrew(ship,'pilot');return {name:'Combat duty',level:p.skill,other:p.breakdown?.other??null,situational:ship.situational.pilot,total:p.modifier==null?null:p.modifier+ship.situational.pilot,detailed:!p.simple};}
 const crew=normalizeCrew(ship.crew),contribution=crewContribution(crew,'pilot'),actual=crewSkill(crew,'pilot'),detail=actual==null?null:crew.details.pilot,situational=normalizeSituational(ship.situational).pilot;
 const recorded=detail?assignedSkill(crew,'pilot'):null;
 return {name:detail?.name??'',level:actual??contribution,other:recorded?.stat!=null?recorded.other:detail?.characteristicDM??null,...(recorded?.stat==null?{}:{stat:recorded.stat}),situational,total:contribution==null||!duty.available?null:contribution+situational+duty.penalty,detailed:!!detail};
}
export function resolvePilotCheck(profile,difficulty,dice){
 if(!PILOT_DIFFICULTIES.includes(difficulty))throw Error('Choose a Pilot difficulty.');
 if(!Number.isSafeInteger(profile.total))throw Error('Record a Pilot contribution first.');
 if(!Array.isArray(dice)||dice.length!==2||dice.some(d=>!Number.isSafeInteger(d)||d<1||d>6))throw Error('Roll two six-sided dice.');
 const total=dice[0]+dice[1]+profile.total;
 return {dice:[...dice],modifier:profile.total,difficulty,total,effect:total-difficulty};
}
export function rollPilotDice(random=Math.random){return [0,1].map(()=>{const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw Error('Dice source unavailable.');return 1+Math.floor(n*6);});}
