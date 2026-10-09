import {validateMailHistory} from './mail-history.mjs?v=mail-history-1';
import {bladderSpace,validateFuel,fuelPurchase} from './fuel.mjs?v=bladder-stock-1';
import {validateSupport,refillQuote,consumeSupport} from './life-support.mjs?v=whole-days-1';
import {up,creditStep,roundExisting} from './rounding.mjs';
import {validateAccommodation,passengerLuggage,roomCounts} from './accommodation.mjs?v=passenger-input-3';
import {add,sub,mul,div,cmp,floor,sum,decimal,credit} from './amounts.mjs';
import {VERSION,priceLimits} from './rules.mjs?v=price-limits-1';
import {expenseQuote,starport,berthMultipliers,payableExpenses} from './expenses.mjs?v=fuel-warning-1';
export const SCHEMA=1;
export const uid=()=>crypto.randomUUID();
export function initial(){return {schema:SCHEMA,revision:0,rulesVersion:VERSION,initialized:false,name:'My trading campaign',bank:'0',hours:0,dateLabel:'001-1105',ship:{name:'Independent trader',capacity:'60',staterooms:0,jump:2,scoops:true,armed:false},trader:{broker:0,streetwise:0,admin:0,characteristic:0,rank:0,soc:0},settings:{reducedProfitLimitsEnabled:false,minPurchasePercent:85,maxSalePercent:115,profit:100,tax:false,insurance:false,creditStep:1,maxBaseRetailEnabled:false,maxBaseRetail:'100000',useRawIllegalPrices:false},worlds:{},actual:null,route:[],routeIndex:0,snapshots:[],lots:[],contracts:[],policies:[],ledger:[],cooldowns:{},undo:[],events:[],latestMailCheckId:null};}
export function used(state){return sum([bladderSpace(state.ship),passengerLuggage(state.ship),...state.lots.map(l=>l.quantity),...state.contracts.filter(c=>c.status==='accepted').map(c=>c.quantity)]);}
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
   if(!record(op)||!Array.isArray(op.path)||!op.path.length||op.path.some(key=>!(typeof key==='string'&&key.length>0||Number.isSafeInteger(key)&&key>=0)||['__proto__','constructor','prototype'].includes(key)))throw Error('Invalid undo path');
   if(op.remove!==undefined&&op.remove!==true||op.insert!==undefined&&op.insert!==true||op.remove&&op.insert||op.remove&&Object.hasOwn(op,'value')||!op.remove&&!Object.hasOwn(op,'value'))throw Error('Invalid undo operation');
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
export function validate(s){validateStructure(s);if(!s||s.schema!==SCHEMA||s.rulesVersion!==VERSION||!Number.isSafeInteger(s.revision)||s.revision<0)throw Error('Unsupported or invalid campaign format.');for(const key of ['lots','contracts','policies','ledger','snapshots','undo','events','route'])if(!Array.isArray(s[key]))throw Error('Missing campaign '+key);for(const key of ['lots','contracts','policies','ledger','snapshots','events']){const seen=new Set();for(const item of s[key]){if(!validId(item.id)||seen.has(item.id))throw Error('Invalid or duplicate '+key+' ID');seen.add(item.id);}}if(!s.ship||!s.trader||!s.settings||!s.worlds||!s.cooldowns)throw Error('Incomplete campaign');credit(s.bank);validateFuel(s.ship);validateSupport(s.ship);validateAccommodation(s.ship);if(s.ship?.staterooms!==undefined&&(!Number.isSafeInteger(s.ship.staterooms)||s.ship.staterooms<0))throw Error('Staterooms must be a non-negative whole number.');for(const [id,w]of Object.entries(s.worlds)){if(!w||id!==w.id||id!==w.x+','+w.y||!Number.isSafeInteger(w.x)||!Number.isSafeInteger(w.y)||!['Safe','Amber','Red'].includes(w.zone)||typeof w.name!=='string'||typeof w.uwp!=='string'||typeof w.sector!=='string'||!/^\d{4}$/.test(w.hex))throw Error('Invalid world record');}if(s.initialized&&!s.actual)throw Error('Initialized campaign has no actual world');for(const k of ['broker','streetwise','admin','characteristic','rank','soc'])if(!Number.isInteger(s.trader[k]))throw Error('Invalid trader input');if(cmp(s.ship.capacity,0)<0||!Number.isInteger(s.ship.jump)||s.ship.jump<1||s.ship.jump>6)throw Error('Invalid ship capacity or jump rating');if(!Number.isSafeInteger(s.hours)||s.hours<0)throw Error('Invalid campaign hours');if(!Number.isFinite(s.settings.profit)||s.settings.profit<0||s.settings.profit>100)throw Error('Invalid profit setting');Object.assign(s.settings,priceLimits(s.settings));if(typeof s.settings.maxBaseRetailEnabled!=='boolean')s.settings.maxBaseRetailEnabled=false;if(s.settings.maxBaseRetail===undefined)s.settings.maxBaseRetail='100000';if(!Number.isFinite(Number(s.settings.maxBaseRetail))||Number(s.settings.maxBaseRetail)<=0)throw Error('Invalid maximum base retail setting');if(typeof s.settings.useRawIllegalPrices!=='boolean')s.settings.useRawIllegalPrices=false;if(s.actual&&!s.worlds[s.actual])throw Error('Actual world missing');const ids=new Set();for(const l of s.lots){if(!validId(l.id)||!(/^[1-6][1-6]$/).test(l.commodity)||typeof l.description!=='string'||ids.has(l.id)||cmp(l.quantity,0)<=0||credit(l.basis)<0n||credit(l.goodsValue)<0n)throw Error('Invalid cargo lot');ids.add(l.id);}for(const p of s.policies){if(!p.id||!Array.isArray(p.claims)||cmp(p.remainingQuantity,0)<0||credit(p.remainingValue)<0n||cmp(p.initialQuantity,0)<=0||cmp(p.insuredValue,0)<0||!Number.isFinite(p.coverage)||p.coverage<20||p.coverage>100)throw Error('Invalid policy');if(cmp(p.remainingQuantity,0)>0&&!ids.has(p.lotId))throw Error('Active policy has no cargo');const insuredLot=s.lots.find(l=>l.id===p.lotId);if(insuredLot&&cmp(p.remainingQuantity,insuredLot.quantity)>0)throw Error('Policy exceeds remaining cargo');if(![20,30,40,50,60,70,80,90,100].includes(p.coverage)||!['active','closed','arrived','amendment-required'].includes(p.status))throw Error('Invalid insurance terms');}for(const c of s.contracts){if(!['freight','mail'].includes(c.kind)||!['accepted','delivered','cancelled'].includes(c.status)||!s.worlds[c.origin]||cmp(c.quantity,0)<=0||credit(c.payment)<0n||!s.worlds[c.destination]||(c.dueHours!==null&&(!Number.isSafeInteger(c.dueHours)||c.dueHours<0)))throw Error('Invalid contract');validateMailLifecycle(s,c);}if(cmp(used(s),s.ship.capacity)>0)throw Error('Cargo, accepted contracts, passenger luggage and fuel bladders exceed capacity.');for(const entry of s.ledger){credit(entry.amount);if(!Number.isSafeInteger(entry.hours)||entry.hours<0||typeof entry.type!=='string')throw Error('Invalid ledger entry');}for(const event of s.events){if(typeof event.label!=='string'||(event.hours!==undefined&&!Number.isSafeInteger(event.hours)))throw Error('Invalid history event');}validateMailHistory(s);const offerIds=new Set();for(const snap of s.snapshots){if(!Number.isSafeInteger(snap.hours)||!Number.isSafeInteger(snap.startedHours)||snap.hours<0||snap.startedHours<0||!s.worlds[snap.worldId]||!['supplier','buyer'].includes(snap.kind))throw Error('Invalid market snapshot');if(!Array.isArray(snap.offers))throw Error('Invalid market snapshot');for(const o of snap.offers){if(!validId(o.id)||offerIds.has(o.id)||!(/^[1-6][1-6]$/).test(o.commodity)||typeof o.expired!=='boolean'||cmp(o.remaining,0)<0||cmp(o.unitPrice,0)<0)throw Error('Invalid or duplicate market offer');offerIds.add(o.id);}}return s;}
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
export function transition(original,label,action){validate(original);const s=structuredClone(original);const before=structuredClone(original);delete before.undo;delete before.events;action(s);if(s.ship.lifeSupport&&s.hours>original.hours)consumeSupport(s.ship,s.hours-original.hours);const after={...s};delete after.undo;delete after.events;const inverse=inverseChanges(before,after);s.revision=original.revision+1;s.undo.push({id:uid(),label,inverse});s.events.push({id:uid(),label,hours:s.hours,world:s.actual,revision:s.revision});validate(s);return s;}
export function undo(original){if(!original.undo.length)throw Error('Nothing to undo');const entry=original.undo.at(-1);if(!Array.isArray(entry.inverse))throw Error('Unsupported undo record');const s=applyInverse(structuredClone(original),entry.inverse);s.undo=original.undo.slice(0,-1);s.events=[...original.events,{id:uid(),label:'Undo: '+entry.label,hours:original.hours,revision:original.revision+1}];s.revision=original.revision+1;return validate(s);}
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

export function refillLifeSupport(s){const q=refillQuote(s);if(!q.missingDays)throw Error('Life support is already full.');if(credit(s.bank)<credit(q.amount))throw Error('Insufficient funds for a full refill.');note(s,'Ship expense · Life support refill',-credit(q.amount),{expense:{kind:'lifeSupportRefill',label:'Life support refill',amount:q.amount,details:[['Days purchased',String(q.missingDays)],['Partly used day rounded up',q.partialDay?'Yes - included in days purchased':'No'],['Days before',String(q.beforeHours/24)],['Days after',String(q.capacityHours/24)],['Monthly cabin + person cost',q.monthly]],reference:'Campaign supply tracking: 28 days per billing month. Consume one day for each 24 accumulated hours. Refill purchases whole days, rounding a partly used day up; the campaign clock does not advance.',...q}});s.ship.lifeSupport={capacityHours:q.capacityHours,remainingHours:q.capacityHours,elapsedHours:0};return q;}
