import {credit} from './amounts.mjs';
import {parseDate,displayDate} from './calendar.mjs';

// Read-only reporting projection. Never repairs, writes, or invents ledger history.
export function accountingDay(label){const {day,year}=parseDate(label);return BigInt(year)*365n+BigInt(day-1);}
function dateAt(label,hours){if(!Number.isSafeInteger(hours)||hours<0)throw Error('Invalid recorded campaign hours.');return accountingDay(label)+BigInt(Math.floor(hours/24));}
function labelAt(day){return String(day%365n+1n).padStart(3,'0')+'-'+String(day/365n).padStart(4,'0');}
export function accountingRange(from='',to=''){
 from=String(from).trim();to=String(to).trim();if(!from&&!to)return {mode:'all'};
 if(!from||!to)throw Error('Enter both From and To dates, or choose All dates.');
 const start=accountingDay(from),end=accountingDay(to);if(start>end)throw Error('From must be on or before To.');
 return {mode:'range',from:labelAt(start),to:labelAt(end)};
}
export function currentAccountingVisit(s){
 const ledger=s.ledger??[],events=s.events??[],last=ledger.findLastIndex(e=>e.type==='Jump');
 let event,index;
 if(last>=0){const jump=ledger[last];event=events.find(e=>e.id===jump.eventId&&e.label==='Jump audit'&&e.from===jump.from&&e.to===jump.to&&e.hours===jump.hours);index=last+1;if(!event||jump.to!==s.actual)return null;}
 else{event=events.find(e=>e.label==='Campaign setup');index=0;if(!event||events.indexOf(event)!==0||event.hours!==0||event.world!==s.actual||events.filter(e=>e.label==='Campaign setup').length!==1)return null;}
 // Campaign time can be edited backwards. Arrival must precede both now and
 // every transaction attributed to this visit; index order alone is not proof.
 if(!Number.isSafeInteger(event.hours)||event.hours<0||!Number.isSafeInteger(s.hours)||s.hours<event.hours||ledger.slice(index).some(e=>!Number.isSafeInteger(e.hours)||e.hours<event.hours))return null;
 const after=events.slice(events.indexOf(event)+1);
 if(after.some(e=>e.label==='Starting-world / location correction'||e.label==='Jump audit'||String(e.label).startsWith('Undo: ')||e.world&&e.world!==s.actual)||ledger.slice(index).some(e=>e.world&&e.world!==s.actual||e.hours>s.hours))return null;
 return {index,from:labelAt(dateAt(s.dateLabel,event.hours)),to:labelAt(dateAt(s.dateLabel,s.hours)),boundaryId:event.id};
}
export function projectAccountingPeriod(s,selection={mode:'all'},options={}){
 const ledger=s.ledger??[],mode=selection.mode??'all';if(!['all','range','visit'].includes(mode))throw Error('Unknown accounting period.');
 const range=mode==='range'?accountingRange(selection.from,selection.to):{mode};
 if(mode==='range'&&range.mode==='all')return projectAccountingPeriod(s,{mode:'all'},options);
 const visit=mode==='visit'?currentAccountingVisit(s):null;
 if(mode==='visit'&&!visit)throw Error('Current visit boundary is not recorded reliably. Choose All dates or a date range.');
 const from=visit?.from??range.from??null,to=visit?.to??range.to??null,start=from?accountingDay(from):null,end=to?accountingDay(to):null;
 const net=ledger.reduce((n,e)=>n+credit(e.amount),0n),carry=credit(s.bank)-net;
 const opening=ledger[0],historyKnown=opening?.type==='Opening bank'&&opening.hours===0&&ledger.filter(e=>e.type==='Opening bank').length===1&&carry===0n;
 let missingDates=0;
 const all=ledger.map((e,index)=>{
  let day=null;try{day=dateAt(e.paidAt?.dateLabel??s.dateLabel,e.paidAt?.hours??e.hours);}catch{missingDates++;}
  const lot=s.lots?.find(l=>l.id===e.lotId),contract=s.contracts?.find(c=>c.id===e.contractId);
  return {source:e,index,day,amount:credit(e.amount),note:String(e.reason||e.expense?.notes||e.expense?.reason||e.purchase?.description||lot?.description||contract?.description||(e.type==='Opening bank'?'Starting campaign funds':e.expense?.label||(e.audit?.commodity?options.commodityName?.(e.audit.commodity):'')||''))};
 });
 if(mode!=='all'&&missingDates)throw Error('Some ledger dates cannot be resolved. Correct campaign time before filtering.');
 const known=historyKnown&&!missingDates;
 const selected=all.filter(r=>mode==='all'?true:mode==='visit'?r.index>=visit.index:r.day>=start&&r.day<=end);
 const prior=mode==='visit'?all.filter(r=>r.index<visit.index):mode==='range'?all.filter(r=>r.day<start):[];
 const openingBalance=known?carry+prior.reduce((n,r)=>n+r.amount,0n):null;
 let balance=openingBalance,income=0n,expenses=0n;
 const rows=[];
 for(const r of selected){
  if(r.amount>0n)income+=r.amount;else expenses-=r.amount;if(balance!==null)balance+=r.amount;
  if(r.amount===0n&&r.source.type!=='Freight delivery')continue;
  const e=r.source;rows.push({ledgerId:String(e.id),auditId:String(e.eventId||e.id),auditAction:e.historicalJump||e.eventId?'event-audit':'ledger-audit',date:r.day===null?displayDate(e.paidAt?.dateLabel??s.dateLabel,e.paidAt?.hours??e.hours):labelAt(r.day)+' · '+String((e.paidAt?.hours??e.hours)%24).padStart(2,'0')+':00',world:String(s.worlds?.[e.world]?.name??'Campaign'),type:String(e.type),note:r.note,amount:String(r.amount),balance:balance===null||e.historicalJump?null:String(balance)});
 }
 const closing=mode==='all'?credit(s.bank):balance;
 return {version:1,audience:'private-accounting',campaign:String(s.name??'Campaign'),ship:String(s.ship?.name??'Ship'),mode,from,to,label:mode==='all'?'All dates':(mode==='visit'?'Current visit: ':'')+from+' to '+to+' (inclusive)',historyKnown:known,openingBalance:openingBalance===null?null:String(openingBalance),income:String(income),expenses:String(expenses),closingBalance:closing===null?null:String(closing),savedBank:String(s.bank),rows,missingDates};
}
