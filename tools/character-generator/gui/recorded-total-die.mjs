// A recorded aggregate is never represented as invented individual pips.
export function recordedTotalDie(total,{esc=String}={}){
 if(!Number.isFinite(total))return '<span class="recorded-total-unavailable">Recorded total unavailable.</span>';
 return '<span class="recorded-total-die" role="img" aria-label="Recorded roll total '+esc(total)+'; individual faces unavailable"><span class="recorded-total-die-value" aria-hidden="true">'+esc(total)+'</span><span class="recorded-total-die-label" aria-hidden="true">Total</span></span>';
}
