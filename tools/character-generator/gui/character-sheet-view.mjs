// Replaceable presentation boundary: validated projection in, detached DOM out.
// No commands, transport, local storage, RNG or mutations belong in this module.
import {characterSheetEventRows} from './character-sheet-history.mjs';
import {formatCharacterAge} from './reeducation-view.mjs';
import {completedTermsView} from './final-sheet-history.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sign=n=>(n>=0?'+':'')+n;
const money=n=>'Cr'+Number(n??0).toLocaleString('en-US');
export function characterSheetHeader(state,catalog){
 const c=state.character,species=catalog.species.find(s=>s.id===c.species)?.name??c.species;
 const stats=Object.entries(c.stats??{}).filter(([key])=>key!=='RITE');
 if(state.stage!=='identity'&&state.config?.extras?.includes('PSI')&&!Object.hasOwn(c.stats??{},'PSI'))stats.push(['PSI','Untested']);
 const variant=c.variant&&c.variant!=='standard'?(catalog.species.find(s=>s.id===c.species)?.variants?.find(v=>v.id===c.variant)?.name??c.variant):null;
 const rite=c.stats?.RITE??c.aslanOrigin?.rite?.modifier;
 return '<div class="traveller-sheet-overview"><div class="traveller-sheet-identity"><strong>'+esc(c.name||'Your Traveller')+'</strong><span>'+esc([species,variant,c.identityGender??c.gender,c.culture==='imperial'?'Imperial upbringing':null,c.homeworld].filter(Boolean).join(' · '))+'</span></div><div class="traveller-sheet-meta"><span>Age '+esc(formatCharacterAge(c.age))+'</span><span>'+esc(c.terms)+' completed terms</span><span>'+esc(money(c.cash))+' cash</span><span>'+esc(money(c.debt))+' debt</span></div><div class="traveller-sheet-stats">'+(stats.length?stats.map(([key,value])=>'<div class="traveller-sheet-stat"><span>'+esc(key)+'</span><strong>'+esc(value)+'</strong><small>'+(state.statDMs?.[key]!==undefined?'DM '+esc(sign(state.statDMs[key])):'Modifier not recorded')+'</small></div>').join(''):'<p>Characteristics have not been recorded yet.</p>')+'</div>'+(rite!==undefined?'<p class="traveller-sheet-rite"><strong>RITE '+esc(sign(rite))+'</strong><span>Use directly for RITE checks.</span></p>':'')+'</div>';
}
export function characterSheetHistoryView(projection,session,catalog){
 const rows=characterSheetEventRows(projection,session,catalog);
 return '<section class="traveller-sheet-history"><h3>Results &amp; decisions</h3><p class="traveller-sheet-help">Recorded outcomes, with their term and source. Superseded branches stay in the full log.</p>'+(rows.length?'<ol class="traveller-sheet-timeline">'+rows.map(row=>'<li><div class="traveller-sheet-entry-heading"><span class="traveller-sheet-when">'+esc(row.termLabel)+'</span><strong>'+esc(row.title)+'</strong></div>'+(row.summary?'<p>'+esc(row.summary)+'</p>':'')+(row.details?.length?'<ul>'+row.details.map(detail=>'<li>'+esc(detail)+'</li>').join('')+'</ul>':'')+(row.rolls?.length?'<p class="traveller-sheet-rolls">'+row.rolls.map(roll=>esc(roll.label+': ['+(roll.values??roll.kept??[]).join(', ')+']'+(roll.kept&&JSON.stringify(roll.kept)!==JSON.stringify(roll.values)?' → keep ['+roll.kept.join(', ')+']':'')+(Number.isFinite(roll.modifier)&&roll.modifier?' '+sign(roll.modifier):'')+' = '+roll.total)).join(' · ')+'</p>':'')+(row.sourceLabel?'<small class="traveller-sheet-source">'+esc(row.sourceLabel)+'</small>':'')+'</li>').join('')+'</ol>':'<p>No results or decisions recorded yet.</p>')+completedTermsView(projection.state,catalog)+'</section>';
}
// Derive provenance only from recorded changes on the current branch.
export function characterSheetSkillAcquisitions(rows,name){
 return rows.flatMap(row=>(row.changes??[]).filter(change=>change.path==='skills.'+name).map(change=>{
  const progression=Number.isInteger(change.after)?(Number.isInteger(change.before)?'Level/'+change.before+' → Level/'+change.after:'Gained Level/'+change.after):'Level change recorded';
  return row.title+' · '+row.termLabel+' · '+progression;
 }));
}
export function renderCharacterSheet({document,projection,session,catalog,record}){
 // Preserve the canonical live record's species, source-assisted and asset
 // sections. Its interactive controls have already been removed by the host.
 for(const node of record.querySelectorAll('.statistics-identity, .sheet-meta, .sheet-facts, .stats, figure, h2'))node.remove();
 for(const section of record.querySelectorAll('.sheet-section'))if(!section.textContent.trim())section.remove();
 const rows=characterSheetEventRows(projection,session,catalog);
 const skills=Object.entries(projection.state.character.skills??{}).sort(([a],[b])=>a.localeCompare(b));
 const skillSection=[...record.querySelectorAll('.sheet-section')].find(section=>section.querySelector('h3')?.textContent==='Skills');
 for(const [index,li] of [...(skillSection?.querySelectorAll('li')??[])].entries()){
  const name=skills[index]?.[0];if(!name)continue;
  const acquisitions=characterSheetSkillAcquisitions(rows,name);
  for(const label of acquisitions.length?acquisitions:['Acquisition not recorded']){
   const badge=document.createElement('small');badge.className='traveller-sheet-acquired';badge.textContent=label;li.append(badge);
  }
 }
 const heading=document.createElement('h3');heading.textContent='Current results';record.prepend(heading);
 record.classList.add('traveller-sheet-current');
 const root=document.createElement('div');root.className='traveller-sheet';
 root.innerHTML='<nav class="traveller-sheet-jumps" aria-label="Character sheet sections"><a href="#traveller-sheet-current">Current</a><a href="#traveller-sheet-history">History</a></nav>'+characterSheetHeader(projection.state,catalog)+'<div class="traveller-sheet-columns"></div>';
 const history=document.createElement('div');history.innerHTML=characterSheetHistoryView(projection,session,catalog);
 root.querySelector('.traveller-sheet-overview').id='traveller-sheet-current';
 history.firstElementChild.id='traveller-sheet-history';
 for(const link of root.querySelectorAll('.traveller-sheet-jumps a'))link.addEventListener('click',event=>{
  event.preventDefault();const target=root.querySelector(link.getAttribute('href'));
  target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'start'});
 });
 root.querySelector('.traveller-sheet-columns').append(record,history.firstElementChild);
 return root;
}
