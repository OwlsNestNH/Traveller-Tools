// Presentation classification only. No firing costs, magazine rules or damage effects.
export function isEnergyWeapon(weapon){
 const type=weapon?.type??'';
 return !/missile|torpedo|sandcaster|railgun|projectile/i.test(type)&&/^(?:beam lasers?|pulse lasers?|lasers?|particle beams?|plasma guns?|fusion guns?|meson guns?|ion cannons?)\b/i.test(type);
}
export function recordedWeaponPower(design,weapon,original=design){
 const previous=original?.record?.weapons?.find(w=>w.id===weapon.id);
 if(previous&&previous.type!==weapon.type)return null;
 const names=[weapon.name.toLowerCase(),weapon.id.replaceAll('-',' ').toLowerCase()];
 const matches=(design?.record?.requirements??[]).filter(r=>names.includes(r.name.toLowerCase()));
 return matches.length===1?matches[0].power:null;
}
