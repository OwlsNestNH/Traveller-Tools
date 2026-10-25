// Rendering geometry only. A single affine camera preserves proportional space.
export const HEX_SIZE=26,GRID_LIMIT=1800,GRID_LIMIT_AT_100=3600;
export const toWorld=({q,r})=>({x:HEX_SIZE*Math.sqrt(3)*(q+r/2),y:HEX_SIZE*1.5*r});
export function fromWorld({x,y}){
 const q=(Math.sqrt(3)/3*x-y/3)/HEX_SIZE,r=2*y/(3*HEX_SIZE),cube=[q,-q-r,r],rounded=cube.map(Math.round),delta=cube.map((n,i)=>Math.abs(n-rounded[i]));
 const i=delta.indexOf(Math.max(...delta));rounded[i]=-rounded[(i+1)%3]-rounded[(i+2)%3];return {q:rounded[0]||0,r:rounded[2]||0};
}
export function visibleGrid(camera,width=1200,height=760){
 // Test the area BEFORE any enumeration. Very distant views never allocate
 // millions of cells; exact target legality stays in the engine.
 const corners=[[-width/2,-height/2],[width/2,-height/2],[-width/2,height/2],[width/2,height/2]].map(([x,y])=>fromWorld({x:(x-camera.x)/camera.zoom,y:(y-camera.y)/camera.zoom}));
 const q0=Math.min(...corners.map(p=>p.q))-2,q1=Math.max(...corners.map(p=>p.q))+2,r0=Math.min(...corners.map(p=>p.r))-2,r1=Math.max(...corners.map(p=>p.r))+2;
 const limit=camera.zoom>=1?GRID_LIMIT_AT_100:GRID_LIMIT;
 if(camera.zoom<.32||(q1-q0+1)*(r1-r0+1)>limit)return {cells:[],limited:true};
 const cells=[];for(let q=q0;q<=q1;q++)for(let r=r0;r<=r1;r++)cells.push({q,r});return {cells,limited:false};
}
export function fitCamera(points,width=1200,height=760,padding=100){
 if(!points.length)return {zoom:1,x:0,y:0};
 const pixels=points.map(toWorld),xs=pixels.map(p=>p.x),ys=pixels.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 const zoom=Math.min(2,Math.max(.000001,Math.min((width-2*padding)/Math.max(260,right-left),(height-2*padding)/Math.max(260,bottom-top))));
 return {zoom,x:-(left+right)/2*zoom,y:-(top+bottom)/2*zoom};
}
