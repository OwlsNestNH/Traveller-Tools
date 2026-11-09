// Bounded Core 2022 equipment identifiers, not a complete equipment/combat engine.
const rows=[
 ['core.cloth-tl7','Cloth','armour',250,7,null,100],
 ['core.cloth-tl10','Cloth','armour',500,10,null,100],
 ['core.blade','Blade','blade',100,2,'Melee (blade)',124],
 ['core.cutlass','Cutlass','blade',200,2,'Melee (blade)',124],
 ['core.dagger','Dagger','blade',10,1,'Melee (blade)',124],
 ['core.autopistol','Autopistol','gun',200,5,'Gun Combat (slug)',126],
 ['core.rifle','Rifle','gun',200,5,'Gun Combat (slug)',126]
];
const items=rows.map(([id,name,category,cost,techLevel,weaponSkill,page])=>({id,name,category,cost,techLevel,weaponSkill,source:{id:'core',page}}));
export function equipmentOptions(pending){
 if(pending.source!=='core')return [];
 // Unknown restrictions stay book-assisted rather than being guessed.
 if((pending.restrictions??[]).some(r=>r!=='common-or-military-ranged'))return [];
 return structuredClone(items.filter(item=>(item.category===pending.category||pending.category==='weapon'&&!!item.weaponSkill)&&item.cost<=pending.maximumCost&&item.techLevel<=pending.maximumTL&&(!pending.weaponSkillRequired||pending.weaponSkillOptions.includes(item.weaponSkill))));
}
export function resolveEquipmentItem(pending,payload){
 const item=equipmentOptions(pending).find(item=>item.id===payload.benefitItemId);
 if(!item)throw new Error('Choose an available catalogue item for this award, category, cost and TL limit.');
 for(const [key,value]of Object.entries({benefitItemName:item.name,benefitItemCost:item.cost,benefitItemTL:item.techLevel,benefitWeaponSkill:item.weaponSkill}))if(payload[key]!==undefined&&payload[key]!==value)throw new Error('Catalogue item metadata does not match '+key+'.');
 return item;
}
