import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {campaignReport} from '../js/report.mjs';
import * as S from '../js/state.mjs';
import * as R from '../js/rules.mjs';
const core=JSON.parse(readFileSync(new URL('../rules/core-2022.json',import.meta.url)));
const mp=JSON.parse(readFileSync(new URL('../rules/merchant-prince-1e.json',import.meta.url)));
const options={exportedAt:new Date('2026-10-04T12:00:00Z')};
function fixture(){
 const s=S.initial();s.initialized=true;s.bank='100000';s.actual='0,0';s.worlds[s.actual]={id:s.actual,name:'Fist',sector:'Trojan Reach',hex:'2918',uwp:'B789430-C',x:0,y:0,zone:'Safe'};
 s.route=[s.actual];s.ledger=[{id:'opening',type:'Opening bank',amount:'100000',hours:0,world:s.actual}];
 s.lots=[{id:'lot1',commodity:'12',description:'Factory supplies',quantity:'20',basis:'103000',goodsValue:'100000',world:s.actual,hours:0,audit:{price:{unitPrice:'5000',audit:{basePrice:10000}},fee:'1000',premium:'2000'}}];
 return s;
}
test('report distinguishes discount, remaining cost basis, realized profit, cash and expenses',()=>{
 const s=fixture();
 const sale=R.salePreview(s.lots,[{lotId:'lot1',quantity:'10',unitPrice:'7000',audit:{basePrice:10000}}],{percent:75,feePercent:0,taxEnabled:false,government:'4'},core,mp);
 S.sell(s,sale,s.actual,'buyer');S.shipExpense(s,{kind:'fuel',fuelType:'water',tons:'20'});S.expense(s,'1000','Supplies');
 s.settings.profit=100;
 const before=JSON.stringify(s),report=campaignReport(s,core,options);
 assert.equal(JSON.stringify(s),before);
 assert.match(report,/Purchase discount:\s+50%/);assert.match(report,/Remaining total cost basis:\s+Cr 51,500/);
 assert.match(report,/Quantity sold:\s+10 tons/);assert.match(report,/Sale price %:\s+70% of retail/);
 assert.match(report,/Profit setting at sale:\s+75%/);assert.match(report,/Current profit setting:\s+100%/);
 assert.match(report,/Realized profit \/ loss:\s+Cr 13,875/);assert.match(report,/Trading \+ freight - expenses:\s+Cr 12,875/);
 assert.match(report,/Fuel:\s+Cr 0/);assert.match(report,/Common Industrial Goods/);
 assert.doesNotMatch(report,/undefined|NaN|\[object Object\]|lot1/);
});
test('manual lots, old completed sales and large integer Credits remain honest',()=>{
 const s=fixture();delete s.lots[0].audit;
 s.bank='90071992547409931234';s.ledger.push({type:'Sale',amount:'120',hours:1,world:s.actual,audit:{description:'Old stock',quantity:'1',unitPrice:'120',basis:'100',gross:'120',fee:'0',tax:'0',afterTax:'20',adjusted:'15',adjustment:'-5',bankDelta:'115'}});
 const report=campaignReport(s,core,options);
 assert.match(report,/Cr 90,071,992,547,409,931,234/);assert.match(report,/Original purchase price:\s+Not recorded/);
 assert.match(report,/Commodity:\s+Not recorded in older sale/);assert.match(report,/Profit setting at sale:\s+Not recorded/);
 assert.doesNotMatch(report,/Purchase discount:/);
});
test('empty campaign and markup export without changing values or rounding history',()=>{
 const empty=campaignReport(S.initial(),core,options);assert.match(empty,/No route planned/);assert.doesNotMatch(empty,/\[T\]|\[I\]|\[R\]/);
 const s=fixture();s.lots[0].audit.price.unitPrice='12500';s.lots[0].quantity='0.5';
 const report=campaignReport(s,core,options);assert.match(report,/Purchase markup:\s+25%/);assert.match(report,/Quantity held:\s+0.5 tons/);
});
