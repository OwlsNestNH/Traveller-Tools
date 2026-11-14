// Read-only presentation. Projected eligibility, checks and awards remain authoritative.
const book='Aliens of Charted Space Volume 1 Update 2026';
const url='https://www.mongoosepublishing.com/products/aliens-of-charted-space-vol-1-update-2026';
const rows=[
 ['agent',188,'agent',{enforcer:'Enforce the interests of your organisation.',investigator:'Investigate crimes and concealed activity.',spy:'Gather information under cover.'}],
 ['citizen',190,'technician',{corporate:'Work within a commercial organisation.',settler:'Establish and support a settlement.',worker:'Earn a living through practical work.'}],
 ['intermediary',192,'noble',{arbitrator:'Settle disputes between parties.',diplomat:'Represent your organisation in negotiations.',emissary:'Carry messages and represent another’s interests.'}],
 ['loner',194,'outcast',{prospector:'Search for valuable resources.',scrounger:'Find useful goods and opportunities.',wanderer:'Travel beyond an established pack.'}],
 ['merchant',196,'merchant',{free:'Trade independently between ports.',long:'Work aboard a long-range trading vessel.',salvager:'Recover cargo and equipment.'}],
 ['military',198,'military',{army:'Serve in a military fighting force.',militia:'Defend a community or territory.',raider:'Conduct military raids.'}],
 ['psion',200,'skills',{institute:'Develop psionic abilities within an institute.',mentored:'Learn under an experienced psionic teacher.',wild:'Develop your talents outside formal instruction.'}],
 ['scientist',202,'scholar',{physician:'Provide medical treatment.',researcher:'Investigate scientific questions.',technician:'Apply technical knowledge.'}],
 ['spacer',204,'navy',{corsair:'Serve in a corsair band.',explorer:'Explore unfamiliar systems and worlds.',navy:'Serve aboard a naval vessel.'}]
];
export const VARGR_CAREER_DEFINITIONS=Object.freeze(Object.fromEntries(rows.map(([id,page,crow,specialties])=>['vargr.'+id,Object.freeze({id:'vargr.'+id,page,eventPage:page+1,book,url,crow,source:book+' · pp. '+page+'–'+(page+1),specialties:Object.freeze(specialties),exceptions:Object.freeze({species:'vargr'})})])));
export function vargrRuleInformation(model,state){
 if(state.stage==='failed-entry'&&state.fallbackOptions?.drifter)return {title:'Vargr qualification alternatives',book,page:186,url,summary:'After failed qualification, choose Core Drifter, native Loner or the Vargr draft where its use is still permitted. The qualification result is already recorded. The draft is not limited to the first term and keeps its ordinary once-per-lifetime restriction unless an explicit rule overrides it. Its printed destination labels need an explicit source/referee interpretation; no revised career is substituted automatically.'};
 if(state.pending?.kind==='vargr-draft')return {title:'Vargr draft source ruling',book,page:186,url,summary:'The draft die and printed outcome are already recorded. The 2026 destination labels do not explicitly map every revised career and assignment. No interpretation is selected automatically. Consult the source and referee, then record a bounded mapping and reason. This is an explicit interpretation, not published errata; closing preserves the accepted die.'};
 const d=model.template,topics=[
  ['application','Use the projected qualification and assignment choices. Native Vargr use Charisma and do not take a qualification penalty for previous careers. Imperial upbringing follows the separate Core career route. Failed qualification follows the recorded Vargr fallback and draft permissions; opening information does not attempt another qualification.'],
  ['training','Resolve the offered basic training, training roll or earned award, including required specialisations. Eligible-table awards are limited to the actual offered tables; Loner assignment-table choices and Citizen event training exceptions retain their source-specific limits.'],
  ['survival','Roll the selected assignment’s Survival check and review its recorded dice, modifier and target. An ordinary failed Survival check leads to its mishap procedure; any separately enabled Iron Man option is explicitly identified before rolling.'],
  ['events and mishaps','Resolve the offered career event or mishap and each pending choice, check or source ruling. Pack and life events retain their actual consequences. Accepted results are recorded; closing information does not reroll them.'],
  ['progression','Use this assignment’s advancement check, ranks and earned rewards. Charisma changes and automatic advancement permissions remain source-specific; a Vargr rank is not an Imperial commission.'],
  ['term review','Review the recorded term before taking a permitted continuation or exit. Loner service is limited to one term. Close preserves choices and results; rewinding accepted actions requires the existing explicit confirmation.'],
  ['mustering out','Use the offered cash or material benefits. Ship awards retain their mortgage fractions, outdated-ship rolls and ownership conditions. Resolve the actual entitlement rather than assuming an unrestricted personal ship.']
 ],[topic,summary]=topics[model.phase]??topics[0],notes=[];
 if(d.id==='vargr.loner')notes.push('Loner is a single-term career; ordinary continuation is unavailable.');
 if(d.id==='vargr.psion')notes.push('Psionic eligibility, tested PSI and talent-specific choices remain required. No talent or additional roll is granted by this summary.');
 if(model.career.sourceConflict||d.id==='vargr.citizen')notes.push('The source summary and detailed career page contain a documented discrepancy. The engine’s recorded detailed-page interpretation remains in force.');
 if(state.stage==='failed-entry')notes.push('Use only the fallback or draft choices currently offered. Prior draft use and recorded source permissions remain authoritative.');
 const step=model.stepSource;return {title:model.career.name+' '+topic,summary:summary+' '+notes.join(' '),book:step?.book??book,page:step?.page??(model.phase===3?d.eventPage:d.page),url:step&&step.book!==book?step.url:url};
}
export function vargrCareerGuidance(model,state){
 if(state?.stage==='ageing')return 'Roll ageing before deciding your next term. Your completed term is recorded. The pack cannot outvote the calendar.';
 if(model.selection)return 'Choose a permitted career. The pack needs a plan. Apparently, it has delegated that mistake to you.';
 if(state.stage==='failed-entry'&&state.fallbackOptions?.drifter)return 'Qualification failed. Choose Core Drifter, Loner or the Vargr draft if permitted. Your accepted result stays recorded. Confidence was never a qualification.';
 if(state.pending?.kind==='vargr-draft')return 'Your draft result is recorded. The book left the destination mapping unclear. Get an explicit referee ruling; confidence is still not errata.';
 if(state.stage==='failed-entry')return 'Qualification failed. Choose a permitted fallback. Your confidence was not a qualification.';
 if(state.stage==='borrowed-event-roll')return 'Roll the pending '+state.pendingBorrowedRoll.label+'. Your previous result is recorded. Barking at the dice will not replace them.';
 return ['Choose an available specialty. Enthusiasm remains a poor substitute for reading the requirements.','Resolve the offered training and any required specialisation. The pack cannot train a blank.','Roll Survival. Your replacement has already started practising a speech.','Resolve the event or mishap and its offered consequences. The pack is not your cleaning service.','Resolve advancement and its earned rewards. Charisma is not permission to skip the paperwork.','Review this term before choosing an available next step. Your terrible decisions now have a history.','Resolve the remaining benefits and conditions. Try reading the fine print before claiming the ship.'][model.phase]??'Follow the current Vargr procedure. Your confidence has already caused enough work.';
}
