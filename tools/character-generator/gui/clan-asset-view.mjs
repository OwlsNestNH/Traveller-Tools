// UI-only helpers consume the API's bounds; no engine or rules-pack import.
export function clanAssetTotals(quantity, rules, items = []) {
  const shares = Number(quantity), budget = Number.isSafeInteger(shares) && shares > 0 && rules ? shares * rules.valuePerShare : null;
  const valid = items.length > 0 && items.every(i => Number.isSafeInteger(i.quantity) && i.quantity > 0 && Number.isSafeInteger(i.unitCost) && i.unitCost > 0);
  const total = valid ? items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0) : null;
  return {budget, total, unused: budget !== null && total !== null ? budget - total : null};
}
export function clanAssetPayload(kind, fields) {
  if (kind === 'art') return {name:fields.name};
  if (kind !== 'weapons') return {};
  return {items:fields.items,sourceConfirmed:fields.sourceConfirmed,sourceReason:fields.sourceReason,...(fields.lowerValueConfirmed ? {lowerValueAcceptance:{confirmed:true,reason:fields.lowerValueReason}} : {})};
}
export function clanWeaponRow(index, rules, {esc,button}, values = {}) {
  const field=(key,label,attributes='') => '<label>'+label+'<input data-weapon-field="'+key+'" '+attributes+' value="'+esc(values[key]??'')+'"></label>';
  return '<fieldset data-weapon-row><legend>Weapon '+(index+1)+'</legend><div class="form-grid">'+field('name','Weapon name','maxlength="'+rules.nameMaxLength+'"')+field('quantity','Item quantity','type="number" min="'+rules.minItemQuantity+'" max="'+rules.maxItemQuantity+'" step="1"')+field('unitCost','Unit price in credits','type="number" min="'+rules.minUnitCost+'" max="'+rules.maxUnitCost+'" step="1"')+field('tl','Technology level','type="number" min="'+rules.minTL+'" max="'+rules.maxTL+'" step="1"')+field('sourceReference','Book and page','maxlength="'+rules.sourceReferenceMaxLength+'"')+'</div><div class="actions">'+button('Remove weapon '+(index+1),'clan-remove-weapon','quiet','data-index="'+index+'"')+'</div></fieldset>';
}
export function clanAssetFields(state, context) {
  const rules=state.clanShareOptions?.assetRules;
  if(!rules) return '';
  return '<div id="clan-art-fields" hidden><label>Art holding description<input id="clan-art-name" maxlength="'+rules.nameMaxLength+'" disabled></label><p class="help">The recorded value comes from the share exchange. It is not cash or a promised resale price.</p></div><div id="clan-weapon-fields" hidden><p class="help">GM source confirmation is required. No equipment catalog is checked automatically.</p><div id="clan-weapon-items">'+clanWeaponRow(0,rules,context,{quantity:1})+'</div><div class="actions">'+context.button('Add another weapon','clan-add-weapon','quiet')+'</div><p class="tiny">Input bounds are software limits, not published weapon or TL limits.</p><label class="check"><input id="clan-weapons-confirmed" type="checkbox" disabled><span>I verified each weapon, quantity, price, technology level and total against the listed sources.</span></label><label>Source verification and GM reason<textarea id="clan-weapons-reason" rows="3" maxlength="'+rules.reasonMaxLength+'" disabled></textarea></label><div id="clan-lower-value-fields" hidden><p class="warning">The selected weapons are below the share value. Keep the shares or explicitly accept a lower-value GM exception. The unused value is surrendered, with no cash or credit.</p><label class="check"><input id="clan-lower-value-confirmed" type="checkbox" disabled><span>Accept the lower value and surrender the unused value</span></label><label>Reason for the GM exception<textarea id="clan-lower-value-reason" rows="3" maxlength="'+rules.reasonMaxLength+'" disabled></textarea></label></div></div><p id="clan-asset-value" class="help" aria-live="polite" hidden></p>';
}
export function clanAssetSheetDetail(asset,{esc}) {
  if(!asset.redemptionId || !['art','weapon'].includes(asset.category)) return '';
  const method=asset.sourceVerification?.method==='referee-confirmed'?'Referee-confirmed item prices':'Share-derived value';
  return '<div>'+esc(asset.quantity)+' item'+(asset.quantity===1?'':'s')+' · Assessed Cr'+esc(asset.assessedValue.toLocaleString())+(asset.tl!==undefined?' · TL '+esc(asset.tl):'')+'</div><div class="tiny">'+method+'. Not cash or a guaranteed resale price.'+(asset.sourceReference?' '+esc(asset.sourceReference):'')+'</div>';
}
