import {aezorghCulture} from '../shared/aezorgh-culture.mjs';
// Source-backed presentation profiles. Eligibility and effects stay in the engine.
const coreBook='Core Rulebook Update 2022',companionBook='Traveller Companion Update 2024';
const coreUrl='https://www.mongoosepublishing.com/products/traveller-core-rulebook-update-2022';
// Presentation support, never career eligibility. The engine still supplies
// offered choices, restrictions and accepted records. Unknown/held contexts
// and native species' own career profiles keep their existing boundaries.
export const supportsImperialCareerPresentation=character=>!!aezorghCulture(character)||character?.species==='human'||['aslan','vargr'].includes(character?.species)&&['native','imperial'].includes(character.culture);
const descriptions={
 'core.agent':{law:'Investigate offences and enforce the law.',intelligence:'Gather intelligence and conduct covert operations.',corporate:'Protect an employer’s interests and information.'},
 'core.army':{support:'Keep the unit supplied, repaired and functioning.',infantry:'Serve on foot at the sharp end of a campaign.',cavalry:'Operate the vehicles that carry the fight.'},
 'core.citizen':{corporate:'Work within a commercial organisation.',worker:'Earn a living through ordinary skilled work.',colonist:'Build a life in a new settlement.'},
 'core.drifter':{barbarian:'Live beyond technological society.',wanderer:'Travel between places and temporary work.',scavenger:'Recover value from other people’s leftovers.'},
 'core.entertainer':{artist:'Create work for an audience.',journalist:'Find stories and report them.',performer:'Make your living in front of an audience.'},
 'core.marine':{support:'Support the force with technical and medical work.',star:'Conduct shipboard and boarding operations.',ground:'Carry out assaults on planetary targets.'},
 'core.merchant':{marine:'Serve aboard a commercial vessel.',free:'Trade independently between worlds.',broker:'Arrange deals and connect buyers with sellers.'},
 'core.navy':{crew:'Operate a ship and its routine systems.',technical:'Maintain specialist systems and weapons.',flight:'Pilot craft and support flight operations.'},
 'core.noble':{administrator:'Administer a government or domain.',diplomat:'Represent interests through diplomacy.',dilettante:'Cultivate a reputation without a conventional job.'},
 'core.rogue':{thief:'Acquire valuables their owners meant to keep.',enforcer:'Provide the threat behind an organisation’s demands.',pirate:'Make a living through unlawful space operations.'},
 'core.scholar':{field:'Investigate questions away from the laboratory.',scientist:'Develop and test scientific knowledge.',physician:'Practise medicine and care for patients.'},
 'core.scout':{courier:'Carry messages and supplies between worlds.',surveyor:'Assess worlds and routes.',explorer:'Investigate unfamiliar territory.'},
 'core.prisoner':{inmate:'Serve a sentence within the prison system.',thug:'Survive through force and intimidation.',fixer:'Find supplies, arrangements and useful contacts.'},
 'core.psion':{adept:'Study and develop psionic disciplines.',warrior:'Combine psionic abilities with combat training.',wild:'Develop abilities outside formal instruction.'},
 'companion.truther':{truther:'Build a following around your search for truth.'},
 'companion.believer':{mainstream:'Take a place within an established faith.',missionary:'Carry a faith and humanitarian work to new communities.',warrior:'Pursue a faith through armed action.'}
};
const rows=[['agent','Agent',22],['army','Army',24],['citizen','Citizen',26],['drifter','Drifter',28],['entertainer','Entertainer',30],['marine','Marine',32],['merchant','Merchant',34],['navy','Navy',36],['noble','Noble',38],['rogue','Rogue',40],['scholar','Scholar',42],['scout','Scout',44],['prisoner','Prisoner',56],['psion','Psion',236]];
export const IMPERIAL_CAREER_DEFINITIONS=Object.freeze(Object.fromEntries([
 ...rows.map(([id,name,page])=>['core.'+id,{id:'core.'+id,name,page,eventPage:page+1,book:coreBook,url:coreUrl}]),
 ['companion.truther',{id:'companion.truther',name:'Truther',page:36,eventPage:37,book:companionBook,url:'https://www.mongoosepublishing.com/products/traveller-companion-update-2024'}],
 ['companion.believer',{id:'companion.believer',name:'Believer',page:38,mishapPage:39,eventPage:40,book:companionBook,url:'https://www.mongoosepublishing.com/products/traveller-companion-update-2024'}]
].map(([id,d])=>[id,Object.freeze({...d,source:d.book+' · pp. '+d.page+'–'+d.eventPage,basicTrainingPage:id==='core.psion'?229:id==='companion.believer'?38:id==='companion.truther'?36:18,specialties:Object.freeze(descriptions[id]),exceptions:Object.freeze(id==='core.prisoner'?{progression:'parole',entry:'forced'}:id==='companion.truther'?{progression:'following'}:['core.citizen','core.drifter','core.psion','companion.believer'].includes(id)?{basicTraining:'assignment'}:{})})])));
export function presentationRank(presentation,record){
 if(!record)return null;const grids=presentation?.ranks??{};
 const rows=grids.assignments?.[record.assignment]??(record.officer?grids.officer:grids.enlisted)??grids.default;
 return rows?.find(r=>r.rank===record.rank)??null;
}
export function imperialRuleInformation(model){
 const d=model.template,phase=model.phase,name=model.career.name;
 const basic=d.basicTraining?.table==='assignment'?'the selected specialty’s table':'the Service Skills table';
 const topics=[
  ['application','Choose a specialty and review the shown entry requirements. The action shows whether a qualification roll, automatic entry or a permitted special route applies.'],
  ['training','Basic training uses '+basic+'. Resolve the specific offered award and any required specialisation. Available training tables and their restrictions come from the current engine state. Earned advancement training is separate from basic training.'],
  ['survival','The selected specialty determines the survival check. Roll the offered check, then review the recorded faces, applied modifier, total, target and result. A survival failure leads to its required consequences.'],
  ['events and mishaps','The accepted table result remains recorded. Make each offered choice and roll each pending consequence explicitly. A fictional failure is a game outcome; it is not a software error.'],
  ['progression',d.exceptions.progression==='parole'?'Prisoner progression uses the recorded Parole Threshold and its specific release procedure. Follow the offered check; leaving and ordinary career advancement are not interchangeable.':d.exceptions.progression==='following'?'Truther has no conventional advancement roll or rank ladder. Following and the current event determine the recorded career consequences.':'Review the offered advancement or commission action. Any new rank reward and earned training are separate decisions; an officer track is used only where the career actually has one.'],
  ['term review','Review the accepted term before choosing an available continuation or exit. Close and Resume preserve the current state; rewinding accepted results requires the existing explicit confirmation.'],
  ['mustering out','Choose an available cash or material benefit. Any alternatives, restricted awards and equipment details remain explicit. Accepted benefits are recorded; opening a checklist does not roll another benefit.']
 ];
 const [topic,summary]=topics[phase]??['current step','Follow the current required action and the displayed source reference.'];
 const psion=d.id==='core.psion'&&[0,1].includes(phase)?' Psion entry requires referee permission. Changing Psion specialty requires qualification for a new career; an untrained talent still requires its acquisition roll (Core Rulebook Update 2022, p. 229).':'';
 const step=model.stepSource;return {title:name+' '+topic,summary:summary+psion+(phase===1?' Basic-training reference: '+d.book+', p. '+d.basicTrainingPage+'.':''),book:step?.book??d.book,page:step?.page??(phase===3?(model.consequenceKind==='mishap'?d.mishapPage??d.eventPage:d.eventPage):d.page),url:step?.book&&step.book!==d.book?step.url:d.url};
}

export function imperialCareerGuidance(model,state){
 if(model.fallback)return 'Your application failed. Pick the next permitted route. Your paperwork has finally acquired a plot.';
 if(state?.stage==='ageing')return 'Roll ageing before reviewing whether to stay or leave. Your completed term is recorded. Time has reviewed your application.';
 if(model.selection)return 'Pick a career. Optimism is still not a qualification.';
 if(state?.stage==='borrowed-event-roll')return 'Roll the pending '+state.pendingBorrowedRoll.label+'. The previous result is recorded. The dice are not decorations.';
 if(state?.stage==='career-event')return 'You survived. Roll your career event. Try not to make it embarrassing.';
 if(state?.stage==='career-mishap')return 'Roll the mishap. Apparently surviving was too ambitious.';
 if(model.phase===4&&model.template.exceptions.progression==='following')return 'Follow the offered progression step. A Following is not a rank, however loudly it applauds.';
 if(model.phase===4&&model.template.exceptions.progression==='parole')return 'Review progression and the recorded Parole Threshold. Your sentence has opinions about your exit.';
 if(model.phase===4&&!model.career.commission)return 'Resolve the offered progression and earned rewards. The title does not do the work for you.';
 return ['Choose your specialty. Even your questionable ambitions need a department.','Choose the training offered here. Wishful thinking remains unaccredited.','Training is recorded. Now find out whether it kept you alive.','Resolve the event and every required choice. A loose end is still your problem.','Review advancement or an available commission. Ambition is not a modifier.','Review the recorded term before deciding to stay or leave. Nostalgia is not a plan.','Resolve the remaining benefits. Payroll will not chase you.'][model.phase]??'Follow the current step below. Even your detours need an ending.';
}
