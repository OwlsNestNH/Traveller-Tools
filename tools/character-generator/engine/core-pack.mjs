// Original mechanical data, independently transcribed from the named published source.
// No source-book prose, private source URLs, PDFs, or third-party generator code.
// Public distribution remains subject to the project's licensing/release gate.

export const CORE_PACK_VERSION = 1;
export const CORE_EFFECT_SCHEMA = Object.freeze({
  skill: 'name, mode (increase/set), value; set is a minimum, never a reduction',
  stat: 'name, value (delta); optional minimum applied after the delta',
  'agent-cover': 'originCareerId, source; explicit borrowed career selection, Deception check and queued specialist training',
  choice: 'options: [{label, effects: []}]',
  'assignment-effect': 'assignments: effects keyed by the current assignment',
  'skill-choice': 'scope (any/existing/psionic-talents/science-specialties), mode, value, optional exclude/count/distinctSpecialties',
  'psionic-talent': 'name, mode, value; untrained acquisition-check is mandatory',
  benefit: 'name, value; optional dice for quantity, no equipment/ship resolution implied',
  relationship: 'type, count or dice, optional onlyIfAbsent',
  check: 'stat or skills, target, success/failure effect arrays; optional natural result effects',
  modifier: 'target, value, scope (next/one/all), optional career',
  'benefit-credit': 'value, scope (any/career), source; held until explicitly selected for one Benefit roll',
  'benefit-wager': 'route: source-bound optional current-career stake and explicit skill choice',
  'benefit-rolls': 'value, or mode (retain-term/lose-all)',
  'table-roll': 'table, optional career, dice, keepCareer; may need source-assisted resolution',
  'career-status': 'action (stay/exit/next/auto-qualify), optional career',
  promotion: 'mode (automatic/next-check), optional allowCommission',
  injury: 'table core.injury; optional result or rolls/take/subject',
  random: 'dice, outcomes: [{min,max,effects}]',
  'relationship-change': 'from, to, optional fallback',
  'prisoner-lawyer': 'Core p57 typed hire/decline; affordable square-cost payment, Advocate check and parole reduction',
  parole: 'value delta or mode reset; always apply the published ceiling',
  note: 'short original procedural/narrative label, no mechanical effect',
  unsupported: 'reason and source page; never silently resolve'
});
const skill = (name, mode='increase', value=1) => ({kind:'skill',name,mode,value});
const stat = (name,value=1,minimum) => ({kind:'stat',name,value,...(minimum===undefined?{}:{minimum})});
const choice = options => ({kind:'choice',options:options.map(([label,effects])=>({label,effects}))});
const benefit = (name,value=1,dice) => ({kind:'benefit',name,value,...(dice?{dice}:{})});
const relation = (type,count=1,dice) => ({kind:'relationship',type,count,...(dice?{dice}:{})});
const anySkill = (scope='any',mode='increase',exclude=[]) => ({kind:'skill-choice',scope,mode,value:1,...(exclude.length?{exclude}:{})});
const cell = value => {
  if(Array.isArray(value)) return value;
  if(value==='') return [];
  if(value.includes('&')) return value.split('&').flatMap(cell);
  if(value.includes('|')) return [choice(value.split('|').map(x=>[x,cell(x)]))];
  if(value.startsWith('@')) {
    const [name,quantity='1']=value.slice(1).split(':');
    if(['Contact','Ally','Enemy','Rival'].includes(name)) return [relation(name)];
    return [/^\d+D\d*$/.test(quantity)?benefit(name,1,quantity):benefit(name,Number(quantity))];
  }
  const characteristic=value.match(/^(STR|DEX|END|INT|EDU|SOC|PSI)([+-]\d+)(?:>=(\d+))?$/);
  if(characteristic) return [stat(characteristic[1],Number(characteristic[2]),characteristic[3]===undefined?undefined:Number(characteristic[3]))];
  if(value==='?Talent') return [anySkill('psionic-talents')];
  if(value==='?Talent=1') return [anySkill('psionic-talents','set')];
  const [name,level]=value.split('=');
  return [skill(name,level===undefined?'increase':'set',level===undefined?1:Number(level))];
};
const table = rows => rows.split(';').map(cell);
const ranks = rows => rows.map((row,rank) => {
  const [title='',effect='']=row.split(':');
  return {rank,title,effects:cell(effect)};
});
const make = (page,personal,service,advanced,assignments,cash,material,rankTables,extra={}) => ({
  source:{id:'core',title:'Core Rulebook Update 2022',pages:[page,page+1]},
  basicTraining:{table:'service',firstCareer:'all-at-level-0',laterCareer:'choose-one-at-level-0'},
  training:{personal:table(personal),service:table(service),...(advanced?{advanced:table(advanced)}:{}),
    assignments:Object.fromEntries(Object.entries(assignments).map(([id,rows])=>[id,table(rows)]))},
  prerequisites:advanced?{advanced:{stat:'EDU',min:8}}:{},
  ranks:rankTables,benefits:{cash,material:table(material)},events:{},mishaps:{},unsupported:[],...extra
});

const pack = {
 'core.agent':make(22,
  'Gun Combat;DEX+1;END+1;Melee;INT+1;Athletics',
  'Streetwise;Drive;Investigate;Flyer;Recon;Gun Combat',
  'Advocate;Language;Explosives;Medic;Vacc Suit;Electronics',
  {law:'Investigate;Recon;Streetwise;Stealth;Melee;Advocate',intelligence:'Investigate;Recon;Electronics (comms);Stealth;Persuade;Deception',corporate:'Investigate;Electronics (computers);Stealth;Carouse;Deception;Streetwise'},
  [1000,2000,5000,7500,10000,25000,50000],
  '@Scientific Equipment;INT+1;@Ship Share;@Weapon;@Cybernetic Implant;SOC+1|@Cybernetic Implant;@TAS Membership',
  {assignments:{law:ranks(['Rookie','Corporal:Streetwise=1','Sergeant','Detective','Lieutenant:Investigate=1','Chief:Admin=1','Commissioner:SOC+1']),
    intelligence:ranks(['','Agent:Deception=1','Field Agent:Investigate=1','','Special Agent:Gun Combat=1','Assistant Director','Director']),
    corporate:ranks(['','Agent:Deception=1','Field Agent:Investigate=1','','Special Agent:Gun Combat=1','Assistant Director','Director'])}}),
 'core.army':make(24,
  'STR+1;DEX+1;END+1;Gambler;Medic;Melee',
  'Drive|Vacc Suit;Athletics;Gun Combat;Recon;Melee;Heavy Weapons',
  'Tactics (military);Electronics;Navigation;Explosives;Engineer;Survival',
  {support:'Mechanic;Drive|Flyer;Profession;Explosives;Electronics (comms);Medic',infantry:'Gun Combat;Melee;Heavy Weapons;Stealth;Athletics;Recon',cavalry:'Mechanic;Drive;Flyer;Recon;Heavy Weapons (vehicle);Electronics (sensors)'},
  [2000,5000,10000,10000,10000,20000,30000],
  '@Cybernetic Implant;INT+1;EDU+1;@Weapon;@Armour;END+1|@Cybernetic Implant;SOC+1',
  {enlisted:ranks(['Private:Gun Combat=1','Lance Corporal:Recon=1','Corporal','Lance Sergeant:Leadership=1','Sergeant','Gunnery Sergeant','Sergeant Major']),
    officer:ranks(['','Lieutenant:Leadership=1','Captain','Major:Tactics (military)=1','Lieutenant Colonel','Colonel','General:SOC+1>=10'])}),
 'core.citizen':make(26,
  'EDU+1;INT+1;Carouse;Gambler;Drive;Jack-of-all-Trades',
  'Drive;Flyer;Streetwise;Melee;Steward;Profession',
  'Art;Advocate;Diplomat;Language;Electronics (computers);Medic',
  {corporate:'Advocate;Admin;Broker;Electronics (computers);Diplomat;Leadership',worker:'Drive;Mechanic;Electronics;Engineer;Profession;Science',colonist:'Animals;Athletics;Jack-of-all-Trades;Drive;Survival;Recon'},
  [2000,5000,10000,10000,10000,50000,100000],
  '@Ship Share;@Ally;INT+1;@Gun;EDU+1;@Ship Share:2;@TAS Membership',
  {assignments:{corporate:ranks(['','','Manager:Admin=1','','Senior Manager:Advocate=1','','Director:SOC+1']),
    worker:ranks(['','','Technician:Profession=1','','Craftsman:Mechanic=1','','Master Technician:Engineer=1']),
    colonist:ranks(['','','Settler:Survival=1','','Explorer:Navigation=1','',':Gun Combat=1'])}},
  {basicTraining:{table:'assignment',firstCareer:'all-at-level-0',laterCareer:'choose-one-at-level-0'},prerequisites:{advanced:{stat:'EDU',min:10}}}),
 'core.drifter':make(28,
  'STR+1;END+1;DEX+1;Language;Profession;Jack-of-all-Trades',
  'Athletics;Melee (unarmed);Recon;Streetwise;Stealth;Survival',null,
  {barbarian:'Animals;Carouse;Melee (blade);Stealth;Seafarer (personal)|Seafarer (sail);Survival',wanderer:'Drive;Deception;Recon;Stealth;Streetwise;Survival',scavenger:'Pilot (small craft);Mechanic;Astrogation;Vacc Suit;Profession;Gun Combat'},
  [0,0,1000,2000,3000,4000,8000],
  '@Contact;@Weapon;@Ally;@Weapon;EDU+1;@Ship Share;@Ship Share:2',
  {assignments:{barbarian:ranks(['',':Survival=1','Warrior:Melee (blade)=1','','Chieftain:Leadership=1','','Warlord']),
    wanderer:ranks(['',':Streetwise=1','',':Deception=1','','','']),
    scavenger:ranks(['',':Vacc Suit=1','',':Profession (belter)=1|Mechanic=1','','',''])}},
  {basicTraining:{table:'assignment',firstCareer:'all-at-level-0',laterCareer:'choose-one-at-level-0'}}),
 'core.entertainer':make(30,
  'DEX+1;INT+1;SOC+1;Language;Carouse;Jack-of-all-Trades',
  'Art;Carouse;Deception;Drive;Persuade;Steward',
  'Advocate;Broker;Deception;Science;Streetwise;Diplomat',
  {artist:'Art;Carouse;Electronics (computers);Gambler;Persuade;Profession',journalist:'Art (holography)|Art (write);Electronics;Drive;Investigate;Recon;Streetwise',performer:'Art (performer)|Art (instrument);Athletics;Carouse;Deception;Stealth;Streetwise'},
  [0,0,10000,10000,40000,40000,80000],
  '@Contact;SOC+1;@Contact;SOC+1;INT+1;@Ship Share:2;SOC+1&EDU+1',
  {assignments:{artist:ranks(['',':Art=1','',':Investigate=1','','Famous Artist:SOC+1','']),
    journalist:ranks(['','Freelancer:Electronics (comms)=1','Staff Writer:Investigate=1','','Correspondent:Persuade=1','','Senior Correspondent:SOC+1']),
    performer:ranks(['',':DEX+1','',':STR+1','','Famous Performer:SOC+1',''])}},
  {prerequisites:{advanced:{stat:'EDU',min:10}}}),
 'core.marine':make(32,
  'STR+1;DEX+1;END+1;Gambler;Melee (unarmed);Melee (blade)',
  'Athletics;Vacc Suit;Tactics;Heavy Weapons;Gun Combat;Stealth',
  'Medic;Survival;Explosives;Engineer;Pilot;Navigation',
  {support:'Electronics;Mechanic;Drive|Flyer;Medic;Heavy Weapons;Gun Combat',star:'Vacc Suit;Athletics;Gunner;Melee (blade);Electronics;Gun Combat',ground:'Vacc Suit;Heavy Weapons;Recon;Melee (blade);Tactics (military);Gun Combat'},
  [2000,5000,5000,10000,20000,30000,40000],
  '@Armour;INT+1;EDU+1;@Weapon;@TAS Membership;@Armour|END+1;SOC+2',
  {enlisted:ranks(['Marine:Gun Combat=1|Melee (blade)=1','Lance Corporal:Gun Combat=1','Corporal','Lance Sergeant:Leadership=1','Sergeant','Gunnery Sergeant:END+1','Sergeant Major']),
    officer:ranks(['','Lieutenant:Leadership=1','Captain','Force Commander:Tactics=1','Lieutenant Colonel','Colonel:SOC+1>=10','Brigadier'])}),
 'core.merchant':make(34,
  'STR+1;DEX+1;END+1;INT+1;Language;Streetwise',
  'Drive;Vacc Suit;Broker;Steward;Electronics;Persuade',
  'Engineer;Astrogation;Electronics;Pilot;Admin;Advocate',
  {marine:'Pilot;Vacc Suit;Athletics;Mechanic;Engineer;Electronics',free:'Pilot (spacecraft);Vacc Suit;Deception;Mechanic;Streetwise;Gunner',broker:'Admin;Advocate;Broker;Streetwise;Deception;Persuade'},
  [1000,5000,10000,20000,20000,40000,40000],
  '@Blade;INT+1;EDU+1;@Gun;@Ship Share;@Free Trader;@Free Trader',
  {assignments:{marine:ranks(['Crewman','Senior Crewman:Mechanic=1','4th Officer','3rd Officer','2nd Officer:Pilot=1','1st Officer:SOC+1','Captain']),
    free:ranks(['',':Persuade=1','','Experienced Trader:Jack-of-all-Trades=1','','','']),
    broker:ranks(['',':Broker=1','','Experienced Broker:Streetwise=1','','',''])}}),
 'core.navy':make(36,
  'STR+1;DEX+1;END+1;INT+1;EDU+1;SOC+1',
  'Pilot;Vacc Suit;Athletics;Gunner;Mechanic;Gun Combat',
  'Electronics;Astrogation;Engineer;Flyer;Medic;Admin',
  {crew:'Electronics;Mechanic;Gun Combat;Flyer;Melee;Vacc Suit',technical:'Engineer;Mechanic;Electronics;Engineer;Gunner;Flyer',flight:'Pilot;Flyer;Gunner;Pilot (small craft);Astrogation;Electronics'},
  [1000,5000,5000,10000,20000,50000,50000],
  '@Personal Vehicle|@Ship Share;INT+1;EDU+1|@Ship Share:2;@Weapon;@TAS Membership;@Ship’s Boat|@Ship Share:2;SOC+2',
  {enlisted:ranks(['Crewman','Able Spacehand:Mechanic=1','Petty Officer, 3rd class:Vacc Suit=1','Petty Officer, 2nd class','Petty Officer, 1st class:END+1','Chief Petty Officer','Master Chief']),
    officer:ranks(['','Ensign:Melee (blade)=1','Sublieutenant:Leadership=1','Lieutenant','Commander:Tactics (naval)=1','Captain:SOC+1>=10','Admiral:SOC+1>=12'])}),
 'core.noble':make(38,
  'STR+1;DEX+1;END+1;Gambler;Gun Combat;Melee',
  'Admin;Advocate;Electronics;Diplomat;Investigate;Persuade',
  'Science;Advocate;Language;Leadership;Diplomat;Art',
  {administrator:'Admin;Advocate;Broker;Diplomat;Leadership;Persuade',diplomat:'Advocate;Carouse;Electronics;Steward;Diplomat;Deception',dilettante:'Carouse;Deception;Flyer;Streetwise;Gambler;Jack-of-all-Trades'},

  [10000,10000,50000,50000,100000,100000,200000],
  '@Ship Share;@Ship Share:2;@Blade;SOC+1;@TAS Membership;@Yacht;SOC+1&@Yacht',
  {assignments:{administrator:ranks(['Assistant','Clerk:Admin=1','Supervisor','Manager:Advocate=1','Chief','Director:Leadership=1','Minister']),
    diplomat:ranks(['Intern','3rd Secretary:Admin=1','2nd Secretary','1st Secretary:Advocate=1','Counsellor','Minister:Diplomat=1','Ambassador']),
    dilettante:ranks(['Wastrel','','Ingrate:Carouse=1','','Black Sheep:Persuade=1','','Scoundrel:Jack-of-all-Trades=1'])}},
  {qualificationOverride:{stat:'SOC',min:10,automatic:true}}),
 'core.rogue':make(40,
  'Carouse;DEX+1;END+1;Gambler;Melee;Gun Combat',
  'Deception;Recon;Athletics;Gun Combat;Stealth;Streetwise',
  'Electronics;Navigation;Medic;Investigate;Broker;Advocate',
  {thief:'Stealth;Electronics;Recon;Streetwise;Deception;Athletics',enforcer:'Gun Combat;Melee;Streetwise;Persuade;Athletics;Drive',pirate:'Pilot;Astrogation;Gunner;Engineer;Vacc Suit;Melee'},
  [0,0,10000,10000,50000,100000,100000],
  '@Ship Share;@Weapon;INT+1;@Ship Share:1D;@Armour;DEX+1;@Ship Share:2D',
  {assignments:{thief:ranks(['',':Stealth=1','',':Streetwise=1','',':Recon=1','']),
    enforcer:ranks(['',':Persuade=1','',':Gun Combat=1|Melee=1','',':Streetwise=1','']),
    pirate:ranks(['Lackey','Henchman:Pilot=1|Gunner=1','Corporal','Sergeant:Gun Combat=1|Melee=1','Lieutenant','Leader:Leadership=1','Captain'])}},
  {prerequisites:{advanced:{stat:'EDU',min:10}}}),
 'core.scholar':make(42,
  'INT+1;EDU+1;SOC+1;DEX+1;END+1;Language',
  'Drive|Flyer;Electronics;Diplomat;Medic;Investigate;Science',
  'Art;Advocate;Electronics;Language;Engineer;Science',
  {field:'Electronics;Vacc Suit;Navigation;Survival;Investigate;Science',scientist:'Admin;Engineer;Science;Science;Electronics;Science',physician:'Medic;Electronics;Investigate;Medic;Persuade;Science'},
  [5000,10000,20000,30000,40000,60000,100000],
  'INT+1;EDU+1;@Ship Share:2;SOC+1;@Scientific Equipment;@Lab Ship;@Lab Ship',
  {assignments:{field:ranks(['',':Science=1',':Electronics (computers)=1',':Investigate=1','',':Science=2','']),
    scientist:ranks(['',':Science=1',':Electronics (computers)=1',':Investigate=1','',':Science=2','']),
    physician:ranks(['',':Medic=1','',':Science=1','',':Science=2',''])}},
  {prerequisites:{advanced:{stat:'EDU',min:10}}}),
 'core.scout':make(44,
  'STR+1;DEX+1;END+1;INT+1;EDU+1;Jack-of-all-Trades',
  'Pilot (small craft)|Pilot (spacecraft);Survival;Mechanic;Astrogation;Vacc Suit;Gun Combat',
  'Medic;Language;Seafarer;Explosives;Science;Jack-of-all-Trades',
  {courier:'Electronics;Flyer;Pilot (spacecraft);Engineer;Athletics;Astrogation',surveyor:'Electronics;Persuade;Pilot;Navigation;Diplomat;Streetwise',explorer:'Electronics;Pilot;Engineer;Science;Stealth;Recon'},
  [20000,20000,30000,30000,50000,50000,50000],
  '@Ship Share;INT+1;EDU+1;@Weapon;@Weapon;@Scout Ship;@Scout Ship',
  {default:ranks(['','Scout:Vacc Suit=1','','Senior Scout:Pilot=1','','',''])}),
 'core.prisoner':make(56,
  'STR+1;Melee (unarmed);END+1;Jack-of-all-Trades;EDU+1;Gambler',
  'Athletics;Deception;Profession;Streetwise;Melee (unarmed);Persuade',null,
  {inmate:'Stealth;Melee (unarmed);Streetwise;Survival;Athletics (strength);Mechanic',thug:'Persuade;Melee (unarmed);Melee (unarmed);Melee (blade);Athletics (strength);Athletics (strength)',fixer:'Investigate;Broker;Deception;Streetwise;Stealth;Admin'},
  [0,0,100,200,500,1000,2500],
  '@Contact;@Blade;Deception|Persuade|Stealth;@Ally;Melee|Recon|Streetwise;STR+1|END+1;Deception&Persuade&Stealth',
  {default:ranks([':Melee (unarmed)=1','',':Athletics=1','',':Advocate=1','',':END+1'])},
  {specialRules:{forcedEntry:true,assignmentChangeEachTerm:true,parole:{initialDice:'1D+2',maximum:12,release:'advancement-total-strictly-greater'},mishapsDoNotEject:true,anagathics:false,sourcePage:52}}),
 'core.psion':make(236,
  'EDU+1;INT+1;STR+1;DEX+1;END+1;PSI+1',
  'Telepathy;Clairvoyance;Telekinesis;Awareness;Teleportation;?Talent',
  'Language;Art;Electronics;Medic;Science;Mechanic',
  {wild:'Telepathy;Telekinesis;Deception;Stealth;Streetwise;Melee|Gun Combat',adept:'Telepathy;Clairvoyance;Awareness;Medic;Persuade;Science',warrior:'Telepathy;Awareness;Teleportation;Gun Combat;Vacc Suit;Recon'},
  [1000,2000,4000,4000,8000,8000,16000],
  '@Gun;@Ship Share:2;@Contact;@TAS Membership;@Contact;@Combat Implant;@Ship Share:10',
  {assignments:{wild:ranks(['','Survivor:Survival=1|Streetwise=1','','Witch:Deception=1','','','']),
    adept:ranks(['','Initiate:Science (psionicology)=1','','Acolyte:?Talent=1','','','Master:?Talent=1']),
    warrior:ranks(['Psi-Soldier',':Gun Combat=1','Knight:Leadership=1','','','Master of Wills:Tactics=1',''])}},
  {basicTraining:{table:'assignment',firstCareer:'all-at-level-0',laterCareer:'choose-one-at-level-0'},
   specialRules:{refereePermission:true,assignmentsAreSeparateCareers:true,talentAcquisitionRequired:true,sourcePage:229},
   progression:{wild:{survival:{stat:'SOC',target:6},advancement:{stat:'INT',target:8}},adept:{survival:{stat:'EDU',target:4},advancement:{stat:'EDU',target:8}},warrior:{survival:{stat:'END',target:6},advancement:{stat:'END',target:6}}}})
};
for(const [id,rows] of Object.entries({
 'core.army':'Tactics (military);Leadership;Advocate;Diplomat;Electronics;Admin',
 'core.marine':'Electronics;Tactics;Admin;Advocate;Diplomat;Leadership',
 'core.navy':'Leadership;Electronics;Pilot;Melee (blade);Admin;Tactics (naval)'
})) {
 pack[id].training.officer=table(rows);
 pack[id].prerequisites.officer={commissioned:true};
}
pack['core.psion'].training.service=pack['core.psion'].training.service.map(row=>row.map(effect=>effect.kind==='skill'?{...effect,kind:'psionic-talent',untrained:'acquisition-check'}:{...effect,untrained:'acquisition-check',source:{id:'core',page:236},label:'Choose a psionic talent to improve, or attempt to acquire an untrained talent'}));

// Event and mishap outcomes are mechanical instructions, not source narration.
// Missing procedural handlers must pause for source-assisted resolution.
const check = (name,target,success=[],failure=[],extra={}) => ({
 kind:'check',...(/^[A-Z]{3}$/.test(name)?{stat:name}:{skills:name.split('|')}),target,success,failure,...extra
});
const mod = (target,value,scope='next',career='current') => ({kind:'modifier',target,value,scope,career});
const rolls = value => ({kind:'benefit-rolls',value});
const retain = () => ({kind:'benefit-rolls',mode:'retain-term'});
const loseAll = () => ({kind:'benefit-rolls',mode:'lose-all'});
const status = (action,career) => ({kind:'career-status',action,...(career?{career}:{})});
const injury = (extra={}) => ({kind:'injury',table:'core.injury',...extra});
const severe = () => choice([
 ['Injury result 2',[injury({result:2})]],
 ['Two injury rolls, lower result',[injury({rolls:2,take:'lower'})]]
]);
const tableRoll = (table,extra={}) => ({kind:'table-roll',table,...extra});
const mishap = (keepCareer=false) => tableRoll('mishap',{dice:'1D',keepCareer});
const life = () => tableRoll('core.life-events',{dice:'2D',sourcePage:46});
const unusual = () => tableRoll('core.unusual-events',{dice:'1D',sourcePage:46});
const promote = (allowCommission=false,mode='automatic') => ({kind:'promotion',mode,allowCommission});
const random = (dice,outcomes) => ({kind:'random',dice,outcomes:outcomes.map(([min,max,effects])=>({min,max,effects}))});
const changeRelationship = (from,to,fallback=false) => ({kind:'relationship-change',from,to,fallback});
const parole = value => ({kind:'parole',value});
const unsupported = (page,reason) => ({kind:'unsupported',reason,source:{id:'core',page}});
const optional = effects => choice([['Accept',effects],['Decline',[]]]);
const use = value => cell(value);
const prisonOnTwo = () => random('2D',[[2,2,[status('next','core.prisoner')]],[3,12,[]]]);
const mentor = (effect,ally=false) => [
 ...(ally?[relation('Ally')]:[]),
 choice([['Skill',[...use(effect)]],['Advancement bonus',[mod('advancement',4)]]])
];
const common = (id,events,mishaps) => {
 pack[id].events={2:[mishap(true)],7:[life()],12:[promote()],...events};
 pack[id].mishaps={1:[severe()],6:[injury()],...mishaps};
};
common('core.agent',{
 3:[check('Investigate|Streetwise',8,use('Deception|Jack-of-all-Trades|Persuade|Tactics'),[mishap()])],
 4:[mod('benefit',1,'one')],
 5:[relation('Contact',1,'D3')],
 6:[check('EDU',8,[anySkill('existing')])],
 8:[{kind:'agent-cover',originCareerId:'core.agent',source:{id:'core',page:23}}],
 9:[mod('advancement',2)],
 10:use('Drive=1|Flyer=1|Pilot=1|Gunner=1'),
 11:mentor('Investigate')
},{
 2:[choice([['Accept deal',[]],['Refuse deal',[injury({rolls:2,take:'lower'}),relation('Enemy'),anySkill()]]])],
 3:[check('Advocate',8,[retain()],[],{natural:{2:[status('next','core.prisoner')]}})],
 4:[relation('Enemy'),...use('Deception=1')],
 5:[injury({rolls:2,take:'lower',subject:'chosen-contact-ally-or-family'})]
});
common('core.army',{
 3:use('Vacc Suit=1|Engineer=1|Animals (riding)=1|Animals (training)=1|Recon=1'),
 4:use('Stealth=1|Streetwise=1|Persuade=1|Recon=1'),
 5:[mod('benefit',1,'one')],
 6:[check('EDU',8,use('Gun Combat|Leadership'),[injury()])],
 8:[check('EDU',8,[anySkill('existing')])],
 9:[mod('advancement',2)],
 10:use('Admin=1|Investigate=1|Deception=1|Recon=1'),
 11:mentor('Tactics (military)=1'),
 12:[promote(true)]
},{
 2:[relation('Enemy')],
 3:[...use('Recon|Survival'),relation('Enemy')],
 4:[choice([['Join',[relation('Ally')]],['Cooperate',[retain()]]])],
 5:[relation('Rival')]
});
common('core.citizen',{
 3:[choice(['Advocate','Persuade','Explosives','Streetwise'].map(name=>[name,[...use(name+'=1'),check(name,8,[mod('advancement',2)],[mod('survival',-2)])]]))],
 4:use('Mechanic|Drive|Electronics|Flyer|Engineer'),
 5:[mod('benefit',1,'one')],
 6:[check('EDU',10,[anySkill('any','set')])],
 8:[optional([mod('benefit',1,'one'),choice([['Streetwise',use('Streetwise=1')],['Deception',use('Deception=1')],['Criminal contact',[relation('Contact')]]])])],
 9:[mod('advancement',2)],
 10:use('Electronics|Engineer'),
 11:mentor('Diplomat=1',true)
},{
 2:[relation('Enemy')],
 3:[stat('SOC',-1)],
 4:[choice([['Cooperate',[mod('qualification',2,'next','any')]],['Refuse',[relation('Ally')]]])],
 5:[check('Streetwise',8,[anySkill('existing')])]
});
common('core.drifter',{
 3:[optional([mod('qualification',4,'next','any'),{kind:'note',text:'A favour is owed to the patron.'}])],
 4:use('Jack-of-all-Trades|Survival|Streetwise|Melee'),
 5:[mod('benefit',1,'one')],
 6:[unusual()],
 8:[{...relation('Enemy'),onlyIfAbsent:true},check('Melee|Gun Combat|Stealth',8,[],[injury()])],
 9:[optional([random('1D',[
   [1,2,[choice([['Injury',[injury()]],['Prison',[status('next','core.prisoner')]]])]],
   [3,4,[]],[5,6,[mod('benefit',4,'one')]]
 ])])],
 10:[anySkill('existing')],
 11:[status('next','draft')]
},{
 2:[injury()],
 3:[relation('Enemy')],
 4:[stat('END',-1)],
 5:[changeRelationship(['Contact','Ally'],['Rival','Enemy'],true),prisonOnTwo()],
 6:[{kind:'note',text:'Unexplained memory gap.'}]
});
common('core.entertainer',{
 3:[check('Art|Investigate',8,[stat('SOC',1)],[stat('SOC',-1)])],
 4:[choice([['Carouse',use('Carouse=1')],['Persuade',use('Persuade=1')],['Steward',use('Steward=1')],['Contact',[relation('Contact')]]])],
 5:[mod('benefit',1,'one')],
 6:[mod('advancement',2),relation('Ally')],
 8:[optional([relation('Enemy'),check('Art|Persuade',8,[anySkill('existing')],[anySkill('existing'),mishap()])])],
 9:[relation('Contact',1,'D3')],
 10:use('Streetwise=1|Investigate=1|Recon=1|Stealth=1'),
 11:[unusual()]
},{
 2:[{kind:'note',text:'Career-ending scandal.'}],
 3:[stat('SOC',-1)],
 4:[changeRelationship(['Contact','Ally'],['Rival','Enemy'],true)],
 5:use('Survival=1|Pilot=1|Persuade=1|Streetwise=1'),
 6:[mod('qualification',2,'next','any')]
});
common('core.marine',{
 3:use('Survival=1|Stealth=1|Deception=1|Streetwise=1'),
 4:use('Vacc Suit|Athletics (dexterity)'),
 5:[check('EDU',8,[anySkill('any','set')])],

 6:[check('Melee|Gun Combat',8,use('Tactics (military)|Leadership'),use('STR-1|DEX-1|END-1'))],
 8:use('Recon=1|Gun Combat=1|Leadership=1|Electronics (comms)=1'),
 9:[choice([['Report',[mod('advancement',2),relation('Enemy')]],['Protect',[relation('Ally')]]])],
 10:[mod('advancement',2)],
 11:mentor('Tactics=1'),
 12:[promote(true)]
},{
 2:[relation('Enemy'),stat('STR',-1),stat('DEX',-1)],
 3:use('Stealth|Survival'),
 4:[choice([['Refuse',[]],['Accept',[status('stay'),relation('Enemy')]]])],
 5:[relation('Rival')]
});
common('core.merchant',{
 3:[choice([
   ['Accept',[check('Deception|Persuade',8,[...use('Streetwise=1'),rolls(1)])]],
   ['Refuse',[relation('Enemy')]]
 ])],
 4:use('Profession=1|Electronics=1|Engineer=1|Animals=1|Science=1'),
 5:[{kind:'benefit-wager',route:'merchant-event-5'}],
 6:[relation('Contact')],
 8:[...use('Advocate=1|Admin=1|Diplomat=1|Investigate=1'),prisonOnTwo()],
 9:[check('EDU',8,[anySkill('existing')])],
 10:[mod('benefit',1,'one')],
 11:mentor('Carouse',true)
},{
 2:[loseAll(),relation('Rival')],
 3:use('Gun Combat=1|Pilot=1'),
 4:[relation('Enemy')],
 5:[status('auto-qualify','core.rogue')],
 6:[retain()]
});
common('core.navy',{
 3:[...use('Gambler=1|Deception=1'),optional([check('Gambler',8,[rolls(1)],[rolls(-1)])])],
 4:[mod('benefit',1,'one')],
 5:[check('EDU',8,[anySkill('existing')])],
 6:use('Electronics=1|Engineer=1|Gunner=1|Pilot=1'),
 8:[choice([['Recon',use('Recon=1')],['Diplomat',use('Diplomat=1')],['Steward',use('Steward=1')],['Contact',[relation('Contact')]]])],
 9:[relation('Enemy'),mod('advancement',2)],
 10:[choice([['Accept',[rolls(1)]],['Refuse',[mod('advancement',2)]]])],
 11:mentor('Tactics (naval)=1'),
 12:[promote(true,'next-check')]
},{
 2:[...use('STR-1|DEX-1|END-1'),status('stay')],
 3:[{kind:'assignment-effect',assignments:Object.fromEntries(Object.entries({crew:['Electronics (sensors)','Gunner'],technical:['Mechanic','Vacc Suit'],flight:['Pilot (small craft)','Pilot (spacecraft)','Tactics (naval)']}).map(([assignment,names])=>[assignment,[choice(names.map(name=>[name,[check(name,8,[retain()])]]))]]))}],
 4:[choice([
   ['Responsible',[tableRoll('training',{career:'current',chooseAvailableTable:true,dice:'1D',trainingRoute:'navy-mishap-4',source:{id:'core',page:37}})]],
   ['Not responsible',[relation('Enemy'),retain()]]
 ])],
 5:[relation('Rival')]
});
common('core.noble',{
 3:[choice([
   ['Refuse',[stat('SOC',-1)]],
   ['Accept',[check('Melee (blade)',8,[stat('SOC',1)],[injury(),stat('SOC',-1)]),...use('Melee (blade)|Leadership|Tactics|Deception')]]
 ])],
 4:use('Animals (handling)=1|Art=1|Carouse=1|Streetwise=1'),
 5:[mod('benefit',1,'one')],
 6:[...use('Advocate|Admin|Diplomat|Persuade'),relation('Rival')],
 8:[choice([
   ['Refuse',[relation('Enemy')]],
   ['Accept',[check('Deception|Persuade',8,use('Deception|Persuade|Tactics|Carouse'),[mishap()])]]
 ])],
 9:[relation('Enemy'),mod('advancement',2)],
 10:[...use('Carouse|Diplomat|Persuade|Steward'),relation('Rival'),relation('Ally')],
 11:mentor('Leadership',true)
},{
 2:[stat('SOC',-1)],
 3:[check('Stealth|Deception',8,[],[injury()])],
 4:[...use('Diplomat|Advocate'),relation('Rival')],
 5:[check('END',8,[],[injury()])]
});
pack['core.noble'].sourceNotes=[{page:39,issue:'Event 6 prints Diplomacy; normalized to the defined Diplomat skill.'}];
common('core.rogue',{
 3:[choice([
   ['Self-represent',[check('Advocate',8,[],[relation('Enemy'),status('next','core.prisoner')])]],
   ['Hire lawyer',[relation('Contact'),rolls(-1)]]
 ])],
 4:use('Electronics=1|Mechanic=1'),
 5:[mod('benefit',2,'one'),relation('Enemy')],
 6:[choice([['Betray',[mod('advancement',4)]],['Refuse',[relation('Ally')]]])],
 8:use('Streetwise=1|Stealth=1|Melee=1|Gun Combat=1'),
 9:[check('Stealth|Gun Combat',8,[rolls(1)],[injury()])],
 10:[...use('Gambler=1'),{kind:'benefit-wager',route:'rogue-event-10'}],
 11:mentor('Tactics (military)=1')
},{
 2:[status('next','core.prisoner')],
 3:[changeRelationship(['Contact','Ally'],['Rival','Enemy'],true),prisonOnTwo()],
 4:use('Deception=1|Pilot (small craft)=1|Pilot (spacecraft)=1|Athletics (dexterity)=1|Gunner=1'),
 5:[relation('Enemy')]
});
common('core.scholar',{
 3:[optional([rolls(1),{...anySkill('science-specialties'),count:2,distinctSpecialties:true},relation('Enemy',1,'D3')])],
 4:use('Medic=1|Science=1|Engineer=1|Electronics=1|Investigate=1'),
 5:[mod('benefit',1,'one')],
 6:[check('EDU',8,[anySkill('any','set')])],
 8:[optional([check('Deception|Admin',8,[mod('benefit',2,'one'),anySkill(),relation('Enemy')],[relation('Enemy'),rolls(-1)])])],
 9:[mod('advancement',2)],
 10:use('Admin=1|Advocate=1|Persuade=1|Diplomat=1'),
 11:mentor('Science',true)
},{
 2:[injury({rolls:2,take:'higher'}),relation('Rival')],
 3:[choice([
   ['Open research',[...use('Science'),relation('Enemy')]],
   ['Secret research',[...use('Science'),stat('SOC',-2)]]
 ]),status('stay')],
 4:use('Survival=1|Athletics (dexterity)=1|Athletics (endurance)=1'),
 5:[choice([['Leave',[retain()]],['Restart',[loseAll(),status('stay')]]])],
 6:[relation('Rival'),status('stay')]
});
common('core.scout',{
 3:[choice([
   ['Escape',[check('Pilot',8,use('Electronics (sensors)=1'),[{...status('exit'),timing:'term-end'}])]],
   ['Negotiate',[check('Persuade',10,use('Electronics (sensors)=1'),[{...status('exit'),timing:'term-end'}])]]
 ]),relation('Enemy')],
 4:use('Animals (riding)=1|Animals (training)=1|Survival=1|Recon=1|Science=1'),
 5:[mod('benefit',1,'one')],
 6:use('Astrogation=1|Electronics=1|Navigation=1|Pilot (small craft)=1|Mechanic=1'),
 8:[check('Electronics|Deception',8,[relation('Ally'),mod('advancement',2)],[mishap(true)])],
 9:[check('Medic|Engineer',8,[relation('Contact'),mod('advancement',2)],[relation('Enemy')])],
 10:[check('Survival|Pilot',8,[relation('Contact'),anySkill()],[mishap(true)])],
 11:mentor('Diplomat')
},{
 2:use('INT-1|SOC-1'),
 3:[relation('Contact',1,'1D'),relation('Enemy',1,'D3')],
 4:[relation('Rival'),...use('Diplomat=1')],
 5:[{kind:'note',text:'Unexplained recovery of a drifting ship.'}]
});
common('core.prisoner',{
 3:[optional([check('Stealth|Deception',10,[status('exit')],[parole(2)])])],
 4:[check('END',8,[optional([parole(-1),...use('Athletics=1|Mechanic=1|Melee (unarmed)=1')])],[parole(1)])],
 5:[optional([check('Persuade|Melee',8,[parole(1),mod('survival',1,'all'),...use('Deception=1|Persuade=1|Melee (unarmed)=1|Stealth=1')],[relation('Enemy')])])],
 6:[check('EDU',8,[anySkill('any','increase',['Jack-of-all-Trades'])])],
 7:[random('1D',[
  [1,1,[random('1D',[[1,2,[injury()]],[3,4,[]],[5,6,[rolls(1)]]])]],
  [2,2,[relation('Contact')]],[3,3,[relation('Rival')]],
  [4,4,[{kind:'parole',mode:'reset',dice:'1D+2'}]],
  [5,5,[parole(-2)]],[6,6,[check('Melee (unarmed)',8,[],[injury()])]]
 ])],
 8:[parole(-1)],
 9:[{kind:'prisoner-lawyer',source:{id:'core',page:57}}],
 10:use('Admin|Advocate|Electronics (computers)|Steward'),
 11:[parole(-2)],
 12:[optional([random('2D',[[2,7,[injury()]],[8,12,[relation('Ally'),parole(-2)]]])])]
},{
 2:[parole(2)],
 3:[choice([
  ['Submit',[loseAll()]],
  ['Fight',[check('Melee (unarmed)',8,[relation('Enemy'),parole(1)],[injury({rolls:2,take:'lower'})])]]
 ])],
 4:[relation('Enemy'),parole(1)],
 5:[stat('SOC',-1)]
});
common('core.psion',{
 3:[changeRelationship(['Contact','Ally'],['Rival'])],
 4:use('Athletics=1|Stealth=1|Survival=1|Art=1'),
 5:[optional([check('PSI',8,[choice([['Benefit roll',[rolls(1)]],['Status',[stat('SOC',1)]]])],[stat('SOC',-1)])])],
 6:[relation('Contact')],
 8:[stat('PSI',1)],
 9:[check('EDU',8,[anySkill('any','increase',['Jack-of-all-Trades'])])],
 10:[mod('benefit',1,'one')],
 11:[relation('Ally'),mod('advancement',4,'next','any')]
},{
 2:[stat('PSI',-1),{kind:'note',text:'Persistent nightmares.'}],
 3:[random('1D',[[1,2,[injury()]],[3,4,[stat('SOC',-1)]],[5,6,[]]])],
 4:[choice([['Accept',[status('stay'),relation('Enemy')]],['Refuse',[]]])],
 5:[{kind:'note',text:'Escaped from experimental captivity.'}],
 6:[changeRelationship(['Ally','Contact'],['Enemy'])]
});

function walkEffects(value,visit) {
 if(Array.isArray(value)) { value.forEach(x=>walkEffects(x,visit)); return; }
 if(value&&typeof value==='object') {
  if(typeof value.kind==='string') visit(value);
  Object.values(value).forEach(x=>walkEffects(x,visit));
 }
}
for(const [id,career] of Object.entries(pack)) {
 // Single-roll awards are held until selected; only explicit 'this career' wording expires.
 for(const [row,effects] of Object.entries(career.events)) walkEffects(effects,e=>{
  if(e.kind==='modifier'&&e.target==='benefit'&&e.scope==='one'){
   const scope=id==='core.agent'||id==='core.citizen'&&row==='8'?'career':'any';
   const value=e.value;for(const key of Object.keys(e))delete e[key];
   Object.assign(e,{kind:'benefit-credit',value,scope,source:{id:'core',page:career.source.pages[1]}});
  }
 });
 walkEffects({events:career.events,mishaps:career.mishaps},effect=>{
  if(effect.kind==='unsupported') career.unsupported.push(effect);
 });
 const partial = table => { let found=false; walkEffects(table,e=>{ if(e.kind==='unsupported') found=true; }); return found?'partial':'encoded'; };
 career.coverage={training:'complete',ranks:'complete',benefits:'table-results',events:partial(career.events),mishaps:partial(career.mishaps)};
}
function freeze(value) {
 if(value&&typeof value==='object'&&!Object.isFrozen(value)) {
  Object.values(value).forEach(freeze);
  Object.freeze(value);
 }
 return value;
}
export const CORE_PACK = freeze(pack);
export function getCoreCareerPack(id) { return CORE_PACK[id]??null; }
