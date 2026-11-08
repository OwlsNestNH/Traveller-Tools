// Original implementation. No source-book prose or third-party generator code.
export const API_VERSION = 1;
export const SOURCES = Object.freeze({
 core: { id: 'core', title: 'Core Rulebook Update 2022', edition: '2022' },
 companion: { id: 'companion', title: 'Traveller Companion Update 2024', edition: '2024' },
 aliens: { id: 'aliens', title: 'Aliens of Charted Space Volume 1 Update 2026', edition: '2026' },
 jtas11: { id: 'jtas11', title: 'Journal of the Travellers’ Aid Society Volume 11', edition: '2022' }
});
export const BACKGROUND_SKILLS = ['Admin','Animals','Art','Athletics','Carouse','Drive','Electronics','Flyer','Language','Mechanic','Medic','Profession','Science','Seafarer','Streetwise','Survival','Vacc Suit'];
export const SKILLS = [...new Set([...BACKGROUND_SKILLS,'Advocate','Astrogation','Broker','Deception','Diplomat','Engineer','Explosives','Gambler','Gun Combat','Gunner','Heavy Weapons','Investigate','Jack-of-all-Trades','Leadership','Melee','Navigation','Persuade','Pilot','Recon','Stealth','Steward','Tactics','Telepathy','Clairvoyance','Telekinesis','Awareness','Teleportation','Technopathy','Independence','Tolerance','Rites'])].sort();
const species = (id,name,source,page,dice,extra={}) => ({id,name,source,page,dice,startAge:18,maximum:15,...extra});
export const SPECIES = [
 species('human','Human','core',9,{STR:[2,0],DEX:[2,0],END:[2,0],INT:[2,0],EDU:[2,0],SOC:[2,0]}),
 species('aslan','Aslan','aliens',15,{STR:[2,1],DEX:[2,-1],END:[2,1],INT:[2,0],EDU:[2,0],SOC:[2,0]},{startAge:14,agingStart:42,agingTermMultiplier:2,setup:'Aslan family, land and Rite of Passage',setupPage:16}),
 species('vargr','Vargr','aliens',186,{STR:[2,-1],DEX:[2,1],END:[2,-1],INT:[2,0],EDU:[2,0],CHA:[2,0]}),
 species('zhodani','Zhodani','aliens',254,{STR:[2,0],DEX:[2,0],END:[2,0],INT:[2,0],EDU:[2,0],SOC:[2,0],PSI:[2,0]},{setup:'Zhodani status and psionic talents',setupPage:254}),
 species('aezorgh','Aezorgh','jtas11',67,{STR:[1,0],DEX:[2,3],END:[1,1],INT:[2,2],EDU:[1,0],SOC:[1,0]},{maxima:{DEX:18,INT:16},background:['Athletics','Mechanic','Recon','Stealth'],extraBackground:1,precareerDM:-2,agingStart:34,agingDMUntil:[82,4]})
];
const check = s => s === '-' ? null : {stat:s.split(':')[0],target:Number(s.split(':')[1])};
const career = (id,name,source,page,group,q,rows,extra={}) => ({
 id,name,source,page,group,qualification:check(q),
 assignments:rows.split(';').map(row=>{const [id,name,s,a]=row.split('|');return {id,name,survival:check(s),advancement:check(a)};}),
 implementation:'book-assisted',service:[],...extra
});
export const CAREERS = [
 career('core.agent','Agent','core',22,'core','INT:6','law|Law enforcement|END:6|INT:6;intelligence|Intelligence|INT:7|INT:5;corporate|Corporate|INT:5|INT:7'),
 career('core.army','Army','core',24,'core','END:5','support|Support|END:5|EDU:7;infantry|Infantry|STR:6|EDU:6;cavalry|Cavalry|DEX:7|INT:5',{commission:8,agePenalty:[30,-2]}),
 career('core.citizen','Citizen','core',26,'core','EDU:5','corporate|Corporate|SOC:6|INT:6;worker|Worker|END:4|EDU:8;colonist|Colonist|INT:7|END:5',{assignmentTraining:true}),
 career('core.drifter','Drifter','core',28,'core','-','barbarian|Barbarian|END:7|STR:7;wanderer|Wanderer|END:7|INT:7;scavenger|Scavenger|DEX:7|END:7',{assignmentTraining:true}),
 career('core.entertainer','Entertainer','core',30,'core','DEX/INT:5','artist|Artist|SOC:6|INT:6;journalist|Journalist|EDU:7|INT:5;performer|Performer|INT:5|DEX:7'),
 career('core.marine','Marine','core',32,'core','END:6','support|Support|END:5|EDU:7;star|Star Marine|END:6|EDU:6;ground|Ground assault|END:7|EDU:5',{commission:8,agePenalty:[30,-2]}),
 career('core.merchant','Merchant','core',34,'core','INT:4','marine|Merchant marine|EDU:5|INT:7;free|Free trader|DEX:6|INT:6;broker|Broker|EDU:5|INT:7'),
 career('core.navy','Navy','core',36,'core','INT:6','crew|Line / crew|INT:5|EDU:7;technical|Engineer / gunner|INT:6|EDU:6;flight|Flight|DEX:7|EDU:5',{commission:8,agePenalty:[34,-2]}),
 career('core.noble','Noble','core',38,'core','SOC:10','administrator|Administrator|INT:4|EDU:6;diplomat|Diplomat|INT:5|SOC:7;dilettante|Dilettante|SOC:5|INT:7'),
 career('core.rogue','Rogue','core',40,'core','DEX:6','thief|Thief|INT:6|DEX:6;enforcer|Enforcer|END:6|STR:6;pirate|Pirate|DEX:6|INT:6'),
 career('core.scholar','Scholar','core',42,'core','INT:6','field|Field researcher|END:6|INT:6;scientist|Scientist|EDU:4|INT:8;physician|Physician|EDU:4|EDU:8'),
 career('core.scout','Scout','core',44,'core','INT:5','courier|Courier|END:5|EDU:9;surveyor|Surveyor|END:6|INT:8;explorer|Explorer|END:7|EDU:7'),
 career('core.prisoner','Prisoner','core',56,'core','-','inmate|Inmate|END:7|STR:7;thug|Thug|STR:8|END:6;fixer|Fixer|INT:9|END:5',{specialEntry:true}),
 career('core.psion','Psion','core',236,'core','PSI:6','adept|Adept|EDU:4|EDU:8;warrior|Psi-warrior|END:6|END:6;wild|Wild talent|SOC:6|INT:8',{assignmentTraining:true}),
 career('companion.truther','Truther','companion',36,'companion','-','truther|Truther|FOL:4|-',{noRank:true}),
 career('companion.believer','Believer','companion',38,'companion','-','mainstream|Mainstream believer|SOC:3|SOC:8;missionary|Missionary / humanitarian|INT:6|SOC:7;warrior|Holy warrior|INT:8|INT:5',{assignmentTraining:true}),
 career('aslan.envoy','Envoy','aliens',24,'aslan','RITE:10','duellist|Duellist|END:7|DEX:5;negotiator|Negotiator|SOC:6|INT:6;spy|Spy|SOC:7|INT:5',{eligibility:{negotiator:'male'}}),
 career('aslan.guardian','Guardian','aliens',26,'aslan','RITE:10','agent|Clan agent|END:7|INT:5;poet|Poet|EDU:6|INT:6;priest|Priest|SOC:5|EDU:7',{eligibility:{poet:'male'},sourceConflict:'Summary and career-entry qualification modifiers differ.'}),
 career('aslan.manager','Manager','aliens',28,'aslan','RITE:8','aide|Clan aide|EDU:7|SOC:5;corporate|Corporate|INT:6|INT:6;governess|Governess|SOC:5|EDU:7',{gender:'female'}),
 career('aslan.military','Military','aliens',30,'aslan','RITE:7','cavalry|Cavalry|DEX:6|DEX:6;flyer|Flyer|DEX:7|INT:5;support|Support|END:5|SOC:7;warrior|Warrior|END:7|STR:5'),
 career('aslan.military-officer','Military officer','aliens',32,'aslan','RITE:10','assassin|Assassin|END:7|DEX:5;executive|Executive officer|END:5|EDU:7;leader|Leader|END:6|INT:6',{eligibility:{assassin:'male',executive:'female',leader:'male'}}),
 career('aslan.scientist','Scientist','aliens',34,'aslan','INT:7','explorer|Explorer|END:7|INT:5;healer|Healer|END:5|SOC:7;researcher|Researcher|END:6|INT:6',{eligibility:{explorer:'female',researcher:'female'}}),
 career('aslan.spacer','Spacer','aliens',36,'aslan','RITE:8','crew|Crew|EDU:5|INT:7;engineer|Engineer|END:6|INT:6;gunner|Gunner|END:6|INT:6;pilot|Pilot|DEX:7|INT:5',{eligibility:{engineer:'female',gunner:'male',pilot:'male'}}),
 career('aslan.space-officer','Space officer','aliens',38,'aslan','RITE:10','commander|Commander|SOC:7|INT:5;navigator|Navigator|INT:5|SOC:7;shipmaster|Shipmaster|EDU:6|SOC:6',{eligibility:{commander:'male',navigator:'female',shipmaster:'female'}}),
 career('aslan.outcast','Outcast','aliens',40,'aslan','-','labourer|Labourer|STR:7|STR:7;trader|Trader|END:7|INT:7;scavenger|Scavenger|END:7|EDU:7'),
 career('aslan.outlaw','Outlaw','aliens',42,'aslan','STR:6','pirate|Pirate|END:6|INT:6;raider|Raider|END:7|STR:5;thief|Thief|DEX:6|INT:6'),
 career('aslan.wanderer','Wanderer','aliens',44,'aslan','RITE:8','belter|Belter|DEX:7|INT:7;nomad|Nomad|END:8|INT:6;scout|Scout|END:6|INT:8',{gender:'male'}),
 career('vargr.agent','Agent','aliens',188,'vargr','INT:6','enforcer|Enforcer|END:6|STR:6;investigator|Investigator|INT:6|CHA:6;spy|Spy|INT:7|CHA:6'),
 career('vargr.citizen','Citizen','aliens',190,'vargr','EDU:5','corporate|Corporate|EDU:6|CHA:5;settler|Settler|INT:7|END:6;worker|Worker|END:4|CHA:6'),
 career('vargr.intermediary','Intermediary','aliens',192,'vargr','CHA:10','arbitrator|Arbitrator|EDU:6|CHA:8;diplomat|Diplomat|EDU:7|CHA:5;emissary|Emissary|INT:7|CHA:5'),
 career('vargr.loner','Loner','aliens',194,'vargr','-','prospector|Prospector|DEX:7|END:7;scrounger|Scrounger|DEX:6|INT:7;wanderer|Wanderer|CHA:6|CHA:7',{maxTerms:1}),
 career('vargr.merchant','Merchant','aliens',196,'vargr','CHA:6','free|Free trader|DEX:6|CHA:5;long|Long liner|EDU:5|CHA:7;salvager|Salvager|EDU:5|CHA:6',{sourceConflict:'Career page uses CHA 6+; summary uses INT 5+. Career page is used.'}),
 career('vargr.military','Military','aliens',198,'vargr','END:5','army|Army|STR:6|CHA:5;militia|Militia|END:5|CHA:7;raider|Raider|END:6|CHA:5'),
 career('vargr.psion','Psion','aliens',200,'vargr','PSI:6','institute|Institute|EDU:6|CHA:8;mentored|Mentored|INT:6|PSI:6;wild|Wild talent|END:6|INT:8'),
 career('vargr.scientist','Scientist','aliens',202,'vargr','INT:8','physician|Physician|EDU:4|INT:8;researcher|Researcher|EDU:6|END:6;technician|Technician|EDU:5|INT:7',{sourceConflict:'Career page uses INT 8+; summary uses EDU 8+. Career page is used.'}),
 career('vargr.spacer','Spacer','aliens',204,'vargr','DEX/INT:7','corsair|Corsair|DEX:6|CHA:7;explorer|Explorer|END:6|CHA:6;navy|Navy|INT:6|CHA:7'),
 career('zhodani.agent','Agent','aliens',258,'zhodani','INT:6','informant|Informant service|EDU:5|INT:6;tavrchedl|Tavrchedl’|END:6|INT:6;tozjabr|Tozjabr|INT:7|INT:5'),
 career('zhodani.army','Army','aliens',260,'zhodani','END:5','cavalry|Cavalry|DEX:7|INT:5;infantry|Infantry|STR:6|EDU:6;support|Support|END:5|EDU:7',{commission:0}),
 career('zhodani.entertainer','Entertainer','aliens',262,'zhodani','INT:5','artist|Artist|SOC:6|INT:6;author|Author|EDU:7|INT:5;performer|Performer|INT:5|DEX:7'),
 career('zhodani.government','Government','aliens',264,'zhodani','INT:8','administration|Administration|INT:7|EDU:8;diplomat|Diplomat|END:6|EDU:6'),
 career('zhodani.guard','Guard','aliens',266,'zhodani','END:6','commando|Commando|END:7|EDU:5;ground|Ground assault|END:6|EDU:6;support|Support|END:5|EDU:7',{minSOC:10,commission:0}),
 career('zhodani.merchant','Merchant','aliens',268,'zhodani','INT:4','broker|Broker|EDU:5|INT:7;corporate|Corporate|EDU:5|INT:7;free|Free trader|DEX:6|INT:6'),
 career('zhodani.navy','Navy','aliens',270,'zhodani','INT:6','crew|Crew|INT:5|EDU:7;flight|Flight|DEX:7|EDU:5;technical|Technical|INT:6|EDU:6',{commission:0,agePenalty:[34,-2]}),
 career('zhodani.prole','Prole','aliens',272,'zhodani','INT:4','colonist|Colonist|INT:7|END:5;corporate|Corporate|SOC:6|INT:6;worker|Worker|END:4|EDU:8',{maxSOC:9}),
 career('zhodani.scholar','Scholar','aliens',274,'zhodani','INT:6','field|Field researcher|END:6|INT:6;lab|Lab scientist|EDU:4|INT:6;physician|Physician|EDU:4|INT:8')
];
export const PRECAREERS = [
 {id:'core.university',name:'University',source:'core',page:16,entry:{stat:'EDU',target:6},graduation:{stat:'INT',target:6},maxTerm:3},
 ...['Army','Marine','Navy'].map((name,i)=>({id:'core.academy-'+name.toLowerCase(),name:name+' academy',source:'core',page:16,entry:{stat:i===2?'INT':'END',target:i===0?7:8},graduation:{stat:'INT',target:7},maxTerm:3})),
 {id:'companion.colonial',name:'Colonial upbringing',source:'companion',page:32},
 {id:'companion.psionic',name:'Psionic community',source:'companion',page:32},
 {id:'companion.merchant',name:'Merchant academy',source:'companion',page:33},
 {id:'companion.hard-knocks',name:'School of hard knocks',source:'companion',page:34},
 {id:'companion.spacer',name:'Spacer community',source:'companion',page:34}
];
export function findCareer(id) { return CAREERS.find(c=>c.id===id); }
export function findSpecies(id) { return SPECIES.find(s=>s.id===id); }
export function sourceLabel(source,page) { return SOURCES[source].title+' · p. '+page; }
