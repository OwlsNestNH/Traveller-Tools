import * as R from './rules.mjs?v=lss-refill-20261015-90';
import {distance as worldDistance} from './map.mjs?v=lss-refill-20261015-90';

// Prepare optional coverage terms from plain inputs, not FormData/campaign state.
// remainingRoute is the current untravelled route: [{id, world:{x,y,zone}}].
// values contains normalized entry strings {legs,distance,distanceReason,coverage,
// manualPremium}; insuredValue is the caller's already-computed goods value.
// Returns null if unrequested, otherwise existing insuranceQuote fields plus
// route/destination/routeProgress/plannedDistance/distanceOverrideReason.
// Preserve disabled -> legs -> route distance -> distance/reason -> quote errors;
// delegate premium/payout rounding to insuranceQuote using creditStep (1 or 100).
// Caller owns goods-value preparation, lookup precedence, forms, validation,
// policies, persistence and Undo. This is not the entire optional feature.
// See ARCHITECTURE.md, "Headless trade preparation" and insurance-terms.test.mjs.
// Optional rules binding keeps application harness quote observations intact.
export function prepareInsuranceTerms({requested,enabled,insuredValue,remainingRoute,creditStep,mp,values},rules=R){
 if(!requested)return null;
 if(!enabled)throw Error('Insurance is disabled. Enable it in Settings before adding coverage.');
 const legs=Number(values.legs);
 if(!Number.isInteger(legs)||legs<1||legs>=remainingRoute.length)throw Error('Plan a route and choose the insured destination first');
 const stops=remainingRoute.slice(0,legs+1),route=stops.map(stop=>stop.id),plannedDistance=stops.slice(1).reduce((n,stop,i)=>n+worldDistance(stops[i].world,stop.world),0);
 const distanceText=values.distance.trim(),distance=Number(distanceText),distanceReason=values.distanceReason.trim();
 if(!distanceText||!Number.isFinite(distance)||distance<0)throw Error('Enter a nonnegative insured distance in parsecs');
 if(distance!==plannedDistance&&!distanceReason)throw Error('Add a reason for overriding the planned distance');
 return {...rules.insuranceQuote(insuredValue,Number(values.coverage),distance,stops.map(stop=>stop.world.zone),mp,values.manualPremium.trim()||null,creditStep),route,destination:route.at(-1),routeProgress:0,plannedDistance,distanceOverrideReason:distance!==plannedDistance?distanceReason:null};
}
