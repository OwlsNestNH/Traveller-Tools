// Fictional Traveller ammunition profiles; no real-world manufacture or operation.
import {clone} from './schema.mjs';
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const categories={
 pistol:['assault-pistol','cartridge-pistol','heavy-revolver','universal-auto-pistol'],
 rifle:['accelerator-rifle-11','big-game-rifle','gauss-rifle','gauss-sniper-rifle','gauss-submachinegun','sniper-rifle','snub-carbine','heavy-advanced-combat-rifle'],
 shotgun:['assault-shotgun','sawn-off-shotgun','light-shotgun'],
 heavy:['grenade-launcher-standard','ram-grenade-launcher-standard']
};
const registry=new Map(Object.entries(categories).flatMap(([category,ids])=>ids.map(id=>['csc-'+id,category])));
export const CSC_SPECIALISED_AMMUNITION_IDS=Object.freeze([...registry.keys()]);
const modifications=[
 {id:'armour-piercing',label:'Armour Piercing',tl:4,costMultiplier:4,rangeNumerator:1,rangeDenominator:1,categories:['pistol','rifle','shotgun','heavy'],pages:'178-179'},
 {id:'solid-shot',label:'Solid Shot',tl:5,costMultiplier:2,rangeNumerator:3,rangeDenominator:4,categories:['pistol','rifle','shotgun','heavy'],pages:'179,181'},
 {id:'apds',label:'APDS',tl:5,costMultiplier:5,rangeNumerator:11,rangeDenominator:10,categories:['rifle','heavy'],pages:'179-180'},
 {id:'baton',label:'Baton',tl:5,costMultiplier:2,rangeNumerator:3,rangeDenominator:4,categories:['pistol','rifle','shotgun','heavy'],pages:'179-180'},
 {id:'extended-range',label:'Extended Range',tl:7,costMultiplier:3,rangeNumerator:5,rangeDenominator:4,categories:['pistol','rifle','heavy'],pages:'179-180'}
];
export function specialisedAmmunitionCategory(weapon){return weapon?.sourceFamily==='csc-2023'&&Number.isFinite(weapon.magazineCost)&&Number.isSafeInteger(weapon.magazine)&&weapon.magazine>0?registry.get(weapon.id)??null:null;}
export function ammunitionModificationLabel(id){return id==='standard'?'Standard':modifications.find(item=>item.id===id)?.label??'Unavailable ammunition ('+id+')';}
export function ammunitionProductIdentity(sourceWeaponId,variant,modification='standard'){return sourceWeaponId+':'+variant+(modification==='standard'?'':':'+modification);}
export function manufactureDeclaration(weapon,declaredTL){return {declaredTL:declaredTL??null,catalogueTL:weapon.tl,scope:'all-linked-copies',status:declaredTL==null?'unknown':declaredTL===weapon.tl?'catalogue-tier-declared':'unsupported-tier',source:csc('10-11,178')};}
export function specialisedAmmunitionChoices(weapon){
 const category=specialisedAmmunitionCategory(weapon);
 return [{id:'standard',label:'Standard'},...modifications.filter(item=>item.categories.includes(category)).map(item=>({id:item.id,label:item.label,tl:item.tl,source:csc(item.pages)}))];
}
export function specialisedAmmunitionAssessment(weapon,id,declaredTL,designTL){
 if(id==='standard')return {valid:true,modification:'standard',label:'Standard',costMultiplier:1,source:weapon.source,issues:[]};
 const mod=modifications.find(item=>item.id===id),category=specialisedAmmunitionCategory(weapon),issues=[];
 const issue=(code,message)=>issues.push({severity:'blocker',code,message,source:csc(mod?.pages??'178-181')});
 if(!mod)issue('CSC_AMMO_MODIFICATION_UNKNOWN','Retained ammunition modification is unavailable; select a supported single modification.');
 if(!category)issue('CSC_AMMO_PROFILE_UNSUPPORTED','Specialised ammunition is outside this implementation scope for the selected source profile; source families and heavy exceptions are not inferred.');
 if(mod&&category&&!mod.categories.includes(category))issue('CSC_AMMO_CATEGORY','This ammunition modification does not support the source ammunition category.');
 if(declaredTL==null)issue('CSC_AMMO_MANUFACTURE_REQUIRED','Declare the weapon manufacture TL for all linked copies; robot TL is not manufacturing evidence.');
 else {
  if(declaredTL!==weapon.tl)issue('CSC_AMMO_MANUFACTURE_TIER_UNRESOLVED','This declaration is retained. Hardware pricing is supported only at the selected catalogue TL; higher or lower manufacture is not certified or repriced.');
  if(mod&&declaredTL<mod.tl)issue('CSC_AMMO_MANUFACTURE_TL','The selected ammunition exceeds the declared weapon manufacture TL.');
 }
 if(mod&&designTL<mod.tl)issue('CSC_AMMO_DESIGN_TL','The selected ammunition exceeds design technology.');
 return {valid:issues.length===0,modification:id,label:ammunitionModificationLabel(id),costMultiplier:issues.length?null:mod?.costMultiplier??null,source:csc(mod?.pages??'178-181'),issues};
}
// This transform is pure and operates only on a source-defined primary attack.
// Per-copy purchase/loaded state and manufacture checks belong to the caller.
export function transformSpecialisedAmmunition(weapon,id,traits=weapon.traits){
 const mod=modifications.find(item=>item.id===id),category=specialisedAmmunitionCategory(weapon);
 const base={damage:weapon.damage,range:weapon.range,traits:clone(traits),conditionalEffects:clone(weapon.conditionalEffects??{}),source:id==='standard'?clone(weapon.source):csc(mod?.pages??'178-181')};
 if(id==='standard')return base;
 if(!mod||!category||!mod.categories.includes(category))return null;
 const parsed=/^(\d+)D([+-]\d+)?$/.exec(weapon.damage??'');
 if(!parsed||!Number.isFinite(weapon.range))return null;
 const dice=Number(parsed[1]),constant=Number(parsed[2]??0),newDice=id==='extended-range'?dice-1:dice,newConstant=id==='apds'?constant-dice:constant;
 if(newDice<1)return null;
 base.damage=newDice>=10&&dice<10?'1DD':newDice+'D'+(newConstant>0?'+'+newConstant:newConstant<0?String(newConstant):'');
 base.range=weapon.range*mod.rangeNumerator/mod.rangeDenominator;
 delete base.conditionalEffects.standardAmmunition;
 const ap=traits.reduce((value,trait)=>/^AP \d+$/.test(trait)?value+Number(trait.slice(3)):value,0);
 if(['armour-piercing','solid-shot','apds','baton'].includes(id))base.traits=base.traits.filter(trait=>!/^AP(?: |$)/.test(trait));
 if(id==='baton'){
  base.traits=base.traits.filter(trait=>!/^Blast(?: |$)/.test(trait));
  base.conditionalEffects.batonDamageSplit={stunFraction:.5,roundStun:'up',ordinaryRemainder:true,armourProcessingOrder:'unresolved',source:csc('179-180')};
 } else if(id!=='extended-range')base.traits.push('AP '+(ap+(id==='armour-piercing'?dice:id==='solid-shot'?Math.ceil(dice/2):3*dice)));
 if(category==='shotgun'){
  delete base.conditionalEffects.pelletAmmunition;
  if(weapon.id==='csc-sawn-off-shotgun')delete base.conditionalEffects.attackModifiers;
  base.conditionalEffects.nonPelletAmmunition={pelletBenefitsApplied:false,spreadBonusApplied:false,source:csc('148,178-181')};
 }
 return base;
}
export function qualifyModifiedMagazine(product,assessment){
 if(assessment.modification==='standard')return clone(product);
 return {...clone(product),productId:ammunitionProductIdentity(product.sourceWeaponId,product.variant??product.id,assessment.modification),modification:assessment.modification,modificationLabel:assessment.label,modificationSource:assessment.source,unitCost:assessment.valid&&Number.isFinite(product.unitCost)?product.unitCost*assessment.costMultiplier:null,
  ...(product.estimate?{estimate:{...clone(product.estimate),basis:'standard-load-based',actualModifiedMassKg:null,modifiedLoadMassResolved:false,modificationSource:assessment.source,scope:'Standard-load-based estimate only; actual modified-load mass is unresolved.'}}:{})};
}
export function recordUsesSpecialisedAmmunition(record){
 return ['initialAmmunitionModification','spareAmmunitionModification','highCapacityAmmunitionModification'].some(field=>record[field]!==undefined&&record[field]!=='standard')||(record.alternateMagazineSupplies??[]).some(item=>item.modification!==undefined&&item.modification!=='standard')||(record.ammunitionOverrides??[]).some(recordUsesSpecialisedAmmunition);
}
