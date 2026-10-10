import * as S from './state.mjs?v=setup-location-completion-20261010-46';
import {creditStep} from './rounding.mjs?v=setup-location-completion-20261010-46';
import {SaveNotCommittedError} from './persistence.mjs?v=setup-location-completion-20261010-46';

// Store remains synchronous. An injected provider may return a completion
// Promise; that completion must include the durable write and publication.
// Expected revisions are always supplied by callers, never inferred here.
export function createCampaignController({getState,getStore,getKnownWorlds,getRounding}){
 let localSave=false,pending=null;
 const publications=new Map(),replacementPublications=new Map();
 const beforeWrite=fn=>{try{return fn();}catch(cause){throw new SaveNotCommittedError(cause);}};
 const requireIdle=()=>{if(pending)throw Error('Wait for the current campaign save to finish.');};
 function write(next,expectedRevision,replacement=false){
  // The provider never receives the candidate retained by a caller/mutator.
  const snapshot=beforeWrite(()=>{requireIdle();return structuredClone(next);});
  const publicationRevision=beforeWrite(()=>replacement?expectedRevision+1:snapshot.revision);
  const operation={};pending=operation;
  if(replacement)replacementPublications.set(operation,publicationRevision);
  else publications.set(operation,publicationRevision);
  const finish=()=>{publications.delete(operation);replacementPublications.delete(operation);if(pending===operation)pending=null;};
  localSave=!replacement;
  try{
   const result=replacement?getStore().replace(snapshot,expectedRevision,operation):getStore().save(snapshot,expectedRevision,operation);
   if(result&&typeof result.then==='function')return Promise.resolve(result).then(value=>{finish();return value;},error=>{finish();throw error;});
   finish();return result;
  }catch(error){finish();throw error;}
  finally{localSave=false;}
 }
 const save=(next,expectedRevision)=>write(next,expectedRevision);
 const completed=(result,value)=>result&&typeof result.then==='function'?Promise.resolve(result).then(()=>value):value;
 return {
  // Compatibility for synchronous callers/tests only. Async provenance uses
  // a one-use token tied to this exact pending write, never a global flag.
  isLocalSave:()=>localSave,
  isLocalPublication(next,metadata){
   const token=metadata?.saveToken;
   if(!publications.has(token)||publications.get(token)!==next.revision)return false;
   publications.delete(token);return true;
  },
  // Replacement provenance identifies an owned completion only. It must never
  // retain local offers or turn a replacement into an ordinary local save.
  takeReplacementPublication(next,metadata){
   const token=metadata?.replacementToken;
   if(!replacementPublications.has(token)||replacementPublications.get(token)!==next.revision)return false;
   replacementPublications.delete(token);return true;
  },
  save,
  transition(label,change,expectedRevision,{onPrepared}={}){
   const next=beforeWrite(()=>{
    requireIdle();const current=getState();
    if(expectedRevision!==current.revision)throw Error('Campaign changed. Reopen this preview before committing.');
    return S.transition(current,label,state=>{
     state.worlds={...getKnownWorlds(),...state.worlds};
     change(state);
     const rounding=getRounding();
     if(rounding.length)state.events.push({id:S.uid(),label:'Rounding applied [R]',hours:state.hours,roundingStep:creditStep(state),roundingChanges:structuredClone(rounding)});
    });
   });
   // Optional UI phase notification; no candidate is exposed or replaced.
   // A throwing observer is still before the provider and cannot commit.
   beforeWrite(()=>onPrepared?.());
   return completed(save(next,expectedRevision),next);
  },
  prepareJump(roll,expectedRevision){
   const {current,prepared}=beforeWrite(()=>{
    const current=getState(),prepared=S.prepareJump(current,roll);
    if(prepared.state!==current){
     requireIdle();
     if(expectedRevision!==current.revision)throw Error('Campaign changed. Reopen this preview before committing.');
    }
    return {current,prepared};
   });
   return prepared.state===current?prepared:completed(save(prepared.state,expectedRevision),prepared);
  },
  undo(expectedRevision){
   const next=beforeWrite(()=>{requireIdle();const current=getState();if(expectedRevision!==current.revision)throw Error('Campaign changed. Reopen this preview before committing.');return S.undo(current);});
   return save(next,expectedRevision);
  },
  undoJump(expectedRevision){
   const next=beforeWrite(()=>{requireIdle();const current=getState();if(current.revision!==expectedRevision)throw Error('Campaign changed. Reopen this preview before committing.');return S.undoJump(current);});
   return save(next,expectedRevision);
  },
  // Replacement is an external campaign change even when initiated here. Its
  // notification must clear local offers, including reused IDs after import.
  replace(next,expectedRevision){return write(next,expectedRevision,true);}
 };
}
