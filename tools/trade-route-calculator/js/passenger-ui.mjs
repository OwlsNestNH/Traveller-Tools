import {ruleInfo} from './rule-references.mjs?v=briefing-refinements-20261013-75';
import {escapeHtml,formatCreditsText} from './display.mjs?v=briefing-refinements-20261013-75';
import * as A from './amounts.mjs';
import {manualLuggage} from './accommodation.mjs?v=briefing-refinements-20261013-75';
import * as P from './passengers.mjs?v=briefing-refinements-20261013-75';
import {passengerOffers,passageLabel,PASSAGE_CLASSES} from './passenger-rules.mjs?v=briefing-refinements-20261013-75';
import {supportStock,monthlySupport,supportDisplay} from './life-support.mjs?v=briefing-refinements-20261013-75';
import {displayDate} from './calendar.mjs';
const esc=escapeHtml;
const money=formatCreditsText,signed=x=>x>0?'+'+x:String(x);
const facts=rows=>'<dl class="passenger-facts">'+rows.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl>';
const button=(label,action,arg='',mutate=false,disabled=false)=>'<button data-action="'+action+'" data-arg="'+esc(arg)+'" '+(mutate?'data-mutate ':'')+(disabled?'data-unavailable disabled ':'')+'>'+esc(label)+'</button>';
const field=(name,label,value='',extra='')=>'<label class="field">'+esc(label)+'<input name="'+name+'" value="'+esc(value)+'" '+extra+'></label>';
const select=(name,label,options,value)=>'<label class="field">'+esc(label)+'<select name="'+name+'">'+options.map(([v,l])=>'<option value="'+v+'" '+(v===value?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>';
const check=(name,label)=>'<label class="check"><input type="checkbox" name="'+name+'">'+esc(label)+'</label>';
const roll=r=>r?.dice?.length?r.dice.join(' + ')+' = '+r.total:r?.total===0?'0 (no dice)':r?.total!=null?'Manual total '+r.total:'Not recorded';
const modeLabel=mode=>({private:'Private cabin',shared:'Shared, two per cabin',cargo:'Fitted spare space, 2 t/person',low:'Installed Low berth'}[mode]||mode);
export function createPassengerUI({getState,getCore,getWorld,getWorlds,getView,modal,act,render,message,completion,S,R,M}){
 let drafts=[],searchId=null;
 const state=()=>getState(),world=id=>getWorld(id),date=h=>h==null?'Not recorded':displayDate(state().dateLabel,h);
 function clear(){drafts=[];searchId=null;}
 function activeDrafts(){const s=state();return searchId===s.latestPassengerSearchId&&drafts[0]?.origin===s.actual?drafts:[];}
 function briefingSession(){return {searchId,offers:structuredClone(activeDrafts())};}
 function details(c){
  const a=c.audit||{},dm=a.dm||{},s=state(),source=c.status?c.status==='accepted'?'Aboard; unpaid':'Delivered and paid':'Available search result';
  let html=facts([['Passage',passageLabel(c.passageClass)],['People',c.count],['Status',source],['Origin',world(c.origin)?.name||c.origin],['Destination',world(c.destination)?.name||c.destination],['Fare per person',money(c.fare)],['Agreed total',money(c.payment)],['Accommodation',c.cabinMode?modeLabel(c.cabinMode):'Choose on boarding'],['Baggage allowance per person',P.bookingLuggage[c.passageClass]+' t before the whole-ship override / aggregate rounding'],['Accepted',date(c.acceptedHours)],['Delivered',date(c.deliveredHours)]]);
  if(c.status==='delivered')html+=facts([['Payment received',money(c.payout)]]);
  if(a.manual)html+=facts([['Referee terms',a.reason]]);
  else html+='<h3>Passenger availability calculation '+ruleInfo('passengers')+'</h3>'+facts([['Search 2D',roll(a.searchDice)],['Search skill',a.searchSkill??'Not recorded'],['Characteristic DM',a.searchCharacteristic??'Not recorded'],['Search Effect',dm.effect],['Highest Steward skill',dm.steward],['Origin DM',signed(dm.origin??0)],['Destination DM',signed(dm.destination??0)],['Distance DM',signed(dm.distance??0)],['Referee DM',signed(dm.refereeDM??0)],['Class DM',signed(a.classDM??0)],['Traffic 2D',roll(a.traffic)],['Modified traffic result',a.total],['Count dice',a.countDice+'D'],['Available people roll',roll(a.count)],['Direct jump distance',a.distance+' parsecs'],['Recorded origin population',a.originPopulation??'Unknown; exact cap requires referee review']]);
  for(const key of ['origin','destination']){const w=a.worldInputs?.[key],d=dm.components?.[key];if(w&&d)html+='<h4>'+esc(key==='origin'?'Origin at search':'Destination at search')+'</h4>'+facts([['World',w.name],['Population code',w.population],['Starport',w.starport],['Travel zone',w.zone],['Population DM',signed(d.population)],['Starport DM',signed(d.starport)],['Zone DM',signed(d.zone)]]);}
  if(c.populationException)html+=facts([['Exceptional population circumstances',c.populationException]]);
  if(c.status)html+=facts([['Steward service confirmed',c.serviceConfirmed?'Yes':'Not required for this class'],['Fitted spare space confirmed',c.spaceConfirmed?'Yes':'Not used'],['Payment rounding',c.roundingStep===100?'Up to Cr100':'Up to whole Credits']]);
  return html+'<p class="help">Accommodation '+ruleInfo('accommodation')+' · Booking and delivery '+ruleInfo('booking')+'</p><p class="help">'+esc(P.passengerReference)+'</p><p class="help">Campaign: High luggage 1 t/person; Middle 0. High sharing is an explicit allocation. Shared groups of the same class use two places per cabin. Existing cabin/person costs and whole-ship luggage overrides remain in force. Low revival is resolved in play.</p>';
 }
 function panel(){
  const s=state(),q=P.passengerCapacity(s),available=activeDrafts(),bookings=P.passengerBookings(s),stock=supportStock(P.passengerShip(s));
  const summary=q.configured?`${q.freeCabins} cabins and ${q.freeLowBerths} Low berths free · ${q.counts.total} booked people aboard`:'Review crew/cabin allocation and installed Low berths before boarding';
  let html='<section class="panel passenger-panel" aria-label="Passengers"><div class="panel-head"><h2>Passengers</h2></div><div class="panel-body"><p class="passenger-summary">'+esc(summary)+'</p><p class="help">Fares cover one jump. Select how many people to board. Payment is recorded only when you complete passage at the destination. Existing crew and other people are counted separately.</p>';
  if(q.configured)html+='<details><summary>Accommodation &amp; supplies '+ruleInfo('accommodation')+'</summary>'+facts([['Installed cabins',q.installedCabins],['Reserved for crew / other existing people',q.reservedCabins],['Cabins used by passenger bookings',q.bookedCabins],['Installed / occupied Low berths',q.installedLowBerths+' / '+q.occupiedLowBerths],['Awake people, including booked passengers',stock.awakePeople],['Frozen people, including booked Low',stock.occupiedLowBerths],['Consumption',stock.dailyUnits+' LSS/day'],['Whole-ship luggage reservation',q.luggage+' t'],['Basic fitted-space reservation',q.cargoSpace+' t']])+'<p class="help">Booked people are automatic. Do not enter them again in Settings. Crew cabin sharing is your allocation. High double occupancy remains available; two High people in one standard-cost High cabin cost Cr7,000/month.</p></details>';
  if(manualLuggage(s.ship))html+='<p class="notice">A manual whole-ship luggage total is active. Boarding and delivery keep that fixed total until you edit it in Settings.</p>';
  if(available.length)html+='<div class="passenger-offers">'+available.map(o=>{const n=P.passengerOfferRemaining(s,o);return '<article class="passenger-offer"><h3>'+passageLabel(o.passageClass)+'</h3><strong>'+n+' available</strong><p>'+money(o.fare)+' / person · '+esc(world(o.destination)?.name||o.destination)+'</p><p class="help">Traffic '+o.audit.total+' → '+o.audit.countDice+'D · rolled '+o.count+' people</p><div class="row">'+button('Board passengers','passenger-board',o.offerId,true,n<1||!q.configured)+button('Audit','passenger-offer-audit',o.offerId)+'</div></article>';}).join('')+'</div>';
  else html+='<p class="help">Search results are active only in this session. Earlier calculations remain in History.</p>';
  if(bookings.length)html+='<div class="scroll"><table><thead><tr><th>Passage / people</th><th>Destination</th><th>Accommodation</th><th>Revenue</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+bookings.map(c=>'<tr><td>'+passageLabel(c.passageClass)+' · '+c.count+'</td><td>'+esc(world(c.destination)?.name||c.destination)+'</td><td>'+esc(modeLabel(c.cabinMode))+'</td><td>'+money(c.payment)+'</td><td>'+esc(c.status==='accepted'?'Aboard · unpaid':'Delivered · paid')+'</td><td class="table-actions">'+(c.status==='accepted'?button('Complete passage','passenger-deliver',c.id,true,s.actual!==c.destination):'')+button('Audit','contract-audit',c.id)+'</td></tr>').join('')+'</tbody></table></div>';
  return html+'</div></section>';
 }
 // The caller owns durable completion; passenger offers remain module-local.
 // Capture is called only after the host claims this opening intent.
 function captureReview(owner){
  let retained=drafts,retainedId=searchId,baseline=JSON.stringify(drafts);
  const draftsCurrent=()=>drafts===retained&&searchId===retainedId&&JSON.stringify(drafts)===baseline;
  if(owner.kind==='setup')return {current:draftsCurrent,publish:()=>true};
  if(owner.kind==='board'||owner.kind==='deliver'){
   const campaign=owner.campaign,isBoard=owner.kind==='board',c=isBoard?activeDrafts().find(o=>o.offerId===owner.target):campaign.contracts.find(c=>c.id===owner.target&&c.kind==='passenger');
   if(!c||!isBoard&&c.status!=='accepted')throw Error(isBoard?'This passenger offer is no longer active. Search again.':'Passenger booking is not awaiting delivery.');
   const search=isBoard?P.latestPassengerSearch(campaign):null,recorded=search?.offers.find(o=>o.offerId===c.offerId),bytes=JSON.stringify(c);
   if(isBoard&&(!recorded||JSON.stringify(recorded)!==bytes))throw Error('This passenger offer no longer matches its recorded availability. Search again.');
   const subject=owner.retain(c),draftRefs=[...drafts],origin=JSON.stringify(world(c.origin)),destination=JSON.stringify(world(c.destination)),remaining=isBoard?P.passengerOfferRemaining(campaign,c):null;
   let published=null;
   if(!owner.entryCurrent())return null;
   return {subject,remaining,current:()=>{
    if(!draftsCurrent()||!draftRefs.every((draft,i)=>drafts[i]===draft)||JSON.stringify(world(subject.origin))!==origin||JSON.stringify(world(subject.destination))!==destination)return false;
    // The authenticated candidate legitimately replaces campaign objects and
    // changes booking status / remaining availability. Validate old identity
    // only before publication; the host binds completion to the exact candidate.
    const current=state();
    if(owner.publication){
     if(current!==owner.publication)return false;
     const currentSearch=isBoard?P.latestPassengerSearch(current):null,currentSubject=isBoard?currentSearch?.offers.find(o=>o.offerId===subject.offerId):current.contracts.find(x=>x.id===subject.id),bookings=isBoard?P.passengerBookings(current).filter(x=>x.offerId===subject.offerId):[];
     if(!currentSubject)return false;
     // Capture the new, authenticated objects once, then retain their identity
     // through settlement. A same-byte foreign replacement is still obsolete.
     if(!published)published={campaign:current,search:currentSearch,subject:currentSubject,bookings};
     return published.campaign===current&&published.search===currentSearch&&published.subject===currentSubject&&published.bookings.length===bookings.length&&published.bookings.every((booking,i)=>booking===bookings[i]);
    }
    return current===campaign&&(isBoard?P.latestPassengerSearch(current)===search&&search.offers.find(o=>o.offerId===subject.offerId)===recorded&&drafts.includes(c)&&JSON.stringify(c)===bytes&&P.passengerOfferRemaining(current,c)===remaining:current.contracts.find(x=>x.id===subject.id)===c&&JSON.stringify(c)===bytes);
   },publish:()=>true};
  }
  const catalog=getWorlds();if(!owner.entryCurrent())return null;
  const worlds=structuredClone(catalog),sourceRules=getCore();if(!owner.entryCurrent())return null;
  const ruleInputs=data=>({passengers:data.passengers,uwp:data.uwp,tradeCodes:data.tradeCodes}),rules=structuredClone(sourceRules),rulesBaseline=JSON.stringify(ruleInputs(sourceRules)),originBaseline=JSON.stringify(worlds[owner.worldId]);
  return {worlds,rules,current:()=>{
   const destination=owner.args?.event.destination??(!owner.constructing&&owner.session?owner.form.elements.namedItem('destination')?.value:owner.destination);
   return draftsCurrent()&&JSON.stringify(world(owner.worldId))===originBaseline&&(!destination||JSON.stringify(world(destination))===JSON.stringify(worlds[destination]))&&getCore()===sourceRules&&JSON.stringify(ruleInputs(sourceRules))===rulesBaseline;
  },publish(args){if(owner.kind==='manual')return true;const offers=structuredClone(args.event.offers),bytes=JSON.stringify(offers);if(!owner.completedCurrent())return false;drafts=offers;searchId=args.event.id;retained=drafts;retainedId=searchId;baseline=bytes;return true;}
  };
 }

 function setup(){
  return completion.open({kind:'setup',title:'Review passenger capacity',label:'Save passenger capacity',capture:captureReview,
   body:owner=>{
    const s=owner.campaign,q=P.passengerCapacity(s),a=s.ship.accommodation;if(!a)throw Error('Set up the existing people and cabins in Settings first.');
    return '<p class="help">Accommodation '+ruleInfo('accommodation')+'</p><p>Existing installed cabins: <strong>'+q.installedCabins+'</strong>. Allocate the cabins already used by crew and other non-booked people. Sharing is referee-managed; four crew might use two cabins.</p><p class="help">Low-service cabins are not Low berths. Enter the number of physical Low berths installed. Existing frozen occupants: '+(a.occupiedLowBerths||0)+'. This review does not change people, bank or supplies.</p><div class="split">'+field('reservedCabins','Cabins reserved for crew / other non-booked people',q.reservedCabins??'','type="number" min="0" max="'+q.installedCabins+'" step="1" required')+field('installedLowBerths','Installed Low berths',q.installedLowBerths??'','type="number" min="0" step="1" required')+'</div>'+check('reviewed','I reviewed existing people and cabin sharing; future booked passengers will be counted automatically.');
   },prepare:(f,owner)=>{
    if(!f.has('reviewed')||f.get('reservedCabins')===''||f.get('installedLowBerths')==='')throw Error('Review both capacities and confirm the existing allocation.');
    const capacity={reservedCabins:Number(f.get('reservedCabins')),installedLowBerths:Number(f.get('installedLowBerths'))},s=owner.campaign;
    P.validatePassengerSetup({...s,ship:{...s.ship,accommodation:{...s.ship.accommodation,passengerCapacity:capacity}}});
    return {reviewed:true,...capacity};
   },apply:(n,args)=>S.configurePassengerCapacity(n,args),success:'Passenger capacity settings saved.'
  });
 }
 function search(){
  let generated;
  return completion.open({kind:'search',title:'Find passengers',label:'Find passengers',capture:captureReview,
   body:owner=>{
    const s=owner.campaign,worlds=owner.context.worlds,origin=worlds[s.actual];
    if(getView()?.id!==s.actual||origin?.emptySpace)throw Error('Find passengers at the ship’s actual world.');
    if(!owner.entryCurrent())return '';
    const destinations=Object.values(worlds).filter(w=>{if(w.id===s.actual||w.emptySpace||!owner.entryCurrent())return false;const distance=M.distance(origin,w);return owner.entryCurrent()&&distance<=s.ship.jump;}).sort((a,b)=>a.name.localeCompare(b.name));
    if(!owner.entryCurrent())return '';
    if(!destinations.length)throw Error('Load nearby worlds within the ship’s jump rating first.');
    owner.destination=destinations.some(w=>w.id===s.route[s.routeIndex+1])?s.route[s.routeIndex+1]:destinations[0].id;
    generated=structuredClone(R.roll(2));if(!owner.entryCurrent())return '';
    return '<p class="help">Passenger traffic and fares '+ruleInfo('passengers')+'</p>'+select('destination','Single-jump destination',destinations.map(w=>[w.id,w.name+' · '+w.hex]),owner.destination)+'<div class="split">'+field('dice','Search 2D total',generated.total,'type="number" min="2" max="12" step="1" required')+field('skill','Broker / Carouse / Streetwise skill',Math.max(s.trader.broker,s.trader.streetwise),'type="number" step="1" required')+field('characteristic','Search characteristic DM',s.trader.characteristic,'type="number" step="1" required')+field('steward','Highest Steward skill aboard',0,'type="number" min="0" step="1" required')+'</div><p class="help">Search Effect = 2D + skill + characteristic − 8. Traffic is rolled separately for each class. No Credits, time or supplies are spent by this check.</p><details><summary>Manual traffic/count dice (optional)</summary>'+field('sequence','Dice in roll order, comma-separated','','type="text"')+'<p class="help">Order: Low, Basic, Middle, High; each uses two traffic dice followed by its count dice. Unspecified dice roll normally. A typed sequence is retained in the audit.</p></details>';
   },prepare:(f,owner)=>{
    const current=owner.campaign,worlds=owner.context.worlds,origin=worlds[current.actual],to=worlds[f.get('destination')],dice=Number(f.get('dice')),skill=Number(f.get('skill')),characteristic=Number(f.get('characteristic')),steward=Number(f.get('steward'));
    if(!Number.isInteger(dice)||dice<2||dice>12||![skill,characteristic,steward].every(Number.isSafeInteger))throw Error('Enter valid search dice and whole-number skill/DM values.');
    if(!to||to.emptySpace||M.distance(origin,to)>current.ship.jump)throw Error('Choose a destination within one jump.');
    if(!owner.current())throw Error('Passenger review changed while validating the destination.');
    const raw=String(f.get('sequence')||'').trim(),sequence=raw?raw.split(',').map(x=>Number(x.trim())):[];if(sequence.some(x=>!Number.isInteger(x)||x<1||x>6))throw Error('Manual dice must be values 1–6.');
    let at=0;const rng=()=>{if(!owner.current())throw Error('Passenger review changed while generating availability.');return at<sequence.length?sequence[at++]:R.die();},id=S.uid(),searchDice=dice===generated.total?generated:{dice:null,total:dice,manual:true};
    if(!owner.current())throw Error('Passenger review changed while generating availability.');
    const a=R.context(origin,owner.context.rules);if(!owner.current())throw Error('Passenger review changed while generating availability.');
    const b=R.context(to,owner.context.rules);if(!owner.current())throw Error('Passenger review changed while generating availability.');
    const distance=M.distance(origin,to);if(!owner.current())throw Error('Passenger review changed while generating availability.');
    const offers=passengerOffers(a,b,distance,{effect:dice+skill+characteristic-8,steward},owner.context.rules,rng).map(o=>{
     if(!owner.current())throw Error('Passenger review changed while generating availability.');
     return {...o,offerId:S.uid(),origin:current.actual,destination:to.id,audit:{...o.audit,searchDice,searchSkill:skill,searchCharacteristic:characteristic,manualDice:sequence}};
    });
    return {openingRoll:generated,event:{id,label:'Passenger search audit',world:current.actual,destination:to.id,hours:current.hours,offers,manualDice:sequence,manualDiceConsumed:at}};
   },apply:(n,args)=>S.recordPassengerSearch(n,args.event),success:'Passenger availability recorded. Choose how many people to board.'
  });
 }
 function manual(initialDestination=''){
  return completion.open({kind:'manual',preview:true,title:'Manual passenger contract',label:'Preview boarding',reviewTitle:'Confirm manual passenger booking',reviewLabel:'Board passengers',capture:captureReview,
   body:owner=>{
    const s=owner.campaign,worlds=owner.context.worlds;
    const destinations=Object.values(worlds).filter(w=>w.id!==s.actual&&!w.emptySpace&&M.distance(worlds[s.actual],w)<=s.ship.jump);
    if(!destinations.length)throw Error('Load nearby worlds within the ship’s jump rating first.');
    owner.destination=destinations.some(w=>w.id===initialDestination)?initialDestination:destinations[0].id;
    return '<p class="help">Referee terms '+ruleInfo('booking')+' · Accommodation '+ruleInfo('accommodation')+'</p>'+select('destination','Single-jump destination',destinations.map(w=>[w.id,w.name]),owner.destination)+select('passageClass','Passage class',PASSAGE_CLASSES.map(c=>[c,passageLabel(c)]),'middle')+field('count','People to board',1,'type="number" min="1" step="1" required')+field('fare','Agreed fare per person · Cr','1000','type="number" min="0" step="1" required')+select('cabinMode','Accommodation',[['private','Private cabins'],['shared','Shared, two per cabin'],['cargo','Basic fitted spare space · 2 t per person'],['low','Installed Low berth']],'private')+check('serviceConfirmed','Steward service is available (required for High / Middle).')+check('spaceConfirmed','Selected spare space is fitted for Basic passengers (if used).')+field('reason','Referee terms / reason','','type="text" required')+'<p class="help">Capacity, luggage and life support use the existing booking rules. Payment is recorded once on destination delivery; no automatic lateness penalty. Low revival is resolved in play.</p>';
   },prepare:(f,owner)=>{
    const reason=String(f.get('reason')||'').trim(),count=Number(f.get('count')),passageClass=f.get('passageClass'),fare=String(A.credit(f.get('fare')));
    if(!reason||!PASSAGE_CLASSES.includes(passageClass)||!Number.isSafeInteger(count)||count<1||A.cmp(fare,0)<0)throw Error('Enter a passage class, whole passenger count, nonnegative fare and referee reason.');
    const event={id:S.uid(),label:'Manual passenger terms audit',hours:owner.campaign.hours,world:owner.worldId,destination:f.get('destination'),offers:[{offerId:S.uid(),passageClass,count,fare,origin:owner.worldId,destination:f.get('destination'),audit:{manual:true,reason}}]};
    return {event,count,cabinMode:f.get('cabinMode'),serviceConfirmed:f.has('serviceConfirmed'),spaceConfirmed:f.has('spaceConfirmed')};
   },review:(owner,args)=>{
    const preview=S.transition(owner.campaign,'Preview manual passenger booking',n=>S.acceptManualPassengers(n,args.event,args)),c=preview.contracts.at(-1),q=P.passengerCapacity(preview);
    return facts([['Passage / people',passageLabel(c.passageClass)+' / '+c.count],['Destination',world(c.destination).name],['Fare per person',money(c.fare)],['Payment on delivery',money(c.payment)],['Cabins / Low berths free after',q.freeCabins+' / '+q.freeLowBerths],['Cargo space free after',supportDisplay(A.sub(preview.ship.capacity,S.used(preview)))+' t'],['Referee terms',c.audit.reason]])+'<p class="help">Boarding reserves capacity and preserves bank and existing supplies. '+ruleInfo('booking')+'</p>';
   },apply:(n,args)=>S.acceptManualPassengers(n,args.event,args),success:'Accepted manual passenger booking saved.'
  });
 }
 function board(offerId){
  return completion.open({kind:'board',target:offerId,preview:true,title:owner=>'Board '+passageLabel(owner.context.subject.passageClass)+' passengers',label:'Preview boarding',reviewTitle:'Confirm passenger booking',reviewLabel:'Board passengers',capture:captureReview,
   body:owner=>{
    const c=owner.context.subject,remaining=owner.context.remaining,kind=c.passageClass,modes=kind==='low'?[['low','Installed Low berth']]:kind==='basic'?[['shared','Shared cabins · two people per cabin'],['cargo','Fitted spare space · 2 t per person']]:[['private','Private cabins · one per person'],['shared','Shared cabins · two per cabin (referee allocation)']];
    return '<p class="help">Accommodation '+ruleInfo('accommodation')+'</p><p class="passenger-boarding-route">'+remaining+' available to '+esc(world(c.destination).name)+' at '+money(c.fare)+' per person. Boarding reserves accommodation; payment is due on explicit delivery.</p>'+field('count','People to board',1,'type="number" min="1" max="'+remaining+'" step="1" required')+select('cabinMode','Accommodation',modes,modes[0][0])+(kind==='high'||kind==='middle'?'<p class="help">'+(kind==='high'?'High requires a Steward skill level per ten passengers.':'Middle requires a Steward skill level per hundred; Steward 0 can serve ten.')+' Include people already aboard when checking service.</p>'+check('serviceConfirmed','Steward service is available for these passengers.'):'')+(kind==='basic'?check('spaceConfirmed','For spare-space accommodation: the selected space is fitted for passengers.'):'')+(kind==='low'?'<p class="notice">Low revival checks and their consequences are resolved in play. Completing passage records the agreed payment; no automated death or penalty is applied.</p>':'')+field('populationException','Exceptional population circumstances (only if required)','','type="text"');
   },prepare:f=>({count:Number(f.get('count')),cabinMode:f.get('cabinMode'),serviceConfirmed:f.has('serviceConfirmed'),spaceConfirmed:f.has('spaceConfirmed'),populationException:f.get('populationException')}),review:(owner,args)=>{
    const kind=owner.context.subject.passageClass,preview=S.transition(owner.campaign,'Preview passenger boarding',n=>S.acceptPassengers(n,offerId,args));
    if(!owner.current())throw Error('Passenger review changed while preparing boarding.');
    const q=P.passengerCapacity(preview),stock=supportStock(P.passengerShip(preview)),c=preview.contracts.at(-1);
    return '<p class="help">Booking '+ruleInfo('booking')+' · Accommodation '+ruleInfo('accommodation')+'</p>'+facts([['Passage',passageLabel(kind)],['People boarding',args.count],['Destination',world(c.destination).name],['Payment on delivery',money(c.payment)],['Cabins / Low berths free after',q.freeCabins+' / '+q.freeLowBerths],['Total luggage after',q.luggage+' t'],['Basic fitted space after',q.cargoSpace+' t'],['Cargo space free after',supportDisplay(A.sub(preview.ship.capacity,S.used(preview)))+' t'],['Total consumption after',stock.dailyUnits+' LSS/day'],['Monthly cabin/person bundle after',money(monthlySupport(P.passengerShip(preview)))],['Supplies','Existing LSS stock is preserved']])+'<p class="help">Booked people are added automatically. Do not enter them again in Settings. Cabin sharing changes accommodation use, not the number of people receiving service.</p>';
   },apply:(n,args)=>S.acceptPassengers(n,offerId,args),success:'Accepted passenger booking saved.'
  });
 }
 function deliver(id){
  return completion.open({kind:'deliver',target:id,title:'Complete passenger passage',label:'Complete passage & payout',capture:captureReview,
   body:owner=>{
    const c=owner.context.subject,s=owner.campaign;S.assertWorld(s,c.destination);
    const preview={...s,contracts:s.contracts.map(x=>x.id===c.id?{...x,status:'delivered'}:x)},capacity=P.passengerCapacity(preview);
    return '<p class="help">Booking and delivery '+ruleInfo('booking')+'</p>'+facts([['Class / people',passageLabel(c.passageClass)+' / '+c.count],['Destination',world(c.destination).name],['Payment',money(c.payment)],['Whole-ship luggage after',capacity.luggage+' t'],['Cabins / Low berths free after',capacity.freeCabins+' / '+capacity.freeLowBerths]])+(manualLuggage(s.ship)?'<p class="notice">Your manual whole-ship luggage total remains fixed after delivery. Edit it in Settings if the actual total changes.</p>':'')+'<p class="help">This releases the booking and records its payment once. Used life support is not restored. Payment on delivery is the app convention, with no automatic lateness penalty.</p>';
   },prepare:(_f,owner)=>({id:owner.context.subject.id}),apply:(n,args)=>S.deliverPassengers(n,args.id),success:'Delivered passenger booking saved.'
  });
 }
 function auditOffer(id){const c=activeDrafts().find(o=>o.offerId===id);if(!c)throw Error('Offer is no longer active. Find its read-only result in History.');modal('Passenger availability audit',details(c),null);}
 return {panel,details,setup,search,manual,board,deliver,auditOffer,clear,briefingSession};
}
