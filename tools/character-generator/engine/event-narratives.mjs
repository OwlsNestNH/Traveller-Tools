import { alienEventNarrative } from './alien-event-narratives.mjs';
// Original short context summaries, not source-book prose or replacement rules.
// Core Rulebook Update 2022: pre-career p17; careers pp23-45, 57, 237;
// Life and Unusual Events p46. Mechanics remain in the existing rules packs.
const rows = (start, values) => Object.fromEntries(values.map((text, i) => [start + i, text]));
const narratives = {
 'core.pre-career-events': rows(2, [
  'An illegal psionic group notices your potential and offers access to testing.',
  'A personal tragedy derails your education.',
  'A prank hurts someone and creates lasting trouble.',
  'You balance your studies with an enthusiastic social life and plenty of parties.',
  'Your close circle of friends makes a lasting pact.',
  'Something significant happens in your personal life.',
  'You become active in a political movement.',
  'A hobby or an interest beyond your main studies develops into a new skill.',
  'Disagreement with a tutor pushes you to challenge their work.',
  'War interrupts your education with a draft.',
  'Your inventive approach to study earns public recognition.'
 ]),
 'core.life-events': rows(2, [
  'Illness or an accident leaves you injured.',
  'A birth or death affects someone close to you.',
  'A romance ends bitterly.',
  'An existing romance grows into a deeper commitment.',
  'You begin a new romance.',
  'You meet someone who becomes a useful contact.',
  'Someone you trusted betrays you.',
  'You relocate to a different world.',
  'An unexpected success or windfall improves your fortunes.',
  'You become involved in a crime as an offender, victim or suspect.',
  'An extraordinary experience calls for an Unusual Event.'
 ]),
 'core.unusual-events': rows(1, [
  'You discover a psionic institute and an opportunity for testing.',
  'Living among aliens brings knowledge and a new acquaintance.',
  'You acquire a device from an alien culture.',
  'Part of your past is missing from your memory.',
  'You briefly encounter figures at the highest levels of Imperial power.',
  'You acquire technology from a civilisation predating the Imperium.'
 ])
};
function career(id, events, mishaps) {
 narratives[`core.${id}.events`] = rows(2, events);
 narratives[`core.${id}.mishaps`] = rows(1, mishaps);
}
const disaster = 'A serious setback sends you to the career Mishap table, without automatic ejection.';
const life = 'Something significant happens in your personal life.';
const severe = 'You suffer a severe injury.';
const injured = 'You are injured.';
const training = 'You receive an opportunity for specialist training.';
career('agent', [disaster,
 'A case becomes dangerous as your investigation develops.',
 'Your superiors reward a completed mission.',
 'You build a wider network of useful acquaintances.', training, life,
 'An undercover assignment takes you into another profession.',
 'Your exceptional dedication attracts notice.',
 'You receive specialist instruction in vehicle operations.',
 'An experienced agent takes you under their wing.',
 'You expose a large conspiracy targeting your employers.'
], [severe,
 'A suspect offers a deal; refusing puts you in danger.',
 'A disastrous investigation threatens your career and possibly your freedom.',
 'Dangerous knowledge makes you a target.',
 'Your work puts someone close to you in danger.', injured]);
career('army', [disaster,
 'You serve on a world with harsh natural conditions.',
 'You serve amid fighting in a populated urban region.',
 'Your unit entrusts you with a special duty.',
 'You fight in an especially destructive ground campaign.', life, training,
 'You withstand an enemy siege until reinforcements reach you.',
 'You undertake peacekeeping duties.',
 'Your commander supports your professional development.',
 'Your courage in combat earns military recognition.'
], [severe,
 'Your unit is devastated, and you blame your commander.',
 'You endure a harsh counter-insurgency deployment.',
 'You uncover your commander\'s criminal dealings and must choose how to respond.',
 'You clash with a fellow soldier or officer.', injured]);
career('citizen', [disaster,
 'You become caught up in political revolt on your homeworld.',
 'Work or recreation gives you hands-on experience with heavy vehicles.',
 'Your business, employer or colony prospers.', training, life,
 'You discover confidential information that could be exploited for illegal profit.',
 'Your resourcefulness or hard work earns recognition.',
 'Technical work develops your practical expertise.',
 'You form a friendship with someone above you in the organisation.',
 'You gain authority within your company or colony.'
], [severe,
 'A criminal gang makes your life untenable.',
 'A decline in interstellar trade costs you your livelihood.',
 'Authorities or outside interests intervene in your business or colony.',
 'Upheaval forces you to flee your world.', injured]);
career('drifter', [disaster,
 'A patron offers work in exchange for a future favour.',
 'An unsettled life teaches you practical skills.',
 'You salvage something valuable.',
 'An extraordinary experience calls for an Unusual Event.', life,
 'Enemies attack you.',
 'You may join a dangerous expedition with an uncertain reward.',
 'Surviving difficult circumstances sharpens an existing skill.',
 'You are conscripted for your next term.',
 'You flourish despite adversity.'
], [severe, injured,
 'You antagonise a criminal, official or other dangerous opponent.',
 'A serious illness damages your health.',
 'Betrayal ends this chapter of your life and may lead to imprisonment.',
 'You cannot remember what ended this part of your life.']);
career('entertainer', [disaster,
 'You are invited to participate in a contentious exhibition or event.',
 'You mingle with celebrities on your homeworld.',
 'A popular work brings you modest fame.',
 'An arts patron begins supporting your career.', life,
 'You can challenge a dubious political leader, risking retaliation.',
 'You travel through the sector on tour.',
 'The theft of your work draws you into a criminal investigation.',
 'Your unconventional life takes an extraordinary turn.',
 'You receive a major artistic award.'
], [severe,
 'A scandal you uncover or become involved in disrupts your career.',
 'Your public reputation deteriorates.',
 'A colleague betrays you.',
 'A failed project or journey leaves you stranded far from home.',
 'Censorship or controversy drives you out of your profession.']);
career('marine', [disaster,
 'You must fend for yourself behind hostile lines.',
 'You provide security aboard a space station.', training,
 'You take part in an attack on a fortified enemy position.', life,
 'You take part in a planetary invasion and occupation.',
 'You survive your commander\'s disastrous mistake and decide whether to report it.',
 'You undertake a covert operation.',
 'Your commander supports your professional development.',
 'Your courage in combat earns military recognition.'
], [severe,
 'Capture and mistreatment by the enemy leave you unfit for further service.',
 'A failed operation strands you in enemy territory.',
 'A covert assignment conflicts with your conscience.',
 'You clash with another marine or officer.', injured]);
career('merchant', [disaster,
 'You receive an offer to smuggle prohibited cargo.',
 'Working with suppliers and spacefarers broadens your expertise.',
 'A promising deal gives you a chance to risk your accumulated benefits.',
 'You meet a useful acquaintance outside your usual business circles.', life,
 'Legal difficulties interrupt your business.', training,
 'A successful transaction lets you enjoy a prosperous period.',
 'A useful friendship helps your business career.',
 'Your commercial venture prospers.'
], [severe,
 'A competitor ruins you financially.',
 'War disrupts your trading network and forces you to relocate.',
 'Criminals destroy your vessel or starport.',
 'Imperial trading restrictions close your business.',
 'Repeated business mistakes lead to bankruptcy, but you recover some assets.']);
career('navy', [disaster,
 'You join shipboard gambling activities.',
 'You receive a special shipboard duty.', training,
 'Your ship takes part in a significant battle.', life,
 'Your ship carries out a diplomatic assignment.',
 'You prevent a crime aboard your vessel.',
 'Your position creates an opportunity for personal enrichment.',
 'Your commander supports your professional development.',
 'Your bravery saves your vessel.'
], [severe,
 'An improper revival from cryogenic duty damages your health.',
 'Your performance in a decisive battle comes under scrutiny.',
 'You are held responsible for a fatal shipboard accident.',
 'You clash with another crew member or officer.', injured]);
career('noble', [disaster,
 'Someone challenges your honour with a duel.',
 'Life among the privileged broadens your experience.',
 'A wealthy relative leaves you an inheritance.',
 'You become embroiled in local political intrigue.', life,
 'A faction of plotting nobles asks you to join them.',
 'Your successful position provokes resentment from a relative or subject.',
 'You cultivate influence through high society.',
 'You ally yourself with an influential noble.',
 'Your achievements attract Imperial recognition.'
], [severe,
 'A scandal involving your family costs you your position.',
 'War or catastrophe threatens your safety.',
 'Political rivals remove you from power.',
 'An assassin tries to kill you.', injured]);
career('rogue', [disaster,
 'You face criminal charges and must decide how to defend yourself.',
 'You help plan an ambitious robbery.',
 'A profitable crime leaves its victim seeking revenge.',
 'You can betray another criminal for personal advantage.', life,
 'You spend an extended period among dangerous criminals.',
 'You become caught in a conflict between criminal groups.',
 'You join a gambling operation and may stake your benefits.',
 'A powerful criminal becomes your mentor.',
 'You carry out a crime that becomes notorious.'
], [severe,
 'Your arrest leads to imprisonment.',
 'Betrayal threatens your criminal activities and may bring imprisonment.',
 'A failed job sends you fleeing to another world.',
 'A detective or criminal adversary drives you away and pursues you.', injured]);
career('scholar', [disaster,
 'You are offered research that conflicts with your ethics.',
 'You join a confidential project for a sponsor.',
 'Your work wins an award, drawing admiration and jealousy.', training, life,
 'You could advance your work through dishonest methods.',
 'You achieve a significant research result.',
 'Administrative or legal complications interrupt your research.',
 'A gifted but unconventional mentor guides your work.',
 'Your research produces a major discovery.'
], [severe,
 'You are blamed for a disaster that injures several people.',
 'The government tries to restrict your research on ideological grounds.',
 'A failed expedition leaves you stranded until your position is lost.',
 'Sabotage forces you to choose between salvaging your career benefits and rebuilding.',
 'Another researcher damages your reputation or appropriates your work.']);
career('scout', [disaster,
 'Hostile ships ambush your vessel.',
 'You explore and survey an alien planet.',
 'Your outstanding Scout service earns a reward.',
 'Years of interstellar travel build your shipboard skills.', life,
 'Contact with aliens offers a chance to gather intelligence.',
 'You help with rescue efforts after a disaster.',
 'You work far beyond the settled regions of Charted Space.',
 'You carry a significant Imperial dispatch.',
 'You make a discovery valuable to the Imperium.'
], [severe,
 'Scout service takes a lasting psychological toll.',
 'A damaged ship forces you to find passage back to a Scout base.',
 'You accidentally provoke a dispute involving the Imperium.',
 'Your ship is recovered adrift, but you cannot explain what happened.', injured]);
career('prisoner', [disaster,
 'You spot a possible route out of prison.',
 'You are assigned exhausting prison labour.',
 'You have a chance to join a prison gang.',
 'You receive an opportunity for vocational education.',
 'An incident changes your life inside the prison.',
 'Your case receives a parole hearing.',
 'You may retain a new lawyer to seek earlier release.',
 'You receive a position of responsibility within the prison.',
 'The prison warden takes a personal interest in your case.',
 'You can risk yourself to rescue a member of the prison staff.'
], [severe,
 'You are charged with attacking a guard.',
 'A prison gang targets you; you must decide whether to resist.',
 'A hostile guard makes your sentence harder.',
 'News of your criminal record damages your standing at home.', injured]);
career('psion', [disaster,
 'Your powers unsettle someone who used to trust you.',
 'You develop control of both mind and body.',
 'You could exploit your abilities for personal status or wealth.',
 'You meet someone outside your usual circles.', life,
 'Your psionic potential grows stronger.', training,
 'Psychic insights reveal potentially valuable information.',
 'A mentor offers support for your future career.',
 'Your control over your powers reaches a new level.'
], [severe,
 'A dangerous telepathic encounter weakens you and causes recurring nightmares.',
 'An anti-psionic group threatens you with exposure or violence.',
 'You are asked to misuse your powers.',
 'You escape an organisation that has been experimenting on you.',
 'Someone formerly close to you turns against you because of your abilities.']);

/** Read-only context: unknown tables or rows deliberately return null. */
export function eventNarrative(table, row) {
 const text = Object.hasOwn(narratives, table) ? narratives[table]?.[row] : null;
 return typeof text === 'string' ? text : alienEventNarrative(table, row);
}

// Traveller Companion Update 2024, pp37,39-40. Original context summaries.
narratives['companion.truther.events'] = rows(2, [disaster,
 'An organisation proposes a questionable use for your expertise.',
 'A confidential research programme seeks your advice.',
 'A new discovery sends you studying an unfamiliar technical subject.',
 'Your investigations take you into frontier territory.', life,
 'Prominent media appearances increase your public following.',
 'An opportunity could benefit you at the expense of someone else\'s career.',
 'A secretive group takes an interest in your investigations.',
 'Winning a public argument brings you fame and a resentful opponent.',
 'New research gives your once-marginal work wider credibility.'
]);
narratives['companion.truther.mishaps'] = rows(1, [
 'An accident or attack connected with your work leaves you injured.',
 'Someone harmed by your revelations becomes a deadly opponent.',
 'Your credibility and public standing collapse.',
 'You find a serious error in the foundations of your research.',
 'Others distort or exploit your findings, and you bear the consequences.',
 'Your activities turn former professional acquaintances against you.'
]);
narratives['companion.believer.events'] = rows(2, [disaster,
 'Service to the community wins respect and a supporter.',
 'A scholar seeks your advice for a forthcoming work.',
 'You are sent to teach your beliefs in a disadvantaged community.',
 'You withdraw from ordinary life to seek spiritual insight.', life,
 'You publicly represent your beliefs before a large audience.',
 'You are offered wealth in exchange for abandoning your principles.',
 'A dying dignitary outside your faith secretly requests your religious services.',
 'A more charismatic but less committed figure becomes your superior.',
 'Your efforts bring a surge of new support for your faith.'
]);
narratives['companion.believer.mishaps'] = rows(1, [
 'Opponents of your beliefs attack and injure you.',
 'Helping someone adopt your beliefs angers a person close to them.',
 'Association with a scandal damages your position.',
 'You discover that teachings you followed were mistaken.',
 'Doubts about your beliefs or their honesty undermine your vocation.',
 'A breakaway faction challenges your interpretation of the faith.'
]);

// Core p57: nested Prison Event and riot rolls, addressed by projection only.
narratives['core.prisoner.incidents'] = rows(1, [
 'A riot breaks out in the prison.',
 'You befriend a fellow inmate.',
 'You acquire a rival among the prisoners or guards.',
 'You are transferred to another prison.',
 'Your good conduct improves your prospects for release.',
 'Another prisoner attacks you.'
]);
narratives['core.prisoner.riot'] = rows(1, [
 'You are injured during the prison riot.',
 'You are injured during the prison riot.',
 'The riot produces no additional mechanical effect.',
 'The riot produces no additional mechanical effect.',
 'You recover useful loot during the riot.',
 'You recover useful loot during the riot.'
]);


