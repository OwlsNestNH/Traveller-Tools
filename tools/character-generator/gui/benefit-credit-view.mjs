// Optional one-roll credits are selected explicitly; unselected credits remain in history.
export function benefitCreditView(state,{esc}){
 const choices=state.benefitCreditOptions??[];if(!choices.length)return '';
 return '<fieldset><legend>Bonuses for this roll</legend><p class="help">Choose any bonuses to apply. Unused bonuses stay available.</p>'+choices.map(choice=>'<label class="check"><input type="checkbox" name="benefit-credit" value="'+esc(choice.id)+'"><span>'+esc(choice.label)+' / +'+esc(choice.value)+'</span></label>').join('')+'</fieldset>';
}
