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
const validateSession=s=>S.validate(s,core);
const selectedDistance=s=>s.destination&&(s.current?.sourceKind==='manual'||s.destination.sourceKind==='manual')?s.destination.manualDistance:s.destination?Map.distance(s.current,s.destination):0;
const message=(text,error=false)=>{$('message').textContent=text;$('message').className=error?'error':'';};
let store,chart,core,worlds=[],busy=false,review=null,governmentWorld=null,targetBoundary=null,mapUnavailable=false,editingWorld=null,lastRenderedPhase=null,settingsCommand=null,newCommand=null;
try {
  const response=await fetch('../trade-route-calculator/rules/merchant-prince-1e.json');
  if(!response.ok)throw Error('Verified tax data could not load. Reload to try again.');
  chart=(await response.json()).tax;
  const coreResponse=await fetch('../trade-route-calculator/rules/core-2022.json');
  if(!coreResponse.ok)throw Error('World decoding data could not load.');core=await coreResponse.json();
  $('government').innerHTML=chart.governmentRates.map(r=>`<option value="${esc(r.uwpGovernmentCode)}">${esc(r.label)}</option>`).join('');$('government').value='4';
  store=new SaveBoundary({storage:localStorage,initial:S.initial(),validate:validateSession,exclusive:browserExclusive(navigator)});
  mapUnavailable=!!store.snapshot().current?.dataOutage;
  render();message('Ready. Working alpha rules; keep an exported backup.');
  if(store.snapshot().current)await refreshMap();
}catch(error){message(error.message+' Export the retained save or import a valid alpha backup to recover.',true);$('setup').hidden=true;$('recovery').hidden=false;$('retry').hidden=true;}

function renderMap() {
  if(!store)return;const s=store.snapshot();if(!s.current)return;
  if(s.current.sourceKind==='manual'){$('map').innerHTML='<text x="35" y="240" fill="#d4e2ea">Manual world · no map coordinates supplied</text>';$('map-source').textContent='Manual · distance must be entered explicitly';return;}
  const points=Map.positions(worlds,s.current,Number($('radius').value));
  $('map-source').textContent=worlds[0]?.dataSource||'No nearby data loaded. Refresh to retry.';
  $('map').innerHTML='<g class="hex-grid" aria-hidden="true">'+Map.hexGrid(s.current,Number($('radius').value)).map(cell=>`<polygon points="${cell.vertices.map(v=>v.join(',')).join(' ')}"/>`).join('')+'</g>'+points.map(p=>`<g class="world" role="button" tabindex="0" data-world="${esc(p.world.id)}" aria-label="${esc(p.world.name)}, ${p.distance} parsecs" aria-pressed="${s.destination?.id===p.world.id}"><title>${esc(p.world.name)} · ${esc(p.world.uwp)} · ${p.distance} pc</title><circle cx="${p.x}" cy="${p.y}" r="9"/><text text-anchor="${p.x>375?'end':'start'}" x="${p.x+(p.x>375?-12:12)}" y="${p.y+4}">${esc(p.world.name)}</text></g>`).join('');
}
function render() {
  document.querySelector('main').setAttribute('aria-busy',String(busy));
  const s=store.snapshot(),buying=s.phase==='buy',arrived=s.phase==='arrived';
  if(s.phase==='setup'&&lastRenderedPhase&&lastRenderedPhase!=='setup'){
    worlds=[];mapUnavailable=false;governmentWorld=null;targetBoundary=null;$('gm-view').checked=false;
    for(const form of document.querySelectorAll('form'))form.reset();
    $('roll-mode').value='auto';$('die1').value='3';$('die2').value='4';$('radius').value='4';
    for(const input of $('admin-fields').querySelectorAll('input'))input.value=input.defaultValue;
    $('admin-rush').checked=false;$('admin-confirm').checked=false;
    $('roll-mode').dispatchEvent(new Event('change'));$('map').innerHTML='';
  }
  lastRenderedPhase=s.phase;
  const manualSession=s.current?.sourceKind==='manual';
  $('map-outage').hidden=!mapUnavailable&&!manualSession;$('manual-origin-panel').hidden=!mapUnavailable;$('manual-destination-panel').hidden=(!mapUnavailable&&!manualSession)||!buying;
  $('outage-caption').textContent=mapUnavailable?'Traveller Map connection unavailable. Manual world data is available below; the backup is partial.':'Manual world session retained. Retrying live data will not replace these records or saved quotes.';
  $('setup').hidden=s.phase!=='setup';$('play').hidden=s.phase==='setup';
  $('recovery').hidden=!store.pending&&!store.uncertain;$('retry').hidden=!store.pending||store.uncertain;
  const gm=$('gm-view').checked;$('gm-details').hidden=!gm;$('open-settings').hidden=!gm;
  $('backup-section').hidden=s.phase!=='setup'&&!gm;
  $('summary').innerHTML=`<div>Cash<strong>${money(s.cash)}</strong></div><div>Unpaid bills<strong>${money(s.unpaid)}</strong></div><div>Month ${s.month} · jump ${s.jumps}<strong>${esc(s.current?.name||'Setup')}</strong></div>${gm?`<div>GM target / month<strong>${money(s.settings.monthlyTarget)}</strong></div>`:''}`;
  $('next-form').elements.monthlyTarget.parentElement.hidden=!gm;
  $('world-caption').textContent='Current world: '+(s.current?.name||'—')+(s.current?.dataSource?' · '+s.current.dataSource:'');
  $('destination-caption').textContent=s.destination?'Selected: '+s.destination.name+' · '+selectedDistance(s)+' pc':'Click a nearby world, or enter a manual destination and actual distance.';
  if(s.current&&governmentWorld!==s.current.id+':'+s.current.uwp){$('government').value=s.current.uwp[5];governmentWorld=s.current.id+':'+s.current.uwp;}
  const boundary=s.month+':'+s.settings.monthlyTarget;
  if(boundary!==targetBoundary){$('next-form').elements.monthlyTarget.value=s.settings.monthlyTarget;targetBoundary=boundary;}
  $('planet-info').innerHTML=[s.current,s.destination].filter(Boolean).map((w,index)=>{
    const p=planetInformation(w,{uwp:w.uwp});let codes;
    try{codes=context(w,core).codes.join(' ')||'None';}catch{codes='Unknown — UWP needs review';}
    return `<div class="planet"><strong>${esc(w.name)} · ${esc(w.hex||'')} · ${esc(w.uwp)}</strong><button data-edit-world="${index===0?'current':'destination'}">Edit UWP</button><p>Source: ${esc(w.dataSource||'Recorded world')}<br>Trade codes (UWP): <strong>${esc(codes)}</strong>${w.additionalCodes?.length?'<br>Additional codes (manual): '+esc(w.additionalCodes.join(' ')):''}</p><dl>${p.decoded.map(([name,code,description])=>`<dt>${esc(name)} ${esc(code)}</dt><dd>${esc(description)}</dd>`).join('')}</dl></div>`;
  }).join('');
  $('lot-form').hidden=!buying||!s.supplierConfirmed;$('confirm-supplier').hidden=!buying||!!s.supplierConfirmed;$('travel-form').hidden=!buying;$('sale-section').hidden=!arrived;$('next-section').hidden=s.phase!=='closed';
  $('lots').innerHTML=s.offers.map(l=>`<article class="lot"><strong>${esc(l.name)}</strong><p>${esc(l.tonnes)} t · ${money(l.purchase)} whole lot · ${esc(l.risk)} risk</p><button data-buy="${esc(l.id)}">Buy lot</button><button data-audit="lot:${esc(l.id)}">Audit lot</button></article>`).join('')+s.lots.map(l=>`<article class="lot"><strong>${esc(l.name)} · aboard</strong><p>${esc(l.tonnes)} t · original cost ${money(l.purchase)} · ${esc(l.risk)} risk</p><button data-audit="lot:${esc(l.id)}">Audit lot</button></article>`).join('');
  $('sales').innerHTML=s.lots.map(l=>`<article class="lot"><strong>${esc(l.name)}</strong><p>${l.search?'Buyer search: '+esc(l.search.dice.join(' + '))+' → '+esc(l.search.total)+' · '+(l.search.success?'buyer found':'no buyer; retry policy unresolved'):'Buyer not searched'}</p>${!l.search?`<button data-search="${esc(l.id)}">Find buyer</button><button data-admin="${esc(l.id)}">Data Net buyer</button>`:`<button data-audit="search:${esc(l.id)}">Audit search</button>${l.search.method==='Admin'&&!l.search.success&&l.search.durationMinutes<=60?`<button data-search="${esc(l.id)}">Find buyer</button>`:''}`}${l.search?.success&&!l.quote?`<button data-quote="${esc(l.id)}">Roll sale quote</button>`:''}${l.quote?`<p>Saved quote: <strong>${money(l.quote.gross)}</strong> · dice ${esc(l.quote.dice.join(' + '))} · negotiation ${l.quote.negotiationPP>0?'+':''}${esc(l.quote.negotiationPP)} pp</p><button data-audit="quote:${esc(l.id)}">Audit sale quote</button>`:''}</article>`).join('');
  for(const lot of s.lots.filter(l=>l.worldReviewRequired))$('sales').insertAdjacentHTML('beforeend',`<p>World UWP changed: retained inputs for ${esc(lot.name)} need GM review.${gm?` <button data-ack-world="${esc(lot.id)}">GM: retain established result</button>`:''}</p>`);
  $('accept-sale').disabled=!review||busy||!!store.pending||store.uncertain;
  $('zero-trial').checked=s.settings.zeroLossTrial;
  $('audit').textContent=JSON.stringify(s,(key,value)=>key==='raw'&&typeof value==='object'?undefined:value,2);renderMap();
  for(const button of document.querySelectorAll('button'))if(!['retry','reload','export'].includes(button.id))button.disabled=button.id==='accept-sale'?!review||busy||!!store.pending||store.uncertain:busy||!!store.pending||store.uncertain;
  $('settings-fields').disabled=!S.canEditSettings(s);
  $('save-settings').disabled=busy||!!store.pending||store.uncertain||!S.canEditSettings(s);
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
  if(store.snapshot().current.sourceKind==='manual'){worlds=[];renderMap();return;}
  const current=store.snapshot().current;
  try {const loaded=await Map.loadNearby(current);if(store.snapshot().current?.id===current.id){worlds=loaded;mapUnavailable=loaded.some(w=>w.dataOutage);render();}}
  catch(error){if(error.outage)mapUnavailable=true;render();message('Nearby data unavailable: '+error.message+'. Your trade save is retained.',true);}
}
const manualDice=()=>$('roll-mode').value==='manual'?[Number($('die1').value),Number($('die2').value)]:null;
$('roll-mode').addEventListener('change',()=>{for(const id of ['die1','die2'])$(id).disabled=$('roll-mode').value!=='manual';});
$('roll-mode').dispatchEvent(new Event('change'));
$('setup-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!store)return;const f=fields(event.currentTarget);let world;
  busy=true;render();message('Loading current world…');
  try {world=$('manual-origin-enabled').checked&&mapUnavailable?S.manualWorld({id:'manual:'+crypto.randomUUID(),name:$('manual-origin-name').value,uwp:$('manual-origin-uwp').value,additionalCodes:$('manual-origin-codes').value},core):await Map.loadWorld(f.sector,f.hex);world.lookupAnchor={sector:f.sector,hex:f.hex};if(world.dataOutage)mapUnavailable=true;}catch(error){if(error.outage)mapUnavailable=true;message(error.message,true);busy=false;render();return;}
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
$('manual-destination-form').addEventListener('submit',event=>{event.preventDefault();try{const world=S.manualWorld({id:'manual:'+crypto.randomUUID(),...fields(event.currentTarget)},core);execute('destination:'+crypto.randomUUID(),s=>S.destination(s,world),'Manual destination saved; API recovery will not overwrite it.');}catch(error){message(error.message,true);}});
$('map').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectWorld(event);}});
$('radius').addEventListener('change',renderMap);$('refresh-map').addEventListener('click',refreshMap);
$('retry-live').addEventListener('click',async()=>{if(busy)return;const s=store.snapshot(),f=fields($('setup-form')),anchor=s.lookupAnchor||{sector:f.sector,hex:f.hex};try{const found=await Map.loadWorld(anchor.sector,anchor.hex);mapUnavailable=!!found.dataOutage;render();message(mapUnavailable?'Live data remains unavailable; manual and saved world records retained.':'Live connection available. Existing manual worlds, overrides and quotes retained.');}catch(error){if(error.outage)mapUnavailable=true;render();message(error.message,true);}});
$('planet-info').addEventListener('click',event=>{const target=event.target.closest('[data-edit-world]')?.dataset.editWorld;if(!target)return;editingWorld=target;$('edit-uwp').value=store.snapshot()[target].uwp;$('world-editor').showModal();});
$('cancel-world-edit').addEventListener('click',()=>$('world-editor').close());
$('world-edit-form').addEventListener('submit',async event=>{event.preventDefault();const target=editingWorld,uwp=$('edit-uwp').value;if(await execute('override:'+crypto.randomUUID(),s=>S.overrideWorld(s,target,uwp,core),'Local UWP override saved; established quotes retained for GM review.'))$('world-editor').close();});
$('travel-form').addEventListener('submit',async event=>{
  event.preventDefault();const f=fields(event.currentTarget),s=store.snapshot();
  const distance=selectedDistance(s);
  // Used only by the disabled premium trial; no rate is inferred for receipts.
  f.freightRate=0;
  if(E.compare(distance||0,0)<=0||(!s.destination?.sourceKind&&distance>4)){message('Choose a nearby destination or enter a positive manual actual distance.',true);return;}
  f.actualDistance=distance;
  await execute('arrive:'+(s.jumps+1),draft=>S.arrive(draft,f),'Arrival recorded. Find buyers before rolling sale quotes.');await refreshMap();
});
$('sales').addEventListener('click',event=>{
  const ack=event.target.closest('[data-ack-world]')?.dataset.ackWorld;if(ack&&$('gm-view').checked){execute('world-review:'+crypto.randomUUID(),s=>S.acknowledgeWorldReview(s,ack),'GM review recorded; no reroll or repricing.');return;}
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
$('import').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('Alpha save exceeds 10 MB');const imported=JSON.parse(await file.text());validateSession(imported);if(!store)store=new SaveBoundary({storage:localStorage,initial:S.initial(),validate:validateSession,exclusive:browserExclusive(navigator),allowInvalidExisting:true});const restored=await execute('import:'+crypto.randomUUID(),()=>imported,'Alpha save imported.',{replaceHistory:true});if(restored){$('next-form').elements.monthlyTarget.value=imported.settings.monthlyTarget;governmentWorld=null;worlds=[];render();await refreshMap();}}catch(error){message(error.message,true);}event.target.value='';});

$('open-settings').addEventListener('click',()=>{
  if(!$('gm-view').checked)return;
  const s=store.snapshot();settingsCommand='settings:'+crypto.randomUUID();
  for(const [key,value] of Object.entries(s.settings)){const input=$('settings-form').elements.namedItem(key);if(input)input.value=value;}
  $('settings-form').elements.monthlyTarget.disabled=s.jumps%2!==0;
  $('settings-timing').textContent=S.canEditSettings(s)?(s.jumps%2===0?'Save changes before generating or buying cargo. Monthly target is editable at this month start.':'Save changes before generating or buying cargo. Current month target stays fixed; use the next-month target at the end of a visit.'):'Read-only during this trade. Finish selling and prepare the next departure before saving changes, or use New playtest to start over.';
  render();$('settings-dialog').showModal();
});
$('cancel-settings').addEventListener('click',()=>$('settings-dialog').close());
$('settings-form').addEventListener('submit',async event=>{
  event.preventDefault();const values=fields(event.currentTarget),id=settingsCommand;$('settings-dialog').close();
  await execute(id,s=>S.editSettings(s,values),'Settings saved for future departures and monthly bills; previous records retained.');
});
$('open-new').addEventListener('click',()=>{newCommand='new:'+crypto.randomUUID();$('new-form').reset();$('new-dialog').showModal();});
$('cancel-new').addEventListener('click',()=>$('new-dialog').close());
$('new-export').addEventListener('click',()=>$('export').click());
$('new-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!$('confirm-new').checked)return;const id=newCommand;$('new-dialog').close();
  await execute(id,s=>S.newPlaytest(s,{confirmed:true}),'New playtest prepared. Enter initial settings and choose Start playtest.',{replaceHistory:true});
});
