// Read-only presentation of the validated projection. Never infer missing outcomes.
import {characterEffectDetails,modifierEffectDetails,pendingEffectDetails} from './roll-result-view.mjs';
import {lifeEventLogDetails} from './life-event-presentation.mjs';
import {conciseResult} from './concise-result.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const careerName=(catalog,id)=>catalog.careers.find(c=>c.id===id)?.name??id??'Outside a career';
const assignmentName=(catalog,id,assignment)=>catalog.careers.find(c=>c.id===id)?.assignments.find(a=>a.id===assignment)?.name??assignment;

// A restore can restore an earlier restore, so retain each historical branch.
// The saved commands are validated by the engine before this view is called.
export function currentActionNumbers(session){
 const branches=[[]];
 for(const [index,event] of session.events.entries()){
  const command=event.command,number=index+1;
  if(command.type==='restore')branches.push([...branches[command.payload.revision]]);
  else if(command.type==='gm-replay')branches.push([...branches[command.payload.revision-1],number]);
  else branches.push([...branches.at(-1),number]);
 }
 return new Set(branches.at(-1));
}

export function completedTermRows(state,catalog){
 const rows=[];
 for(const career of state.character.careers??[])for(const term of career.termHistory??[]){
  rows.push({number:term.generationTerm,label:careerName(catalog,career.id)+' / '+assignmentName(catalog,career.id,term.assignment),detail:'Career term '+term.careerTerm+' · '+(catalog.careers.find(c=>c.id===career.id)?.noRank?'No rank system':(term.officer?'Officer rank ':'Rank ')+term.rank)+(term.age!==undefined?' · Age at term completion '+term.age:'')});
 }
 for(const education of state.character.educations??[])if(education.completed){
  rows.push({number:education.term,label:catalog.precareers.find(p=>p.id===education.id)?.name??education.id,detail:education.graduation?.honours?'Graduated with honours':education.graduation?.graduated?'Graduated':education.graduation?.graduated===false?'Completed education term; did not graduate':'Completed education term; graduation outcome not recorded'});
 }
 return rows.sort((a,b)=>a.number-b.number);
}

export function completedTermsView(state,catalog){
 const rows=completedTermRows(state,catalog),missing=Math.max(0,state.character.terms-new Set(rows.map(r=>r.number)).size);
 return '<section class="sheet-section"><h3>Completed terms</h3>'+(rows.length?'<ol class="final-term-list">'+rows.map(row=>'<li value="'+esc(row.number)+'"><strong>Term '+esc(row.number)+' · '+esc(row.label)+'</strong><span>'+esc(row.detail)+'</span></li>').join('')+'</ol>':'<p>No completed term details recorded.</p>')+(missing?'<p class="help">'+esc(missing)+' completed term'+(missing===1?' has':'s have')+' no separate term entry. See the recorded events below; no details have been inferred.</p>':'')+'</section>';
}

// Setup, corrections and navigation belong in the downloadable audit, not the
// character's life story. Their resulting values remain on the character sheet.
const auditOnly=new Set(['acknowledge-education-event','acknowledge-education-result','setup','configure','enter-physical-statistic','gm-physical-dice','gm-mode','roll-statistics','swap-statistics','accept-statistics','background','notes','connection','restore','gm-override','skip-precareer','open-precareer','cancel-education','cancel-career-transfer','continue-career','retry-skill-choice']);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const words=value=>String(value??'').replace(/[._-]+/g,' ');
const unique=values=>[...new Set(values.filter(Boolean))];
const money=value=>'Cr'+value.toLocaleString('en-US');

// Audit changes on a replay compare against the discarded branch. Reconstruct
// the observed values, then compare only successive current-branch actions so
// an unchanged replacement still retains its injury, promotion or restriction.
function currentEvents(projection,session){
 const current=currentActionNumbers(session),values=new Map(),events=[];
 let previous=new Map(),modifiers=[],previousModifiers=[],pending={},previousPending={};
 for(const event of projection.log){
  for(const change of event.changes??[]){
   if(!values.has(change.path)&&change.before!=null){values.set(change.path,change.before);previous.set(change.path,change.before);}
   values.set(change.path,change.after);
  }
  if(event.modifierChanges)modifiers=event.modifierChanges.after;
  if(event.pendingEffectChanges)pending=event.pendingEffectChanges.after;
  if(!current.has(event.number))continue;
  const changes=[...values].filter(([path,after])=>!equal(previous.get(path),after)).map(([path,after])=>({path,before:previous.get(path)??null,after}));
  let command=session.events[event.number-1]?.command,summary=event.summary;
  if(command?.type==='gm-replay'){
   const {revision,rollIndex,values:replacement,reason}=command.payload,original=projection.log[revision-1]?.rolls?.[rollIndex];
   const prefix='GM replaced action '+revision+' roll '+(rollIndex+1)+' ['+original?.values.join(', ')+'] → ['+replacement.join(', ')+']. Reason: '+reason.trim()+'. Earlier rolls in this action were retained; later branch rolls were regenerated. Subsequent character changes were superseded; all actions remain in the log. ';
   summary=summary.startsWith(prefix)?summary.slice(prefix.length):'';
   command=session.events[revision-1].command;
  }
  events.push({...event,type:command?.type??event.type,summary,command,changes,modifierChanges:{before:previousModifiers,after:modifiers},pendingEffectChanges:{before:previousPending,after:pending}});
  previous=new Map(values);previousModifiers=modifiers;previousPending=pending;
 }
 return events;
}

const careerChecks=new Set(['career','qualify-aslan-officer','qualify-assignment']);
const checkLabels={survival:'Survival',advancement:'Advancement',commission:'Commission','preterm-commission':'Education commission','change-assignment':'Assignment qualification',precareer:'Education entry','apply-psionic-games':'Psionic Games application','psionic-games-preliminary':'Psionic Games preliminary','psionic-games-final':'Psionic Games final'};
function shortSummary(event){
 let summary=event.summary??'';
 // These exact command summaries contain validated check objects. A referee's
 // free text never supplies success/failure evidence or gets parsed as a check.
 if(careerChecks.has(event.type)||checkLabels[event.type]){
  const match=summary.match(/^(.*?): (\{.*\})(\..*)$/);
  if(match){
   let check;try{check=JSON.parse(match[2]);}catch{/* Preserve only readable outcomes below. */}
   if(check&&typeof check.success==='boolean'&&(check.automatic===true||finite(check.total))){
    const result=check.automatic===true?(check.success?'succeeded automatically':'failed automatically'):(check.success?'succeeded':'failed')+' ('+check.total+(finite(check.target)?' against '+check.target+'+':'')+')';
    if(careerChecks.has(event.type))return match[1]+'. Qualification '+result+'.';
    return checkLabels[event.type]+' '+result+'.'+(event.type==='change-assignment'?match[3].slice(1):'');
   }
  }
 }
 const bills=(event.changes??[]).filter(change=>/^medicalBills\.\d+$/.test(change.path)&&change.before==null&&finite(change.after?.personalCost));
 if(['injury-treatment','resolve-book'].includes(event.type)&&bills.length)return 'Injury treatment. '+(event.command?.payload?.note?.trim()??'');
 if(event.type==='choose-effect'&&event.lifeEventPresentation?.choice)return '';
 if(['choose-skill','education-skill','education-service','companion-skill','injury-loss'].includes(event.type)&&(event.changes??[]).some(change=>/^(stats|skills)\./.test(change.path)))return event.type==='injury-loss'?'Injury loss.':'';
 if(event.type==='resolve-book'){
  // Remove only engine-generated suffixes, never brackets or text in a note.
  for(const suffix of [' Effects: '+JSON.stringify(event.command?.payload?.effects??[])+'.',' Decisions: '+JSON.stringify(event.command?.payload??{})+'.'])if(summary.endsWith(suffix))summary=summary.slice(0,-suffix.length);
  return summary;
 }
 if(event.type==='finish')return summary.replace(/^Finished source-assisted character\. Unautomated stages remain listed in the record\.\s*/, '');
 if(event.type==='leave-career')return summary.replace(/ with \d+ benefit rolls\./,'.');
 // Unsupported serialized summaries stay in the audit rather than dumping
 // rule objects. Their recorded dice and typed consequences are shown below.
 if(['resolve-reeducation','complete-psionic-games'].includes(event.type))return words(event.type).replace(/^./,letter=>letter.toUpperCase())+' recorded. '+(event.command?.payload?.note?.trim()??'');
 return summary;
}

function importantEffects(event,catalog){
 const changes=event.changes??[],details=[];
 for(const {path,before,after} of changes){
  if(/^(stats|skills)\./.test(path)&&finite(after)){
   if(['career','fallback'].includes(event.type)&&path.startsWith('skills.')&&before==null&&after===0)continue;
   const name=path.slice(path.indexOf('.')+1);details.push(name+(before==null?' '+after:': '+before+' → '+after)+'.');
  }
  if(path.startsWith('skills.')&&after==null&&finite(before))details.push(path.slice(7)+': '+before+' → untrained.');
  if(['cash','debt'].includes(path)&&finite(after)&&event.type!=='finish'){
   const delta=after-(before??0);if(delta)details.push((path==='cash'?'Cash':'Debt')+' '+(delta>0?'+':'−')+money(Math.abs(delta))+'.');
  }
 }
 const selected=changes.filter(({path,before,after})=>{
  if(/^(stats|skills)\./.test(path)||['cash','debt','medicalCosts','age','terms','birthOrder'].includes(path))return false;
  if(/^careers\.\d+\./.test(path)){
   if(/\.(rank|officer)$/.test(path))return after!==before&&(before!=null||after>0);
   if(/\.(forcedExit|forcedStay|released)$/.test(path))return after===true&&before!==true;
   if(/\.pension$/.test(path))return finite(after)&&after>0;
   if(/\.pensionEntitlement$/.test(path))return after?.needsAdjudication===true;
   if(/\.pensionCondition$/.test(path))return changes.some(change=>change.path===path.replace(/pensionCondition$/,'pension')&&change.after>0);
   return /\.pensionStatusReviewRequired$/.test(path)&&after===true;
  }
  if(/^injuries\./.test(path))return before==null&&!event.rolls?.some(roll=>roll.label==='Injury table');
  if(typeof after==='boolean'&&after===false&&before==null)return false;
  if(/^medicalBills\./.test(path))return before==null;
  if(/^medicalSettlements\./.test(path))return event.type!=='finish';
  if(/^benefitAwards\.|^benefitRollHistory\.|^lifeEvents\.|^careerTransitions\.|^assignmentChanges\.|^sourceTraining\./.test(path))return false;
  return true;
 });
 details.push(...characterEffectDetails({changes:selected},catalog));
 details.push(...modifierEffectDetails({modifiers:event.modifierChanges.before},{modifiers:event.modifierChanges.after},catalog).filter(detail=>!detail.includes('no longer available')));
 details.push(...pendingEffectDetails(event,catalog).filter(detail=>!detail.includes('no longer')));
 return unique(details);
}

export function finalEventRows(projection,session,catalog){
 return currentEvents(projection,session).filter(event=>!auditOnly.has(event.type)&&!/^Chose Basic-training option \d+\.$/.test(event.summary)).map(event=>{
  // Dice are rendered once in the dedicated row below, not in asset details.
  const equipment=(event.changes??[]).some(change=>/^assets\.\d+$/.test(change.path)&&!change.before&&change.after?.name)?conciseResult({...event,rolls:[]},{},catalog):null;
  const compact=equipment?.compact;
  const summary=compact?equipment.title+(event.type==='resolve-book'&&event.command?.payload?.note?' '+event.command.payload.note.trim():''):shortSummary(event);
  const details=unique([...lifeEventLogDetails(event),...(compact?equipment.details:importantEffects(event,catalog))]).filter(detail=>!summary.includes(detail));
  const rolls=event.rolls??[];
  if(!details.length&&!rolls.length&&['injury-treatment','skill-award-source','companion-choice-source'].includes(event.type))return {number:event.number,summary:'',details,rolls};
  return {number:event.number,summary,details,rolls};
 }).filter(row=>row.summary||row.details.length||row.rolls.length);
}

function recordedDice(roll){
 const values=roll.values??roll.kept??[],kept=roll.kept&&roll.values&&!equal(roll.kept,roll.values);
 return roll.label+': ['+values.join(', ')+']'+(kept?(finite(roll.modifier)?' → [':' → keep [')+roll.kept.join(', ')+']':'')+(finite(roll.modifier)&&roll.modifier?' '+(roll.modifier>0?'+':'−')+Math.abs(roll.modifier):'')+' = '+roll.total;
}

export function finalEventsView(projection,session,catalog){
 const rows=finalEventRows(projection,session,catalog);
 return '<section class="sheet-section final-events"><h3>Events &amp; decisions</h3><p class="help">Key events in order. Download the full log for troubleshooting.</p>'+(rows.length?'<ol class="final-event-list">'+rows.map(row=>'<li>'+esc([row.summary,...row.details].filter(Boolean).join(' '))+(row.rolls.length?'<span class="final-event-rolls">Dice: '+row.rolls.map(roll=>esc(recordedDice(roll))).join(' · ')+'</span>':'')+'</li>').join('')+'</ol>':'<p>No career events recorded.</p>')+'</section>';
}
