// Display-only summaries; hiding optional settings never changes their values.
export function setupOptionalSummary(extras=[],gm=false,zhodaniPsi=false){
 return (extras.length?'Optional extras: '+extras.join(', '):'No optional extras')+' · GM changes '+(gm?'on':'off')+(zhodaniPsi?' · Zhodani PSI option on':'');
}
export function syncSetupOptionalSummary(form){
 const summary=form?.querySelector('#setup-optional-summary');if(!summary)return;
 const extras=[...form.querySelectorAll('[name=extras]:checked:not(:disabled)')].map(input=>input.value);
 summary.textContent=setupOptionalSummary(extras,form.elements.gm.checked,!!form.elements.zhodaniPsi?.checked);
}
