import * as R from './rules.mjs?v=contact-outcome-20261013-80';

// Prepare one sale line from explicit lot/buyer/context/quote/commodity/core,
// current pricing flags and creditStep, plus caller-normalized values:
// {ban, price, benchmark, quantity, taxRate, reason} (taxRate may be null).
// Returns {lotId, quantity, unitPrice, benchmarkPrice, audit}; quantities/prices
// remain entry strings. Legality and manual-reason errors retain existing order.
// Local-ban repricing delegates to rules using the original quote dice/audit;
// this never generates fresh dice or adds quantity normalization/validation.
// Caller owns form normalization, quote/tax caches, previews, state validation,
// persistence and Undo. Optional rules binding supports observed harness calls.
// See ARCHITECTURE.md, "Headless trade preparation" and sale-line.test.mjs.
export function prepareSaleLine({lot,buyer,context,quote,commodity,pricing,creditStep,core,values},rules=R){
 const threshold=values.ban.trim(),banThreshold=threshold===''?null:Number(threshold);
 const legality=rules.tradeLegality(context,{illegalGood:lot.illegal,banThreshold});
 if(legality.illegal&&!buyer.criminal)throw Error(legality.locallyBanned?'Locally banned cargo needs a black-market buyer.':'Illegal cargo needs a black-market buyer.');
 let price=values.price,benchmark=values.benchmark,priced=quote;
 const originalBenchmark=String(rules.effectiveBasePrice(commodity,{...pricing,illegalGood:!!lot.illegal}).effective),effectiveBenchmark=String(rules.effectiveBasePrice(commodity,{...pricing,illegalGood:!!legality.illegal}).effective);
 if(banThreshold!==null){
  priced=rules.repriceQuote(commodity,context,{...buyer.options,creditStep,side:'sell',banThreshold,...pricing,illegalGood:!!legality.illegal},core,quote);
  if(price===quote.unitPrice)price=priced.unitPrice;
  if(benchmark===originalBenchmark)benchmark=effectiveBenchmark;
 }
 const manual=price!==priced.unitPrice||benchmark!==effectiveBenchmark||(values.taxRate||'').trim()||priced.audit.manualRequired;
 if(manual&&!values.reason.trim())throw Error('Add a reason for manual values');
 return {lotId:lot.id,quantity:values.quantity,unitPrice:price,benchmarkPrice:benchmark,audit:{...priced.audit,effectiveIllegal:legality.illegal,locallyBanned:legality.locallyBanned,manualPrice:price!==priced.unitPrice?price:null,overrideReason:values.reason,banThreshold:threshold||null}};
}
