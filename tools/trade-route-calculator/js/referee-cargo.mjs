// Arbitrary referee cargo is deliberately separate from commodity trade lots.
import * as A from './amounts.mjs';
const whole=(value,label,{positive=false}={})=>{const text=String(value??'');if(!/^\d+$/.test(text)||positive&&BigInt(text)===0n)throw Error(label+' must be '+(positive?'positive ':'nonnegative ')+'whole numbers.');return String(BigInt(text));};
const description=value=>{const text=String(value??'').trim();if(!text)throw Error('Item / description required.');return text;};
export function otherCargoRows(state){return state.otherCargo??[];}
export function validateOtherCargo(state){
 if(state.otherCargo===undefined)return;
 if(!Array.isArray(state.otherCargo))throw Error('Invalid Other cargo.');
 if(state.otherCargo.length&&state.schema!==2)throw Error('Other cargo requires campaign format 2.');
 const ids=new Set(state.lots.map(l=>l.id));
 for(const item of state.otherCargo){
  if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.id!=='string'||!/^[A-Za-z0-9_,.:-]{1,100}$/.test(item.id)||ids.has(item.id))throw Error('Invalid or duplicate Other cargo ID.');ids.add(item.id);
  if(typeof item.description!=='string'||!item.description.trim()||typeof item.quantity!=='string'||whole(item.quantity,'Cargo space',{positive:true})!==item.quantity)throw Error('Invalid Other cargo item.');
  if(item.saleValue!==undefined&&(typeof item.saleValue!=='string'||whole(item.saleValue,'Sale value')!==item.saleValue))throw Error('Invalid Other whole-lot sale value.');
  if(!state.worlds[item.world]||!Number.isSafeInteger(item.hours)||item.hours<0||typeof item.reason!=='string'||!item.reason.trim())throw Error('Invalid Other cargo acquisition record.');
  if(item.losses!==undefined){if(!Array.isArray(item.losses)||!item.losses.length)throw Error('Invalid Other cargo loss audit.');for(const loss of item.losses){if(!loss||!/^\d+$/.test(String(loss.removed))||!/^\d+$/.test(String(loss.remaining))||!/^\d+$/.test(String(loss.normalized))||BigInt(loss.removed)<=0n||BigInt(loss.remaining)<=0n||BigInt(loss.removed)+BigInt(loss.remaining)!==BigInt(loss.normalized)||!Number.isSafeInteger(loss.hours)||loss.hours<0||loss.previousSaleValue!==null&&(typeof loss.previousSaleValue!=='string'||whole(loss.previousSaleValue,'Previous sale value')!==loss.previousSaleValue))throw Error('Invalid Other cargo loss audit.');}}
 }
}
export function refereeTradeInput(input){
 const quantity=whole(input.quantity,'Tons',{positive:true}),unitPrice=whole(input.purchasePrice,'Purchase cost per ton');
 if(!/^[1-6][1-6]$/.test(input.commodity))throw Error('Choose a trade commodity.');
 const total=String(BigInt(quantity)*BigInt(unitPrice));
 return {commodity:input.commodity,description:description(input.description),quantity,basis:total,goodsValue:total,illegal:!!input.illegal,audit:{manual:true,price:{unitPrice,audit:{referee:true}},reason:String(input.reason??'').trim()}};
}
export function addOtherCargo(state,input,{uid}){
 const reason=String(input.reason??'').trim();if(!reason)throw Error('Referee reason required.');
 const item={id:uid(),description:description(input.description),quantity:whole(input.quantity,'Cargo space',{positive:true}),world:state.actual,hours:state.hours,reason};
 if(String(input.saleValue??'').trim()!=='')item.saleValue=whole(input.saleValue,'Sale value');
 state.schema=2;(state.otherCargo??=[]).push(item);state.events.push({id:uid(),label:'Other cargo addition',hours:state.hours,world:state.actual,item:structuredClone(item)});return item;
}
export function adjustOtherCargo(state,id,input,{uid}){
 const item=otherCargoRows(state).find(x=>x.id===id);if(!item)throw Error('Other cargo no longer aboard.');const before=structuredClone(item),reason=String(input.reason??'').trim();if(!reason)throw Error('Referee reason required.');
 item.description=description(input.description);item.quantity=whole(input.quantity,'Cargo space',{positive:true});
 if(String(input.saleValue??'').trim()==='')delete item.saleValue;else item.saleValue=whole(input.saleValue,'Sale value');
 state.events.push({id:uid(),label:'Other cargo adjustment',hours:state.hours,world:state.actual,reason,before,after:structuredClone(item)});return item;
}
export function sellOtherCargo(state,id,saleValue,{uid,note}){
 const item=otherCargoRows(state).find(x=>x.id===id);if(!item)throw Error('Other cargo no longer aboard.');
 if(String(saleValue??'').trim()==='')throw Error('Enter Sale value — whole lot; use 0 for a free transfer.');
 const total=whole(saleValue,'Sale value');state.otherCargo=state.otherCargo.filter(x=>x.id!==id);
 note(state,'Other cargo sale',BigInt(total),{otherCargoId:id,audit:{description:item.description,quantity:item.quantity,saleValue:total,wholeLot:true}});
 state.events.push({id:uid(),label:'Other cargo sale audit',hours:state.hours,world:state.actual,item:structuredClone(item),saleValue:total});return total;
}
