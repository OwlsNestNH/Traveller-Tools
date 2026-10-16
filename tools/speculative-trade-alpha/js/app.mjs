import * as E from './engine.mjs';
import * as S from './session.mjs';
import * as Map from './map-adapter.mjs';
import {SaveBoundary,browserExclusive} from './persistence.mjs';
import {planetInformation} from '../../trade-route-calculator/js/planet-info.mjs';
import {context} from '../../trade-route-calculator/js/rules.mjs';

const $=id=>document.getElementById(id);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>'Cr'+E.approximate(value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const fields=form=>Object.fromEntries(new FormData(form));
const message=(text,error=false)=>{$('message').textContent=text;$('message').className=error?'error':'';};
let store,chart,core,worlds=[],busy=false,review=null,governmentWorld=null,targetBoundary=null;
try {
  const response=await fetch('../trade-route-calculator/rules/merchant-prince-1e.json');
  if(!response.ok)throw Error('Verified tax data could not load. Reload to try again.');
  chart=(await response.json()).tax;
  const coreResponse=await fetch('../trade-route-calculator/rules/core-2022.json');
  if(!coreResponse.ok)throw Error('World decoding data could not load.');core=await coreResponse.json();
  $('government').innerHTML=chart.governmentRates.map(r=>`<option value="${esc(r.uwpGovernmentCode)}">${esc(r.label)}</option>`).join('');$('government').value='4';
  store=new SaveBoundary({storage:localStorage,initial:S.initial(),validate:S.validate,exclusive:browserExclusive(navigator)});
  render();message('Ready. Working alpha rules; keep an exported backup.');
  if(store.snapshot().current)await refreshMap();
}catch(error){message(error.message+' Export the retained save or import a valid alpha backup to recover.',true);$('setup').hidden=true;$('recovery').hidden=false;$('retry').hidden=true;}

function renderMap() {
  if(!store)return;const s=store.snapshot();if(!s.current)return;
  const points=Map.positions(worlds,s.current,Number($('radius').value));
  $('map-source').textContent=worlds[0]?.dataSource||'No nearby data loaded. Refresh to retry.';
  $('map').innerHTML='<circle cx="250" cy="250" r="216" fill="none" stroke="#2b4056" stroke-dasharray="3 6"/>'+points.map(p=>`<g class="world" role="button" tabindex="0" data-world="${esc(p.world.id)}" aria-label="${esc(p.world.name)}, ${p.distance} parsecs" aria-pressed="${s.destination?.id===p.world.id}"><title>${esc(p.world.name)} · ${esc(p.world.uwp)} · ${p.distance} pc</title><circle cx="${p.x}" cy="${p.y}" r="9"/><text x="${p.x+12}" y="${p.y+4}">${esc(p.world.name)}</text></g>`).join('');
}
function render() {
  document.querySelector('main').setAttribute('aria-busy',String(busy));
  const s=store.snapshot(),buying=s.phase==='buy',arrived=s.phase==='arrived';
  $('setup').hidden=s.phase!=='setup';$('play').hidden=s.phase==='setup';
  $('recovery').hidden=!store.pending&&!store.uncertain;$('retry').hidden=!store.pending||store.uncertain;
  const gm=$('gm-view').checked;$('gm-details').hidden=!gm;
  $('backup-section').hidden=s.phase!=='setup'&&!gm;
  $('summary').innerHTML=`<div>Cash<strong>${money(s.cash)}</strong></div><div>Unpaid bills<strong>${money(s.unpaid)}</strong></div><div>Month ${s.month} · jump ${s.jumps}<strong>${esc(s.current?.name||'Setup')}</strong></div>${gm?`<div>GM target / month<strong>${money(s.settings.monthlyTarget)}</strong></div>`:''}`;
  $('next-form').elements.monthlyTarget.parentElement.hidden=!gm;
  $('world-caption').textContent='Current world: '+(s.current?.name||'—')+(s.current?.dataSource?' · '+s.current.dataSource:'');
  $('destination-caption').textContent=s.destination?'Selected: '+s.destination.name+' · '+Map.distance(s.current,s.destination)+' pc':'Click a nearby world to select a destination.';
  if(s.current&&governmentWorld!==s.current.id){$('government').value=s.current.uwp[5];governmentWorld=s.current.id;}
  const boundary=s.month+':'+s.settings.monthlyTarget;
  if(boundary!==targetBoundary){$('next-form').elements.monthlyTarget.value=s.settings.monthlyTarget;targetBoundary=boundary;}
  $('planet-info').innerHTML=[s.current,s.destination].filter(Boolean).map(w=>{
    const p=planetInformation(w);let codes;
    try{codes=context(w,core).codes.join(' ')||'None';}catch{codes='Unknown — UWP needs review';}
    return `<div class="planet"><strong>${esc(w.name)} · ${esc(w.hex||'')} · ${esc(w.uwp)}</strong><p>Trade codes: <strong>${esc(codes)}</strong></p><dl>${p.decoded.map(([name,code,description])=>`<dt>${esc(name)} ${esc(code)}</dt><dd>${esc(description)}</dd>`).join('')}</dl></div>`;
  }).join('');
  $('lot-form').hidden=!buying||!s.supplierConfirmed;$('confirm-supplier').hidden=!buying||!!s.supplierConfirmed;$('travel-form').hidden=!buying;$('sale-section').hidden=!arrived;$('next-section').hidden=s.phase!=='closed';
  $('lots').innerHTML=s.offers.map(l=>`<article class="lot"><strong>${esc(l.name)}</strong><p>${esc(l.tonnes)} t · ${money(l.purchase)} whole lot · ${esc(l.risk)} risk</p><button data-buy="${esc(l.id)}">Buy lot</button><button data-audit="lot:${esc(l.id)}">Audit lot</button></article>`).join('')+s.lots.map(l=>`<article class="lot"><strong>${esc(l.name)} · aboard</strong><p>${esc(l.tonnes)} t · original cost ${money(l.purchase)} · ${esc(l.risk)} risk</p><button data-audit="lot:${esc(l.id)}">Audit lot</button></article>`).join('');
  $('sales').innerHTML=s.lots.map(l=>`<article class="lot"><strong>${esc(l.name)}</strong><p>${l.search?'Buyer search: '+esc(l.search.dice.join(' + '))+' → '+esc(l.search.total)+' · '+(l.search.success?'buyer found':'no buyer; retry policy unresolved'):'Buyer not searched'}</p>${!l.search?`<button data-search="${esc(l.id)}">Find buyer</button><button data-admin="${esc(l.id)}">Data Net buyer</button>`:`<button data-audit="search:${esc(l.id)}">Audit search</button>${l.search.method==='Admin'&&!l.search.success&&l.search.durationMinutes<=60?`<button data-search="${esc(l.id)}">Find buyer</button>`:''}`}${l.search?.success&&!l.quote?`<button data-quote="${esc(l.id)}">Roll sale quote</button>`:''}${l.quote?`<p>Saved quote: <strong>${money(l.quote.gross)}</strong> · dice ${esc(l.quote.dice.join(' + '))} · negotiation ${l.quote.negotiationPP>0?'+':''}${esc(l.quote.negotiationPP)} pp</p><button data-audit="quote:${esc(l.id)}">Audit sale quote</button>`:''}</article>`).join('');
  $('accept-sale').disabled=!review||busy||!!store.pending||store.uncertain;
  $('zero-trial').checked=s.settings.zeroLossTrial;
  $('audit').textContent=JSON.stringify(s,(key,value)=>key==='raw'&&typeof value==='object'?undefined:value,2);renderMap();
  for(const button of document.querySelectorAll('button'))if(!['retry','reload','export'].includes(button.id))button.disabled=button.id==='accept-sale'?!review||busy||!!store.pending||store.uncertain:busy||!!store.pending||store.uncertain;
  if(s.phase==='stopped')message('Playtest stopped: monthly bills remain unpaid. Cash and liability are recorded separately.',true);
}
async function execute(id,transition,success='Saved.',options={}) {
  if(busy||!store)return false;busy=true;render();let succeeded=false;
  try {await store.command(id,transition,options);review=null;$('settlement-preview').textContent='';message(success);succeeded=true;}
  catch(error){message(error.message,true);}
  finally {busy=false;render();}
  return succeeded;
}
async function refreshMap() {
  if(!store?.snapshot().current)return;
  const current=store.snapshot().current;
  try {const loaded=await Map.loadNearby(current);if(store.snapshot().current?.id===current.id){worlds=loaded;renderMap();}}
  catch(error){message('Nearby map unavailable: '+error.message+'. Your trade save is retained; use Refresh nearby worlds to retry.',true);}
}
const manualDice=()=>$('roll-mode').value==='manual'?[Number($('die1').value),Number($('die2').value)]:null;
$('roll-mode').addEventListener('change',()=>{for(const id of ['die1','die2'])$(id).disabled=$('roll-mode').value!=='manual';});
$('roll-mode').dispatchEvent(new Event('change'));
$('setup-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!store)return;const f=fields(event.currentTarget);let world;
  busy=true;render();message('Loading current world…');
  try {world=await Map.loadWorld(f.sector,f.hex);}catch(error){message(error.message,true);busy=false;render();return;}
  busy=false;const {sector,hex,...settings}=f;
  for(const key of ['baseBroker','statDM','opposingBroker','localDM'])settings[key]=Number(settings[key]);
  await execute('setup',s=>S.setup(s,settings,world),'Playtest started.');await refreshMap();
});
$('lot-form').addEventListener('submit',event=>{event.preventDefault();const f=fields(event.currentTarget),id=crypto.randomUUID();execute('offer:'+id,s=>S.offer(s,{id,...f}),'Offering saved from GM inputs.');});
$('confirm-supplier').addEventListener('click',()=>execute('supplier:'+store.snapshot().jumps,s=>S.confirmSupplier(s),'Supplier availability manually confirmed by the GM; purchase remains separate.'));
$('lots').addEventListener('click',event=>{const id=event.target.closest('[data-buy]')?.dataset.buy;if(id)execute('buy:'+id,s=>S.buy(s,id),'Lot purchased; original cost retained.');});
async function selectWorld(event) {
  const id=event.target.closest('[data-world]')?.dataset.world;if(!id||store.snapshot().phase!=='buy')return;
  const world=worlds.find(w=>w.id===id);await execute('destination:'+crypto.randomUUID(),s=>S.destination(s,world),'Destination selected.');
}
$('map').addEventListener('click',selectWorld);
$('map').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectWorld(event);}});
$('radius').addEventListener('change',renderMap);$('refresh-map').addEventListener('click',refreshMap);
$('travel-form').addEventListener('submit',async event=>{
  event.preventDefault();const f=fields(event.currentTarget),s=store.snapshot();
  const distance=s.destination?Map.distance(s.current,s.destination):0;
  // Used only by the disabled premium trial; no rate is inferred for receipts.
  f.freightRate=0;
  if(distance<1||distance>4){message('Choose a destination within four parsecs.',true);return;}
  await execute('arrive:'+(s.jumps+1),draft=>S.arrive(draft,f),'Arrival recorded. Find buyers before rolling sale quotes.');await refreshMap();
});
$('sales').addEventListener('click',event=>{
  const search=event.target.closest('[data-search]')?.dataset.search,quote=event.target.closest('[data-quote]')?.dataset.quote;
  if(search)execute(`search:${store.snapshot().visit}:${search}`,s=>S.search(s,search,manualDice()),'Buyer search saved.');
  if(quote)execute(`quote:${store.snapshot().visit}:${quote}`,s=>S.value(s,quote,manualDice()),'Sale quote saved.');
  const admin=event.target.closest('[data-admin]')?.dataset.admin;
  if(admin){
    const required=['admin-stat','admin-other','admin-discount'];if(required.some(id=>$(id).value==='')){message('The GM must select Admin stat, other search modifiers and surplus reduction first.',true);return;}
    const inputs={adminSkill:Number($('admin-skill').value),statDM:Number($('admin-stat').value),otherDM:Number($('admin-other').value),durationDie:Number($('admin-duration').value),discountPercent:Number($('admin-discount').value),rushed:$('admin-rush').checked,gmConfirmed:$('admin-confirm').checked};
    execute(`admin:${store.snapshot().visit}:${admin}`,s=>S.admin(s,admin,inputs,manualDice()),'Admin buyer search saved separately from sale negotiation.');
  }
});
const settlementInputs=()=>({...fields($('settlement-form')),zeroLossTrial:store.snapshot().settings.zeroLossTrial});
$('review-sale').addEventListener('click',()=>{
  try {const inputs=settlementInputs(),s=store.snapshot(),settlement=S.preview(s,chart,inputs);review={inputs,revision:s.revision,settlement,bankBefore:s.cash,bankAfter:E.add(s.cash,settlement.cashCredit)};
    $('settlement-preview').textContent=`Gross ${money(settlement.gross)} · fees ${money(settlement.fees)} · taxable gain ${money(settlement.gain)} · tax ${money(settlement.tax)} · net lot profit ${money(settlement.profit)}. Cash credit ${money(settlement.cashCredit)}.`;render();
  }catch(error){message(error.message,true);}
});
$('settlement-form').addEventListener('input',()=>{review=null;$('settlement-preview').textContent='';render();});
$('settlement-form').addEventListener('submit',event=>{event.preventDefault();if(!review)return;const r=review,s=store.snapshot();if(s.revision!==r.revision){review=null;render();return;}execute('settle:'+s.visit,draft=>S.sell(draft,chart,r.inputs),'Port settlement saved.');});
$('cancel-sale').addEventListener('click',()=>{review=null;$('settlement-preview').textContent='Review cancelled. Cargo and saved quotes are retained.';render();});
document.addEventListener('click',event=>{
  const key=event.target.closest('[data-audit]')?.dataset.audit;if(!key||!store)return;
  const s=store.snapshot(),[kind,...parts]=key.split(':'),id=parts.join(':'),lot=[...s.offers,...s.lots].find(l=>l.id===id);
  const data=kind==='search'?lot?.search:kind==='quote'?lot?.quote:kind==='lot'?lot:review;
  if(!data){message('Review the retained calculation first; no dice or transaction were generated.');return;}
  let explanation;
  if(kind==='lot')explanation=`${lot.name}: ${lot.tonnes} tonnes, ${money(lot.purchase)} for the whole lot, ${lot.risk} risk.\nThe GM supplied size, value and risk. No offering dice were rolled; random offering tables remain unresolved. Original cost is retained after purchase.`;
  if(kind==='search')explanation=data.method==='Admin'?`${data.rollMode} dice: ${data.dice.join(' + ')} = ${data.raw}.\n${data.raw} + Admin ${data.adminSkill} + GM-selected stat ${data.statDM} + GM-selected other modifiers ${data.otherDM} + rush ${data.rushDM} = ${data.total}. Need8+: ${data.success?'buyer found':'no buyer found'}.\nDuration die ${data.durationDie}: ${data.durationMinutes} minutes. Positive-surplus reduction ${data.discountPercent}%, selected by the GM. No sale expertise or rushing sale DM applies.`:`${data.rollMode||'Recorded'} dice: ${data.dice.join(' + ')} = ${data.raw}.\n${data.raw} + Broker ${data.baseBroker} + stat ${data.statDM} + risk ${data.riskDM} + population ${data.populationDM} = ${data.total}.\nNeed 8+: ${data.success?'buyer found':'no buyer found'}. One working day. Sale expertise does not apply to buyer search. This is a retained result; opening this explanation rolls nothing.`;
  if(kind==='quote')explanation=`${data.rollMode||'Recorded'} dice: ${data.dice.join(' + ')} = ${data.raw}.\n${data.raw} + Broker ${data.baseBroker} + stat ${data.statDM} + sale expertise ${data.expertise} + other ${data.otherSaleDM} + trade ${data.tradeDM} − opposing Broker ${data.opposingBroker} − local knowledge ${data.localDM} = ${data.modified}.\nNegotiation: 2 × (${data.modified} − 5), limited to ±10 = ${data.negotiationPP} percentage points.\n${data.risk} risk at raw ${data.raw}: ${data.riskPercent}%. Add negotiation ${data.negotiationPP} = ${data.riskPercent+data.negotiationPP}% of the established lot valuation.\nSaved gross quote: ${money(data.gross)}. Original cost: ${money(lot.purchase)}. Fees and tax are reviewed separately. Keeping this quote does not reroll its value.`;
  if(kind==='settlement'){const a=data.settlement;explanation=`Combined gross sales ${money(a.gross)} − original purchase costs ${money(a.principal)} − selling fees ${money(a.fees)} = visit gain ${money(a.gain)}.\nWhole-profit tax rate ${a.rate}%${a.bracket===null?' (explicit zero-tax trial for nonpositive gain)':', bracket '+(a.bracket+1)}: ${money(a.tax)}.\nGross ${money(a.gross)} − fees ${money(a.fees)} − tax ${money(a.tax)} = bank credit ${money(a.cashCredit)}.\nBank ${money(data.bankBefore)} + credit ${money(a.cashCredit)} = ${money(data.bankAfter)}.\nRealized lot profit after original cost, fees and tax: ${money(a.profit)}. Freight and monthly ship expenses are separate.`;}
  if(kind==='quote'&&data.dataNetDiscount)explanation+=`\nData Net: normal quote ${money(data.normalGross)} less ${E.approximate(data.dataNetDiscount)*100}% of its positive surplus above original cost = ${money(data.gross)}. Principal and loss quotes are preserved.`;
  if($('gm-view').checked&&kind==='quote')explanation+='\n\nGM ONLY · departure calibration\n'+JSON.stringify(lot.departure,null,2);
  $('audit-title').textContent=kind==='settlement'?'Fees, tax and bank explanation':kind+' explanation';$('audit-content').textContent=explanation;$('audit-dialog').showModal();
});
$('gm-view').addEventListener('change',render);
$('close-audit').addEventListener('click',()=>$('audit-dialog').close());
$('next-form').addEventListener('submit',event=>{event.preventDefault();const s=store.snapshot(),f=fields(event.currentTarget);execute('next:'+s.jumps,draft=>S.nextDeparture(draft,f),'Visit finished; monthly bills assessed when due.');});
$('zero-trial').addEventListener('change',()=>{const enabled=$('zero-trial').checked;execute('zero-trial:'+crypto.randomUUID(),s=>{s.settings.zeroLossTrial=enabled;return s;});});
$('retry').addEventListener('click',async()=>{if(busy||!store)return;busy=true;try{await store.retry();review=null;message('Prepared result saved without rerolling.');}catch(error){message(error.message,true);}finally{busy=false;render();}});
$('reload').addEventListener('click',()=>location.reload());
$('export').addEventListener('click',()=>{try{const raw=store?JSON.stringify(store.snapshot(),null,2):localStorage.getItem('traveller.speculative-trade.alpha.v1');if(raw===null)throw Error('No alpha save available');const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='speculative-trade-alpha.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){message(error.message,true);}});
$('import').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('Alpha save exceeds 10 MB');const imported=JSON.parse(await file.text());S.validate(imported);if(!store)store=new SaveBoundary({storage:localStorage,initial:S.initial(),validate:S.validate,exclusive:browserExclusive(navigator),allowInvalidExisting:true});const restored=await execute('import:'+crypto.randomUUID(),()=>imported,'Alpha save imported.',{replaceHistory:true});if(restored){$('next-form').elements.monthlyTarget.value=imported.settings.monthlyTarget;governmentWorld=null;worlds=[];render();await refreshMap();}}catch(error){message(error.message,true);}event.target.value='';});
