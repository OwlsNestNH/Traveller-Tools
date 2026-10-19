// Standalone reference experiment: never imports campaign/snapshot state or storage.
const root = document, control=root.getElementById('radius'), output=root.getElementById('radius-value');
const status=root.getElementById('map-status'), frame=root.getElementById('map-frame'), details=root.getElementById('world-details');
let generation=0, timer, detailController;
function renderMap() {
  const radius=Number(control.value); if (!Number.isInteger(radius)||radius<0||radius>5) return;
  const current=++generation; clearTimeout(timer); output.value=String(radius); frame.replaceChildren();
  // API full UWP detail requires scale128. Keep native pixels for radii0–3;
  // small screens scroll rather than shrink labels into unreadable text.
  const detailed=radius<=3, scale=detailed?128:48;
  root.getElementById('map-detail-mode').textContent=detailed ? 'Detailed hexes requested. Scroll the map if needed; radius 0 shows the selected hex only.' : 'Wider overview with simpler symbols. Selected-system details remain below or beside the map.';
  status.textContent='Loading radius '+radius+' reference map…';
  const url=new URL('https://travellermap.com/api/jumpmap');
  url.search=new URLSearchParams({sector:'spin',hex:'1910',jump:String(radius),scale:String(scale),style:'print',options:'41904',allhexes:'1'});
  const img=new Image(); img.alt='TravellerMap reference centered on Regina, radius '+radius+' hexes'; img.referrerPolicy='no-referrer';
  let settled=false;
  const failed=()=>{if(current!==generation||settled)return;settled=true;clearTimeout(timer);frame.replaceChildren();status.textContent='Reference map unavailable. Check your connection and retry. Snapshot information is unaffected.';};
  img.onload=()=>{if(current!==generation||settled)return;settled=true;clearTimeout(timer);frame.replaceChildren(img);status.textContent='Reference map loaded · radius '+radius+'.';};
  img.onerror=failed; timer=setTimeout(failed,12000); img.src=url.href;
}
async function loadDetails() {
  detailController?.abort(); const controller=new AbortController(); detailController=controller;
  details.textContent='Loading system details…'; const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch('https://travellermap.com/api/jumpworlds?sector=spin&hex=1910&jump=0',{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok) throw Error('Reference unavailable');
    const raw=await response.text(); if(raw.length>100000) throw Error('Reference too large');
    const data=JSON.parse(raw), world=data?.Worlds?.find(item=>item.Hex==='1910');
    if(!world) throw Error('Missing selected world');
    const field=key=>typeof world[key]==='string'&&world[key].length<=120&&!/[\u0000-\u001f\u007f]/u.test(world[key]) ? world[key] : 'Unknown';
    if(detailController!==controller)return;
    details.textContent='Hex 1910 · UWP '+field('UWP')+' · Bases '+field('Bases')+' · Allegiance '+field('Allegiance')+' · PBG '+field('PBG')+' (last digit: gas giants). Live canonical reference; may differ from GM overrides.';
  } catch {if(detailController===controller)details.textContent='System details unavailable. Regina · Spinward Marches / 1910 remains selected; no snapshot values have been replaced.';}
  finally {clearTimeout(timeout);}
}
control.addEventListener('change',renderMap);
root.getElementById('map-retry').addEventListener('click',()=>{renderMap();loadDetails();});
renderMap();loadDetails();
