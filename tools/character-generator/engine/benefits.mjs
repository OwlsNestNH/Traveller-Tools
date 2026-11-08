// Original source-keyed material benefit and pension mechanics.
// Core Update 2022 pp47-48; Aliens Vol1 Update 2026 pp47-48,186,206-207,276-277;
// Traveller Companion Update 2024 pp35-40. No external source files or prose.
import {materialBenefit,pensionForCareer} from './core-procedures.mjs';
import {CAREERS} from './catalog.mjs';
const knownCareers=new Set(CAREERS.map(c=>c.id));
const coreNames=new Set(['Armour','Blade','Gun','Weapon','Scientific Equipment','Ship Share','TAS Membership','Personal Vehicle','Cybernetic Implant',"Ship's Boat",'Free Trader','Lab Ship','Yacht','Scout Ship','Contact','Ally']);
export const canonicalBenefitName=name=>String(name).trim().replace(/[\u2018\u2019]/g,"'");
const src=(id,page)=>({id,page});
const unknown=(name,source,reason)=>({name,definitionId:'unresolved:'+name,source,effects:[],needsAdjudication:true,reason});
export function namedBenefitPlan({name,careerId,source,previousCount=0,quantity=1}={}){
 name=canonicalBenefitName(name);const group=careerId?.split('.')[0];
 if(!Number.isInteger(quantity)||quantity<1||quantity>100)throw Error('Benefit quantity must be 1-100.');
 if(!Number.isInteger(previousCount)||previousCount<0||previousCount>100)throw Error('Previous benefit count must be 0-100.');
 if(name==='Clan Share'&&source?.id==='aliens'&&(source.page===21||source.pages?.includes(21)))return {name,definitionId:'aslan.clan-share',source:src('aliens',47),effects:[{kind:'entitlement',name,quantity,redemption:'source-required',redeemableForCash:false}],needsAdjudication:false};
 if(!knownCareers.has(careerId)||!source?.id)return unknown(name,source??src('core',47),'The originating career and source definition must be established before resolving this benefit.');
 const expectedSource=group==='core'?'core':group==='companion'?'companion':'aliens';
 if(source.id!==expectedSource&&source.id!=='core')return unknown(name,source,'The stated source does not identify this career benefit definition. Resolve its provenance explicitly.');
 if(group==='aslan'&&source.id==='aliens'){
  if(name==='Clan Share')return {name,definitionId:'aslan.clan-share',source:src('aliens',47),effects:[{kind:'entitlement',name,quantity,redemption:'source-required',redeemableForCash:false}],needsAdjudication:false};
  if(name==='Scout Ship')return {name,definitionId:'aslan.scout-use',source:src('aliens',47),needsAdjudication:false,effects:previousCount?[{kind:'reroll-benefit',table:'material',consumeExtraRoll:false}]:[{kind:'ship-use',name:'Ihateisho',owner:'Clan',recallable:true,mortgage:false}]};
  if(['Ceremonial Kinship','Brotherhood of Stars','Scientific Kinship','Secret School','Land Parcel'].includes(name))return unknown(name,src('aliens',47),'Resolve this Aslan entitlement and its conditions explicitly; it is not a TAS membership or ordinary cash award.');
 }
 if(group==='vargr'&&source.id==='aliens'){
  if(name==='Scout')return {name,definitionId:'vargr.scout-use',source:src('aliens',207),needsAdjudication:false,effects:previousCount?[{kind:'reroll-benefit',table:'material',consumeExtraRoll:false}]:[{kind:'ship-use',name:'Aetin',owner:'Pack',recallable:true,mortgage:false,history:{countDice:'1D',table:'core.outdated-ships',sourcePage:188}}]};
  if(name==="Ship's Boat")return {name,definitionId:'vargr.small-craft',source:src('aliens',207),needsAdjudication:false,effects:previousCount?[{kind:'skill',name:'Pilot (small craft)',mode:'increase',value:1}]:[{kind:'equipment-choice',category:'small-craft',maximumCost:10000000,maximumTL:12}]};
 }
 const ships=group==='vargr'?{Corsair:'Ueknou',Courier:'Avouz',Trader:'Rourrghksue Aeknaek'}:group==='zhodani'?{Courier:'Yetsasl',Scout:'Ninz',Trader:'Zdebr'}:{};
 if(source.id==='aliens'&&ships[name]){
  const citation=src('aliens',group==='vargr'?207:277);
  if(previousCount>=4)return {...unknown(name,citation,'A fifth mortgage award after full ownership has no specified result.'),definitionId:group+'.ship.'+name};
  return {name,definitionId:group+'.ship.'+name,source:citation,needsAdjudication:false,effects:[{kind:'ship-mortgage',family:ships[name],variants:[ships[name]],percentDelta:25,percentAfter:25*(previousCount+1),...(previousCount?{}:{quirks:{countDice:'1D',table:'core.outdated-ships',sourcePage:188}})}]};
 }
 if(group==='zhodani'&&source.id==='aliens'&&name==='Nenj')return unknown(name,src('aliens',276),'Record Nenj membership, discount scope and any repeated award explicitly; no TAS conversion is specified.');
 if(group==='companion'&&source.id==='companion'){
  if(['Minor Following','Major Following'].includes(name))return {name,definitionId:'companion.'+name,source:src('companion',36),needsAdjudication:false,effects:[{kind:'relationship',type:name==='Minor Following'?'Contact':'Ally',count:1},{kind:'stat',name:'FOL',dice:name==='Minor Following'?'D3':'1D',multiplier:1,add:name==='Minor Following'?0:1}]};
  if(name==='Patronage')return {name,definitionId:'companion.patronage',source:src('companion',36),needsAdjudication:false,effects:[{kind:'annual-income',name,annualCredits:10000,condition:'Patron may request appearances or presentations.'}]};
  if(['Spiritual assurance','Spiritual reward','Statue'].includes(name))return {name,definitionId:'companion.'+name,source:src('companion',38),needsAdjudication:false,effects:[{kind:'entitlement',name,quantity,nonnumeric:true}]};
  if(name==='Sainthood candidacy')return {name,definitionId:'companion.sainthood',source:src('companion',35),needsAdjudication:false,effects:[{kind:'sainthood',candidacy:previousCount+1}]};
 }
 if(coreNames.has(name)&&['core','companion','aslan','vargr','zhodani'].includes(group)){
  // Alien generic material awards inherit Core. Named alien ships are handled above.
  const base=materialBenefit({name,previousCount,quantity});
  if(name==="Ship's Boat"&&previousCount===0)return {...unknown(name,src('core',47),'Resolve the first small-craft award and the scope of its Ship Share alternative explicitly.'),definitionId:'core.material.'+name};
  return {...base,definitionId:'core.material.'+name};
 }
 return unknown(name,source,'This named benefit lacks a fully supported source definition. Resolve its actual outcome before completing the award.');
}
export function pensionEntitlement({careerId,terms,soc}={}){
 if(!Number.isInteger(terms)||terms<0||terms>100)throw Error('Career terms must be 0-100.');
 if(!knownCareers.has(careerId))return {needsAdjudication:true,source:src('core',48),reason:'The pension rule for this career has not been established.'};
 const group=careerId.split('.')[0],base={careerId,terms,paymentInterval:'year',source:src('core',48),needsAdjudication:false};
 if(group==='core')return {...pensionForCareer({careerId,terms}),condition:'Collect at a Class A or B starport, at the beginning of each year.'};
 if(group==='aslan')return {...base,source:src('aliens',47),eligible:false,excluded:true,annualCredits:0,condition:'Aslan careers do not provide pensions.'};
 if(!['vargr','zhodani','companion'].includes(group))return {...base,needsAdjudication:true,reason:'No source pension inheritance has been verified.'};
 if(group==='zhodani'&&!Number.isInteger(soc))return {...base,source:src('aliens',277),needsAdjudication:true,reason:'Determine Noble status before calculating the Consular pension.'};
 const multiplier=group==='zhodani'&&soc>=11?2:1;
 return {...base,source:group==='zhodani'?src('aliens',277):group==='vargr'?src('aliens',186):src('companion',35),basisSource:src('core',48),eligible:terms>=5,excluded:false,annualCredits:terms<5?0:(10000+(terms-5)*2000)*multiplier,multiplier,condition:group==='zhodani'?'Payable only within the Zhodani Consulate.':'Collect at a Class A or B starport, at the beginning of each year.'};
}
