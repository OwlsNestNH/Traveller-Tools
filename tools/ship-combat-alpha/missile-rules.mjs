import {diceTotal} from './direct-fire-rules.mjs';
import {distanceSpaces} from './movement-rules.mjs';
export const STANDARD_MISSILE=Object.freeze({type:'Standard',tl:7,thrust:10,dice:4,endurance:10});
export const missileSpeed=velocity=>Math.round(distanceSpaces(velocity,{q:0,r:0}));
// Companion2024 pp175–176: scalar pursuit, not retained directional vectors.
// Continuous axial positions keep the Euclidean travel budget exact (UI policy).
export function pursue(position,target,speed){const distance=distanceSpaces(position,target);if(distance<=speed)return {...target};const f=speed/distance;return {q:position.q+(target.q-position.q)*f,r:position.r+(target.r-position.r)*f};}
export function detectMissiles({dice,modifier,count,launch=false,launcherKnown=false}){const target=launch&&launcherKnown?6:8,bonus=launch?Math.min(6,Math.floor(count/10)):0,total=diceTotal(dice,2)+modifier+bonus;return {dice:[...dice],modifier,bonus,target,total,effect:total-target,detected:total>=target};}
export function missileCheck({dice,count,launcherTL,targetTL,smart=true,distant=false,evasion=0,evade=0,targetTons=0}){const smartDM=smart?Math.max(1,Math.min(6,launcherTL-targetTL)):0,modifiers={missiles:count,smart:smartDM,distant:distant?-2:0,evasion:-evasion||0,evade:-evade||0,size:Math.min(6,Math.floor(targetTons/1000))},total=diceTotal(dice,2)+Object.values(modifiers).reduce((a,b)=>a+b,0);return {dice:[...dice],modifiers,total,effect:total-8,hits:Math.max(0,Math.min(count,total-8))};}
export function missileDamage(dice,armour,hits){const raw=diceTotal(dice,4);return {dice:[...dice],raw,armour,hits,damage:Math.max(0,raw-armour)*hits};}
export function pointDefense({dice,modifier,lasers,count}){const linked=lasers-1,total=diceTotal(dice,2)+modifier+linked,effect=total-8;return {dice:[...dice],modifier,linked,total,effect,removed:Math.min(count,Math.max(0,effect))};}
