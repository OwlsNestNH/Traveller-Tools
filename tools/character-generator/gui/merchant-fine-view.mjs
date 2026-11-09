// Presentation only; payment availability and consequences come from the rules API.
const money=value=>Number.isFinite(value)?'Cr'+value.toLocaleString():'Not rolled';
export function merchantFineView(state,{esc,button,sourceLabel}){
 const record=state.currentMerchantFine;if(!record)return '<p class="warning">The pending fine record is unavailable. Keep the saved character and reload.</p>';
 let html='<p class="source">'+esc(sourceLabel(record.source?.id??'aliens',record.source?.page??269))+'</p><p>This Merchant mishap fine is recorded separately from any later re-education fine.</p>';
 if(record.die!==null&&record.die!==undefined)html+='<p class="total">Rolled die: '+esc(record.die)+'. Fine: '+esc(money(record.amount))+'.</p>';
 if(state.stage==='merchant-fine-roll')return html+'<div class="actions">'+button('Roll Merchant fine','merchant-fine-roll')+'</div>';
 html+='<p>Available cash: <strong>'+esc(money(record.cashAvailable))+'</strong>. SOC: <strong>'+esc(record.socialStanding)+'</strong>.</p>';
 const options=state.merchantFineOptions??[];
 if(!options.length||options.some(o=>!['pay','decline'].includes(o.id)))return html+'<p class="warning">No supported fine decision is available. Keep this character pending.</p>';
 return html+'<div class="actions">'+options.map(option=>button(esc(option.label),'resolve-merchant-fine',option.id==='decline'?'quiet':'','data-decision="'+option.id+'" '+(option.available?'':'disabled'))).join('')+'</div>'+options.filter(option=>option.reason).map(option=>'<p class="help">'+esc(option.label)+': '+esc(option.reason)+'</p>').join('');
}
export function merchantFineSheet(state,{esc,careerName}){
 const records=state.character.merchantFines??[];if(!records.length)return '';
 return '<div class="sheet-section"><h3>Merchant fine record</h3>'+records.map(record=>'<h4>'+esc(careerName(record.origin?.careerId)??'Merchant')+' / '+esc(record.status??'pending')+'</h4>'+(record.die!==null&&record.die!==undefined?'<p>Recorded die: '+esc(record.die)+'. Fine: '+esc(money(record.amount))+'.</p>':'<p>Fine not rolled.</p>')+(record.decision==='pay'?'<p>Paid '+esc(money(record.payment?.amount??record.amount))+' from cash.</p>':record.decision==='decline'?'<p>Payment declined.</p>':'')+(record.reeducationId?'<p>Followed by a separate re-education record.</p>':'')).join('')+'</div>';
}
