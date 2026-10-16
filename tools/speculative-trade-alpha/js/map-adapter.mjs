// Reuse existing verified world transport/hex arithmetic without touching its UI/store.
import {loadWorld as liveLoad,nearby as liveNearby,distance,normalize} from '../../trade-route-calculator/js/map.mjs';
export {distance};
export const connectionFailure=error=>error instanceof TypeError||['AbortError','TimeoutError'].includes(error?.name)||/^Traveller Map returned (5\d\d|429)/.test(error?.message||'');
async function bundledBackup(){const r=await fetch(new URL('../data/world-backup.json',import.meta.url));if(!r.ok)throw Error('Bundled backup unavailable');return r.json();}
export function worldData({load=liveLoad,nearby=liveNearby,backup=bundledBackup}={}) {
  const fallback=async()=>{const data=await backup();return data.Worlds.map(raw=>({...normalize(raw),dataSource:`Backup · captured ${data.captured} · ${data.coverage}`}));};
  const outageBackup=async()=>{try{return await fallback();}catch{throw Object.assign(Error('Live Traveller Map unavailable and partial backup could not load; manual world data remains available'),{outage:true});}};
  return {
    async loadWorld(sector,hex){
      try{return {...await load(sector,hex),dataSource:'Live Traveller Map · M1105'};}
      catch(error){if(!connectionFailure(error))throw error;const found=(await outageBackup()).find(w=>w.sector.toLowerCase()===sector.trim().toLowerCase()&&w.hex===hex);if(!found)throw Object.assign(Error(error.message+'. Partial backup has no matching world'),{outage:true});return {...found,dataOutage:true};}
    },
    async loadNearby(world){
      try{return (await nearby(world,4)).filter(w=>distance(world,w)<=4).map(w=>({...w,dataSource:'Live Traveller Map · M1105'}));}
      catch(error){if(!connectionFailure(error))throw error;const all=await outageBackup();if(!all.some(w=>w.id===world.id))throw Object.assign(Error(error.message+'. Partial backup has no verified local coverage'),{outage:true});return all.filter(w=>distance(world,w)<=4).map(w=>({...w,dataOutage:true}));}
    }
  };
}
const adapter=worldData();
export const loadWorld=(...args)=>adapter.loadWorld(...args);
export const loadNearby=(...args)=>adapter.loadNearby(...args);
// Flat-top hexes: adjacent centers are exactly 54 SVG units (one parsec).
const spacing=54,hexRadius=spacing/Math.sqrt(3);
function checkRadius(radius){if(!Number.isInteger(radius)||radius<1||radius>4)throw Error('Map radius must be 1–4 parsecs');}
function project(world,center){
  const offset=w=>w.y+((w.x%2+2)%2)*0.5;
  return {x:250+(world.x-center.x)*hexRadius*1.5,y:250+(offset(world)-offset(center))*spacing};
}
export function positions(worlds,center,radius=4) {
  checkRadius(radius);
  return worlds.filter(w=>distance(center,w)<=radius).map(world=>({world,distance:distance(center,world),...project(world,center)}));
}
export function hexGrid(center,radius=4){
  checkRadius(radius);const cells=[];
  for(let x=center.x-radius;x<=center.x+radius;x++)for(let y=center.y-radius-1;y<=center.y+radius+1;y++){
    const world={x,y};if(distance(center,world)>radius)continue;
    const point=project(world,center);
    const vertices=Array.from({length:6},(_,i)=>{
      const angle=i*Math.PI/3;return [point.x+hexRadius*Math.cos(angle),point.y+hexRadius*Math.sin(angle)];
    });
    cells.push({...point,world,vertices});
  }
  return cells;
}
