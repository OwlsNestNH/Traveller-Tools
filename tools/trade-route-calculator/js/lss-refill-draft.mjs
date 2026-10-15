// Draft-only refill editor. No campaign writes or payment actions belong here.
// Integration awaits the recorded fractional-stock and storage decisions.
import * as A from './amounts.mjs';
import {supportAmount,supportStock,supportComplement,anchorSupport} from './life-support.mjs?v=subsector-labels-20261014-89';
import {passengerShip} from './passengers.mjs?v=subsector-labels-20261014-89';
import {used} from './state.mjs?v=subsector-labels-20261014-89';
import {escapeHtml as esc,formatCreditsText} from './display.mjs?v=subsector-labels-20261014-89';

export const wholeSupport=value=>value==null?'Unknown':String(A.floor(supportAmount(value)));
export const nearestSupportTon=value=>value==null?'Unknown':String(A.floor(A.add(supportAmount(value),'0.5')));
const exact=value=>A.auditNumber(supportAmount(value));
const nonnegative=(value,label)=>{const n=supportAmount(value);if(A.cmp(n,0)<0)throw Error(label+' cannot be negative.');return n;};

// Read-only boundary for the future session owner. Convert legacy days only in
// this detached copy; booked people are derived once, never persisted to ship.
export function campaignRefillDraft(state){
 const copy=structuredClone(state);
 anchorSupport(copy.ship,{complementShip:passengerShip(copy)});
 const ship=passengerShip(copy),stock=supportStock(ship);
 if(stock.stockUnits===null)throw Error(stock.migration.reason||'Record actual LSS aboard first.');
 if(stock.internalCapacityUnits===null)throw Error('Enter ship displacement before preparing a refill.');
 const cargoTons=supportAmount(stock.cargoExact),cargo=A.mul(cargoTons,100);
 const available=A.add(A.sub(copy.ship.capacity,used(copy)),cargoTons);
 const draft=createRefillDraft({internal:A.sub(supportAmount(stock.stockUnits),cargo),cargo,internalCapacity:stock.internalCapacityUnits,cargoCapacity:A.mul(available,100),dailyUnits:supportComplement(ship).dailyUnits});
 return {revision:state.revision,actual:state.actual,draft};
}

export function createRefillDraft({internal,cargo,internalCapacity,cargoCapacity,dailyUnits}){
 const draft={internal:exact(nonnegative(internal,'Internal LSS')),cargo:exact(nonnegative(cargo,'Cargo LSS')),internalCapacity:exact(nonnegative(internalCapacity,'Internal capacity')),cargoCapacity:exact(nonnegative(cargoCapacity,'Cargo capacity')),dailyUnits:exact(nonnegative(dailyUnits,'Daily consumption')),reason:'',comfortCredits:'0',comfortNote:'',changed:{internal:false,cargo:false}};
 for(const key of ['internal','cargo'])if(A.cmp(supportAmount(draft[key]),supportAmount(draft[key+'Capacity']))>0)throw Error(key+' stock exceeds capacity.');
 return draft;
}

// An untouched compartment retains its exact fraction, even if its display is 0.
// Edits are requested targets, never a decision to discard stock or charge money.
export function editRefillDraft(draft,action,value){
 const next=structuredClone(draft);
 if(action==='reason'||action==='comfortNote'){next[action]=String(value);return next;}
 if(action==='comfortCredits'||action==='comfort-step'){
  if(action==='comfort-step'&&![-1000,1000].includes(Number(value)))throw Error('Choose a Cr1,000 comfort step.');
  const amount=action==='comfort-step'?A.credit(draft.comfortCredits)+BigInt(value):A.credit(value);
  if(action==='comfortCredits'&&amount<0n)throw Error('Comfort provisions cost cannot be negative.');
  next.comfortCredits=String(amount<0n?0n:amount);return next;
 }
 const key=action==='internal'?'internal':'cargo';
 let target;
 if(action==='fill-cargo'){
  target=A.floor(supportAmount(draft.cargoCapacity));
  if(A.cmp(target,supportAmount(draft.cargo))<=0)return next;
 }
 else if(action==='cargo-step'){
  if(![-1,1].includes(Number(value)))throw Error('Choose a one-LSS step.');
  target=A.add(A.floor(supportAmount(draft.cargo)),Number(value));
  if(A.cmp(target,0)<0)target=A.rat(0);
  const max=A.floor(supportAmount(draft.cargoCapacity));if(A.cmp(target,max)>0)target=A.rat(max);
  if(Number(value)>0&&A.cmp(target,supportAmount(draft.cargo))<=0)return next;
 }else if(action==='internal'||action==='cargo'){
  if(String(value).trim()==='')throw Error('Enter a whole LSS quantity.');
  target=A.dec(value);
 }else throw Error('Unknown refill control.');
 target=A.dec(target);
 if(target.d!==1n||A.cmp(target,0)<0)throw Error('Enter a non-negative whole LSS quantity.');
 if(A.cmp(target,supportAmount(draft[key+'Capacity']))>0)throw Error('The requested '+key+' LSS exceeds available capacity.');
 next[key]=A.auditNumber(target);next.changed[key]=true;return next;
}

export function refillDraftTotals(draft){
 const internal=supportAmount(draft.internal),cargo=supportAmount(draft.cargo),total=A.add(internal,cargo),daily=supportAmount(draft.dailyUnits);
 return {total:A.auditNumber(total),days:A.cmp(daily,0)>0?A.auditNumber(A.div(total,daily)):null,maxDays:A.cmp(daily,0)>0?A.auditNumber(A.div(supportAmount(draft.internalCapacity),daily)):null,cargoTons:A.auditNumber(A.mul(cargo,'0.01'))};
}

// quote is supplied by the owning transaction adapter, not invented by the UI.
// Unresolved pricing remains unavailable and cannot expose a confirmation action.
export function renderRefillDraft(draft,{shipLabel='',quote=null,audit='',blocked='Payment and GM adjustment integration await the storage and fractional-stock decisions.'}={}){
 const totals=refillDraftTotals(draft),cost=quote?.amount==null?null:nonnegative(quote.amount,'Refill cost');
 const button=(label,action,extra='')=>`<button type="button" data-refill-action="${action}" ${extra}>${label}</button>`;
 const value=key=>wholeSupport(draft[key]);
 return `<section class="lss-refill" aria-label="Life support refill draft">
 <div class="lss-top">${button('← Back to Overview','cancel')}${button('Audit','audit')}</div>
 <h2>Life support</h2><p>${esc(shipLabel)}</p>
 <div class="lss-aboard"><span>LSS aboard</span><strong>${wholeSupport(totals.total)}</strong></div>
 <div class="lss-metrics"><div><span>Internal / max</span><strong>${value('internal')} / ${value('internalCapacity')}</strong></div><div><span>Days supported / max</span><strong>${wholeSupport(totals.days)} / ${wholeSupport(totals.maxDays)}</strong></div></div>
 <h3>Refill supplies</h3><label for="lss-internal">Normal storage <span>Set normal storage target</span></label>
 <div class="lss-target"><input id="lss-internal" data-refill-input="internal" type="range" min="0" max="${value('internalCapacity')}" step="1" value="${value('internal')}"><output for="lss-internal">${value('internal')} LSS</output></div>
 <div class="lss-range-labels"><span>0 LSS</span><span>${value('internalCapacity')} LSS</span></div>
 <div class="lss-cargo"><label for="lss-cargo">Cargo LSS<span>Independent of normal storage</span></label><div class="lss-stepper">${button('−','minus','aria-label="Remove one cargo LSS from draft"')}<input id="lss-cargo" data-refill-input="cargo" type="number" min="0" max="${value('cargoCapacity')}" step="1" value="${value('cargo')}">${button('+','plus','aria-label="Add one cargo LSS to draft"')}<span>LSS</span></div></div>
 <div class="lss-capacity"><span>Cargo available ${nearestSupportTon(A.mul(A.sub(supportAmount(draft.cargoCapacity),supportAmount(draft.cargo)),'0.01'))} t</span>${button('Fill available cargo','fill-cargo')}</div>
 <p class="lss-overflow">Cargo overflow <strong>${nearestSupportTon(totals.cargoTons)} t</strong></p>
 <label for="lss-reason">Reason (optional)</label><input id="lss-reason" data-refill-input="reason" value="${esc(draft.reason)}">
 <details class="lss-comfort" ${A.credit(draft.comfortCredits)>0n?'open':''}><summary>Extra provisions — comfort spending</summary><div class="lss-stepper">${button('−Cr 1,000','comfort-minus')}<label for="lss-comfort-cost">One-time comfort cost — Cr<input id="lss-comfort-cost" data-refill-input="comfortCredits" type="number" min="0" step="1" value="${esc(draft.comfortCredits)}"></label>${button('+Cr 1,000','comfort-plus')}</div><label for="lss-comfort-note">Comfort provisions note (required when spending)</label><input id="lss-comfort-note" data-refill-input="comfortNote" value="${esc(draft.comfortNote)}"><p>Cost only. No additional LSS, days or cargo space.</p></details>
 <div class="lss-total" aria-live="polite"><span>TOTAL refill cost</span><strong>${cost===null?'Unavailable':formatCreditsText(String(A.floor(A.add(cost,'0.5'))))}</strong><small>Updates with normal storage and cargo</small></div>
 ${blocked?'<p class="lss-blocked" role="status">'+esc(blocked)+'</p>':''}
 <div class="lss-actions">${button('Cancel','cancel')}${button('Confirm Refill','confirm',blocked||cost===null?'disabled':'class="primary"')}</div>
 ${button('GM Adjustment','gm',blocked?'disabled':'')}<p>Change supplies aboard — no purchase</p>
 <details class="lss-audit"><summary>Audit</summary>${audit||'<p>Draft targets only. Existing campaign quantities and Credits are unchanged.</p>'}</details>
 </section>`;
}
