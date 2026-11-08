import {benefitCreditView} from './benefit-credit-view.mjs';
// Government advisory awards remain engine-owned, separate from ordinary career benefits.
export function advisoryView(state,{esc,button,sourceLabel,careerName}){
 const current=state.currentAdvisory;
 if(!current)return '<p class="warning">The advisory award is unavailable. Keep the character pending and reload.</p>';
 let html='<p class="source">'+esc(sourceLabel(current.source?.id??'aliens',current.source?.page??265))+'</p>';
 if(state.stage==='advisory-career'){
  if(!Array.isArray(current.options)||!current.options.length)return html+'<p class="warning">No supported career choices are available. Keep the award pending.</p>';
  return html+'<label>Other Zhodani career<select id="advisory-career"><option value="">Choose a career</option>'+current.options.map(option=>'<option value="'+esc(option.id)+'">'+esc(option.name)+'</option>').join('')+'</select></label><p class="help">Roll Service Skills from this career, then its cash benefit.</p>'+button('Roll the Service Skills award','advisory-career');
 }
 if(state.stage==='advisory-cash-source')return html+'<p class="source">Cash table: '+esc(sourceLabel(current.cash?.source?.id??'aliens',current.cash?.source?.page??current.source?.page??265))+'</p><p class="warning">This modified cash result is outside the printed table. The original die and used cash roll are retained.</p><p>Die: '+esc(current.cash?.die)+'. Modifier: '+esc(current.cash?.modifier)+'. Result: '+esc(current.cash?.result)+'.</p><label>GM-approved cash amount<input id="advisory-cash-amount" type="number" min="0" max="10000000" step="1" inputmode="numeric" placeholder="Credits"></label><label>GM reason<textarea id="advisory-cash-reason" rows="3" maxlength="500" placeholder="Required; saved in the action log"></textarea></label>'+button('Record cash amount','resolve-advisory-cash-result','',state.config.gm?'':'disabled')+(!state.config.gm?'<p class="help">Enable GM changes in the character record to resolve the unprinted result.</p>':'');
 if(typeof state.advisoryCashBlocked!=='boolean')return html+'<p class="warning">Cash-roll availability is unavailable. Keep the award pending and reload.</p>';
 html+='<p>Cash benefit from <strong>'+esc(careerName(current.careerId))+'</strong>.</p><p class="help">This immediate roll counts toward the lifetime limit of three cash-benefit rolls.</p>';
 if(state.advisoryCashBlocked){
  html+='<p class="warning">The normal cash-roll limit has been reached. This award remains pending until a GM records a decision.</p><label>GM decision<select id="advisory-limit-decision"><option value="">Choose a GM ruling</option><option value="forfeit">Waive this cash award</option><option value="allow-extra">Override the cap for this cash roll</option></select></label><label>GM reason<textarea id="advisory-limit-reason" rows="3" maxlength="500" placeholder="Required; saved in the action log"></textarea></label>';
  return html+button('Record GM decision','resolve-advisory-cash-limit','',''+(state.config.gm?'':'disabled'))+(!state.config.gm?'<p class="help">Enable GM changes in the character record to make this exception.</p>':'');
 }
 return html+benefitCreditView(state,{esc})+button('Roll the cash benefit now','advisory-cash');
}
export function advisorySheet(state,{esc,careerName}){
 const records=state.character.advisoryServices??[];if(!records.length)return '';
 return '<div class="sheet-section"><h3>Advisory awards</h3>'+records.map(record=>'<h4>'+esc(careerName(record.careerId)??'Career pending')+' / '+esc(record.status)+'</h4>'+(record.training?'<p>Service Skills die: '+esc(record.training.die)+'.</p>':'')+(record.cash?'<p>Cash die: '+esc(record.cash.die)+'. Modifier: '+esc(record.cash.modifier)+'. '+(Number.isFinite(record.cash.amount)?'Cash: Cr'+esc(record.cash.amount.toLocaleString())+'.':'Cash amount awaiting GM ruling.')+'</p>':'')+(record.cashLimitDecision?'<p class="multiline">GM cash-limit decision: '+esc(record.cashLimitDecision.decision)+'. '+esc(record.cashLimitDecision.reason)+'</p>':'')).join('')+'</div>';
}
