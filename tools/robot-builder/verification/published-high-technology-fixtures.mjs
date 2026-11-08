// Independent published high-technology reconstructions, Robot Handbook (Mongoose 2022).
// Source records explicitly mark Sabmiqys skills/endurance uncertain; no hidden components are invented.
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';
const arm=(id,kind='base',str=0,dex=0)=>({id,kind,size:5,strengthIncrease:str,dexterityIncrease:dex});
export const highPublishedFixtures=[
 {id:'sabmiqys',name:'Sabmiqys',page:256,kind:'android',tl:17,
 published:{cost:70000000,hits:20,armour:4,speed:6,endurance:288,intelligence:15,arms:[[9,10],[9,10],[9,10],[9,10]],bandwidthCapacity:60},
 assumptions:['Size 5 inferred from 20 Hits and armSTR 9; superior android reserves 8 Slots; four equal Size 5 arms, efficiency and agility 1 reproduce listed characteristics. Published skills are unknown and endurance has a question mark; no skill allocation is invented.'],
 knownDifference:'Listed anatomy and equipment use 17 of 16 Slots. Price and listed physical stats are reproduced, not a legal fit.',
 patch:{special:{bodyTier:'superior'},selections:{locomotion:{primary:'walker'},physical:{armourAdded:4,agility:1,efficiency:true,manipulators:[arm('base-1'),arm('base-2'),arm('extra-1','additional'),arm('extra-2','additional')],defaultSuite:['auditory-sensor-broad-spectrum','olfactory-sensor-advanced','pris-sensor','transceiver-5000km-advanced','voder-speaker-broad-spectrum'],options:['self-maintenance-enhancement-advanced']},brain:{model:'conscious-tl17',bandwidthUpgrade:'bw-40'}}}},
 {id:'ultima',name:'Ultima',page:257,kind:'android',tl:18,
 published:{cost:73000000,hits:20,armour:10,speed:9,endurance:259,intelligence:18,arms:[[15,15],[15,15]],freeBandwidth:74},
 assumptions:['Size 5 superior body; armour 10, agility 3+tactical 1 and efficiency reproduce 9 m/259 hours; STR+6/DEX+5 on each arm. ConsciousTL 18 plus 50 Bandwidth andINT+3; Athletics 0 gains characteristicDM 3, active camouflage grantsStealth 4. No list-price override.'],
 patch:{special:{bodyTier:'superior'},selections:{locomotion:{primary:'walker'},physical:{armourAdded:10,agility:3,tacticalSpeed:1,efficiency:true,manipulators:[arm('base-1','base',6,5),arm('base-2','base',6,5)],defaultSuite:['auditory-sensor-broad-spectrum','pris-sensor','transceiver-5000km-advanced','voder-speaker-broad-spectrum','wireless'],options:['active-camouflage','audible-camouflage-advanced','olfactory-camouflage-advanced','visual-camouflage-superior','gecko-grippers','radiation-environment-protection','self-maintenance-enhancement-advanced','vacuum-environment-protection']},brain:{model:'conscious-tl18',bandwidthUpgrade:'bw-50',intellectUpgrade:3},skills:{packages:['athletics-0']}}}}
];
export const evaluateHighPublished=id=>{const f=highPublishedFixtures.find(f=>f.id===id);return evaluateDesign(updateDesign(createDesign({kind:f.kind,techLevel:f.tl}),f.patch));};
