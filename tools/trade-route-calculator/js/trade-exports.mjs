// Static, read-only exports. Player output receives only the public snapshot contract.
import {projectPlayerSnapshot,EXPENSE_KINDS} from './player-snapshot.mjs?v=trade-exports-20261021-116';
import {derivedRetailPercent} from './player-retail-percent.mjs';
const MAX_EXPORT_BYTES=2*1024*1024;
const esc=value=>String(value??'Unknown').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bounded=value=>{if(new TextEncoder().encode(value).length>MAX_EXPORT_BYTES)throw Error('This report exceeds the 2 MiB export limit. No partial report was created.');return value;};
const value=x=>x===null||x===undefined?'Unknown':String(x);
const table=(head,rows)=>'<div class="report-table"><table><thead><tr>'+head.map(x=>'<th scope="col">'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const facts=pairs=>table(['Detail','Recorded value'],pairs.map(([k,v])=>[k,value(v)]));
const section=(title,body)=>'<section><h2>'+esc(title)+'</h2>'+body+'</section>';
function shell(title,body){return bounded('<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>body{font:14px/1.4 system-ui,sans-serif;color:#111;background:#fff;max-width:1050px;margin:24px auto;padding:0 16px}h1{font-size:24px}h2{font-size:18px;margin-top:24px} .report-table{max-width:100%;overflow:auto}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:6px 8px;border:1px solid #bcc7d0;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#e8eef3}tbody tr:nth-child(even){background:#f5f7f9}pre{white-space:pre-wrap;overflow-wrap:anywhere}h2{break-after:avoid}tr{break-inside:avoid}thead{display:table-header-group}.print-controls{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}button{font:inherit;padding:8px}@media screen and (max-width:600px){table{min-width:640px}body{margin:16px auto}}@page{size:A4;margin:12mm}@media print{body{margin:0;padding:0;font-size:10pt;max-width:none}.print-controls{display:none}a{color:inherit}}</style><body><h1>'+esc(title)+'</h1>'+body+'</body></html>');}
function marketSections(data){return ['buy','sell'].map(side=>{const market=data[side];return section(side==='buy'?'Buy offers · crew purchases':'Sell offers · crew sales','<p>'+esc(market.status)+' · negotiated goods prices; broker commission is separate and unconfirmed.</p>'+table(['Goods','Tons quoted','Cr / ton','Effective retail / ton','≈ % retail'],market.offers.map(r=>[r.name,r.tons,r.creditsPerTon,value(r.retailPerTon),derivedRetailPercent(r)])));}).join('');}
export function playerTradePrint(input,{marketOnly=false}={}){
 const d=projectPlayerSnapshot(input),title=marketOnly?'Player market sheet':'Player trade-tool details';
 let body='<p>Player-safe fixed snapshot · Captured '+esc(d.capturedAt)+' · Campaign date '+esc(d.campaignDate)+'. Offers are not transactions. This report does not update.</p>'+section('Planetary information',facts([['World',d.world.name],['Location',d.world.location],['UWP',d.world.uwp],['Trade codes',d.world.tradeCodes],['Travel zone',d.world.travelZone],['Starport / fuel',d.world.starport]]));
 if(!marketOnly){body+=section('Ship and supplies',facts([['Ship',d.ship.name],['Cargo capacity (t)',d.ship.cargoCapacityTons],['Cash (Cr)',d.ship.cashCredits],['Destination',d.ship.destination],['Fuel aboard / capacity (t)',value(d.ship.fuel.current)+' / '+value(d.ship.fuel.capacity)],['Internal life support / capacity',value(d.ship.lifeSupport.current)+' / '+value(d.ship.lifeSupport.capacity)],['Life support days / capacity',value(d.ship.lifeSupport.daysRemaining)+' / '+value(d.ship.lifeSupport.daysCapacity)],['Reserve LSS',d.ship.lifeSupport.cargoLss],['Reserved cargo space (t)',d.ship.lifeSupport.cargoReservedTons]]));
 body+=section('Cargo aboard',table(['Goods','Tons','Recorded retail / t','Paid / t','Remaining goods cost','Original broker commission'],d.cargo.map(r=>[r.name,r.tons,value(r.purchase?.retailPerTon),value(r.purchase?.paidPerTon),value(r.purchase?.paidTotal),value(r.purchase?.originalBrokerCommission)])));
 body+=section('Current-system expenses', '<p>'+esc(d.expenses.visitLabel)+'. Expected and paid are separate; this is not a balance due.</p>'+table(['Kind','Expected Cr','Paid Cr','Basis'],EXPENSE_KINDS.map(k=>[k,value(d.expenses[k].expected),value(d.expenses[k].paid),d.expenses[k].basis])));}
 body+=marketSections(d)+'<p>Percentages compare the displayed price with recorded effective retail, excluding commission. Rounded link prices can differ from original table percentages. Unknown values are not zero. Live reference maps are not included in this static report.</p>';
 return shell(title,body);
}
// Explicitly private input. Never pass this document or its source rows to player output.
export function gmTradePrint(playerInput,rows){
 const publicHtml=playerTradePrint(playerInput),start=publicHtml.indexOf('<body>')+6,end=publicHtml.lastIndexOf('</body>');
 const body=publicHtml.slice(start,end).replace('Player-safe fixed snapshot','Public snapshot section').replace('<h1>Player trade-tool details</h1>','<p>GM ONLY · Contains recorded calculations and private lot identities. Do not distribute as a player handout.</p>');
 return shell('GM trade-tool details',body+rows.map(r=>section(r.side+' · '+r.name+' · '+r.id,facts([['Tons',r.tons],['Price per ton',r.creditsPerTon],['Recorded broker options',JSON.stringify(r.broker??null)]])+'<h3>Recorded calculation / stock audit</h3><pre>'+esc(JSON.stringify(r.audit??null,null,2))+'</pre>')).join(''));
}
const cell=x=>{let s=value(x);if(/^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
export function marketCsv(input,{gmRows=null}={}){
 const d=projectPlayerSnapshot(input),head=['Audience','Captured','World','Side','Goods','Tons quoted','Cr / ton','Effective retail / ton','Derived % retail','Broker commission'];
 const rows=['buy','sell'].flatMap(side=>d[side].offers.map(r=>['PLAYER',d.capturedAt,d.world.name,side,r.name,r.tons,r.creditsPerTon,value(r.retailPerTon),derivedRetailPercent(r),'Unknown; separate from goods price']));
 if(gmRows!==null){head.push('Private lot / offer ID','Recorded broker options','Recorded calculation / stock audit');rows.length=0;for(const r of gmRows)rows.push(['GM ONLY',d.capturedAt,d.world.name,r.side,r.name,r.tons,r.creditsPerTon,value(r.retailPerTon),derivedRetailPercent(r),'See recorded options; not an inferred transaction fee',r.id,JSON.stringify(r.broker??null),JSON.stringify(r.audit??null)]);}
 return bounded('\uFEFF'+[head,...rows].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n');
}
export function openTradePrint(html,host=window){
 bounded(html);const target=host.open('','_blank');if(!target)throw Error('Allow popups to open the print view. No campaign data was changed.');
 target.opener=null;target.document.open();target.document.write(html);target.document.close();
 const controls=target.document.createElement('div');controls.className='print-controls';const note=target.document.createElement('p');note.textContent='Use your browser print dialog and choose Save as PDF. No PDF is saved automatically.';const print=target.document.createElement('button');print.textContent='Print / Save as PDF';print.addEventListener('click',()=>target.print());const close=target.document.createElement('button');close.textContent='Close';close.addEventListener('click',()=>target.close());controls.append(print,close,note);target.document.body.prepend(controls);target.focus();return target;
}
