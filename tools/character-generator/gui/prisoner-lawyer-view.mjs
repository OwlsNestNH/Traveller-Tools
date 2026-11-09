export function prisonerLawyerView(state,{esc,button}){
 return '<section id="prisoner-lawyer" data-lawyer-id="'+esc(state.pending.lawyerId)+'"><h3>Hire a lawyer?</h3><p class="source">Core Update 2022, p. 57</p><p>A lawyer costs Cr1,000 × Advocate level squared, paid from your cash (Cr'+esc(state.character.cash)+'). Roll 2D + their Advocate level. On 8+, reduce your Parole Threshold by 1D. This does not itself release you; advancement still checks parole.</p><label>Decision<select id="lawyer-outcome"><option value="">Choose an outcome</option><option value="hire">Hire</option><option value="decline">Decline</option></select></label><div id="lawyer-hire-fields" hidden><label>Lawyer Advocate level<input id="lawyer-level" type="number" min="0" step="1" value="1" disabled></label><p class="help">No loan, subsidy or outside funding is assumed. The Traveller creation skill cap is not a limit on a hired lawyer.</p><div id="lawyer-zero-fields" hidden><p class="help">A level-0 lawyer needs a referee ruling because the printed price becomes zero.</p><label class="check"><input id="lawyer-zero" type="checkbox" disabled><span>The referee confirms a level-0 lawyer is available at the printed Cr0 cost.</span></label><label>Level-0 ruling (only for level 0)<textarea id="lawyer-reason" maxlength="500" disabled></textarea></label></div></div>'+button('Resolve lawyer opportunity','resolve-prisoner-lawyer')+'</section>';
}
export function prisonerLawyerPayload(query){
 const outcome=query('#lawyer-outcome').value,payload={outcome};
 if(outcome==='hire'){payload.level=query('#lawyer-level').value===''?null:Number(query('#lawyer-level').value);if(payload.level===0){payload.zeroLevelConfirmed=query('#lawyer-zero').checked;payload.reason=query('#lawyer-reason').value;}}
 return payload;
}
export function prisonerLawyerSheet(state,{esc}){
 const records=state.character.prisonerLawyers??[];if(!records.length)return '';
 return '<section class="prisoner-lawyer-ledger"><h3>Prisoner lawyer opportunities</h3>'+records.map(r=>'<p>Core p. 57 · '+esc(r.status)+(r.decision?.outcome==='hire'?' · Advocate '+esc(r.decision.level)+' · Cr'+esc(r.decision.cost)+' · '+esc(r.decision.check.total)+' vs 8 · Parole '+esc(r.paroleBefore)+' → '+esc(r.paroleAfter)+(r.decision.reason?' · '+esc(r.decision.reason):''):r.decision?' · Declined':'')+'</p>').join('')+'</section>';
}

export function syncPrisonerLawyerControls(query){
 const hireFields=query('#lawyer-hire-fields');if(!hireFields)return;
 const hiring=query('#lawyer-outcome').value==='hire',level=query('#lawyer-level');
 hireFields.hidden=!hiring;level.disabled=!hiring;
 const zero=hiring&&level.value.trim()!==''&&Number(level.value)===0,zeroFields=query('#lawyer-zero-fields');
 zeroFields.hidden=!zero;
 for(const input of zeroFields.querySelectorAll('input,textarea'))input.disabled=!zero;
}
