// Presentation evidence only. Never infer success from an unmodified dice roll,
// a character gain/loss, a free-form note, or a historical check copied unchanged.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function checked(label,check){
 if(!check||typeof check.success!=='boolean'||(!finite(check.total)&&check.automatic!==true))return null;
 return {status:check.success?'success':'failure',text:label+(check.automatic===true?(check.success?' succeeded automatically.':' failed.'):': '+check.total+(finite(check.target)?' against '+check.target+'+':'')+'; '+(check.success?'succeeded.':'failed.'))};
}
const auditLabels={careerTransitions:'Qualification',assignmentChanges:'Assignment qualification',aslanOfficerOffers:'Officer qualification',aslanCareerAccess:'Career qualification',aslanHistoricalEntries:'Career qualification',aslanRestorations:'Career qualification',benefitWagers:'Benefit wager'};
export function recordedCoverCheck(event){
 if(!['cross-career-cover','cross-career-cover-check'].includes(event?.type))return null;
 const records=(event.changes??[]).filter(c=>/^crossCareerRoutes\.\d+\.check$/.test(c.path)&&JSON.stringify(c.before)!==JSON.stringify(c.after));
 if(records.length!==1)return null;
 const c=records[0].after,rolls=(event.rolls??[]).filter(r=>r.label==='Undercover Deception check');
 if(rolls.length!==1)return null;const roll=rolls[0];
 if(c?.skill!=='Deception'||![c.natural,c.modifier,c.total,c.target].every(finite)||typeof c.success!=='boolean'||c.total!==c.natural+c.modifier||c.success!==(c.total>=c.target)||roll.values?.length!==2||!roll.values.every(n=>Number.isInteger(n)&&n>=1&&n<=6)||roll.values.reduce((a,b)=>a+b,0)!==roll.total||roll.total!==c.natural)return null;
 return {label:roll.label,natural:c.natural,modifier:c.modifier,total:c.total,target:c.target,success:c.success};
}
export function recordedConsequenceCheck(event){
 if(event?.type!=='roll-borrowed-event'||event.rolls?.length!==1)return null;
 const m=event.summary?.match(/^(.+?) result (-?\d+)\. (-?\d+) against (\d+)\+: (succeeded|failed)\./),roll=event.rolls[0];
 if(!m||roll.values?.length!==2||!roll.values.every(n=>Number.isInteger(n)&&n>=1&&n<=6)||roll.values.reduce((a,b)=>a+b,0)!==roll.total||Number(m[2])!==roll.total||!['EDU check','INT check','SOC check','STR check','DEX check','END check','PSI check','CHA check','FOL check','Skill check','Independence acquisition'].includes(roll.label))return null;
 if(m[1]!==roll.label&&!(roll.label==='Skill check'&&/^[A-Za-z][A-Za-z ()/–-]* check$/.test(m[1])))return null;
 const total=Number(m[3]),target=Number(m[4]),success=m[5]==='succeeded';if(!Number.isFinite(total)||!Number.isFinite(target)||success!==(total>=target))return null;
 return {label:m[1],natural:roll.total,total,target,success};
}
export function checkOutcome(event){
 // Restoring/replaying a snapshot can change old check records without making
 // those checks again. Replay-specific summary helpers remain responsible for
 // their own verified result; never infer one from historical audit deltas.
 if(['restore','gm-replay'].includes(event?.type))return null;
 const summary=event?.summary??'',evidence=[],consequence=recordedConsequenceCheck(event),cover=recordedCoverCheck(event);if(consequence)evidence.push(checked(consequence.label,consequence));if(cover)evidence.push(checked(cover.label,cover));
 // Exact engine summaries are replay-validated. Restrict to known commands so
 // a referee note that mentions a check cannot itself assert an outcome.
 const patterns={
  career:/^(?:Failed .+ qualification|Entered .+ \/ .+): (\{.*\})\.$/,
  'change-assignment':/^Assignment qualification: (\{.*\})\. Continuing /,
  'precareer':/^Education entry failed: (\{.*\})\./
 };
 const match=summary.match(patterns[event?.type]??/$a/);
 if(match){try{evidence.push(checked(event.type==='career'?'Qualification':event.type==='change-assignment'?'Assignment qualification':'Education entry',JSON.parse(match[1])));}catch{/* A malformed summary supplies no evidence. */}}
 const gamesLabel={'apply-psionic-games':'application','psionic-games-preliminary':'preliminary','psionic-games-final':'final'}[event?.type];
 if(gamesLabel){
  const m=summary.match(new RegExp('^Psionic Games '+gamesLabel+': (\\{.*\\})\\. '));
  if(m){try{evidence.push(checked('Psionic Games '+gamesLabel,JSON.parse(m[1])));}catch{/* Invalid serialized checks are not outcomes. */}}
 }
 for(const {path,before,after} of event?.changes??[]){
  if(event?.type==='resolve-prisoner-lawyer'&&/^prisonerLawyers\.\d+\.decision$/.test(path)&&JSON.stringify(after?.check)!==JSON.stringify(before?.check))evidence.push(checked('Lawyer appeal',after?.check));
  const direct=path.match(/^(\w+)\.\d+\.(check|attempt)$/),label=direct&&auditLabels[direct[1]];
  if(label){const check=direct[2]==='attempt'?after?.check:after,old=direct[2]==='attempt'?before?.check:before;if(JSON.stringify(check)!==JSON.stringify(old))evidence.push(checked(label,check));}
  const education=path.match(/^educations\.\d+\.(entry|graduation)\.(success|graduated)$/);
  if(education&&typeof after==='boolean'&&before!==after)evidence.push({status:after?'success':'failure',text:(education[1]==='entry'?'Education entry':'Graduation')+(after?' succeeded.':' failed.')});
 }
 if(event?.type==='education-check'){
  const m=summary.match(/^Education (.+) check (-?\d+) against (-?\d+)\.$/);
  if(m)evidence.push(checked('Education '+m[1]+' check',{total:Number(m[2]),target:Number(m[3]),success:Number(m[2])>=Number(m[3])}));
 }
 if(event?.type==='prisoner-escape'){
  const m=summary.match(/^Prisoner escape using (Stealth|Deception): (-?\d+) against 10\+; (succeeded\.|failed\. Parole Threshold \+2 \(maximum 12\)\.)$/);
  if(m&&(Number(m[2])>=10)===(m[3]==='succeeded.'))evidence.push(checked('Prisoner escape using '+m[1],{total:Number(m[2]),target:10,success:Number(m[2])>=10}));
 }
 if(event?.type==='education-graduation'){
  const m=summary.match(/^Graduation total (-?\d+) against (-?\d+): (honours|graduated|did not graduate)\.$/);
  if(m)evidence.push(checked('Graduation',{total:Number(m[1]),target:Number(m[2]),success:m[3]!=='did not graduate'}));
 }
 if(event?.type==='learn-talent'){
  const m=summary.match(/^Psionic acquisition (.+): (automatic first talent \(no check\)|(-?\d+) against 8; \d+ previous checks)\. (Acquired at level 0|Not acquired)\. Source: /);
  if(m)evidence.push(checked('Psionic acquisition '+m[1],{automatic:m[2].startsWith('automatic'),total:m[3]===undefined?undefined:Number(m[3]),target:8,success:m[4]==='Acquired at level 0'}));
 }
 const checks=evidence.filter(Boolean);
 if(!checks.length)return null;
 const failed=checks.some(c=>c.status==='failure'),succeeded=checks.some(c=>c.status==='success');
 return {status:failed&&succeeded?'info':failed?'failure':'success',details:[...(failed&&succeeded?['Mixed check results.']:[]),...new Set(checks.map(c=>c.text))],mixed:failed&&succeeded};
}
