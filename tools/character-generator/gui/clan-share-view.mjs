import {shareAwardLabel} from './species-record-labels.mjs';
import {landRedemptionFields} from './aslan-land-view.mjs';
import {clanAssetFields} from './clan-asset-view.mjs';
// Only current holdings, projected eligibility and recorded exchanges are displayed.
export function clanShareSelection(options, kind, lotId) {
  const choice = options?.choices?.find(c => c.id === kind);
  const lots = (options?.lots ?? []).filter(l => choice?.lotIds?.includes(l.id));
  const lot = lots.find(l => l.id === lotId);
  const contacts = (options?.contacts ?? []).filter(c => c.eligibleLotIds?.includes(lotId));
  return {choice, lots, lot, contacts, favour: ['contact', 'ally'].includes(kind)};
}
function selectOptions(choices, esc, selected = '') {
  return choices.map(c => '<option value="' + esc(c.id) + '"' + (selected === c.id ? ' selected' : '') + (c.disabled ? ' disabled' : '') + '>' + esc(c.name) + '</option>').join('');
}
export function clanShareView(state, {esc, button, sourceLabel}) {
  const p = state.clanShareOptions;
  if (!p || !p.balance) return '';
  if (![p.lots,p.choices,p.contacts,p.clans].every(Array.isArray)) return '<p class="warning">The Clan Share choices are unavailable. Preserve your save and log.</p>';
  if (!p.checkpointAvailable) return '<p class="help">Clan Shares held: ' + esc(p.balance) + '. ' + esc(p.checkpointReason) + '</p>';
  const needsLot = p.lots.some(l => l.verificationRequired || l.needsClanVerification);
  const needsContact = p.contacts.some(c => c.verificationRequired);
  const disabled = state.config?.gm ? '' : ' disabled';
  let html = '<details id="clan-share-panel"><summary>Clan Shares · ' + esc(p.balance) + ' unspent</summary><p class="source">' + esc(sourceLabel('aliens',47)) + '</p><p>You may keep shares unspent. Each exchange and its remaining balance stay in the action log.</p>';
  if (state.stage === 'finish') html += '<p class="help">Medical settlement is already recorded. New cash does not automatically repay existing debt.</p>';
  html += '<label>Exchange<select id="clan-share-kind"><option value="">Choose an exchange</option>' + selectOptions(p.choices.map(c => ({id:c.id, name:c.name + (c.available ? '' : ' (unavailable)'), disabled:!c.available})), esc) + '</select></label><p id="clan-share-choice-help" class="help" aria-live="polite"></p><label id="clan-share-lot-field">Share award<select id="clan-share-lot" disabled><option value="">Choose an award</option></select></label><p id="clan-share-lot-help" class="help" aria-live="polite"></p><label id="clan-share-quantity-field">Shares to spend<input id="clan-share-quantity" type="number" min="1" step="1" value="1" disabled></label><label id="clan-share-name-field" hidden>New Contact name or description<input id="clan-share-name" maxlength="120" disabled></label><label id="clan-share-contact-field" hidden>Existing clan Contact<select id="clan-share-contact" disabled><option value="">Choose a Contact</option></select></label><p id="clan-share-contact-help" class="help" aria-live="polite"></p>' + clanAssetFields(state,{esc,button}) + landRedemptionFields(state,{esc}) + button('Record share exchange', 'redeem-clan-shares', '', 'disabled');
  html += '<p class="tiny">Corporations and estate inheritance are still under development.</p>';
  if (needsLot) html += '<details><summary>Verify a share award</summary><p class="help">This records source validity or an issuing clan. It never adds shares or changes the awarded quantity.</p><label>Share award<select id="clan-verify-lot"' + disabled + '><option value="">Choose an award</option>' + selectOptions(p.lots.filter(l => l.verificationRequired || l.needsClanVerification).map(l => ({id:l.id,name:shareAwardLabel(l,state) + ' · ' + l.available + ' held'})),esc) + '</select></label><p id="clan-verify-lot-help" class="help" aria-live="polite"></p><label>Issuing clan<select id="clan-verify-target"' + disabled + '><option value="">Choose a verification</option><option value="__source">Source only; clan unknown</option>' + selectOptions(p.clans,esc) + '<option value="__new">Identify another clan</option></select></label><p id="clan-verify-target-help" class="help" aria-live="polite"></p><label id="clan-verify-new-field" hidden>New clan name<input id="clan-verify-new" maxlength="80" disabled></label><label>Source basis and GM reason<textarea id="clan-verify-reason" rows="3" maxlength="500"' + disabled + '></textarea></label>' + button('Verify recorded share award','verify-clan-share-lot','quiet',disabled) + '</details>';
  if (needsContact) html += '<details><summary>Verify an existing Contact</summary><p class="help">Confirm the existing person belongs to the recorded clan’s upper echelons. This does not create or upgrade a relationship.</p><label>Contact<select id="clan-verify-contact"' + disabled + '><option value="">Choose a Contact</option>' + selectOptions(p.contacts.filter(c => c.verificationRequired).map(c => ({id:c.id,name:c.name + ' · Contact ' + (p.contacts.findIndex(contact=>contact.id===c.id)+1)})),esc) + '</select></label><p id="clan-verify-contact-help" class="help" aria-live="polite"></p><label>Clan<select id="clan-contact-clan"' + disabled + '><option value="">Choose a clan</option>' + selectOptions(p.clans,esc) + '</select></label><p id="clan-contact-clan-help" class="help" aria-live="polite"></p><label>Source basis and GM reason<textarea id="clan-contact-reason" rows="3" maxlength="500"' + disabled + '></textarea></label>' + button('Verify Contact affiliation','verify-clan-contact','quiet',disabled) + '</details>';
  if ((needsLot || needsContact) && !state.config?.gm) html += '<p class="help">GM mode is required for source verification. Known-source cash and Ship Shares do not need a named clan.</p>';
  return html + '</details>';
}
export function clanShareSheet(state, {esc}) {
  const lots = state.character?.clanShareLots ?? [], records = state.character?.clanShareRedemptions ?? [];
  if (!lots.length) return '';
  const total=field=>{if(!lots.every(l=>Number.isSafeInteger(l[field])&&l[field]>=0))return null;const n=lots.reduce((sum,l)=>sum+l[field],0);return Number.isSafeInteger(n)?n:null;};
  const balance=['awarded','available','spent','forfeited'].map(field=>total(field));
  const aggregate=balance.map(n=>n===null?'Not recorded':String(n));
  const labels = {land:'Pending land claim',art:'Art holding',weapons:'Weapon assets',cash:'Cash', 'ship-shares':'Ship Shares', contact:'Clan Contact', ally:'Clan Ally upgrade'};
  return '<div class="sheet-section"><h3>Clan Share record</h3><p class="clan-share-total">All recorded awards: ' + esc(aggregate[0]) + ' awarded; ' + esc(aggregate[1]) + ' unspent; ' + esc(aggregate[2]) + ' exchanged; ' + esc(aggregate[3]) + ' forfeited.</p><h4>Individual awards</h4><ul class="compact-list">' + lots.map(l => '<li><strong>' + esc(shareAwardLabel(l,state)) + '</strong>: ' + esc(l.awarded) + ' awarded; ' + esc(l.available) + ' available; ' + esc(l.spent) + ' exchanged; ' + esc(l.forfeited) + ' forfeited.</li>').join('') + '</ul>' + (records.length ? '<h4>Exchanges</h4><ul class="compact-list">' + records.map(r => '<li>' + esc(r.quantity) + ' share' + (r.quantity === 1 ? '' : 's') + ' → ' + esc(labels[r.kind] ?? r.kind) + (r.outputs.cash ? ': Cr' + esc(r.outputs.cash.toLocaleString()) : '') + (r.outputs.shipShares ? ': ' + esc(r.outputs.shipShares) : '') + (r.outputs.relationshipAfter ? ': ' + esc(r.outputs.relationshipAfter.name) : '') + (r.outputs.assessedValue !== undefined ? ': assessed Cr' + esc(r.outputs.assessedValue.toLocaleString()) + (r.outputs.unusedValue ? '; Cr' + esc(r.outputs.unusedValue.toLocaleString()) + ' unused value surrendered by GM exception' : '') : '') + '.</li>').join('') + '</ul>' : '') + '</div>';
}
