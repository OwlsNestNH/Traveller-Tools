import {validateJumpAttempts,currentJumpAttempt,lastJump,savedJumpAttempt,departureKey,jumpPreparationBridge} from './jump-attempts.mjs';
import {distance as jumpDistance} from './map.mjs?v=map-overview-1';
import {validateMailHistory} from './mail-history.mjs?v=mail-history-1';
import {bladderSpace,validateFuel,fuelPurchase,consumeJumpFuel} from './fuel.mjs?v=bladder-stock-1';
import {validateSupport,refillQuote,consumeSupport,anchorSupport,supportCargo,supportAmount,supportReference,extraSupportReference} from './life-support.mjs?v=mfd-services-1';
import {up,creditStep,roundExisting} from './rounding.mjs';
import {validateAccommodation,passengerLuggage,roomCounts} from './accommodation.mjs?v=passenger-input-3';
import {add,sub,mul,div,cmp,floor,sum,decimal,credit} from './amounts.mjs';
import {VERSION,priceLimits} from './rules.mjs?v=price-limits-1';
import {expenseQuote,starport,berthMultipliers,payableExpenses} from './expenses.mjs?v=mfd-services-1';
export const SCHEMA=1;
export const uid=()=>crypto.randomUUID();
export function initial(){return {schema:SCHEMA,revision:0,rulesVersion:VERSION,initialized:false,name:'My trading campaign',bank:'0',hours:0,dateLabel:'001-1105',ship:{name:'Independent trader',capacity:'60',staterooms:0,jump:2,scoops:true,armed:false},trader:{broker:0,streetwise:0,admin:0,characteristic:0,rank:0,soc:0},settings:{reducedProfitLimitsEnabled:false,minPurchasePercent:85,maxSalePercent:115,profit:100,tax:false,insurance:false,creditStep:1,maxBaseRetailEnabled:false,maxBaseRetail:'100000',useRawIllegalPrices:false},worlds:{},actual:null,route:[],routeIndex:0,snapshots:[],lots:[],contracts:[],policies:[],ledger:[],cooldowns:{},undo:[],events:[],jumpAttempts:[],latestMailCheckId:null};}
export function used(state){return sum([bladderSpace(state.ship),supportCargo(state.ship),passengerLuggage(state.ship),...state.lots.map(l=>l.quantity),...state.contracts.filter(c=>c.status==='accepted').map(c=>c.quantity)]);}
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_,.:-]{1,100}$/.test(x);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function validateStructure(s){
 if(!record(s))throw Error('Invalid campaign record');
 for(const key of ['ship','trader','settings','worlds','cooldowns'])if(!record(s[key]))throw Error('Invalid campaign '+key);
 if(!Array.isArray(s.route)||!Number.isSafeInteger(s.routeIndex)||s.routeIndex<0||s.routeIndex>=Math.max(1,s.route.length))throw Error('Invalid route progress');
 if(s.route.some(id=>!validId(id)||!Object.hasOwn(s.worlds,id)))throw Error('Route world missing');
 for(const hours of Object.values(s.cooldowns))if(!Number.isSafeInteger(hours)||hours<0)throw Error('Invalid counterparty cooldown');
 if(!Array.isArray(s.policies)||!Array.isArray(s.undo))throw Error('Invalid campaign policies or undo');
 for(const policy of s.policies){
  if(!record(policy))throw Error('Invalid policy');
  if(policy.route!==undefined&&(!Array.isArray(policy.route)||policy.route.some(id=>!validId(id)||!Object.hasOwn(s.worlds,id))))throw Error('Invalid policy route');
  if(policy.amendments!==undefined&&!Array.isArray(policy.amendments))throw Error('Invalid policy amendments');
 }
 for(const entry of s.undo){
  if(!record(entry)||typeof entry.label!=='string'||!Array.isArray(entry.inverse))throw Error('Invalid undo record');
  for(const op of entry.inverse){
   if(!record(op)||!Array.isArray(op.path)||!op.path.length||op.path[0]==='jumpAttempts'||op.path.some(key=>!(typeof key==='string'&&key.length>0||Number.isSafeInteger(key)&&key>=0)||['__proto__','constructor','prototype'].includes(key)))throw Error('Invalid undo path');
   if(op.remove!==undefined&&op.remove!==true||op.insert!==undefined&&op.insert!==true||op.remove&&op.insert||op.remove&&Object.hasOwn(op,'value')||!op.remove&&(!Object.hasOwn(op,'value')||op.value===undefined))throw Error('Invalid undo operation');
  }
 }
}
function validateMailLifecycle(s,c){
 if(c.acceptanceEventId!==undefined&&(c.kind!=='mail'||!validId(c.acceptanceEventId)))throw Error('Invalid mail acceptance record');
 if(Object.hasOwn(c,'firstDeparture')){
  const d=c.firstDeparture;
  if(c.kind!=='mail'||d!==null&&(!record(d)||!validId(d.eventId)||!s.worlds[d.from]||!s.worlds[d.to]||!Number.isSafeInteger(d.hours)||d.hours<0||!Number.isSafeInteger(d.revision)||d.revision<1||d.priorHistoryUnverified!==undefined&&typeof d.priorHistoryUnverified!=='boolean'))throw Error('Invalid mail departure record');
 }
 if(c.status==='cancelled'){
  if(c.kind!=='mail'||c.firstDeparture!==null||!Number.isSafeInteger(c.cancelledHours)||c.cancelledHours<0||!record(c.cancellation)||!s.worlds[c.cancellation.world]||!Number.isSafeInteger(c.cancellation.revision)||c.cancellation.revision<1||!['recorded','legacy-undo'].includes(c.cancellation.source)||['payout','deliveredHours','late','penaltyDie'].some(key=>Object.hasOwn(c,key)))throw Error('Invalid mail cancellation record');
 }else if(Object.hasOwn(c,'cancellation')||Object.hasOwn(c,'cancelledHours'))throw Error('Unexpected mail cancellation record');
}
export function validate(s){validateStructure(s);validateJumpAttempts(s);if(!s||s.schema!==SCHEMA||s.rulesVersion!==VERSION||!Number.isSafeInteger(s.revision)||s.revision<0)throw Error('Unsupported or invalid campaign format.');for(const key of ['lots','contracts','policies','ledger','snapshots','undo','events','route'])if(!Array.isArray(s[key]))throw Error('Missing campaign '+key);for(const key of ['lots','contracts','policies','ledger','snapshots','events']){const seen=new Set();for(const item of s[key]){if(!validId(item.id)||seen.has(item.id))throw Error('Invalid or duplicate '+key+' ID');seen.add(item.id);}}if(!s.ship||!s.trader||!s.settings||!s.worlds||!s.cooldowns)throw Error('Incomplete campaign');credit(s.bank);validateFuel(s.ship);validateSupport(s.ship);validateAccommodation(s.ship);if(s.ship?.staterooms!==undefined&&(!Number.isSafeInteger(s.ship.staterooms)||s.ship.staterooms<0))throw Error('Staterooms must be a non-negative whole number.');for(const [id,w]of Object.entries(s.worlds)){if(!w||id!==w.id||id!==w.x+','+w.y||!Number.isSafeInteger(w.x)||!Number.isSafeInteger(w.y)||!['Safe','Amber','Red'].includes(w.zone)||typeof w.name!=='string'||typeof w.uwp!=='string'||typeof w.sector!=='string'||!/^\d{4}$/.test(w.hex))throw Error('Invalid world record');}if(s.initialized&&!s.actual)throw Error('Initialized campaign has no actual world');for(const k of ['broker','streetwise','admin','characteristic','rank','soc'])if(!Number.isInteger(s.trader[k]))throw Error('Invalid trader input');if(cmp(s.ship.capacity,0)<0||!Number.isInteger(s.ship.jump)||s.ship.jump<1||s.ship.jump>6)throw Error('Invalid ship capacity or jump rating');if(!Number.isSafeInteger(s.hours)||s.hours<0)throw Error('Invalid campaign hours');if(!Number.isFinite(s.settings.profit)||s.settings.profit<0||s.settings.profit>100)throw Error('Invalid profit setting');Object.assign(s.settings,priceLimits(s.settings));if(typeof s.settings.maxBaseRetailEnabled!=='boolean')s.settings.maxBaseRetailEnabled=false;if(s.settings.maxBaseRetail===undefined)s.settings.maxBaseRetail='100000';if(!Number.isFinite(Number(s.settings.maxBaseRetail))||Number(s.settings.maxBaseRetail)<=0)throw Error('Invalid maximum base retail setting');if(typeof s.settings.useRawIllegalPrices!=='boolean')s.settings.useRawIllegalPrices=false;if(s.actual&&!s.worlds[s.actual])throw Error('Actual world missing');const ids=new Set();for(const l of s.lots){if(!validId(l.id)||!(/^[1-6][1-6]$/).test(l.commodity)||typeof l.description!=='string'||ids.has(l.id)||cmp(l.quantity,0)<=0||credit(l.basis)<0n||credit(l.goodsValue)<0n)throw Error('Invalid cargo lot');ids.add(l.id);}for(const p of s.policies){if(!p.id||!Array.isArray(p.claims)||cmp(p.remainingQuantity,0)<0||credit(p.remainingValue)<0n||cmp(p.initialQuantity,0)<=0||cmp(p.insuredValue,0)<0||!Number.isFinite(p.coverage)||p.coverage<20||p.coverage>100)throw Error('Invalid policy');if(cmp(p.remainingQuantity,0)>0&&!ids.has(p.lotId))throw Error('Active policy has no cargo');const insuredLot=s.lots.find(l=>l.id===p.lotId);if(insuredLot&&cmp(p.remainingQuantity,insuredLot.quantity)>0)throw Error('Policy exceeds remaining cargo');if(![20,30,40,50,60,70,80,90,100].includes(p.coverage)||!['active','closed','arrived','amendment-required'].includes(p.status))throw Error('Invalid insurance terms');}for(const c of s.contracts){if(!['freight','mail'].includes(c.kind)||!['accepted','delivered','cancelled'].includes(c.status)||!s.worlds[c.origin]||cmp(c.quantity,0)<=0||credit(c.payment)<0n||!s.worlds[c.destination]||(c.dueHours!==null&&(!Number.isSafeInteger(c.dueHours)||c.dueHours<0)))throw Error('Invalid contract');validateMailLifecycle(s,c);}if(cmp(used(s),s.ship.capacity)>0)throw Error('Cargo, accepted contracts, passenger luggage, fuel bladders and life support overflow exceed capacity.');for(const entry of s.ledger){credit(entry.amount);if(!Number.isSafeInteger(entry.hours)||entry.hours<0||typeof entry.type!=='string')throw Error('Invalid ledger entry');}for(const event of s.events){if(typeof event.label!=='string'||(event.hours!==undefined&&!Number.isSafeInteger(event.hours)))throw Error('Invalid history event');}validateMailHistory(s);const offerIds=new Set();for(const snap of s.snapshots){if(!Number.isSafeInteger(snap.hours)||!Number.isSafeInteger(snap.startedHours)||snap.hours<0||snap.startedHours<0||!s.worlds[snap.worldId]||!['supplier','buyer'].includes(snap.kind))throw Error('Invalid market snapshot');if(!Array.isArray(snap.offers))throw Error('Invalid market snapshot');for(const o of snap.offers){if(!validId(o.id)||offerIds.has(o.id)||!(/^[1-6][1-6]$/).test(o.commodity)||typeof o.expired!=='boolean'||cmp(o.remaining,0)<0||cmp(o.unitPrice,0)<0)throw Error('Invalid or duplicate market offer');offerIds.add(o.id);}}return s;}
function note(s,type,amount,detail){s.ledger.push({id:uid(),type,amount:String(amount),hours:s.hours,world:s.actual,roundingStep:creditStep(s),...detail});s.bank=String(credit(s.bank)+BigInt(amount));}
// Inverse changes avoid copying the entire growing ledger into every undo entry.
function inverseChanges(before,after,path=[],out=[]){
 if(JSON.stringify(before)===JSON.stringify(after))return out;
 if(Array.isArray(before)&&Array.isArray(after)){
  for(let i=0;i<Math.min(before.length,after.length);i++)inverseChanges(before[i],after[i],[...path,i],out);
  for(let i=after.length-1;i>=before.length;i--)out.push({path:[...path,i],remove:true});
  for(let i=after.length;i<before.length;i++)out.push({path:[...path,i],insert:true,value:structuredClone(before[i])});
 }else if(before&&after&&typeof before==='object'&&typeof after==='object'&&!Array.isArray(before)&&!Array.isArray(after)){
  for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
   if(!(key in before))out.push({path:[...path,key],remove:true});
   else if(!(key in after))out.push({path:[...path,key],value:structuredClone(before[key])});
   else inverseChanges(before[key],after[key],[...path,key],out);
  }
 }else out.push({path,value:structuredClone(before)});
 return out;
}
function applyInverse(state,ops,strict=false){
 for(const op of ops){if(!Array.isArray(op.path)||!op.path.length||op.path.some(k=>['__proto__','constructor','prototype'].includes(k)))throw Error('Invalid undo record');let target=state;for(const key of op.path.slice(0,-1)){if(!Object.hasOwn(target,key))throw Error('Undo path missing');target=target[key];}const key=op.path.at(-1);if(strict&&(op.remove&&!Object.hasOwn(target,key)||Array.isArray(target)&&(!Number.isSafeInteger(key)||key<0||key>=target.length&&!(op.insert&&key===target.length))))throw Error('Undo operation does not match saved state');if(op.remove){if(Array.isArray(target))target.splice(key,1);else delete target[key];}else if(op.insert){if(!Array.isArray(target))throw Error('Invalid undo insert');target.splice(key,0,structuredClone(op.value));}else target[key]=structuredClone(op.value);}
 return state;
}
export function transition(original,label,action){
 validate(original);
 const s=structuredClone(original),before=structuredClone(original);
 delete before.undo;delete before.events;delete before.jumpAttempts;
 anchorSupport(s.ship);
 action(s);
 if(s.ship.lifeSupport&&s.hours>original.hours)consumeSupport(s.ship,s.hours-original.hours,{complementShip:original.ship});
 // A later committed change closes the previous jump's mulligan, even if
 // that later change is subsequently undone. Preparing/cancelling a preview
 // is not a committed campaign action.
 const previousJump=lastJump(original),previousAttempt=savedJumpAttempt(s,previousJump);
 if(previousAttempt){s.jumpAttempts??=[];if(!s.jumpAttempts.some(a=>a.id===previousAttempt.id))s.jumpAttempts.push(previousAttempt);previousAttempt.closed=true;}
 const after={...s};delete after.undo;delete after.events;delete after.jumpAttempts;
 // Undo describes the JSON campaign that reload/import can actually restore.
 // Optional undefined properties are absent on disk; never emit an undefined
 // value that JSON would strip out of an inverse operation.
 const inverse=inverseChanges(JSON.parse(JSON.stringify(before)),JSON.parse(JSON.stringify(after)));
 s.revision=original.revision+1;
 const committedJump=lastJump(s);
 s.undo.push({id:uid(),label,inverse,...(committedJump&&committedJump.id!==previousJump?.id?{jumpEventId:committedJump.eventId}:{})});
 s.events.push({id:uid(),label,hours:s.hours,world:s.actual,revision:s.revision});
 validate(s);return s;
}
export function jumpUndoEligibility(s){
 const jump=lastJump(s),entry=s.undo.at(-1),attempt=jump&&savedJumpAttempt(s,jump);
 if(!jump)return {allowed:false,reason:'No committed jump to undo.'};
 if(!entry||!(entry.jumpEventId===jump.eventId||!entry.jumpEventId&&entry.label.startsWith('Jump: ')))return {allowed:false,reason:'Undo Jump is unavailable after a later campaign change.'};
 if(!attempt)return {allowed:false,reason:'This older jump has no complete saved roll. Its existing History Undo remains available.'};
 if(attempt.mulliganUsed)return {allowed:false,reason:'Mulligan used. This jump cannot be undone again.',attempt,jump};
 if(attempt.closed)return {allowed:false,reason:'Undo Jump is unavailable after a later campaign change.',attempt,jump};
 return {allowed:true,reason:'One mulligan: return to the departure world and allow one fresh attempt.',attempt,jump};
}
export function prepareJump(original,roll){
 validate(original);
 if(!original.actual||!original.worlds[original.route[original.routeIndex+1]])throw Error('Plan a route first');
 const s=structuredClone(original);s.jumpAttempts??=[];
 let attempt=currentJumpAttempt(s);
 if(!attempt){attempt={id:uid(),departure:departureKey(s),from:s.actual,rolls:[roll()],mulliganUsed:false,closed:false};s.jumpAttempts.push(attempt);}
 else if(attempt.mulliganUsed&&attempt.rolls.length===1)attempt.rolls.push(roll());
 else return {state:original,attempt,roll:attempt.rolls.at(-1)};
 s.revision=original.revision+1;
 s.events.push({id:uid(),label:'Jump roll prepared',preparedRevision:s.revision,jumpAttemptId:attempt.id,mulliganUsed:attempt.mulliganUsed,rollIndex:attempt.rolls.length-1,hours:s.hours,world:s.actual});
 validate(s);return {state:s,attempt,roll:attempt.rolls.at(-1)};
}
export function commitJump(s,{attemptId,elapsed}){
 const attempt=currentJumpAttempt(s),from=s.worlds[s.actual],to=s.worlds[s.route[s.routeIndex+1]];
 if(!attempt||attempt.id!==attemptId||!to||attempt.mulliganUsed&&attempt.rolls.length!==2)throw Error('Jump preview is stale. Reopen it before committing.');
 if(!Number.isSafeInteger(elapsed)||elapsed<0)throw Error('Enter whole nonnegative hours');
 const distance=jumpDistance(from,to);if(distance>s.ship.jump)throw Error('Route leg exceeds this ship’s jump rating.');
 const dice=structuredClone(attempt.rolls.at(-1));
 const event={id:uid(),label:'Jump audit',from:from.id,to:to.id,dice,generatedHours:148+dice.total,effectiveHours:elapsed,hours:s.hours+elapsed,jumpAttemptId:attempt.id,mulliganUsed:attempt.mulliganUsed};
 recordMailDeparture(s,event);event.fuel=consumeJumpFuel(s.ship,distance);
 s.actual=to.id;s.routeIndex++;s.hours+=elapsed;s.events.push(event);
 s.ledger.push({id:uid(),type:'Jump',amount:'0',hours:s.hours,world:to.id,from:from.id,to:to.id,eventId:event.id,reason:from.name+' → '+to.name});
 for(const p of s.policies.filter(p=>p.status==='active')){const i=p.routeProgress||0;if(p.route?.[i]!==from.id||p.route?.[i+1]!==to.id)p.status='amendment-required';else{p.routeProgress=i+1;if(p.destination===to.id)p.status='arrived';}}
}
export function undo(original){
 validate(original);
 if(!original.undo.length)throw Error('Nothing to undo');
 const entry=original.undo.at(-1);if(!Array.isArray(entry.inverse))throw Error('Unsupported undo record');
 const eligibility=jumpUndoEligibility(original),isJump=entry.jumpEventId||entry.label.startsWith('Jump: '),attempt=isJump?eligibility.attempt:null;
 if(isJump&&attempt&&!eligibility.allowed)throw Error(eligibility.reason);
 const s=applyInverse(structuredClone(original),entry.inverse);
 // The attempt log is deliberately outside all reversible campaign patches.
 s.jumpAttempts=structuredClone(original.jumpAttempts||[]);
 if(attempt){let saved=s.jumpAttempts.find(a=>a.id===attempt.id);if(!saved){saved=structuredClone(attempt);s.jumpAttempts.push(saved);}saved.mulliganUsed=true;}
 s.undo=original.undo.slice(0,-1);s.events=[...original.events,{id:uid(),label:'Undo: '+entry.label,hours:original.hours,revision:original.revision+1,...(attempt?{jumpAttemptId:attempt.id,mulliganUsed:true,reason:'One jump mulligan used; the next attempt gets one fresh roll.'}:{})}];s.revision=original.revision+1;return validate(s);
}
export function undoJump(original){const eligible=jumpUndoEligibility(original);if(!eligible.allowed)throw Error(eligible.reason);return undo(original);}
export function assertWorld(s,world){if(s.actual!==world)throw Error('The ship must be at this world. Browsing does not move it.');}
function cooldown(s,party){if(party&&(s.cooldowns[party]||0)>s.hours)throw Error('Counterparty is unavailable until hour '+s.cooldowns[party]);}
export function buy(s,{snapshotId,offerId,quantity,feePercent=0,description,insurance=null}){quantity=String(up(quantity));const snap=s.snapshots.find(x=>x.id===snapshotId),offer=snap?.offers.find(x=>x.id===offerId);if(!offer||offer.expired||offer.manualRequired)throw Error('Offer unavailable');assertWorld(s,snap.worldId);cooldown(s,snap.party);if(cmp(quantity,0)<=0||cmp(quantity,offer.remaining)>0)throw Error('Quantity exceeds available offer');if(cmp(add(used(s),quantity),s.ship.capacity)>0)throw Error('Not enough cargo capacity');if(!Number.isFinite(feePercent)||feePercent<0||feePercent>100)throw Error('Invalid broker fee');const cost=up(mul(quantity,offer.unitPrice),creditStep(s)),fee=up(mul(cost,div(feePercent,100)),creditStep(s)),premium=insurance?credit(insurance.premium):0n,total=cost+fee+premium;if(total>credit(s.bank))throw Error('Insufficient funds');const id=uid();const lot={id,commodity:offer.commodity,description:description||offer.name||offer.commodity,quantity:decimal(quantity),basis:String(total),goodsValue:String(cost),world:s.actual,hours:s.hours,snapshotId,offerId,illegal:!!offer.illegal,audit:{price:structuredClone(offer),fee:String(fee),premium:String(premium),rulesVersion:VERSION}};s.lots.push(lot);offer.remaining=decimal(sub(offer.remaining,quantity));note(s,'Purchase',-cost,{lotId:id,purchase:{commodity:lot.commodity,description:lot.description,quantity:lot.quantity,unitPrice:offer.unitPrice,fee:String(fee),premium:String(premium),priceAudit:structuredClone(offer.audit||{})}});if(fee)note(s,'Broker fee',-fee,{lotId:id});if(insurance){if(!s.settings.insurance)throw Error('Insurance is disabled');if(cmp(insurance.insuredValue,cost)!==0)throw Error('Insurance value must match this purchase’s goods value');if(!s.worlds[insurance.destination])throw Error('Insurance destination is missing');const policy={...insurance,id:uid(),lotId:id,status:'active',remainingQuantity:decimal(quantity),remainingValue:String(cost),claims:[],amendments:[],createdHours:s.hours,initialQuantity:decimal(quantity)};s.policies.push(policy);note(s,'Insurance premium',-premium,{lotId:id,policyId:policy.id});}return id;}
function reducePolicy(s,lotId,quantity){for(const p of s.policies.filter(p=>p.lotId===lotId&&cmp(p.remainingQuantity,0)>0)){const q=cmp(quantity,p.remainingQuantity)>0?p.remainingQuantity:quantity;const value=cmp(q,p.remainingQuantity)===0?credit(p.remainingValue):floor(mul(p.remainingValue,div(q,p.remainingQuantity)));p.remainingValue=String(credit(p.remainingValue)-value);p.remainingQuantity=decimal(sub(p.remainingQuantity,q));if(!cmp(p.remainingQuantity,0))p.status='closed';}}
export function sell(s,preview,world,party){assertWorld(s,world);cooldown(s,party);if(credit(s.bank)+credit(preview.bankDelta)<0n)throw Error('Insufficient funds for sale costs');for(const line of preview.lines){const lot=s.lots.find(l=>l.id===line.lotId);if(!lot||cmp(line.quantity,lot.quantity)>0)throw Error('Sale is stale');const goods=cmp(line.quantity,lot.quantity)===0?credit(lot.goodsValue):floor(mul(lot.goodsValue,div(line.quantity,lot.quantity)));lot.quantity=decimal(sub(lot.quantity,line.quantity));lot.basis=String(credit(lot.basis)-credit(line.basis));lot.goodsValue=String(credit(lot.goodsValue)-goods);reducePolicy(s,lot.id,line.quantity);note(s,'Sale',credit(line.gross),{lotId:lot.id,audit:{...line,commodity:lot.commodity,profitPercent:preview.options.percent}});if(credit(line.fee))note(s,'Broker fee',-credit(line.fee),{lotId:lot.id});if(credit(line.tax))note(s,'Tax',-credit(line.tax),{lotId:lot.id,audit:preview.tax});if(credit(line.adjustment))note(s,'Profit adjustment',credit(line.adjustment),{lotId:lot.id,percent:preview.options.percent});}s.lots=s.lots.filter(l=>cmp(l.quantity,0)>0);}
export function claim(s,{policyId,quantity,reason,approved}){if(!approved||!reason.trim())throw Error('Referee approval and a reason are required');const p=s.policies.find(p=>p.id===policyId),lot=p&&s.lots.find(l=>l.id===p.lotId);if(!p||!lot||p.status!=='active')throw Error('Policy is not active');if(cmp(quantity,0)<=0||cmp(quantity,p.remainingQuantity)>0||cmp(quantity,lot.quantity)>0)throw Error('Invalid insured loss quantity');const lostValue=cmp(quantity,p.remainingQuantity)===0?credit(p.remainingValue):floor(mul(p.remainingValue,div(quantity,p.remainingQuantity)));const writeoff=cmp(quantity,lot.quantity)===0?credit(lot.basis):floor(mul(lot.basis,div(quantity,lot.quantity)));const payout=up(mul(mul(p.insuredValue,div(quantity,p.initialQuantity)),div(p.coverage,100)),creditStep(s));lot.quantity=decimal(sub(lot.quantity,quantity));lot.basis=String(credit(lot.basis)-writeoff);lot.goodsValue=String(credit(lot.goodsValue)-lostValue);p.claims.push({id:uid(),quantity:decimal(quantity),lostValue:String(lostValue),basisWrittenOff:String(writeoff),payout:String(payout),reason,hours:s.hours});reducePolicy(s,lot.id,quantity);s.lots=s.lots.filter(l=>cmp(l.quantity,0)>0);note(s,'Insurance claim',payout,{policyId,reason,quantity:decimal(quantity),basisWrittenOff:String(writeoff)});}
export function deposit(s,amount,reason){amount=up(amount,creditStep(s));if(amount<=0n||!reason.trim())throw Error('Positive deposit and description required');note(s,'Manual deposit',amount,{reason:reason.trim()});}
export function expense(s,amount,reason){amount=up(amount,creditStep(s));if(amount<=0n||!reason.trim())throw Error('Positive expense and description required');if(amount>credit(s.bank))throw Error('Insufficient funds');note(s,'Manual expense',-amount,{reason});}
export function saveBerthingRate(s,die){
 const world=s.worlds[s.actual],port=starport(world);
 if(!berthMultipliers[port])throw Error('This starport does not require a berthing roll.');
 if(world.berthingRate?.port===port)throw Error('This starport already has a saved rate.');
 if(!Number.isInteger(die)||die<1||die>6)throw Error('Invalid berthing die.');
 world.berthingRate={port,die};
}
function checkFuelCargo(s,input){if(input.kind!=='fuel'||!s.ship.fuel)return;const q=fuelPurchase(s.ship,input.tons),ship={...s.ship,fuel:{...s.ship.fuel,aboardTons:q.after}};if(cmp(add(sub(used(s),bladderSpace(s.ship)),bladderSpace(ship)),s.ship.capacity)>0)throw Error('Fuel in bladders would exceed cargo capacity.');}
export function shipExpense(s,input){
 input={...input,creditStep:creditStep(s),fuelShip:s.ship};
 if(input.kind==='passengerSupport'&&s.ship.accommodation)input={...input,passengers:s.ship.accommodation.passengers,crew:s.ship.accommodation.crew};
 if(input.kind==='staterooms')input={...input,staterooms:s.ship.staterooms??0,rooms:roomCounts(s.ship),roomService:s.ship.accommodation?.roomService};
 const quote=expenseQuote(s.worlds[s.actual],input),amount=credit(quote.amount);
 if(amount>credit(s.bank))throw Error('Insufficient funds');
 checkFuelCargo(s,input);
 if(input.kind==='fuel'&&s.ship.fuel)s.ship.fuel.aboardTons=fuelPurchase(s.ship,input.tons).after;
 note(s,'Ship expense · '+quote.label,-amount,{expense:quote});
 if(['lifeSupport','salary'].includes(input.kind))s.ship.expenses={...s.ship.expenses,[input.kind]:String(credit(input.monthly))};
 if(input.kind==='passengerSupport')s.ship.supportOccupants={passengers:structuredClone(input.passengers),crew:structuredClone(input.crew)};
 return quote;
}
export function shipExpenses(s,inputs){
 if(!Array.isArray(inputs)||!inputs.length)throw Error('Select at least one expense.');
 if(new Set(inputs.map(x=>x.kind)).size!==inputs.length)throw Error('Each expense type can be included only once.');
 inputs=payableExpenses(inputs);if(!inputs.length)throw Error('Nothing to pay: no fuel to purchase. Select another expense or enter a fuel quantity.');
 inputs=inputs.map(input=>({...input,creditStep:creditStep(s),fuelShip:s.ship}));
 inputs=inputs.map(input=>input.kind==='passengerSupport'&&s.ship.accommodation?{...input,passengers:s.ship.accommodation.passengers,crew:s.ship.accommodation.crew}:input.kind==='staterooms'?{...input,staterooms:s.ship.staterooms??0,rooms:roomCounts(s.ship),roomService:s.ship.accommodation?.roomService}:input);
 const quotes=inputs.map(input=>expenseQuote(s.worlds[s.actual],input));
 const total=quotes.reduce((n,q)=>n+credit(q.amount),0n);
 if(total>credit(s.bank))throw Error('Insufficient funds for the combined expenses');
 inputs.forEach(input=>checkFuelCargo(s,input));
 const batchId=uid();
 inputs.forEach(input=>{shipExpense(s,input);s.ledger.at(-1).batchId=batchId;});
 return {quotes,total:String(total)};
}
export function bankCorrection(s,amount,reason){amount=String(up(amount,creditStep(s)));if(!reason.trim())throw Error('Correction reason required');note(s,'Referee bank correction',credit(amount),{reason});}
export function addLot(s,lot,reason,opening=false){lot={...lot,quantity:String(up(lot.quantity)),basis:String(up(lot.basis,creditStep(s))),goodsValue:String(up(lot.goodsValue,creditStep(s)))};if(!reason.trim()||cmp(lot.quantity,0)<=0||credit(lot.basis)<0n||credit(lot.goodsValue)<0n)throw Error('Valid quantity, basis, goods value and reason required');s.lots.push({...lot,id:uid(),quantity:decimal(lot.quantity),basis:String(credit(lot.basis)),goodsValue:String(credit(lot.goodsValue)),world:s.actual,hours:s.hours});s.events.push({id:uid(),label:opening?'Opening cargo':'Referee cargo addition',reason,lot:structuredClone(lot),hours:s.hours});}
export function correctLot(s,id,quantity,basis,goodsValue,reason){if(!reason.trim())throw Error('Correction reason required');const lot=s.lots.find(l=>l.id===id);if(!lot)throw Error('Lot missing');if(s.policies.some(p=>p.lotId===id&&p.status==='active'))throw Error('Close/amend active insurance before directly correcting its cargo; use Claim for an insured loss.');const before=structuredClone(lot);if(cmp(quantity,0)<0||credit(basis)<0n||credit(goodsValue)<0n)throw Error('Negative cargo values');if(cmp(quantity,0)===0&&(credit(basis)||credit(goodsValue)))throw Error('Zero cargo must have zero remaining values');Object.assign(lot,{quantity:decimal(quantity),basis:String(credit(basis)),goodsValue:String(credit(goodsValue))});s.lots=s.lots.filter(l=>cmp(l.quantity,0)>0);s.events.push({id:uid(),label:'Referee cargo correction',reason,before,after:structuredClone(lot),hours:s.hours});}
export function acceptContract(s,c){c={...c,quantity:String(up(c.quantity)),payment:String(up(c.payment,creditStep(s)))};assertWorld(s,c.origin);if(cmp(add(used(s),c.quantity),s.ship.capacity)>0)throw Error('Not enough capacity for the whole contract');if(s.contracts.some(x=>x.offerId===c.offerId))throw Error('Contract already accepted');const contract={...c,id:uid(),status:'accepted',...(c.kind==='mail'?{firstDeparture:null,acceptanceEventId:uid()}:{})};s.contracts.push(contract);if(c.kind==='mail')s.events.push({id:contract.acceptanceEventId,label:'Mail acceptance audit',contractId:contract.id,contract:structuredClone(contract),hours:s.hours,world:s.actual});}
// A missing legacy marker is unknown, never an implicit null. Old exports can
// prove their journey only through a complete, internally consistent action trail.
function mailActionTrail(s){
 const actions=s.events.filter(e=>Number.isSafeInteger(e.revision)),stack=[];
 for(const [index,event]of actions.entries()){
  if(event.label.startsWith('Undo: ')){
   if(stack.at(-1)?.event.label!==event.label.slice(6))return null;
   stack.pop();
  }else stack.push({event,index});
 }
 return {actions,stack};
}
function mailJumpAuditConflict(s,acceptanceIndex,stack,matchedAudits=new Set()){
 const active=new Set(stack.map(entry=>entry.event)),paired=new Set();
 for(let i=acceptanceIndex+1;i<s.events.length;i++){
  const audit=s.events[i];if(audit.label!=='Jump audit')continue;
  const action=s.events.slice(i+1).find(e=>Number.isSafeInteger(e.revision));
  // Old releases wrote jump audits before adding jump ledger rows. An orphan
  // audit cannot be ignored, but a properly paired, undone jump is harmless.
  if(!action||!action.label.startsWith('Jump: ')||action.hours!==audit.hours||action.world!==audit.to||paired.has(action))return true;
  paired.add(action);
  if(active.has(action)&&!matchedAudits.has(audit.id))return true;
 }
 return false;
}
function legacyMailDeparture(s,id){
 try{
  const trail=mailActionTrail(s);if(!trail)return null;
  const {actions,stack}=trail;
  if(stack.length!==s.undo.length||stack.some((entry,i)=>entry.event.label!==s.undo[i].label))return null;
  const material={...s};delete material.events;delete material.undo;
  const cursor=structuredClone(material);let departure=null;const matchedJumps=new Set(),matchedAudits=new Set();
  for(let i=s.undo.length-1;i>=0;i--){
   const {event,index}=stack[i],entry=s.undo[i];
   const after={actual:cursor.actual,hours:cursor.hours,bank:cursor.bank,contracts:structuredClone(cursor.contracts),jumps:cursor.ledger.filter(e=>e.type==='Jump').map(e=>({...e})),ledger:['Accepted mail','Manual contract accepted'].includes(entry.label)?JSON.stringify(cursor.ledger):null};
   const contract=after.contracts.find(c=>c.id===id);
   if(!contract||contract.kind!=='mail'||contract.status!=='accepted'||event.hours!==after.hours||event.world!==after.actual)return null;
   // Generated inverse patches never modify the audit/undo trail itself.
   if(entry.inverse.some(op=>['events','undo','revision'].includes(op.path[0])))return null;
   const before=applyInverse(cursor,entry.inverse,true);
   validate({...before,events:[],undo:[],latestMailCheckId:null});
   const previous=before.contracts.find(c=>c.id===id);
   if(!previous){
    const at=after.contracts.findIndex(c=>c.id===id);
    if(!['Accepted mail','Manual contract accepted'].includes(entry.label)||after.actual!==contract.origin||before.actual!==after.actual||before.hours!==after.hours||before.bank!==after.bank||JSON.stringify(before.ledger)!==after.ledger||before.contracts.length!==after.contracts.length-1||!entry.inverse.some(op=>op.remove&&op.path.length===2&&op.path[0]==='contracts'&&op.path[1]===at)||JSON.stringify(before.contracts)!==JSON.stringify(after.contracts.filter(c=>c.id!==id)))return null;
    // Imports historically reset the campaign revision without marking the
    // seam. An ambiguous seam after acceptance cannot prove no departure.
    for(let j=index+1;j<actions.length;j++)if(actions[j].revision!==actions[j-1].revision+1){
     if(jumpPreparationBridge(s,actions[j-1],actions[j]))continue;
     const action=actions[j],proof=s.events[s.events.indexOf(action)-1];
     // A verified legacy cancellation can follow an otherwise invisible import
     // revision reset. Its retained audit proves eligibility at that boundary;
     // once the cancellation is undone, do not discard that proof. No other
     // import gaps or unverified cancellations are promoted into evidence.
     if(action.label!=='Cancelled mail'||stack.some(entry=>entry.event===action)||proof?.label!=='Mail cancellation audit'||proof.contract?.id!==id||proof.contract?.status!=='cancelled'||proof.contract?.firstDeparture!==null||proof.contract?.cancellation?.source!=='legacy-undo'||proof.contract?.cancellation?.revision!==action.revision||proof.hours!==action.hours||proof.world!==action.world)return null;
     validateMailLifecycle(s,proof.contract);
     if(proof.contract.cancelledHours!==proof.hours||proof.contract.cancellation.world!==proof.world)return null;
    }
    // Surviving jump ledger rows must all agree with the reconstructed trail.
    // This also detects a removed jump action/inverse after a zero-hour return.
    const acceptanceIndex=s.events.indexOf(event);
    if(mailJumpAuditConflict(s,acceptanceIndex,stack,matchedAudits))return null;
    for(const jump of s.ledger.filter(e=>e.type==='Jump')){
     const auditIndex=s.events.findIndex(e=>e.id===jump.eventId);
     if(auditIndex<0||auditIndex>acceptanceIndex&&!matchedJumps.has(jump.id))return null;
    }
    return {firstDeparture:departure};
   }
   if(previous.kind!=='mail'||previous.status!=='accepted')return null;
   const beforeIds=new Set(before.ledger.map(e=>e.id));
   const jumps=after.jumps.filter(e=>!beforeIds.has(e.id));
   const isJump=entry.label.startsWith('Jump: ');
   if(isJump||jumps.length){
    if(!isJump||jumps.length!==1)return null;
    const jump=jumps[0],audit=s.events.find(e=>e.id===jump.eventId);
    if(jump.from!==before.actual||jump.to!==after.actual||jump.hours!==after.hours||!audit||audit.label!=='Jump audit'||audit.from!==jump.from||audit.to!==jump.to||audit.hours!==jump.hours)return null;
    matchedJumps.add(jump.id);matchedAudits.add(audit.id);departure={eventId:audit.id,from:jump.from,to:jump.to,hours:jump.hours,revision:event.revision};
   }
  }
 }catch{ /* Invalid or incomplete older inverse records must fail closed. */ }
 return null;
}
export function mailCancellationEligibility(s,id){
 const c=s.contracts.find(c=>c.id===id);
 if(!c||c.kind!=='mail')return {allowed:false,reason:'Only accepted mail can be cancelled.',source:'unverified'};
 if(c.status!=='accepted')return {allowed:false,reason:c.status==='delivered'?'Delivered mail cannot be cancelled.':'This mail is already cancelled.',source:'recorded'};
 const recorded=Object.hasOwn(c,'firstDeparture'),legacy=recorded?null:legacyMailDeparture(s,id);
 if(!recorded&&!legacy)return {allowed:false,reason:'Travel history unverified. This older mail cannot be cancelled safely.',source:'unverified'};
 const firstDeparture=recorded?c.firstDeparture:legacy.firstDeparture;
 if(recorded&&firstDeparture===null){
  const acceptanceIndex=s.events.findIndex(e=>e.id===c.acceptanceEventId&&e.label==='Mail acceptance audit'&&e.contractId===c.id);
  // The explicit marker is the authority, but an import must not use null to
  // contradict surviving committed jumps. Undone jumps have no ledger row.
  const conflict=s.ledger.some(e=>e.type==='Jump'&&(!e.eventId||s.events.findIndex(a=>a.id===e.eventId)<0||s.events.findIndex(a=>a.id===e.eventId)>acceptanceIndex));
  const trail=acceptanceIndex<0?null:mailActionTrail({events:s.events.slice(acceptanceIndex)});
  if(acceptanceIndex<0||conflict||!trail||mailJumpAuditConflict(s,acceptanceIndex,trail.stack))return {allowed:false,reason:'Travel history unverified. The departure record and saved audit do not agree.',source:'unverified'};
 }
 const source=recorded?'recorded':'legacy-undo';
 return {allowed:firstDeparture===null,reason:firstDeparture===null?'Can be cancelled before its first committed jump.':'Mail has already departed. Cancellation is only available before its first committed jump.',source,firstDeparture};
}
export function recordMailDeparture(s,event){
 for(const c of s.contracts.filter(c=>c.kind==='mail'&&c.status==='accepted')){
  if(c.firstDeparture)continue;
  const evidence=mailCancellationEligibility(s,c.id);
  c.firstDeparture=evidence.firstDeparture||{eventId:event.id,from:event.from,to:event.to,hours:event.hours,revision:s.revision+1,...(evidence.source==='unverified'?{priorHistoryUnverified:true}:{})};
 }
}
export function cancelMail(s,id){
 const eligibility=mailCancellationEligibility(s,id);
 if(!eligibility.allowed)throw Error(eligibility.reason);
 const c=s.contracts.find(c=>c.id===id);
 c.status='cancelled';c.firstDeparture=null;c.cancelledHours=s.hours;
 c.cancellation={world:s.actual,revision:s.revision+1,source:eligibility.source};
 s.events.push({id:uid(),label:'Mail cancellation audit',hours:s.hours,world:s.actual,contract:structuredClone(c),reason:'Cancelled before first committed jump; no income or penalty.'});
}

export function deliver(s,id,penaltyDie=1){const c=s.contracts.find(c=>c.id===id);if(!c||c.status!=='accepted')throw Error('Contract is not awaiting delivery');assertWorld(s,c.destination);let amount=credit(c.payment);const late=c.kind==='freight'&&c.dueHours!==null&&s.hours>c.dueHours;if(late){if(!Number.isInteger(penaltyDie)||penaltyDie<1||penaltyDie>6)throw Error('Invalid late-penalty die');amount=up(div(mul(amount,100-(penaltyDie+4)*10),100),creditStep(s));}c.status='delivered';c.deliveredHours=s.hours;c.payout=String(amount);c.late=late;c.penaltyDie=late?penaltyDie:null;note(s,c.kind==='mail'?'Mail delivery':'Freight delivery',amount,{contractId:id,late});}

export function insureLot(s,lotId,quote){
 const lot=s.lots.find(l=>l.id===lotId);if(!lot)throw Error('Cargo lot no longer aboard');
 if(s.policies.some(p=>p.lotId===lotId&&['active','amendment-required'].includes(p.status)&&cmp(p.remainingQuantity,0)>0))throw Error('This cargo already has coverage. Amend or close that policy first.');
 if(!quote.route||quote.route.length<2||quote.route[0]!==s.actual||quote.destination!==quote.route.at(-1)||quote.route.some(id=>!s.worlds[id]))throw Error('Invalid insured route');
 if(cmp(quote.insuredValue,lot.goodsValue)!==0)throw Error('Cargo value changed; obtain a new quote');
 const premium=credit(quote.premium);if(premium<0n||premium>credit(s.bank))throw Error('Insufficient funds or invalid premium');
 const policy={...structuredClone(quote),id:uid(),lotId,status:'active',remainingQuantity:lot.quantity,initialQuantity:lot.quantity,remainingValue:lot.goodsValue,claims:[],amendments:[],createdHours:s.hours};
 s.settings.insurance=true;s.policies.push(policy);lot.basis=String(credit(lot.basis)+premium);note(s,'Insurance premium',-premium,{lotId,policyId:policy.id});return policy.id;
}

export function applyRounding(s){
 const before=credit(s.bank),changes=roundExisting(s),delta=credit(s.bank)-before;
 if(delta){s.bank=String(before);note(s,'Rounding adjustment',delta,{roundingChanges:changes});}
 s.events.push({id:uid(),label:'Rounding applied [R]',hours:s.hours,roundingChanges:changes});
 validate(s);return changes;
}

export function refillLifeSupport(s,options={}){
 const q=refillQuote(s,options);
 if(cmp(supportAmount(q.purchasedStockUnits),0)===0&&credit(q.comfortAmount)===0n)throw Error('Life support is already full for the requested target.');
 if(credit(s.bank)<credit(q.amount))throw Error('Insufficient funds for the life support purchase.');
 const lifeSupport={capacityHours:q.capacityHours,stockUnits:q.afterStockUnits};
 const nextShip={...s.ship,lifeSupport};
 if(cmp(add(sub(used(s),supportCargo(s.ship)),supportCargo(nextShip)),s.ship.capacity)>0)throw Error('Life support overflow, fuel, luggage and cargo would exceed cargo capacity.');
 const details=[['Awake people',String(q.awakePeople)],['Occupied low berths',String(q.occupiedLowBerths)],['LSS before',q.beforeUnits],['Standard top-up · days',q.standardDays],['Standard top-up · Cr',q.standardAmount],['Monthly cabin + person bundle · Cr',q.monthly],['Extra LSS purchased',q.extraUnits],['LSS after',q.afterUnits],['Days after',q.afterDays],['Life support cargo after · tons',q.afterCargoTons]];
 if(cmp(q.extraDays,0)>0)details.push(['Home rule',`Cr${q.extraRate} × ${q.extraHeadcount} person-equivalents × ${q.extraPurchasedDays} days / ${q.extraBillingDays}; combined extra charge rounded UP once to Cr${q.extraRoundingStep}: Cr${q.extraAmount}. Existing stock credited.`]);
 if(credit(q.comfortAmount)>0n)details.push(['Comfort provisions · Cr',q.comfortAmount],['Comfort note',q.comfortNote],['Comfort scope','Cost only; adds no LSS, endurance or cargo capacity.']);
 s.ship.lifeSupport=lifeSupport;
 note(s,'Ship expense · Life support refill',-credit(q.amount),{expense:{kind:'lifeSupportRefill',label:'Life support refill',...q,details,reference:supportReference,extraReference:extraSupportReference}});
 return q;
}
