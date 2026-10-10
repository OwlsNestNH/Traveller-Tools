import {passengerShip,passengerTotals,passengerSpace} from './passengers.mjs?v=service-completion-20261010-38';
import {supportStock,supportCargo,supportDisplay,supportReference} from './life-support.mjs?v=service-completion-20261010-38';
import {bladderSpace} from './fuel.mjs?v=service-completion-20261010-38';
import * as A from './amounts.mjs';
import {displayDate} from './calendar.mjs';
import {occupants,passengerLuggage,serviceLabel,serviceRate,roomCounts,roomTotal,personMonthlyRate,personRate} from './accommodation.mjs?v=service-completion-20261010-38';
import {distance} from './map.mjs?v=service-completion-20261010-38';

export const REPORT_VERSION='2026.10.10.38';
const clean=v=>String(v??'Not recorded').replace(/[\r\n\t\x00-\x1f]+/g,' ').trim();
const number=v=>String(v).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const cr=v=>v==null?'Not recorded':'Cr '+number(v);
const total=xs=>xs.reduce((n,x)=>n+BigInt(x??0),0n);
// Ratios are explanatory, never used to change saved money.
function ratio(a,b){
 if(a==null||b==null||A.cmp(b,0)<=0)return null;
 const r=A.mul(A.div(a,b),100),scaled=A.floor(A.add(A.mul(r,100),'0.5'));
 return A.decimal(A.rat(scaled,100n));
}
export function campaignReport(s,core,{exportedAt=new Date()}={}){
 const booked=passengerTotals(s),passengerAccommodation=passengerSpace(s);s={...s,ship:passengerShip(s)};
 const out=[],line=(k,v)=>out.push((k+':').padEnd(35)+clean(v)),section=t=>out.push('',t,'-'.repeat(t.length));
 const world=id=>{const w=s.worlds[id];return w?clean(w.name)+' ('+clean(w.sector)+' '+clean(w.hex)+')':'Not recorded';};
 const goods=id=>core.commodities.find(g=>g.id===id);
 const date=h=>displayDate(s.dateLabel,h??0);
 const sales=s.ledger.filter(e=>e.type==='Sale'),expenses=s.ledger.filter(e=>e.type.startsWith('Ship expense')||e.type==='Manual expense');
 const complete=sales.every(e=>e.audit?.adjusted!=null);
 const retained=total(sales.map(e=>e.audit?.adjusted)),operating=-total(expenses.map(e=>e.amount));
 const income=total(s.ledger.filter(e=>['Freight delivery','Mail delivery'].includes(e.type)).map(e=>e.amount)),passengerIncome=total(s.ledger.filter(e=>e.type==='Passenger delivery').map(e=>e.amount));
 out.push('TRAVELLER SHIP OPERATIONS - CAMPAIGN REPORT');
 line('Campaign',s.name);line('Ship',s.ship.name);line('Campaign date',date(s.hours));line('Current system',world(s.actual));
 line('Exported',exportedAt.toISOString());line('Calculator version',REPORT_VERSION);
 section('SHIP & OCCUPANTS');
 const cargo=A.sum(s.lots.map(l=>l.quantity)),freight=A.sum(s.contracts.filter(c=>c.status==='accepted'&&c.kind!=='passenger').map(c=>c.quantity)),luggage=passengerLuggage(s.ship);
 line('Cargo capacity',s.ship.capacity+' tons');line('Speculative cargo aboard',A.decimal(cargo)+' tons');line('Freight / mail aboard',A.decimal(freight)+' tons');line('Passenger luggage',luggage+' tons');line('Basic passenger accommodation',A.decimal(passengerAccommodation)+' tons');if(booked.total)line('Booked passengers aboard',booked.total+' ('+booked.high+' High, '+booked.middle+' Middle, '+booked.basic+' Basic, '+booked.low+' Low; already included in support totals)');
 line('Cargo space used by fuel in bladders',bladderSpace(s.ship)+' tons');line('Cargo space used by life support',supportStock(s.ship).cargoTons===null?'Unknown until stock and hull are recorded':supportDisplay(supportCargo(s.ship))+' tons');line('Space available',supportDisplay(A.sub(s.ship.capacity,A.sum([cargo,freight,luggage,passengerAccommodation,bladderSpace(s.ship),supportCargo(s.ship)])))+' tons');
 line('Jump rating',s.ship.jump);if(s.ship.fuel){line('Ship displacement',s.ship.fuel.displacementTons+' tons');line('Jump fuel aboard / capacity',s.ship.fuel.aboardTons+' / '+s.ship.fuel.capacityTons+' tons');line('Fuel scope','Jump fuel only; power-plant fuel excluded.');}line('Staterooms (all, including empty)',roomTotal(s.ship));
 for(const tier of ['low','middle','high']){const service=s.ship.accommodation?.roomService?.[tier];line('  '+tier+' staterooms',roomCounts(s.ship)[tier]+'; '+serviceLabel(tier,service)+' service; '+cr(serviceRate(tier,service))+'/room/month');}
 line('Cost basis','Campaign rates; weekly charges are one quarter of monthly rates.');
 const occ=occupants(s.ship);
 if(s.ship.accommodation?.combinedPeople)line('People aboard (crew + passengers)',['passengers','crew'].reduce((n,r)=>n+['low','middle','high'].reduce((v,t)=>v+(occ[r]?.[t]??0),0),0));
 else for(const role of ['passengers','crew']){
  line(role==='crew'?'Crew aboard':'Passengers aboard',['low','middle','high'].map(t=>(occ[role]?.[t]??0)+' '+t).join(' / '));
  for(const tier of ['low','middle','high'])if(occ[role]?.[tier]){
   line('  '+role+' / '+tier+' support',cr(personRate(tier))+'/person/month, additional to stateroom expenses');
  }
 }
 if(s.ship.accommodation?.combinedPeople)line('People receiving high service',(occ.passengers?.high??0)+(occ.crew?.high??0));
 if(s.ship.lifeSupport){const q=supportStock(s.ship);line('Life support stock',q.remainingUnits===null?'Legacy days; actual LSS needs confirmation':q.remainingUnits+' LSS');line('Life support days / refill target',(q.remainingDays??'Unknown at current complement')+' / '+q.targetDays);line('Awake people / occupied low berths',q.awakePeople+' / '+q.occupiedLowBerths);line('Life support consumption',q.complementKnown?q.dailyUnits+' LSS/day':'Unknown complement');line('Internal life support capacity',q.internalCapacityUnits===null?'Unknown until hull displacement is recorded':q.internalCapacityUnits+' LSS');line('Life support source',supportReference);if(q.legacy)line('Legacy life support',q.migration.possible?'Converts inside the next reversible campaign change.':q.migration.reason);}
 section('FINANCIAL SUMMARY');
 const opening=s.ledger.find(e=>e.type==='Opening bank');
 line('Opening bank',cr(opening?.amount));line('Current bank',cr(s.bank));
 if(s.ship.mortgage){
  const m=s.ship.mortgage;
  line('Original mortgage amount',cr(m.originalAmount));line('Mortgage / 4 weeks (28 days)',cr(m.payment));
  line('Mortgage payments remaining',m.remainingPayments);line('Mortgage total paid',cr(m.totalPaid));
  line('Mortgage scheduled amount remaining',cr(BigInt(m.payment)*BigInt(m.remainingPayments)));
  line('Next unpaid mortgage due',m.remainingPayments?m.nextDueDate:'None - all scheduled payments paid');
  line('Paid through installment due',m.lastPaidDueDate??'Prior installment dates not recorded');
  out.push('Mortgage is fixed-installment tracking. Original amount is retained; scheduled payments remaining are not principal or an early-payoff amount.');
 }

 if(s.ship.maintenance){
  const m=s.ship.maintenance;
  line('Maintenance / 4 weeks (28 days)',cr(m.payment));line('Maintenance next unpaid due',m.nextDueDate);
  line('Maintenance paid since tracking',cr(m.paidSinceTracking));
  line('Maintenance paid through due',m.lastPaidDueDate??'Prior installment dates not recorded');
 }
 if(opening)line('Bank change since opening',cr(BigInt(s.bank)-BigInt(opening.amount)));
 line('Cargo remaining cost basis',cr(total(s.lots.map(l=>l.basis))));
 line('Realized trading profit / loss',complete?cr(retained):'Incomplete historical sale records');
 line('Freight / mail income',cr(income));line('Passenger income',cr(passengerIncome));line('Recorded operating expenses',cr(operating));
 line(passengerIncome?'Trading + transport - expenses':'Trading + freight - expenses',complete?cr(retained+income+passengerIncome-operating):'Not available');
 line('Recorded insurance payments',cr(total(s.ledger.filter(e=>e.type==='Insurance claim').map(e=>e.amount))));
 line('Current profit setting',s.settings.profit+'% of positive profit [1]');
 line('Optional tax',s.settings.tax?'Enabled [T]':'Disabled');
 out.push('Bank movement includes cargo purchases and other adjustments; it is not profit.',
 'Unsold cargo is not realized profit. Only recorded expenses are included.',
 'The operating result excludes insurance payments, cargo write-offs and bank corrections.');
 section('PLANNED ROUTE');
 if(!s.route.length)out.push('No route planned.');
 s.route.forEach((id,i)=>{
  const w=s.worlds[id],previous=s.worlds[s.route[i-1]],leg=i&&w&&previous?'; '+distance(previous,w)+' pc from previous stop':'';
  out.push((i+1)+'. '+world(id)+(i===s.routeIndex&&id===s.actual?' <-- Current system':'')+(w?'; '+w.zone:'')+leg);
 });
 if(s.route.length){line('Progress on this route',s.routeIndex+' of '+Math.max(0,s.route.length-1)+' jumps');line('Next destination',s.route[s.routeIndex+1]?world(s.route[s.routeIndex+1]):'Route complete');}
 section('CARGO ABOARD');
 if(!s.lots.length)out.push('None.');
 s.lots.forEach((l,i)=>{
  const g=goods(l.commodity),price=l.audit?.price?.unitPrice,retail=l.audit?.price?.audit?.basePrice??g?.baseCreditsPerTon;
  out.push('','Cargo lot '+(i+1));line('Commodity',g?.name??'Not recorded');line('Description',l.description);line('Quantity held',l.quantity+' tons');
  line(l.audit?.price?'Purchased at':'Recorded at',world(l.world));line('Retail price',retail==null?'Referee-defined':cr(retail)+'/ton');
  line('Original purchase price',price==null?'Not recorded':cr(price)+'/ton');
  const pct=ratio(price,retail);
  if(pct!==null){line('Purchase price %',pct+'% of retail');const d=A.sub(100,pct);line(A.cmp(d,0)>=0?'Purchase discount':'Purchase markup',A.decimal(A.cmp(d,0)>=0?d:A.mul(d,-1))+'%');}
  line('Remaining goods cost',cr(l.goodsValue));line('Remaining fees / adjustments',cr(BigInt(l.basis)-BigInt(l.goodsValue)));line('Remaining total cost basis',cr(l.basis));
  if(l.audit?.fee!=null)line('Original purchase broker fee',cr(l.audit.fee));
  if(l.audit?.premium!=null)line('Original purchase premium',cr(l.audit.premium));
  const active=s.policies.filter(p=>p.lotId===l.id&&p.status==='active');
  line('Insurance',active.length?active.map(p=>p.coverage+'% on '+p.remainingQuantity+' tons').join('; '):'No active policy');
 });
 section('COMPLETED CARGO SALES');
 if(!sales.length)out.push('None.');
 sales.forEach((e,i)=>{
  const a=e.audit||{},g=goods(a.commodity),retail=a.audit?.basePrice??g?.baseCreditsPerTon;
  out.push('','Sale '+(i+1)+' - '+date(e.hours));line('Commodity',g?.name??'Not recorded in older sale');line('Description',a.description);line('Sold at',world(e.world));
  line('Quantity sold',a.quantity==null?'Not recorded':a.quantity+' tons');line('Retail price',retail==null?'Not recorded':cr(retail)+'/ton');line('Sale price',a.unitPrice==null?'Not recorded':cr(a.unitPrice)+'/ton');
  const pct=ratio(a.unitPrice,retail);if(pct!==null)line('Sale price %',pct+'% of retail');
  line('Gross sale proceeds',cr(a.gross??e.amount));line('Cost basis sold',cr(a.basis));line('Sale broker fee',cr(a.fee));line('Sale tax',cr(a.tax));line('Profit / loss before adjustment',cr(a.afterTax));
  line('Profit setting at sale',a.profitPercent==null?'Not recorded':a.profitPercent+'%');
  line('Profit adjustment',cr(a.adjustment));line('Realized profit / loss',cr(a.adjusted));line('Net bank credit',cr(a.bankDelta));
 });
 section('INSURANCE');
 if(!s.policies.length)out.push('No policies recorded.');
 s.policies.forEach((p,i)=>{
  const lot=s.lots.find(l=>l.id===p.lotId),sale=sales.find(e=>e.lotId===p.lotId);
  out.push('','Policy '+(i+1));line('Cargo description',lot?.description??sale?.audit?.description??'Historical cargo - description not recorded');
  line('Status',p.status==='amendment-required'?'Amendment required':p.status);line('Original insured goods value',cr(p.insuredValue));line('Coverage',p.coverage+'% [I]');line('Original premium paid',cr(p.premium));line('Remaining covered quantity',p.remainingQuantity+' tons');
  line('Covered route',(p.route||[]).map(world).join(' -> ')||'Not recorded');
  if(p.status==='active')line('Remaining covered jumps',Math.max(0,(p.route?.length??1)-1-(p.routeProgress??0)));
 });
 section('TRANSPORT CONTRACTS ABOARD');
 const contracts=s.contracts.filter(c=>c.status==='accepted');
 if(!contracts.length)out.push('None.');
 contracts.forEach(c=>{out.push('');line('Contract',c.description??(c.kind==='passenger'?'Passenger booking':c.kind==='mail'?'Mail':'Freight'));if(c.kind==='passenger'){line('Passage / people',c.passageClass+' / '+c.count);line('Accommodation',c.cabinMode);line('Payment convention','Explicit destination delivery; no automatic lateness penalty.');}else line('Tonnage',c.quantity+' tons');line('Destination',world(c.destination));line('Agreed revenue',cr(c.payment));if(c.dueHours!=null)line('Due',date(c.dueHours));});
 section('RECORDED OPERATING EXPENSES');
 const groups=new Map();
 for(const e of expenses){const label=e.expense?.label??'Manual expenses';groups.set(label,(groups.get(label)??0n)-BigInt(e.amount));}
 if(!groups.size)out.push('None.');
 for(const [label,value] of groups)line(label,cr(value));
 line('Total recorded',cr(operating));
 section('RULES & NOTES');
 out.push('[1] Positive profit is adjusted after sale fees and applicable taxes.',
 '    Losses remain in full. Historical sales retain their recorded results.',
 '    Purchase discounts compare goods prices with retail; they are not profit.');
 if(s.lots.length||sales.length)out.push('[P] Retail/base prices: Traveller Core Rulebook Update 2022 trade goods.',
 '    Exotic goods require a referee price; saved price overrides are retained.');
 if(s.policies.length)out.push('[I] Insurance: MGT 1st Edition, Book 7: Merchant Prince, pp. 82-83.',
 '    Claim handling and payment timing are resolved by the referee.');
 if(s.settings.tax||s.ledger.some(e=>e.type==='Tax'))out.push('[T] Optional taxes: MGT 1st Edition, Book 7: Merchant Prince, p. 86.');
 if(s.ship.roundTons||s.ledger.some(e=>e.roundingStep))out.push('[R] Current rounding: Credits upward to '+(s.settings.creditStep===100?'Cr100':'whole Credits')+';',
 '    new tonnage upward to whole tons. Older entries retain recorded values.');
 out.push('Price percentages are rounded to two decimal places for this report.',
 'Report export does not change saved amounts. Original purchase charges are',
 'historical; remaining cost basis accounts for partial sales and adjustments.',
 'This TXT summary is not a campaign backup. Use Save campaign (JSON)',
 'and Load campaign (JSON) to preserve and restore the complete campaign.');
 return out.join('\r\n')+'\r\n';
}
