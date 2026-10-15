import {cargoManifest,purchaseFacts} from './cargo-hold.mjs?v=subsector-boundaries-20261015-91';
import {supportDisplay} from './life-support.mjs?v=subsector-boundaries-20261015-91';
import {escapeHtml as esc,formatDecimalCreditsText} from './display.mjs?v=subsector-boundaries-20261015-91';
import * as A from './amounts.mjs';

const tons=value=>esc(supportDisplay(value))+' t';
const button=(label,action,id='',mutate=false)=>'<button class="small" data-action="'+action+'" data-arg="'+esc(id)+'"'+(mutate?' data-mutate':'')+'>'+label+'</button>';
const price=value=>value===null?'Not recorded':esc(formatDecimalCreditsText(value))+' / t';

// Presentation only: retain every exact stored quantity and each independent lot.
// Removal accounting is deliberately absent until fractional-stock handling is
// settled; an integer remainder must never replace an existing fractional one.
export function cargoManagementPanel(state,core,{retail=()=>null,search='',sort='name'}={}){
 const m=cargoManifest(state),name=lot=>core.commodities.find(g=>g.id===lot.commodity)?.name||lot.commodity;
 const lots=state.lots.filter(l=>(l.description+' '+name(l)).toLowerCase().includes(search.toLowerCase()));
 lots.sort((a,b)=>sort==='quantity'?-A.cmp(a.quantity,b.quantity):a.description.localeCompare(b.description));
 const lotRows=lots.map(l=>'<tr data-management-lot="'+esc(l.id)+'"><td><strong>'+esc(name(l))+'</strong><div class="help">'+esc(l.description)+' · Lot '+esc(l.id)+(l.illegal?' <span class="tag illegal">Illegal</span>':'')+'</div></td><td class="number">'+tons(l.quantity)+'</td><td class="number">'+price(retail(l))+'</td><td class="number">'+price(purchaseFacts(l).unitPrice)+'</td><td class="table-actions">'+button('Sell','lot-sell',l.id,true)+button('Audit','lot-audit',l.id)+button('Edit','lot-correct',l.id,true)+(state.settings.insurance?button('Insure cargo','lot-insure',l.id,true):'')+'</td></tr>');
 const otherRows=m.contracts.map(c=>'<tr data-management-contract="'+esc(c.id)+'"><td><strong>'+esc(c.description||(c.kind==='mail'?'Mail containers':'Freight'))+'</strong><div class="help">'+(c.kind==='mail'?'Mail':'Freight')+' Â· '+esc(state.worlds[c.destination]?.name||'Destination not recorded')+'</div></td><td class="number">'+tons(c.quantity)+'</td><td>'+button('Details','contract-audit',c.id)+'</td></tr>');
 const other=(key,label,value)=>{if(A.cmp(value,0)>0)otherRows.push('<tr data-management-stock="'+key+'"><td><strong>'+label+'</strong></td><td class="number">'+tons(value)+'</td><td></td></tr>');};
 other('luggage','Passenger luggage',m.luggage);
 other('support','Cargo life support supplies',m.support);
 other('bladders','Fuel in bladders',m.bladders);
 other('accommodation','Basic passenger accommodation',m.passengerAccommodation);
 const table=(label,headers,rows)=>'<div class="cargo-management-scroll" tabindex="0" role="region" aria-label="'+label+'"><table'+(label==='Speculative cargo lots'?' class="cargo-table"':'')+'><thead><tr>'+headers.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
 return '<section class="panel cargo-management" aria-label="Cargo aboard"><h2>Cargo aboard</h2><div class="panel-body"><p class="cargo-management-total"><strong>'+tons(m.occupied)+' / '+tons(m.capacity)+'</strong><span>'+tons(m.free)+' free</span></p><div class="toolbar"><input id="cargo-search" aria-label="Search cargo" placeholder="Search cargo lots." value="'+esc(search)+'"><select id="cargo-sort" aria-label="Sort cargo"><option value="name">Name</option><option value="quantity"'+(sort==='quantity'?' selected':'')+'>Quantity</option></select><span class="help">'+lots.length+' / '+state.lots.length+' lots</span></div></div><h3>Speculative goods</h3>'+
 (lotRows.length?table('Speculative cargo lots',['Cargo / lot description','Tons held','Retail Cr / t','Actual purchase Cr / t','Actions'],lotRows):'<p class="panel-body help">'+(state.lots.length?'No owned trade goods match this search.':'No owned trade goods aboard.')+'</p>')+
 '<div class="panel-body cargo-investment"><strong>Cargo investment</strong><span class="mono">'+esc(formatDecimalCreditsText(m.investment))+'</span></div><h3>Other cargo and hold use</h3>'+
 (otherRows.length?table('Other cargo aboard',['Cargo','Tons held','Actions'],otherRows):'<p class="panel-body help">No other cargo aboard.</p>')+
 '<div class="panel-body">'+button('Add existing / referee cargo','add-lot','',true)+'<p class="help">Purchase prices are the original recorded goods quote, excluding fees and insurance. Missing history is Not recorded. Sell opens Trade Sell for that lot; review the buyer and confirm there.</p></div></section>';
}
