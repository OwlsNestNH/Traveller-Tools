// Test-only referee decisions. These are fixtures, not source rulings or campaign data.
// A placeholder validates continuation/replay only, not the omitted mechanic.
export function testSourceDecision(s){
 const p=s.pending,c=s.character,kind=p?.kind;
 if(!kind)return null;
 let type='resolve-book',payload={confirmed:true},gm=false,classification='source-assisted',decision='',unvalidated=[];
 const placeholder=(text,mechanics=p.label)=>{classification='placeholder';decision=text;unvalidated.push(mechanics);};
 switch(kind){
 case 'psionic-training-terms':
  decision='Fictional test institute provides testing/training during the pre-career education period, with zero personal charge. Provider/access/timing are test assumptions, not published entitlement.';
  Object.assign(payload,{psionicApproved:true,psionicTimingConfirmed:true,psionicCost:0,psionicFunding:'provided'});break;
 case 'core-life-decision':{
  type='resolve-life-event';const r=c.lifeEvents.find(x=>x.id===p.lifeEventId);
  if(p.decision==='narrative'){payload.outcome=r.table==='core.life-events'?'birth':r.row===4?'amnesia':'government';decision='Fictional narrative: '+payload.outcome+'; no invented mechanical reward.';}
  else if(['ending','betrayal'].includes(p.decision)){const target=p.decision==='betrayal'?c.relationships.find(x=>['Contact','Ally'].includes(x.role)):null;Object.assign(payload,{role:'Rival',...(target?{relationshipId:target.id}:{name:'TEST ONLY fictional rival'})});decision='Choose Rival, retaining an eligible existing relationship when required.';}
  else if(p.decision==='crime'){payload.outcome='lose-benefit';decision='Choose loss of one benefit roll rather than imprisonment.';}
  else if(p.decision==='psionics'){payload.outcome='decline';decision='Decline the optional institute test.';}
  else if(p.decision==='artefact'){payload.name='TEST ONLY inert archaeological fragment';placeholder('Fictional inert artefact, no claimed technological powers or cash value.','Artefact identity and capabilities were not source-validated.');}
  else return null;
  break;
 }
 case 'prisoner-lawyer':type='resolve-prisoner-lawyer';payload={outcome:'decline'};decision='Decline optional lawyer; no funds or Advocate ability invented.';break;
 case 'aslan-restoration':type='resolve-aslan-restoration';payload={accept:false};decision='Decline optional restoration.';break;
 case 'aslan-outlaw-restoration':
  type='resolve-aslan-outlaw-restoration';
  if(c.gender==='female'){payload={decision:'decline'};decision='Decline optional marriage/restoration.';}
  else{gm=true;payload={decision:'restore',originalSOC:Math.max(1,c.aslanOrigin?.familySOC??s.currentAslanOutlawRestoration?.socBefore??c.stats.SOC),originalSOCConfirmed:true};decision='Test referee uses recorded family SOC, or pre-restoration SOC when unavailable, for the required male restoration.';}
  break;
 case 'aslan-origin-source':
  if(p.decision!=='female-independence')return null;
  type='resolve-aslan-origin-source';gm=true;payload={decision:'omit'};decision='Resolve female Independence conflict by omitting the male-only family award.';break;
 case 'benefit-equipment':
  Object.assign(payload,{benefitItemName:'TEST ONLY '+p.category+' placeholder',benefitItemCost:Math.min(100,p.maximumCost??100),benefitItemTL:Math.min(5,p.maximumTL??5),...(p.weaponSkillRequired?{benefitWeaponSkill:p.weaponSkillOptions[0]}:{}),...(p.replaceOriginal?{benefitReplaceAssetId:p.replacementAssetIds[0]}:{})});
  placeholder('Fictional equipment within numeric limits; item catalogue existence and restrictions not checked.','Actual equipment catalogue selection, price, TL and restrictions.');break;
 case 'benefit-ship':
  Object.assign(payload,{benefitShipVariant:p.variants[0],benefitShipHistory:'TEST ONLY fictional uneventful service history. Required history/age/discount outcomes not validated.'});
  placeholder('Use first offered ship variant and placeholder service history.','Ship-history rolls, age and discount interpretation.');break;
 case 'benefit-source':
  if(p.sainthood){payload.benefitSainthoodSuccess=false;decision='Test referee rules the belief-specific sainthood attempt unsuccessful; no interaction bonus.';unvalidated.push('Belief-specific external Science check.');}
  else{Object.assign(payload,{benefitResolution:'record',benefitOutcomeName:'TEST ONLY '+(s.currentBenefitAward?.name??'source entitlement')+' placeholder'});placeholder('Record a non-cash fictional entitlement token. Territory, ownership, usage conditions and value remain unvalidated.');}
  break;
 case 'injury-zero':{
  const injury=s.currentInjury;
  Object.assign(payload,{injurySurvives:true,injuryStats:Object.fromEntries(['STR','DEX','END'].map(k=>[k,Math.min(injury.statsBefore[k],Math.max(1,injury.rawAfter[k]))]))});
  decision='Test referee permits survival and sets nonpositive untreated injury scores to1, capped at pre-injury values.';unvalidated.push('Referee survival/zero-score rule is hypothetical.');break;
 }
 case 'injury-medical':payload.medicalCoveredCost=0;decision='No organisational subsidy; engine retains personal treatment cost/debt.';break;
 case 'ageing-financing':{
  const loan=Math.max(0,p.cost-c.cash);Object.assign(payload,{ageingCareApproved:true,effects:[{kind:'cash',value:loan},{kind:'debt',value:loan}]});decision='Fictional unsecured loan funds only the ageing-care shortfall; matching debt recorded.';break;
 }
 case 'benefit':
  payload.effects=[];placeholder('Out-of-table benefit receives no additional award in this test; engine continuation only.','Out-of-table benefit resolution and award amount.');break;
 case 'native-effect':
  payload.effects=[];placeholder('TEST PLACEHOLDER: do not invent an unsupported mechanical award. Continue after explicitly omitting this one source effect: '+p.label,p.label);
  if(p.label?.includes('another person')){classification='source-assisted';unvalidated=['The other fictional person’s injury is not mechanically modelled.'];decision='Fictional contact suffers a nonfatal injury; no characteristic change to the Traveller.';}
  break;
 case 'companion-graduation':Object.assign(payload,{graduated:false,honours:false,effects:[]});decision='No possessed talent satisfies the award, so test referee records no graduation or honours.';break;
 case 'companion-timing':payload.educationAgeAfter=c.age+4;decision='Test referee applies four calendar years to this education term.';break;
 case 'pension':Object.assign(payload,{pensionAnnualCredits:0,pensionCondition:'TEST ONLY entitlement deferred pending source ruling'});placeholder('Defer unsupported pension; no recurring credits awarded.','Actual pension eligibility, amount and payment conditions.');break;
 default:return null;
 }
 const note=('TEST ONLY: '+decision).slice(0,500);
 if(type==='resolve-book')payload.note=note;
 else if(type==='resolve-life-event'||gm)payload.reason=note;
 return {type,payload,gm,ruling:{kind,source:{id:p.source,page:p.page},classification,decision,unvalidated}};
}
