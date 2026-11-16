// Explicit campaign financing policy; Core p.228 supplies the course price,
// not an entitlement to credit. Testing is settled separately before this option.
export function psionicTrainingFinance({cash,cost,testingNeeded,psi,confirmed}){
 if(confirmed!==true)throw new Error('Confirm the training debt before accepting the course.');
 if(testingNeeded||!Number.isFinite(psi)||psi<=0)throw new Error('Complete PSI testing with positive potential before financing training.');
 if(cost!==100000)throw new Error('Institute training costs Cr100000.');
 if(!Number.isSafeInteger(cash)||cash<0)throw new Error('Available cash must be a nonnegative integer.');
 const paid=Math.min(cash,cost),debt=cost-paid;
 return {cost,paid,debt,remainingCash:cash-paid,policy:'campaign-training-credit'};
}
