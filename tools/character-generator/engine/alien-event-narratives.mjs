import {aslanRiteNarratives} from '../shared/aslan-rite-narratives.mjs';
// Original context summaries, independently paraphrased from Aliens of Charted
// Space Volume 1 Update 2026, pp21, 25-46 and 189-206. These are not rules text.
// Choices, checks and actual outcomes remain in the existing rules engine.
const rows = (start, values) => Object.fromEntries(values.map((text, i) => [start + i, text]));
const disaster = 'A serious setback calls for a mishap.';
const life = 'An important personal experience calls for a life event.';
const training = 'You have an opportunity for advanced specialist training.';
const injury = 'You suffer an injury.';
const severe = 'You suffer a severe injury.';
const tables = {};
function career(id, events, mishaps) {
 tables[id + '.events'] = rows(2, events);
 tables[id + '.mishaps'] = rows(1, mishaps);
}
career('aslan.envoy', [disaster,
 'Your clan leaves you facing a difficult assignment; you must decide whether to withdraw or confront it.',
 'Hunting becomes a personal interest.',
 'You attend a council at your clan homeworld.', training, life,
 'Diplomatic social gatherings put your interpersonal skills to the test.',
 'A noble from another clan insults you, raising the question of a duel.',
 'Powerful conspirators invite you into their scheme.',
 'Senior clan or pride leaders place their confidence in you.',
 'Your diplomatic service is exceptionally successful.'
], [injury,
 'A negotiation failure brings disgrace upon you and your clan.',
 'Another envoy undermines your assignment.',
 'Someone tries to assassinate you.',
 'During a long posting far from home, an ambitious replacement takes your position.',
 'An insulting human ambassador tests your restraint and may provoke a duel.'
]);
career('aslan.guardian', [disaster,
 'You learn a damaging secret about your family, pride or clan and must decide how to use it.',
 'An accomplished duellist trains you.',
 'Your superiors entrust you with a demanding task.', training, life,
 'The success of your clan or pride opens opportunities for you.',
 'You acquire greater influence within your clan or pride.',
 'A relative acts dishonourably; exposing the act could lead to a duel.',
 'Senior clan or pride leaders place their confidence in you.',
 'Your work brings exceptional recognition.'
], [injury,
 'A serious violation of protocol costs you your standing.',
 'A political scandal leads to your exile.',
 'A duel leaves you wounded.',
 'You must defend yourself against a false criminal accusation.',
 'A competing official works against you.'
]);
career('aslan.manager', [disaster,
 'Your workplace comes under attack from a hostile clan.',
 'Practical work broadens your technical skills.',
 'A risky commercial venture offers a chance to invest your benefits.', training, life,
 'Your business reaches new territories.',
 'A clan member makes a decision that puts your enterprise at risk.',
 'Your clan enjoys a period of commercial success.',
 'You conduct business with non-Aslan traders.',
 'Your management work earns exceptional recognition.'
], [injury,
 'Your employer accuses you of theft; your response depends on whether the accusation is true.',
 'Changing clan politics exclude you, although someone remains in touch.',
 'Your clan suffers a reversal of fortune.',
 'A border-world posting offers little room for advancement.',
 'A senior female clan member becomes hostile toward you.'
]);
career('aslan.military', [disaster,
 'Your unit enters exceptionally dangerous combat.',
 'You serve in a garrison at a clan outpost.',
 'You take part in a border clash with another clan.', training, life,
 'You fight an enemy of another species.',
 'An officer questions your bravery; you can challenge them or demonstrate your courage.',
 'Your service brings you to the attention of the officer caste.',
 'You serve alongside a celebrated clan warrior.',
 'Your actions achieve a major victory for your clan.'
], [severe,
 'A superior officer works against you.',
 'You become isolated behind enemy lines.',
 'An enemy captures you and demands a ransom from your clan.',
 'A dangerous skirmish tests whether you will stand and fight.', injury
]);
career('aslan.military-officer', [disaster,
 'You command during a harsh ground campaign.',
 'A subordinate officer defies you and must be disciplined.',
 'You serve in a garrison on a wealthy Aslan world.', training, life,
 'Your clan formally recognises your military service.',
 'You capture an opposing commander and must decide whether to release or ransom him.',
 'A rival challenges you to single combat.',
 'Your exploits become renowned throughout your clan.',
 'Your actions achieve a major victory for your clan.'
], [severe,
 'Your failure inflicts a disastrous loss on your clan.',
 'A political reversal within the clan undermines your prospects.',
 'An opposing commander defeats you in battle.',
 'Another clan captures and ransoms you, bringing disgrace.', injury
]);
career('aslan.scientist', [disaster,
 'You develop interests and connections beyond the laboratory.',
 'Your clan assigns you to weapons research.',
 'You collaborate closely with a scientist of another species.', training, life,
 'You teach the next generation of your clan.',
 'A competing researcher nears a discovery you want; you can race them, sabotage them or stand aside.',
 'You study an unusual alien object or organism.',
 'You study at a distinguished academic or research institution.',
 'Your research produces an important discovery.'
], [injury,
 'A laboratory accident exposes you to a harmful substance.',
 'A competing scientist deliberately damages your research.',
 'A laboratory ship misjump strands you on an unfamiliar world.',
 'A clan elder disputes the quality of your research, giving you a chance to challenge them.',
 'Your clan withdraws support for your research; continuing in human space is an option.'
]);
career('aslan.spacer', [disaster,
 'Pirates attack your ship and threaten its cargo.',
 'You are offered an opportunity to carry contraband.',
 'Your service brings you to the attention of the space officer caste.',
 'A trading voyage introduces you to varied worlds and cultures.', life,
 'You transport Aslan settlers to their new home.',
 'Fierce battles against your clan enemies force a choice between bravery and caution.',
 'Your service brings you to the attention of the space officer caste.',
 'Your captain recognises your promise with an important ceremonial responsibility.',
 'Your actions achieve a major victory for your clan.'
], [severe,
 'A superior officer works against you.',
 'You contract an infection from an alien parasite.',
 'You face accusations of bringing contraband into clan territory.',
 'A confrontation on an alien world tests your tolerance.', injury
]);
career('aslan.space-officer', [disaster,
 'Pirates attack your ship and threaten its cargo.',
 'You are offered an opportunity to carry contraband.',
 'You gain experience outside Aslan territory.', training, life,
 'Your clan formally recognises your service.',
 'Your ship attacks a rival clan colony, where ruthless tactics could force the settlers out.',
 'A rival challenges you to single combat.',
 'You form a friendship with a veteran Aslan admiral.',
 'Your actions achieve a major victory for your clan.'
], [severe,
 'You are blamed when a disaster disables your ship and can contest the accusation.',
 'A political reversal within the clan undermines your prospects.',
 'An enemy destroys your vessel in combat.',
 'Another clan captures and ransoms you, bringing disgrace.', injury
]);
career('aslan.outcast', [disaster,
 'A landowner offers patronage in return for a substantial obligation.',
 'Necessity teaches you a broad range of practical skills.',
 'You earn passage aboard a spacecraft by working.',
 'Life on society margins brings you a new connection.', life,
 'Thieves attack, leaving you to fight or escape.',
 'A frontier-bound ihatei invites you to join his followers.',
 'An outlaw group or wandering ship offers you a place.',
 'Your clan offers a route back to honour in return for a debt to an elder.',
 'You endure the hardships of outcast life.'
], [severe,
 'People you relied upon abandon you.',
 'Young Aslan criminals assault you.',
 'A dangerous illness threatens your life.',
 'Stealing from a noble forces you to flee his agents.', injury
]);
career('aslan.outlaw', [disaster,
 'You struggle to stay alive on the outskirts of Aslan territory.',
 'A criminal venture proves profitable.',
 'A clan offers a bounty for your capture; you may try to collect it through deception.',
 'You make a connection in the criminal underworld.', life,
 'Outlaw life develops your practical abilities.',
 'You undertake a daring attack against a rival.',
 'A clan offers you a covert job; you could instead alert its enemies.',
 'An opportunity arises to recover your place in Aslan society.',
 'Your notorious exploits become widely known.'
], [severe,
 'The clan you robbed captures and punishes you.',
 'A competing outlaw group attacks you.',
 'You must escape the planet.',
 'Someone betrays your trust.', injury
]);
career('aslan.wanderer', [disaster,
 'A border patrol intercepts your vessel.',
 'You spend considerable time dealing with non-Aslan.',
 'An opportunity arises to sell Aslan goods.',
 'You make a connection at a remote spaceport.', life,
 'Work aboard your vessel develops your shipboard skills.',
 'You recruit replacement crew whose loyalties are uncertain.',
 'Your travels take you into the hazardous fringes of Aslan territory.',
 'You locate worlds that could become targets for clan expansion.',
 'You discover territory that nobody has claimed.'
], [severe,
 'Your vessel crash-lands on a deserted world.',
 'A fruitless search for employment or land leaves you starving.',
 'Outlaws or alien raiders attack your vessel.',
 'A competing ihatei damages your ship through sabotage.', injury
]);
career('vargr.agent', [disaster,
 'An investigation becomes unexpectedly hazardous.',
 'You build a network of useful personal connections.',
 'A completed operation earns you a reward.', training, life,
 'An investigation reveals a stockpile of contraband you could exploit.',
 'An undercover assignment requires you to adopt another occupation.',
 'You rescue a member of your pack during a dangerous assignment.',
 'Your record of success impresses your superiors.',
 'You crack a major investigation or reveal a plot against your employers.'
], [severe,
 'An influential criminal offers a deal that would compromise your position.',
 'A disastrous operation leaves you defending your conduct.',
 'An unsuccessful mission triggers a struggle over pack leadership.',
 'Dangerous information makes you a target.', injury
]);
career('vargr.citizen', [disaster,
 'A contest for pack leadership forces you to choose a side.',
 'You pursue additional education.',
 'Your organisation expands.',
 'You receive training to develop an existing ability.', life,
 'You discover a business secret or political scandal that could be exploited.',
 'Your pack leader commends your work.',
 'Declining confidence in your leader creates an opportunity to replace them.',
 'You back a pack member who takes over the leadership.',
 'Your work earns widespread respect within the pack and organisation.'
], [injury,
 'Your mistake has serious consequences for your workplace or community.',
 'An economic downturn costs you your employment.',
 'Investigators suspect your workplace or community of wrongdoing.',
 'Violent upheaval forces you offworld and threatens your place in a pack.',
 'You lose out in a contest for influence within your pack.'
]);
career('vargr.intermediary', [disaster,
 'Negotiations deteriorate; you can withdraw or try to recover the situation.',
 'You resolve a difficult negotiation and receive a reward.',
 'Your work introduces you to influential people.', training, life,
 'Sustained professional effort develops your negotiating expertise.',
 'An opposing leader offers you a profitable opportunity to change sides.',
 'Your reputation creates an opportunity to become pack leader.',
 'Professional success leaves you well placed for a reward or advancement.',
 'Your work provides exceptional service to your pack and employers.'
], [injury,
 'Unsuccessful negotiations damage your reputation and cost you your position.',
 'A competing intermediary proves more capable than you.',
 'Failed negotiations provoke a contest over pack leadership.',
 'Someone tries to assassinate you.',
 'Another intermediary attempts to publicly undermine you.'
]);
career('vargr.loner', [disaster,
 'A prospective patron offers you employment.',
 'Living independently puts your specialist abilities to use.',
 'Self-reliance teaches you to cope with many different tasks.',
 'Corsairs attack or board you and may offer you a place among them.', life,
 'You discover abandoned property or salvage during your travels.',
 'An expedition proves successful.',
 'Harsh conditions test your ability to survive.',
 'Your independent work brings notable success.',
 'You discover an exceptionally valuable find.'
], [injury,
 'Isolation becomes difficult to endure.',
 'Another loner competes with you for scarce opportunities.',
 'A crash or other misfortune strands you in a dangerous wilderness.',
 'Corsairs ambush you.',
 'You cannot remember a period of your life.'
]);
career('vargr.merchant', [disaster,
 'Someone asks you to obtain or transport contraband.',
 'You secure an unusually favourable purchase.',
 'You attend a professional training course.',
 'You clear your business of suspicions of illegal conduct.', life,
 'You conclude a particularly profitable agreement.',
 'Your business helps keep another company afloat.',
 'You establish a network of commercial connections.',
 'You trade with a powerful company or organisation.',
 'Your enterprise enjoys exceptional success.'
], [injury,
 'Disrupted trade routes put an end to your business.',
 'Illegal activity by you or your pack threatens criminal consequences.',
 'A commercial competitor drives you out of business.',
 'An employee challenges you for control of the pack.',
 'A severe economic downturn bankrupts your business.'
]);
career('vargr.military', [disaster,
 'You are posted to a dangerous planetary environment.',
 'You serve in a city devastated by war.',
 'Your pack receives an important special duty.',
 'Your leader dies during a fierce ground campaign, creating a chance to take command.', life,
 'You receive training to develop an existing ability.',
 'You withstand a siege by a stronger enemy until reinforcements arrive.',
 'You undertake peacekeeping duties.',
 'You rescue your pack leader during combat.',
 'Your bravery in battle wins exceptional recognition.'
], [severe,
 'After a battle kills much of your unit, you publicly hold your leader responsible.',
 'You fight rebels and guerrillas in a hostile territory.',
 'Your leader involves the pack in criminal trade; a cover-up threatens your career.',
 'You fail an essential military assignment.', injury
]);
career('vargr.psion', [disaster,
 'Helping someone with psionics could reveal your abilities.',
 'You encounter an alien device with unpredictable effects.',
 'Your psionic work earns recognition.',
 'You receive training in a non-psionic discipline.', life,
 'Specialised instruction offers a chance to develop a new psionic talent.',
 'You teach a pack member who has psionic potential.',
 'You devote your free time to strengthening your psionic abilities.',
 'You form a relationship with an experienced mentor.',
 'Your natural psionic ability proves exceptional.'
], [injury,
 'Telepathic contact with an unidentified being leaves you missing for days without memories.',
 'Discovery of your psionic abilities causes your pack to expel you.',
 'You are arrested on a world that prohibits psionics.',
 'You lose a leadership contest in a pack of psions.',
 'An organisation subjects you to experiments with uncertain effects.'
]);
career('vargr.scientist', [disaster,
 'You work on research for the military.',
 'You are assigned to a confidential project that you cannot discuss with your pack.',
 'You work in a laboratory aboard a ship or orbital station.', training, life,
 'Collaboration brings you into contact with multiple research institutions.',
 'You befriend a talented and unconventional mentor.',
 'You make a significant research discovery.',
 'A distinguished organisation employs you.',
 'Your research achieves a major breakthrough.'
], [injury,
 'A laboratory accident exposes you to a harmful substance.',
 'A failed experiment kills several members of your pack.',
 'Your spacecraft crashes while taking you to an offworld laboratory.',
 'Your employers discontinue your research, leaving you to consider another arrangement.',
 'Another scientist undermines your reputation or appropriates your work.'
]);
career('vargr.spacer', [disaster,
 'You receive an important special duty.',
 'You assist another crewmember.',
 'Life aboard ships develops your ability to work in space.', training, life,
 'Shipboard experience develops your technical skills.',
 'The variety of challenges in space teaches you versatility.',
 'Your leader dies, giving you an opportunity to take command.',
 'Your performance earns the confidence of your leader.',
 'Your rapid response prevents the destruction of your vessel.'
], [severe,
 'You compete with a pack member for status and authority.',
 'Your pack is defeated by an opponent.',
 'A serious mistake on your part incapacitates the ship.',
 'You back the defeated faction in a pack leadership struggle.', injury
]);
tables['aslan.life-events'] = rows(2, [
 'Illness or an accident harms your health.',
 'A birth or death changes the life of someone close to you.',
 'A rival challenges your claim, or your family claim, to territory.',
 'Marriage, a change in your household or the death of a mate alters your family life.',
 'A development within your clan affects you.',
 'You form a new personal connection.',
 'A development within your clan affects you.',
 'You relocate to another world.',
 'A dispute over family honour leads to a duel challenge.',
 'A criminal accusation threatens your honour and place in Aslan society.',
 'An extraordinary experience calls for an unusual event.'
]);
tables['aslan.clan-events'] = rows(1, [
 'New territory or trade brings prosperity to your clan.',
 'Your family gains political influence.',
 'A relative reaches a position of power.',
 'Your family enters a feud with another family.',
 'Your clan becomes involved in a war.',
 'Economic difficulties undermine your clan fortunes.'
]);
tables['aslan.unusual-events'] = rows(1, [
 'You encounter an unexplained psionic phenomenon.',
 'You travel for an extended period with other species.',
 'You acquire an unusual alien object or archaeological find.',
 'You cannot account for a gap in your memories.',
 'Clan elders entrust you with confidential knowledge or an assignment.',
 'You acquire technology that predates the Aslan civilisation.'
]);
tables['vargr.life-events'] = rows(2, [
 'Illness or an accident harms your health.',
 'A birth or death changes the life of someone close to you.',
 'A romantic relationship ends through separation or loss.',
 'You begin a romantic relationship.',
 'A development within your pack affects you.',
 'You form a new personal connection.',
 'A development within your pack affects you.',
 'You relocate to another world.',
 'An unexpected favourable turn improves your life.',
 'You are involved in, or accused of, criminal activity.',
 'An extraordinary experience calls for an unusual event.'
]);
tables['vargr.pack-events'] = rows(1, [
 'Your failure causes serious difficulties for your pack.',
 'Your position within the pack is disrupted.',
 'You become part of a different pack or social group.',
 'Disappointment with the pack leader prompts a contest over their replacement.',
 'You complete a demanding task with exceptional success.',
 'Your leader fails the pack, creating an opportunity for you to take over.'
]);
tables['vargr.unusual-events'] = rows(1, [
 'An encounter with psionics offers a chance to investigate your own potential.',
 'You spend an extended period among another species.',
 'You acquire an unusual alien object or archaeological find.',
 'You cannot account for a gap in your memories.',
 'Your pack gains prominence and deals with a government leader.',
 'You acquire an object thought to date from the Ancients bringing the Vargr to Lair.'
]);
tables['aslan.rite-doubles'] = aslanRiteNarratives;
export function alienEventNarrative(table, row) {
 const text = Object.hasOwn(tables, table) ? tables[table]?.[Number(row)] : null;
 return typeof text === 'string' ? text : null;
}
export const alienEventNarrativeTables = Object.freeze(Object.keys(tables));

