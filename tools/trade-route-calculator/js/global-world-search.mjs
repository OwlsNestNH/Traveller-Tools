import {searchWorlds,loadWorld} from './map.mjs?v=modal-entry-20261011-51';

export const planetSearchLabel=w=>[w.name,w.subsectorName,w.sector,w.hex].join(' — ');

// A request owns its result list and selection until input changes or the dialog
// closes. Even a transport that ignores abort cannot apply an older response.
export function createPlanetSearchSession({search=searchWorlds,resolve=loadWorld,onBrowse,isCurrent=()=>true,claimIntent=()=>()=>true,render,delay=300}){
 let generation=0,timer=null,controller=null,query='',rows=[],busy=false;
 function invalidate(){generation++;clearTimeout(timer);timer=null;controller?.abort();controller=null;busy=false;return claimIntent();}
 const current=version=>generation===version&&isCurrent();
 function retired(version,ownsIntent){
  if(!current(version))return true;if(ownsIntent())return false;
  busy=false;render({rows,busy,message:'Another selection took priority. Search again or select a planet.'});return true;
 }
 function prompt(){render({rows:[],busy:false,message:'Enter at least 2 characters to search all sectors.'});}
 async function run(){
  const ownsIntent=invalidate();if(!isCurrent())return;
  if(query.length<2){rows=[];prompt();return;}
  const version=generation;controller=new AbortController();rows=[];busy=true;
  render({rows,busy,message:'Searching all sectors…'});
  try{
   const result=await search(query,{signal:controller.signal});if(retired(version,ownsIntent))return;
   rows=result.worlds;busy=false;
   const count=rows.length;
   render({rows,busy,message:(count?count+' planet'+(count===1?'':'s')+' found. Select one to browse.':'No planets found. Try another name.')+(result.limited?' Showing up to 160 matches; refine the name for a more complete result.':'')+(result.missingNames?' Some subsector names are unavailable; their letter is shown.':'')});
  }catch(e){if(retired(version,ownsIntent))return;busy=false;render({rows:[],busy,message:'Could not search planets: '+e.message+'. Try Search planets again.',error:true});}
 }
 function input(value){const ownsIntent=invalidate();query=String(value).trim();rows=[];if(!isCurrent())return;prompt();if(query.length>=2){render({rows:[],busy:false,message:'Ready to search all sectors…'});timer=setTimeout(()=>{if(ownsIntent())void run();},delay);}}
 async function choose(index){
  if(busy||!rows[index]||!isCurrent())return;
  const row=rows[index],ownsIntent=invalidate();const version=generation;busy=true;
  render({rows,busy,message:'Loading '+planetSearchLabel(row)+'…'});
  try{
   const w=await resolve(row.sector,row.hex);if(retired(version,ownsIntent))return;
   await onBrowse(w,()=>current(version)&&ownsIntent());retired(version,ownsIntent);
  }catch(e){if(retired(version,ownsIntent))return;busy=false;render({rows,busy,message:'Could not browse this planet: '+e.message+'. Select it again to retry.',error:true});}
 }
 prompt();return {input,run,choose,cancel:invalidate};
}

export function createGlobalWorldSearch(host,{onBrowse,isCurrent,claimIntent,onDismiss}){
 host.classList.add('global-world-search');
 const heading=document.createElement('h3');heading.textContent='Search all sectors';
 const label=document.createElement('label');label.className='field';label.append('Planet name');
 const input=document.createElement('input');input.type='search';input.autocomplete='off';input.placeholder='e.g. Regina';input.setAttribute('aria-label','Planet name');label.append(input);
 const button=document.createElement('button');button.type='button';button.textContent='Search planets';
 const controls=document.createElement('div');controls.className='planet-search-controls';controls.append(label,button);
 const status=document.createElement('p');status.className='help';status.setAttribute('role','status');
 const results=document.createElement('ul');results.className='planet-search-results';results.setAttribute('aria-label','Planet search results');
 host.append(heading,controls,status,results);
 const session=createPlanetSearchSession({onBrowse,isCurrent,claimIntent,render({rows,busy,message,error=false}){
  status.textContent=message;status.className=error?'help error':'help';results.setAttribute('aria-busy',String(busy));
  results.replaceChildren(...rows.map((w,i)=>{const item=document.createElement('li'),choice=document.createElement('button');choice.type='button';choice.textContent=planetSearchLabel(w);choice.disabled=busy;choice.addEventListener('click',()=>void session.choose(i));item.append(choice);return item;}));
 }});
 input.addEventListener('input',()=>session.input(input.value));
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();void session.run();}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();session.cancel();onDismiss();}});
 button.addEventListener('click',()=>void session.run());
 host.closest('dialog')?.addEventListener('close',()=>session.cancel(),{once:true});
 input.focus();
 return session;
}
