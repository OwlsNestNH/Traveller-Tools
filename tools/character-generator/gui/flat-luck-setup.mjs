// Explicit setup action only: rendering or importing a save never changes selections.
export function flatLuckSetupView(state,infoButton){
 return '<div class="opening-house-rule" id="flat-luck-house-rule">'+infoButton('flatLuck')+'<input id="setup-flat-luck" name="flatLuck" type="checkbox"'+(state.config?.flatLuck?' checked':'')+'><label for="setup-flat-luck">Start Luck at 6</label></div>';
}
export function syncFlatLuckSelection(form){
 if(!form?.elements.flatLuck?.checked)return false;
 const luck=form.querySelector('[name=extras][value=LCK]');
 if(!luck||luck.disabled)return false;
 const changed=!luck.checked;luck.checked=true;return changed;
}
