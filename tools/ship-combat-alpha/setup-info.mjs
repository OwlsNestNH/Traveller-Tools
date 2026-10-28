// Read-only setup explanations use a dialog; settings remain native details.
export function mountSetupInfo(){
 const popup=document.createElement('dialog');popup.id='setup-info-dialog';popup.setAttribute('aria-labelledby','setup-info-title');
 popup.innerHTML='<div class="dialog-shell"><header class="dialog-header"><h2 id="setup-info-title"></h2><button type="button" data-close-info aria-label="Close information">×</button></header><div class="sheet-body" id="setup-info-content"></div><footer class="dialog-footer"><button type="button" data-close-info>Close</button></footer></div>';document.body.append(popup);
 let trigger=null;
 const close=()=>{popup.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});trigger=null;popup.querySelector('#setup-info-content').replaceChildren();};
 popup.addEventListener('cancel',event=>{event.preventDefault();close();});
 popup.addEventListener('click',event=>{const box=popup.getBoundingClientRect();if(event.target.closest('[data-close-info]')||event.target===popup&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom))close();});
 const enhance=()=>{
  if(popup.open&&!trigger?.isConnected)close();
  for(const detail of document.querySelectorAll(':is(#setup-dialog,#ship-sheet,.ship-preview-dialog) details[data-setup-info],:is(#setup-dialog,#ship-sheet,.ship-preview-dialog) details[data-published-inventory]')){
   const summary=detail.querySelector(':scope > summary'),button=document.createElement('button');button.type='button';button.className='setup-info-button';button.textContent='ⓘ '+summary.textContent;button.setAttribute('aria-label',summary.textContent+' information');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',popup.id);
   const content=document.createDocumentFragment();for(const child of [...detail.childNodes])if(child!==summary)content.append(child);
   for(const nested of content.querySelectorAll('details')){const heading=document.createElement('h3'),label=nested.querySelector(':scope > summary');heading.textContent=label.textContent;label.replaceWith(heading);const section=document.createElement('section');section.append(...nested.childNodes);nested.replaceWith(section);}
   button.addEventListener('click',()=>{trigger=button;popup.querySelector('#setup-info-title').textContent=summary.textContent;popup.querySelector('#setup-info-content').replaceChildren(content.cloneNode(true));popup.showModal();popup.querySelector('[data-close-info]').focus();});detail.replaceWith(button);
  }
 };
 new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});enhance();
}
