import {call as originalCall} from './client.mjs';

// Presentation scope only: the unchanged Rules API remains the authority.
const openingCommands=new Set(['configure','setup','gm-mode','gm-academy-training','notes','gm-override']);
const unsupported=()=>({ok:false,error:{code:'INVALID_REQUEST',message:'Crow Edition Beta 0.1 supports only Human opening setup, before any dice rolls. Use the original generator for later screens.'}});
export async function call(request){
 if(request.operation==='command'){
  if(!openingCommands.has(request.command?.type))return unsupported();
  if(request.command.type==='gm-override'&&request.command.payload?.field!=='stat.PSI')return unsupported();
  if(request.command.type==='setup'&&request.command.payload?.species!=='human')return unsupported();
 }
 const result=await originalCall(request);
 if(result.ok&&['import','project'].includes(request.operation)){
  if(!['identity','statistics'].includes(result.state.stage)||result.state.character.species!=='human'||result.session.events.some(event=>event.rolls?.length))return unsupported();
 }
 return result;
}
