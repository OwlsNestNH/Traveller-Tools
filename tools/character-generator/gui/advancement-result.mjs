// Presentation only: consume replay-validated summaries and observed audit changes.
// Never infer a promotion from a successful check or change saved action summaries.
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const stats={STR:'Strength',DEX:'Dexterity',END:'Endurance',INT:'Intellect',EDU:'Education',SOC:'Social standing',CHA:'Charisma',PSI:'Psionic strength'};
const result=(title,details=[],status='info')=>({title,details,text:[title,...details].join(' '),status});
function effects(event){
 const details=[];
 for(const {path,before,after} of event.changes??[]){
  if(/^careers\.\d+\.rank$/.test(path)&&finite(before)&&finite(after)&&before!==after)details.push(after>before?'Promoted: rank '+before+' → '+after+'.':'Rank '+before+' → '+after+'.');
  if(/^careers\.\d+\.officer$/.test(path)&&after===true&&before!==true)details.push('Commissioned as an officer.');
  if(/^careers\.\d+\.forcedExit$/.test(path)&&after===true&&before!==true)details.push('Must leave this career.');
  if(/^careers\.\d+\.forcedStay$/.test(path)&&after===true&&before!==true)details.push('Must remain in this career for the next term.');
  if(/^careers\.\d+\.released$/.test(path)&&after===true&&before!==true)details.push('Released from prison.');
  if(path.startsWith('skills.')&&finite(after)&&before!==after)details.push(path.slice(7)+': '+(finite(before)?before:'untrained')+' → '+after+'.');
  if(path.startsWith('stats.')&&finite(before)&&finite(after)&&before!==after)details.push((stats[path.slice(6)]??path.slice(6))+': '+before+' → '+after+'.');
 }
 return details;
}
export function advancementResult(event){
 if(!event||typeof event.summary!=='string')return null;
 const summary=event.summary;
 const pending={
  'Advancement check requires source resolution for the absent characteristic.':'Advancement needs source resolution. No result yet.',
  'Commission check requires source resolution for the absent characteristic.':'Commission needs source resolution. No result yet.',
  'Pre-term commission requires source resolution for the absent characteristic.':'Education commission needs source resolution. No result yet.'
 };
 if(pending[summary])return result(pending[summary],[], 'pending');
 if(summary==='This career has no conventional advancement roll.')return result('No conventional advancement roll for this career.',effects(event));
 if(summary==='Declined the pre-term education commission opportunity.')return result('Education commission declined.',effects(event));
 const match=summary.match(/^(Advancement|Commission|Pre-term education commission): (\{.*\})(\. Rank (\d+)\.|\. Became rank 1 officer; no advancement roll this term\.|\. Advancement remains available\.|\.)$/);
 if(!match)return null;
 let check;try{check=JSON.parse(match[2]);}catch{return null;}
 if(!check||Array.isArray(check)||typeof check.success!=='boolean'||(check.automatic!==true&&(!finite(check.total)||!finite(check.target))))return null;
 const advancement=match[1]==='Advancement',education=match[1]==='Pre-term education commission',label=advancement?'Advancement':education?'Education commission':'Commission';
 if(advancement&&!match[4]||!advancement&&match[4])return null;
 const title=label+(check.automatic===true?' succeeded automatically.':check.success?' succeeded.':' failed.');
 const details=check.automatic===true?[]:['Check total '+check.total+' against target '+check.target+'+.'];
 details.push(...effects(event));
 if(advancement){
  if(!(event.changes??[]).some(c=>/^careers\.\d+\.rank$/.test(c.path)&&finite(c.before)&&finite(c.after)&&c.before!==c.after))details.push('Rank remains '+Number(match[4])+'.');
  if(check.success)details.push('An additional training roll is earned; resolve any pending rank award first.');
 }else if(!education)details.push(check.success?'No advancement roll this term.':'Advancement remains available.');
 return result(title,details,check.success?'success':'failure');
}
