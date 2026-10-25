// Explicit legacy/unknown-stat synthetic fixture; not the application default.
export function legacySampleShips(){return [
 ['merchant','Merchant',1,-5,2,2,0],['courier','Courier',3,3,-3,-1,1],['escort','Escort',6,-2,-4,1,1],['scout','Scout',2,1,4,0,-1],['fighter','Fighter',9,6,2,-2,-1]
].map(([id,label,thrust,q,r,vq,vr])=>({id,name:label,appearance:{side:['escort','fighter'].includes(id)?'B':'A',icon:({merchant:'trader',courier:'scout',escort:'corvette',scout:'scout',fighter:'fighter'})[id]},capabilities:{thrust},motion:{position:{q,r},velocity:{q:vq,r:vr},impulse:{q:0,r:0}}}));}
