// Read-only campaign adapter. Only explicit public values cross this boundary.
// No DOM, persistence, random rolls, network access or URL serialization.
import {projectPlayerSnapshot,SNAPSHOT_VERSION,EXPENSE_KINDS} from './player-snapshot.mjs?v=hex-quiet-20261020-106';
import {playerBriefingData} from './player-briefing.mjs?v=hex-quiet-20261020-106';
import {context} from './rules.mjs?v=hex-quiet-20261020-106';
import {displayDate} from './calendar.mjs';
import {supportStock,supportDisplay,supportAmount} from './life-support.mjs?v=hex-quiet-20261020-106';
import {passengerShip} from './passengers.mjs?v=hex-quiet-20261020-106';
import {fuelAvailabilityAdvice} from './expenses.mjs?v=hex-quiet-20261020-106';
import * as A from './amounts.mjs';

const text=value=>String(value??'').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,240);
const amount=value=>value==null?null:A.decimal(value);
const recordedCommission=value=>{if(typeof value!=='string'&&typeof value!=='number')return null;try{return A.cmp(value,0)<0?null:amount(value);}catch{return null;}};
const name=(core,id)=>core.commodities.find(g=>g.id===id)?.name??'Other';
function visitBoundary(s){
 const last=s.ledger.findLast(e=>e.type==='Jump');
 const index=last?s.events.findIndex(e=>e.id===last.eventId&&e.label==='Jump audit'&&e.from===last.from&&e.to===s.actual&&e.hours===last.hours):s.events.findIndex(e=>e.label==='Campaign setup'&&e.world===s.actual);
 if(!last&&(index!==0||s.events.filter(e=>e.label==='Campaign setup').length!==1||s.events[0]?.hours!==0))return null;
 if(index<0||s.events.slice(index+1).some(e=>e.label==='Starting-world / location correction'||e.label.startsWith('Undo: ')))return null;
 return {eventIndex:index,ledgerIndex:last?s.ledger.indexOf(last):0};
}
export function campaignPlayerSnapshot(s,core,{saleQuotes=new Map(),capturedAt=new Date().toISOString()}={}){
 if(!s.initialized||!s.worlds[s.actual])throw Error('Set up a campaign before copying a player link.');
 if(A.cmp(s.bank,0)<0)throw Error('Player links cannot yet represent a negative bank balance. No link generated.');
 const w=s.worlds[s.actual],c=context(w,core),support=supportStock(passengerShip(s)),boundary=visitBoundary(s);
 const briefing=playerBriefingData(s,core),cargo=briefing.cargoInHold.items.map((l,index)=>({name:l.type==='Other cargo'?'Other':l.commodity,tons:l.tons,purchase:l.type==='Other cargo'?null:{retailPerTon:l.retailPerTonCr,percent:l.percentOfRetail,paidPerTon:l.recordedUnitPurchasePricePerTonCr,paidTotal:l.remainingGoodsCostCr,originalBrokerCommission:recordedCommission(s.lots[index]?.audit?.fee)}}));
 // Accepted transport cargo is physically aboard too; private descriptions stay out.
 for(const contract of s.contracts.filter(x=>x.status==='accepted'&&x.kind!=='passenger'))cargo.push({name:'Other',tons:amount(contract.quantity),purchase:null});
 const expenses={visitLabel:text(w.name)+' · visit '+(s.routeIndex+1)+' · recorded payments'};
 const entries=boundary?s.ledger.slice(boundary.ledgerIndex+1):null;
 const reconciled=entries&&s.ledger[0]?.type==='Opening bank'&&s.ledger.filter(e=>e.type==='Opening bank').length===1&&s.ledger.reduce((n,e)=>n+BigInt(e.amount),0n)===BigInt(s.bank)&&entries.every(e=>e.world===s.actual);
 const kinds={maintenance:'maintenance',berthing:'berth',fuel:'fuel',salary:'salary',salaries:'salary',mortgage:'mortgage',lifeSupport:'lss',lifeSupportRefill:'lss',staterooms:'lss',passengerSupport:'lss'};
 const sums=Object.fromEntries(EXPENSE_KINDS.map(k=>[k,0n]));
 if(reconciled)for(const e of entries)if(BigInt(e.amount)<0n&&(e.type.startsWith('Ship expense')||['Manual expense','Broker fee','Tax','Insurance premium','Insurance amendment'].includes(e.type)))sums[kinds[e.expense?.kind]??'incidentals']-=BigInt(e.amount);
 for(const kind of EXPENSE_KINDS)expenses[kind]={expected:null,paid:reconciled?String(sums[kind]):null,basis:'No saved visit plan. '+(reconciled?'Recorded payments only; unrecorded activity is unknown.':'Payment history unavailable for this visit.')};
 // Saved offers stay usable across visits until expired or rejected, exactly as buy().
 const suppliers=s.snapshots.filter(x=>x.worldId===s.actual&&x.kind==='supplier');
 const offers=suppliers.flatMap(x=>(s.cooldowns[x.party]??0)>s.hours?[]:x.offers.filter(o=>!o.expired&&!o.manualRequired&&A.cmp(o.remaining,0)>0).map(o=>({name:name(core,o.commodity),tons:amount(o.remaining),creditsPerTon:amount(o.unitPrice)})));
 const sales=[];
 for(const l of s.lots){const q=saleQuotes.get(l.id);if(q&&q.revision===s.revision&&q.worldId===s.actual&&!q.audit?.manualRequired)sales.push({name:name(core,l.commodity),tons:amount(l.quantity),creditsPerTon:amount(q.unitPrice)});}
 const daily=support.dailyUnits,days=units=>units!==null&&support.complementKnown&&A.cmp(daily,0)>0?supportDisplay(A.div(units,daily)):null;
 const exactCargo=support.cargoExact===null?null:supportAmount(support.cargoExact);
 const reserve=exactCargo===null?null:supportDisplay(A.mul(exactCargo,100));
 const reserved=exactCargo===null?null:String(-A.floor(A.mul(exactCargo,-1)));
 if(reserve!==null&&reserved!==String(-A.floor(A.mul(A.div(reserve,100),-1))))throw Error('This life-support reserve cannot be represented accurately in a player link. Its fractional balance is too close to a cargo-space boundary.');
 return projectPlayerSnapshot({version:SNAPSHOT_VERSION,campaignPolitics:s.campaignPolitics,capturedAt,campaignDate:displayDate(s.dateLabel,s.hours),
  world:{name:text(w.name),location:text(w.sector+' / '+w.hex),uwp:text(c.uwp.raw),tradeCodes:text(c.codes.join(' ')),travelZone:text(c.zone),starport:text(w.emptySpace?'No starport':fuelAvailabilityAdvice(w)),mapReference:w.emptySpace||!w.sector?null:{sector:w.sector,hex:w.hex}},
  ship:{name:text(s.ship.name),cargoCapacityTons:amount(s.ship.capacity),cashCredits:s.bank,fuel:{current:amount(s.ship.fuel?.aboardTons),capacity:amount(s.ship.fuel?.capacityTons)},lifeSupport:{current:support.internalUnits,capacity:support.internalCapacityUnits,cargoLss:reserve,cargoReservedTons:reserved,daysRemaining:days(support.internalUnits),daysCapacity:days(support.internalCapacityUnits)},destination:text(s.worlds[s.route[s.routeIndex+1]]?.name??'No planned destination')},
  cargo,expenses,buy:{status:offers.length?'available':suppliers.length?'available':'not-checked',offers},sell:{status:sales.length?'available':'not-checked',offers:sales}});
}

export function playerSnapshotForVisit(s,core,index,options){
 if(!Number.isSafeInteger(index)||index<0||index>=s.route.length)throw Error('Select a saved route visit first.');
 if(index===s.routeIndex&&s.route[index]===s.actual)return campaignPlayerSnapshot(s,core,options);
 if(index>s.routeIndex)throw Error('This visit has not happened yet. Select the current or a completed visit.');
 const record=s.playerDepartures?.find(r=>r.index===index&&JSON.stringify(r.prefix)===JSON.stringify(s.route.slice(0,index+1)));
 // Old app versions can retain unknown archive fields while starting a new
 // journey. Match this route's active jump suffix, not any surviving old jump.
 const journey=s.ledger.filter(e=>e.type==='Jump').slice(-s.routeIndex);
 const validJourney=journey.length===s.routeIndex&&journey.every((e,i)=>e.from===s.route[i]&&e.to===s.route[i+1]);
 const jump=record&&validJourney&&journey[index]?.eventId===record.eventId;
 if(!jump||!record.snapshot)throw Error('No complete departure snapshot was saved for this visit. Older visits cannot be reconstructed; new departures will retain player snapshots.');
 return projectPlayerSnapshot(record.snapshot);
}
