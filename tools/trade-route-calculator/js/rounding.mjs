import {dec,decimal,cmp,floor,mul,div,sum} from './amounts.mjs';
export function up(value,step=1){const v=dec(div(value,step));return (-floor({n:-v.n,d:v.d}))*BigInt(step);}
export const creditStep=s=>s.settings.creditStep===100?100:1;
export function change(value,step,label){const after=String(up(value,step));return cmp(value,after)?{label,before:decimal(value),after,unit:step===100?'Credits up to Cr100':'up to whole units'}:null;}
export function roundExisting(s){
 const changes=[];const set=(o,k,step,label)=>{if(o[k]==null)return;const c=change(o[k],step,label);if(c){o[k]=c.after;changes.push(c);}};
 set(s,'bank',100,'Bank');set(s.ship,'capacity',1,'Cargo capacity · tons');
 if(s.ship.accommodation)set(s.ship.accommodation,'luggageTons',1,'Actual passenger luggage · tons');
 if(s.ship.accommodation&&s.ship.accommodation.luggageTons==null&&!s.ship.roundTons){const passengers=s.ship.accommodation.passengers;const c=change(sum(Object.entries({low:'0.01',middle:'0.1',high:'1'}).map(([k,v])=>mul(passengers[k]||0,v))),1,'Combined passenger luggage allowance · tons');if(c)changes.push(c);}
 for(const [k,v]of Object.entries(s.ship.expenses||{}))set(s.ship.expenses,k,100,'Saved '+k+' monthly cost');
 for(const [tier,service]of Object.entries(s.ship.accommodation?.roomService||{}))if(service.level==='custom')set(service,'monthly',100,tier+' stateroom custom monthly cost');
 for(const l of s.lots){set(l,'quantity',1,l.description+' · tons');set(l,'basis',100,l.description+' · cost basis');set(l,'goodsValue',100,l.description+' · goods value');}
 for(const snap of s.snapshots)for(const o of snap.offers||[]){set(o,'remaining',1,(o.description||o.commodity)+' offer · remaining tons');set(o,'unitPrice',100,(o.description||o.commodity)+' offer · Cr/ton');}
 for(const c of s.contracts.filter(c=>c.status==='accepted'&&c.kind!=='passenger')){set(c,'quantity',1,(c.description||c.kind)+' · tons');set(c,'payment',100,(c.description||c.kind)+' · payment');}
 // Insurance terms/claims and original transaction audits are historical contracts, not editable balances.
 s.ship.roundTons=true;s.settings.creditStep=100;
 return changes;
}
