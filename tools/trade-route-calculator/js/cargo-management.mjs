import {createCargoRemoval,cargoRemovalSummary,cargoNumber} from './cargo-removal.mjs?v=buy-zoom-20261019-96';
import {supportCompartments} from './lss-compartments.mjs?v=buy-zoom-20261019-96';
import {supportAmount} from './life-support.mjs?v=buy-zoom-20261019-96';
import {cargoManifest,purchaseFacts} from './cargo-hold.mjs?v=buy-zoom-20261019-96';
import {supportDisplay} from './life-support.mjs?v=buy-zoom-20261019-96';
import {escapeHtml as esc,formatDecimalCreditsText} from './display.mjs?v=buy-zoom-20261019-96';
import * as A from './amounts.mjs';

const tons=value=>esc(supportDisplay(value))+' t';
const button=(label,action,id='',mutate=false)=>'<button class="small" data-action="'+action+'" data-arg="'+esc(id)+'"'+(mutate?' data-mutate':'')+'>'+label+'</button>';
const price=value=>value===null?'Not recorded':esc(formatDecimalCreditsText(value))+' / t';

// Recorded rows stay visible throughout a preview, including pending zeroes.
export function cargoManagementPanel(state,core,{retail=()=>null,search='',sort='name',removal=null,busy=false,error=''}={}){
 const draft=removal??createCargoRemoval(state),summary=cargoRemovalSummary(draft),blocked=!!draft.precondition;
 const spinner=key=>{const e=draft.entries.find(e=>e.key===key);return e?'<div class="cargo-remaining"><input type="number" min="0" max="'+e.original+'" step="1" value="'+draft.remaining[key]+'" data-cargo-remaining="'+esc(key)+'" aria-label="Tons remaining aboard '+esc(key)+'" data-mutate'+(busy||blocked?' disabled data-unavailable':'')+'></div>':'';};
 const m=cargoManifest(state),name=lot=>core.commodities.find(g=>g.id===lot.commodity)?.name||lot.commodity;
 // Visibility follows the recorded manifest, never a future removal draft: a
 // pending zero must remain restorable until its removal is confirmed.
 const heldLots=state.lots.filter(l=>A.cmp(l.quantity,0)>0);
 const lots=heldLots.filter(l=>(l.description+' '+name(l)).toLowerCase().includes(search.toLowerCase()));
 lots.sort((a,b)=>sort==='quantity'?-A.cmp(a.quantity,b.quantity):a.description.localeCompare(b.description));
 const lotRows=lots.map(l=>'<tr data-management-lot="'+esc(l.id)+'"><td><strong>'+esc(name(l))+'</strong><div class="help">'+esc(l.description)+' &middot; Lot '+esc(l.id)+(l.illegal?' <span class="tag illegal">Illegal</span>':'')+'</div></td><td class="number">'+tons(l.quantity)+'</td><td class="number">'+price(retail(l))+'</td><td class="number">'+price(purchaseFacts(l).unitPrice)+'</td><td class="table-actions">'+button('Sell','lot-sell',l.id,true)+button('Audit','lot-audit',l.id)+button('Edit','lot-correct',l.id,true)+(state.settings.insurance?button('Insure cargo','lot-insure',l.id,true):'')+'</td><td>'+spinner('lot:'+l.id)+'</td></tr>');
 const otherRows=m.contracts.filter(c=>A.cmp(c.quantity,0)>0).map(c=>'<tr data-management-contract="'+esc(c.id)+'"><td><strong>'+esc(c.description||(c.kind==='mail'?'Mail containers':'Freight'))+'</strong><div class="help">'+(c.kind==='mail'?'Mail':'Freight')+' · '+esc(state.worlds[c.destination]?.name||'Destination not recorded')+'</div></td><td class="number">'+tons(c.quantity)+'</td><td>'+button('Details','contract-audit',c.id)+'</td><td>'+spinner('contract:'+c.id)+'</td></tr>');
 for(const item of m.otherCargo)otherRows.push('<tr data-management-other="'+esc(item.id)+'"><td><strong>'+esc(item.description)+'</strong><div class="help">Other cargo &middot; '+(item.saleValue===undefined?'Sale value not recorded':'Sale value &mdash; whole lot: '+esc(formatDecimalCreditsText(item.saleValue)))+'</div></td><td class="number">'+tons(item.quantity)+'</td><td>'+button('Sell whole lot','other-sell',item.id,true)+button('Adjust','other-adjust',item.id,true)+'</td><td>'+spinner('other:'+item.id)+'</td></tr>');
 const other=(key,label,value)=>{if(A.cmp(value,0)>0)otherRows.push('<tr data-management-stock="'+key+'"><td><strong>'+label+'</strong></td><td class="number">'+tons(value)+'</td><td></td><td>'+spinner(key)+'</td></tr>');};
 other('luggage','Passenger luggage',m.luggage);
 other('support','Cargo life support supplies',m.support);
 other('bladders','Fuel in bladders',m.bladders);
 other('accommodation','Basic passenger accommodation',m.passengerAccommodation);
 const table=(label,headers,rows)=>'<div class="cargo-management-scroll" tabindex="0" role="region" aria-label="'+label+'"><table'+(label==='Speculative cargo lots'?' class="cargo-table"':'')+'><thead><tr>'+headers.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
 return '<section class="panel cargo-management" aria-label="Cargo aboard"><h2>Cargo aboard</h2><div class="panel-body"><p class="cargo-management-total"><strong>'+tons(m.occupied)+' / '+tons(m.capacity)+'</strong><span>'+tons(m.free)+' free</span></p>'+(heldLots.length?'<div class="toolbar"><input id="cargo-search" aria-label="Search cargo" placeholder="Search cargo lots." value="'+esc(search)+'"><select id="cargo-sort" aria-label="Sort cargo"><option value="name">Name</option><option value="quantity"'+(sort==='quantity'?' selected':'')+'>Quantity</option></select><span class="help">'+lots.length+' / '+heldLots.length+' lots</span></div>':'')+'</div>'+
 (lotRows.length?'<h3>Speculative goods</h3>'+table('Speculative cargo lots',['Cargo / lot description','Tons held','Retail Cr / t','Actual purchase Cr / t','Actions','Remaining aboard (t)'],lotRows)+'<div class="panel-body cargo-investment"><strong>Cargo investment</strong><span class="mono">'+esc(formatDecimalCreditsText(m.investment))+'</span></div>':'')+
 (otherRows.length?'<h3>Other cargo and hold use</h3>'+table('Other cargo aboard',['Cargo','Tons held','Actions','Remaining aboard (t)'],otherRows):'')+
 removalFooter(state,draft,summary,{busy,error})+'<div class="panel-body">'+button('Referee Add / Adjust','add-lot','',true)+'<p class="help">Purchase prices are the original recorded goods quote, excluding fees and insurance. Missing history is Not recorded. Sell opens Trade Sell for that lot; review the buyer and confirm there.</p></div></section>';
}

function removalFooter(state,draft,summary,{busy,error}){
 const lost=draft.entries.filter(e=>A.cmp(draft.remaining[e.key],e.original)<0),warnings=[];
 if(lost.some(e=>e.kind==='contract'))warnings.push('Freight/mail removal records cargo loss and blocks ordinary delivery and payment for the affected contracts.');
 if(lost.some(e=>e.kind==='luggage'))warnings.push('Luggage will be lost. Passengers stay aboard; their delivery and payment are unchanged. Future bookings keep their own luggage allowances.');
 if(lost.some(e=>e.kind==='lot'))warnings.push('Removed trade goods are lost, with no sale, bank credit or automatic insurance claim.');
 const support=draft.entries.find(e=>e.kind==='support');
 if(support){const cargo=supportAmount(supportCompartments(state.ship).cargo),limit=A.mul(draft.remaining.support,100),loss=A.cmp(cargo,limit)>0?A.sub(cargo,limit):0;warnings.push('Cargo life support: '+esc(supportDisplay(cargo))+' LSS aboard; '+esc(draft.remaining.support)+' t reserved after confirmation. '+(A.cmp(loss,0)>0?esc(supportDisplay(loss))+' LSS will be lost. ':'Rounding space adds no supplies. ')+'Internal supplies stay unchanged.');}
 if(lost.some(e=>e.kind==='other'))warnings.push('Removed Other cargo earns no payment. Its former whole-lot sale value is cleared; enter a new explicit value before selling any remainder.');
 return '<div class="panel-body cargo-removal-footer" aria-live="polite"><p><strong>Cargo aboard: '+tons(summary.original)+' &rarr; '+tons(summary.revised)+'</strong> &middot; Total removed: '+tons(summary.removed)+'</p>'+
 (A.cmp(cargoNumber(summary.rounded),0)>0?'<p class="notice">Existing fractions round upward on confirmation, adding '+tons(summary.rounded)+' before removal ('+tons(summary.normalized)+' total). Historical purchase prices and costs stay unchanged.</p>':'')+
 (draft.precondition?'<p class="notice">'+esc(draft.precondition)+'</p>':'')+
 (summary.overCapacity?'<p class="notice">Preview exceeds hold capacity. Remove more cargo before confirming.</p>':'')+
 warnings.map(w=>'<p class="help">'+w+'</p>').join('')+(error?'<p class="notice">'+esc(error)+'</p>':'')+
 '<div class="wide-actions">'+button('Cancel','cargo-cancel')+'<button data-action="cargo-confirm" data-mutate'+(!summary.changed||summary.overCapacity||busy||draft.precondition?' disabled data-unavailable':'')+'>Confirm Removal</button></div></div>';
}
