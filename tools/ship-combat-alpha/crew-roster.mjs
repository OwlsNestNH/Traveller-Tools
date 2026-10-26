// Optional identity records. Station details remain the compatibility projection.
// No combat timing, actions, storage or random ID generation lives here.
const id=v=>{if(typeof v!=='string'||!/^[-a-z0-9]{1,40}$/.test(v))throw Error('Invalid crew record ID.');return v;};
const text=(v,max=100)=>{if(typeof v!=='string'||v.length>max)throw Error('Invalid crew text.');return v.trim();};
const integer=(v,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error('Invalid crew skill or modifier.');return v;};
const unique=(rows,label)=>{if(new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('Duplicate '+label+' ID.');};
export function normalizeRoster(value,roles){
 if(value==null)return null;
 if(value.version!==1||!Array.isArray(value.members)||value.members.length>64)throw Error('Invalid crew roster.');
 const members=value.members.map(m=>{if(!Array.isArray(m.skills)||m.skills.length>32)throw Error('Record at most 32 skills per crew member.');const skills=m.skills.map(s=>({id:id(s.id),name:text(s.name),level:integer(s.level,0,10),stat:s.stat==null?null:integer(s.stat,-5,5),other:integer(s.other??0,-5,5)}));if(skills.some(s=>!s.name))throw Error('Choose a skill.');unique(skills,'skill');return {id:id(m.id),name:text(m.name??'',60),skills};});
 unique(members,'crew');const assignments={};
 for(const [role,a] of Object.entries(value.assignments??{})){if(!roles.includes(role)&&!/^mount:[-a-z0-9]{1,32}$/.test(role))throw Error('Invalid crew assignment.');const member=members.find(m=>m.id===a.memberId);if(!member?.skills.some(s=>s.id===a.skillId))throw Error('Crew assignment references a missing skill.');assignments[role]={memberId:member.id,skillId:a.skillId};}
 return {version:1,members,assignments};
}
const detail=(c,key)=>key.startsWith('mount:')?c.gunnerStations?.find(d=>d.mountId===key.slice(6)):c.details[key];
const projection=(m,s)=>({name:m.name,skillName:s.name,skill:s.level,characteristicDM:(s.stat??0)+s.other});
export function synchronizeRoster(c,roles){
 const roster=normalizeRoster(c.roster,roles);if(!roster)return c;
 const changed=new Map(),names=new Map();
 for(const [key,a] of Object.entries(roster.assignments)){
  const d=detail(c,key);if(!d){delete roster.assignments[key];continue;}const m=roster.members.find(m=>m.id===a.memberId),s=m.skills.find(s=>s.id===a.skillId),old=projection(m,s);
  if(JSON.stringify(old)===JSON.stringify(d))continue;
  const update={name:d.name,skillName:d.skillName,skill:d.skill,characteristicDM:d.characteristicDM},token=m.id+'/'+s.id;
  if(d.name!==m.name){if(names.has(m.id)&&names.get(m.id)!==d.name)throw Error('Conflicting names for the same crew member.');names.set(m.id,d.name);}
  if(changed.has(token)&&JSON.stringify(changed.get(token))!==JSON.stringify(update))throw Error('Conflicting edits to the same crew skill.');changed.set(token,update);
 }
 for(const [token,d] of changed){const [mid,sid]=token.split('/'),m=roster.members.find(m=>m.id===mid),s=m.skills.find(s=>s.id===sid);s.name=d.skillName;s.level=d.skill;if(d.characteristicDM!==(s.stat??0)+s.other){s.stat=null;s.other=d.characteristicDM;}}
 for(const [mid,name] of names)roster.members.find(m=>m.id===mid).name=name;
 return projectRoster({...c,roster});
}
export function projectRoster(c){
 const out=structuredClone(c);for(const [key,a] of Object.entries(out.roster?.assignments??{})){const m=out.roster.members.find(m=>m.id===a.memberId),s=m.skills.find(s=>s.id===a.skillId),d=projection(m,s);if(key.startsWith('mount:')){const old=out.gunnerStations?.find(x=>x.mountId===key.slice(6));if(old)Object.assign(old,d);}else out.details[key]=d;}return out;
}
export function rosterDraft(c){
 const out=structuredClone(c);out.roster??={version:1,members:[],assignments:{}};
 for(const [key,d] of [...Object.entries(out.details),...(out.gunnerStations??[]).map(d=>['mount:'+d.mountId,d])]){
  if(!d||out.roster.assignments[key])continue;let n=1;while(out.roster.members.some(m=>m.id==='crew-'+n))n++;const member={id:'crew-'+n,name:d.name,skills:[{id:'skill-1',name:d.skillName,level:d.skill,stat:null,other:d.characteristicDM}]};out.roster.members.push(member);out.roster.assignments[key]={memberId:member.id,skillId:'skill-1'};
 }return out;
}
export function assignMember(c,role,memberId,skillId){
 const out=rosterDraft(c),member=out.roster.members.find(m=>m.id===memberId);if(!member?.skills.some(s=>s.id===skillId))throw Error('Choose a crew member and skill.');out.roster.assignments[role]={memberId,skillId};return projectRoster(out);
}
export function assignedSkill(c,role){const a=c.roster?.assignments[role];return a?c.roster.members.find(m=>m.id===a.memberId)?.skills.find(s=>s.id===a.skillId)??null:null;}
