import {maintenancePaymentQuote,MAINTENANCE_REFERENCE} from './maintenance.mjs?v=settings-completion-20261010-45';
import {mortgagePaymentQuote,MORTGAGE_REFERENCE} from './mortgage.mjs?v=settings-completion-20261010-45';
import {fuelPurchase,fuelReference} from './fuel.mjs?v=settings-completion-20261010-45';
import {up} from './rounding.mjs?v=settings-completion-20261010-45';
import * as A from './amounts.mjs';
import {monthlyRates,serviceRate,serviceLabel,personMonthlyRate,personRate} from './accommodation.mjs?v=settings-completion-20261010-45';

export const berthMultipliers={A:1000,B:500,C:100,D:10,E:0,X:0};
export function starport(world){return (world.overrideUWP||world.uwp).slice(0,1).toUpperCase();}
export function berthRate(world){
 const port=starport(world),multiplier=berthMultipliers[port];
 if(multiplier===undefined)throw Error('Set a known starport class before calculating berthing.');
 if(!multiplier)return {port,die:null,multiplier,weekly:'0'};
 const rate=world.berthingRate;
 if(rate?.port!==port||!Number.isInteger(rate.die)||rate.die<1||rate.die>6)throw Error('Roll and save this starport’s berthing rate first.');
 return {port,die:rate.die,multiplier,weekly:String(rate.die*multiplier)};
}
function count(value,label){const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw Error(label+' must be a positive whole number.');return n;}
function people(value,label){const n=Number(value??0);if(!Number.isSafeInteger(n)||n<0)throw Error(label+' must be a non-negative whole number.');return n;}
export const supportRates=monthlyRates;
function period(input){if(!['week','month'].includes(input.period))throw Error('Choose weeks or months.');return {units:count(input.units,'Billing periods'),divisor:input.period==='week'?4n:1n};}
export function fuelAvailability(world,type){
 const port=starport(world),uwp=world.overrideUWP||world.uwp,hydro=uwp[3],atmosphere=uwp[2];
 const water=world.accessibleWater===true||(/^[1-9A]$/i.test(hydro)&&(['D','E'].includes(port)||/^[0-9]$/.test(atmosphere)));
 const standard=type==='water'?water:type==='refined'?['A','B'].includes(port):type==='unrefined'&&['A','B','C','D'].includes(port);
 return {port,hydro,water,standard};
}
// Custom changes only the local price. Physical grade and purchase availability
// stay explicit; collection remains a separate, free source.
export function fuelPricing(world,input){
 const type=input.fuelType;if(!['refined','unrefined','water'].includes(type))throw Error('Choose a fuel source.');
 const collecting=type==='water',{hydro,standard}=fuelAvailability(world,type),custom=input.customFuelRate!==undefined;
 if(collecting&&custom)throw Error('Water collection is free; choose a purchased fuel grade for custom pricing.');
 const rate=custom?A.decimal(input.customFuelRate):String(collecting?0:type==='refined'?500:100);
 if(A.cmp(rate,0)<0)throw Error('Fuel price cannot be negative.');
 return {type,collecting,hydro,standard,custom,rate};
}
export function recurringExpenseDetails(expense){
 if(expense.kind==='mortgage'){const q=expense.mortgage;return [['Original mortgage amount · Cr',q.before.originalAmount],['Fixed payment · Cr / 4 weeks',q.before.payment],['Payments paid now',String(q.periods)],['First installment due',q.firstDueDate],['Paid through installment due',q.lastDueDate],['Payments remaining before',String(q.before.remainingPayments)],['Payments remaining after',String(q.after.remainingPayments)],['Total paid before · Cr',q.before.totalPaid],['Total paid after · Cr',q.after.totalPaid],['Remaining scheduled payments · Cr',q.remainingAmount],['Next unpaid payment due',q.after.remainingPayments?q.after.nextDueDate:'None · all scheduled payments paid']];}
 if(expense.kind==='maintenance'){const q=expense.maintenance;return [['Monthly cost · Cr / 4 weeks',q.before.payment],['Payments paid now',String(q.periods)],['First installment due',q.firstDueDate],['Paid through installment due',q.lastDueDate],['Next unpaid payment due',q.after.nextDueDate],['Paid since tracking before · Cr',q.before.paidSinceTracking],['Paid since tracking after · Cr',q.after.paidSinceTracking]];}
 return expense.details;
}
export function expenseQuote(world,input){
 if(world.emptySpace&&['berthing','staterooms','passengerSupport'].includes(input.kind))throw Error('No starport or life-support supply in empty space.');
 const kind=input.kind,notes=String(input.notes||'').trim(),port=starport(world);
 if(kind==='maintenance'){
  const q=maintenancePaymentQuote({ship:input.recurringShip||{}},input.maintenancePayments);
  const details=recurringExpenseDetails({kind,maintenance:q});
  return {kind,label:'Monthly maintenance',amount:q.amount,details,reference:MAINTENANCE_REFERENCE+' Fixed costs are paid exactly as recorded, unaffected by Credit rounding.',notes,worldId:world.id,worldName:world.name,fixedAmount:true,maintenance:q};
 }
 if(kind==='mortgage'){
  const q=mortgagePaymentQuote({ship:input.recurringShip||{}},input.mortgagePayments);
  const details=recurringExpenseDetails({kind,mortgage:q});
  return {kind,label:'Mortgage payment',amount:q.amount,details,reference:MORTGAGE_REFERENCE+' Fixed amounts are paid exactly as recorded, unaffected by Credit rounding.',notes,worldId:world.id,worldName:world.name,fixedAmount:true,mortgage:q};
 }

 let amount,details,reference,unrounded;
 if(kind==='berthing'){
  const rate=berthRate(world),weeks=count(input.weeks,'Weeks');amount=String(BigInt(rate.weekly)*BigInt(weeks));
  details=[['Starport class',port],['Saved 1D roll',rate.die??'No roll required'],['Multiplier · Cr',String(rate.multiplier)],['Weekly berthing · Cr',rate.weekly],['Weeks paid',String(weeks)]];
  reference='Traveller Core Rulebook Update 2022, pp. 257–258. Roll once per starport; berthing is due weekly.';
 }else if(kind==='fuel'){
  const {type,collecting,hydro,standard,custom,rate}=fuelPricing(world,input);
  if(!collecting&&!standard&&(!input.otherSupplier||!notes))throw Error('No standard starport supply for this fuel. Confirm another supplier and explain in notes.');
  const requestedTons=A.positive(input.tons,'Fuel tons'),tons=String(up(requestedTons));
  unrounded=A.decimal(A.mul(tons,rate));amount=String(up(unrounded,input.creditStep||1));
  details=[['Fuel type',type==='refined'?'Refined':'Unrefined'],['Fuel tons',tons],['Entered fuel tons',requestedTons],['Rate · Cr/ton',rate],['Price basis',custom?'Custom local price':'Standard price'],['Starport class',port],['Hydrographics',hydro],['Supply',collecting?(standard?'Free water collection':'Free water collection / availability warning'):(standard?'Starport purchase':'Other supplier / referee-confirmed')]];
  reference='Traveller Core Rulebook Update 2022, pp. 154, 156–157, 257–258. Purchased refined Cr500/ton; purchased unrefined Cr100/ton. Campaign ruling: refined availability also includes unrefined; water collection is always selectable and free at any starport class. Missing or unsuitable hydrographics and planet information are advisory warnings only. Purchased fuel outside standard starport availability requires referee confirmation and notes. Collection equipment and access are resolved in play; collection time and fuel-grade mixing are resolved in play.';
  const tank=input.fuelShip?fuelPurchase(input.fuelShip,tons):null;
  if(tank)details.push(['Ship displacement - tons',String(tank.displacementTons)],['Tank capacity - tons',String(tank.capacity)],['Fuel aboard before - tons',String(tank.before)],['Fuel aboard after - tons',String(tank.after)]);
  if(custom)reference+=' A manually entered local Cr/ton price overrides the standard rate without changing fuel grade or purchase availability.';
  reference+=' '+fuelReference+(tank?' Confirming adds fuel to the tank.':' Fuel tracking is not configured; this records a payment only.');
 }else if(kind==='staterooms'||kind==='passengerSupport'){
  const {units,divisor}=period(input);let monthly=0n;details=[];
  if(kind==='staterooms'){
   const rooms=input.rooms??{low:0,middle:input.staterooms??0,high:0};let totalRooms=0;
   for(const tier of Object.keys(supportRates)){
    const n=people(rooms[tier],tier+' staterooms'),service=input.roomService?.[tier],rate=serviceRate(tier,service);
    totalRooms+=n;monthly+=BigInt(n)*BigInt(rate);
    details.push([tier+' staterooms (including empty)',String(n)+' x Cr'+rate+' / month / '+serviceLabel(tier,service)+' service']);
   }
   if(!totalRooms)throw Error('Enter at least one stateroom in ship settings.');
   details.push(['Total staterooms',String(totalRooms)]);
  }else{
   let totalPeople=0;
   for(const role of ['passengers','crew'])for(const tier of Object.keys(supportRates)){
    const rate=String(personRate(tier));
    const n=people(input[role]?.[tier],role+' · '+tier);totalPeople+=n;monthly+=BigInt(n)*BigInt(rate);
    details.push([(role==='crew'?'Crew':'Passengers')+' / '+tier,String(n)+' x Cr'+rate+' / month / selected service level']);
   }
   const low=people(input.bookedLowBerths,'Booked Low passengers');monthly+=BigInt(low)*100n;totalPeople+=low;if(low)details.push(['Booked frozen Low passengers',String(low)+' x Cr100 / month / Core p.154']);
   if(!totalPeople)throw Error('Enter at least one passenger or crew member.');
  }
  unrounded=A.decimal(A.rat(monthly*BigInt(units),divisor));amount=String(up(unrounded,input.creditStep||1));
  details.push(['Monthly total · Cr',String(monthly)],['Billing period',input.period],['Periods purchased',String(units)],['Weekly billing basis','One quarter of a monthly charge']);
  reference='Campaign rule agreed 2026-10-04: installed middle and high cabins cost Cr1,000/month each, including empty cabins. Middle-service people cost Cr1,000/month. Campaign change: High-passenger life support is raised from the Core Rulebook’s Cr1,000 to Cr3,000 per person per month. This includes crew receiving high service and upgraded middle-cabin occupants. Low-service cabin Cr100 and low-service person Cr1,000 are retained campaign settings, not RAW low-berth costs. A week is one quarter of a month. Cabin custom rates are per cabin; person service is charged separately. Historical payments are unchanged.';
 }else if(kind==='lifeSupport'||kind==='salary'){
  const monthly=A.credit(input.monthly),months=count(input.months,'Months');if(monthly<=0n)throw Error('Enter a positive monthly cost.');
  amount=String(monthly*BigInt(months));details=[['Entered monthly cost · Cr',String(monthly)],['Months paid',String(months)]];
  reference='Traveller Core Rulebook Update 2022, pp. 153–154 (running costs). This amount is entered by the user; months are manually selected billing periods.';
 }else throw Error('Choose an expense type.');
 const label={berthing:'Berthing',fuel:'Fuel',lifeSupport:'Life support',salary:'Crew salaries',staterooms:'Stateroom expenses',passengerSupport:'Passenger & crew life support'}[kind];
 const before=unrounded??amount;amount=String(up(amount,input.creditStep||1));details.push(['Rounding [R]','Credits up to '+(input.creditStep||1)+'; tons up to whole tons'],['Amount before final rounding · Cr',before]);
 return {kind,label,amount,details,reference,notes,roundingStep:input.creditStep||1,worldId:world.id,worldName:world.name};
}


export function zeroFuel(input){return input.kind==='fuel'&&String(input.tons??'').trim()!==''&&A.cmp(input.tons,0)===0;}
export function payableExpenses(inputs){return inputs.filter(input=>!zeroFuel(input));}
