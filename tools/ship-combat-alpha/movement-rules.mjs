// Traveller Companion Update 2024, printed pp.173–175. No combat resolution.
export const HEX_KM=648,ROUND_MINUTES=6;
export const RANGE_BANDS=Object.freeze([{name:'Short',max:1},{name:'Medium',max:15},{name:'Long',max:38},{name:'Very Long',max:77}].map(Object.freeze));
export function distanceSpaces(a,b){const q=a.q-b.q,r=a.r-b.r;return Math.sqrt(q*q+q*r+r*r);}
export function rangeInfo(a,b){const spaces=distanceSpaces(a,b),epsilon=Number.EPSILON*8*Math.max(1,spaces),band=spaces===0?'Adjacent / Close':RANGE_BANDS.find(b=>spaces<=b.max+epsilon)?.name??'Distant';return {spaces,km:spaces*HEX_KM,band,outwardSpaces:Math.ceil(Math.max(0,spaces-epsilon))};}
// Deterministic axial/cube rounding for a shortest legal braking step. This
// digital straight-line choice is an implementation policy, not a quoted rule.
export function reducedVelocity(v,budget){const speed=Math.max(Math.abs(v.q),Math.abs(v.r),Math.abs(v.q+v.r));if(!speed||budget>=speed)return {q:0,r:0};if(!budget)return {...v};const factor=(speed-budget)/speed,cube=[v.q*factor,-(v.q+v.r)*factor,v.r*factor],rounded=cube.map(Math.round),delta=cube.map((n,i)=>Math.abs(n-rounded[i])),axis=delta.indexOf(Math.max(...delta));rounded[axis]=-rounded[(axis+1)%3]-rounded[(axis+2)%3];return {q:rounded[0]||0,r:rounded[2]||0};}
