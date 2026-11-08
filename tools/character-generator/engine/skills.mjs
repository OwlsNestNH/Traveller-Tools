// Core 2022 pp.18,58,64-72, with explicitly printed expansion specialities.
// Open subject/language/profession names remain user-entered.
export const SPECIALITIES=Object.freeze({
 Animals:['handling','veterinary','training','riding'],
 Art:['performer','holography','instrument','visual media','write','acting','dance','sculpting','writing'],
 Athletics:['dexterity','endurance','strength'],
 Drive:['hovercraft','mole','track','walker','wheel'],
 Electronics:['comms','computers','remote ops','sensors'],
 Engineer:['m-drive','j-drive','life support','power'],
 Flyer:['airship','grav','ornithopter','rotor','wing'],
 'Gun Combat':['archaic','energy','slug'],
 Gunner:['turret','ortillery','screen','capital'],
 'Heavy Weapons':['artillery','portable','vehicle'],
 Melee:['unarmed','blade','bludgeon','natural'],
 Pilot:['small craft','spacecraft','capital ships'],
 Seafarer:['ocean ships','personal','sail','submarine'],
 Tactics:['military','naval'],
 Language:null,Profession:null,Science:null
});
export const PSIONIC_TALENTS=Object.freeze(['Telepathy','Clairvoyance','Telekinesis','Awareness','Teleportation','Technopathy']);
const ALIASES={'Drive (tracked)':'Drive (track)','Drive (wheeled)':'Drive (wheel)','Engineer (power plant)':'Engineer (power)'};
export function normalizeSkillName(input,{requireSpeciality=false}={}){
 if(typeof input!=='string'||input.length>80)throw new Error('Invalid skill name.');
 const name=ALIASES[input.trim()]??input.trim();
 const parsed=name.match(/^([^()]+?)(?: \(([^()]+)\))?$/);
 if(!parsed)throw new Error('Use a complete skill name and specialisation, for example Pilot (spacecraft).');
 const base=parsed[1],speciality=parsed[2];
 if(base!==base.trim()||speciality&&speciality!==speciality.trim())throw new Error('Remove extra spaces from the skill name.');
 const specialised=Object.hasOwn(SPECIALITIES,base);
 if(speciality&&!specialised)throw new Error('This skill does not use specialisations.');
 if(requireSpeciality&&specialised&&!speciality)throw new Error('Choose a specialisation, for example Pilot (spacecraft).');
 if(speciality&&Array.isArray(SPECIALITIES[base])&&!SPECIALITIES[base].includes(speciality))throw new Error('Choose a listed '+base+' specialisation.');
 return {name,base,speciality};
}
