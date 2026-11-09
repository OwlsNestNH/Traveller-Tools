// Companion Update 2024 p.40 event9; Core 2022 pp.18,46 benefit entitlements.
export function believerBuyoutPlan(record,losses=[],careerIndex){
 if(record.id!=='companion.believer')throw Error('This buyout belongs to the Believer career.');
 const highest=record.highestRank??record.rank,rankEntitlement=highest>=5?3:highest>=3?2:highest>=1?1:0;
 const accrued=record.benefitRolls,term=record.mishap||record.benefitBlock>0?0:1,rank=Math.max(0,rankEntitlement-(record.forfeitedRankBenefitRolls??0));
 const applicable=losses.filter(loss=>loss.status==='owed'&&(loss.careerIndex===null||loss.careerIndex===careerIndex));
 const lossIds=applicable.slice(0,accrued+term+rank).map(loss=>loss.id),total=accrued+term+rank-lossIds.length;
 return {accrued,term,rank,rankEntitlement,lossIds,total,minimum:total*20000,maximum:total*120000};
}
export function believerBuyoutChoice(plan){return 'Accept: leave this career and forfeit '+plan.total+' Benefit roll'+(plan.total===1?'':'s')+' for Cr2D × 10,000 per roll (Cr'+plan.minimum.toLocaleString('en-US')+'–'+plan.maximum.toLocaleString('en-US')+'). Choose one 2D roll x Cr10,000 x the forfeited count, or sum separate 2D rolls x Cr10,000 for each forfeited roll. Or refuse and gain 1D Enemies, continuing this term.';}
