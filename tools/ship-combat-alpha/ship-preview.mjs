import {ICONS,SIDES,iconFor,fallbackGlyph} from './appearance.mjs';
import {escapeHTML as esc} from './ui-format.mjs';

export function shipSilhouette(ship){
 const icon=iconFor(ship),art=ICONS[icon],color=SIDES[ship.appearance?.side??'A']?.color??SIDES.A.color;
 return `<svg class="sheet-silhouette" viewBox="-55 -40 110 80" role="img" aria-label="${esc(art.label)}">${art.file?`<image href="assets/ships/${esc(art.file)}" x="-40" y="-35" width="80" height="70"/>`:fallbackGlyph(icon,color)}</svg>`;
}

// The preview owns no draft state: moving its content never submits or rebuilds the editor.
export function mountShipPreview({button,content,owner}){
 const dialog=document.createElement('dialog');dialog.className='ship-preview-dialog';dialog.setAttribute('aria-label','Ship preview');
 dialog.innerHTML='<div class="dialog-shell"><header class="dialog-header"><h2>Ship preview</h2><button type="button" data-close-preview>Close</button></header><div class="sheet-body"></div></div>';
 dialog.querySelector('.sheet-body').append(content);document.body.append(dialog);
 let scroll=[];
 const close=()=>{if(dialog.open)dialog.close();for(const [el,top,left] of scroll){el.scrollTop=top;el.scrollLeft=left;}if(button.isConnected)button.focus({preventScroll:true});};
 button.addEventListener('click',()=>{scroll=[];for(let el=button.parentElement;el;el=el.parentElement)scroll.push([el,el.scrollTop,el.scrollLeft]);dialog.showModal();dialog.querySelector('button').focus();});
 dialog.querySelector('[data-close-preview]').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();close();});
 const ownerClosed=()=>{if(dialog.open)dialog.close();};owner?.addEventListener('close',ownerClosed);
 return {close,dialog,destroy(){owner?.removeEventListener('close',ownerClosed);if(dialog.open)dialog.close();dialog.remove();}};
}
