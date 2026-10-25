// Bounded source facts travel with the design snapshot; never look up a live preset
// while normalizing an imported/saved ship. Unknown, absent and empty differ.
const text=(v,max)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid catalogue source text.');return v;};
const num=v=>{if(v==null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000000)throw Error('Invalid catalogue source number.');return v;};
const list=(v,max,fn)=>{if(!Array.isArray(v)||v.length>max)throw Error('Invalid catalogue source list.');return v.map(fn);};
export function normalizeCitation(s){return {book:text(s.book,100),edition:text(s.edition,80),page:num(s.page),pdfPage:num(s.pdfPage),endPage:num(s.endPage),pdfEndPage:num(s.pdfEndPage)};}
export function powerProvenance(r){
 if(r.source==null&&r.basis!=='manual override')return {};
 const result={source:r.source==null?null:normalizeCitation(r.source),basis:text(r.basis,300)};
 if(r.sourceReference)result.sourceReference={name:text(r.sourceReference.name,60),power:num(r.sourceReference.power),...powerProvenance({...r.sourceReference,sourceReference:null})};
 return result;
}
export function editedRequirement(original,name,power){
 if(original&&original.name===name&&original.power===power)return {...original};
 return {name,power,source:null,basis:'manual override',...(original?{sourceReference:original.sourceReference??{name:original.name,power:original.power,...powerProvenance(original)}}:{})};
}
export function normalizePublished(v){
 if(v==null)return null;
 if(v.version!==1)throw Error('Unsupported published inventory version.');
 const s=v.source;
 const source=normalizeCitation(s);
 if(!source.page||!source.pdfPage)throw Error('Published inventory needs printed and PDF pages.');
 if(!['listed','explicit-none','not-listed','unknown'].includes(v.weaponStatus))throw Error('Invalid published weapon status.');
 const inventory=list(v.inventory,64,r=>({category:text(r.category,80),detail:text(r.detail,2000),tonnage:text(r.tonnage,500)}));
 const mounts=list(v.mounts,32,m=>({id:text(m.id,32),name:text(m.name,100),quantity:num(m.quantity),capacity:num(m.capacity),fit:text(m.fit,200),fittedCount:num(m.fittedCount),capacityBasis:text(m.capacityBasis,200)}));
 for(const m of mounts)if(m.capacity!=null&&m.fittedCount!=null&&m.fittedCount>m.capacity)throw Error('Published fit exceeds mount capacity.');
 return {version:1,source,weaponStatus:v.weaponStatus,inventory,mounts,ammunitionStorage:list(v.ammunitionStorage,32,a=>({name:text(a.name,100),capacity:num(a.capacity)})),unresolved:list(v.unresolved,32,n=>text(n,400))};
}
