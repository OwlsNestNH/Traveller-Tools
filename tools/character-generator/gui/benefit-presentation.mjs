const finite=Number.isFinite;
export function benefitRollEvidence(event,state){
 if(!['benefit','choose-effect','choose-skill','resolve-book'].includes(event?.type))return null;
 const added=(event.changes??[]).find(c=>/^benefitRollHistory\.\d+$/.test(c.path)&&!c.before&&c.after)?.after;
 const record=added??(event.type==='benefit'?state?.benefitRollContext:null);
 if(!record||!['cash','material'].includes(record.table)||![record.natural,record.modifier,record.result].every(finite)||record.natural+record.modifier!==record.result)return null;
 return record;
}
const names={STR:'Strength',DEX:'Dexterity',END:'Endurance',INT:'Intellect',EDU:'Education',SOC:'Social standing',CHA:'Charisma',TER:'Territory',WLT:'Wealth',PSI:'Psionic strength'};
export function benefitAwardHeadline(event){
 const changes=event.changes??[],cash=changes.find(c=>c.path==='cash'&&finite(c.before)&&finite(c.after)&&c.after>c.before);
 if(cash)return {title:'Received Cr'+(cash.after-cash.before).toLocaleString('en-US')+'.',path:'cash'};
 const stat=changes.find(c=>/^stats\.[A-Z]+$/.test(c.path)&&finite(c.before)&&finite(c.after)&&c.after!==c.before);
 if(stat){const key=stat.path.slice(6),delta=stat.after-stat.before;return {title:(names[key]??key)+' '+(delta>=0?'+':'')+delta+' ('+stat.before+' → '+stat.after+').',path:stat.path};}
 return null;
}

export function benefitRecordedDiceEvent(event,state){
 const record=benefitRollEvidence(event,state);if(!record||event.rolls?.some(r=>r.label===(record.table==='cash'?'Cash benefit':'Material benefit')))return event;
 const rolls=(record.rolls??[]).filter(r=>Number.isInteger(r.natural)&&r.natural>=1&&r.natural<=6).map(r=>({label:record.table==='cash'?'Cash benefit':'Material benefit',values:[r.natural],total:r.natural}));
 return rolls.length?{...event,rolls:[...rolls,...(event.rolls??[])]}:event;
}
