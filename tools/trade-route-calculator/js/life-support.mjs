import {passengerShip} from './passengers.mjs?v=modal-entry-20261011-51';
import {tiers,roomCounts,serviceRate,occupants,personRate} from './accommodation.mjs?v=modal-entry-20261011-51';
import {add,sub,mul,div,cmp,dec,rat,decimal,auditNumber,credit,floor} from './amounts.mjs';
import {up,creditStep} from './rounding.mjs?v=modal-entry-20261011-51';

export const supportReference='Cluster Truck, p. 14: awake occupants consume 1 LSS per day; occupied low berths consume 0.1. Internal storage holds 4 LSS per displacement ton; overflow uses 0.01 cargo tons per LSS.';
export const extraSupportReference='Home rule: extra supplies cost Cr1,000 per person-equivalent per 28 days. An occupied low berth counts as 0.1 person-equivalent. Round the combined extra charge up once to Cr100.';
const maxZero=x=>cmp(x,0)>0?x:rat(0);
const minimum=(a,b)=>cmp(a,b)<0?a:b;
// A person-hour is 1/24 LSS. Persist the rational balance rather than rounding
// hourly consumption or forcing repeating fractions into decimal cargo strings.
export function supportAmount(value){
 if(value&&typeof value==='object'&&Object.hasOwn(value,'numerator')){
  if(typeof value.numerator!=='string'||typeof value.denominator!=='string'||!/^-?\d{1,100}$/.test(value.numerator)||!/^\d{1,100}$/.test(value.denominator)||BigInt(value.denominator)<=0n)throw Error('Invalid exact life support quantity.');
  return rat(value.numerator,value.denominator);
 }
 return dec(value);
}
export function supportDisplay(value,places=6){
 const x=supportAmount(value);
 try{return decimal(x);}catch{
  const scale=10n**BigInt(places),scaled=floor(mul(x,scale));
  return decimal(rat(scaled,scale));
 }
}
export function supportComplement(ship){
 // Old supportOccupants records were billing inputs, not a confirmed manifest.
 const a=ship.accommodation;
 const known=!!a&&['passengers','crew'].every(role=>['low','middle','high'].every(t=>Number.isSafeInteger(a[role]?.[t])&&a[role][t]>=0));
 const awake=known?['passengers','crew'].reduce((n,r)=>n+(a[r]?.low??0)+(a[r]?.middle??0)+(a[r]?.high??0),0):0;
 const frozen=ship.accommodation?.occupiedLowBerths??0;
 if(!Number.isSafeInteger(frozen)||frozen<0)throw Error('Occupied low berths must be a non-negative whole number.');
 return {known,awakePeople:awake,occupiedLowBerths:frozen,dailyUnits:add(awake,mul(frozen,'0.1'))};
}
// Deliberately separate billing from physical consumption, even though the
// approved extra-supply house rule currently uses the same person-equivalents.
export function extraSupportHeadcount(ship){const q=supportComplement(ship);if(!q.known)throw Error('Enter the awake complement before buying extra supplies.');return add(q.awakePeople,mul(q.occupiedLowBerths,'0.1'));}
export function validateSupport(ship){
 supportComplement(ship);
 const x=ship.lifeSupport;if(x===undefined)return;
 if(!x||!Number.isSafeInteger(x.capacityHours)||x.capacityHours<1)throw Error('Life support refill target must be positive, in whole hours.');
 if(x.stockUnits!==undefined){
  if(cmp(supportAmount(x.stockUnits),0)<0)throw Error('Life support stock cannot be negative.');
  if(x.remainingHours!==undefined||x.elapsedHours!==undefined||x.migrationRequired!==undefined)throw Error('Physical life support must have one stock balance.');
  return;
 }
 if(!Number.isSafeInteger(x.remainingHours)||x.remainingHours<0||x.remainingHours>x.capacityHours)throw Error('Life support remaining must be between zero and capacity, in whole hours.');
 if(x.elapsedHours!==undefined&&(!Number.isSafeInteger(x.elapsedHours)||x.elapsedHours<0||x.elapsedHours>=24||x.remainingHours%24!==0||x.capacityHours%24!==0))throw Error('Invalid legacy whole-day life support stock.');
 if(x.migrationRequired!==undefined&&x.migrationRequired!==true)throw Error('Invalid life support migration marker.');
}
export function monthlySupport(ship){const a=occupants(ship),rooms=roomCounts(ship);return tiers.reduce((n,t)=>n+BigInt(rooms[t]??0)*BigInt(serviceRate(t,ship.accommodation?.roomService?.[t]))+BigInt((a.passengers?.[t]??0)+(a.crew?.[t]??0))*BigInt(personRate(t)),0n)+BigInt(ship.accommodation?.bookedLowSupport??0)*100n;}
function legacyHours(x){return Math.max(0,x.remainingHours-(x.elapsedHours??0));}
export function supportMigration(ship){
 const x=ship.lifeSupport,c=supportComplement(ship);
 if(!x)return {possible:false,reason:'Record the life support supplies actually aboard first.'};
 if(x.stockUnits!==undefined)return {possible:true,reason:null};
 if(!legacyHours(x))return {possible:true,reason:null};
 if(x.migrationRequired)return {possible:false,reason:'Confirm the supplies actually aboard: the earlier complement was unknown or zero.'};
 if(!c.known||cmp(c.dailyUnits,0)<=0)return {possible:false,reason:'Legacy days need a known, positive complement before they can become physical LSS. Enter actual LSS to resolve recorded legacy inventory.'};
 return {possible:true,reason:null};
}
function unitsOf(ship){
 const x=ship.lifeSupport;if(!x)return null;
 if(x.stockUnits!==undefined)return supportAmount(x.stockUnits);
 if(!supportMigration(ship).possible)return null;
 return mul(supportComplement(ship).dailyUnits,div(legacyHours(x),24));
}
export function supportInternalCapacity(ship){const hull=ship.fuel?.displacementTons;return Number.isSafeInteger(hull)&&hull>0?mul(hull,4):null;}
export function supportCargo(ship){
 // Unconverted legacy records retain their old capacity contract until a
 // reversible transition adopts the physical model; validation never migrates.
 if(ship.lifeSupport?.stockUnits===undefined)return rat(0);
 const capacity=supportInternalCapacity(ship);if(capacity===null)return rat(0);
 return mul(maxZero(sub(unitsOf(ship),capacity)),'0.01');
}
export function supportStock(ship){
 validateSupport(ship);
 const x=ship.lifeSupport,c=supportComplement(ship),units=unitsOf(ship),capacity=supportInternalCapacity(ship);
 const targetDays=x?supportDisplay(div(x.capacityHours,24)):'28';
 const days=units!==null&&c.known&&cmp(c.dailyUnits,0)>0?div(units,c.dailyUnits):null;
 const internal=units!==null&&capacity!==null?minimum(units,capacity):null;
 const cargo=units!==null&&capacity!==null?mul(maxZero(sub(units,capacity)),'0.01'):null;
 return {tracked:!!x,legacy:!!x&&x.stockUnits===undefined,complementKnown:c.known,awakePeople:c.awakePeople,occupiedLowBerths:c.occupiedLowBerths,dailyUnits:supportDisplay(c.dailyUnits),
  remainingUnits:units===null?null:supportDisplay(units),remainingDays:days===null?null:supportDisplay(days),targetDays,capacityDays:targetDays,
  legacyDays:x&&x.stockUnits===undefined?supportDisplay(div(legacyHours(x),24)):null,
  internalCapacityUnits:capacity===null?null:supportDisplay(capacity),internalUnits:internal===null?null:supportDisplay(internal),cargoTons:cargo===null?null:supportDisplay(cargo),
  stockUnits:units===null?null:auditNumber(units),daysExact:days===null?null:auditNumber(days),cargoExact:cargo===null?null:auditNumber(cargo),migration:supportMigration(ship)};
}
// Called only inside an undoable transition, before the action can change the
// complement. Never normalize legacy saves in validate, load, import or Undo.
export function anchorSupport(ship,{complementShip=ship}={}){
 const x=ship.lifeSupport;if(!x||x.stockUnits!==undefined)return;
 const units=unitsOf(complementShip);
 if(units===null){x.migrationRequired=true;return;}
 ship.lifeSupport={capacityHours:x.capacityHours,stockUnits:auditNumber(units)};
}
export function configureSupport(ship,{targetDays=ship.lifeSupport?supportDisplay(div(ship.lifeSupport.capacityHours,24)):28,stockDays,stockUnits}={}){
 const hours=mul(targetDays,24);
 if(hours.d!==1n||hours.n<1n||hours.n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('The normal refill target must be positive, in whole hours.');
 const capacityHours=Number(hours.n);
 if(stockDays!==undefined&&stockUnits!==undefined)throw Error('Record either LSS or days of supplies, not both.');
 if(stockUnits!==undefined){const units=supportAmount(stockUnits);if(cmp(units,0)<0)throw Error('Life support stock cannot be negative.');return {capacityHours,stockUnits:auditNumber(units)};}
 if(stockDays!==undefined){
  if(cmp(stockDays,0)<0)throw Error('Life support days cannot be negative.');
  const c=supportComplement(ship);
  if(cmp(stockDays,0)>0&&(!c.known||cmp(c.dailyUnits,0)<=0))throw Error('Enter a positive awake / occupied-low-berth complement, or record actual LSS instead of days.');
  return {capacityHours,stockUnits:auditNumber(mul(stockDays,c.dailyUnits))};
 }
 if(!ship.lifeSupport)return {capacityHours,stockUnits:auditNumber(0)};
 const prior=structuredClone(ship);anchorSupport(prior);
 return {...prior.lifeSupport,capacityHours};
}
export function consumeSupport(ship,hours,{complementShip=ship}={}){
 if(!Number.isSafeInteger(hours)||hours<0)throw Error('Life support consumption needs non-negative whole hours.');
 if(!ship.lifeSupport)return;
 anchorSupport(ship,{complementShip});
 if(ship.lifeSupport.stockUnits===undefined)return; // Unknown legacy quantity is preserved, never invented.
 const c=supportComplement(complementShip);if(!c.known)return;
 ship.lifeSupport.stockUnits=auditNumber(maxZero(sub(supportAmount(ship.lifeSupport.stockUnits),mul(c.dailyUnits,div(hours,24)))));
}
export function refillQuote(s,{extraDays='0',comfortCost='0',comfortNote=''}={}){
 s={...s,ship:passengerShip(s)};
 validateSupport(s.ship);const x=s.ship.lifeSupport;if(!x)throw Error('Set life support supplies first.');
 const stock=unitsOf(s.ship),c=supportComplement(s.ship),internalCapacity=supportInternalCapacity(s.ship);
 if(stock===null)throw Error(supportMigration(s.ship).reason);
 if(!c.known||cmp(c.dailyUnits,0)<=0)throw Error('Enter a positive awake / occupied-low-berth complement before buying supplies.');
 if(internalCapacity===null)throw Error('Enter ship displacement before buying life support supplies.');
 if(cmp(extraDays,0)<0)throw Error('Extra days cannot be negative.');
 extraDays=dec(extraDays);const targetDays=div(x.capacityHours,24),target=mul(c.dailyUnits,targetDays),standardUnits=maxZero(sub(target,stock));
 const afterStandard=add(stock,standardUnits),extraUnits=maxZero(sub(mul(c.dailyUnits,add(targetDays,extraDays)),afterStandard));
 const purchased=add(standardUnits,extraUnits),after=add(stock,purchased),standardDays=div(standardUnits,c.dailyUnits),extraPurchasedDays=div(extraUnits,c.dailyUnits),monthly=monthlySupport(s.ship),billingHeadcount=extraSupportHeadcount(s.ship);
 if(cmp(standardUnits,0)>0&&monthly<=0n)throw Error('Enter cabin and person service charges before buying a standard top-up.');
 const standardExact=mul(monthly,div(standardDays,28)),extraExact=mul(mul(billingHeadcount,1000),div(extraPurchasedDays,28));
 const standardAmount=up(standardExact,creditStep(s)),extraAmount=up(extraExact,100);
 const comfort=credit(comfortCost);if(comfort<0n)throw Error('Comfort provisions cost cannot be negative.');
 if(typeof comfortNote!=='string'||comfort>0n&&!comfortNote.trim())throw Error('Add a note for optional comfort provisions.');
 const comfortAmount=up(comfort,creditStep(s)),beforeDays=div(stock,c.dailyUnits),afterDays=div(after,c.dailyUnits),beforeCargo=mul(maxZero(sub(stock,internalCapacity)),'0.01'),afterCargo=mul(maxZero(sub(after,internalCapacity)),'0.01');
 return {capacityHours:x.capacityHours,targetDays:supportDisplay(targetDays),beforeUnits:supportDisplay(stock),afterUnits:supportDisplay(after),beforeDays:supportDisplay(beforeDays),afterDays:supportDisplay(afterDays),
  standardDays:supportDisplay(standardDays),extraDays:supportDisplay(extraDays),extraPurchasedDays:supportDisplay(extraPurchasedDays),standardUnits:supportDisplay(standardUnits),extraUnits:supportDisplay(extraUnits),purchasedUnits:supportDisplay(purchased),
  internalCapacityUnits:supportDisplay(internalCapacity),afterInternalUnits:supportDisplay(minimum(after,internalCapacity)),beforeCargoTons:supportDisplay(beforeCargo),afterCargoTons:supportDisplay(afterCargo),
  beforeStockUnits:auditNumber(stock),afterStockUnits:auditNumber(after),purchasedStockUnits:auditNumber(purchased),beforeCargoExact:auditNumber(beforeCargo),afterCargoExact:auditNumber(afterCargo),
  monthly:String(monthly),standardAmount:String(standardAmount),extraAmount:String(extraAmount),comfortAmount:String(comfortAmount),comfortNote:comfortNote.trim(),amount:String(standardAmount+extraAmount+comfortAmount),
  standardExact:auditNumber(standardExact),extraExact:auditNumber(extraExact),extraHeadcount:supportDisplay(billingHeadcount),extraRate:'1000',extraBillingDays:28,extraRoundingStep:100,extraPricingLabel:'Home rule',
  awakePeople:c.awakePeople,occupiedLowBerths:c.occupiedLowBerths,dailyUnits:supportDisplay(c.dailyUnits),reference:supportReference,extraReference:extraSupportReference};
}
