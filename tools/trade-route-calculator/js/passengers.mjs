import {up} from './rounding.mjs?v=global-planet-search-20261010-29';
// Passenger contracts are authoritative. Effective ship values are derived only;
// never write them back into the manual crew / other-occupant baseline.
import * as A from './amounts.mjs';
import {roomTotal,luggageAllowance,passengerLuggage,manualLuggage} from './accommodation.mjs?v=global-planet-search-20261010-29';
import {PASSAGE_CLASSES} from './passenger-rules.mjs?v=global-planet-search-20261010-29';
export const passengerReference='Core Rulebook Update 2022, pp. 158, 238–239. Generated fares cover one jump. Payment on explicit destination delivery is an app convention; no automatic lateness penalty.';
export const bookingLuggage={high:'1',middle:'0',basic:'0.01',low:'0.01'};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_,.:-]{1,100}$/.test(x);
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const whole=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
export const passengerBookings=s=>s.contracts.filter(c=>c.kind==='passenger');
export const activePassengers=s=>passengerBookings(s).filter(c=>c.status==='accepted');
export function passengerTotals(s){const counts={low:0,basic:0,middle:0,high:0};for(const c of activePassengers(s)){if(!PASSAGE_CLASSES.includes(c.passageClass)||!whole(c.count,1))throw Error('Invalid passenger count or class.');counts[c.passageClass]+=c.count;}if(!Object.values(counts).every(n=>whole(n)))throw Error('Passenger count is too large.');return {...counts,awake:counts.basic+counts.middle+counts.high,total:Object.values(counts).reduce((a,b)=>a+b,0)};}
export const passengerSpace=s=>A.sum(activePassengers(s).filter(c=>c.cabinMode==='cargo').map(c=>A.mul(c.count,2)));
export function passengerShip(s){
 const booked=passengerTotals(s);if(!booked.total)return s.ship;
 const base=s.ship.accommodation;if(!base)throw Error('Review the existing crew and people aboard before boarding passengers.');
 const a={...base,passengers:{...base.passengers,middle:(base.passengers.middle||0)+booked.basic+booked.middle,high:(base.passengers.high||0)+booked.high},crew:{...base.crew},occupiedLowBerths:(base.occupiedLowBerths||0)+booked.low};
 // Preserve an explicit whole-ship total, including zero. Otherwise combine the
 // unrounded baseline with all booking allowances and round once downstream.
 Object.defineProperty(a,'bookedLowSupport',{value:booked.low,enumerable:false});
 const manual=manualLuggage(s.ship);
 const baseline=base.combinedPeople?String((base.passengers.high||0)+(base.crew.high||0)):luggageAllowance(s.ship);
 a.luggageMode='manual';a.luggageTons=manual?base.luggageTons:A.decimal(A.sum([baseline,...PASSAGE_CLASSES.map(t=>A.mul(booked[t],bookingLuggage[t]))]));
 return {...s.ship,accommodation:a};
}
export function passengerCapacity(s){
 const setup=s.ship.accommodation?.passengerCapacity,active=activePassengers(s),shared={high:0,middle:0,basic:0};let cabins=0;
 for(const c of active){if(c.cabinMode==='private')cabins+=c.count;else if(c.cabinMode==='shared')shared[c.passageClass]=(shared[c.passageClass]||0)+c.count;}
 cabins+=Object.values(shared).reduce((n,count)=>n+Math.ceil(count/2),0);
 const totals=passengerTotals(s),installed=roomTotal(s.ship),baselineLow=s.ship.accommodation?.occupiedLowBerths||0;
 return {configured:!!setup,installedCabins:installed,reservedCabins:setup?.reservedCabins??null,bookedCabins:cabins,freeCabins:setup?installed-setup.reservedCabins-cabins:null,installedLowBerths:setup?.installedLowBerths??null,occupiedLowBerths:baselineLow+totals.low,freeLowBerths:setup?setup.installedLowBerths-baselineLow-totals.low:null,counts:totals,cargoSpace:A.decimal(passengerSpace(s)),luggage:passengerLuggage(passengerShip(s))};
}
export function validatePassengerSetup(s){
 const a=s.ship.accommodation,q=a?.passengerCapacity;if(q===undefined)return;
 if(!record(q)||!whole(q.reservedCabins)||!whole(q.installedLowBerths)||q.reservedCabins>roomTotal(s.ship))throw Error('Passenger setup needs valid reserved cabins and installed Low berths.');
 const capacity=passengerCapacity(s);if(capacity.freeCabins<0)throw Error('Passenger bookings exceed available cabins.');if(capacity.freeLowBerths<0)throw Error('Occupied Low berths exceed installed capacity.');
}
export function latestPassengerSearch(s){return s.latestPassengerSearchId?s.events.find(e=>e.id===s.latestPassengerSearchId&&e.label==='Passenger search audit'):null;}
export function passengerOfferRemaining(s,offer){return offer.count-passengerBookings(s).filter(c=>c.offerId===offer.offerId).reduce((n,c)=>n+c.count,0);}
export function validatePassengerContract(s,c){
 if(!['accepted','delivered'].includes(c.status)||!PASSAGE_CLASSES.includes(c.passageClass)||!whole(c.count,1)||!id(c.offerId)||!id(c.searchId)||!s.worlds[c.origin]||!s.worlds[c.destination]||c.origin===c.destination||!whole(c.acceptedHours)||!record(c.audit)||!['private','shared','cargo','low'].includes(c.cabinMode)||c.passageClass==='low'&&c.cabinMode!=='low'||c.passageClass!=='low'&&c.cabinMode==='low'||c.cabinMode==='cargo'&&c.passageClass!=='basic')throw Error('Invalid passenger booking.');
 if(['quantity','dueHours','late','penaltyDie','firstDeparture','acceptanceEventId'].some(k=>Object.hasOwn(c,k)))throw Error('Passenger bookings cannot contain freight or mail terms.');
 if(![1,100].includes(c.roundingStep)||A.credit(c.payment)!==up(A.mul(c.fare,c.count),c.roundingStep)||A.credit(c.fare)<0n||A.credit(c.payment)<0n||c.serviceConfirmed!==true&&['high','middle'].includes(c.passageClass)||c.cabinMode==='cargo'&&c.spaceConfirmed!==true)throw Error('Invalid passenger terms or service confirmation.');
 const search=s.events.find(e=>e.id===c.searchId&&e.label==='Passenger search audit'),offer=search?.offers?.find(o=>o.offerId===c.offerId);
 if(!offer||offer.passageClass!==c.passageClass||offer.origin!==c.origin||offer.destination!==c.destination||A.cmp(offer.fare,c.fare)!==0||passengerOfferRemaining(s,offer)<0)throw Error('Passenger booking does not match its recorded availability.');
 if(c.status==='delivered'){
  if(!whole(c.deliveredHours)||A.credit(c.payout)!==A.credit(c.payment))throw Error('Invalid passenger delivery.');
  const receipts=s.ledger.filter(e=>e.contractId===c.id&&e.type==='Passenger delivery');if(receipts.length!==1||A.credit(receipts[0].amount)!==A.credit(c.payout)||receipts[0].world!==c.destination||receipts[0].hours!==c.deliveredHours)throw Error('Passenger delivery receipt does not reconcile.');
 }else if(Object.hasOwn(c,'payout')||Object.hasOwn(c,'deliveredHours')||s.ledger.some(e=>e.contractId===c.id&&e.type==='Passenger delivery'))throw Error('Uncompleted passenger booking has a payout.');
}
export function validatePassengerHistory(s){
 if(s.latestPassengerSearchId!=null&&(!id(s.latestPassengerSearchId)||!latestPassengerSearch(s)))throw Error('Passenger search reference is invalid.');
 const ids=new Set();for(const e of s.events.filter(e=>e.label==='Passenger search audit')){
  if(!s.worlds[e.world]||!s.worlds[e.destination]||e.world===e.destination||!whole(e.hours)||!Array.isArray(e.offers)||e.offers.length!==4)throw Error('Invalid passenger search audit.');
  const classes=new Set();for(const o of e.offers){if(!record(o)||!id(o.offerId)||ids.has(o.offerId)||classes.has(o.passageClass)||!PASSAGE_CLASSES.includes(o.passageClass)||!whole(o.count)||o.origin!==e.world||o.destination!==e.destination||A.credit(o.fare)<0n||!record(o.audit))throw Error('Invalid passenger availability audit.');ids.add(o.offerId);classes.add(o.passageClass);}
 }
 if(activePassengers(s).length&&!s.ship.accommodation?.passengerCapacity)throw Error('Review passenger cabin and berth capacity before boarding.');
 validatePassengerSetup(s);
}
