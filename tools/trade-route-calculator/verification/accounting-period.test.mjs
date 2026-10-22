import test from 'node:test';import assert from 'node:assert/strict';
import {accountingDay,accountingRange,currentAccountingVisit,projectAccountingPeriod} from '../js/accounting-period.mjs';
import {accountingPrint} from '../js/accounting-print.mjs';
import {playerTradePrint} from '../js/trade-exports.mjs';
import {playerSnapshotFixture} from '../js/player-snapshot-fixture.mjs';
const row=(id,amount,hours,extra={})=>({id,type:'Recorded transaction',amount,hours,world:'a',...extra});
function fixture(){return {name:'Synthetic ledger',ship:{name:'Test ship'},dateLabel:'001-1105',hours:66*24-1,actual:'a',worlds:{a:{name:'Regina'},b:{name:'Jenghe'}},lots:[],contracts:[],events:[{id:'setup',label:'Campaign setup',hours:0,world:'a'}],ledger:[row('opening','100000',0,{type:'Opening bank'}),row('income','15000',59*24),row('fuel','-5000',60*24),row('fare','10000',63*24),row('berth','-3000',66*24-1)],bank:'117000'};}
test('inclusive campaign dates and exact period balances; no state mutation',()=>{
 const s=fixture(),before=JSON.stringify(s),r=projectAccountingPeriod(s,accountingRange('060-1105','066-1105'));
 assert.deepEqual([r.openingBalance,r.income,r.expenses,r.closingBalance],['100000','25000','8000','117000']);assert.equal(r.rows.length,4);assert.deepEqual(r.rows.map(x=>x.balance),['115000','110000','120000','117000']);assert.equal(JSON.stringify(s),before);
 const day=projectAccountingPeriod(s,accountingRange('066-1105','066-1105'));assert.equal(day.rows.length,1);assert.equal(day.openingBalance,'120000');assert.equal(day.closingBalance,'117000');
 const empty=projectAccountingPeriod(s,accountingRange('067-1105','067-1105'));assert.equal(empty.rows.length,0);assert.equal(empty.openingBalance,empty.closingBalance);
});
test('year/day comparison is numeric, includes the final hour and rejects malformed or reversed ranges',()=>{
 assert.ok(accountingDay('365-1105')<accountingDay('001-1106'));assert.ok(accountingDay('365-9007199254740990')<accountingDay('001-9007199254740991'));
 const s=fixture();s.dateLabel='365-1105';s.ledger=[row('opening','10',0,{type:'Opening bank'}),row('last','-1',23),row('next','5',24)];s.bank='14';
 assert.deepEqual(projectAccountingPeriod(s,accountingRange('365-1105','365-1105')).rows.map(r=>r.ledgerId),['opening','last']);assert.equal(projectAccountingPeriod(s,accountingRange('001-1106','001-1106')).openingBalance,'9');
 for(const pair of [['366-1105','001-1106'],['001-1105',''],['2-1105','003-1105'],['002-1105','001-1105']])assert.throws(()=>accountingRange(...pair));assert.deepEqual(accountingRange('',''),{mode:'all'});
});
test('imports with absent or inconsistent opening history never invent historical balances',()=>{
 const s=fixture();s.ledger.shift();const before=JSON.stringify(s),all=projectAccountingPeriod(s),range=projectAccountingPeriod(s,accountingRange('060-1105','066-1105'));
 assert.equal(all.historyKnown,false);assert.equal(all.openingBalance,null);assert.equal(all.closingBalance,s.bank);assert.equal(range.openingBalance,null);assert.equal(range.closingBalance,null);assert.ok(range.rows.every(r=>r.balance===null));assert.equal(range.income,'25000');assert.equal(JSON.stringify(s),before);
 s.ledger.unshift(row('opening','99999',0,{type:'Opening bank'}));assert.equal(projectAccountingPeriod(s).historyKnown,false);
});
test('credits above Number precision, refunds, negative balances and zero-revenue delivery remain exact',()=>{
 const s=fixture(),huge='90071992547409931234567890';s.ledger=[row('opening',huge,0,{type:'Opening bank'}),row('expense','-'+huge,1),row('fee','-7',2),row('delivery','0',3,{type:'Freight delivery'}),row('zero','0',4)];s.bank='-7';
 const r=projectAccountingPeriod(s);assert.equal(r.income,huge);assert.equal(r.expenses,String(BigInt(huge)+7n));assert.equal(r.closingBalance,'-7');assert.equal(r.rows.length,4);assert.equal(r.rows.at(-1).balance,'-7');
});
test('current visit uses a verified ledger boundary, including same-hour return to the same world',()=>{
 const s=fixture();s.ledger=[s.ledger[0],row('old','10',0),row('out','0',0,{type:'Jump',from:'a',to:'b',world:'b',eventId:'j1'}),row('away','-4',0,{world:'b'}),row('back','0',0,{type:'Jump',from:'b',to:'a',eventId:'j2'}),row('new','3',0)];s.bank='100009';s.hours=0;s.events.push({id:'j1',label:'Jump audit',from:'a',to:'b',hours:0},{id:'j2',label:'Jump audit',from:'b',to:'a',hours:0});
 const r=projectAccountingPeriod(s,{mode:'visit'});assert.equal(currentAccountingVisit(s).index,5);assert.deepEqual(r.rows.map(x=>x.ledgerId),['new']);assert.equal(r.openingBalance,'100006');assert.equal(r.closingBalance,'100009');
 s.events.push({id:'correct',label:'Starting-world / location correction',hours:0,world:'a'});assert.equal(currentAccountingVisit(s),null);assert.throws(()=>projectAccountingPeriod(s,{mode:'visit'}),/boundary/);
 s.events=[];assert.throws(()=>projectAccountingPeriod(s,{mode:'visit'}),/boundary/);
});
test('current visit rejects a clock or later-recorded transaction before arrival without inventing a valid period',()=>{
 const s=fixture();s.hours=144;s.ledger=[s.ledger[0],row('arrival','0',168,{type:'Jump',from:'b',to:'a',eventId:'arrival-event'}),row('backdated','10',144)];s.bank='100010';s.events.push({id:'arrival-event',label:'Jump audit',from:'b',to:'a',hours:168});
 const before=JSON.stringify(s);assert.equal(currentAccountingVisit(s),null);assert.throws(()=>projectAccountingPeriod(s,{mode:'visit'}),/boundary/);
 const all=projectAccountingPeriod(s);assert.equal(all.label,'All dates');assert.ok(!accountingPrint(all).includes('Current visit:'));assert.equal(all.closingBalance,s.bank);assert.equal(JSON.stringify(s),before);
 s.hours=192;assert.equal(currentAccountingVisit(s),null,'Restoring the clock does not validate a transaction before arrival');
 s.ledger.at(-1).hours=168;assert.equal(currentAccountingVisit(s).from,'008-1105');assert.equal(projectAccountingPeriod(s,{mode:'visit'}).closingBalance,'100010');
});

test('saved receipt calendar anchors are respected; invalid legacy dates cannot silently enter a range',()=>{
 const s=fixture();s.ledger[1].paidAt={dateLabel:'001-1106',hours:0};assert.equal(projectAccountingPeriod(s,accountingRange('001-1106','001-1106')).rows.length,1);
 s.dateLabel='unrecorded';assert.equal(projectAccountingPeriod(s).historyKnown,false);assert.throws(()=>projectAccountingPeriod(s,accountingRange('001-1106','001-1106')),/dates/);
});
test('private print is explicit, escaped, bounded, optional-detail only and absent from player exports',()=>{
 const s=fixture();s.ledger[1].reason='ACCOUNT_PRIVATE <img src=x onerror=alert(1)>';s.privateAudit='OMITTED_SECRET';const r=projectAccountingPeriod(s,accountingRange('060-1105','066-1105')),before=JSON.stringify(s);
 const summary=accountingPrint(r),detail=accountingPrint(r,{includeTransactions:true});assert.match(summary,/PRIVATE ACCOUNTING/);assert.ok(!summary.includes('ACCOUNT_PRIVATE'));assert.ok(detail.includes('ACCOUNT_PRIVATE &lt;img'));assert.ok(!detail.includes('OMITTED_SECRET'));assert.doesNotMatch(detail,/<(?:script|img|iframe)\b/i);assert.ok(detail.includes('Cr 117,000'));assert.ok(detail.includes('060-1105 to 066-1105 (inclusive)'));assert.ok(!detail.includes('auditId'));
 const publicData=structuredClone(playerSnapshotFixture);publicData.accounting=r;assert.ok(!playerTradePrint(publicData).includes('ACCOUNT_PRIVATE'));assert.equal(JSON.stringify(s),before);assert.throws(()=>accountingPrint(s));
 r.rows[0].note='x'.repeat(2*1024*1024);assert.throws(()=>accountingPrint(r,{includeTransactions:true}),/2 MiB/);
});
