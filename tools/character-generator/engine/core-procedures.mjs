// Original pure procedures from Core Rulebook Update 2022, printed pp. 46-49.
// No source prose, private source URLs, source files, or UI/session dependencies.
// All dice are caller-supplied. Unspecified cases require explicit adjudication.

export const CORE_PROCEDURE_VERSION = 1;
export const CORE_PROCEDURE_EFFECT_SCHEMA = Object.freeze({
 stat:'name, value: characteristic delta; caller handles zero/crisis before committing',
 skill:'name, mode, value',
 choice:'options: [{label,effects}]',
 benefit:'name, value',
 relationship:'type, count',
 cash:'value: signed Credit change',
 debt:'value: added debt in Credits',
 'medical-cost':'value: unpaid cost; settle against final cash with settleMedicalCosts',
 'qualification-ban':'permanent: true',
 death:'cause',
 'equipment-choice':'category, maximumCost, maximumTL; optional replaceOriginal/restrictions',
 'equipment-upgrade':'category, levels; previousBenefitOnly and ignoreOriginalLimits',
 'weapon-skill-choice':'allowedBases, previousBenefitOnly, mode, value; chosen specialization must match a received weapon',
 'ship-mortgage':'family, percentDelta, percentAfter, optional variants and quirks; repeats affect the same ship',
 'ship-use':'name, owner, recallable, mortgage; this is use of a ship, not ownership',
 'reroll-benefit':'table, consumeExtraRoll: false'
});
const PHYSICAL=Object.freeze(['STR','DEX','END']);
const MENTAL=Object.freeze(['INT','EDU','SOC']);
const CAREERS=new Set(['agent','army','citizen','drifter','entertainer','marine','merchant','navy','noble','rogue','scholar','scout','prisoner','psion'].map(x=>'core.'+x));
const integer=(value,min,max,label)=>{
 if(!Number.isSafeInteger(value)||value<min||value>max) throw new RangeError(label+' must be an integer from '+min+' to '+max+'.');
 return value;
};
const source=page=>({id:'core',title:'Core Rulebook Update 2022',page});
const result=(page,effects=[],extra={})=>({source:source(page),effects,needsAdjudication:false,...extra});
const adjudicate=(page,reason,extra={})=>result(page,[],{needsAdjudication:true,reason,...extra});
const required=(page,purpose,dice,extra={})=>result(page,[],{requiredRoll:{purpose,dice},...extra});
const stat=(name,value)=>({kind:'stat',name,value});
const skill=name=>({kind:'skill',name,mode:'increase',value:1});
const benefit=(name,value=1)=>({kind:'benefit',name,value});
const choose=options=>({kind:'choice',options:options.map(([label,effects])=>({label,effects}))});
const chooseStat=(names,value)=>choose(names.map(name=>[name+' '+value,[stat(name,value)]]));
const changes=(first,other)=>PHYSICAL.map(name=>stat(name,name===first.name?first.value:other));
function physicalPattern(primary,other) {
 return choose(PHYSICAL.map(name=>[
  PHYSICAL.map(key=>key+' '+(key===name?primary:other)).join(', '),
  changes({name,value:primary},other)
 ]));
}

/** Ageing uses 2D - completed terms + terms on anagathics. Call only when due. */
export function ageingOutcome({roll,terms,anagathicTerms=0}={}) {
 integer(roll,2,12,'Ageing roll');
 integer(terms,0,100,'Completed terms');
 integer(anagathicTerms,0,terms,'Terms on anagathics');
 const effectiveRoll=roll-terms+anagathicTerms;
 const meta={roll,terms,anagathicTerms,effectiveRoll};
 if(effectiveRoll<-6) return adjudicate(49,'The printed ageing table has no row below -6; the referee must choose the extension.',meta);
 let effects=[];
 switch(effectiveRoll) {
  case -6:effects=[...PHYSICAL.map(name=>stat(name,-2)),chooseStat(MENTAL,-1)];break;
  case -5:effects=PHYSICAL.map(name=>stat(name,-2));break;
  case -4:effects=[physicalPattern(-1,-2)];break;
  case -3:effects=[physicalPattern(-2,-1)];break;
  case -2:effects=PHYSICAL.map(name=>stat(name,-1));break;
  case -1:effects=[choose(PHYSICAL.map(untouched=>[
   PHYSICAL.filter(name=>name!==untouched).join(' and ')+' -1',
   PHYSICAL.filter(name=>name!==untouched).map(name=>stat(name,-1))
  ]))];break;
  case 0:effects=[chooseStat(PHYSICAL,-1)];break;
 }
 return result(49,effects,meta);
}

/** Run after ageing loss has been allocated, before clamping zero scores. */
export function ageingCrisis({stats,medicalDie}={}) {
 if(!stats||Array.isArray(stats)||typeof stats!=='object') throw new TypeError('Characteristic scores are required.');
 const entries=Object.entries(stats);
 if(!entries.length) throw new TypeError('Characteristic scores are required.');
 entries.forEach(([name,value])=>{
  if(!/^[A-Z][A-Z0-9]{1,7}$/.test(name)) throw new TypeError('Invalid characteristic name.');
  integer(value,-100,100,'Characteristic '+name);
 });
 const affected=entries.filter(([name,value])=>[...PHYSICAL,...MENTAL].includes(name)&&value<=0).map(([name])=>name);
 if(!affected.length) return result(49,[],{crisis:false,affected:[]});
 if(medicalDie===undefined) return required(49,'Ageing crisis medical cost','1D',{crisis:true,affected});
 integer(medicalDie,1,6,'Medical cost die');
 const cost=medicalDie*10000;
 return result(49,[choose([
  ['Medical care',[
   {kind:'medical-cost',value:cost},
   ...affected.map(name=>stat(name,1-stats[name])),
   {kind:'qualification-ban',permanent:true}
  ]],
  ['No medical care',[{kind:'death',cause:'ageing'}]]
 ])],{crisis:true,affected,cost,medicalDie});
}

/** Injury result is 1D; results 1 and 2 need a separate severity die. */
export function injuryOutcome({roll,severityDie}={}) {
 integer(roll,1,6,'Injury roll');
 if(severityDie!==undefined) integer(severityDie,1,6,'Injury severity die');
 if(roll<=2&&severityDie===undefined) return required(49,'Injury characteristic loss','1D',{roll});
 let effects=[];
 switch(roll) {
  case 1:effects=[physicalPattern(-severityDie,-2)];break;
  case 2:effects=[chooseStat(PHYSICAL,-severityDie)];break;
  case 3:effects=[chooseStat(['STR','DEX'],-2)];break;
  case 4:effects=[chooseStat(PHYSICAL,-2)];break;
  case 5:effects=[chooseStat(PHYSICAL,-1)];break;
 }
 return result(49,effects,{roll,...(roll<=2?{severityDie}:{})});
}

const MEDICAL_COVERAGE=Object.freeze({
 'core.army':[75,100,100],'core.navy':[75,100,100],'core.marine':[75,100,100],
 'core.agent':[50,75,100],'core.noble':[50,75,100],'core.scholar':[50,75,100],
 'core.entertainer':[50,75,100],'core.merchant':[50,75,100],'core.citizen':[50,75,100],
 'core.scout':[0,50,75],'core.rogue':[0,50,75],'core.drifter':[0,50,75]
});
/** A restoration quote. Payment is deferred until final cash is available. */
export function medicalBill({careerId,roll,rank=0,restoredPoints,inService=true}={}) {
 integer(restoredPoints,0,1000,'Restored characteristic points');
 integer(rank,0,6,'Rank');
 if(typeof inService!=='boolean') throw new TypeError('inService must be boolean.');
 if(roll!==undefined) integer(roll,2,12,'Medical bill roll');
 const totalCost=restoredPoints*5000;
 if(careerId!==undefined&&typeof careerId!=='string') throw new TypeError('Career ID must be a string.');
 const meta={...(careerId!==undefined?{careerId}:{}),restoredPoints,totalCost,rank,inService};
 if(totalCost===0) return result(49,[],{...meta,coveragePercent:0,coveredCost:0,personalCost:0});
 let coveragePercent=0,effectiveRoll=null;
 if(inService) {
  const rates=Object.hasOwn(MEDICAL_COVERAGE,careerId)?MEDICAL_COVERAGE[careerId]:null;
  if(!rates) return adjudicate(49,'This career has no row in the Core medical-contribution table.',meta);
  if(roll===undefined) return required(49,'Organisation medical contribution','2D',{...meta,modifier:rank});
  effectiveRoll=roll+rank;
  coveragePercent=effectiveRoll>=12?rates[2]:effectiveRoll>=8?rates[1]:effectiveRoll>=4?rates[0]:0;
 }
 const coveredCost=totalCost*coveragePercent/100;
 const personalCost=totalCost-coveredCost;
 return result(49,personalCost?[{kind:'medical-cost',value:personalCost}]:[],{
  ...meta,...(inService?{roll}:{}),effectiveRoll,coveragePercent,coveredCost,personalCost
 });
}

/** Settle the outstanding fictional medical/anagathic bill with final cash. */
export function settleMedicalCosts({cash,cost}={}) {
 integer(cash,0,1000000000,'Available cash');
 integer(cost,0,1000000000,'Outstanding cost');
 const paid=Math.min(cash,cost),remainingCash=cash-paid,debt=cost-paid;
 return result(49,[...(paid?[{kind:'cash',value:-paid}]:[]),...(debt?[{kind:'debt',value:debt}]:[])],{paid,remainingCash,debt,cost});
}

/** Core pensions depend on terms served, not benefit rolls still available. */
export function pensionForCareer({careerId,terms}={}) {
 integer(terms,0,100,'Career terms');
 if(!CAREERS.has(careerId)) return adjudicate(48,'Pension eligibility for this career is not specified by this Core helper.',{careerId,terms});
 const excluded=['core.scout','core.rogue','core.prisoner','core.drifter'].includes(careerId);
 const annualCredits=excluded||terms<5?0:10000+(terms-5)*2000;
 return result(48,[],{careerId,terms,eligible:!excluded&&terms>=5,annualCredits,paymentInterval:'year',excluded});
}


/** Annual dividends when the group does not use these ship assets. No cash sale. */
export function assetPension({unusedShipShares=0,foregoneShipAwards=0}={}) {
 integer(unusedShipShares,0,10000,'Unused ship shares');
 integer(foregoneShipAwards,0,1000,'Foregone ship awards');
 const sharePension=unusedShipShares*1000,shipPension=foregoneShipAwards*25000;
 return result(48,[],{unusedShipShares,foregoneShipAwards,sharePension,shipPension,annualCredits:sharePension+shipPension,paymentInterval:'year',redeemableForCash:false});
}

const EQUIPMENT=Object.freeze({
 Armour:{category:'armour',maximumCost:10000,maximumTL:12},
 Blade:{category:'blade',maximumCost:1000,maximumTL:12},
 Gun:{category:'gun',maximumCost:3000,maximumTL:12,restrictions:['common-or-military-ranged']},
 Weapon:{category:'weapon',maximumCost:3000,maximumTL:12},
 'Scientific Equipment':{category:'scientific-equipment',maximumCost:2000,maximumTL:12},
 'Personal Vehicle':{category:'personal-vehicle',maximumCost:300000,maximumTL:10,restrictions:['unarmed']},
 'Cybernetic Implant':{category:'augmentation',maximumCost:75000,maximumTL:12},

 "Ship's Boat":{category:'small-craft',maximumCost:10000000,maximumTL:12}
});
const canonicalNames=new Map([
 ...Object.keys(EQUIPMENT),'TAS Membership','Scout Ship','Free Trader','Lab Ship','Yacht','Ship Share','Contact','Ally'
].map(name=>[name.toLowerCase(),name]));
const equipment=name=>({kind:'equipment-choice',...structuredClone(EQUIPMENT[name])});
const weaponSkill=allowedBases=>({kind:'weapon-skill-choice',allowedBases,previousBenefitOnly:true,mode:'increase',value:1});

/** Resolve one named material award. previousCount counts prior actual awards. */
export function materialBenefit({name,previousCount=0,quantity=1}={}) {
 if(typeof name!=='string'||name.length>120) throw new TypeError('A material benefit name is required.');
 integer(previousCount,0,100,'Previous benefit count');
 integer(quantity,1,100,'Benefit quantity');
 const canonical=canonicalNames.get(name.trim().replace(/[’‘]/g,"'").toLowerCase());
 if(!canonical) return adjudicate(47,'This material award has no supported Core glossary procedure.',{name,previousCount,quantity});
 const meta={name:canonical,previousCount,quantity};
 if(quantity!==1&&canonical!=='Ship Share') return adjudicate(47,'Resolve repeated named awards one at a time so ownership choices are preserved.',meta);
 if(canonical==='Ship Share') return result(47,[benefit('Ship Share',quantity)],{...meta,redeemableForCash:false,valuePerShare:1000000});
 if(canonical==='Contact'||canonical==='Ally') return result(47,[{kind:'relationship',type:canonical,count:1}],meta);
 if(canonical==='TAS Membership') return result(48,[previousCount?benefit('Ship Share',2):benefit('TAS Membership')],meta);
 if(canonical==='Scout Ship') return result(47,previousCount?
  [{kind:'reroll-benefit',table:'material',consumeExtraRoll:false}]:
  [{kind:'ship-use',name:'Scout Ship',owner:'Scout Service',recallable:true,mortgage:false}],meta);
 if(['Free Trader','Lab Ship','Yacht'].includes(canonical)) {
  if(previousCount>=4) return adjudicate(canonical==='Yacht'?48:47,'The ship is already fully paid; the source does not specify a fifth mortgage award.',meta);
  const variants=canonical==='Free Trader'?['Free Trader','Far Trader']:canonical==='Yacht'?['Yacht','Safari Ship']:['Lab Ship'];
  const effect={kind:'ship-mortgage',family:canonical,percentDelta:25,percentAfter:(previousCount+1)*25};
  if(previousCount===0) {
   effect.variants=variants;
   effect.quirks={countDice:'1D',table:'core.spacecraft-quirks',sourcePage:188};
  }
  return result(canonical==='Yacht'?48:47,[effect],meta);
 }
 if(previousCount===0) return result(47,[equipment(canonical)],meta);
 switch(canonical) {
  case 'Armour':return result(47,[choose([
   ['Another armour item',[equipment(canonical)]],
   ['Trade in original armour',[{...equipment(canonical),maximumCost:25000,replaceOriginal:true}]]
  ])],meta);
  case 'Blade':return result(47,[choose([
   ['Another blade',[equipment(canonical)]],['Improve blade skill',[skill('Melee (blade)')]]
  ])],meta);
  case 'Gun':
  case 'Weapon':return result(47,[choose([
   ['Another weapon',[equipment(canonical)]],
   ['Improve a received weapon skill',[weaponSkill(canonical==='Gun'?['Gun Combat']:['Melee','Gun Combat'])]]
  ])],meta);
  case 'Scientific Equipment':return result(47,[choose([
   ['Another equipment item',[equipment(canonical)]],['Electronics',[skill('Electronics')]],['Science',[skill('Science')]]
  ])],meta);
  case 'Personal Vehicle':return result(47,[choose([
   ['Drive',[skill('Drive')]],['Flyer',[skill('Flyer')]]
  ])],meta);
  case 'Cybernetic Implant':return result(47,[choose([
   ['Different augmentation',[equipment(canonical)]],
   ['Improve received augmentation',[{kind:'equipment-upgrade',category:'augmentation',levels:1,previousBenefitOnly:true,ignoreOriginalLimits:true}]]
  ])],meta);
  case "Ship's Boat":return result(47,[choose([
   ['Small-craft piloting',[skill('Pilot (small craft)')]],['Ship share',[benefit('Ship Share')]]
  ])],meta);
  default:throw new Error('Material benefit dispatch invariant failed.');
 }
}

/** Do not silently clamp results beyond the printed benefit table. */
export function benefitTableResult({roll,modifier=0,rows,page=46}={}) {
 integer(roll,1,6,'Benefit die');
 integer(modifier,-100,100,'Benefit modifier');
 integer(page,1,300,'Printed source page');
 if(!Array.isArray(rows)||rows.length<1||rows.length>100) throw new TypeError('A nonempty benefit table is required.');
 const cash=rows.every(value=>Number.isSafeInteger(value)&&value>=0);
 const material=rows.every(value=>Array.isArray(value));
 if(!cash&&!material) throw new TypeError('Rows must be all cash values or all effect arrays.');
 const effectiveRoll=roll+modifier;
 const meta={roll,modifier,effectiveRoll,tableLength:rows.length};
 if(effectiveRoll<1||effectiveRoll>rows.length) return adjudicate(page,'The modified result is outside the printed table; choose a ruling before awarding a benefit.',meta);
 const row=structuredClone(rows[effectiveRoll-1]);
 return result(page,cash?[{kind:'cash',value:row}]:row,{...meta,index:effectiveRoll-1,row});
}
