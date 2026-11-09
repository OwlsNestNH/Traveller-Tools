// Typed Core decisions: no arbitrary effect editor or implicit psionic training.
const recordFor=state=>(state.character.lifeEvents??[]).find(record=>record.id===state.pending?.lifeEventId);
export function coreLifeEventView(state,{esc,button,sourceLabel}){
 const pending=state.pending,record=recordFor(state),kind=pending.decision;
 const select=(id,label,choices)=>'<label>'+label+'<select id="'+id+'"><option value="">Choose an outcome</option>'+choices.map(([value,text])=>'<option value="'+esc(value)+'">'+esc(text)+'</option>').join('')+'</select></label>';
 let fields='';
 if(kind==='narrative'){
  const choices=Number(record?.row)===4?[['amnesia','Memory loss']]:Number(record?.row)===5?[['government','Government involvement']]:[['birth','Birth'],['death','Death']];
  fields=select('life-outcome','Recorded outcome',choices);
 }
 if(kind==='betrayal'||kind==='ending'){
  const converting=kind==='betrayal'&&(state.character.relationships??[]).some(person=>['Contact','Ally'].includes(person.role));
  if(kind==='betrayal'){
   const people=(state.character.relationships??[]).filter(person=>['Contact','Ally'].includes(person.role));
   fields+=people.length?select('life-relationship','Existing relationship',people.map(person=>[person.id,person.role+': '+(person.name||'Unnamed')+' · '+person.id])):'<p>No Contact or Ally is recorded. Record the new relationship below.</p>';
  }
  fields+=select('life-role','New relationship role',[['Rival','Rival'],['Enemy','Enemy']])+(converting?'<p>The existing name is retained.</p>':'<label>Name (optional)<input id="life-name" maxlength="120" autocomplete="off"></label>');
 }
 if(kind==='artefact')fields='<label>Describe your '+(Number(record?.row)===6?'ancient':'alien')+' artefact<input id="life-name" maxlength="120" autocomplete="off" placeholder="A short original name"></label><p class="help">Record the item, not an invented value or mechanical effect.</p>';
 if(kind==='crime')fields=select('life-outcome','Consequence',[['lose-benefit','Lose a Benefit roll'],['prisoner','Prisoner next term']]);
 if(kind==='psionics'){
  const psi=state.character.stats?.PSI;
  fields=(psi!==undefined?'<p>Existing PSI <strong>'+esc(psi)+'</strong> is retained. This opportunity does not reroll it.</p>':'<p>Testing discovers PSI; it does not grant training.</p>')+select('life-outcome','Testing decision',[['decline','Decline testing'],['test','Accept testing']])+'<div id="life-test-fields" data-existing-psi="'+(psi!==undefined)+'" hidden>'+select('life-funding','Testing funding',[['cash',psi!==undefined?'Retain existing PSI (Cr0)':'Pay cash (minimum Cr5,000)'],['provided','Source-provided testing']])+'<label>Testing cost (Cr)<input id="life-cost" type="number" min="5000" step="1" value="5000"></label><label class="check" id="life-referee-field" hidden><input id="life-referee" type="checkbox"><span>The referee confirms source-provided testing. Explain the source basis below.</span></label><label class="check"><input id="life-timing" type="checkbox"><span>Testing timing is confirmed.</span></label></div><p class="help">No automatic training is included. Any Psion career entry next term still requires qualification.</p>';
 }
 return '<section id="core-life-decision" data-life-event-id="'+esc(pending.lifeEventId)+'"><h3>'+esc(pending.label)+'</h3><p class="source">'+esc(sourceLabel(pending.source??'core',pending.page??46))+'</p>'+fields+'<label>Decision reason / original notes<textarea id="life-reason" rows="3" maxlength="500" placeholder="Required; describe your decision without copying book passages"></textarea></label><label class="check"><input id="life-confirm" type="checkbox"><span>I confirm this life event decision.</span></label><div class="actions">'+button('Record life event','resolve-life-event')+'</div></section>';
}
export function coreLifeEventPayload(state,query){
 const value=id=>query('#life-'+id)?.value??'',checked=id=>query('#life-'+id)?.checked===true;
 const payload={confirmed:checked('confirm'),reason:value('reason')},kind=state.pending.decision;
 if(['narrative','crime','psionics'].includes(kind))payload.outcome=value('outcome');
 if(['ending','betrayal'].includes(kind)){payload.role=value('role');if(query('#life-name'))payload.name=value('name');}
 if(kind==='betrayal')payload.relationshipId=value('relationship');
 if(kind==='artefact')payload.name=value('name');
 if(kind==='psionics'&&payload.outcome==='test')Object.assign(payload,{funding:value('funding'),cost:value('cost')===''?undefined:Number(value('cost')),timingConfirmed:checked('timing')});
 if(kind==='psionics'&&payload.outcome==='test'&&payload.funding==='provided')payload.confirmed=payload.confirmed&&checked('referee');
 return payload;
}
export function syncCoreLifeEventControls(query){
 const fields=query('#life-test-fields');if(!fields)return;
 const testing=query('#life-outcome').value==='test',provided=query('#life-funding').value==='provided';
 fields.hidden=!testing;
 for(const input of fields.querySelectorAll('input,select'))input.disabled=!testing;
 const cost=query('#life-cost');const free=provided||fields.dataset.existingPsi==='true';cost.readOnly=free;cost.min=free?'0':'5000';
 if(free)cost.value='0';else if(cost.value==='0')cost.value='5000';
 query('#life-referee-field').hidden=!provided;query('#life-referee').disabled=!testing||!provided;
}
export function coreLifeBenefitView(state,{esc}){
 const choices=(state.character.lifeBenefitBonuses??[]).filter(bonus=>bonus.status==='available');if(!choices.length)return '';
 return '<fieldset><legend>Life event bonuses</legend><p class="help">Choose a bonus for this roll only. Unselected bonuses remain available.</p>'+choices.map(bonus=>'<label class="check"><input type="checkbox" name="life-benefit-bonus" value="'+esc(bonus.id)+'"><span>Life event '+esc(bonus.id)+' / +'+esc(bonus.value)+'</span></label>').join('')+'</fieldset>';
}
export function coreLifeEventSheet(state,{esc,sourceLabel,careerName}){
 const records=state.character.lifeEvents??[];if(!records.length)return '';
 return '<section class="sheet-section core-life-ledger"><h3>Core life events</h3><ol class="compact-list">'+records.map(record=>{
  const decision=record.decision,bonus=(state.character.lifeBenefitBonuses??[]).find(item=>item.id===record.id),loss=(state.character.lifeBenefitLosses??[]).find(item=>item.id===record.id),asset=(state.character.assets??[]).find(item=>item.id===decision?.assetId);
  const details=decision?[decision.outcome,decision.after?decision.after.role+': '+decision.after.name:null,asset?.name,decision.psi!==undefined?'PSI '+decision.psi+(decision.existingPotential?' (retained)':''):null,decision.cost!==undefined?'Testing Cr'+decision.cost+' / '+decision.funding:null].filter(Boolean).join(' · '):'';
  return '<li><strong>'+esc(decision?.kind??'Life event')+'</strong> · '+esc(record.status)+'<br>'+esc(record.table)+' / '+esc(record.row)+' · Age '+esc(record.age)+(record.careerId?' · '+esc(careerName(record.careerId)):'')+'<br><span class="source">'+esc(sourceLabel(record.source?.id??'core',record.source?.page??46))+'</span>'+(details?'<p>'+esc(details)+'</p>':'')+(decision?.reason?'<p class="multiline">'+esc(decision.reason)+'</p>':'')+(bonus?'<p>Benefit bonus +'+esc(bonus.value)+': '+esc(bonus.status)+'</p>':'')+(loss?'<p>Benefit roll loss: '+esc(loss.status)+'</p>':'')+'</li>';
 }).join('')+'</ol></section>';
}
