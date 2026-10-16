import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as E from '../js/engine.mjs';
const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const atomic=await json('./fixtures/golden-atomic.json');
const sequences=await json('./fixtures/golden-sequences.json');
const chart=(await json('../../trade-route-calculator/rules/merchant-prince-1e.json')).tax;
const exact=(actual,expected)=>assert.equal(actual.numerator+'/'+actual.denominator,expected.exact);
const close=(actual,expected,label)=>assert.ok(Math.abs(E.approximate(actual)-expected)<1e-6,`${label}: ${E.approximate(actual)} != ${expected}`);
for(const c of atomic)test('golden atomic: '+c.case_id,()=>{
  const i=c.inputs;
  if(c.operation==='baseline') {
    const a=E.baseline({purchase:i.P,investment:i.k,normalHold:i.H,tonnes:i.lot_t,monthlyCosts:i.C,monthlyTarget:i.S,freight:i.f,premiumEnabled:i.premium_active,freightRate:i.freight_rate});
    if(c.expected_status)assert.equal(a.status,c.expected_status);else exact(a.baseline,c.expected_A);
  } else if(c.operation==='sale_quote') {
    const q=E.quote({departure:{version:E.SETTINGS_VERSION,baseline:E.packed(i.A)},risk:i.risk,dice:[Math.max(1,i.raw-6),Math.min(6,i.raw-1)],baseBroker:i.base_skill,statDM:i.stat_dm,opposingBroker:i.opponent_broker_skill,localDM:i.local_dm,tradeDM:i.trade_dm});
    exact(q.gross,c.expected_gross_sale);assert.equal(q.modified,c.expected_modified_roll);assert.equal(q.negotiationPP,c.expected_negotiation_pp);assert.equal(q.riskPercent,c.expected_risk_percent);
  } else {
    const run=()=>E.profitTax(i.positive_or_negative_gain_after_purchase_fees,'4',chart,{zeroLossTrial:true});
    if(c.expected_status)assert.throws(run,E.UnresolvedRule);else {const t=run();exact(t.tax,c.expected_tax);assert.equal(t.rate,c.expected_rate_percent);}
  }
});
for(const c of sequences)test('golden cash path: '+c.case_id,()=>{
  const i=c.inputs;let cash=E.packed(i.starting_cash),unpaid=E.packed(0),fallbacks=0;
  const departure=E.baseline({purchase:i.purchase_per_jump,investment:i.purchase_per_jump,normalHold:i.hold_t,tonnes:i.spec_t_per_jump,monthlyCosts:i.monthly_costs,monthlyTarget:i.target,freight:i.freight_t_per_jump*i.freight_rate_per_t,premiumEnabled:i.premium_active,freightRate:i.freight_rate_per_t});
  let executed=0,months=0;
  for(const ledger of c.expected.jump_ledger) {
    const fallback=E.compare(cash,i.purchase_per_jump)<0;assert.equal(fallback,ledger.fallback);executed++;
    close(cash,ledger.opening_cash,'opening cash');close(departure.baseline,ledger.planned_baseline_A,'baseline');
    let sale=E.packed(0),tax=E.packed(0),fees=E.packed(0),purchase=0;
    const freight=(fallback?i.hold_t:i.freight_t_per_jump)*i.freight_rate_per_t;
    if(fallback)fallbacks++;
    else {
      purchase=i.purchase_per_jump;cash=E.subtract(cash,purchase);
      const q=E.quote({departure,risk:i.risk,dice:i.dice[executed-1],baseBroker:i.base_skill,statDM:i.stat_dm,opposingBroker:i.opponent_broker_skill,localDM:i.local_dm,tradeDM:i.trade_dm});
      sale=q.gross;fees=E.fixtureFees(i.spec_t_per_jump);
      const s=E.settle({lines:[{gross:sale,purchase}],fees,government:'4',taxChart:chart,zeroLossTrial:true});tax=s.tax;
      cash=E.add(cash,s.cashCredit);
    }
    cash=E.add(cash,freight);
    close(sale,ledger.gross_sale,'gross sale');close(tax,ledger.profit_tax,'tax');close(fees,ledger.handling+ledger.wharfage,'fees');close(cash,ledger.cash_after_port,'arrival cash');
    if(executed%i.jumps_per_month===0) {
      months++;const available=E.compare(cash,i.monthly_costs)>=0;
      unpaid=available?E.packed(0):E.subtract(i.monthly_costs,cash);cash=available?E.subtract(cash,i.monthly_costs):E.packed(0);
    }
    close(cash,ledger.ending_cash,'ending cash');close(unpaid,ledger.unpaid_monthly_bills,'unpaid');
  }
  close(cash,c.expected.end_cash,'final cash');close(unpaid,c.expected.unpaid_liability,'final liability');
  close(E.subtract(cash,unpaid),c.expected.end_book,'net book');
  assert.equal(executed,c.expected.jumps_executed);assert.equal(months,c.expected.months_assessed);assert.equal(fallbacks,c.expected.fallback_jumps);assert.equal(E.compare(unpaid,0)>0,c.expected.ran_out);
});
test('buyer search excludes expertise, uses population and risk; zero population unresolved',()=>{
  const s=E.buyerSearch({dice:[2,2],baseBroker:3,statDM:2,risk:'moderate',population:8});assert.equal(s.total,9);
  assert.throws(()=>E.buyerSearch({dice:[1,1],baseBroker:3,statDM:2,risk:'low',population:0}),E.UnresolvedRule);
  assert.throws(()=>E.expertise(5),E.UnresolvedRule);
});
test('Data Net reduces only positive surplus; unsupported governments and nonpositive tax fail explicitly',()=>{
  close(E.applyDataNet({gross:E.packed(144000)},100000,'0.10').gross,139600,'Data Net');
  close(E.applyDataNet({gross:E.packed(90000)},100000,'0.20').gross,90000,'loss preserved');
  assert.throws(()=>E.profitTax(1000,'F',chart),E.UnresolvedRule);
  assert.throws(()=>E.profitTax(-1,'4',chart),E.UnresolvedRule);
});
