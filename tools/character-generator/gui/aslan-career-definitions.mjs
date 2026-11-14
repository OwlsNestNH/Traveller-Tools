// Presentation only. The projected career choices and rule pack remain authoritative.
const book='Aliens of Charted Space Volume 1 Update 2026';
// Verified publisher listing; source page numbers below are printed page numbers.
const url='https://www.mongoosepublishing.com/products/aliens-of-charted-space-vol-1-update-2026';
const rows=[
 ['envoy',24,'noble',{duellist:'Represent the clan through formal challenges.',negotiator:'Negotiate agreements for the clan.',spy:'Gather information in the clan’s interests.'}],
 ['guardian',26,'ceremonial',{agent:'Protect the clan’s interests and traditions.',poet:'Preserve and express the clan’s cultural inheritance.',priest:'Maintain the clan’s spiritual and ceremonial life.'}],
 ['manager',28,'merchant',{aide:'Support the administration of the clan.',corporate:'Manage commercial activities.',governess:'Guide a household’s education and affairs.'}],
 ['military',30,'military',{cavalry:'Operate vehicles in clan military service.',flyer:'Serve with the clan’s aircraft.',support:'Support and maintain the clan’s forces.',warrior:'Fight as a clan combatant.'}],
 ['military-officer',32,'military',{assassin:'Carry out specialised operations for the clan.',executive:'Organise and advise the military force.',leader:'Command the clan’s combatants.'}],
 ['scientist',34,'scholar',{explorer:'Investigate beyond familiar territory.',healer:'Provide medical care.',researcher:'Develop and apply scientific knowledge.'}],
 ['spacer',36,'navy',{crew:'Keep a clan spacecraft operating.',engineer:'Maintain and repair ship systems.',gunner:'Operate a ship’s weapons.',pilot:'Pilot clan spacecraft.'}],
 ['space-officer',38,'navy',{commander:'Command a clan vessel.',navigator:'Plan and manage navigation.',shipmaster:'Oversee the operation of a clan vessel.'}],
 ['outcast',40,'outcast',{labourer:'Find work outside the standing of ordinary clan society.',trader:'Make a living through independent trade.',scavenger:'Recover useful materials and equipment.'}],
 ['outlaw',42,'rogue',{pirate:'Raid shipping outside ordinary clan society.',raider:'Carry out raids.',thief:'Steal to make a living.'}],
 ['wanderer',44,'scout',{belter:'Prospect and work among the asteroids.',nomad:'Travel in search of opportunity and land.',scout:'Explore unfamiliar worlds and routes.'}]
];
export const ASLAN_CAREER_DEFINITIONS=Object.freeze(Object.fromEntries(rows.map(([id,page,crow,specialties])=>['aslan.'+id,Object.freeze({id:'aslan.'+id,page,eventPage:page+1,book,url,crow,source:book+' · pp. '+page+'–'+(page+1),specialties:Object.freeze(specialties),exceptions:Object.freeze({species:'aslan'})})])));
export function aslanRuleInformation(model,state){
 const d=model.template,phase=model.phase;
 const topics=[
  ['application','Use the currently permitted assignments and the qualification shown by the action. Most native Aslan careers use the Rite of Passage score as a qualification DM; Scientist and Outlaw use their printed characteristic checks. Failed qualification and any permitted outward route follow the projected Aslan choices, not an ordinary Imperial draft.'],
  ['training','Resolve the offered basic training, training roll or earned award and any required specialisation. The current projected award determines its source and timing. Cultural skill restrictions and recorded source decisions still apply; opening this information does not grant or roll a skill.'],
  ['survival','Roll the selected assignment’s Survival check. Review the recorded faces, modifier, target and outcome before continuing. Resolve the offered consequences explicitly.'],
  ['events and mishaps','Roll each offered event, mishap and pending consequence yourself. Resolve the specific choice, source decision or award shown. Accepted results remain recorded; a fictional failure is not a software error.'],
  ['progression','Follow this career’s advancement and rank rewards. Military and Spacer officer opportunities are specific permissions to attempt a separate officer career, not Imperial commissions. Any rank-table mapping that needs a referee remains explicit.'],
  ['term review','Review the accepted term before choosing an available continuation or exit. Forced continuation, earned officer offers, restoration and outward routes retain their recorded restrictions. Close preserves the step; rewinding accepted results uses the existing explicit confirmation.'],
  ['mustering out','Use the cash and material choices actually offered. Native Aslan have gender-specific cash rules and no ordinary retirement pension. Clan Shares, land, forfeitures and unresolved entitlements keep their source-specific procedures; opening a checklist does not roll another benefit.']
 ];
 const [topic,summary]=topics[phase]??['current step','Resolve the offered Aslan procedure and any explicit source ruling before continuing.'];
 const notes=[];
 if(d.id==='aslan.military')notes.push('Male Support entry requires SOC 8 or less.');
 if(d.id==='aslan.wanderer')notes.push('Wanderer entry requires a male second son; gender-marked awards still need their own source check.');
 if(['aslan.outcast','aslan.outlaw'].includes(d.id))notes.push('Historical Outcast or Outlaw service does not automatically restore ordinary clan career access. Use a recorded restoration, earned exception or outward route.');
 if(model.career.sourceConflict||['aslan.scientist','aslan.space-officer'].includes(d.id))notes.push('The source contains a documented discrepancy for this career. Preserve the recorded rule interpretation and any required referee decision; the summary is not permission to bypass it.');
 if(state.stage==='failed-entry')notes.push('Failed native Aslan qualification uses the projected Outcast fallback or recorded outward route. This failure does not grant a Core draft; retain the recorded qualification roll.');
 const step=model.stepSource,page=step?.page??(phase===3?d.eventPage:d.page);
 return {title:model.career.name+' '+topic,summary:summary+(notes.length?' '+notes.join(' '):''),book:step?.book??book,page,url:step&&step.book!==book?step.url:url};
}
export function aslanCareerGuidance(model,state){
 if(state?.stage==='ageing')return 'Roll ageing before choosing your next term. Your completed term is recorded. Even your ancestors cannot negotiate with the calendar.';
 if(model.selection)return 'Choose a permitted career. The clan has expectations. Unfortunately, they concern you.';
 if(state.stage==='failed-entry')return 'Qualification failed. Choose the permitted next step below. Your ancestors have requested a quieter descendant.';
 if(state.stage==='borrowed-event-roll')return 'Roll the pending '+state.pendingBorrowedRoll.label+'. The previous result is already recorded. Your optimism cannot replace the dice.';
 if(state.stage==='career-event')return 'You survived. Roll the career event. Try giving the clan a story it can repeat in public.';
 if(state.stage==='career-mishap')return 'Roll the mishap and resolve its consequences. Your reputation has developed a paperwork problem.';
 if(state.stage==='aslan-officer-entry')return 'Choose the permitted officer assignment and resolve qualification. An invitation is not a promotion, genius.';
 if(state.stage==='aslan-officer-rank')return 'Record the referee’s rank-table mapping. Guessing loudly is still guessing.';
 return ['Choose an available assignment. Even questionable judgement needs a job title.','Resolve the training offered below. The clan cannot train a blank.','Roll Survival. Those new skills would be more impressive if you lived to use them.','Resolve every offered consequence. The clan is not cleaning up your loose ends.','Resolve advancement and any earned rewards. A title will not do the work for you.','Review the recorded term before staying or leaving. Nostalgia is not a qualification.','Resolve the remaining benefits and source decisions. Read the conditions before claiming the glory.'][model.phase]??'Follow the current Aslan procedure below. Tradition is complicated enough without your improvisation.';
}
