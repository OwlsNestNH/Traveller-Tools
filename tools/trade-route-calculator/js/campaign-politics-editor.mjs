import {createPoliticsDraft,campaignTerritoryMarkup,campaignAllegiance} from './campaign-politics.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const odd=x=>((x%2)+2)%2;
export function mountPoliticsEditor(root,{value,center,worlds=[],loadWorlds,isCurrent}){
 const draft=createPoliticsDraft(value);let at={...center},known=worlds.slice(),generation=0,pending=false,notice='';
 const controls=document.createElement('fieldset');controls.className='campaign-editor';root.append(controls);
 const button=(label,action,arg='')=>`<button type="button" data-politics-action="${action}" data-arg="${arg}">${label}</button>`;
 let columns=4,width=630,rows=3,height=520;
 const project=(x,y)=>[width/2+(x-at.x)*70*Math.sqrt(3)/2,height/2+(y-at.y-odd(at.x)*.5)*70];
 function paint(){
  if(!isCurrent())return;
  const allegianceOpen=controls.querySelector('details')?.open;
  const focused=controls.contains(document.activeElement)?{action:document.activeElement.dataset.politicsAction,arg:document.activeElement.dataset.arg}:null;
  columns=root.clientWidth<500?1:4;width=columns===1?230:630;rows=columns===1?2:3;height=columns===1?380:520;
  const v=draft.value(),claims=new Set(v.claims.map(p=>p.join(','))),cells=[];
  for(let x=at.x-columns;x<=at.x+columns;x++)for(let y=at.y-rows;y<=at.y+rows;y++){
   const [px,py]=project(x,y+odd(x)*.5),id=`${x},${y}`,w=known.find(w=>w.x===x&&w.y===y),name=w?.name??'No loaded world';
   const points=Array.from({length:6},(_,i)=>[px+70/Math.sqrt(3)*Math.cos(i*Math.PI/3),py+70/Math.sqrt(3)*Math.sin(i*Math.PI/3)].join(',')).join(' ');
   cells.push(`<g role="button" tabindex="0" aria-label="${claims.has(id)?'Unclaim':'Claim'} ${esc(name)} at ${id}" aria-pressed="${claims.has(id)}" data-politics-action="claim" data-arg="${id}"><polygon points="${points}" fill="transparent" stroke="#526475" stroke-width="1"/>${w?`<circle cx="${px}" cy="${py}" r="4" fill="#fff"/>`:''}<text x="${px}" y="${py+17}" text-anchor="middle">${esc(w?(w.name.length>9?w.name.slice(0,8)+'…':w.name):'Empty / ?')}</text><text x="${px}" y="${py-15}" text-anchor="middle">${esc(w?.hex??id)}</text></g>`);
  }
  const visible=known.filter(w=>Math.abs(w.x-at.x)<=columns&&Math.abs(w.y-at.y)<=rows);
  controls.innerHTML=`<p>Click a hex to claim or unclaim it. Only the selected hex changes; no automatic filling. These public campaign claims appear in new player links.</p><div class="row">${button('Start with Drinax + Asim','preset')}${button('Undo edit','undo')}${button('←','pan','-3,0')}${button('↑','pan','0,-3')}${button('↓','pan','0,3')}${button('→','pan','3,0')}</div><p role="status">${v.claims.length} claimed hexes · ${v.allegiances.length} world allegiances. ${esc(pending?'Loading reference worlds…':notice)}</p><svg class="campaign-editor-map" viewBox="0 0 ${width} ${height}" role="group" aria-label="Campaign territory draft">${campaignTerritoryMarkup(v,project)}${cells.join('')}</svg><details ${allegianceOpen?'open':''}><summary>World allegiance (separate from territory)</summary><p>Changing a claim does not change a world's allegiance. Published allegiance is always preserved.</p><div class="campaign-allegiances">${visible.map(w=>`<button type="button" data-politics-action="allegiance" data-arg="${w.x},${w.y}" aria-pressed="${!!campaignAllegiance(v,w.x,w.y)}">${esc(w.name)} · Published: ${esc(w.raw?.Allegiance??'?')} · Campaign: ${campaignAllegiance(v,w.x,w.y)?'Drinax':'unchanged'}</button>`).join('')||'<p>No loaded worlds in this view.</p>'}</div></details><p class="help">Violet: campaign claims. Lavender: exact outside edges, including holes. Save commits; Cancel discards. Empty/unknown hexes can be claimed manually; reference loading never claims space.</p>`;
  controls.querySelector('[data-politics-action="undo"]').disabled=!draft.canUndo();
  if(focused)Array.from(controls.querySelectorAll('[data-politics-action]')).find(el=>el.dataset.politicsAction===focused.action&&el.dataset.arg===focused.arg)?.focus({preventScroll:true});
 }
 async function load(){const token=++generation;pending=true;paint();try{const rows=await loadWorlds(at);if(token!==generation||!isCurrent())return;known=rows;notice='';}catch{if(token!==generation||!isCurrent())return;notice='Reference unavailable. Existing labels retained; claims can still be edited.';}finally{if(token===generation){pending=false;paint();}}}
 function action(event){const target=event.target.closest('[data-politics-action]');if(!target||!controls.contains(target)||!isCurrent()||controls.disabled)return;event.preventDefault();event.stopPropagation();const type=target.dataset.politicsAction,[x,y]=(target.dataset.arg||'').split(',').map(Number);try{if(type==='claim'||type==='allegiance')draft.toggle(type==='claim'?'claims':'allegiances',x,y);else if(type==='undo')draft.undo();else if(type==='preset'){draft.preset();at={x:-107,y:-17};load();}else if(type==='pan'){at={x:Math.max(-32760,Math.min(32760,at.x+x)),y:Math.max(-32760,Math.min(32760,at.y+y))};load();}notice='';paint();}catch(e){notice=e.message;paint();}}
 controls.addEventListener('click',action);controls.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('g[data-politics-action]'))action(e);});
 paint();load();return {value:()=>draft.value(),lock(){controls.disabled=true;},unlock(){controls.disabled=false;},center(world){if(!isCurrent())return;at={...world};load();},dispose(){generation++;controls.remove();}};
}
