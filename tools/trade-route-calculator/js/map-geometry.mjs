// All map layers and loading share one immutable descriptor. The default is
// retained for non-GUI consumers; Overview configures the measured aspect ratio.
function geometry(width,height){return Object.freeze({width,height,halfWidth:width/2,halfHeight:height/2,originX:width/2,originY:height/2-2});}
export let MAP_GEOMETRY=geometry(520,320);
export function setMapGeometry(width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid map viewport');
 if(Math.abs(MAP_GEOMETRY.width-width)<.01&&Math.abs(MAP_GEOMETRY.height-height)<.01)return false;
 MAP_GEOMETRY=geometry(width,height);return true;
}

// Cull only by the displayed bounds. A widened, zoomed-out viewport can contain
// more than 1,500 worlds; truncating the result would silently hide geography.
export function visibleMapWorlds(worlds,center,scale){
 return worlds.filter(w=>Math.abs(w.x-center.x)*scale*Math.sqrt(3)/2<MAP_GEOMETRY.halfWidth+70&&Math.abs(w.y+((w.x%2+2)%2)*.5-center.y)*scale<MAP_GEOMETRY.halfHeight+60);
}
