// Shared accepted Education behavior: move existing nodes into exclusive bars.
// Native grouping plus a toggle fallback; no commands, storage or content edits.
export function mountRecordBars(root,{sheet,host,groups,notes,name}){
 const previousBar=host.dataset.openBar;
 for(const [id,label,contents] of groups){
  if(!contents.length)continue;
  const bar=root.createElement('details');bar.id=id;bar.dataset.precareerBar='';bar.name=name;
  const summary=root.createElement('summary'),mark=root.createElement('span');mark.setAttribute('aria-hidden','true');mark.textContent='+';summary.append(label+' ',mark);bar.append(summary,...contents);sheet.append(bar);bar.open=previousBar===id;
  const hasNotes=notes&&contents.includes(notes);if(hasNotes)notes.open=bar.open;
  bar.addEventListener('toggle',()=>{if(!bar.isConnected)return;if(hasNotes)notes.open=bar.open;if(bar.open){host.dataset.openBar=id;for(const other of sheet.querySelectorAll(':scope > details[data-precareer-bar]'))if(other!==bar)other.open=false;}else if(host.dataset.openBar===id)delete host.dataset.openBar;});
 }
}
