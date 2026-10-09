import {MAP_GEOMETRY} from './map-geometry.mjs?v=map-first-1';
// Small overlapping map areas; browsing data is deliberately separate from campaign data.
export function camera(anchor,pan,zoom){const scale=50*zoom,x=anchor.x-pan.x/(scale*Math.sqrt(3)/2),y=anchor.y+((anchor.x%2+2)%2)*.5-pan.y/scale;return {x,y};}
export function viewportTiles(anchor,pan,zoom){
 const c=camera(anchor,pan,zoom),rx=MAP_GEOMETRY.halfWidth/(50*zoom*Math.sqrt(3)/2)+1,ry=MAP_GEOMETRY.halfHeight/(50*zoom)+1,out=[];
 for(let x=Math.floor((c.x-rx+8)/16)*16;x<=Math.floor((c.x+rx+8)/16)*16;x+=16)
  for(let y=Math.floor((c.y-ry+8)/16)*16;y<=Math.floor((c.y+ry+8)/16)*16;y+=16)out.push({x,y,key:x+','+y});
 return out.sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y));
}
export class MapAreaCache{
 constructor(fetchArea,onChange){this.fetchArea=fetchArea;this.onChange=onChange;this.cache=new Map();this.inflight=new Set();this.failed=new Map();this.wanted=[];}
 request(tiles){this.wanted=tiles;this.failed.clear();for(const t of tiles)if(this.cache.has(t.key)){const rows=this.cache.get(t.key);this.cache.delete(t.key);this.cache.set(t.key,rows);}this.pump();this.onChange();}
 pump(){
  for(const tile of this.wanted){
   if(this.inflight.size>=2)break;
   if(this.cache.has(tile.key)||this.inflight.has(tile.key)||this.failed.has(tile.key))continue;
   this.inflight.add(tile.key);
   Promise.resolve().then(()=>this.fetchArea(tile)).then(rows=>{
    this.cache.set(tile.key,rows);
    while(this.cache.size>32){const oldest=[...this.cache.keys()].find(key=>!this.wanted.some(t=>t.key===key));if(!oldest)break;this.cache.delete(oldest);}
   }).catch(error=>this.failed.set(tile.key,error.message)).finally(()=>{this.inflight.delete(tile.key);this.pump();this.onChange();});
  }
 }
 get worlds(){return Object.fromEntries(this.wanted.flatMap(t=>this.cache.get(t.key)||[]).map(w=>[w.id,w]));}
 get pending(){return this.wanted.some(t=>!this.cache.has(t.key)&&!this.failed.has(t.key));}
 get error(){return this.wanted.map(t=>this.failed.get(t.key)).find(Boolean);}
}
