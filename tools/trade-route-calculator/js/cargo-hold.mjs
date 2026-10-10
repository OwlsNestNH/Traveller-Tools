import {passengerShip,passengerSpace} from './passengers.mjs?v=global-planet-search-20261010-29';
// Read-only bridge manifest. Purchase facts come from each lot's frozen audit;
// current price settings, contract revenue and insurance destinations are not inputs.
import * as A from './amounts.mjs';
import {used} from './state.mjs?v=global-planet-search-20261010-29';
import {bladderSpace} from './fuel.mjs?v=global-planet-search-20261010-29';
import {passengerLuggage} from './accommodation.mjs?v=global-planet-search-20261010-29';
import {supportCargo,supportStock,supportDisplay} from './life-support.mjs?v=global-planet-search-20261010-29';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>{const [whole,fraction]=String(x).split('.');return 'Cr '+whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);};
const button=(label,action,arg='',extra='')=>'<button data-action="'+action+'" data-arg="'+esc(arg)+'" '+extra+'>'+esc(label)+'</button>';
const decimalValue=value=>{try{return value!==null&&value!==undefined&&A.cmp(value,0)>=0?A.decimal(value):null;}catch{return null;}};
// A short, explicitly approximate percentage when the exact ratio is recurring
// or too long. Never turn a saved price-table percent into an actual paid rate.
export function purchaseFacts(lot){
 const price=lot.audit?.price,unitPrice=decimalValue(price?.unitPrice),base=decimalValue(price?.audit?.basePrice);
 let percent=null;
 if(unitPrice!==null&&base!==null&&A.cmp(base,0)>0){
  const exact=A.mul(A.div(unitPrice,base),100),hundredths=A.floor(A.add(A.mul(exact,100),'0.5')),rounded=A.rat(hundredths,100);
  percent=(A.cmp(exact,rounded)?'≈ ':'')+A.decimal(rounded)+'% of base';
 }
 return {unitPrice,base,percent};
}
export function cargoManifest(state){
 const accepted=state.contracts.filter(c=>c.status==='accepted'&&c.kind!=='passenger'),sum=rows=>A.sum(rows.map(r=>r.quantity));
 const goods=sum(state.lots),freight=sum(accepted.filter(c=>c.kind==='freight')),mail=sum(accepted.filter(c=>c.kind==='mail'));
 const luggage=passengerLuggage(passengerShip(state)),bladders=bladderSpace(state.ship),support=supportCargo(state.ship),stock=supportStock(passengerShip(state));
 const occupied=used(state),free=A.sub(state.ship.capacity,occupied),passengerAccommodation=passengerSpace(state),other=A.sum([luggage,bladders,support,passengerAccommodation]);
 return {lots:state.lots,contracts:accepted,goods,freight,mail,luggage,bladders,support,passengerAccommodation,occupied,free,other,capacity:state.ship.capacity,
  investment:String(state.lots.reduce((total,lot)=>total+A.credit(lot.basis),0n)),
  supportNote:stock.tracked&&stock.legacy?'Legacy life support: recorded capacity accounting is preserved until stock is confirmed.':stock.tracked&&stock.cargoTons===null?'Life support cargo use is not known; confirm stock and hull in Settings.':null};
}
function table(label,headers,rows,cls){
 return '<div class="cargo-manifest-scroll '+cls+'" tabindex="0" role="region" aria-label="'+label+'"><table><thead><tr>'+headers.map((h,i)=>'<th scope="col"'+(i?' class="number"':'')+'>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}
export function cargoHoldPanel(state,core){
 const m=cargoManifest(state),tons=x=>esc(supportDisplay(x)),actual=state.worlds[state.actual];
 const lots=m.lots.map(lot=>{
  const p=purchaseFacts(lot),name=core.commodities.find(g=>g.id===lot.commodity)?.name||lot.commodity;
  return '<tr data-cargo-lot="'+esc(lot.id)+'"><td><strong>'+esc(name)+'</strong><div class="cargo-row-meta"><span>'+esc(lot.id)+'</span>'+button('Details','lot-audit',lot.id,'aria-label="Details for '+esc(name)+' lot '+esc(lot.id)+'"')+'</div></td><td class="number">'+tons(lot.quantity)+'</td><td class="number"><span class="mono">'+(p.unitPrice===null?'Not recorded':esc(money(p.unitPrice)))+'</span><div class="cargo-row-meta">'+esc(p.percent||(p.base===null?'Base not recorded':'Percentage unavailable'))+'</div></td></tr>';
 });
 const contracts=m.contracts.map(c=>'<tr data-cargo-contract="'+esc(c.id)+'"><td><strong>'+esc(c.description||(c.kind==='mail'?'Mail containers':'Freight'))+'</strong><div class="cargo-row-meta"><span class="tag">'+(c.kind==='mail'?'Mail':'Freight')+'</span><span>'+esc(c.id)+'</span></div></td><td class="number">'+tons(c.quantity)+'</td><td class="number">'+esc(state.worlds[c.destination]?.name||'Not recorded')+'<div class="cargo-row-meta">'+button('Details','contract-audit',c.id,'aria-label="Details for '+esc(c.kind)+' '+esc(c.id)+'"')+'</div></td></tr>');
 const ratio=A.cmp(m.capacity,0)>0?Math.max(0,Math.min(100,Number(supportDisplay(A.mul(A.div(m.occupied,m.capacity),100))))):0;
 return '<aside id="cargo-hold-panel" class="panel world-screen cargo-hold-panel" aria-label="Cargo hold quick manifest">'+
  '<div class="screen-topline"><span>● Cargo Hold</span>'+button('← World data','cargo-hold-close')+'</div><h2 tabindex="-1">Cargo aboard</h2><p class="help cargo-location">'+esc(state.ship.name)+' · ship at '+esc(actual?.name||'Not set')+'</p>'+
  '<section class="cargo-capacity" aria-label="Hold capacity"><span class="label">Hold capacity</span><div class="cargo-capacity-values"><strong>'+tons(m.occupied)+' / '+tons(m.capacity)+' t</strong><span>'+tons(m.free)+' t free</span></div><progress max="100" value="'+ratio+'" aria-label="Cargo hold used" aria-valuetext="'+tons(m.occupied)+' of '+tons(m.capacity)+' tons"></progress><p class="help">Goods '+tons(m.goods)+' t · Freight '+tons(m.freight)+' t · Mail '+tons(m.mail)+' t</p><details class="cargo-other"><summary>Other hold use: '+tons(m.other)+' t · Breakdown</summary><dl><dt>Passenger luggage</dt><dd>'+tons(m.luggage)+' t</dd>'+(A.cmp(m.passengerAccommodation,0)>0?'<dt>Basic passenger accommodation</dt><dd>'+tons(m.passengerAccommodation)+' t</dd>':'')+'<dt>Fuel in bladders</dt><dd>'+tons(m.bladders)+' t</dd><dt>Life support overflow</dt><dd>'+tons(m.support)+' t</dd></dl>'+(m.supportNote?'<p class="help">'+esc(m.supportNote)+'</p>':'')+'</details></section>'+
  '<section class="cargo-speculative" aria-labelledby="cargo-spec-heading"><div class="cargo-section-heading"><h3 id="cargo-spec-heading">Speculative goods</h3><span class="help">'+lots.length+' separate '+(lots.length===1?'lot':'lots')+'</span></div>'+(lots.length?table('Speculative goods; scroll for more lots and columns',['Cargo','Tons','Purchase Cr / t'],lots,'cargo-goods-scroll'):'<p class="cargo-empty help">No owned trade goods aboard.</p>')+
  '<div class="cargo-investment" tabindex="0" role="region" aria-label="Cargo investment"><div><strong>Cargo investment</strong><span class="mono">'+esc(money(m.investment))+'</span></div><p class="help">Remaining owned-goods cost basis only</p></div></section>'+
  '<section class="cargo-consignments" aria-labelledby="cargo-contract-heading"><div class="cargo-section-heading"><h3 id="cargo-contract-heading">Freight &amp; mail</h3><span class="help">'+contracts.length+' '+(contracts.length===1?'consignment':'consignments')+'</span></div>'+(contracts.length?table('Freight and mail; scroll for more consignments and columns',['Consignment','Tons','Destination'],contracts,'cargo-contract-scroll'):'<p class="cargo-empty help">No accepted freight or mail aboard.</p>')+'</section>'+
  '<div class="cargo-panel-actions">'+button('Open Cargo →','cargo-hold-tab','Cargo','class="primary"')+button('Open Contracts','cargo-hold-tab','Contracts')+'</div><p class="help cargo-panel-footnote">Full table in Cargo · Base values and audit in Details</p></aside>';
}
