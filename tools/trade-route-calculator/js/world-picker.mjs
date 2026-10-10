import {sectors,sectorCatalog,subsectorForHex,loadWorld} from './map.mjs?v=undo-completion-20261010-43';

const RECENTS_KEY='traveller-trade-route-calculator:recent-worlds:v1';
let recentMemory=[];
function recentWorlds(){
 try{const rows=JSON.parse(localStorage.getItem(RECENTS_KEY)||'[]');if(Array.isArray(rows))recentMemory=rows.filter(w=>typeof w?.sector==='string'&&typeof w?.name==='string'&&/^\d{4}$/.test(w?.hex)).slice(0,10);}catch{}
 return recentMemory;
}
export function rememberWorld(w){
 recentMemory=[{name:w.name,sector:w.sector,hex:w.hex},...recentWorlds().filter(x=>x.sector!==w.sector||x.hex!==w.hex)].slice(0,10);
 try{localStorage.setItem(RECENTS_KEY,JSON.stringify(recentMemory));}catch{/* Optional shortcut must not block a world lookup. */}
}

// Native selects keep keyboard and mobile behavior; adjacent search boxes filter their options.
export function createWorldPicker(host,{initial=null,title='Choose world'}={}){
 host.classList.add('world-picker');
 const heading=document.createElement('h3');heading.textContent=title;host.append(heading);
 const recentLabel=document.createElement('label');recentLabel.className='field';recentLabel.append('Recent worlds');const recent=document.createElement('select');recent.setAttribute('aria-label','Recent worlds');recentLabel.append(recent);host.append(recentLabel);
 const recentList=recentWorlds();recent.add(new Option('Choose a recent world…',''));recentList.forEach((w,i)=>recent.add(new Option(w.name+' · '+w.sector+' · '+w.hex,String(i))));recent.disabled=!recentList.length;
 const grid=document.createElement('div');grid.className='world-picker-grid';host.append(grid);
 function control(label){
  const wrap=document.createElement('div');wrap.className='world-picker-control';
  const searchLabel=document.createElement('label');searchLabel.className='field';searchLabel.append('Search '+label.toLowerCase()+'s');
  const search=document.createElement('input');search.type='search';search.setAttribute('aria-label','Search '+label.toLowerCase()+'s');search.placeholder='Type to filter…';search.autocomplete='off';search.disabled=true;searchLabel.append(search);
  const selectLabel=document.createElement('label');selectLabel.className='field';selectLabel.append(label);
  const select=document.createElement('select');select.setAttribute('aria-label',label);select.disabled=true;selectLabel.append(select);wrap.append(searchLabel,selectLabel);grid.append(wrap);
  return {search,select};
 }
 const sector=control('Sector'),subsector=control('Subsector'),world=control('World');
 const summary=document.createElement('p');summary.className='picker-selection help';summary.setAttribute('aria-live','polite');
 const status=document.createElement('p');status.className='help';status.setAttribute('role','status');
 const retry=document.createElement('button');retry.type='button';retry.textContent='Retry loading';retry.hidden=true;
 host.append(summary,status,retry);
 let sectorList=[],catalog=null,version=0,selected=null,loading=true;
 function options(control,rows,value,placeholder){
  control.select.replaceChildren(new Option(placeholder,''));
  for(const row of rows)control.select.add(new Option(row.label,row.value));
  control.select.value=rows.some(r=>r.value===value)?value:'';
 }
 const matches=(text,input)=>text.toLowerCase().includes(input.value.trim().toLowerCase());
 function clearWorld(){selected=null;summary.textContent='Hex: — (filled automatically when a world is selected)';}
 function clear(control,label){control.search.value='';control.search.disabled=true;control.select.disabled=true;options(control,[],'',label);}
 function showWorlds(value=''){
  clearWorld();
  const rows=catalog?.worlds.filter(w=>w.subsector===subsector.select.value)||[];
  world.search.disabled=!subsector.select.value;world.select.disabled=!subsector.select.value;
  options(world,rows.filter(w=>matches(w.name+' '+w.hex,world.search)).map(w=>({value:w.hex,label:w.name+' · '+w.hex})),value,rows.length?'Choose world…':'No worlds in this subsector');
  chooseWorld();
 }
 function chooseWorld(){
  selected=catalog?.worlds.find(w=>w.hex===world.select.value&&w.subsector===subsector.select.value)||null;
  summary.textContent=selected?selected.name+' · '+selected.sector+' · Hex '+selected.hex:'Hex: — (filled automatically when a world is selected)';
 }
 function showSubsectors(value=''){
  options(subsector,catalog.subsectors.filter(s=>matches(s.name+' '+s.index,subsector.search)).map(s=>({value:s.index,label:s.name+' · '+s.index})),value,'Choose subsector…');
  subsector.search.disabled=false;subsector.select.disabled=false;
 }
 function showSectors(value=''){
  options(sector,sectorList.filter(s=>matches(s.aliases.join(' '),sector.search)).map(s=>({value:s.name,label:s.name})),value,'Choose sector…');
 }
 async function chooseSector(preselect=null){
  const request=++version,name=sector.select.value;
  loading=!!name;catalog=null;clear(subsector,'Choose sector first');clear(world,'Choose subsector first');clearWorld();retry.hidden=true;status.textContent=name?'Loading subsectors and worlds…':'Choose a sector.';
  if(!name)return;
  try{
   const result=await sectorCatalog(name);if(request!==version)return;
   catalog=result;loading=false;showSubsectors(preselect?.hex?subsectorForHex(preselect.hex):(preselect?.subsector||''));
   if(subsector.select.value)showWorlds(preselect?.hex||'');
   status.textContent=result.worlds.length+' worlds available.';
  }catch(e){if(request!==version)return;loading=false;status.textContent='Could not load this sector: '+e.message;retry.hidden=false;}
 }
 sector.search.addEventListener('input',()=>{const old=sector.select.value;showSectors(old);if(sector.select.value!==old)void chooseSector();});
 sector.select.addEventListener('change',()=>void chooseSector());
 subsector.search.addEventListener('input',()=>{const old=subsector.select.value;showSubsectors(old);if(old!==subsector.select.value){world.search.value='';showWorlds();}});
 subsector.select.addEventListener('change',()=>{world.search.value='';showWorlds();});
 world.search.addEventListener('input',()=>showWorlds(world.select.value));world.select.addEventListener('change',chooseWorld);
 async function start(){
  const request=++version;loading=true;retry.hidden=true;status.textContent='Loading sectors…';clearWorld();
  try{
   const list=await sectors();if(request!==version)return;sectorList=list;sector.search.disabled=false;sector.select.disabled=false;
   const match=list.find(s=>s.aliases.some(a=>a.toLowerCase()===(initial?.sector||'').toLowerCase()));
   showSectors(match?.name||'');await chooseSector(match?initial:null);
  }catch(e){if(request!==version)return;loading=false;status.textContent='Could not load sectors: '+e.message;retry.hidden=false;}
 }
 retry.addEventListener('click',()=>{if(sectorList.length)void chooseSector(initial?.sector===sector.select.value?initial:null);else void start();});
 recent.addEventListener('change',async()=>{
  const choice=recentList[Number(recent.value)];if(recent.value===''||!choice)return;
  await ready;
  const match=sectorList.find(s=>s.aliases.some(a=>a.toLowerCase()===choice.sector.toLowerCase()));
  if(!match){status.textContent='This recent sector is not available in the current world list.';return;}
  sector.search.value='';showSectors(match.name);await chooseSector(choice);
 });
 const ready=start();
 return {ready,selection(){if(loading)throw Error('Please wait for the world list to finish loading.');if(!selected)throw Error('Choose a sector, subsector and world.');return {...selected};},async resolve(){const w=this.selection();const resolved=await loadWorld(w.sector,w.hex);rememberWorld(resolved);return resolved;}};
}
