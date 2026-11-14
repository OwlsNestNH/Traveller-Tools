// The projected exit options remain the only authority for available actions.
export function termExitView(state,{esc,button}){
 const record=state.character.careers[state.active],exits=state.exitOptions??{canContinue:!record.forcedExit,canLeave:!record.forcedStay};
 const forced=record.forcedExit===true;
 const instruction=forced?'Leave this career and resolve any benefits you earned.':record.forcedStay?'Your natural 12 requires another term.':'Continue in this career or collect your benefits.';
 const actions=forced?(exits.canLeave?button('Leave and take benefits','leave-career','career-exit-primary'):''):
 button('Continue this career','continue-career','',exits.canContinue?'':'disabled')+button('Leave and take benefits','leave-career','quiet',exits.canLeave?'':'disabled');
 return '<section class="term-exit-review"'+(forced?' data-forced-exit="true"':'')+'>'+(forced?'':'<p>'+esc(instruction)+'</p>')+(exits.retirementRequired?'<p class="warning">Changing this native Aslan career normally requires three terms. You may instead retire from character creation, collect benefits and finish.</p>':'')+'<div class="actions">'+actions+(exits.canRetire?button('Retire from creation and take benefits','retire-career',forced?'career-exit-primary':'quiet'):'')+'</div>'+(!exits.canLeave&&exits.leaveReason?'<p class="help">'+esc(exits.leaveReason)+'</p>':'')+'</section>';
}
