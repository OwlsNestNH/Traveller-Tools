import * as S from './state.mjs?v=rule-info-20261010-33';
import {creditStep} from './rounding.mjs?v=rule-info-20261010-33';

// Synchronous relocation only. Store owns editing authority, disk revisions,
// serialization, durable writes and publication through its onChange callback.
// Expected revisions are supplied by callers, never inferred from a dialog.
export function createCampaignController({getState,getStore,getKnownWorlds,getRounding}){
 let localSave=false;
 function save(next,expectedRevision){
  localSave=true;
  try{return getStore().save(next,expectedRevision);}finally{localSave=false;}
 }
 return {
  isLocalSave:()=>localSave,
  save,
  transition(label,change,expectedRevision){
   const current=getState();
   if(expectedRevision!==current.revision)throw Error('Campaign changed. Reopen this preview before committing.');
   const next=S.transition(current,label,state=>{
    state.worlds={...getKnownWorlds(),...state.worlds};
    change(state);
    const rounding=getRounding();
    if(rounding.length)state.events.push({id:S.uid(),label:'Rounding applied [R]',hours:state.hours,roundingStep:creditStep(state),roundingChanges:structuredClone(rounding)});
   });
   save(next,expectedRevision);
   // Preserve the existing candidate return and callback publication order.
   // A throwing onChange may follow a durable write; do not retry here.
   return next;
  },
  prepareJump(roll,expectedRevision){
   const current=getState(),prepared=S.prepareJump(current,roll);
   if(prepared.state!==current)save(prepared.state,expectedRevision);
   return prepared;
  },
  undo(expectedRevision){return save(S.undo(getState()),expectedRevision);},
  undoJump(expectedRevision){
   const current=getState();
   if(current.revision!==expectedRevision)throw Error('Campaign changed. Reopen this preview before committing.');
   return save(S.undoJump(current),expectedRevision);
  },
  // Replacement is an external campaign change even when initiated here. Its
  // notification must clear local offers, including reused IDs after import.
  replace(next,expectedRevision){return getStore().replace(next,expectedRevision);}
 };
}
