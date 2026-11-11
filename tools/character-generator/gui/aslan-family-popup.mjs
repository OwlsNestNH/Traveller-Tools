export function aslanFamilyDie(value) {
  const result=Number.isInteger(value);
  const pips = {1:[[50,50]],2:[[27,27],[73,73]],3:[[27,27],[50,50],[73,73]],4:[[27,27],[73,27],[27,73],[73,73]],5:[[27,27],[73,27],[50,50],[27,73],[73,73]],6:[[27,25],[73,25],[27,50],[73,50],[27,75],[73,75]]};
  return result ? '<svg class="aslan-family-die" viewBox="0 0 100 100" aria-hidden="true"><rect x="3" y="3" width="94" height="94" rx="16" fill="none" stroke="currentColor" stroke-width="5"/>' + (pips[value] ?? []).map(([x,y]) => '<circle cx="' + x + '" cy="' + y + '" r="8" fill="currentColor"/>').join('') + '</svg>' : '<svg class="aslan-family-mystery" viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><path d="M100 10 185 48 185 147 100 188 15 147 15 48Z M15 48 100 87 185 48"/></g><g fill="currentColor"><ellipse cx="100" cy="46" rx="14" ry="8"/><ellipse cx="38" cy="90" rx="7" ry="10"/><ellipse cx="161" cy="90" rx="7" ry="10"/><ellipse cx="48" cy="138" rx="7" ry="10"/><ellipse cx="161" cy="138" rx="7" ry="10"/><text x="100" y="164" text-anchor="middle" font-size="86" font-family="system-ui" font-weight="800">?</text></g></svg>';
}

// Presentation only: the caller supplies source-verified narrative and projected
// choices. This component never rolls dice or grants an award on its own.
export function aslanFamilyPopupView(model, {esc}) {
  const result = Number.isInteger(model.die);
  const die = aslanFamilyDie(model.die);
  const choices = model.choices ?? [];
  return '<dialog id="aslan-family-dialog" class="aslan-family-dialog" aria-labelledby="aslan-family-title"><p class="aslan-family-eyebrow">FAMILY BACKGROUND · ' + (result ? 'YOUR RESULT' : 'ROLL 1D') + '</p><h2 id="aslan-family-title" tabindex="-1">Your family background</h2><p class="aslan-family-band">Aslan · ' + esc(model.bandLabel) + '</p>' + (result ? '<div class="aslan-family-roll">' + die + '<strong>You rolled ' + esc(model.die) + '</strong></div><p class="aslan-family-narrative">' + esc(model.narrative) + '</p>' + (model.tagline?'<p class="aslan-family-tagline">'+esc(model.tagline)+'</p>':'') + (model.rerolls?.length>1?'<p class="aslan-family-rerolls">Recorded family rolls: '+model.rerolls.map(r=>esc(r.die)).join(' → ')+'. Source-required replacement rolls are retained in the Full Log.</p>':'') + (model.acquisition?'<p class="aslan-family-acquisition">Independence check: '+model.acquisition.dice.map(esc).join(' + ')+' = '+esc(model.acquisition.total)+'. Needs greater than SOC '+esc(model.acquisition.soc)+'. '+(model.acquisition.success?'Success: Independence 0 recorded.':'Not acquired: no Independence skill awarded.')+'</p>':'') + (choices.length ? '<fieldset class="aslan-family-choices"><legend>Choose one background skill</legend>' + choices.map((choice,index) => '<label><input type="radio" name="aslan-family-choice" value="' + index + '"><span>' + esc(choice.label) + '</span></label>').join('') + '</fieldset>' : '<p class="aslan-family-award">' + esc(model.awardSummary ?? '') + '</p>') + '<div class="aslan-family-result-footer"><p>Family background roll: ' + esc(model.die) + ' · ' + esc(model.resultLabel) + '</p><p id="aslan-family-choice-status" aria-live="polite">' + (choices.length ? 'Choose a skill to continue.' : '') + '</p></div><footer><p>AoCS1 Update 2026, pp. 15–17</p><button type="button" id="aslan-family-continue"' + (choices.length ? ' disabled' : '') + '>Continue <span aria-hidden="true">→</span></button></footer>' : '<div class="aslan-family-ready">' + die + '<h3>Ready to discover your<br>family background?</h3><p>Press Roll when you’re ready.</p><button type="button" id="aslan-family-roll" aria-label="Roll 1D for family background">Roll</button><p class="aslan-family-hint">Your roll number and result will appear here.</p></div><footer><p>AoCS1 Update 2026, pp. 15–17</p></footer>') + '<p id="aslan-family-error" role="alert"></p></dialog>';
}

export function mountAslanFamilyPopup(root, {onRoll, onContinue, onChooseClan, onToggleGM}) {
  const dialog = root.querySelector('#aslan-family-dialog');
  if (!dialog) return;
  let pending = false;
  const act = async callback => {
    if (pending) return;
    pending = true;
    const buttons = [...dialog.querySelectorAll('button')];
    const disabled = buttons.map(button => button.disabled);
    buttons.forEach(button => { button.disabled = true; });
    try { await callback(); }
    catch (error) { const target=root.querySelector('#aslan-family-error');if(target){target.textContent=error.message;target.tabIndex=-1;target.focus();} }
    finally { pending = false; buttons.forEach((button,index) => { button.disabled = disabled[index]; }); }
  };
  dialog.addEventListener('cancel', event => event.preventDefault());
  dialog.querySelector('#aslan-family-roll')?.addEventListener('click', () => act(onRoll));
  dialog.querySelector('#aslan-family-continue')?.addEventListener('click', () => {
    const input = dialog.querySelector('input:checked');
    if (dialog.querySelector('input') && !input) return;
    return act(() => onContinue(input ? Number(input.value) : null));
  });
  dialog.querySelector('#aslan-clan-record')?.addEventListener('click',()=>act(()=>onChooseClan({name:dialog.querySelector('#aslan-clan-name').value,scope:dialog.querySelector('#aslan-clan-scope').value,reason:dialog.querySelector('#aslan-origin-reason').value})));
  dialog.querySelector('#aslan-clan-gm')?.addEventListener('change',event=>act(()=>onToggleGM(event.target.checked)));
  dialog.addEventListener('change', event => {
    if (!event.target.matches('[name="aslan-family-choice"]') || pending) return;
    dialog.querySelector('#aslan-family-continue').disabled = false;
    dialog.querySelector('#aslan-family-choice-status').textContent = event.target.nextElementSibling.textContent + ' selected';
  });
  dialog.showModal();
  const focus=dialog.querySelector('#aslan-family-roll')??dialog.querySelector('#aslan-family-title');
  if(focus){if(focus.tagName==='H2')focus.tabIndex=-1;focus.focus({preventScroll:true});}
  dialog.scrollTop=0;
}
