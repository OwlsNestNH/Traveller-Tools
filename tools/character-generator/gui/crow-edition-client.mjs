import {call as originalCall} from './client.mjs';

// Pilot scope only; validation, dice, replay and audit remain in the original API.
const commands=new Set(['configure','setup','gm-mode','gm-academy-training','notes','gm-override','gm-psi-mode','gm-psi-testing','gm-physical-dice','enter-physical-statistic','roll-statistics','swap-statistics','accept-statistics']);
const unsupported=(message='Crow Edition supports Human opening and characteristics only. Later screens are not included.')=>({ok:false,error:{code:'INVALID_REQUEST',message}});
export async function call(request){
 if(request.operation==='command'){
  const {type,payload={}}=request.command??{};
  if(!commands.has(type))return unsupported();
  if(type==='setup'&&payload.species!=='human')return unsupported();
  if(type==='gm-override'&&!['pool','pool-score'].includes(payload.field)&&!/^stat\.(STR|DEX|END|INT|EDU|SOC|PSI|LCK|WLT|MOR|SAN|CHA)$/.test(payload.field))return unsupported();
  if(['roll-statistics','enter-physical-statistic','gm-physical-dice'].includes(type)){
   const current=await originalCall({operation:'project',session:request.session});
   if(!current.ok)return current;
   if(type==='roll-statistics'&&current.state.pool.length)return unsupported('Regenerating characteristics requires a confirmed new run. Recorded rolls are retained.');
   if(type!=='roll-statistics'&&request.session.events.some(event=>event.command.type==='roll-statistics'))return unsupported('Recorded computer rolls cannot be replaced with physical dice entries. Use a logged GM correction.');
  }
 }
 const result=await originalCall(request);
 if(result.ok&&['import','project'].includes(request.operation)){
  if(!['identity','statistics','background'].includes(result.state.stage)||result.state.character.species!=='human')return unsupported();
 }
 return result;
}
