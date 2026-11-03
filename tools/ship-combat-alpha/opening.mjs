import {initiativeProfile,normalizeInitiativeProfile,openingInitiative,navalTacticsEffect} from './initiative.mjs';
const whole=(n,label,min,max)=>{if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(label+' must be a whole number from '+min+' to '+max+'.');return n;};
export function normalizeOpeningTactics(value){
 if(value==null)return null;
 if(value.version!==1||!['roll','fiat'].includes(value.kind))throw Error('Invalid saved Opening Tactics.');
 const profile=normalizeInitiativeProfile(value.profile),effect=whole(value.effect,'Tactics Effect',-100,100);let dice=null,modifier=null;
 if(value.kind==='roll'){
  modifier=whole(value.modifier,'Naval Tactics modifier',-30,40);
  if(!Array.isArray(value.dice)||value.dice.length!==2)throw Error('Two saved Tactics dice required.');
  dice=value.dice.map(n=>whole(n,'Tactics die',1,6));if(dice[0]+dice[1]+modifier-8!==effect)throw Error('Saved Tactics Effect disagrees with its dice.');
 }else if(value.dice!=null||value.modifier!=null)throw Error('GM Fiat Tactics cannot invent dice.');
 return {version:1,kind:value.kind,profile,dice,modifier,effect,...(value.gmEffect==null?{}:{gmEffect:whole(value.gmEffect,'GM Tactics Effect',-100,100)})};
}
export const effectiveTactics=record=>record.gmEffect??record.effect;
export function openingTactics(ship){
 if(ship.flight.openingTactics)return {...ship.flight.openingTactics,source:'opening'};
 const saved=ship.flight.initiativeRecord;
 if(saved)return {version:1,kind:saved.result.tacticsDice?'roll':'fiat',profile:saved.profile,dice:saved.result.tacticsDice,modifier:saved.result.tacticsModifier,effect:saved.result.tacticsEffect,source:'initiative'};
 if(ship.flight.initiative!=null)return {kind:'legacy',effect:null,source:'legacy'};
 return null;
}
export function recordOpeningTactics(ship,command){
 if(ship.flight.initiative!=null)throw Error('Initiative is already recorded; its saved Tactics are preserved.');
 const old=ship.flight.openingTactics;
 if(old){if(command.handling!=='fiat')throw Error('Tactics already saved; it cannot be rolled again.');return normalizeOpeningTactics({...old,gmEffect:whole(command.effect,'GM Tactics Effect',-100,100)});}
 const profile=initiativeProfile(ship);
 if(command.handling==='roll'){
  const result=navalTacticsEffect(command.modifier,command.dice);
  return normalizeOpeningTactics({version:1,kind:'roll',profile,dice:result.dice,modifier:result.modifier,effect:result.effect});
 }
 if(command.handling!=='fiat')throw Error('Choose a Tactics roll or GM Fiat.');
 return normalizeOpeningTactics({version:1,kind:'fiat',profile,dice:null,modifier:null,effect:command.effect});
}
export function openingInitiativeEntry(ship,{handling,pilot,baseDice,total,tie=ship.flight.tie}){
 whole(tie,'Tie order',-1000000,1000000);
 const saved=openingTactics(ship);if(!saved)throw Error('Save a Tactics roll or GM Fiat Effect first.');
 if(handling==='fiat')return {shipId:ship.id,initiative:whole(total,'GM Initiative',-1000000,1000000),tie,initiativeRecord:ship.flight.initiativeRecord??null};
 if(handling!=='roll')throw Error('Choose an Initiative roll or GM Fiat.');
 if(ship.flight.initiative!=null)throw Error('Initiative already saved; use a GM override rather than rerolling.');
 const profile=initiativeProfile(ship),useDice=saved.kind==='roll'&&saved.gmEffect==null;
 const result=openingInitiative({pilot,thrust:profile.thrust,baseDice,...(useDice?{tacticsDice:saved.dice,tacticsModifier:saved.modifier}:{recordedEffect:effectiveTactics(saved)})});
 return {shipId:ship.id,initiative:result.total,tie,initiativeRecord:{version:1,profile,result}};
}
export const openingReady=state=>state.ships.length>0&&state.ships.every(s=>s.flight.initiative!=null);
