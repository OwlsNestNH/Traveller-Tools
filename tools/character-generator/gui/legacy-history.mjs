// Read-only inspection of recorded data. This does not replay or validate rules.
export const MAX_HISTORY_BYTES=2000000;
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function clipped(value,limit=8000){let text;try{text=typeof value==='string'?value:JSON.stringify(value??null);}catch{return '[Nested data cannot be displayed; original file is unchanged]';}return text.length>limit?text.slice(0,limit)+' [display shortened; original file is unchanged]':text;}
export function inspectRecordedHistory(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>MAX_HISTORY_BYTES)throw new Error('This record is too large to inspect here. Download and preserve the original file.');
 let record;try{record=JSON.parse(raw);}catch{throw new Error('The original file is not readable JSON. Its bytes can still be downloaded unchanged.');}
 if(!isObject(record)||record.format!=='traveller-character-session'||!Array.isArray(record.events)||record.events.length>2000)throw new Error('This file has no supported recorded action history. Its original bytes are unchanged.');
 return {version:clipped(record.version,80),rulesRevision:typeof record.rulesRevision==='string'?clipped(record.rulesRevision,120):'Not recorded (legacy)',events:record.events.map((event,index)=>{
  if(!isObject(event))return {number:index+1,type:'Unreadable action',summary:'This entry is not an action object.',command:clipped(event),rolls:[]};
  return {number:index+1,type:typeof event.command?.type==='string'?clipped(event.command.type,100):'Unknown action',summary:typeof event.summary==='string'?clipped(event.summary):'No saved summary.',command:clipped(event.command,16000),rolls:Array.isArray(event.rolls)?event.rolls.slice(0,100).map(roll=>clipped(roll,2000)):[],rollsShortened:Array.isArray(event.rolls)&&event.rolls.length>100};
 })};
}
export function recordedHistoryText(history){
 return 'UNVERIFIED RECORDED HISTORY - READ ONLY\nThis is saved text and dice, not a reconstructed or verified character. The current rules have not been applied.\nSave version: '+history.version+'; rules revision: '+history.rulesRevision+'\n\n'+history.events.map(event=>'ACTION '+event.number+' | '+event.type+'\n'+event.summary+'\nCommand: '+event.command+'\n'+event.rolls.join('\n')+(event.rollsShortened?'\nAdditional rolls omitted from display; preserve the original file.':'')).join('\n\n');
}
