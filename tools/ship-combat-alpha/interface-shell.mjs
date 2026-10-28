// Presentation only: every mutation continues through the existing guarded editors.
export function mountInterfaceShell({getState,onAdd,onLeave,onFocus,canOpen}){
 const $=id=>document.getElementById(id),main=document.querySelector('main');
 document.body.classList.add('interface-shell');
 const top=document.createElement('section');top.id='encounter-header';top.setAttribute('aria-label','Encounter ships and commands');main.prepend(top);
 top.append($('ship-rail'));
 const add=document.createElement('div');add.className='encounter-add';add.append($('add-ship-main'));
 const count=document.createElement('span');count.id='encounter-count';add.append(count);$('ship-rail').append(add);
 const heading=document.querySelector('.map-heading');top.append(heading);
 const focus=document.createElement('button');focus.id='focus-ship';focus.textContent='Focus Ship';focus.addEventListener('click',onFocus);heading.querySelector('.map-tools').prepend(focus);
 const workflowButton=document.createElement('button');workflowButton.id='show-workflow';workflowButton.textContent='Battle workflow';workflowButton.addEventListener('click',()=>{$('battle-workflow').scrollIntoView({block:'nearest'});$('battle-workflow').querySelector('button')?.focus({preventScroll:true});});focus.after(workflowButton);
 top.append($('battle-workflow'));
 const status=$('selected-workspace');$('combat-right').prepend(status);const title=document.createElement('h2');title.className='display-title';title.textContent='Ship Status';status.prepend(title);
 const sizeDisplays=()=>{const top=$('console-frame').getBoundingClientRect().top+scrollY;$('movement-workspace').style.setProperty('--station-height',Math.max(240,innerHeight-top-status.getBoundingClientRect().height-16)+'px');};new ResizeObserver(sizeDisplays).observe(status);new ResizeObserver(sizeDisplays).observe($('console-frame'));sizeDisplays();
 const refresh=()=>{count.textContent=getState().ships.length+' / 10 ships';focus.disabled=!getState().ships.length;};
 new MutationObserver(refresh).observe($('ships'),{childList:true});refresh();
 // The full encounter transaction cannot join an already confirmed initiative
 // sequence. Make that existing boundary explicit; never silently leave a phase.
 const reinforcement=document.createElement('dialog');reinforcement.id='reinforcement-dialog';reinforcement.setAttribute('aria-labelledby','reinforcement-title');reinforcement.innerHTML='<div class="dialog-shell"><header class="dialog-header"><h2 id="reinforcement-title">Add reinforcements</h2></header><div class="sheet-body"><p>The current prototype requires leaving the confirmed workflow before adding ships. Positions, recorded initiative and resources are preserved. Plotted vectors remain plans, but leaving clears the workflow’s declaration sequence.</p><p>After adding reinforcements, record their initiative and confirm the workflow again. Arrival rolls and first-action timing are not automated in this interface stage.</p></div><footer class="dialog-footer"><button type="button" data-cancel>Cancel</button><button type="button" data-continue>Leave workflow and add ship</button></footer></div>';document.body.append(reinforcement);
 reinforcement.querySelector('[data-cancel]').onclick=()=>reinforcement.close();
 reinforcement.querySelector('[data-continue]').onclick=()=>{if(canOpen()&&onLeave()){reinforcement.close();onAdd();}};
 reinforcement.addEventListener('close',()=>$('add-ship-main').focus({preventScroll:true}));
 const openAdd=()=>{const state=getState();if(state.workflow||state.acceleration){if(!canOpen())return;if(!reinforcement.open)reinforcement.showModal();}else onAdd();};
 // Preserve existing section-based editor state and commit/cancel callbacks while
 // giving non-spatial work a large popup. Ship switching remains guarded by
 // the editor transaction, including stale-save rejection.
 for(const [id,cancel] of [['condition-dialog','cancel-condition'],['systems-dialog','cancel-systems']]){
  const section=$(id),modal=document.createElement('dialog');modal.id=id+'-popup';modal.className='action-popup';modal.setAttribute('aria-labelledby',section.getAttribute('aria-labelledby'));section.before(modal);modal.append(section);
  const placePopup=()=>{
   const frame=$('console-frame').getBoundingClientRect(),view=visualViewport,viewLeft=view?.offsetLeft??0,viewTop=view?.offsetTop??0,viewWidth=view?.width??innerWidth,viewHeight=view?.height??innerHeight,desktop=innerWidth>700;
   const width=Math.max(0,Math.min(viewWidth-16,desktop?Math.max(280,frame.width-48):viewWidth-16)),left=Math.max(viewLeft+8,Math.min(desktop?frame.left+24:viewLeft+8,viewLeft+viewWidth-width-8)),top=Math.max(viewTop+16,Math.min(desktop?frame.top+24:viewTop+16,viewTop+viewHeight-320));
   modal.style.setProperty('--action-left',left+'px');modal.style.setProperty('--action-top',top+'px');modal.style.setProperty('--action-width',width+'px');modal.style.setProperty('--action-height',Math.max(0,viewTop+viewHeight-top-16)+'px');
  };
  // Keep the same draft and scrollable form when the available space changes.
  let pendingSize=false;const resizePopup=()=>{if(!modal.open||pendingSize)return;pendingSize=true;requestAnimationFrame(()=>{pendingSize=false;if(modal.open)placePopup();});};
  new ResizeObserver(resizePopup).observe($('console-frame'));window.addEventListener('resize',resizePopup);window.addEventListener('scroll',resizePopup,{passive:true});visualViewport?.addEventListener('resize',resizePopup);visualViewport?.addEventListener('scroll',resizePopup);
  new MutationObserver(()=>{if(!section.hidden&&!modal.open){placePopup();modal.show();}else if(section.hidden&&modal.open)modal.close();}).observe(section,{attributes:true,attributeFilter:['hidden']});
  modal.addEventListener('cancel',event=>{event.preventDefault();$(cancel).click();});
 }
 return {openAdd};
}
