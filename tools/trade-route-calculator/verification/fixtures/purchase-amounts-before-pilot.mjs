// Frozen calculation statements from buyForm at 72af02fdd96962f2c2399ec70fc7ab55666d22ca.
// Differential oracle only; never imported by the application.
function beforePurchaseAmounts(f,offer,state){
 const quantity=A.positive(f.get('quantity'),'Quantity'),feePercent=Number(f.get('fee'));const cost=up(A.mul(quantity,offer.unitPrice),creditStep(state)),fee=up(A.mul(cost,A.div(feePercent,100)),creditStep(state));
 return {quantity,feePercent,cost,fee};
}
