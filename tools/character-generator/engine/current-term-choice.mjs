// Player corrections are a distinct audited operation, never a GM restore.
// The caller supplies validated replay snapshots and roll audits.
export const editableChoiceTypes=new Set(['choose-effect','choose-skill','education-skill','education-service','companion-skill','injury-loss','preterm-commission']);
const terminal=new Set(['term-end','ageing','benefits','finished','retirement','deceased']);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function currentTermChoiceAccess({current,before,after,command,subsequent=[]}){
 const locked=reason=>({editable:false,label:'READ ONLY',reason});
 if(!current?.character||!before?.character||!after?.character)return locked('Recorded term context is unavailable.');
 if(current.character.deceased||terminal.has(current.stage))return locked('This term is complete.');
 if(before.character.terms!==current.character.terms||after.character.terms!==current.character.terms)return locked('Completed terms are read only.');
 if(before.active!==current.active||after.active!==current.active)return locked('Previous careers are read only.');
 if(current.active!==null){const career=current.character.careers[current.active];if(!career||before.character.careers[before.active]?.id!==career.id||after.character.careers[after.active]?.id!==career.id)return locked('Previous careers are read only.');}
 else {const index=current.education;if(!Number.isInteger(index)||before.education!==index||after.education!==index||current.character.educations?.[index]?.completed)return locked('Only a current unfinished career or education term can be changed.');}
 if(!editableChoiceTypes.has(command?.type))return locked('This recorded action is not a supported editable choice.');
 if(subsequent.some(e=>['restore','gm-replay'].includes(e.command?.type)))return locked('A later correction requires separate review before this choice can change.');
 return {editable:true,label:'CURRENT TERM',reason:'Preview the consequences before changing this recorded choice.'};
}
export function assertRetainedRolls(original,replacement){
 if(original.length!==replacement.length)throw new Error('The change would alter the recorded action sequence. Your character is unchanged.');
 for(let i=0;i<original.length;i++)if(!same(original[i].rolls,replacement[i].rolls))throw new Error('The change would require different dice or a reroll at action '+original[i].number+'. Your character is unchanged.');
}
// Do not whitelist consequence fields: rights, pending effects and species-specific
// ledgers are mechanical state too. New fields must appear without an audit update.
export function choiceStateChanges(before,after,path=''){
 if(same(before,after))return [];
 if(before&&after&&typeof before==='object'&&typeof after==='object'&&!Array.isArray(before)&&!Array.isArray(after))return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(key=>choiceStateChanges(before[key],after[key],path?path+'.'+key:key));
 return [{path,before:before===undefined?null:structuredClone(before),after:after===undefined?null:structuredClone(after)}];
}
