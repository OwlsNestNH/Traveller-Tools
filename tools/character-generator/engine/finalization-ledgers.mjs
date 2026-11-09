import {equipmentOptions} from './equipment-catalog.mjs';
export function restrictedCreditItems(credit,category){
 if(!credit.categories.includes(category)||category==='Art')return [];
 return equipmentOptions({source:'core',category:category==='Armour'?'armour':'weapon',maximumCost:credit.remaining,maximumTL:100});
}
export function restrictedCreditPurchase(credit,payload){
 if(!payload||Object.keys(payload).some(k=>!['category','itemId','name','unitCost','quantity','techLevel','sourceNote','confirmed'].includes(k)))throw Error('Use only the restricted equipment purchase fields.');
 if(payload.confirmed!==true)throw Error('Confirm the item and its source restrictions.');
 if(!credit.categories.includes(payload.category))throw Error('This credit is restricted to its listed categories.');
 if(!Number.isSafeInteger(payload.quantity)||payload.quantity<1||payload.quantity>1000)throw Error('Choose a positive whole quantity, at most 1000.');
 const item=payload.itemId?restrictedCreditItems(credit,payload.category).find(i=>i.id===payload.itemId):null;
 if(payload.itemId&&!item)throw Error('Choose an available catalogue item in this credit category and budget.');
 if(item)for(const [key,value]of Object.entries({name:item.name,unitCost:item.cost,techLevel:item.techLevel}))if(payload[key]!==undefined&&payload[key]!==value)throw Error('Catalogue metadata does not match '+key+'.');
 const name=item?.name??payload.name,unitCost=item?.cost??payload.unitCost,techLevel=item?.techLevel??payload.techLevel,sourceNote=typeof payload.sourceNote==='string'?payload.sourceNote.trim():'';
 if(typeof name!=='string'||!name.trim()||name.length>120)throw Error('Enter the source-listed item name.');
 if(!Number.isSafeInteger(unitCost)||unitCost<1)throw Error('Enter a positive whole item cost.');
 if(techLevel!==undefined&&(!Number.isSafeInteger(techLevel)||techLevel<0||techLevel>100))throw Error('Enter a valid technology level when known.');
 const cost=unitCost*payload.quantity;if(!Number.isSafeInteger(cost)||cost>credit.remaining)throw Error('The items exceed this restricted credit balance.');
 if(!sourceNote||sourceNote.length>500)throw Error('Record the item source and restriction checks.');
 return {name:name.trim(),category:payload.category.toLowerCase(),unitCost,quantity:payload.quantity,cost,...(techLevel!==undefined?{techLevel}:{}),sourceDecision:sourceNote,...(item?{catalogueItemId:item.id,itemSource:item.source,requiredSkill:item.weaponSkill}: {})};
}
