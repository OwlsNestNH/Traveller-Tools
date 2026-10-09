import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpensePanels,expenseOverview,coveredExpensePayments,latestExpenseReceipt} from '../js/expense-panels.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {configureMortgage} from '../js/mortgage.mjs';
import {configureMaintenance} from '../js/maintenance.mjs';
import {expenseQuote} from '../js/expenses.mjs';
import {monthlySupport} from '../js/life-support.mjs';
import * as S from '../js/state.mjs';

const campaign=()=>{
 const s=S.initial();s.initialized=true;s.bank='5000000';s.actual='0,0';s.route=['0,0'];s.dateLabel='001-1105';s.hours=29;
 s.worlds={'0,0':{id:'0,0',name:'Actual origin',x:0,y:0,sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'}};
 s.ship.fuel=configureFuel(200,43,20,0,2);
 s.ship.mortgage=configureMortgage({originalAmount:'24000001',payment:'100001',remainingPayments:'480',totalPaid:'0',nextDueDate:'029-1105'});
 s.ship.maintenance=configureMaintenance({payment:'2001',nextDueDate:'015-1105'});
 s.ship.expenses={salary:'12001'};
 s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:4,high:0},crew:{low:0,middle:0,high:0}};
 return s;
};
function actionArg(panel,name,value){
 const matches=[...panel.matchAll(new RegExp('data-action="'+name+'" data-arg="([^"]+)"','g'))];
 const found=value===undefined?matches[0]:matches.find(match=>match[1].endsWith(':'+value));
 assert.ok(found,'Missing rendered '+name+(value?': '+value:''));return found[1];
}
function harness(initial=campaign(),options={}){
 let state=initial,editable=options.editable??true,form=null;
 const h={renders:0,commits:0,routes:[],services:[],settings:[],messages:[],pending:null};
 const nodes={quote:{innerHTML:''},status:{textContent:'',hidden:true}};
 const controls={pay:{disabled:false,textContent:''},input:{disabled:false}};
 const document={getElementById(id){return id==='expense-form'?form:id==='expense-quote'?nodes.quote:id==='expense-status'?nodes.status:null;},querySelectorAll(selector){return selector.includes('[data-action="expense-pay"]')?[controls.pay]:[controls.input];}};
 function save(label,fn,revision){assert.equal(revision,state.revision);if(!editable)throw Error('read-only');const next=S.transition(state,label,fn);if(options.fail)throw Error('Storage rejected this save.');state=next;h.commits++;return next;}
 const commit=options.commit?((label,fn,revision)=>options.commit({label,fn,revision,save,h})):save;
 h.expenses=createExpensePanels({document,getState:()=>state,isEditable:()=>editable,commit,render(){h.renders++;form=null;},showOverview(){},message(text){h.messages.push(text);},openService(kind){if(options.serviceError)throw Error(options.serviceError);h.services.push(kind);},showSettings(kind){h.settings.push(kind);},onNavigate(route){h.routes.push(route);},rollDie:()=>3});
 h.state=()=>state;h.setState=value=>{state=value;};h.setEditable=value=>{editable=value;};h.controls=controls;h.nodes=nodes;
 h.edit=values=>{const html=h.expenses.panel(),token=/data-expense-session="([^"]+)"/.exec(html)?.[1];assert.ok(token,'No editable form rendered');form={dataset:{expenseSession:token},elements:Object.entries(values).map(([name,value])=>({name,value:String(value)}))};h.expenses.sync();};
 h.arg=(name,value)=>actionArg(h.expenses.panel(),name,value);
 h.click=(name,value)=>h.expenses.action(name,h.arg(name,value));
 return h;
}

test('compact summary has six name links, exact recurring total, no row Pay, and no loan data',()=>{
 const s=campaign(),h=harness(s);h.expenses.open();const html=h.expenses.panel(),q=expenseOverview(s);
 assert.equal(q.total,'122003');assert.deepEqual(q.missing,[]);assert.equal(q.rows.find(row=>row.kind==='support').amount,String(monthlySupport(s.ship)));
 for(const label of ['Mortgage','Monthly maintenance','Crew salaries','Life support','Fuel','Port costs'])assert.match(html,new RegExp(label));
 assert.equal((html.match(/data-action="expense-open"/g)||[]).length,6);
 assert.equal((html.match(/>Variable</g)||[]).length,2);assert.match(html,/class="expense-table"/);assert.match(html,/4-week \(28-day\) month/);
 assert.doesNotMatch(html,/data-action="expense-pay"|24000001|24,000,001|Original mortgage/);
});

test('unknown amounts are excluded honestly; zero complete mortgage is not a debt balance',()=>{
 const s=campaign();delete s.ship.maintenance;delete s.ship.expenses;delete s.ship.accommodation;s.ship.mortgage.remainingPayments=0;
 const q=expenseOverview(s);assert.equal(q.total,'0');assert.deepEqual(q.missing,['Monthly maintenance','Crew salaries','Life support']);assert.equal(q.rows[0].due,'All payments paid');
 const h=harness(s);h.expenses.open();assert.match(h.expenses.panel(),/Partial total/);assert.match(h.expenses.panel(),/Not configured and excluded/);
});

test('opening, editing, Back, Cancel, and switching to services never mutate campaign',async()=>{
 const h=harness(),before=structuredClone(h.state());h.expenses.open();await h.click('expense-open','mortgage');h.edit({payments:7});
 await h.click('expense-back');await h.click('expense-open','maintenance');h.edit({payments:4});await h.click('expense-cancel');
 await h.click('expense-open','fuel');assert.deepEqual(h.services,['fuel']);assert.equal(h.expenses.active(),false);
 h.expenses.open();await h.click('expense-open','support');assert.deepEqual(h.services,['fuel','support']);assert.equal(h.commits,0);assert.deepEqual(h.state(),before);
});

test('rejected fuel or life-support navigation preserves the existing panel and its original Back action',async()=>{
 for(const {kind,error,readonly,emptySpace} of [
  {kind:'fuel',error:'This tab is read-only. Take over editing first.',readonly:true},
  {kind:'support',error:'No local supplies in empty space. Continue to a world first.',emptySpace:true}
 ]){
  const s=campaign();if(emptySpace)s.worlds[s.actual].emptySpace=true;
  const h=harness(s,{editable:!readonly,serviceError:error}),before=structuredClone(s);h.expenses.open();const html=h.expenses.panel(),back=h.arg('expense-close');
  await assert.rejects(h.click('expense-open',kind),{message:error});assert.equal(h.expenses.active(),true);assert.equal(h.expenses.panel(),html);assert.deepEqual(h.expenses.route(),{kind:'expenses'});assert.equal(h.commits,0);assert.deepEqual(h.state(),before);
  await h.expenses.action('expense-close',back);assert.equal(h.expenses.active(),false);
 }
});

test('missing fixed expenses navigate to Settings without invented payment defaults',async()=>{
 for(const kind of ['mortgage','maintenance']){
  const s=campaign();delete s.ship[kind];const h=harness(s);h.expenses.open(kind,{fresh:true});const html=h.expenses.panel();assert.match(html,/is not configured/);assert.doesNotMatch(html,/data-action="expense-pay"|id="expense-form"/);await h.click('expense-settings');assert.deepEqual(h.settings,[kind]);assert.equal(h.commits,0);assert.equal(h.expenses.active(),false);
 }
});

test('mortgage prepay uses exact fixed credits, all dates metadata, and a saved receipt in place',async()=>{
 const s=campaign();s.settings.creditStep=100;const h=harness(s);h.expenses.open('mortgage',{fresh:true});h.edit({payments:2});
 let html=h.expenses.panel();assert.match(html,/Cr 200,002/);assert.match(html,/Cr 4,799,998/);assert.match(html,/data-payment-first="029-1105" data-payment-count="2" data-payment-amount="100001"/);assert.match(html,/085-1105/);
 assert.doesNotMatch(html,/Review changes|data-action="expense-review"/);
 const pay=h.arg('expense-pay');await h.expenses.action('expense-pay',pay);await h.expenses.action('expense-pay',pay);
 assert.equal(h.commits,1);assert.equal(h.state().bank,'4799998');assert.equal(h.state().ship.mortgage.remainingPayments,478);assert.equal(h.state().ship.mortgage.totalPaid,'200002');assert.equal(h.state().ship.mortgage.originalAmount,'24000001');
 html=h.expenses.panel();assert.match(html,/Payment recorded/);assert.match(html,/002-1105 · 05:00/);assert.match(html,/085-1105/);assert.match(html,/>478</);assert.match(html,/Cr 200,002/);assert.equal((html.match(/<button/g)||[]).length,1);assert.doesNotMatch(html,/expense-pay|expense-cancel/);
 assert.deepEqual(h.expenses.route(),{kind:'mortgage',receiptId:h.state().ledger.at(-1).id});assert.equal(h.state().events.at(-1).label,'Paid mortgage');
});

test('maintenance prepays its independent fixed schedule and restores through Undo',async()=>{
 const s=campaign();s.settings.creditStep=100;const h=harness(s),before=structuredClone(s);h.expenses.open('maintenance',{fresh:true});h.edit({payments:3});
 assert.match(h.expenses.panel(),/Cr 6,003/);await h.click('expense-pay');assert.equal(h.state().ship.maintenance.nextDueDate,'099-1105');assert.equal(h.state().ship.maintenance.paidSinceTracking,'6003');assert.deepEqual(h.state().ship.mortgage,before.ship.mortgage);
 const undone=S.undo(h.state());assert.equal(undone.bank,before.bank);assert.deepEqual(undone.ship.maintenance,before.ship.maintenance);h.setState(undone);assert.match(h.expenses.panel(),/no longer in the ledger/);assert.doesNotMatch(h.expenses.panel(),/Payment recorded/);
});

test('saved receipts recover on fresh controller/reload and freeze paid campaign date',async()=>{
 const h=harness();h.expenses.open('mortgage',{fresh:true});await h.click('expense-pay');const route=h.expenses.route(),saved=JSON.parse(JSON.stringify(h.state()));
 saved.dateLabel='001-1200';saved.hours=200;const loaded=harness(saved);loaded.expenses.open(route.kind,{receiptId:route.receiptId});
 assert.match(loaded.expenses.panel(),/Payment recorded/);assert.match(loaded.expenses.panel(),/002-1105 · 05:00/);assert.equal(loaded.commits,0);
 await loaded.click('expense-back');await loaded.click('expense-open','mortgage');assert.match(loaded.expenses.panel(),/id="expense-form"/);assert.doesNotMatch(loaded.expenses.panel(),/Payment recorded/);
 loaded.expenses.open('mortgage');assert.match(loaded.expenses.panel(),/Payment recorded/);
 loaded.expenses.open('maintenance',{receiptId:route.receiptId});assert.match(loaded.expenses.panel(),/no longer in the ledger/);assert.doesNotMatch(loaded.expenses.panel(),/expense-pay/);
});

test('receipt reopened after travel uses its saved world name rather than current actual location',async()=>{
 const h=harness();h.expenses.open('mortgage',{fresh:true});assert.match(h.expenses.panel(),/Actual ship location: Actual origin/);await h.click('expense-pay');const route=h.expenses.route();
 const moved=structuredClone(h.state());moved.actual='1,0';moved.worlds['1,0']={...moved.worlds['0,0'],id:'1,0',name:'New destination'};moved.worlds['0,0'].name='Renamed original world';moved.route=['0,0','1,0'];moved.routeIndex=1;
 const reopened=harness(moved);reopened.expenses.open(route.kind,{receiptId:route.receiptId});const html=reopened.expenses.panel();assert.match(html,/Recorded location: Actual origin/);assert.doesNotMatch(html,/New destination|Renamed original world|Actual ship location:/);assert.equal(reopened.commits,0);
});

test('legacy receipt location resolves only its recorded ledger world, otherwise stays unknown',()=>{
 const s=S.transition(campaign(),'Prior payment',state=>S.shipExpense(state,{kind:'maintenance',maintenancePayments:1}));delete s.ledger[0].expense.worldName;
 s.actual='1,0';s.worlds['1,0']={...s.worlds['0,0'],id:'1,0',name:'Current destination'};s.route=['0,0','1,0'];s.routeIndex=1;
 const found=harness(s);found.expenses.open('maintenance');assert.match(found.expenses.panel(),/Recorded location: Actual origin/);assert.doesNotMatch(found.expenses.panel(),/Current destination/);
 for(const world of [undefined,'missing-world']){
  const legacy=structuredClone(s);legacy.ledger[0].world=world;const unknown=harness(legacy);unknown.expenses.open('maintenance');assert.match(unknown.expenses.panel(),/Recorded location: Not recorded/);assert.doesNotMatch(unknown.expenses.panel(),/Current destination|Actual ship location:/);assert.equal(unknown.commits,0);
 }
});

test('salary edits are unsaved until Pay; existing expenseQuote rounding remains authoritative',async()=>{
 const s=campaign();s.settings.creditStep=100;const h=harness(s);h.expenses.open('salary',{fresh:true});h.edit({payments:2,monthly:1234});
 const expected=expenseQuote(s.worlds[s.actual],{kind:'salary',monthly:'1234',months:'2',creditStep:100});assert.equal(expected.amount,'2500');assert.match(h.expenses.panel(),/Cr 2,500/);assert.equal(h.state().ship.expenses.salary,'12001');
 await h.click('expense-pay');assert.equal(h.state().bank,'4997500');assert.equal(h.state().ship.expenses.salary,'1234');assert.deepEqual(h.state().ledger[0].paidAt,{dateLabel:'001-1105',hours:29});assert.match(h.expenses.panel(),/002-1105 · 05:00/);
});

test('berthing rate requires an explicit audited save and uses existing weekly math',async()=>{
 const h=harness();h.expenses.open('berthing',{fresh:true});assert.match(h.expenses.panel(),/Roll and save starport rate/);assert.equal(h.commits,0);
 await h.click('expense-berthing-rate');assert.equal(h.commits,1);assert.deepEqual(h.state().worlds['0,0'].berthingRate,{port:'A',die:3});assert.equal(h.state().bank,'5000000');assert.equal(h.state().ledger.length,0);assert.equal(h.state().events.at(-1).label,'Saved starport berthing rate');
 h.edit({weeks:2});assert.match(h.expenses.panel(),/Cr 6,000/);await h.click('expense-pay');assert.equal(h.commits,2);assert.equal(h.state().bank,'4994000');assert.equal(h.state().ledger[0].expense.kind,'berthing');assert.match(h.expenses.panel(),/Payment recorded/);
});

test('already saved berthing, zero-rate ports, and empty space follow existing rules',async()=>{
 const saved=campaign();saved.worlds['0,0'].berthingRate={port:'A',die:5};const h=harness(saved);h.expenses.open('berthing',{fresh:true});assert.doesNotMatch(h.expenses.panel(),/Roll and save/);assert.match(h.expenses.panel(),/Cr 5,000/);
 const free=campaign();free.worlds['0,0'].uwp='E788899-C';const zero=harness(free);zero.expenses.open('berthing',{fresh:true});await zero.click('expense-pay');assert.equal(zero.state().bank,'5000000');assert.equal(zero.state().ledger[0].amount,'0');
 const empty=campaign();empty.worlds['0,0'].emptySpace=true;const noPort=harness(empty);noPort.expenses.open('berthing',{fresh:true});assert.match(noPort.expenses.panel(),/No berthing in empty space/);assert.doesNotMatch(noPort.expenses.panel(),/Roll and save/);assert.equal(noPort.commits,0);
});

test('invalid payment counts, exhausted schedule, and insufficient funds never mutate',async()=>{
 for(const value of ['','0','-1','1.5','481','9007199254740992']){
  const h=harness(),before=structuredClone(h.state());h.expenses.open('mortgage',{fresh:true});h.edit({payments:value});assert.equal(h.controls.pay.disabled,true);await assert.rejects(h.click('expense-pay'));assert.deepEqual(h.state(),before);assert.equal(h.commits,0);
 }
 const s=campaign();s.bank='1';const h=harness(s);h.expenses.open('maintenance',{fresh:true});assert.match(h.expenses.panel(),/Insufficient funds/);await assert.rejects(h.click('expense-pay'),/Insufficient funds/);assert.equal(h.commits,0);
 s.ship.mortgage.remainingPayments=0;const done=harness(s);done.expenses.open('mortgage',{fresh:true});assert.match(done.expenses.panel(),/All scheduled mortgage payments are paid/);assert.doesNotMatch(done.expenses.panel(),/expense-pay/);
});

test('storage failure preserves the draft without claiming payment or changing bank',async()=>{
 const h=harness(campaign(),{fail:true}),before=structuredClone(h.state());h.expenses.open('mortgage',{fresh:true});h.edit({payments:2});await assert.rejects(h.click('expense-pay'),/Storage rejected/);assert.deepEqual(h.state(),before);assert.match(h.expenses.panel(),/Storage rejected/);assert.doesNotMatch(h.expenses.panel(),/Payment recorded/);assert.equal(h.expenses.committing(),false);
});

test('revision, actual location, ownership, and observed ownership loss invalidate drafts',async()=>{
 for(const mode of ['revision','location','ownership','ownership-returned']){
  const h=harness();h.expenses.open('mortgage',{fresh:true});const arg=h.arg('expense-pay');
  if(mode==='revision'){const n=S.transition(h.state(),'Changed campaign',s=>s.bank='4999999');h.setState(n);}
  else if(mode==='location'){const n=structuredClone(h.state());n.actual='1,0';n.worlds['1,0']={...n.worlds['0,0'],id:'1,0'};h.setState(n);}
  else{h.setEditable(false);h.expenses.syncControls();if(mode==='ownership-returned')h.setEditable(true);}
  assert.match(h.expenses.panel(),/Campaign or editing ownership changed/);await assert.rejects(h.expenses.action('expense-pay',arg),/Campaign or editing ownership changed/);assert.equal(h.commits,0);await h.click('expense-back');assert.match(h.expenses.panel(),/Regular 4-week total/);
 }
});

test('read-only tabs inspect summary and receipts but cannot edit, pay, roll, or set up',async()=>{
 const h=harness(campaign(),{editable:false});h.expenses.open();assert.match(h.expenses.panel(),/Regular 4-week total/);await h.click('expense-open','salary');h.expenses.syncControls();assert.equal(h.controls.pay.disabled,true);assert.equal(h.controls.input.disabled,true);await assert.rejects(h.click('expense-pay'),/editing ownership/);assert.equal(h.commits,0);
 const paid=S.transition(campaign(),'Prior payment',s=>S.shipExpense(s,{kind:'mortgage',mortgagePayments:1}));const receipt=harness(paid,{editable:false});receipt.expenses.open('mortgage');assert.match(receipt.expenses.panel(),/Payment recorded/);assert.doesNotMatch(receipt.expenses.panel(),/expense-pay/);
 const rate=harness(campaign(),{editable:false});rate.expenses.open('berthing',{fresh:true});await assert.rejects(rate.click('expense-berthing-rate'),/editing ownership/);assert.equal(rate.commits,0);
});

test('old click tokens and missing tokens cannot pay a newer draft',async()=>{
 const h=harness();h.expenses.open('mortgage',{fresh:true});const old=h.arg('expense-pay');await h.click('expense-back');await h.click('expense-open','mortgage');await h.expenses.action('expense-pay',old);await h.expenses.action('expense-pay','');assert.equal(h.commits,0);await h.click('expense-pay');assert.equal(h.commits,1);
});

test('busy payments ignore duplicate clicks and block Back, close, and service switches until saved',async()=>{
 const h=harness(campaign(),{commit({label,fn,revision,save,h}){return new Promise((resolve,reject)=>{h.pending=()=>{try{resolve(save(label,fn,revision));}catch(error){reject(error);}};});}});
 h.expenses.open('mortgage',{fresh:true});const arg=h.arg('expense-pay'),pending=h.expenses.action('expense-pay',arg);assert.equal(h.expenses.committing(),true);await h.expenses.action('expense-pay',arg);assert.equal(h.commits,0);
 await h.click('expense-back');assert.equal(h.expenses.open('salary',{fresh:true}),false);assert.equal(h.expenses.close(),false);assert.equal(h.expenses.open('fuel'),false);assert.deepEqual(h.services,[]);assert.equal(h.expenses.route().kind,'mortgage');
 h.pending();await pending;assert.equal(h.commits,1);assert.match(h.expenses.panel(),/Payment recorded/);assert.equal(h.expenses.committing(),false);
});

test('old deferred transaction callback cannot apply after revision or ownership changes',async()=>{
 for(const mode of ['revision','ownership']){
  const h=harness(campaign(),{commit({label,fn,revision,save,h}){return new Promise((resolve,reject)=>{h.pending=()=>{try{resolve(save(label,fn,revision));}catch(error){reject(error);}};});}});
  h.expenses.open('mortgage',{fresh:true});const pending=h.click('expense-pay');if(mode==='revision')h.setState(S.transition(h.state(),'Other change',s=>s.bank='4999999'));else h.setEditable(false);
  h.pending();await assert.rejects(pending);assert.equal(h.commits,0);assert.equal(h.state().ledger.length,0);assert.equal(h.expenses.committing(),false);
 }
});

test('delayed completion stays on the saved receipt and cannot replay its old callback after newer navigation',async()=>{
 const h=harness(campaign(),{commit({label,fn,revision,save,h}){save(label,fn,revision);h.savedCallback=fn;return new Promise(resolve=>{h.pending=resolve;});}});
 h.expenses.open('mortgage',{fresh:true});const arg=h.arg('expense-pay'),pending=h.expenses.action('expense-pay',arg);assert.equal(h.commits,1);assert.equal(h.expenses.open(),false);h.pending();await pending;assert.match(h.expenses.panel(),/Payment recorded/);
 await h.click('expense-back');await h.click('expense-open','mortgage');await h.expenses.action('expense-pay',arg);assert.equal(h.commits,1);assert.throws(()=>h.savedCallback(structuredClone(h.state())),/Campaign or editing ownership changed/);assert.equal(h.state().bank,'4899999');
});

test('fresh fixed-payment drafts retain an explicit read-only link to the last saved receipt',async()=>{
 for(const kind of ['mortgage','maintenance']){
  const h=harness();h.expenses.open(kind,{fresh:true});await h.click('expense-pay');const id=h.expenses.route().receiptId;await h.click('expense-back');await h.click('expense-open',kind);assert.match(h.expenses.panel(),/New payment draft/);await h.click('expense-receipt');assert.equal(h.expenses.route().receiptId,id);assert.match(h.expenses.panel(),/Payment recorded/);assert.equal(h.commits,1);assert.doesNotMatch(h.expenses.panel(),/expense-pay|expense-cancel/);
 }
});

test('a fully paid mortgage still links to its last receipt after returning through the table',async()=>{
 const s=campaign();s.ship.mortgage.remainingPayments=1;const h=harness(s);h.expenses.open('mortgage',{fresh:true});await h.click('expense-pay');await h.click('expense-back');await h.click('expense-open','mortgage');assert.match(h.expenses.panel(),/All scheduled mortgage payments are paid/);await h.click('expense-receipt');assert.match(h.expenses.panel(),/Payment recorded/);assert.doesNotMatch(h.expenses.panel(),/expense-pay/);assert.equal(h.commits,1);
});

test('every commit recalculates actual transaction state and refuses a changed displayed quote',async()=>{
 const h=harness(campaign(),{commit({label,fn,revision,save}){return save(label,s=>{s.ship.mortgage.payment='100002';fn(s);},revision);}});h.expenses.open('mortgage',{fresh:true});await assert.rejects(h.click('expense-pay'),/preview changed/);assert.equal(h.commits,0);assert.equal(h.state().bank,'5000000');
});

test('even enormous valid schedules stay bounded before their disclosure is opened',()=>{
 const s=campaign();s.bank='9000000000000000000000';s.ship.maintenance.payment='1';const h=harness(s);h.expenses.open('maintenance',{fresh:true});h.edit({payments:1000000000});const html=h.expenses.panel();
 assert.match(html,/data-payment-count="1000000000"/);assert.match(html,/<tbody><\/tbody>/);assert.ok(html.length<12000,'Initial render must not scale with installment count');
 const q=expenseQuote(s.worlds[s.actual],{kind:'maintenance',maintenancePayments:1000000000,recurringShip:s.ship});assert.ok(coveredExpensePayments(q).length<1000);assert.equal(latestExpenseReceipt(s,'maintenance'),null);
});
