// Separate already-described restoration from other consequences applied by
// the same accepted action. Unknown evidence stays visible rather than guessed.
export function medicalContinuationEvent(event,state,bills){
 const restoration={};
 for(const bill of bills){const record=state?.character?.injuries?.find(r=>r.id===bill.injuryId);for(const[name,points]of Object.entries(record?.restoration??{}))if(Number.isFinite(points))restoration[name]=(restoration[name]??0)+points;}
 const changes=(event.changes??[]).flatMap(c=>{
  if(/^injuries\.|^medicalBills\.|^terms$|^careers\.\d+\.terms$|^age$/.test(c.path))return [];
  const stat=c.path.match(/^stats\.(STR|DEX|END)$/)?.[1],restored=restoration[stat];
  if(restored&&Number.isFinite(c.before)&&Number.isFinite(c.after)){const before=c.before+restored;return c.after===before?[]:[{...c,before}];}
  return [c];
 });
 return {...event,changes};
}
