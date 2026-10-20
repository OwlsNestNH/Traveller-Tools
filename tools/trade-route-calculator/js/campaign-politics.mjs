// Public campaign politics only. Published Traveller Map records stay untouched.
export const MAX_CLAIM_HEXES=512,MAX_ALLEGIANCE_WORLDS=128;
export const DRINAX_PRESET=Object.freeze([Object.freeze([-107,-17]),Object.freeze([-108,-17])]);
const key=([x,y])=>`${x},${y}`;
const coordinate=n=>Number.isSafeInteger(n)&&Math.abs(n)<=32767;
function cells(value,limit){
 if(!Array.isArray(value)||value.length>limit)throw Error('Invalid campaign territory size.');
 const seen=new Set();return Array.from(value,p=>{if(!Array.isArray(p)||p.length!==2||!Array.from(p).every(coordinate))throw Error('Invalid campaign hex coordinate.');const id=key(p);if(seen.has(id))throw Error('Duplicate campaign hex.');seen.add(id);return [...p];}).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
}
export function projectCampaignPolitics(value){
 if(value==null)return null;
 if(typeof value!=='object'||Array.isArray(value)||value.version!==1)throw Error('Unsupported campaign territory format.');
 return {version:1,claims:cells(value.claims,MAX_CLAIM_HEXES),allegiances:cells(value.allegiances,MAX_ALLEGIANCE_WORLDS)};
}
export function campaignAllegiance(value,x,y){return value?.allegiances?.some(p=>p[0]===x&&p[1]===y)?'Drinax':null;}
export function createPoliticsDraft(value){
 let current=projectCampaignPolitics(value)??{version:1,claims:[],allegiances:[]};const history=[];
 const replace=next=>{next=projectCampaignPolitics(next);if(JSON.stringify(next)===JSON.stringify(current))return false;history.push(current);current=next;return true;};
 return {value:()=>structuredClone(current),canUndo:()=>history.length>0,undo(){if(!history.length)return false;current=history.pop();return true;},preset(){return replace({version:1,claims:[...new Map([...current.claims,...DRINAX_PRESET].map(p=>[key(p),p])).values()],allegiances:[...new Map([...current.allegiances,...DRINAX_PRESET].map(p=>[key(p),p])).values()]});},toggle(kind,x,y){if(!['claims','allegiances'].includes(kind)||!coordinate(x)||!coordinate(y))throw Error('Invalid campaign edit.');const exists=current[kind].some(p=>p[0]===x&&p[1]===y);return replace({...current,[kind]:exists?current[kind].filter(p=>p[0]!==x||p[1]!==y):[...current[kind],[x,y]]});}};
}
// Integer corner lattice: exact shared edges cancel, including negative columns.
// No hulls, interpolation, bridging or inferred claims.
const corners=[[2,0],[1,1],[-1,1],[-2,0],[-1,-1],[1,-1]];
export function campaignClaimGeometry(value){
 const claims=projectCampaignPolitics(value)?.claims??[],edges=new Map(),polygons=[];
 for(const [x,y]of claims){const odd=((x%2)+2)%2,points=corners.map(([dx,dy])=>[3*x+dx,2*y+odd+dy]);polygons.push(points);for(let i=0;i<6;i++){const a=points[i],b=points[(i+1)%6],id=[key(a),key(b)].sort().join('|');if(edges.has(id))edges.delete(id);else edges.set(id,[a,b]);}}
 return {polygons,edges:[...edges.values()]};
}
// project accepts Traveller Map x and staggered y, as published territoryMarkup does.
export function campaignTerritoryMarkup(value,project){
 const {polygons,edges}=campaignClaimGeometry(value);if(!polygons.length)return '';
 const point=p=>project(p[0]/3,p[1]/2).join(',');
 const fill=polygons.map(p=>'M'+p.map(point).join('L')+'Z').join('');const border=edges.map(([a,b])=>'M'+point(a)+'L'+point(b)).join('');
 return `<g class="campaign-territory" aria-hidden="true" pointer-events="none"><path class="campaign-territory-fill" d="${fill}" fill="#8754c9" fill-opacity="0.32" stroke="none"/><path class="campaign-territory-border" d="${border}" fill="none" stroke="#d8b4ff" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></g>`;
}
