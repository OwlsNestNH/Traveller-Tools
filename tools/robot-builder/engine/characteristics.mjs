import {integer} from './schema.mjs';
export function characteristicDM(value){integer(value,0,100,'characteristic');return value===0?-3:value<=2?-2:value<=5?-1:value<=8?0:value<=11?1:value<=14?2:3;}
