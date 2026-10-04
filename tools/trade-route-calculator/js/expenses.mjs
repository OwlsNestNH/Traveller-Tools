import * as A from './amounts.mjs';

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
 }else if(kind==='lifeSupport'||kind==='salary'){
  const monthly=A.credit(input.monthly),months=count(input.months,'Months');if(monthly<=0n)throw Error('Enter a positive monthly cost.');
  amount=String(monthly*BigInt(months));details=[['Entered monthly cost · Cr',String(monthly)],['Months paid',String(months)]];
  reference='Traveller Core Rulebook Update 2022, pp. 153–154 (running costs). This amount is entered by the user; months are manually selected billing periods.';
 }else throw Error('Choose an expense type.');
 const label={berthing:'Berthing',fuel:'Fuel',lifeSupport:'Life support',salary:'Crew salaries'}[kind];
 return {kind,label,amount,details,reference,notes,worldId:world.id,worldName:world.name};
}
