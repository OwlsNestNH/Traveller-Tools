// Presentation of engine-projected outcomes and explicitly requested referee decisions.
const names={rowOverride:'Out-of-range result',duration:'Treatment duration',chronology:'Treatment timing',disposition:'Career continuation',funding:'Fine funding',endZero:'END-zero outcome'};
const labels={'before-resume':'Before resuming the event','after-current-term':'After the current career term',stay:'Remain in the career',leave:'Leave the career',cash:'Pay from recorded cash',debt:'Referee authorizes debt',provided:'Referee provides funds','restore-to-one':'Referee restores END to 1',death:'Record death'};
const fmt=value=>Number.isFinite(value)?value.toLocaleString(undefined,{maximumFractionDigits:9}):'Not recorded';
function decisionField(requirement,esc){
 const key=requirement.key;if(!Object.hasOwn(names,key))return '<p class="warning">This source decision is not supported by the interface yet. The episode remains pending.</p>';
 let control='';
 if(key==='rowOverride')control='<label>Referee-selected row<select data-reeducation-value><option value="">Choose from the source ruling</option>'+requirement.rows.map(row=>'<option value="'+row+'">Row '+row+'</option>').join('')+'</select></label>';
 else if(key==='duration')control='<label>Treatment months<input data-reeducation-value type="number" min="0" max="12" step="any" inputmode="decimal" placeholder="Greater than 0 and less than 12"></label>';
 else control='<label>'+esc(names[key])+'<select data-reeducation-value><option value="">Choose the referee ruling</option>'+requirement.options.map(mode=>'<option value="'+esc(mode)+'">'+esc(labels[mode]??mode)+'</option>').join('')+'</select></label>';
 const help=key==='rowOverride'?'The original modified roll remains in the record. This selection is a referee ruling, not a new roll.':key==='duration'?'The source does not give an exact duration. Record the referee-approved time in months; fractions are allowed.':key==='chronology'?'Record when treatment occurs. Independently required departure from the source career is still enforced.':key==='disposition'?'The source instructions conflict. Record which continuation ruling the referee applies.':key==='funding'?'Fine: Cr'+fmt(requirement.amount)+'. Shortfall: Cr'+fmt(requirement.shortfall)+'. No debt or free funding is assumed.':'These are explicit referee outcomes. Leave this episode pending if neither fits the ruling.';
 return '<fieldset data-reeducation-decision="'+key+'"><legend>'+esc(names[key])+'</legend><p class="help">'+esc(help)+'</p>'+control+'<label>Referee reason<textarea data-reeducation-reason rows="2" maxlength="500" placeholder="Required; saved in the action log"></textarea></label></fieldset>';
}
export function reeducationView(state,{esc,button,sourceLabel}){
 const episode=state.currentReeducation;if(!episode)return '<p class="warning">The pending re-education record is unavailable. Keep the saved character and reload.</p>';
 const plan=episode.plan??{},requirements=state.reeducationRequirements??[];
 let html='<p class="source">'+esc(sourceLabel(episode.source?.id??'aliens',episode.source?.page??276))+'</p><p>Non-career treatment. Its time and decisions are recorded separately from career credit.</p>';
 if(episode.roll)html+='<p class="total">Re-education: '+esc(episode.roll.die)+' '+(episode.roll.modifier<0?'− '+Math.abs(episode.roll.modifier):'+ 0')+' = '+esc(episode.roll.total)+'</p>';
 if(plan.row!==null&&plan.row!==undefined)html+='<p>Resolved row: <strong>'+esc(plan.row)+'</strong></p>';
 if(plan.durationMonths!==null&&plan.durationMonths!==undefined&&plan.durationMonths>0)html+='<p>Treatment time: <strong>'+fmt(plan.durationMonths)+' months</strong></p>';
 if(plan.fine>0)html+='<p>Rolled fine: <strong>Cr'+fmt(plan.fine)+'</strong></p>';
 if(plan.row===1)html+='<p>Projected END: '+esc(plan.endAfter)+'. Projected SOC: '+esc(plan.socAfter)+'. Required referee decisions remain pending below.</p>';
 if(plan.benefitRolls>0)html+='<p>Additional benefit roll: '+esc(plan.benefitRolls)+'.</p>';
 if(plan.protectedStay)html+='<p class="notice">Source-protected career continuation is recorded.</p>';
 if(plan.explicitDischarge)html+='<p class="notice">An explicit source discharge is recorded separately from ordinary mishap departure.</p>';
 if(state.stage==='reeducation-roll')return html+'<label>Terms since starting anagathics<input id="reeducation-anagathics" type="number" min="0" max="1000" step="1" value="0"></label><label>Source confirmation for nonzero anagathic history<textarea id="reeducation-anagathics-reason" rows="2" maxlength="500" placeholder="Required when the number is above zero"></textarea></label><div class="actions">'+button('Roll re-education result','reeducation-roll')+'</div>';
 if(state.stage==='reeducation-fine')return html+'<div class="actions">'+button('Roll the fine','reeducation-fine')+'</div>';
 html+=requirements.map(requirement=>decisionField(requirement,esc)).join('');
 return html+'<div class="actions">'+button(requirements.length?'Record referee decisions':'Apply recorded outcome','resolve-reeducation','',requirements.some(requirement=>!Object.hasOwn(names,requirement.key))?'disabled':'')+'</div>';
}
export function readReeducationDecisions(root=document){
 const payload={};for(const field of root.querySelectorAll('[data-reeducation-decision]')){
  const key=field.dataset.reeducationDecision;if(!Object.hasOwn(names,key))throw new Error('Unsupported re-education decision.');
  const raw=field.querySelector('[data-reeducation-value]').value,reason=field.querySelector('[data-reeducation-reason]').value;
  payload[key]=key==='rowOverride'?{row:raw===''?undefined:Number(raw),reason}:key==='duration'?{months:raw===''?undefined:Number(raw),reason}:{mode:raw,reason};
 }return payload;
}

export function reeducationSheet(state,{esc,careerName}){
 const records=state.character.reeducations??[];if(!records.length)return '';
 return '<div class="sheet-section"><h3>Re-education record</h3>'+(state.character.nonCareerMonths>0?'<p>Recorded treatment time: '+fmt(state.character.nonCareerMonths)+' months. Additional ageing term credit: '+esc(state.character.treatmentAgeingTerms??0)+'.</p>':'')+records.map(record=>{
  const plan=record.plan??{},roll=record.roll,decisions=record.decisions??{},unperformed=record.completion?.cause==='death-before-treatment';
  return '<h4>'+esc(careerName(record.origin?.careerId))+' · '+esc((record.status??'pending').replaceAll('-',' '))+'</h4>'+(roll?'<p>Recorded die: '+esc(roll.die)+'; modifier '+esc(roll.modifier)+'; result '+esc(roll.total)+'.'+(decisions.rowOverride?' Referee-selected row '+esc(decisions.rowOverride.row)+'.':'')+'</p>':'')+(unperformed?'<p>Treatment did not start: death occurred beforehand. No treatment time or effects were applied.</p>':plan.durationMonths>0?'<p>'+(record.timeline?'Treatment duration: ':'Planned treatment duration: ')+fmt(plan.durationMonths)+' months. No additional career term credit.</p>':'')+(plan.fine>0?'<p>Fine: Cr'+fmt(plan.fine)+'.</p>':'')+(plan.benefitRolls>0?'<p>Additional benefit roll: '+esc(plan.benefitRolls)+'.</p>':'')+(Object.keys(decisions).length?'<details><summary>Recorded referee decisions</summary>'+Object.entries(decisions).map(([key,value])=>'<p class="multiline"><strong>'+esc(names[key]??key)+'</strong>: '+esc(labels[value.mode]??value.mode??value.months??value.row??'recorded')+'<br>'+esc(value.reason??'')+'</p>').join('')+'</details>':'');
 }).join('')+'</div>';
}

export function formatCharacterAge(age){
 if(!Number.isFinite(age))return 'Not recorded';if(Number.isInteger(age))return String(age);
 const years=Math.floor(age),months=(age-years)*12,rounded=Math.round(months*1000)/1000,approx=Math.abs(months-rounded)>0.000001?'≈ ':'';
 if(rounded>=12)return approx+(years+1);if(rounded===0)return approx+years;
 return approx+years+'y '+rounded+'m';
}
