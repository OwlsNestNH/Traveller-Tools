// Concise original summaries of AoCS1 Update 2026 p.17; no rule mechanics.
const families = {
  outcast: [
    ['Outlaw family', 'You grew up in a family of outlaws.'],
    ['Orphaned', 'Orphaned young, you learned to fend for yourself.'],
    ['Dishonoured ancestry', 'Your family lived with the dishonour of an ancestor.'],
    ['Defiant family', 'Your family broke with its former pride or clan.'],
    ['Exiled among aliens', 'Your exiled family made a home among other species.'],
    ['Inherited illness', 'A genetic illness affected your family.']
  ],
  lower: [
    ['Labouring family', 'You grew up in a labouring family.'],
    ['Menial workers', 'Your family did menial work for a clan or corporation.'],
    ['Factory workers', 'You grew up in a family of factory workers.'],
    ['Enlisted family', 'Your family served as enlisted soldiers or spacers.'],
    ['Belters or miners', 'Your family earned its living as belters or miners.'],
    ['Adopted by a relative', 'A distant relative took you into their household.']
  ],
  middle: [
    ['Managers and leaders', 'Your family managed clan affairs or led a corporation.'],
    ['Estate workers', 'Your family worked another family’s landholding.'],
    ['Craftspeople', 'You grew up among crafters and artisans.'],
    ['Career officers', 'Your family’s officers served in the clan’s ground or space forces.'],
    ['Scholars and advisors', 'Your family worked in science, advising or teaching.'],
    ['Clan functionaries', 'Your family worked in the administration of a pride or clan.']
  ],
  noble: [
    ['An ancestor’s heroism', 'An ancestor’s heroic deeds earned your family its landhold.'],
    ['Reward for service', 'Your family’s landhold rewarded service to its pride or clan.'],
    ['Land won from rivals', 'Your family won its landhold from a rival family.'],
    ['First settlers', 'Your family were the first settlers of these lands.'],
    ['Land through marriage', 'A marriage brought the landhold into your family.'],
    ['Diminished holdings', 'Your family now holds far less land than its ancestors did.']
  ],
  high: [
    ['Corporate ancestry', 'A female ancestor made her name as a successful corporate executive.'],
    ['Warlord ancestry', 'A celebrated warlord is part of your family’s history.'],
    ['Land won from a clan', 'Your family took its landhold from a rival clan.'],
    ['Ancestral advancement', 'Your ancestors advanced through the ranks of their pride or clan.'],
    ['Long-established leaders', 'Your old family has led within the clan for generations.'],
    ['Fading influence', 'Your family no longer has the influence it once enjoyed.']
  ]
};
export const familyBandLabels = {outcast:'Outcast', lower:'Lower class', middle:'Middle class', noble:'Noble', high:'High noble'};
export function familyNarrative(band,die) {
  const row = families[band]?.[die-1];
  return row ? {resultLabel:row[0], narrative:row[1]} : null;
}
export function familyBandFromSOC(soc) {
  return soc===2?'outcast':soc>=3&&soc<=5?'lower':soc>=6&&soc<=8?'middle':soc>=9&&soc<=11?'noble':soc>=12?'high':null;
}
