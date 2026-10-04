import * as A from './amounts.mjs';
import {monthlyRates,serviceRate,serviceLabel} from './accommodation.mjs';

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
export function expenseQuote(world,input){
 const kind=input.kind,notes=String(input.notes||'').trim(),port=starport(world);
 let amount,details,reference;
 if(kind==='berthing'){
  const rate=berthRate(world),weeks=count(input.weeks,'Weeks');amount=String(BigInt(rate.weekly)*BigInt(weeks));
  details=[['Starport class',port],['Saved 1D roll',rate.die??'No roll required'],['Multiplier · Cr',String(rate.multiplier)],['Weekly berthing · Cr',rate.weekly],['Weeks paid',String(weeks)]];
  reference='Traveller Core Rulebook Update 2022, pp. 257–258. Roll once per starport; berthing is due weekly.';
 }else if(kind==='fuel'){
  const type=input.fuelType;if(!['refined','unrefined'].includes(type))throw Error('Choose refined or unrefined fuel.');
  const tons=A.positive(input.tons,'Fuel tons'),rate=type==='refined'?500:100;
  const standard=type==='refined'?['A','B'].includes(port):['C','D'].includes(port);
  if(!standard&&(!input.otherSupplier||!notes))throw Error('This fuel is not the listed starport supply. Confirm another supplier and enter a note.');
  amount=String(A.floor(A.mul(tons,rate)));
  if(A.credit(amount)<=0n)throw Error('Fuel purchase must total at least Cr1.');
  details=[['Fuel type',type==='refined'?'Refined':'Unrefined'],['Fuel tons',tons],['Rate · Cr/ton',String(rate)],['Starport class',port],['Supply',standard?'Listed starport supply':'Other supplier / referee-confirmed']];
  reference='Traveller Core Rulebook Update 2022, pp. 154, 257–258. Refined Cr500/ton; unrefined Cr100/ton. Final charge rounds down to whole Credits.';
 }else if(kind==='staterooms'||kind==='passengerSupport'){
  const {units,divisor}=period(input);let monthly=0n;details=[];
  if(kind==='staterooms'){
   const rooms=count(input.staterooms,'Ship staterooms');monthly=BigInt(rooms)*1000n;
   details.push(['Staterooms (including empty)',String(rooms)],['Monthly cost per stateroom · Cr','1000']);
  }else{
   let totalPeople=0;
   for(const role of ['passengers','crew'])for(const tier of Object.keys(supportRates)){
    const service=input[role+'Service']?.[tier],rate=serviceRate(tier,service);
    const n=people(input[role]?.[tier],role+' · '+tier);totalPeople+=n;monthly+=BigInt(n)*BigInt(rate);
    details.push([(role==='crew'?'Crew':'Passengers')+' · '+tier,String(n)+' × Cr'+rate+' / month · '+serviceLabel(tier,service)+' service']);
   }
   if(!totalPeople)throw Error('Enter at least one passenger or crew member.');
  }
  amount=String(monthly*BigInt(units)/divisor);
  details.push(['Monthly total · Cr',String(monthly)],['Billing period',input.period],['Periods purchased',String(units)],['Weekly billing basis','One quarter of a monthly charge']);
  reference='Campaign-agreed rates: Cr1,000 per stateroom per month, including empty rooms; per-person life support Cr100 low, Cr1,000 middle, Cr3,000 high per month. Service upgrades and custom monthly rates are entered in ship settings, independently of passage class. One billing month = four weeks; final charges round down to whole Credits. Luggage is separate from life-support supplies.';
 }else if(kind==='lifeSupport'||kind==='salary'){
  const monthly=A.credit(input.monthly),months=count(input.months,'Months');if(monthly<=0n)throw Error('Enter a positive monthly cost.');
  amount=String(monthly*BigInt(months));details=[['Entered monthly cost · Cr',String(monthly)],['Months paid',String(months)]];
  reference='Traveller Core Rulebook Update 2022, pp. 153–154 (running costs). This amount is entered by the user; months are manually selected billing periods.';
 }else throw Error('Choose an expense type.');
 const label={berthing:'Berthing',fuel:'Fuel',lifeSupport:'Life support',salary:'Crew salaries',staterooms:'Stateroom expenses',passengerSupport:'Passenger & crew life support'}[kind];
 return {kind,label,amount,details,reference,notes,worldId:world.id,worldName:world.name};
}
