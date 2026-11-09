// Presentation only. Read projected records; do not evaluate rules or pending effects.
const signed=value=>(value>=0?'+':'')+value;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const targets={advancement:'Advancement',qualification:'Qualification',survival:'Survival',benefit:'Benefit',commission:'Commission'};
function careerName(id,catalog){
 if(id==='any')return 'Any career';
 if(id==='next')return 'Next career';
 const career=catalog?.careers?.find(c=>c.id===id);
 if(!career)return 'Recorded career';
 const duplicate=catalog.careers.some(c=>c.id!==id&&c.name===career.name);
 const group=career.group&&career.group!=='core'?career.group[0].toUpperCase()+career.group.slice(1):'Core';
 return duplicate?group+' '+career.name:career.name;
}
export function currentEffects(state={},catalog={}){
 const rows=[],c=state.character??{},active=Number.isInteger(state.active)?c.careers?.[state.active]:null;
 const add=(label,status='Recorded',source)=>rows.push({label,status,...(source?{source}: {})});
 for(const m of state.modifiers??[]){
  if(!finite(m.value)||m.value===0)continue;
  add(careerName(m.careerId,catalog)+' · '+(targets[m.target]??'Recorded roll')+' DM '+signed(m.value)+(m.scope==='all'?' · ongoing':' · next matching roll'),'Available',m.source);
 }
 for(const id of new Set(state.automaticCareers??[]))add(careerName(id,catalog)+' · automatic entry right');
 if(c.qualificationBanned)add('Future qualification checks barred after ageing crisis');
 if(state.forcedCareer)add('Required next career: '+careerName(state.forcedCareer,catalog));
 if(active&&finite(active.benefitRolls)&&active.benefitRolls>0)add(careerName(active.id,catalog)+' · '+active.benefitRolls+' benefit rolls remaining','Recorded');
 if(active&&finite(active.benefitDM)&&active.benefitDM!==0)add(careerName(active.id,catalog)+' · benefit DM '+signed(active.benefitDM),'Recorded');
 if(active&&!active.exit){
  const name=careerName(active.id,catalog);
  if(finite(active.parole))add(name+' · Parole Threshold '+active.parole);
  if(active.commissionBlockedFirstTerm&&active.terms===0)add(name+' · commission blocked this first term');
  if(active.forcedStay)add(name+' · another term required');
  if(active.forcedExit)add(name+' · must leave this career');
  if(active.automaticPromotion)add(name+' · automatic promotion available','Available');
  if(active.automaticCommission)add(name+' · automatic commission available','Available');
  for(const target of ['commission','advancement']){
   const value=active.educationModifiers?.[target];
   if(finite(value)&&value!==0)add(name+' · education '+targets[target].toLowerCase()+' DM '+signed(value),'Recorded');
  }
 }
 for(const credit of c.benefitCredits??[])if(credit.status==='available'&&finite(credit.value))add((credit.scope==='any'?'Any career':careerName(credit.originCareerId,catalog))+' · one benefit roll DM '+signed(credit.value),'Available',credit.source);
 for(const [index,injury] of (c.injuries??[]).entries()){
  let label='Injury '+(index+1)+(finite(injury.tableResult)?' · table result '+injury.tableResult:'');
  const losses=Object.entries(injury.losses??{}).filter(([,value])=>finite(value)&&value!==0).map(([name,value])=>name+' '+signed(-value));
  if(losses.length)label+=' · applied loss: '+losses.join(', ');
  else if(injury.losses)label+=' · no characteristic loss';
  const restored=Object.entries(injury.restoration??{}).filter(([,value])=>finite(value)&&value!==0).map(([name,value])=>name+' '+signed(value));
  // A treatment selection is not applied until the treatment record exists.
  if(restored.length)label+=' · '+(injury.statsAfterTreatment?'restored: ':'proposed treatment: ')+restored.join(', ');
  if(typeof injury.medical?.note==='string'&&injury.medical.note.trim())label+=' · recorded medical note: '+injury.medical.note.trim();
  if(typeof injury.zeroRuling?.note==='string'&&injury.zeroRuling.note.trim())label+=' · recorded injury ruling: '+injury.zeroRuling.note.trim();
  if(injury.deceased)label+=' · fatal';
  if(!injury.completed)label+=injury.losses?' · treatment unresolved':' · outcome unresolved';
  add(label,injury.completed?'Recorded':injury.losses?'Loss recorded; treatment pending':'Pending',injury.source);
 }
 if(c.deceased)add('Traveller is deceased');
 else if(c.retirementFromCreation)add('Retired from character creation');
 if(state.pending&&state.stage==='book-step')add(state.pending.label??'Source-assisted outcome','Awaiting source resolution; not yet applied',typeof state.pending.source==='string'?{id:state.pending.source,page:state.pending.page}:state.pending.source);
 return rows;
}
export function currentEffectsSheet(state,catalog,{esc,sourceLabel}={}){
 const rows=currentEffects(state,catalog);if(!rows.length)return '';
 return '<div class="sheet-section" id="current-effects-sheet"><h3>Effects & injuries</h3><ul class="compact-list">'+rows.map(row=>'<li><strong>'+esc(row.status)+'</strong>: '+esc(row.label)+(row.source&&sourceLabel?'<small class="source">'+esc(sourceLabel(row.source.id,row.source.page??row.source.pages?.join(', ')))+'</small>':'')+'</li>').join('')+'</ul></div>';
}
