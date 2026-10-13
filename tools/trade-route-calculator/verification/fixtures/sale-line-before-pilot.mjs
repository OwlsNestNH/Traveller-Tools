// Frozen app.mjs prepareSaleLine from eaa66d6574c247158077d57ed8cc12a1f26fa82a.
// Differential oracle only; never imported by the application.
function prepareSaleLine(lot,buyer,context,quote,form){
 const threshold=form.get('ban_'+lot.id).trim(),banThreshold=threshold===''?null:Number(threshold);
 const legality=R.tradeLegality(context,{illegalGood:lot.illegal,banThreshold});
 if(legality.illegal&&!buyer.criminal)throw Error(legality.locallyBanned?'Locally banned cargo needs a black-market buyer.':'Illegal cargo needs a black-market buyer.');
 let price=form.get('price_'+lot.id),benchmark=form.get('benchmark_'+lot.id),priced=quote;
 const originalBenchmark=String(effectiveRetailValue(lot.commodity,lot.illegal)),effectiveBenchmark=String(effectiveRetailValue(lot.commodity,legality.illegal));
 if(banThreshold!==null){
  priced=R.repriceQuote(good(lot.commodity),context,{...buyer.options,creditStep:creditStep(state),side:'sell',banThreshold,...pricingOptions(legality.illegal)},core,quote);
  if(price===quote.unitPrice)price=priced.unitPrice;
  if(benchmark===originalBenchmark)benchmark=effectiveBenchmark;
 }
 const manual=price!==priced.unitPrice||benchmark!==effectiveBenchmark||(form.get('taxRate')||'').trim()||priced.audit.manualRequired;
 if(manual&&!form.get('reason').trim())throw Error('Add a reason for manual values');
 return {lotId:lot.id,quantity:form.get('qty_'+lot.id),unitPrice:price,benchmarkPrice:benchmark,audit:{...priced.audit,effectiveIllegal:legality.illegal,locallyBanned:legality.locallyBanned,manualPrice:price!==priced.unitPrice?price:null,overrideReason:form.get('reason'),banThreshold:threshold||null}};
}
