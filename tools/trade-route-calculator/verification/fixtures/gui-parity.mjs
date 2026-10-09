// Synthetic, deterministic GUI records. No live campaign or third-party data.
import {readFile} from 'node:fs/promises';
import {initial,validate} from '../../js/state.mjs';
import {normalize} from '../../js/map.mjs';
import {context,quote} from '../../js/rules.mjs';
import {configureFuel} from '../../js/fuel.mjs';
const core=JSON.parse(await readFile(new URL('../../rules/core-2022.json',import.meta.url),'utf8'));
export const campaignKey='traveller-trade-route-calculator:v1';
export function guiFixture(stops=12){
 if(![12,30].includes(stops))throw Error('Expected 12 or 30 route stops');
 const routeWorlds=Array.from({length:stops},(_,i)=>{
  const x=-124+(i<15?i:29-i),y=-70+Math.floor(i/15);
  return {Name:i===0?'Verification Anchorage':i===2?'ExtraordinarilyLongUnbrokenWorldNameForNarrowViewportVerification':`Verification ${i+1} · Extremely Long Outer Marches Trading Outpost`,Hex:String(x+129).padStart(2,'0')+String(y+80).padStart(2,'0'),UWP:'A788899-C',PBG:'703',Zone:'',WorldX:x,WorldY:y,Sector:'Verification Reach'};
 });
 const extra=Array.from({length:25},(_,i)=>({Name:'Survey '+i,Hex:String(2+i%5*3).padStart(2,'0')+String(3+Math.floor(i/5)*3).padStart(2,'0'),UWP:'C799663-9',PBG:'323',Zone:i%7===0?'A':'',WorldX:-127+i%5*3,WorldY:-77+Math.floor(i/5)*3,Sector:'Verification Reach'}));
 const apiWorlds=[...new Map([...extra,...routeWorlds].map(w=>[w.WorldX+','+w.WorldY,w])).values()];
 const state=initial();
 Object.assign(state,{initialized:true,name:'GUI parity verification',revision:17,bank:'765432',hours:48,dateLabel:'001-1105'});
 state.ship={...state.ship,name:'Far Horizon · Synthetic Test Trader',capacity:'120',staterooms:4,jump:2,fuel:configureFuel(200,40,20,0,2),lifeSupport:{capacityHours:28*24,remainingHours:14*24,elapsedHours:0},accommodation:{rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:2,high:0}}};
 state.worlds=Object.fromEntries(routeWorlds.map(raw=>{const w=normalize(raw);return [w.id,w];}));
 state.route=routeWorlds.map(w=>w.WorldX+','+w.WorldY);state.routeIndex=1;state.actual=state.route[state.routeIndex];
 const world=context(state.worlds[state.actual],core),options={side:'buy',skill:2,counterparty:1,creditStep:1};
 let rollIndex=0;
 const price=quote(core.commodities.find(g=>g.id==='11'),world,options,core,()=>[2,4,6][rollIndex++]);
 const generated={id:'offer-recorded',commodity:'11',description:'Recorded electronics',remaining:'12',unitPrice:price.unitPrice,expired:false,illegal:false,audit:{...price.audit,quantityRolls:[{dice:[3,4],populationDM:0,multiplier:10,tons:70}],randomDraws:['11']}};
 const legacy={id:'offer-legacy',commodity:'12',description:'Legacy machine parts',remaining:'9',unitPrice:'15000',expired:false,illegal:false,audit:{dice:{total:11},side:'buy'}};
 state.snapshots=[{id:'snapshot-recorded',kind:'supplier',worldId:state.actual,world,party:'verification|supplier',partyName:'Deterministic supplier',hours:24,startedHours:24,criminal:false,options,offers:[generated,legacy]}];
 state.lots=[
  {id:'lot-recorded',commodity:'11',description:'Recorded electronics',quantity:'4',basis:String(Number(price.unitPrice)*4),goodsValue:String(Number(price.unitPrice)*4),world:state.actual,hours:24,snapshotId:'snapshot-recorded',offerId:generated.id,audit:{price:structuredClone(generated),fee:'0',premium:'0'}},
  {id:'lot-legacy',commodity:'12',description:'Legacy machine parts',quantity:'3',basis:'45000',goodsValue:'45000',world:state.actual,hours:0,audit:{price:structuredClone(legacy)}},
  {id:'lot-opening',commodity:'15',description:'Opening cargo without generated rolls',quantity:'2',basis:'2000',goodsValue:'2000',world:state.actual,hours:0}
 ];
 state.contracts=[{id:'contract-fixture',kind:'freight',status:'accepted',origin:state.actual,destination:state.route[state.routeIndex+1],description:'Synthetic sealed machine spares',quantity:'5',payment:'5000',dueHours:24*30,audit:{manual:true,reason:'Deterministic verification contract'}}];
 state.ledger=[{id:'ledger-opening',type:'Opening bank',amount:'765432',hours:0,world:state.actual}];
 state.events=[{id:'event-setup',label:'Campaign setup',hours:0,world:state.actual},{id:'event-cargo',label:'Opening cargo',hours:0,world:state.actual,reason:'Synthetic fixture; no generated rolls'}];
 validate(state);
 const bytes=JSON.stringify(state);
 return {state,bytes,apiWorlds,universe:{Sectors:[{Names:[{Text:'Verification Reach'}],X:-4,Y:-1,Milieu:'M1105'}]},metadata:{Subsectors:Array.from({length:16},(_,i)=>({Index:String.fromCharCode(65+i),Name:'Verification '+String.fromCharCode(65+i)}))},sec:'Hex\tName\n'+apiWorlds.map(w=>w.Hex+'\t'+w.Name).join('\n')};
}
