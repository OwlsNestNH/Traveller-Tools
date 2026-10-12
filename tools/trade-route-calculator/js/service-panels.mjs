import {replaceReferenceContent} from './rule-popover.mjs?v=route-editor-current-world-20261012-67';
import {ruleInfo} from './rule-references.mjs?v=route-editor-current-world-20261012-67';
import {escapeHtml,formatDecimalCreditsText} from './display.mjs?v=route-editor-current-world-20261012-67';
import {passengerShip} from './passengers.mjs?v=route-editor-current-world-20261012-67';
import * as A from './amounts.mjs';
import {bladderSpace,fuelCapacities,fuelPurchase} from './fuel.mjs?v=route-editor-current-world-20261012-67';
import {expenseQuote,fuelAvailability,fuelAvailabilityAdvice,fuelPricing,starport} from './expenses.mjs?v=route-editor-current-world-20261012-67';
import {refillQuote,supportStock,supportCargo,supportAmount,supportDisplay,anchorSupport} from './life-support.mjs?v=route-editor-current-world-20261012-67';
import {used,validate,shipExpense,refillLifeSupport,uid} from './state.mjs?v=route-editor-current-world-20261012-67';
import {creditStep,up} from './rounding.mjs?v=route-editor-current-world-20261012-67';
import {SaveCommittedPublicationError} from './persistence.mjs?v=route-editor-current-world-20261012-67';
const esc=escapeHtml;
const money=formatDecimalCreditsText,num=x=>x==null?'Unknown':String(Number(Number(x).toFixed(3)));
const field=(name,label,value,type='number',extra='')=>`<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const facts=rows=>'<dl class="service-facts">'+rows.map(([l,v])=>'<dt>'+esc(l)+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl>';
const progress=(value,max,label)=>`<progress max="${Math.max(1,Number(max))}" value="${Math.max(0,Number(value))}" aria-label="${esc(label)}"></progress>`;
export function maxFuelAddition(s){s=structuredClone(s);anchorSupport(s.ship);const f=s.ship.fuel;if(!f)return 0;const free=Math.max(0,Number(A.floor(A.sub(s.ship.capacity,used(s))))),base=f.baseCapacityTons??f.capacityTons,freeBase=Math.max(0,base-f.aboardTons);return Math.max(0,Math.min(f.capacityTons-f.aboardTons,freeBase+Math.floor(free)));}
export function fuelCorrection(s,value,reason=''){
 const before=s.ship.fuel?.aboardTons,after=Number(value);
 if(String(value).trim()===''||!Number.isSafeInteger(after)||after<0||after>before)throw Error('Enter actual fuel remaining from zero to the current amount aboard.');
 if(after===before)throw Error('Enter a lower actual fuel level to record a correction.');
 const detail={before,after,removed:before-after,reason:String(reason).trim(),bankChange:'0',world:s.actual};
 s.ship.fuel.aboardTons=after;s.events.push({id:uid(),label:'Fuel aboard correction audit',hours:s.hours,world:s.actual,fuelCorrection:detail});return detail;
}
export function createServicePanels({document,getState,isEditable,commit,render,showOverview,message,nextJumpFuel,onTerminalFailure=()=>{}}){
 let session=null,receipt=null,generation=0,reloadMessage='';
 const quoteContent=new WeakMap();
 const active=()=>!!session,visible=()=>!!session||!!receipt,token=()=>session?.token??receipt?.token??'';
 const button=(text,action,arg='',primary=false)=>`<button type="button" data-action="${action}" data-arg="${esc(arg)}" data-service-token="${token()}" class="${primary?'primary':''}">${esc(text)}</button>`;
 function clearServiceSuccess(){const notice=document.getElementById('message');if(notice&&!/\berror\b/.test(notice.className||'')&&/^(Refuelled|Adjusted fuel aboard|Refilled life support) saved\.$/.test(notice.textContent)){notice.textContent='';notice.className='';}}
 function open(kind){
  if(session?.busy)throw Error('Wait for the current service to finish saving.');
  if(reloadMessage)throw Error(reloadMessage);
  if(!['fuel','support'].includes(kind))throw Error('Unknown ship service.');
  const base=structuredClone(getState()),w=base.worlds[base.actual];
  if(!isEditable())throw Error('This tab is read-only. Take over editing first.');
  if(!base.initialized||!w)throw Error('Set up a campaign first.');
  if(w.emptySpace&&kind==='support')throw Error('No local supplies in empty space. Continue to a world first.');
  let mode=kind==='fuel'?'inline':'summary';
  if(kind==='support'){try{const q=refillQuote(base,{addDays:'0'});if(A.cmp(supportAmount(q.purchasedStockUnits),0)===0)mode='adjust';}catch{/* Existing setup or pricing errors remain visible and editable. */}}
  clearServiceSuccess();receipt=null;session={token:'stock-'+(++generation),kind,mode,revision:base.revision,base,world:w,draft:kind==='fuel'?{fuelType:['A','B'].includes(starport(w))?'refined':'unrefined',fuelTons:String(maxFuelAddition(base)),customFuelType:['A','B'].includes(starport(w))?'refined':'unrefined',customFuelRate:'',otherSupplier:false,expenseNotes:'',fuelRemaining:String(base.ship.fuel.aboardTons),fuelReason:''}:{topOff28:false,extraDays:'0',comfortCredits:'0',comfortNote:''},correction:false,busy:false};
  showOverview();render();if(document.defaultView?.matchMedia('(max-width:1099px)').matches)document.getElementById('service-panel')?.scrollIntoView({block:'start',behavior:'instant'});
 }
 function stale(){return !session||session.invalidated||!isEditable()||session.revision!==getState().revision||session.base.actual!==getState().actual;}
 function status(){if(!session)return '';if(session.terminal)return reloadMessage;if(session.busy)return 'Saving this service. Wait for confirmation before continuing.';return stale()?'Campaign or editing ownership changed. Cancel this draft and reopen the service to use current values.':session.error||'';}
 function invalidate(){if(session)session.invalidated=true;}
 function supportOptions(d){return {addDays:d.extraDays,topOffDays:d.topOff28?'28':null,comfortCost:d.comfortCredits,comfortNote:d.comfortNote};}
 function quote(preview=false){
  const {base,draft:d,world:w,kind,correction}=session;
  if(kind==='support'){const q=refillQuote(base,supportOptions(d));if(A.credit(q.amount)>A.credit(base.bank))throw Error('Insufficient funds for this refill.');if(A.cmp(A.add(A.sub(used(base),supportCargo(base.ship)),supportAmount(q.afterCargoExact)),base.ship.capacity)>0)throw Error('Life support overflow would exceed available cargo space.');if(!preview&&A.cmp(supportAmount(q.purchasedStockUnits),0)===0&&A.credit(q.comfortAmount)===0n)throw Error('Stock already covers this target. Adjust extra days or comfort provisions if needed.');return q;}
  const f=base.ship.fuel;
  if(correction){const copy=structuredClone(base);anchorSupport(copy.ship);const q=fuelCorrection(copy,d.fuelRemaining,d.fuelReason);validate(copy);return {...q,amount:'0',tons:0,correcting:true};}
  const requested=A.dec(d.fuelTons),tons=Number(up(requested));
  if(A.cmp(requested,0)<0)throw Error('Fuel quantity cannot be negative.');
  if(tons===0)throw Error('No fuel to acquire. Adjust the quantity before confirming.');
  if(!Number.isSafeInteger(tons)||tons>maxFuelAddition(base))throw Error('This fuel would exceed available tank or cargo space.');
  const custom=d.fuelType==='custom',type=custom?d.customFuelType:d.fuelType;
  if(custom&&!['refined','unrefined'].includes(type))throw Error('Choose the actual purchased fuel grade.');
  const input={kind:'fuel',fuelType:type,tons:A.decimal(requested),...(custom?{customFuelRate:d.customFuelRate}:{}),otherSupplier:d.otherSupplier,notes:d.expenseNotes,creditStep:creditStep(base),fuelShip:base.ship};
  const q=expenseQuote(w,input),tank=fuelPurchase(base.ship,tons);
  if(A.credit(q.amount)>A.credit(base.bank))throw Error('Insufficient funds for this refuel.');
  return {...q,...tank,input};
 }
 function waterWarning(){const {world:w,draft:d}=session;if(d.fuelType!=='water')return '';return fuelAvailability(w,'water').standard?'Water collection is always selectable. Access, equipment, time and fuel quality are resolved in play.':'Water availability is not established by the hydrographics or planet information at '+w.name+'. This is an advisory only: collection remains available. Access, equipment, time and fuel quality are resolved in play.';}
 function total(q,formula=''){return `<div class="service-total"><span>Total cost</span><strong>${money(q.amount)}</strong>${formula?'<small>'+esc(formula)+'</small>':''}</div>`+facts([['Credits before',money(session.base.bank)],['Credits after',money(String(A.credit(session.base.bank)-A.credit(q.amount)))]]);}
 function fuelForecast(q){
  const f=session.base.ship.fuel,d=session.draft;
  if(q.correcting)return `<div class="service-comparison"><div><span>Current</span><strong>${q.before} t</strong>${progress(q.before,f.capacityTons,'Current fuel aboard')}</div><span aria-hidden="true">→</span><div><span>Actual remaining</span><strong>${q.after} t</strong>${progress(q.after,f.capacityTons,'Fuel after confirmation')}</div></div>`+facts([['Fuel removed',q.removed+' t'],['Reason',q.reason||'Not entered'],['Bank change','Cr 0 · no refund']])+'<p class="help">This records actual fuel remaining, with Audit and Undo. No payment or refund is made.</p>';
  const type=q.input.fuelType,rate=q.input.customFuelRate??(type==='water'?'0':type==='refined'?'500':'100'),source=type==='water'?'Water collection · unrefined':(d.fuelType==='custom'?'Custom price · ':'Purchased · ')+(type==='refined'?'refined':'unrefined');
  return `<div class="fuel-after"><span>After refuelling</span><strong>${q.after} / ${f.capacityTons} t</strong>${progress(q.after,f.capacityTons,'Fuel after confirmation')}</div>`+facts([['Source / grade',source],['Fuel to add',q.tons+' t'],['Unit price',money(rate)+' / t']])+(A.cmp(q.input.tons,q.tons)?'<p class="notice">Entered '+esc(q.input.tons)+' t → '+q.tons+' t added and charged (existing whole-ton rounding).</p>':'')+total(q,q.tons+' t × '+money(rate)+' / t'+(A.cmp(A.mul(q.tons,rate),q.amount)?' · rounded up to Cr'+q.roundingStep:''))+'<details class="service-audit"><summary>Fuel price and capacity audit '+ruleInfo('refuel')+'</summary>'+facts([...q.details,['Cargo occupied by fuel after',bladderSpace({...session.base.ship,fuel:{...f,aboardTons:q.after}})+' t'],['Notes / fuel source',d.expenseNotes||'Not entered']])+'</details>';
 }
 function supportForecast(q){return `<div class="service-comparison"><div><span>Current</span><strong>${num(q.beforeDays)} days</strong><small>${num(q.beforeUnits)} LSS aboard</small></div><span aria-hidden="true">→</span><div><span>After refill</span><strong>${num(q.afterDays)} days</strong><small>${num(q.afterUnits)} LSS aboard</small></div></div>`+facts([['LSS added',num(q.purchasedUnits)+' LSS'],['LSS after',num(q.afterUnits)+' LSS'],['Internal free after',num(A.decimal(A.sub(q.internalCapacityUnits,q.afterInternalUnits)))+' LSS'],['Standard top-up','+'+num(q.standardDays)+' days · '+money(q.standardAmount)],['Extra reserve',num(q.extraUnits)+' LSS · '+money(q.extraAmount)],['Comfort provisions',money(q.comfortAmount)],['Internal LSS after',num(q.afterInternalUnits)+' / '+num(q.internalCapacityUnits)+' LSS'],['Cargo LSS after',num(A.decimal(A.sub(q.afterUnits,q.afterInternalUnits)))+' LSS'],['Cargo overflow',num(q.afterCargoTons)+' t'],['Cargo free after',num(A.decimal(A.sub(session.base.ship.capacity,A.add(A.sub(used(session.base),supportCargo(session.base.ship)),supportAmount(q.afterCargoExact)))))+' t']])+total(q,[q.standardAmount,q.extraAmount,q.comfortAmount].map(money).join(' + '))+'<p class="help">Only supplies beyond internal capacity use cargo space. Comfort provisions add no days or LSS.</p><details class="service-audit"><summary>Audit · Home rule '+ruleInfo('support-pricing')+'</summary>'+facts([['Awake crew',String(q.awakeCrew)],['Awake passengers',String(q.awakePassengers)],['Occupied frozen Low berths',String(q.occupiedLowBerths)],['Daily consumption',num(q.dailyUnits)+' LSS/day'],['Top-off preview',q.topOffDays===null?'Not selected':q.topOffDays+' days'],['Days selected to add',q.addedDays??'Legacy reserve plan'],['Nominal days purchased',num(q.nominalDaysPurchased)+' days'],['Actual days added',num(q.actualDaysAdded)+' days'],['LSS before',num(q.beforeUnits)+' LSS'],['Nominal supply requirement',num(q.nominalPurchasedUnits??q.purchasedUnits)+' LSS'],['Purchased supplies',num(q.purchasedUnits)+' LSS'],['Post-purchase stock rounding',q.roundPostPurchaseTotal?'Resulting LSS aboard rounded up once to a whole number':'Not applied: no supply purchase'],['Rounding surplus aboard',num(q.purchaseSurplusUnits??0)+' LSS'],['Actual days after',num(q.afterDays)+' days'],['Basic supply charge · before rounding',money(q.basicSupplyCharge)],['Cabin charge · before rounding',money(q.cabinCharge)],['High-service quality · before rounding',money(q.highServiceCharge)],['Comfort charge',money(q.comfortAmount)],['Monetary rounding',money(q.priceRounding)],['Total charged',money(q.amount)],['Pricing basis','Existing period-based charges; comfort adds no supply'],['Extra supply rate','Cr 1,000 / person-equivalent / 28 days'],['Pricing headcount',num(q.dailyUnits)+' (awake + 0.1 × occupied low berths)'],['Extra duration purchased',num(q.extraPurchasedDays??q.extraDays)+' days'],['Rounding','Combined extra charge rounded up once to Cr100'],['Comfort note',session.draft.comfortNote||'Not entered']])+'</details><p class="help rule-footnote">Physical LSS consumption and storage '+ruleInfo('lss')+'</p>';}
 function forecast(){
  try{const q=quote(true),noop=session.kind==='support'&&A.cmp(supportAmount(q.purchasedStockUnits),0)===0&&A.credit(q.comfortAmount)===0n;return {html:(session.kind==='fuel'?fuelForecast(q):supportForecast(q))+(noop?'<p class="help">No normal top-up is needed. Add extra days or comfort provisions above to make an additional purchase.</p>':''),valid:!noop};}
  catch(error){
   const stock=session.kind==='support'?supportStock(passengerShip(session.base)):null,current=session.kind==='fuel'?session.base.ship.fuel.aboardTons+' / '+session.base.ship.fuel.capacityTons+' t':num(stock.remainingDays)+' days · '+num(stock.remainingUnits)+' LSS';
   let html='<p class="help">Current stock: '+esc(current)+'</p>';
   if(session.kind==='fuel'&&!session.correction){
    try{
     const d=session.draft,f=session.base.ship.fuel;
     if(A.cmp(d.fuelTons,0)===0){
      const input={fuelType:d.fuelType==='custom'?d.customFuelType:d.fuelType,...(d.fuelType==='custom'?{customFuelRate:d.customFuelRate}:{}),tons:'0',otherSupplier:d.otherSupplier,notes:d.expenseNotes},price=fuelPricing(session.world,input);
      html=fuelForecast({input,tons:0,before:f.aboardTons,after:f.aboardTons,amount:'0',roundingStep:creditStep(session.base),details:[['Fuel type',price.type==='refined'?'Refined':'Unrefined'],['Fuel tons','0'],['Rate · Cr/ton',price.rate],['Price basis',price.custom?'Custom local price':'Standard price']]});
      if(!price.collecting&&!price.standard)html+='<p class="help">No standard starport supply for this grade here. A purchase requires another supplier and a source note.</p>';
     }
    }catch{/* Invalid source or price retains the original validation notice. */}
   }
   return {html:html+'<p class="notice" role="alert">'+esc(error.message)+'</p>',valid:false};
  }
 }
 function fuelEditor(){const {draft:d,base,correction}=session,f=base.ship.fuel,max=maxFuelAddition(base);if(correction)return '<p class="help">Record a lower actual fuel level. This is an inventory correction with no bank change.</p>'+field('fuelRemaining','Actual fuel remaining · tons',d.fuelRemaining,'number',`min="0" max="${f.aboardTons}" step="1" required`)+field('fuelReason','Reason (optional)',d.fuelReason,'text');
  const custom=d.fuelType==='custom';
  return `<div class="service-current"><span>Current fuel / total capacity</span><strong>${f.aboardTons} / ${f.capacityTons} t</strong>${button('Reduce fuel aboard…','service-fuel-correct')}${progress(f.aboardTons,f.capacityTons,'Current fuel aboard')}</div><div class="service-quantity">${button('−1 t','service-fuel-step','-1')}${field('fuelTons','Fuel to add · tons',d.fuelTons,'number',`min="0" max="${max}" step="any" required`)}${button('+1 t','service-fuel-step','1')}</div><div class="service-shortcuts">${button('Top off · '+max+' t','service-fuel-topoff')}${button('Fuel for next jump','service-fuel-next')}</div>${max<f.capacityTons-f.aboardTons?'<p class="notice">Cargo space limits this refill to '+max+' t. Top off uses all currently available tank and cargo space.</p>':''}<label class="field">Fuel source<select name="fuelType">${[['refined','Refined · Cr 500 / t'],['unrefined','Unrefined · Cr 100 / t'],['water','Water · free collection'],['custom','Custom · local price']].map(([v,l])=>`<option value="${v}" ${d.fuelType===v?'selected':''}>${l}</option>`).join('')}</select></label><div id="fuel-custom-fields" ${custom?'':'hidden'}><label class="field">Actual purchased fuel grade<select name="customFuelType">${[['refined','Refined'],['unrefined','Unrefined']].map(([v,l])=>`<option value="${v}" ${d.customFuelType===v?'selected':''}>${l}</option>`).join('')}</select></label>${field('customFuelRate','Custom price · Cr / ton',d.customFuelRate,'number','min="0" step="any"')}<p class="help">Local price only. Fuel grade and purchase availability remain as selected.</p></div><p id="fuel-availability" class="help" ${d.fuelType==='water'?'':'hidden'}>${esc(waterWarning())}</p><div id="fuel-purchase-fields" ${d.fuelType==='water'?'hidden':''}><label class="check"><input type="checkbox" name="otherSupplier" ${d.otherSupplier?'checked':''}>Other supplier / referee confirms purchase availability</label><p class="help">Purchased fuel only. Outside standard starport availability, confirm the supplier and record a source note.</p></div>${field('expenseNotes','Notes / fuel source (optional)',d.expenseNotes,'text')}<p class="help">Decimal entries use the existing whole-ton rounding shown below. Total capacity includes any power-plant or small-craft allowance already entered in your tank setting.</p>`;
 }
 function supportEditor(){const {draft:d,base}=session,s=supportStock(passengerShip(base));return `<div class="service-current"><span>Current supplies</span><strong>${num(s.remainingDays)} days</strong><small>${num(s.remainingUnits)} LSS aboard</small></div><div class="service-shortcuts">${button('Top off to 28 days','service-support-topoff')}${button('Add days only','service-support-current')}</div><p class="help">${d.topOff28?'Preview starts at at least 28 days; supplies already above 28 are retained.':'Preview starts with supplies already aboard.'} Then add the selected days. Configured pricing target: ${num(s.targetDays)} days.</p><div class="service-quantity">${button('−1 day','service-reserve-step','-1')}${field('extraDays','Days to add',d.extraDays,'number','min="0" step="any" required')}${button('+1 day','service-reserve-step','1')}</div><p class="help">1-day steps, or type the days to add.</p><details class="service-comfort" ${Number(d.comfortCredits)?'open':''}><summary>Extra provisions · comfort spending</summary><div class="service-quantity">${button('−Cr 1,000','service-comfort-step','-1000')}${field('comfortCredits','Comfort provisions · Cr',d.comfortCredits,'number','min="0" step="1000" required')}${button('+Cr 1,000','service-comfort-step','1000')}</div>${field('comfortNote','Comfort provisions note (required when spending)',d.comfortNote,'text')}<p class="help">Cost only. No additional days, LSS or capacity.</p></details><p class="help">Confirm supplies are available at ${esc(session.world.name)}.</p>`;}
 function inventory(kind,base){
  if(kind==='fuel'){if(!base.ship.fuel)return '<p class="notice">Fuel quantities are not configured. Review Settings before preparing another purchase.</p>';const f=base.ship.fuel,c=fuelCapacities(base.ship);return '<div class="mfd-metrics">'+[['Fuel aboard',f.aboardTons+' t'],['Tank capacity',c.baseCapacityTons+' t'],['Bladder capacity',c.bladderTons+' t']].map(([label,value])=>'<div><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('')+'</div>';}
  const effective=passengerShip(base),q=supportStock(effective),crew=['low','middle','high'].reduce((n,t)=>n+(effective.accommodation?.crew?.[t]??0),0),passengers=['low','middle','high'].reduce((n,t)=>n+(effective.accommodation?.passengers?.[t]??0),0),free=q.internalCapacityUnits===null||q.internalUnits===null?'Unknown':supportDisplay(A.sub(q.internalCapacityUnits,q.internalUnits));
  return '<p class="mfd-complement">Actually aboard: '+crew+' awake crew + '+passengers+' awake passengers · '+q.occupiedLowBerths+' occupied frozen Low berths</p><div class="mfd-metrics">'+[['LSS aboard',q.remainingUnits??'Unknown'],['Internal LSS',q.internalUnits===null||q.internalCapacityUnits===null?'Unknown':q.internalUnits+' / '+q.internalCapacityUnits],['Days supported',q.remainingDays??'Unknown']].map(([label,value])=>'<div><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('')+'</div><p class="help">Internal free: '+esc(free)+' LSS · Cargo LSS: '+esc(q.stockUnits===null||q.internalUnits===null?'Unknown':supportDisplay(A.mul(supportAmount(q.cargoExact),100)))+' LSS · '+esc(q.cargoTons??'Unknown')+' cargo t.</p><p class="help">Consumption: 1 LSS per awake person/day + 0.1 LSS per occupied frozen Low berth/day. Internal storage: '+esc(q.internalCapacityUnits??'Unknown')+' LSS; overflow: '+esc(q.cargoTons??'Unknown')+' t at 100 LSS/t.</p>';
 }
 function showAudit(){const detail=document.querySelector('#service-panel .service-audit');if(detail){detail.open=true;detail.scrollIntoView?.({block:'nearest'});}return true;}
 function receiptPanel(){
  if(!receipt)return '';const base=getState(),title=receipt.kind==='fuel'?'Refuel':'Life support';
  return '<aside id="service-panel" class="panel world-screen service-panel service-mfd service-saved" aria-label="Ship service" aria-busy="false"><div class="screen-topline"><span>● Ship service</span><span>Saved</span></div>'+button('← Back to world data','service-back')+'<div class="mfd-title"><h2>'+title+(receipt.kind==='support'?' '+ruleInfo('support-cost'):'')+'</h2>'+button('Audit','service-audit')+'</div><h3>'+esc(base.ship.name)+' · at '+esc(base.worlds[base.actual]?.name??base.actual)+'</h3><p id="service-status" class="notice" role="status">'+esc(receipt.savedLabel)+'</p>'+(receipt.kind==='fuel'&&base.settings.fuelAvailabilityAlert?'<p class="notice fuel-availability-advice" role="status">'+esc(fuelAvailabilityAdvice(base.worlds[base.actual]))+' '+ruleInfo('fuel-availability')+'</p>':'')+inventory(receipt.kind,base)+'<details class="service-audit"><summary>Audit · saved service</summary>'+receipt.audit+'</details><div class="service-actions">'+(isEditable()?button('Prepare another '+(receipt.kind==='fuel'?'refuel':'refill'),'service-new','',true):'<p class="help">Read-only: saved totals and audit remain available.</p>')+'</div><p class="help">This service is saved. Prepare another purchase to change supplies; viewing this screen never charges again.</p></aside>';
 }
 function panel(){
  if(!session)return receiptPanel();const f=forecast(),s=session.kind==='support'?supportStock(passengerShip(session.base)):null,inline=session.kind==='fuel'&&!session.correction,title=session.kind==='fuel'?(session.correction?'Adjust fuel aboard':'Refuel'):'Life support',editing=inline||session.mode==='adjust';
  return `<aside id="service-panel" class="panel world-screen service-panel service-mfd ${inline?'fuel-inline':''}" aria-label="Ship service" aria-busy="${session.busy}"><div class="screen-topline"><span>● Ship service</span><span>${inline?'Refuelling':editing?'Edit details':'Summary'}</span></div>${button('← Back to world data','service-back')}<div class="mfd-title"><h2 aria-label="${title}${editing?'':' · Summary'}">${title}${editing?'':' · Summary'}${session.kind==='support'?' '+ruleInfo('support-cost'):''}</h2>${button('Audit','service-audit')}</div><h3>${esc(session.base.ship.name)} · at ${esc(session.world.name)}</h3><p class="help">Actual ship location · ${session.kind==='fuel'?'Starport '+esc(starport(session.world)):num(session.base.ship.fuel?.displacementTons)+' t ship · '+s.awakePeople+' awake people · '+s.occupiedLowBerths+' occupied low berths'}</p><p class="help service-session-note">Jump and campaign changes are paused while this draft is open. The map remains available.</p><p id="service-status" class="notice" role="alert" ${status()?'':'hidden'}>${esc(status())}</p>${session.kind==='fuel'&&session.base.settings.fuelAvailabilityAlert?'<p class="notice fuel-availability-advice" role="status">'+esc(fuelAvailabilityAdvice(session.world))+' '+ruleInfo('fuel-availability')+'</p>':''}${inventory(session.kind,session.base)}${editing||session.kind==='support'?'<form id="service-form" data-service-token="'+session.token+'">'+(session.kind==='fuel'?fuelEditor():supportEditor())+'</form>':''}<div id="service-quote" aria-live="polite">${f.html}</div><div class="service-actions">${session.kind==='support'?button('Adjust','service-adjust')+(session.mode==='adjust'?button('Review changes','service-review'):'')+button('Cancel','service-cancel')+button('Confirm refill','service-confirm','',true):inline?button('Cancel','service-cancel')+button('Confirm refuel','service-confirm','',true):editing?button('Cancel','service-cancel')+button('Review changes','service-review','',true):button('Adjust','service-adjust')+button(session.correction?'Confirm fuel correction':'Confirm refill','service-confirm','',true)}</div><p class="help">${editing&&!inline?'Review and confirm before supplies or Credits change.':'Only final confirmation changes supplies or Credits. Cancel discards this draft.'}</p></aside>`;
 }
 function sync(){
  if(!session)return;const form=document.getElementById('service-form');
  // Disabled controls can still receive synthetic input/change events. Restore
  // their displayed values without changing the frozen pending or stale draft.
  if(session.busy||session.terminal||stale()){
   if(form?.dataset?.serviceToken===session.token)for(const el of form.elements){if(!(el.name in session.draft))continue;if(el.type==='checkbox')el.checked=session.draft[el.name];else el.value=session.draft[el.name];}
   syncControls();return;
  }
  if(form?.dataset?.serviceToken===session.token){
   const previousType=session.draft.fuelType;
   for(const el of form.elements){if(!el.name)continue;session.draft[el.name]=el.type==='checkbox'?el.checked:el.value;}
   const d=session.draft;
   if(session.kind==='fuel'&&!session.correction){
    if(d.fuelType==='custom'&&previousType!=='custom'&&['refined','unrefined'].includes(previousType)){
     d.customFuelType=previousType;const grade=document.querySelector('#service-form [name="customFuelType"]');if(grade)grade.value=previousType;
    }
    if(d.fuelType==='custom'&&previousType!=='custom'&&d.customFuelRate===''){
     d.customFuelRate=d.customFuelType==='refined'?'500':'100';const price=document.querySelector('#service-form [name="customFuelRate"]');if(price)price.value=d.customFuelRate;
    }
    const custom=document.getElementById('fuel-custom-fields');if(custom)custom.hidden=d.fuelType!=='custom';
    const purchased=document.getElementById('fuel-purchase-fields');if(purchased)purchased.hidden=d.fuelType==='water';
   }
   const box=document.getElementById('service-quote'),f=forecast();
   // Input has already refreshed this quote. Its following blur/change must
   // not replace the summary receiving the user's click or keyboard focus.
   if(box&&quoteContent.get(box)!==f.html){replaceReferenceContent(box,f.html);quoteContent.set(box,f.html);}
   const warning=document.getElementById('fuel-availability');if(warning&&session.kind==='fuel'){warning.textContent=waterWarning();warning.hidden=d.fuelType!=='water';}
  }syncControls();
 }
 function syncControls(){
  if(!session)return;if(!isEditable()||session.revision!==getState().revision||session.base.actual!==getState().actual)session.invalidated=true;
  const outdated=stale(),invalid=outdated||session.terminal||!forecast().valid;
  document.querySelectorAll('#service-panel [data-action]').forEach(b=>b.disabled=session.busy||((outdated||session.terminal)&&!['service-back','service-cancel','service-audit'].includes(b.dataset.action)));
  document.querySelectorAll('#service-panel [data-action="service-confirm"],#service-panel [data-action="service-review"]').forEach(b=>b.disabled=invalid||session.busy);
  document.querySelectorAll('#service-panel input,#service-panel select').forEach(el=>el.disabled=outdated||session.busy||!!session.terminal);
  const notice=document.getElementById('service-status'),text=status();if(notice){notice.textContent=text;notice.hidden=!text;}
  document.getElementById('service-panel')?.setAttribute?.('aria-busy',String(session.busy));
 }
 function terminalFailure(current,error){
  const committed=error?.code==='SAVE_COMMITTED_PUBLICATION_FAILED'&&error.committed===true&&Number.isSafeInteger(error.revision),subject=current.kind==='support'?'Life support refill':current.correction?'Fuel correction':'Refuel';
  const guidance=committed?subject+' saved, but the display could not update. Reload this page before continuing; do not record this service again.':'The '+subject.toLowerCase()+' save outcome could not be confirmed. Reload this page and check History before trying again.';
  // Latch the result before any application role/render callbacks can fail.
  current.terminal=true;current.invalidated=true;reloadMessage=guidance;
  try{onTerminalFailure(error,guidance);}catch{/* The local terminal guard remains latched even if reporting fails. */}
  return new Error(guidance,{cause:error});
 }
 function close({render:shouldRender=true}={}){if(session?.busy)return false;session=null;receipt=null;clearServiceSuccess();if(shouldRender)render();return true;}
 async function action(name,arg,actionToken){if(!name.startsWith('service-'))return false;
  // Every DOM action carries the generation it was rendered for. Detached
  // buttons and forms must never change or confirm a replacement draft.
  if(!session){if(receipt&&actionToken===receipt.token){if(['service-back','service-cancel'].includes(name))close();else if(name==='service-audit')showAudit();else if(name==='service-new')open(receipt.kind);}return true;}
  if(actionToken!==session.token||session.busy)return true;
  if(name==='service-audit')return showAudit();
  if(name==='service-back'||name==='service-cancel'){close();return true;}
  if(stale()||session.terminal){syncControls();throw Error(status());}sync();
  if(name==='service-adjust'){if(session.kind==='fuel'&&!session.correction)return true;session.mode='adjust';render();}
  else if(name==='service-fuel-correct'){session.correction=true;session.mode='adjust';render();}
  else if(name==='service-support-topoff'||name==='service-support-current'){if(session.kind!=='support')return true;session.draft.topOff28=name==='service-support-topoff';session.draft.extraDays='0';session.mode=session.draft.topOff28?'summary':'adjust';render();}
  else if(name==='service-review'){if(session.kind==='fuel'&&!session.correction)return true;quote();session.mode='summary';render();}
  else if(name==='service-fuel-step'||name==='service-fuel-topoff'||name==='service-fuel-next'){
   let value=name==='service-fuel-topoff'?maxFuelAddition(session.base):name==='service-fuel-step'?A.decimal(A.add(session.draft.fuelTons||0,arg)):nextJumpFuel(session.base);
   if(value===null)throw Error('Plan the next jump first.');session.draft.fuelTons=A.cmp(value,0)<0?'0':A.cmp(value,maxFuelAddition(session.base))>0?String(maxFuelAddition(session.base)):A.decimal(value);const input=document.querySelector('#service-form [name="fuelTons"]');if(input)input.value=session.draft.fuelTons;sync();
  }else if(name==='service-reserve-step'||name==='service-comfort-step'){
   if(session.kind!=='support')return true;const nameField=name==='service-reserve-step'?'extraDays':'comfortCredits',value=A.add(session.draft[nameField]||0,arg);session.draft[nameField]=A.cmp(value,0)<0?'0':A.decimal(value);const input=document.querySelector('#service-form [name="'+nameField+'"]');if(input)input.value=session.draft[nameField];sync();
  }else if(name==='service-confirm'){
   if(session.busy||(session.mode!=='summary'&&session.kind!=='support'&&!(session.kind==='fuel'&&!session.correction&&session.mode==='inline')))return true;
   const q=quote(true);if(session.kind==='support'&&A.cmp(supportAmount(q.purchasedStockUnits),0)===0&&A.credit(q.comfortAmount)===0n)return true;const current=session,draft=structuredClone(current.draft);let submitted=false,completed=false;
   current.busy=true;current.error='';
   try{
    syncControls();submitted=true;
    const result=commit(current.kind==='fuel'?(current.correction?'Adjusted fuel aboard':'Refuelled'):'Refilled life support',s=>{if(current.kind==='fuel'){if(current.correction)fuelCorrection(s,draft.fuelRemaining,draft.fuelReason);else shipExpense(s,q.input);}else refillLifeSupport(s,supportOptions(draft));},current.revision);
    // Preserve the synchronous local Store path; only a declared completion
    // Promise keeps this exact review pending beyond the current call stack.
    if(result&&typeof result.then==='function')await result;
    completed=true;receipt={kind:current.kind,token:'stock-'+(++generation),savedLabel:current.kind==='support'?'Life support refill saved.':current.correction?'Fuel correction saved.':'Refuel saved.',audit:(current.kind==='fuel'?fuelForecast(q):supportForecast(q))};session=null;render();
   }catch(error){
    if(completed){
     // Cleanup is publication too. Never turn a durable success into a retry.
     if(!session)session=current;
     throw terminalFailure(current,new SaveCommittedPublicationError(current.revision+1,error));
    }
    if(!submitted||(error?.code==='SAVE_NOT_COMMITTED'&&error.committed===false)){current.error=error.message;throw error;}
    throw terminalFailure(current,error);
   }finally{current.busy=false;if(session===current)syncControls();}
  }
  return true;
 }
 return {active,visible,kind:()=>session?.kind??receipt?.kind??null,token,open,panel,sync,syncControls,action,close,invalidate,committing:()=>!!session?.busy};
}
