const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
// Numeric program requirements only. Core Update 2022 p.161; High Guard Update 2022 pp.73–75.
const core={book:'Core Rulebook Update 2022',page:161},hg=page=>({book:'High Guard Update 2022',page});
const make=(id,name,ratings,tls,bws,source,note='')=>({id,name,variants:ratings.map((rating,i)=>({rating,tl:tls[i],bandwidth:bws[i]})),source,note});
export const SOFTWARE=freeze([
 make('evade','Evade',[1,2,3],[9,11,13],[10,15,25],core,'Records the selected rating; no attack modifier is applied automatically.'),
 make('fire-control','Fire Control',[1,2,3,4,5],[9,10,11,12,13],[5,10,15,20,25],core,'Rating is a shared pool, not a universal bonus for every turret. Does not stack with Advanced Fire Control.'),
 make('auto-repair','Auto-Repair',[1,2],[10,12],[10,20],core,'Repair drones required; no repair is resolved here.'),
 make('jump-control','Jump Control',[1,2,3,4,5,6],[9,11,12,13,14,15],[5,10,15,20,25,30],core,'Jump-only /bis bandwidth allowance is separate from general processing.'),
 make('manoeuvre','Manoeuvre',[0],[8],[0],core),make('intellect','Intellect',[0],[11],[0],core,'Does not supply a crew skill.'),make('library','Library',[0],[8],[0],core),
 make('advanced-fire-control','Advanced Fire Control',[1,2,3],[10,12,14],[15,25,30],hg(73),'Does not stack with Fire Control. No autonomous firing.'),
 make('battle-network','Battle Network',[1,2],[12,14],[5,10],hg(73),'Sensor handoff remains manual; also see p.74.'),
 make('battle-system','Battle System',[1,2,3],[9,12,15],[5,10,15],hg(74),'No Tactics check is resolved.'),
 make('broad-spectrum-ew','Broad Spectrum EW',[0],[13],[12],hg(74),'EW actions remain manual.'),
 make('electronic-warfare','Electronic Warfare',[1,2,3],[10,13,15],[10,15,20],hg(74),'Requires access to ship sensors; no sensor check is resolved.'),
 make('launch-solution','Launch Solution',[1,2,3],[8,10,12],[5,10,15],hg(74),'No missile or torpedo attack is resolved.'),
 make('point-defence','Point Defence',[1,2],[9,12],[12,15],hg(75),'Requires suitable fitted weapons; installing software does not add equipment.'),
 make('screen-optimiser','Screen Optimiser',[0],[10],[10],hg(75),'Requires fitted screens; no automatic screen use.')
]);
export function software(id){const p=SOFTWARE.find(p=>p.id===id);if(!p)throw Error('Choose a listed software package.');return p;}
export function softwareVariant(id,rating){const v=software(id).variants.find(v=>v.rating===rating);if(!v)throw Error('Choose a supported software rating.');return v;}
export function computerFacts(value){const m=/^Computer\s*\/\s*(\d+)\s*(?:\(?\s*(bis|fib)\s*\)?)?$/i.exec(value??'');const n=m?Number(m[1]):null;return {processing:n!=null&&Number.isSafeInteger(n)&&n<=1000000?n:null,bis:!!m&&m[2]?.toLowerCase()==='bis'};}
export function sourcePrograms(text){const installed=[],unrecognised=[];for(const token of (text??'').split(/[;,]/).map(s=>s.trim()).filter(Boolean)){const m=/^(.*?)(?:\s*\/\s*(\d+))?$/.exec(token),p=SOFTWARE.find(p=>p.name.toLowerCase()===m[1].trim().toLowerCase()),rating=m[2]==null?0:Number(m[2]);if(!p||!p.variants.some(v=>v.rating===rating)||installed.some(v=>v.id===p.id)){unrecognised.push(token);continue;}installed.push({id:p.id,installed:rating,running:null,origin:'source-record'});}return {installed,unrecognised,known:text!=null};}
