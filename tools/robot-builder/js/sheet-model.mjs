import {sourceReference} from './rules-presentation.mjs';

// Presentation only: consume evaluated values and already qualified review rows.
// Never infer a missing operating value, parse a rendered statblock, or merge
// a component/implant profile into the host.
const present = value => value !== null && value !== undefined;
const number = new Intl.NumberFormat('en-US', {maximumFractionDigits: 9});
const value = item => present(item) ? typeof item === 'number' ? number.format(item) : String(item) : 'Unresolved';
const fact = (label, text, detail = '', source = '') => ({label, value: text, detail, source});
const compact = row => fact(row.label, row.sheetValue ?? row.value, row.detail, row.source);
const alphabetical = rows => [...rows].sort((a,b) => a.label.localeCompare(b.label, 'en'));

export function projectSheet(design, catalogue, evaluation, review) {
  const totals = evaluation.totals || evaluation.previewTotals;
  const groups = new Map(review.sections.map(group => [group.id,group]));
  const rows = id => groups.get(id)?.rows || [];
  const controls = (catalogue.stages || []).flatMap(stage => (stage.controls || []).map(control => ({...control, stage:stage.id})));
  const selection = (stage, field) => {
    const control = controls.find(control => control.stage === stage && control.field === field);
    if (!control) return null;
    const selected = control.target === 'special' ? design.special?.[field] : design.selections?.[stage]?.[field];
    const choice = control.choices?.find(choice => choice.id === selected);
    return choice ? {id:selected, label:choice.label, source:sourceReference(choice.source || control.source)} : null;
  };
  const primary = selection('locomotion',design.kind==='microbot'?'locomotion':'primary'), secondary = selection('locomotion','secondary');
  const movement = [primary,secondary].filter(item => item && item.id !== 'none');
  const brain = selection('brain',design.kind==='microbot'?'brain':'model'), core = selection('skills','corePackage');
  const empty = totals ? 'None selected' : 'Not calculated';
  const skillEntries = alphabetical([
    ...rows('skills').map(compact),
    ...rows('hardware-skills').map(row => ({...compact(row), detail:[row.detail,'Hardware skill'].filter(Boolean).join('; ')})),
    ...rows('skill-equivalents').map(row => ({...compact(row), detail:'characteristic equivalent'}))
  ]);
  // Scope metadata is already a review fact. Retain it without interpreting
  // labels such as "(all)" as broader purchased coverage.
  const skillQualifications = rows('skills').flatMap(row => (row.details || []).filter(detail =>
    ['Coverage','Coverage Mode','Covered Specialities','Full Coverage','Referee Rule','Scope','Modifier Options'].includes(detail.label)
  ).map(detail => ({...compact(detail),label:row.label+' / '+detail.label})));
  const weapons = rows('weapons').map(compact);
  const traits = [
    ...(present(totals?.armour) ? [fact('Armour',value(totals.armour))] : []),
    ...(totals?.traits || []).map(trait => fact('',String(trait)))
  ];
  const programming = [
    ...(brain ? [fact('',brain.label,'',brain.source)] : []),
    ...(core && core.id !== 'none' ? [fact('',core.label,'',core.source)] : []),
    ...(present(totals?.intelligence) ? [fact('INT',value(totals.intelligence))] : [])
  ];
  const options = [...rows('equipment'),...rows('verified-vehicle-options'),...rows('external-options')].map(compact);
  const endurance = [fact('',present(totals?.endurance) ? value(totals.endurance)+' hours' : 'Unresolved'),
    ...(present(totals?.vehicleEndurance) ? [fact('Vehicle movement',value(totals.vehicleEndurance)+' hours')] : [])];
  const body = [
    {id:'skills', label:'Skills', entries:skillEntries, empty, note:''},
    {id:'attacks', label:'Attacks', entries:weapons, empty, note:weapons.length ? 'Context and readiness conditional.' : ''},
    {id:'manipulators',label:'Manipulators',entries:rows('manipulators').map(compact),empty},
    {id:'endurance',label:'Endurance',entries:endurance},
    {id:'traits',label:'Traits',entries:traits,empty:totals?'None reported':'Not calculated'},
    {id:'programming',label:'Programming',entries:programming,empty:'Not specified; see detailed statblock'},
    {id:'options',label:'Options',entries:options,empty,note:''}
  ];
  const supplements = [];
  const attackFields = new Set(['Linked Weapons','Linked Damage Bonus','Current attack mode','Grapple damage','Consecutive successful rounds','Grapple requirement','Reset','Rider condition','Power endurance','Recharge','Power supplies','Use','Delay','Linked operation','STR damage DM','Fit','Loaded attack status','Loaded linked damage bonus','Manufacture declaration (all linked copies)']);
  const attackQualifications = rows('weapons').flatMap(row => (row.details || []).filter(detail =>
    (attackFields.has(detail.label) && !(detail.label==='Linked Damage Bonus' && row.details.some(item=>item.label==='Loaded attack status'))) || /configured ammunition|\/ Baton split/.test(detail.label)
  ).map(detail => ({...compact(detail),label:row.label+' / '+detail.label})));
  attackQualifications.push(...rows('weapons').flatMap(row=>(row.sheetLoads || []).map(detail=>({...compact(detail),label:row.label+' / '+detail.label}))));
  if (attackQualifications.length) supplements.push({id:'attack-conditions',title:'Attack conditions',rows:attackQualifications});
  if (skillQualifications.length) supplements.push({id:'skill-scope',title:'Skill scope',rows:skillQualifications});
  // Keep contextual/recipient/host boundaries explicit without importing
  // unpurchased source-body statistics into the six-column summary.
  for (const id of ['components','implant-brains','implant-skills','limb-weapons','computers','computer-programs','selected-custom-skills','selected-medical-packages','metamorphic','external-wear','clone-development']) {
    const group = groups.get(id);
    if (!group) continue;
    const records = group.rows.map(row => ({
      ...compact(row),
      details:id === 'components' ? (row.details || []).filter(detail =>
        ['Quantity','Cost scope','Purchase boundary','Source construction','External wear purchase','Construction check'].includes(detail.label)
      ).map(compact) : []
    }));
    supplements.push({id,title:group.title,note:id === 'components'?'Component-owned values only; no host or recipient grant. Detailed profiles remain in the statblock.':group.note,rows:records});
  }
  const costLabel = evaluation.costLabel || totals?.costLabel || 'Construction cost';
  return JSON.parse(JSON.stringify({
    name:review.name,kind:review.kind,status:review.status,provisional:review.provisional,
    provisionalLabel:review.provisional ? review.provisionalLabel : '',
    unavailable:review.unavailable,
    summary:[
      fact('Robot',review.name),
      fact('Hits',value(totals?.hits)),
      fact('Locomotion',movement.length ? movement.map(item=>item.label).join(', ') : primary?.id==='none'?'None selected':'Not specified'),
      fact('Speed',present(totals?.tacticalSpeed)?value(totals.tacticalSpeed)+' m/action':'Unresolved',present(totals?.vehicleBand)?'Vehicle: '+value(totals.vehicleBand):''),
      fact('TL',value(design.techLevel)),
      fact('Cost',present(totals?.cost)?'Cr '+value(totals.cost):'Unresolved',costLabel)
    ],
    constructionCost:present(totals?.constructionCost)&&totals.constructionCost!==totals.cost?'Construction cost: Cr '+value(totals.constructionCost):'',
    body,supplements,
    sources:[...new Set([...movement.map(item=>item.source),...body.flatMap(group=>group.entries.map(item=>item.source))].filter(Boolean))],
    checks:rows('warnings').map(compact),
    footer:'Summary only; coverage incomplete. Use the detailed statblock for full conditions, installation settings and source references.'
  }));
}
