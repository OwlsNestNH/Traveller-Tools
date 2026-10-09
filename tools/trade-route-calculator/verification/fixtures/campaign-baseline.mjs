// Isolated synthetic campaign; public M1105 world data captured 2026-10-09.
// Opening stocks are setup, not fictional purchases. No existing user storage is read.
import {readFile} from 'node:fs/promises';
import {initial,validate} from '../../js/state.mjs';
import {normalize} from '../../js/map.mjs';
export const campaignKey='traveller-trade-route-calculator:v1';
export const mapSnapshot=JSON.parse(await readFile(new URL('./trojan-reach-m1105.json',import.meta.url),'utf8'));
export const routePlan=JSON.parse(await readFile(new URL('./five-route-plan.json',import.meta.url),'utf8'));
export function campaignBaseline(){
 const s=initial();Object.assign(s,{initialized:true,name:'Synthetic five-trip stress test',bank:'400000',hours:0,dateLabel:'001-1105'});
 s.worlds=Object.fromEntries(mapSnapshot.Worlds.map(raw=>{const w=normalize(raw);return [w.id,w];}));
 s.actual='-107,-17';s.route=[s.actual];s.routeIndex=0;
 s.ship={name:'Synthetic Far Trader',capacity:'50',staterooms:7,jump:2,scoops:true,armed:false,roundTons:true,
  fuel:{displacementTons:200,baseCapacityTons:40,aboardTons:40,bladderJumps:1,bladderTons:40,capacityTons:80},
  accommodation:{rooms:{low:0,middle:6,high:1},passengers:{low:0,middle:0,high:1},crew:{low:0,middle:4,high:0},occupiedLowBerths:0,combinedPeople:true,luggageMode:'auto'},
  lifeSupport:{capacityHours:672,stockUnits:{numerator:'140',denominator:'1'}},expenses:{salary:'20000'},
  mortgage:{originalAmount:'36000000',payment:'150000',remainingPayments:480,totalPaid:'0',nextDueDate:'028-1105'},
  maintenance:{payment:'2300',nextDueDate:'028-1105',paidSinceTracking:'0'}};
 s.trader={broker:2,streetwise:2,admin:2,characteristic:1,rank:3,soc:1};
 s.ledger=[{id:'opening-bank',type:'Opening bank',amount:'400000',hours:0,world:s.actual}];
 s.events=[{id:'opening-setup',label:'Campaign setup',hours:0,world:s.actual,reason:'Synthetic baseline. Initial fuel/LSS and salary settings are setup; no payment recorded.'}];
 validate(s);return s;
}
export function byHex(hex){return mapSnapshot.Worlds.find(w=>w.Hex===hex&&w.Sector==='Trojan Reach');}
// Independent integer hex geometry; useful when answering the radius fixture.
export function hexDistance(a,b){const cube=w=>{const x=w.WorldX,z=w.WorldY-(w.WorldX-(w.WorldX&1))/2;return [x,-x-z,z];};return Math.max(...cube(a).map((n,i)=>Math.abs(n-cube(b)[i])));}
