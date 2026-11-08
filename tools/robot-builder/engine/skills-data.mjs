// Speciality names verified against Core Rulebook Update 2022, pp64-72.
// Open lists remain open; these are examples, not arbitrary universal restrictions.
export const SPECIALITIES={
 animals:['handling','veterinary','training'],art:['performer','holography','instrument','visual-media','write'],athletics:['dexterity','endurance','strength'],
 drive:['hovercraft','mole','track','walker','wheel'],electronics:['comms','computers','remote-ops','sensors'],engineer:['m-drive','j-drive','life-support','power'],
 flyer:['airship','grav','ornithopter','rotor','wing'],gunner:['turret','ortillery','screen','capital'],'gun-combat':['archaic','energy','slug'],
 'heavy-weapons':['artillery','portable','vehicle'],melee:['unarmed','blade','bludgeon','natural'],pilot:['small-craft','spacecraft','capital-ships'],
 seafarer:['ocean-ships','personal','sail','submarine'],tactics:['military','naval'],language:['Galanglic','Vilani','Zdetl','Oynprith','Trokh','Gvegh'],
 profession:['belter','biologicals','civil-engineering','construction','hydroponics','polymers'],
 science:['archaeology','astronomy','biology','chemistry','cosmology','cybernetics','economics','genetics','history','linguistics','philosophy','physics','planetology','psionicology','psychology','robotics','sophontology','xenology']
};
// Additional source specialities do not change saved Core all-listed packages.
export const SOURCE_SPECIALITIES={melee:[{id:'whip',source:{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages:'141'}}]};
export const CUSTOM_PACKAGE_FIELDS=[
 {field:'skill',label:'Book-permitted custom skill',type:'select',choices:[{id:'language',label:'Language'},{id:'profession',label:'Profession'},{id:'science',label:'Science'},{id:'art-instrument',label:'Art (specific instrument)'}]},
 {field:'speciality',label:'Language, profession, science field or instrument',type:'text',maxLength:120},
 {field:'level',label:'Package level',type:'number',min:0,max:3,step:1}
];
