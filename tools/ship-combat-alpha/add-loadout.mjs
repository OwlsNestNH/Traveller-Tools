// Only this source has a verified turret capacity. A barbette is never a turret slot.
export const LOADOUTS={keep:'Keep existing',unarmed:'Unarmed',beam:'Beam',pulse:'Pulse',mixed:'Missile + pulse'};
export function fitLoadout(template,presetId,choice='keep',sand=false){
 if(!Object.hasOwn(LOADOUTS,choice))throw Error('Choose a loadout.');
 const original=template.record.weapons;
 if(choice==='keep'&&!sand)return structuredClone(original);
 if(choice==='unarmed'&&!sand)return [];
 if(presetId!=='drinax-harrier-restored')throw Error('Mount capacity is unverified. Use Customize to record a fit.');
 if(choice==='mixed')throw Error('Missile + pulse requires two verified separate turrets. Use Customize.');
 if(choice==='unarmed')throw Error('Unarmed cannot include sandcaster defense. Choose another loadout.');
 const turret=original?.find(w=>w.id==='missile-turret');
 if(!turret||turret.name!=='Ventral single turret'||turret.count!==1)throw Error('Customized mount capacity needs manual review. Use Customize.');
 // A defense selection replaces the single turret weapon, never adds a free slot.
 const type=sand?'Sandcaster':choice==='beam'?'Beam laser':choice==='pulse'?'Pulse laser':turret.type;
 return original.map(w=>w.id===turret.id?{...w,type,ammunition:type===turret.type?w.ammunition:null}:structuredClone(w));
}
