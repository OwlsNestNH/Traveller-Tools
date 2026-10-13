import * as A from './amounts.mjs';
import {up} from './rounding.mjs?v=route-layout-20261013-84';

// Prepare preview amounts from caller-normalized entry strings. Inputs:
// {quantity, fee, unitPrice: saved offer price, creditStep: 1 or 100}.
// Returns {quantity: decimal string, feePercent: number, cost: bigint, fee: bigint}.
// Parse positive quantity, convert fee with Number, then round goods cost up,
// followed by fee based on that rounded cost. Preserve arithmetic error order;
// this adds neither whole-ton normalization nor fee-range/availability checks.
// Insurance, purchase validation, modal ownership, persistence and Undo stay
// with existing callers. See ARCHITECTURE.md, "Headless trade preparation" and
// verification/purchase-amounts.test.mjs for a standalone consumer.
export function preparePurchaseAmounts(input){
 const quantity=A.positive(input.quantity,'Quantity'),feePercent=Number(input.fee);
 const cost=up(A.mul(quantity,input.unitPrice),input.creditStep),fee=up(A.mul(cost,A.div(feePercent,100)),input.creditStep);
 return {quantity,feePercent,cost,fee};
}
