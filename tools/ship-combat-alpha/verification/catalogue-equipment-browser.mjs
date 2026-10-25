import assert from 'node:assert/strict';
export async function verifyCatalogueEquipment(page){
 const result=await page.evaluate(async()=>{
  const {designFields,readDesign}=await import('./editor.mjs');
  const {preset}=await import('./catalogue.mjs');
  const {createState,applyCommand,normalizeState}=await import('./engine.mjs');
  const {effectiveDesign}=await import('./setup.mjs');
  const host=document.createElement('section');document.body.append(host);
  const p=preset('drinax-harrier-restored');
  host.innerHTML='<form id="audit-form">'+designFields('audit',p)+'</form>';
  let design=readDesign('audit',p);
  let state=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:p.id,designOverrides:design,name:'Audit',position:{q:0,r:0},velocity:{q:0,r:0}});
  const added=effectiveDesign(state.ships[0]);
  host.innerHTML='<form id="audit-form">'+designFields('audit',added)+'</form>';
  host.querySelector('#audit-design-name').value='Unrelated name edit';
  design=readDesign('audit',added);
  state=applyCommand(state,{type:'set-design',shipId:state.ships[0].id,template:design});
  const saved=effectiveDesign(normalizeState(JSON.parse(JSON.stringify(state))).ships[0]);
  const row=[...host.querySelectorAll('[data-requirement-row]')].find(r=>r.querySelector('input').value==='Fuel Processor');
  row.querySelectorAll('input')[1].value='3';
  const manual=readDesign('audit',saved).record.requirements.find(r=>r.name==='Fuel Processor');
  const inventory=host.querySelector('[data-published-inventory]')?.textContent;
  host.remove();
  return {added:added.record.requirements.find(r=>r.name==='Fuel Processor'),saved:saved.record.requirements.find(r=>r.name==='Fuel Processor'),manual,inventory};
 });
 assert.equal(result.added.source.page,49);assert.equal(result.saved.source.page,49);
 assert.match(result.saved.basis,/calculated/);assert.equal(result.manual.source,null);
 assert.equal(result.manual.sourceReference.source.page,49);assert.equal(result.manual.sourceReference.power,2);
 assert.match(result.inventory,/Particle barbette/);
}
