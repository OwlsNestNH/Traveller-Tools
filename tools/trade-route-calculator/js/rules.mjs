import {up} from './rounding.mjs?v=service-completion-20261010-38';
import {dec,rat,add,sub,mul,div,cmp,floor,sum,decimal,auditNumber,allocate,credit} from './amounts.mjs';
export const VERSION='0.1.0';
export function die(){const a=new Uint32Array(1);let x;do{crypto.getRandomValues(a);x=a[0];}while(x>=4294967292);return x%6+1;}
export function roll(n,rng=die){const dice=Array.from({length:n},rng);if(dice.some(x=>!Number.isInteger(x)||x<1||x>6))throw Error('Invalid die');return {dice,total:dice.reduce((a,b)=>a+b,0)};}
// Campaign house rule: inspect only the three natural price dice, never a total or DM.
// The result is an audit flag. It has no economic, time or cargo side effects.
export function classifyTradeComplication(faces){
 if(!Array.isArray(faces)||faces.length!==3||Array.from(faces).some(d=>!Number.isInteger(d)||d<1||d>6))return 'unknown';
 const distinct=new Set(faces).size;
 return distinct===1?'severe':distinct===2?'complication':'none';
}
export function parseUWP(text,data){text=String(text).trim().toUpperCase();if(text.length!==9||text[7]!=='-'||!'ABCDEFGHXY?'.includes(text[0]))throw Error('UWP must look like A788899-C.');const out={raw:text};for(const [key,i]of Object.entries(data.uwp.fieldIndices)){const c=text[i];if(c==='?'){out[key]=null;continue;}if(key==='starport'){out[key]=c;continue;}const n=data.uwp.numericAlphabet.indexOf(c);if(n<0||(key in data.uwp.fieldMaxima&&n>data.uwp.fieldMaxima[key]))throw Error('Unsupported UWP '+key+'; use an explicit valid override.');out[key]=n;}return out;}
const matches=(n,r)=>r.anyOf?r.anyOf.some(x=>matches(n,x)):(!('equals'in r)||n===r.equals)&&(!r.oneOf||r.oneOf.includes(n))&&(!('min'in r)||n>=r.min)&&(!('max'in r)||n<=r.max);
export function tradeCodes(uwp,data){const codes=[],unknown=[];for(const[c,conditions]of Object.entries(data.tradeCodes.conditions)){const entries=Object.entries(conditions);if(entries.some(([k,r])=>uwp[k]!==null&&!matches(uwp[k],r)))continue;if(entries.some(([k])=>uwp[k]===null)){unknown.push(c);continue;}codes.push(c);}return {codes,unknown};}
export function context(world,data){const uwp=parseUWP(world.overrideUWP||world.uwp,data);const tc=tradeCodes(uwp,data);return {world:structuredClone(world),uwp,...tc,zone:world.zone||'Safe'};}
// Campaign interpretation: use the trade-code DM with the greatest absolute magnitude, retaining its sign.
// If opposite signs have equal magnitude, keep the numerically higher DM as a deterministic tiebreaker.
function strongestDM(values){return values.reduce((best,value)=>Math.abs(value)>Math.abs(best)||(Math.abs(value)===Math.abs(best)&&value>best)?value:best);}
function chosen(dm,codes){const applicable=Object.entries(dm).filter(([c])=>codes.includes(c));return {applicable:applicable.map(([code,value])=>({code,value})),selected:applicable.length?strongestDM(applicable.map(x=>x[1])):0};}
// Optional campaign price limits apply to table percentages, before rounding and fees.
export function priceLimits(options={}){
 const enabled=options.reducedProfitLimitsEnabled===undefined?false:options.reducedProfitLimitsEnabled;
 if(typeof enabled!=='boolean')throw Error('Reduced-profit limits must be on or off.');
 const read=(key,fallback,label)=>{
  const raw=options[key]===undefined?fallback:options[key];
  if(!['number','string'].includes(typeof raw)||(typeof raw==='string'&&!raw.trim()))throw Error(label+' must be a whole percentage from 0 to 400.');
  const value=Number(raw);
  if(!Number.isInteger(value)||value<0||value>400)throw Error(label+' must be a whole percentage from 0 to 400.');
  return value;
 };
 return {reducedProfitLimitsEnabled:enabled,minPurchasePercent:read('minPurchasePercent',85,'Minimum buy'),maxSalePercent:read('maxSalePercent',115,'Maximum sell')};
}
export function effectiveBasePrice(good,options={}){
 const raw=good?.baseCreditsPerTon;
 if(raw===null||raw===undefined)return {raw:null,effective:null,cap:null,capApplied:false,illegalExempt:false};
 const enabled=!!options.maxBaseRetailEnabled,illegalExempt=!!options.useRawIllegalPrices&&!!options.illegalGood;
 let cap=null;
 if(enabled){cap=Number(options.maxBaseRetail);if(!Number.isFinite(cap)||cap<=0)throw Error('Maximum base retail must be a positive number.');}
 const effective=enabled&&!illegalExempt&&cmp(raw,cap)>0?cap:raw;
 return {raw,effective,cap,capApplied:cmp(effective,raw)!==0,illegalExempt};
}
// Effective legality is shared by the price basis, local-ban DM and sale UI.
export function tradeLegality(ctx,{illegalGood=false,banThreshold=null}={}){
 let locallyBanned=false;
 if(banThreshold!==null&&banThreshold!==undefined){
  if(ctx.uwp.law===null)throw Error('Law Level required');
  if(!Number.isFinite(banThreshold)||banThreshold<0)throw Error('Invalid ban threshold');
  locallyBanned=ctx.uwp.law>=banThreshold;
 }
 return {illegal:!!illegalGood||locallyBanned,locallyBanned};
}
export function quote(good,ctx,options,data,rng=die){if(good.refereeDefined)throw Error('Exotics require a referee price.');if(ctx.unknown.length)throw Error('Complete unknown world fields before automatic pricing.');const legality=tradeLegality(ctx,options),codes=[...ctx.codes,ctx.zone],purchase=chosen(good.purchaseDM,codes),sale=chosen(good.saleDM,codes);if(legality.locallyBanned){const local=ctx.uwp.law-options.banThreshold;sale.localIllegalDM=local;sale.selected=Math.max(sale.selected,local);}
const dice=options.rollTotal==null?roll(3,rng):{dice:null,total:options.rollTotal,manual:true};const skill=Number(options.skill),counterparty=Number(options.counterparty??2);if(![skill,counterparty,dice.total].every(Number.isInteger))throw Error('Invalid negotiation inputs');const modified=dice.total+skill+(options.local?2:0)+(options.side==='sell'?sale.selected-purchase.selected:purchase.selected-sale.selected)-counterparty;const bounded=Math.max(data.priceTable.minResult,Math.min(data.priceTable.maxResult,modified));const row=data.priceTable.rows.find(r=>r.result===bounded);const tablePercent=options.side==='sell'?row.salePercent:row.purchasePercent;const limits=priceLimits(options);const percent=limits.reducedProfitLimitsEnabled?(options.side==='sell'?Math.min(tablePercent,limits.maxSalePercent):Math.max(tablePercent,limits.minPurchasePercent)):tablePercent;const base=effectiveBasePrice(good,{...options,illegalGood:legality.illegal});const value=mul(base.effective,div(percent,100));return {unitPrice:String(up(value,options.creditStep||1)),audit:{rounding:{before:decimal(value),after:String(up(value,options.creditStep||1)),creditStep:options.creditStep||1},rulesVersion:VERSION,sourcePage:243,world:ctx,purchase,sale,dice,tradeComplication:{version:1,result:classifyTradeComplication(dice.dice)},skill,localDM:options.local?2:0,counterparty,modified,tableResult:bounded,tablePercent,percent,...limits,priceLimitApplied:percent!==tablePercent,basePrice:base.effective,rawBasePrice:base.raw,maxBaseRetail:base.cap,baseRetailCapApplied:base.capApplied,illegalRawPriceExempt:base.illegalExempt,effectiveIllegal:legality.illegal,locallyBanned:legality.locallyBanned,side:options.side}};}
// Reprice the same negotiation (for example, a local ban) without inventing a
// new roll or turning its natural dice into an entered-total override.
export function repriceQuote(good,ctx,options,data,original){
 const dice=original?.audit?.dice;
 if(!Number.isInteger(dice?.total))throw Error('Original price roll is unavailable; use a referee price.');
 const next=quote(good,ctx,{...options,rollTotal:dice.total},data);
 next.audit.dice=structuredClone(dice);
 if(original.audit.tradeComplication)next.audit.tradeComplication=structuredClone(original.audit.tradeComplication);
 else delete next.audit.tradeComplication; // Never flag historical quotes retroactively.
 return next;
}
export function market(ctx,options,data,rng=die){if(ctx.unknown.length||ctx.uwp.population===null)throw Error('Complete the UWP before generating a market.');let goods=data.commodities.filter(g=>!g.refereeDefined&&(g.common||((options.illegal?g.universallyIllegal:!g.universallyIllegal)&&g.availabilityAny.some(c=>ctx.codes.includes(c)))));const draws=[];for(let i=0;i<ctx.uwp.population;i++){let id;do{id=String(options.illegal?6:rng())+String(rng());}while(!options.illegal&&['61','62','63','64','65'].includes(id));draws.push(id);goods.push(data.commodities.find(g=>g.id===id));}const entries=new Map();for(const g of goods){if(g.refereeDefined){entries.set(g.id,{commodity:g.id,quantity:'0',unitPrice:'0',manualRequired:true,audit:{sourcePage:245,reason:'Referee-defined Exotics'}});continue;}const qroll=roll(g.quantity.dice,rng),popDM=ctx.uwp.population<=3?-3:ctx.uwp.population>=9?3:0;const tons=Math.max(0,qroll.total+popDM)*g.quantity.multiplier;let entry=entries.get(g.id);if(!entry){const price=quote(g,ctx,{...options,side:'buy',illegalGood:!!options.illegal&&!!g.universallyIllegal},data,rng);entry={commodity:g.id,quantity:'0',unitPrice:price.unitPrice,audit:{...price.audit,quantityRolls:[],randomDraws:draws}};entries.set(g.id,entry);}entry.quantity=decimal(add(entry.quantity,tons));entry.audit.quantityRolls.push({dice:qroll.dice,populationDM:popDM,multiplier:g.quantity.multiplier,tons});}return [...entries.values()];}
export function taxRate(taxable,gov,criminal,enabled,mp,rng=die,manual=null,roundStep=1){if(!enabled||criminal||cmp(taxable,0)<=0)return {rate:0,amount:0n,reason:!enabled?'Disabled':criminal?'INT-018 criminal-market exemption':'No positive taxable profit'};const lookup=floor(taxable)<1n?1n:floor(taxable);const idx=mp.tax.brackets.findIndex(b=>lookup>=BigInt(b.minCredits)&&(b.maxCredits===null||lookup<=BigInt(b.maxCredits)));const g=mp.tax.governmentRates.find(r=>r.uwpGovernmentCode===gov);let rate,dice=null;if(manual!==null){rate=Number(manual);if(!Number.isFinite(rate)||rate<0||rate>100)throw Error('Tax rate must be 0–100%.');}else{if(!g)throw Error('This government requires a referee tax rate.');const r=g.rates[idx];if(r.percent!==undefined)rate=r.percent;else{dice=roll(r.dice,rng);rate=dice.total;}}return {rate,amount:up(mul(taxable,div(rate,100)),roundStep),bracket:idx,lookup:String(lookup),dice,manual:manual!==null,sourcePage:86};}
export function salePreview(lots,lines,options,core,mp,rng=die){if(!lines.length)throw Error('Select cargo to sell.');if(new Set(lines.map(x=>x.lotId)).size!==lines.length)throw Error('Combine lines from the same lot.');const percent=Number(options.percent);if(!Number.isFinite(percent)||percent<0||percent>100)throw Error('Profit percentage must be 0–100.');const feePercent=Number(options.feePercent||0);if(!Number.isFinite(feePercent)||feePercent<0||feePercent>100)throw Error('Invalid fee percentage');const out=lines.map(line=>{const lot=lots.find(l=>l.id===line.lotId);if(!lot)throw Error('Cargo lot no longer exists.');if(cmp(line.quantity,0)<=0||cmp(line.quantity,lot.quantity)>0||cmp(line.unitPrice,0)<0)throw Error('Invalid sale quantity or price.');const good=core.commodities.find(g=>g.id===lot.commodity);const benchmark=line.benchmarkPrice??good?.baseCreditsPerTon;if(benchmark===null||benchmark===undefined)throw Error('Exotics need a referee market-value benchmark.');if(cmp(benchmark,0)<0)throw Error('Invalid benchmark');const gross=up(mul(line.quantity,line.unitPrice),options.creditStep||1);const basis=cmp(line.quantity,lot.quantity)===0?credit(lot.basis):floor(mul(lot.basis,div(line.quantity,lot.quantity)));const benchmarkValue=mul(benchmark,line.quantity);return {...line,quantity:decimal(line.quantity),unitPrice:decimal(line.unitPrice),gross,basis,benchmark:benchmarkValue,taxable:sub(gross,benchmarkValue),description:lot.description};});const gross=out.reduce((t,l)=>t+l.gross,0n);const fee=up(mul(gross,div(feePercent,100)),options.creditStep||1);const feeShares=allocate(fee,out.map(l=>({id:l.lotId,weight:gross?l.gross:l.quantity})));const taxable=sum(out.map(l=>l.taxable));const tax=taxRate(taxable,options.government,options.criminal,options.taxEnabled,mp,rng,options.manualTaxRate??null,options.creditStep||1);const taxShares=allocate(tax.amount,out.map(l=>({id:l.lotId,weight:cmp(l.taxable,0)>0?l.taxable:0})));let bank=0n;out.forEach((l,i)=>{const raw=l.gross-feeShares[i]-l.basis,after=raw-taxShares[i],adjusted=after>0n?up(mul(after,div(percent,100)),options.creditStep||1):after,adjustment=adjusted-after;const delta=l.gross-feeShares[i]-taxShares[i]+adjustment;Object.assign(l,{gross:String(l.gross),basis:String(l.basis),benchmark:auditNumber(l.benchmark),taxable:auditNumber(l.taxable),fee:String(feeShares[i]),tax:String(taxShares[i]),raw:String(raw),afterTax:String(after),adjusted:String(adjusted),adjustment:String(adjustment),bankDelta:String(delta)});bank+=delta;});return {lines:out,bankDelta:String(bank),gross:String(gross),fee:String(fee),tax:{...tax,amount:String(tax.amount),taxable:auditNumber(taxable)},options:structuredClone(options),rulesVersion:VERSION};}
export function insuranceQuote(value,coverage,distance,zones,mp,manualPremium=null,roundStep=1){if(!mp.insurance.coveragePercent.includes(Number(coverage)))throw Error('Choose a listed coverage.');if(cmp(value,0)<0||!Number.isFinite(distance)||distance<0)throw Error('Invalid insured value or distance');const key=distance<1?'less-than-1':String(distance);const row=mp.insurance.premiumRows.find(r=>r.distance===key);const surcharge=[...new Set(zones)].reduce((a,z)=>a+(mp.insurance.surchargePercentagePoints[z]||0),0);if(!row&&manualPremium===null)throw Error('This distance requires a referee quote.');const rate=row?row.premiumPercent[mp.insurance.coveragePercent.indexOf(Number(coverage))]+surcharge:null;const premium=manualPremium===null?up(mul(value,div(rate,100)),roundStep):up(manualPremium,roundStep);if(premium<0n)throw Error('Premium cannot be negative');return {insuredValue:decimal(value),coverage:Number(coverage),distance,zones:[...new Set(zones)],rate,premium:String(premium),roundingStep:roundStep,potentialPayout:String(up(mul(value,div(coverage,100)),roundStep)),manual:manualPremium!==null,sourcePage:83,rulesVersion:VERSION};}
export function freightDM(origin,destination,distance,effect,data){
 const endpoint=ctx=>{
  const u=ctx.uwp;if([u.population,u.techLevel,u.starport].some(x=>x===null))throw Error('Freight needs known port, population and TL.');
  const d=data.freight.endpointDM;
  return {population:d.population.filter(r=>matches(u.population,r)).reduce((a,r)=>a+r.dm,0),starport:d.starport[u.starport]||0,techLevel:d.techLevel.filter(r=>matches(u.techLevel,r)).reduce((a,r)=>a+r.dm,0),zone:d.zone[ctx.zone]||0};
 };
 const components={origin:endpoint(origin),destination:endpoint(destination)},total=values=>Object.values(values).reduce((a,b)=>a+b,0);
 const from=total(components.origin),to=total(components.destination),distanceDM=-Math.max(0,distance-1);
 return {origin:from,destination:to,distance:distanceDM,effect,total:from+to+distanceDM+effect,components};
}
export function freightOffers(origin,dest,distance,effect,data,rng=die){const dm=freightDM(origin,dest,distance,effect,data),rate=data.freight.paymentCreditsPerTonByParsecs[distance];if(!rate)throw Error('Freight over the table range requires a manual contract.');const offers=[];for(const[type,t]of Object.entries(data.freight.lotTypes)){const r=roll(2,rng),result=Math.max(1,Math.min(20,r.total+dm.total+t.trafficDM)),countDice=data.freight.trafficTable[result-1].numberOfLotDice,count=countDice?roll(countDice,rng):{dice:[],total:0};for(let i=0;i<count.total;i++){const size=roll(1,rng);offers.push({kind:'freight',type,quantity:String(size.total*t.multiplier),payment:String(size.total*t.multiplier*rate),audit:{dm,traffic:r,typeDM:t.trafficDM,result,count,size,distance,sourcePages:[239,240,241]}});}}return offers;}
export function mailModifiers(origin,dest,distance,effect,ship,crew,data){
 const dm=freightDM(origin,dest,distance,effect,data),band=data.mail.freightDMBands.find(r=>matches(dm.total,r));
 if(!band)throw Error('Mail needs a valid freight traffic DM.');
 const modifiers={freight:band.dm,armed:ship.armed?2:0,lowTech:origin.uwp.techLevel<=5?-4:0,rank:Number(crew.rank||0),soc:Number(crew.soc||0)};
 if(!Object.values(modifiers).every(Number.isInteger))throw Error('Mail DMs must be whole numbers.');
 const inputs=ctx=>({name:ctx.world?.name??null,population:ctx.uwp.population,starport:ctx.uwp.starport,techLevel:ctx.uwp.techLevel,zone:ctx.zone});
 return {dm,modifiers,modifierTotal:Object.values(modifiers).reduce((a,b)=>a+b,0),worldInputs:{origin:inputs(origin),destination:inputs(dest)},distance,sourcePage:241};
}
function optionalMailRoll(value,min,max,label){
 if(value==null||value==='')return null;
 if(!['number','string'].includes(typeof value)||typeof value==='string'&&!value.trim()||!Number.isInteger(Number(value))||Number(value)<min||Number(value)>max)throw Error(label+' must be a whole number from '+min+' to '+max+'.');
 return {dice:null,total:Number(value),manual:true};
}
export function mailOffer(origin,dest,distance,effect,ship,crew,data,rng=die,options={}){
 const audit=mailModifiers(origin,dest,distance,effect,ship,crew,data);
 const availability=optionalMailRoll(options.availabilityTotal,2,12,'Mail availability total'),containers=optionalMailRoll(options.containerRoll,1,6,'Mail container roll');
 const dice=availability||roll(2,rng),total=dice.total+audit.modifierTotal;
 Object.assign(audit,{dice,total});
 if(total<12)return {available:false,audit};
 const count=containers||roll(1,rng);
 return {available:true,kind:'mail',quantity:String(count.total*5),payment:String(count.total*25000),audit:{...audit,count}};
}
