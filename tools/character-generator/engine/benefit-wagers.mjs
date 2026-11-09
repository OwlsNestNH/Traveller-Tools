// Bounded current-career wagers. Future term/rank entitlements are not loans.
export const BENEFIT_WAGERS=Object.freeze({
 'merchant-event-5':{careerId:'core.merchant',source:{id:'core',page:35},skills:['Gambler','Broker'],half:true,train:true},
 'rogue-event-10':{careerId:'core.rogue',source:{id:'core',page:41},skills:['Gambler'],half:true},
 'manager-event-5':{careerId:'aslan.manager',source:{id:'aliens',page:29},skills:['Broker'],maximum:3}
});
export function wagerLimit(route,available){
 if(!BENEFIT_WAGERS[route]||!Number.isSafeInteger(available)||available<0)throw Error('Invalid current-career benefit balance.');
 return Math.min(available,BENEFIT_WAGERS[route].maximum??available);
}
export function wagerDelta(route,stake,success){return success?(BENEFIT_WAGERS[route].half?Math.ceil(stake/2):stake):-stake;}
