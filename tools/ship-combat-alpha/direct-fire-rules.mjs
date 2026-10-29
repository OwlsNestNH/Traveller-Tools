// Core Rulebook Update 2022 pp.63,166–171. Pure arithmetic, no dice source or I/O.
const whole=(v,label,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error('Invalid '+label+'.');return v;};
export function diceTotal(dice,count){if(!Array.isArray(dice)||dice.length!==count)throw Error('Incorrect dice count.');return Array.from(dice,d=>whole(d,'die',1,6)).reduce((a,b)=>a+b,0);}
export function taskChain(effect){whole(effect,'task Effect',-100,100);return effect<=-6?-3:effect<=-2?-2:effect<0?-1:effect===0?1:effect<=5?2:3;}
export const LASERS=Object.freeze({'Beam laser':Object.freeze({dice:1,attack:4,maxRange:'Medium'}),'Pulse laser':Object.freeze({dice:2,attack:2,maxRange:'Long'})});
export function laserAttack({weapon,count,range,gunner,other=0,evasion=0,evade=0,fireControl=0,aid=0,targetTons,attackDice,damageDice,armour,sand=0}){
 const w=LASERS[weapon];if(!w)throw Error('Unsupported automatic weapon.');whole(count,'linked weapon count',1,4);
 const bands=['Short','Medium','Long','Very Long','Distant'];if(!bands.includes(range)||bands.indexOf(range)>bands.indexOf(w.maxRange))throw Error('Laser target outside supported range.');
 for(const [label,v]of Object.entries({gunner,other,aid}))whole(v,label,-30,40);
 for(const [label,v]of Object.entries({evasion,evade,fireControl}))whole(v,label,0,10);
 whole(armour,'armour',0,1000);whole(sand,'sand protection',0,1000);if(!Number.isFinite(targetTons)||targetTons<=0)throw Error('Unknown target displacement.');
 const modifiers={gunner,other,weapon:w.attack,range:range==='Short'?1:range==='Long'?-2:0,size:Math.min(6,Math.floor(targetTons/1000)),evasion:-evasion||0,evade:-evade||0,fireControl,aid};
 const attack=diceTotal(attackDice,2),total=attack+Object.values(modifiers).reduce((a,b)=>a+b,0),effect=total-8,hit=effect>=0;
 const rolled=hit?diceTotal(damageDice,w.dice):0;if(!hit&&damageDice.length)throw Error('A miss has no damage dice.');
 const linked=w.dice*(count-1),raw=hit?rolled+linked+effect:0,damage=Math.max(0,raw-armour-sand);
 return {attackDice:[...attackDice],damageDice:[...damageDice],modifiers,total,effect,hit,rolled,linked:hit?linked:0,raw,armour,sand,damage,critical:damage>0&&effect>=6?Math.min(6,effect-5):0};
}
export function sandProtection({dice,modifier,protectionDie,count=1}){whole(modifier,'sand gunner modifier',-30,40);whole(count,'linked sandcaster count',1,4);const effect=diceTotal(dice,2)+modifier-8;if(effect<0){if(protectionDie!=null)throw Error('Failed sand reaction has no protection die.');return {dice:[...dice],modifier,effect,protectionDie:null,protection:0};}const protection=whole(protectionDie,'sand die',1,6)+effect+count-1;return {dice:[...dice],modifier,effect,protectionDie,protection};}
export const CRITICAL_LOCATIONS=Object.freeze(['Sensors','Power Plant','Fuel','Weapon','Armour','Hull','Manoeuvre Drive','Cargo','Jump Drive','Crew','Bridge']);
export function criticalLocation(dice){return CRITICAL_LOCATIONS[diceTotal(dice,2)-2];}
export function criticalEscalation(current,incoming){whole(current,'current critical severity',0,6);whole(incoming,'incoming critical severity',1,6);return {previous:current,incoming,severity:Math.min(6,Math.max(incoming,current+1)),extraDice:current===6?6:0};}
// Integer comparisons avoid fractional threshold rounding (e.g. a 41-Hull ship).
export function sustainedThresholds(startingHull,previousDamage,newDamage){whole(startingHull,'starting hull',1,1000000);whole(previousDamage,'previous damage',0,1000000000);whole(newDamage,'new damage',0,1000000);return Math.floor((previousDamage+newDamage)*10/startingHull)-Math.floor(previousDamage*10/startingHull);}
