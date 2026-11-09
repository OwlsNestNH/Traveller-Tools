// Original procedural data: Aliens of Charted Space Volume 1 Update 2026 p. 265;
// Traveller Core Rulebook Update 2022 p. 46; Traveller Companion 2024 p. 4.
// Service-only and immediate timing follow the user's table ruling.
export const ADVISORY_SOURCE=Object.freeze({id:'aliens',page:265});
function need(value,message){if(!value)throw new Error(message);}
export function advisoryCashPlan({die,cashTable,gambler=false,cashRolls,limit=3,wealth,allowExtra=false,creditModifier=0}={}){
 need(Number.isInteger(cashRolls)&&cashRolls>=0,'A non-negative lifetime cash-roll count is required.');
 need(Number.isInteger(limit)&&limit>=0,'A cash-roll limit is required.');
 need(typeof gambler==='boolean'&&typeof allowExtra==='boolean','Cash options must be boolean.');
 if(cashRolls>=limit&&!allowExtra)return {blocked:true,reason:'The lifetime cash-roll limit has been reached.',cashRolls,limit};
 need(Number.isInteger(die)&&die>=1&&die<=6,'The cash benefit requires one supplied die from 1 to 6.');
 need(Array.isArray(cashTable)&&cashTable.length===7&&cashTable.every(n=>Number.isInteger(n)&&n>=0),'The chosen career cash table is required.');
 need(wealth===undefined||Number.isInteger(wealth)&&wealth>=0&&wealth<=40,'Wealth must be a valid characteristic.');
 need(Number.isInteger(creditModifier)&&creditModifier>=0&&creditModifier<=100,'Selected benefit-credit modifier is invalid.');
 const modifier=(gambler?1:0)+creditModifier,result=die+modifier;
 return {blocked:false,die,modifier,result,amount:result<=7?cashTable[result-1]:null,needsAdjudication:result>7,cashRollsBefore:cashRolls,cashRollsAfter:cashRolls+1,limit,
  wealthBefore:wealth??null,wealthAfter:wealth===undefined?null:Math.min(15,wealth+1),capException:cashRolls>=limit,source:{id:'core',page:46}};
}
