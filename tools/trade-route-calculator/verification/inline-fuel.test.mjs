import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/state.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {expenseQuote} from '../js/expenses.mjs';
import {createServicePanels,maxFuelAddition} from '../js/service-panels.mjs';

function campaign({port='A',aboard=20,bladders=0,cargo='120',bank='100000',creditStep=1}={}){
 const s=S.initial();Object.assign(s,{initialized:true,bank,actual:'0,0',route:['0,0']});
 s.worlds={'0,0':{id:'0,0',name:'Actual Fuel Harbor',x:0,y:0,sector:'Synthetic',hex:'0101',uwp:port+'788899-C',zone:'Safe'}};
 s.ship.fuel=configureFuel(200,43,aboard,bladders,2);s.ship.capacity=cargo;s.settings.creditStep=creditStep;return s;
}
function harness(options){
 let state=campaign(options),form=null;const h={commits:0};
 const document={getElementById:id=>id==='service-form'?form:null,querySelector:selector=>form?.elements.find(el=>selector.includes('[name="'+el.name+'"]')),querySelectorAll:()=>[]};
 h.services=createServicePanels({document,getState:()=>state,isEditable:()=>true,commit(label,fn,revision){assert.equal(revision,state.revision);state=S.transition(state,label,fn);h.commits++;},render(){form=null;},showOverview(){},message(){},nextJumpFuel:()=>20});
 h.state=()=>state;h.bytes=()=>JSON.stringify(state);h.action=(name,arg='')=>h.services.action(name,arg,h.services.token());
 h.fill=values=>{form={dataset:{serviceToken:h.services.token()},elements:Object.entries(values).map(([name,value])=>({name,value:String(value),type:typeof value==='boolean'?'checkbox':'text',checked:value}))};h.services.sync();};
 h.services.open('fuel');return h;
}
const detail=q=>Object.fromEntries(q.details);
for(const grade of ['refined','unrefined'])for(const creditStep of [1,100])test(`custom ${grade}: decimal rate multiplies rounded tons once at Cr${creditStep}`,()=>{
 const s=campaign({creditStep}),input={kind:'fuel',fuelType:grade,tons:'2.25',customFuelRate:'101.25',notes:'Agreed local price',creditStep,fuelShip:s.ship};
 const q=expenseQuote(s.worlds[s.actual],input),audit=detail(q);
 assert.equal(q.amount,creditStep===1?'304':'400');assert.equal(audit['Entered fuel tons'],'2.25');assert.equal(audit['Fuel tons'],'3');assert.equal(audit['Rate · Cr/ton'],'101.25');assert.equal(audit['Fuel type'],grade==='refined'?'Refined':'Unrefined');assert.equal(audit['Price basis'],'Custom local price');assert.equal(q.notes,'Agreed local price');assert.equal(audit['Amount before final rounding · Cr'],'303.75');
 const before=structuredClone(s),paid=S.transition(s,'Refuelled',n=>S.shipExpense(n,input));
 assert.equal(paid.ship.fuel.aboardTons,23);assert.equal(paid.bank,creditStep===1?'99696':'99600');assert.equal(paid.ledger.length,1);assert.equal(paid.undo.length,1);assert.deepEqual(paid.ledger[0].expense,q);
 const loaded=JSON.parse(JSON.stringify(paid));S.validate(loaded);assert.deepEqual(loaded.ledger[0].expense,q);
 const undone=S.undo(loaded);for(const key of ['ship','bank','ledger','actual','hours'])assert.deepEqual(undone[key],before[key]);
});
test('custom note is optional at standard supply and cannot alter underlying grade availability',()=>{
 for(const [port,grade,allowed]of [['A','refined',true],['B','unrefined',true],['C','refined',false],['C','unrefined',true],['D','refined',false],['D','unrefined',true],['E','unrefined',false],['X','refined',false]]){
  const s=campaign({port}),input={kind:'fuel',fuelType:grade,tons:'1',customFuelRate:'99.5'};
  if(allowed)assert.equal(expenseQuote(s.worlds[s.actual],input).amount,'100');
  else{
   assert.throws(()=>expenseQuote(s.worlds[s.actual],input),/No standard starport supply/);
   assert.throws(()=>expenseQuote(s.worlds[s.actual],{...input,otherSupplier:true}),/explain in notes/);
   const q=expenseQuote(s.worlds[s.actual],{...input,otherSupplier:true,notes:'Referee confirmed local supplier'});assert.equal(q.amount,'100');assert.equal(detail(q).Supply,'Other supplier / referee-confirmed');
  }
 }
});
test('custom fuel price and quantity reject blank, negative, nonfinite and malformed values atomically',()=>{
 for(const value of ['', ' ', '-0.01','NaN','Infinity','-Infinity','1e309','abc']){
  const s=campaign(),before=JSON.stringify(s),input={kind:'fuel',fuelType:'refined',tons:'2',customFuelRate:value};
  assert.throws(()=>S.transition(s,'Invalid custom price',n=>S.shipExpense(n,input)),undefined,'Rejected custom price '+JSON.stringify(value));assert.equal(JSON.stringify(s),before);
 }
 for(const tons of ['',' ','-0.01','0','NaN','Infinity','1e309','abc','23.001']){
  const s=campaign(),before=JSON.stringify(s);assert.throws(()=>S.transition(s,'Invalid quantity',n=>S.shipExpense(n,{kind:'fuel',fuelType:'refined',tons,customFuelRate:'100'})));assert.equal(JSON.stringify(s),before);
 }
 const s=campaign();assert.throws(()=>expenseQuote(s.worlds[s.actual],{kind:'fuel',fuelType:'water',tons:'1',customFuelRate:'0'}),/Water collection is free/);
 const zero=expenseQuote(s.worlds[s.actual],{kind:'fuel',fuelType:'unrefined',tons:'1',customFuelRate:'0'});assert.equal(zero.amount,'0');assert.equal(detail(zero)['Fuel type'],'Unrefined');
});
test('inline source controls and obsolete mode actions never write or hide normal fuel input',async()=>{
 const h=harness(),before=h.bytes();assert.match(h.services.panel(),/name="fuelTons"[^>]*step="any"/);assert.match(h.services.panel(),/value="custom"/);assert.doesNotMatch(h.services.panel(),/data-action="service-(?:adjust|review)"/);
 for(const action of ['service-adjust','service-review']){await h.action(action);assert.match(h.services.panel(),/id="service-form"/);assert.equal(h.bytes(),before);}
 for(const fuelType of ['refined','unrefined','water','custom']){
  h.fill({fuelType,fuelTons:'2.25',customFuelType:'unrefined',customFuelRate:'101.25',expenseNotes:'Retained draft'});
  assert.match(h.services.panel(),/Entered 2\.25 t → 3 t added and charged/);assert.equal(h.bytes(),before);
 }
 await h.action('service-cancel');assert.equal(h.bytes(),before);assert.equal(h.commits,0);
});
test('inline quantity boundaries use rounded physical tons and exact whole-ton top-off',async()=>{
 for(const [aboard,bladders,cargo,maximum]of [[20,0,'120',23],[42,0,'120',1],[43,0,'120',0],[40,1,'0',3],[43,1,'0',0],[43,1,'120',40],[40,1,'5.2',8]]){
  const h=harness({aboard,bladders,cargo}),before=h.bytes();assert.equal(maxFuelAddition(h.state()),maximum);
  assert.match(h.services.panel(),new RegExp('Top off · '+maximum+' t'));
  await h.action('service-fuel-step','10');assert.match(h.services.panel(),new RegExp('name="fuelTons"[^>]*value="'+maximum+'"'));
  await h.action('service-fuel-step','-10');assert.match(h.services.panel(),new RegExp('name="fuelTons"[^>]*value="'+Math.max(0,maximum-10)+'"'));
  await h.action('service-fuel-topoff');assert.equal(h.bytes(),before);
  h.fill({fuelTons:String(maximum+.01)});await assert.rejects(h.action('service-confirm'),/exceed available tank or cargo/);assert.equal(h.bytes(),before);
  if(maximum){h.fill({fuelTons:String(maximum-.25),fuelType:'water'});await h.action('service-confirm');assert.equal(h.state().ship.fuel.aboardTons,aboard+maximum);assert.equal(h.state().bank,'100000');}
  else{h.fill({fuelTons:'0'});await assert.rejects(h.action('service-confirm'),/No fuel to acquire/);assert.equal(h.commits,0);}
 }
});
test('inline invalid numeric edits and insufficient credits cannot charge',async()=>{
 for(const fuelTons of ['',' ','-0.5','NaN','Infinity','1e309','9007199254740992']){
  const h=harness(),before=h.bytes();h.fill({fuelTons});await assert.rejects(h.action('service-confirm'));assert.equal(h.bytes(),before);assert.equal(h.commits,0);
 }
 const h=harness({bank:'99'}),before=h.bytes();h.fill({fuelTons:'1',fuelType:'unrefined'});await assert.rejects(h.action('service-confirm'),/Insufficient funds/);assert.equal(h.bytes(),before);
});
test('manual fuel correction still requires its separate Review before confirmation',async()=>{
 const h=harness(),before=h.bytes();await h.action('service-fuel-correct');h.fill({fuelRemaining:'13',fuelReason:'Seven-ton leak'});await h.action('service-confirm');assert.equal(h.bytes(),before);assert.equal(h.commits,0);
 await h.action('service-review');assert.match(h.services.panel(),/Adjust fuel aboard · Summary/);assert.equal(h.bytes(),before);await h.action('service-confirm');assert.equal(h.state().ship.fuel.aboardTons,13);assert.equal(h.state().bank,'100000');assert.equal(h.state().ledger.length,0);assert.equal(h.state().events.find(event=>event.fuelCorrection).fuelCorrection.reason,'Seven-ton leak');
});

for(const port of ['A','X'])test(`fully full ${port} tanks retain source, selected rate, zero total and correction without supplier override`,async()=>{
 const h=harness({aboard:43,port}),before=h.bytes();
 for(const [fuelType,rate]of [['refined','500'],['unrefined','100'],['water','0'],['custom','125.5']]){
  h.fill({fuelType,fuelTons:'0',customFuelType:'refined',customFuelRate:rate});const html=h.services.panel();
  assert.match(html,/id="service-form"/);assert.match(html,/name="fuelType"/);assert.match(html,/data-action="service-fuel-correct"/);assert.match(html,/Top off · 0 t/);assert.match(html,new RegExp('Unit price<\\/dt><dd>Cr '+rate.replace('.','\\.')+' \\/ t'));assert.match(html,/<strong>Cr 0<\/strong>/);
  await assert.rejects(h.action('service-confirm'),/No fuel to acquire/);assert.equal(h.bytes(),before);assert.equal(h.commits,0);
 }
});
