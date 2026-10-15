import {createCargoRemoval,setCargoRemaining,cargoRemovalSummary} from './cargo-removal.mjs?v=cargo-management-20261015-92';
// One accepted intent owns its save through asynchronous provider settlement.
export function createCargoRemovalSession({getState,readSaved,save,onBusy=()=>{},onComplete=()=>{},onFailure=()=>{},onUnknown=()=>{}}){
 let draft=null,operation=null,error='';
 const current=()=>{if(draft&&draft.revision!==getState().revision&&!operation)draft=null;return draft;};
 return {
  get pending(){return !!operation;},get error(){return error;},current,
  set(key,value){if(operation)return false;draft=setCargoRemaining(current()??createCargoRemoval(getState()),key,value);error='';return true;},
  step(key,delta){if(operation)return false;const d=current()??createCargoRemoval(getState());return this.set(key,String(BigInt(d.remaining[key])+BigInt(delta)));},
  cancel(){if(operation)return false;draft=null;error='';return true;},
  observe(next,local){if(operation&&local&&next.revision===operation.revision+1&&!operation.publication)operation.publication=JSON.stringify(next);},
  async confirm(){
   if(operation)return false;
   const accepted=structuredClone(current()??createCargoRemoval(getState()));
   if(!cargoRemovalSummary(accepted).changed)return false;
   const owner={revision:accepted.revision,publication:null};operation=owner;error='';
   let attempted=false;
   try{
    onBusy();attempted=true;
    const candidate=await save(accepted);
    const bytes=JSON.stringify(candidate);
    if(!owner.publication||owner.publication!==bytes||JSON.stringify(getState())!==bytes||JSON.stringify(readSaved())!==bytes)throw Error('Cargo save completion could not be verified.');
    draft=null;operation=null;
    try{onComplete(candidate);}catch(cause){onUnknown(cause);}
    return true;
   }catch(cause){
    const known=!owner.publication&&(!attempted||cause?.code==='SAVE_NOT_COMMITTED'&&cause.committed===false);
    operation=null;error=cause.message;
    if(known){current();onFailure(cause);}else{draft=null;onUnknown(cause);}
    return false;
   }
  }
 };
}
