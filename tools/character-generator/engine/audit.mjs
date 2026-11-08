// Derived, deterministic audit detail. The command history remains the saved authority.
const clone=value=>value===undefined?null:structuredClone(value);
export function characterChanges(before,after){
 const changes=[];
 const add=(path,a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))changes.push({path,before:clone(a),after:clone(b)});};
 for(const field of ['name','notes','species','variant','culture','gender','identityGender','homeworld','age','terms','cash','debt','sentenced','outcast','deceased','qualificationBanned','psionEntryPermission','preCareer','birthOrder','medicalCosts','retirementFromCreation','nonCareerMonths','treatmentAgeingTerms','psionicLoss'])add(field,before[field],after[field]);
 for(const field of ['stats','skills'])for(const key of new Set([...Object.keys(before[field]??{}),...Object.keys(after[field]??{})]))add(field+'.'+key,before[field]?.[key],after[field]?.[key]);
 for(const field of ['benefits','relationships','historyNotes','futureConditions','traits','injuries','medicalBills','medicalSettlements','ageingCrises','benefitAwards','assets','annualIncome','benefitRollHistory','statusReviews','careerTransfers','relationshipLosses']){
  const old=before[field]??[],next=after[field]??[];for(let i=0;i<Math.max(old.length,next.length);i++)add(field+'.'+i,old[i],next[i]);
 }
 // Persisted outcomes are audited without exposing internal continuation/effect queues.
 const ledgerFields={
  aslanOutlawRestorations:['id','source','eventResult','originCareerId','originCareerIndex','originAssignment','originCareerTerms','grantedAtCompletedTerms','gender','socBefore','outcastBefore','exitBefore','stayBefore','status','decision','socRoll','socAfter','outcastAfter','clanShares','shareAwardIds','married','departure'],
  aslanHistoricalEntries:['id','source','restorationId','originCareerIndex','generationTerms','age','educationCount','careerId','assignment','priorCareerIndices','status','decision','attempt','expiry','supersededBy'],
  aslanRestorations:['id','source','eventResult','originCareerId','originCareerIndex','originAssignment','grantedAtCompletedTerms','availableAtCompletedTerms','socBefore','outcastBefore','status','decision','socAfter','outcastAfter','attempt','expiry'],
  aslanOfficerOffers:['id','source','eventResult','originCareerId','originCareerIndex','originAssignment','grantedAtCompletedTerms','availableAtCompletedTerms','targetCareerId','status','selectedAssignment','qualificationDM','commitment','check','transitionId','newCareerIndex','expired','rankMapping','statusVerification','cancellation'],
  aslanStatusChanges:['id','cause','source','careerIndex','generationTerms','age','socBefore','socAfter','outcastBefore','outcastAfter','removed','awardIds'],
  careerTransitions:['id','source','procedureSource','generationTerms','age','fromCareerIndex','fromCareerId','fromAssignment','toCareerId','toAssignment','mode','check','automaticReason','status','newCareerIndex'],
  assignmentChanges:['id','careerId','careerIndex','fromAssignment','toAssignment','mode','status','source','generationTerms','age','check','newCareerIndex','rank','officer','automaticReason','transitionId'],
  benefitCredits:['id','source','originCareerId','originCareerIndex','value','scope','status','consumption'],
  advisoryServices:['id','source','originCareerId','originCareerIndex','careerTerms','generationTerms','age','status','careerId','ruling','training','cash','cashLimitDecision','completion'],
  crossCareerRoutes:['id','kind','source','originCareerId','originCareerIndex','careerTerms','generationTerms','age','status','check','tables','training','completion'],
  merchantFines:['id','source','status','die','amount','origin','decision','payment','reeducationId','completion'],
  reeducations:['id','source','status','origin','roll','fineDie','decisions','decisionHistory','timeline','completion']
 };
 for(const [ledger,fields] of Object.entries(ledgerFields)){
  const a=before[ledger]??[],b=after[ledger]??[];
  for(let i=0;i<Math.max(a.length,b.length);i++)for(const field of fields)add(ledger+'.'+i+'.'+field,a[i]?.[field],b[i]?.[field]);
 }
 // Only persisted Aslan origin evidence, never projected source choices or queues.
 for(const field of ['source','initialStats','familySOC','statPool','identityGender','gender','family','familyBandDecision','birthOrder','estate','clan','pride','background','rite','status','decisions'])add('aslanOrigin.'+field,before.aslanOrigin?.[field],after.aslanOrigin?.[field]);
 add('sainthood',before.sainthood,after.sainthood);
 const oldGames=before.psionicGames?.applications??[],newGames=after.psionicGames?.applications??[];for(let i=0;i<Math.max(oldGames.length,newGames.length);i++)add('psionicGames.applications.'+i,oldGames[i],newGames[i]);
 for(const field of ['historyKnown','checksAttempted','firstTalentChosen'])add('psionics.'+field,before.psionics?.[field],after.psionics?.[field]);
 for(const field of ['attempts','tests','training','rulings','importedAttempted']){const a=before.psionics?.[field]??[],b=after.psionics?.[field]??[];for(let i=0;i<Math.max(a.length,b.length);i++)add('psionics.'+field+'.'+i,a[i],b[i]);}
 const old=before.careers??[],next=after.careers??[];
 for(let i=0;i<Math.max(old.length,next.length);i++)for(const field of ['id','assignment','terms','rank','officer','benefitRolls','forcedExit','forcedStay','parole','released','pension','pensionCondition','pensionEntitlement','pensionExitStatusBasis','pensionStatusReviewRequired','termHistory','exitGenerationTerms','exitAge','exitAssignment','aslanOfficerOfferId','aslanRankMapping','aslanRestorationExit'])add('careers.'+i+'.'+field,old[i]?.[field],next[i]?.[field]);
 const oldEducation=before.educations??[],newEducation=after.educations??[];
 for(let i=0;i<Math.max(oldEducation.length,newEducation.length);i++){
  const a=oldEducation[i]??{},b=newEducation[i]??{};
  for(const field of ['id','term','completed','graduationAllowed','serviceAwardUsed','careerAttempts','curriculum','citizenBranch'])add('educations.'+i+'.'+field,a[field],b[field]);
  for(const field of ['entry','graduation'])for(const key of ['success','total','target','graduated','honours'])add('educations.'+i+'.'+field+'.'+key,a[field]?.[key],b[field]?.[key]);
  for(const key of new Set([...Object.keys(a.selections??{}),...Object.keys(b.selections??{})]))add('educations.'+i+'.selections.'+key,a.selections?.[key],b.selections?.[key]);
 }
 return changes;
}
