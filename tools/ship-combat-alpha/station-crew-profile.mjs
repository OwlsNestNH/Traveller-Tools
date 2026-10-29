import {crewActionProfile} from './crew-actions.mjs';
import {dutyAssignment,dutySkill,dutyPenalty} from './crew-duty.mjs';
// Identity and displayed breakdown follow the same current duty as the roll.
export function stationCrewProfile(ship,role){
 const profile=crewActionProfile(ship,role),assignment=dutyAssignment(ship,role),penalty=dutyPenalty(ship,role);
 if(!assignment||!penalty.available)return {...profile,name:'Unavailable',breakdown:penalty.reason??'Station vacant or changing position.'};
 const origin=assignment.origin,member=ship.crew.roster?.members.find(m=>'member:'+m.id===assignment.operator),detail=origin.startsWith('mount:')?ship.crew.gunnerStations?.find(s=>s.mountId===origin.slice(6)):ship.crew.details?.[origin],skill=dutySkill(ship,role),simple=profile.skillName==='Simplified crew rating';
 return {...profile,name:simple?ship.crew.rating+' crew':member?.name||detail?.name||'Unnamed crew',breakdown:simple?profile.source:skill?`Skill ${skill.level} · Stat ${skill.stat??'unrecorded'} · Other ${skill.other??0} · Duty ${penalty.penalty}`:`Skill ${detail?.skill??'unrecorded'} · Characteristic/other ${detail?.characteristicDM??'unrecorded'} · Duty ${penalty.penalty}`};
}
