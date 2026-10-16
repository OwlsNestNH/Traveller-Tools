import * as E from './engine.mjs';

export const defaults = Object.freeze({normalHold:'50',mortgage:'150000',otherExpenses:'83000',monthlyTarget:'50000',baseBroker:2,statDM:1,opposingBroker:3,localDM:2,premiumEnabled:false,zeroLossTrial:true});
export function initial(seed=20261016) {
  return {schemaVersion:1,settingsVersion:E.SETTINGS_VERSION,revision:0,appliedCommands:[],seed,
    cash:E.packed(600000),unpaid:E.packed(0),settings:{...defaults},month:1,jumps:0,visit:0,
    current:null,destination:null,offers:[],lots:[],history:[],phase:'setup',supplierConfirmed:false};
}
const requireThat=(condition,message)=>{if(!condition)throw Error(message);};
const validWorld=w=>w&&typeof w.id==='string'&&typeof w.name==='string'&&Number.isSafeInteger(w.x)&&Number.isSafeInteger(w.y)&&typeof w.uwp==='string';
export function validate(s) {
  requireThat(s?.schemaVersion===1&&s.settingsVersion===E.SETTINGS_VERSION,'Unsupported alpha save version');
  requireThat(Number.isSafeInteger(s.revision)&&s.revision>=0&&Array.isArray(s.appliedCommands)&&s.appliedCommands.every(x=>typeof x==='string')&&new Set(s.appliedCommands).size===s.appliedCommands.length,'Invalid save revision/commands');
  requireThat(Number.isSafeInteger(s.seed)&&s.seed>0&&s.seed<=4294967295,'Invalid dice seed');
  requireThat(E.compare(s.cash,0)>=0&&E.compare(s.unpaid,0)>=0,'Invalid cash or liability');
  requireThat(['setup','buy','arrived','closed','stopped'].includes(s.phase),'Invalid phase');
  requireThat([s.month,s.jumps,s.visit].every(Number.isSafeInteger)&&s.month>0&&s.jumps>=0&&s.visit>=0,'Invalid calendar');
  requireThat(Array.isArray(s.offers)&&Array.isArray(s.lots)&&Array.isArray(s.history),'Invalid saved records');
  requireThat(s.current===null||validWorld(s.current),'Invalid current world');
  requireThat(s.destination===null||validWorld(s.destination),'Invalid destination');
  requireThat(s.phase==='setup'||validWorld(s.current),'Active session needs a current world');
  requireThat(s.phase!=='arrived'||s.lots.length>0,'Arrived session needs cargo');
  const p=s.settings;E.expertise(p.baseBroker);
  requireThat(E.compare(p.normalHold,0)>0&&E.compare(p.mortgage,0)>=0&&E.compare(p.otherExpenses,0)>=0,'Invalid capacity/expenses');
  E.rational(p.monthlyTarget);
  requireThat([p.statDM,p.opposingBroker,p.localDM].every(Number.isSafeInteger)&&p.opposingBroker>=0,'Invalid Broker settings');
  requireThat(typeof p.premiumEnabled==='boolean'&&typeof p.zeroLossTrial==='boolean','Invalid trial settings');
  for(const l of [...s.offers,...s.lots]) {
    requireThat(typeof l.id==='string'&&typeof l.name==='string'&&l.name.length<=100&&Object.hasOwn(E.RISK,l.risk),'Invalid lot identity/risk');
    requireThat(E.compare(l.purchase,0)>0&&E.compare(l.tonnes,1)>=0,'Invalid lot size/value');
    const validateAdmin=a=>{
      const techLevel='0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'.indexOf(s.current?.uwp[8]);
      requireThat(a.method==='Admin'&&a.techLevel===techLevel&&JSON.stringify(E.adminSearch(a))===JSON.stringify(Object.fromEntries(Object.entries(a).filter(([k])=>k!=='rollMode'))),'Invalid saved Admin search');
    };
    if(l.priorAdminSearch)validateAdmin(l.priorAdminSearch);
    if(l.search){
      const a=l.search,raw=E.diceTotal(a.dice);
      if(a.method==='Admin')validateAdmin(a);
      else requireThat([a.raw,a.baseBroker,a.statDM,a.riskDM,a.populationDM,a.total].every(Number.isSafeInteger)&&a.raw===raw&&a.total===raw+a.baseBroker+a.statDM+a.riskDM+a.populationDM&&typeof a.success==='boolean'&&a.success===(a.total>=8),'Invalid saved buyer search');
    }
    if(s.phase==='arrived'&&s.lots.includes(l))requireThat(l.departure?.version===E.SETTINGS_VERSION&&E.compare(l.departure.baseline,0)>0,'Missing departure calibration');
    if(l.quote){
      requireThat(l.search?.success,'Quoted lot needs a successful buyer search');
      const q=l.quote;let expected=E.quote({...q,departure:l.departure,dataNetDiscount:null});
      if(l.search.method==='Admin')requireThat(q.dataNetDiscount&&E.compare(q.dataNetDiscount,String(l.search.discountPercent/100))===0,'Quote must retain the selected Admin surplus reduction');
      else requireThat(!q.dataNetDiscount,'Broker quote cannot include a Data Net reduction');
      if(q.dataNetDiscount)expected=E.applyDataNet(expected,l.purchase,q.dataNetDiscount);
      requireThat(E.compare(q.gross,expected.gross)===0&&q.modified===expected.modified&&q.negotiationPP===expected.negotiationPP&&q.riskPercent===expected.riskPercent&&q.raw===expected.raw,'Invalid saved quote');
    }
  }
  requireThat(new Set([...s.offers,...s.lots].map(l=>l.id)).size===s.offers.length+s.lots.length,'Duplicate lot ID');
}
const log=(s,type,data)=>s.history.push({type,month:s.month,visit:s.visit,...data});
export function setup(s,values,world) {
  requireThat(s.phase==='setup','Setup is already saved');requireThat(validWorld(world),'Load a current world first');
  s.settings={...defaults,...values};s.cash=E.packed(values.bank);delete s.settings.bank;
  s.current=structuredClone(world);s.phase='buy';validate(s);log(s,'Setup',{settings:structuredClone(s.settings),cash:s.cash,world:s.current});return s;
}
export function offer(s,{id,name,tonnes,purchase,risk}) {
  requireThat(s.phase==='buy','Offerings are prepared at departure');
  requireThat(s.supplierConfirmed===true,'Confirm a supplier first; supplier search mechanics await selection');
  requireThat(!s.offers.some(l=>l.id===id)&&!s.lots.some(l=>l.id===id),'Lot already exists');
  s.offers.push({id,name:String(name).trim()||'Speculative lot',tonnes,purchase,risk,generation:'GM-entered size/value/risk; random offering tables unresolved',dice:[]});validate(s);return s;
}
export function confirmSupplier(s) {
  requireThat(s.phase==='buy','Supplier confirmation is at departure');
  if(s.supplierConfirmed)return s;s.supplierConfirmed=true;
  log(s,'Supplier confirmation',{method:'Manual GM confirmation',rules:'Difficulty, time, retries and purchase bargaining unresolved; no roll, cost or discount invented'});return s;
}
export function buy(s,id) {
  requireThat(s.phase==='buy','Purchases are closed');const lot=s.offers.find(l=>l.id===id);requireThat(lot,'Offering unavailable');
  requireThat(E.compare(s.cash,lot.purchase)>=0,'Insufficient cash');
  const used=s.lots.reduce((sum,l)=>E.add(sum,l.tonnes),E.packed(0));
  requireThat(E.compare(E.add(used,lot.tonnes),s.settings.normalHold)<=0,'Lot does not fit the hold; partial purchases are deferred');
  s.cash=E.subtract(s.cash,lot.purchase);s.offers=s.offers.filter(l=>l.id!==id);s.lots.push({...lot,origin:s.current.id,search:null,quote:null});
  log(s,'Buy',{lot:structuredClone(lot),cash:s.cash});return s;
}
export function destination(s,world) {
  requireThat(s.phase==='buy','Destination selection is available before departure');requireThat(validWorld(world),'Invalid destination');
  requireThat(world.id!==s.current.id,'Choose another world');s.destination=structuredClone(world);return s;
}
export function arrive(s,{freight=0,freightTonnes=0,freightRate=0}) {
  requireThat(s.phase==='buy'&&s.destination,'Select a destination first');
  requireThat(E.compare(freight,0)>=0&&E.compare(freightTonnes,0)>=0&&E.compare(freightRate,0)>=0,'Freight inputs cannot be negative');
  const used=s.lots.reduce((sum,l)=>E.add(sum,l.tonnes),E.packed(0));
  requireThat(E.compare(E.add(used,freightTonnes),s.settings.normalHold)<=0,'Freight and speculation exceed hold capacity');
  const investment=s.lots.reduce((sum,l)=>E.add(sum,l.purchase),E.packed(0));
  const monthlyCosts=E.add(s.settings.mortgage,s.settings.otherExpenses);
  for(const lot of s.lots)lot.departure=E.baseline({purchase:lot.purchase,tonnes:lot.tonnes,investment,normalHold:s.settings.normalHold,monthlyCosts,monthlyTarget:s.settings.monthlyTarget,freight,premiumEnabled:s.settings.premiumEnabled,freightRate});
  log(s,'Departure',{origin:s.current,destination:s.destination,freight,freightTonnes,investment});
  s.current=s.destination;s.destination=null;s.visit++;s.jumps++;s.offers=[];
  s.cash=E.add(s.cash,freight);s.phase=s.lots.length?'arrived':'closed';
  log(s,'Arrival',{world:s.current,freight,cash:s.cash});return s;
}
function diceFor(s,manual) {
  if(manual){E.diceTotal(manual);return [...manual];}
  const rolled=E.roll2d6(s.seed);s.seed=rolled.seed;return rolled.dice;
}
export function search(s,id,manual) {
  requireThat(s.phase==='arrived','Arrive before searching');const lot=s.lots.find(l=>l.id===id);requireThat(lot,'Lot unavailable');
  if(lot.search?.method==='Admin'&&!lot.search.success&&lot.search.durationMinutes<=60){lot.priorAdminSearch=lot.search;lot.search=null;}
  if(lot.search)return s;
  const population=parseInt(s.current.uwp[4],16);
  lot.search=E.buyerSearch({dice:diceFor(s,manual),baseBroker:s.settings.baseBroker,statDM:s.settings.statDM,risk:lot.risk,population});
  lot.search.rollMode=manual?'Manual':'Auto';
  log(s,'Buyer search',{lot:id,result:structuredClone(lot.search)});return s;
}
export function admin(s,id,inputs,manual) {
  requireThat(s.phase==='arrived','Arrive before searching');const lot=s.lots.find(l=>l.id===id);requireThat(lot,'Lot unavailable');
  if(lot.search)return s;
  requireThat(inputs.gmConfirmed===true,'GM must select the unresolved Admin characteristic and other search modifiers');
  const alphabet='0123456789ABCDEFGHJKLMNPQRSTUVWXYZ',techLevel=alphabet.indexOf(s.current.uwp[8]);
  const dice=diceFor(s,manual);let durationDie=inputs.durationDie;
  if(!manual){const duration=E.rollD6(s.seed);durationDie=duration.die;s.seed=duration.seed;}
  lot.search=E.adminSearch({...inputs,durationDie,dice,techLevel});lot.search.rollMode=manual?'Manual':'Auto';
  log(s,'Admin buyer search',{lot:id,result:structuredClone(lot.search)});return s;
}
export function value(s,id,manual,tradeDM=0) {
  requireThat(s.phase==='arrived','Arrive before valuing');const lot=s.lots.find(l=>l.id===id);requireThat(lot?.search?.success,'Find a buyer first');
  if(lot.quote)return s;
  lot.quote=E.quote({departure:lot.departure,risk:lot.risk,dice:diceFor(s,manual),...s.settings,tradeDM});
  if(lot.search.method==='Admin')lot.quote=E.applyDataNet(lot.quote,lot.purchase,String(lot.search.discountPercent/100));
  lot.quote.rollMode=manual?'Manual':'Auto';
  log(s,'Sale quote',{lot:id,quote:structuredClone(lot.quote)});return s;
}
export function preview(s,taxChart,{fees,government,zeroLossTrial=s.settings.zeroLossTrial}) {
  requireThat(s.phase==='arrived'&&s.lots.length,'No unsettled owned cargo');
  requireThat(s.lots.every(l=>l.quote),'Every lot needs a buyer and saved quote for the consolidated port settlement');
  return E.settle({lines:s.lots.map(l=>({gross:l.quote.gross,purchase:l.purchase})),fees,government,taxChart,zeroLossTrial});
}
export function sell(s,taxChart,inputs) {
  const settlement=preview(s,taxChart,inputs),next=E.add(s.cash,settlement.cashCredit);
  requireThat(E.compare(next,0)>=0,'Cash cannot cover the destination invoice');
  s.cash=next;log(s,'Port settlement',{lots:structuredClone(s.lots),settlement,cash:s.cash});s.lots=[];s.phase='closed';return s;
}
export function nextDeparture(s,{monthlyTarget=s.settings.monthlyTarget}={}) {
  requireThat(s.phase==='closed','Finish this port settlement first. Carry/retry policy is deferred; keep the saved cargo and quote.');
  if(s.jumps%2===0) {
    const bill=E.add(s.settings.mortgage,s.settings.otherExpenses),paid=E.compare(s.cash,bill)>=0?bill:s.cash;
    s.cash=E.subtract(s.cash,paid);s.unpaid=E.subtract(bill,paid);log(s,'Monthly bill',{due:bill,paid,unpaid:s.unpaid,cash:s.cash});
    if(E.compare(s.unpaid,0)>0){s.phase='stopped';return s;}
    s.month++;s.settings.monthlyTarget=monthlyTarget;E.rational(monthlyTarget);
  }
  s.phase='buy';s.supplierConfirmed=false;return s;
}
