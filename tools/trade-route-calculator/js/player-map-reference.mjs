// Pure public-reference helpers. No campaign, snapshot mutation or browser storage.
import {planetInformation} from './planet-info.mjs';
export const DEFAULT_ORIGIN=Object.freeze({sector:'Spinward Marches',hex:'1910'});
const safeText=(value,max=240)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u001f\u007f]/u.test(value)?value:null;
export function referenceOrigin(params) {
 if(!params.has('sector')&&!params.has('hex'))return DEFAULT_ORIGIN;
 const sector=safeText(params.get('sector'),80),hex=params.get('hex');
 if(!sector?.trim()||!/^\d{4}$/.test(hex??'')||+hex.slice(0,2)<1||+hex.slice(0,2)>32||+hex.slice(2)<1||+hex.slice(2)>40)throw Error('Invalid map origin. Open a fresh snapshot reference link.');
 return Object.freeze({sector,hex});
}
export function referenceWorld(raw) {
 if(!raw||!Number.isSafeInteger(raw.WorldX)||!Number.isSafeInteger(raw.WorldY)||Math.abs(raw.WorldX)>1000000||Math.abs(raw.WorldY)>1000000)throw Error('Invalid reference coordinates.');
 const sector=safeText(raw.Sector,80),hex=safeText(raw.Hex,4);referenceOrigin(new URLSearchParams({sector:sector??'',hex:hex??''}));
 const data={};for(const key of ['Name','UWP','Bases','Zone','PBG','Remarks','Allegiance','AllegianceName']) {const value=safeText(raw[key]);if(value!==null)data[key]=value;}
 if(!/^[A-HXY?][0-9A-HJ-NP-Z?]{6}-[0-9A-HJ-NP-Z?]$/.test(data.UWP??''))data.UWP='???????-?';
 const x=raw.WorldX,y=raw.WorldY,sx=(x-Number(hex.slice(0,2))+1)/32,sy=(y-Number(hex.slice(2))+40)/40;
 if(!Number.isInteger(sx)||!Number.isInteger(sy))throw Error('Inconsistent reference coordinates.');
 return Object.freeze({id:x+','+y,x,y,hex,sector,name:data.Name||hex,uwp:data.UWP,raw:Object.freeze(data),sectorX:sx,sectorY:sy});
}
export const hexDistance=(a,b)=>{const dx=a.x-b.x,dz=a.y-Math.floor(a.x/2)-b.y+Math.floor(b.x/2);return Math.max(Math.abs(dx),Math.abs(dz),Math.abs(dx+dz));};
export const stagger=world=>[world.x,world.y+((world.x%2+2)%2)*.5];
export function referenceFacts(world,allegiances=new Map()) {
 const info=planetInformation(world),find=(rows,name)=>rows.find(row=>row[0]===name)?.[1]??'Unknown';
 const code=world.raw.Allegiance,knownName=world.raw.AllegianceName||allegiances.get(code);
 return {fields:info.decoded.map(([name,code,meaning])=>[name==='Technology level'?'Tech Level':name==='Law level'?'Law Level':name,code,meaning]),
  zone:find(info.summary,'Travel zone').replace(/^Safe/,'Normal').replace('Not supplied','Unknown'),bases:find(info.system,'Bases').replace('Not supplied','Unknown'),gasGiants:find(info.system,'Gas giants').replace('Not supplied','Unknown'),
  allegiance:code&&code!=='?'?(knownName?knownName+' ('+code+')':code):'Unknown',
  tradeCodes:typeof world.raw.Remarks!=='string'||world.raw.Remarks==='?'?'Unknown':info.remarks.map(([code,meaning])=>meaning==='Unknown / not decoded'?code:code+' — '+meaning).join('; ')||'None recorded'};
}

export function referenceSectorAreas(anchor,radius) {
 const areas=new Map();
 for(let x=anchor.x-radius;x<=anchor.x+radius;x++)for(let y=anchor.y-radius-1;y<=anchor.y+radius+1;y++)if(hexDistance(anchor,{x,y})<=radius){const sx=Math.floor(x/32),sy=Math.floor((y+39)/40);areas.set(sx+','+sy,{x:sx,y:sy});}
 return [...areas.values()];
}
