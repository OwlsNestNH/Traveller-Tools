import {escapeHtml,formatCreditsText} from './display.mjs?v=shared-helpers-20261010-31';
import {passengerShip} from './passengers.mjs?v=shared-helpers-20261010-31';
import {credit} from './amounts.mjs';
import {expenseQuote,berthRate,starport,berthMultipliers,recurringExpenseDetails} from './expenses.mjs?v=shared-helpers-20261010-31';
import {monthlySupport,supportComplement} from './life-support.mjs?v=shared-helpers-20261010-31';
import {shipExpense,saveBerthingRate,uid} from './state.mjs?v=shared-helpers-20261010-31';
import {recordedPaymentDate} from './payment-schedule.mjs?v=shared-helpers-20261010-31';
import {creditStep} from './rounding.mjs?v=shared-helpers-20261010-31';
import {roll} from './rules.mjs?v=shared-helpers-20261010-31';

const esc=escapeHtml;
const money=formatCreditsText;
const labels={mortgage:'Mortgage',maintenance:'Monthly maintenance',salary:'Crew salaries',support:'Life support',fuel:'Fuel',berthing:'Port costs'};
const payableKinds=['mortgage','maintenance','salary','berthing'];
const fixed=kind=>kind==='mortgage'||kind==='maintenance';
const facts=rows=>'<dl class="expense-facts service-facts">'+rows.map(([name,value])=>'<dt>'+esc(name)+'</dt><dd>'+esc(value)+'</dd>').join('')+'</dl>';
const field=(name,label,value,extra='')=>`<label class="field">${esc(label)}<input name="${esc(name)}" type="number" value="${esc(value)}" ${extra}></label>`;

// MonthlySupport is the existing cabin/person billing calculator. A missing
// complement is unknown, even if the legacy billing helper could return zero.
export function expenseOverview(state){
 const ship=passengerShip(state),rows=[];
 for(const kind of ['mortgage','maintenance']){
  const value=ship[kind],complete=kind==='mortgage'&&value?.remainingPayments===0;
  rows.push({kind,label:labels[kind],amount:value?(complete?'0':value.payment):null,due:!value?'Not configured':complete?'All payments paid':value.nextDueDate});
 }
 const salary=ship.expenses?.salary;
 rows.push({kind:'salary',label:labels.salary,amount:salary===undefined?null:String(salary),due:'Manually selected'});
 const supportKnown=!!ship.accommodation&&supportComplement(ship).known;
 rows.push({kind:'support',label:labels.support,amount:supportKnown?String(monthlySupport(ship)):null,due:'As used'});
 rows.push({kind:'fuel',label:labels.fuel,amount:null,variable:true,due:'As needed'},{kind:'berthing',label:labels.berthing,amount:null,variable:true,due:'Weekly'});
 const recurring=rows.filter(row=>!row.variable),missing=recurring.filter(row=>row.amount===null).map(row=>row.label);
 return {rows,total:String(recurring.reduce((sum,row)=>sum+(row.amount===null?0n:credit(row.amount)),0n)),missing};
}

// The application's shared covered-payments toggle renderer fills these rows
// in 100-row animation-frame batches. No installment-count-sized array or loop
// runs while preparing, updating, paying, or recovering this payment screen.
export function coveredExpensePayments(expense){
 const q=expense.mortgage||expense.maintenance;if(!q)return '';
 return `<details class="covered-payments" data-payment-first="${esc(q.firstDueDate)}" data-payment-count="${q.periods}" data-payment-amount="${esc(q.before.payment)}" data-payment-rendered="0"><summary>${q.periods} installment${q.periods===1?'':'s'} covered</summary><div class="covered-payments-scroll"><table><thead><tr><th scope="col">Due date</th><th scope="col">Amount</th></tr></thead><tbody></tbody></table></div></details>`;
}

export function latestExpenseReceipt(state,kind,receiptId){
 if(receiptId)return state.ledger.find(entry=>entry.id===receiptId&&entry.expense?.kind===kind)||null;
 for(let i=state.ledger.length-1;i>=0;i--)if(state.ledger[i].expense?.kind===kind)return state.ledger[i];
 return null;
}

/**
 * Pure navigation and unsaved inputs remain local to this controller.
 * open(kind) recovers a saved receipt; an explicit table-name action opens a
 * fresh draft. Persist route() / onNavigate to recover a particular receipt.
 * The host must forward each rendered data-arg unchanged to action().
 */
export function createExpensePanels({document,getState,isEditable,commit,render,showOverview,message=()=>{},openService,showSettings,onNavigate=()=>{},rollDie=()=>roll(1).total}){
 let session=null;
 const active=()=>!!session;
 const route=()=>session?{kind:session.kind,...(session.mode==='receipt'?{receiptId:session.receiptId}:{})}:null;
 const notify=()=>onNavigate(route());
 const button=(text,action,value='',primary=false,disabled=false)=>`<button type="button" data-action="${action}" data-arg="${esc(session.token+':'+value)}" class="${primary?'primary':''}"${disabled?' disabled':''}>${esc(text)}</button>`;
 function open(kind='expenses',{fresh=false,receiptId}={}){
  if(session?.busy){message('Wait for the current expense to finish saving.');return false;}
  if(!['expenses',...payableKinds,'fuel','support'].includes(kind))throw Error('Choose a ship expense.');
  if(kind==='fuel'||kind==='support'){
   if(typeof openService!=='function')throw Error('Ship service navigation is unavailable.');
   // A rejected destination (for example read-only fuel or empty-space
   // supplies) must leave the existing panel and its navigation token usable.
   const previous=session;openService(kind);
   if(session===previous)close({render:false});return;
  }
  const base=structuredClone(getState());
  if(!base.initialized||!base.worlds[base.actual])throw Error('Set up a campaign first.');
  const receipt=kind!=='expenses'&&!fresh?latestExpenseReceipt(base,kind,receiptId):null;
  session={kind,token:uid(),mode:receipt?'receipt':receiptId?'missing-receipt':kind==='expenses'?'summary':'draft',receiptId:receipt?.id??receiptId,base,revision:base.revision,world:base.worlds[base.actual],editable:isEditable(),busy:false,invalidated:false,error:'',draft:{payments:'1',monthly:base.ship.expenses?.salary??'',weeks:'1'}};
  notify();showOverview();render();
  if(document.defaultView?.matchMedia?.('(max-width:1099px)').matches)document.getElementById('expense-panel')?.scrollIntoView({block:'start',behavior:'instant'});
 }
 function stale(current=session){
  if(!current)return true;
  const now=getState(),changed=!current.editable||!isEditable()||current.revision!==now.revision||current.base.actual!==now.actual;
  if(changed&&!current.busy)current.invalidated=true;
  return current.invalidated||changed;
 }
 function status(){
  if(!session||session.mode!=='draft')return '';
  if(stale())return !session.editable?'This tab is read-only. Take over editing, then return to Expenses and reopen this payment.':'Campaign or editing ownership changed. Return to Expenses and reopen this payment with current values.';
  return session.error;
 }
 function inputFor(current,state=current.base){
  const {kind,draft}=current;
  return {kind,creditStep:creditStep(state),recurringShip:state.ship,...(fixed(kind)?{[kind+'Payments']:draft.payments}:kind==='salary'?{monthly:draft.monthly,months:draft.payments}:{weeks:draft.weeks})};
 }
 function quote(current=session,state=current.base){
  const input=inputFor(current,state),q=expenseQuote(state.worlds[state.actual],input);
  if(credit(q.amount)>credit(state.bank))throw Error('Insufficient funds for this payment.');
  return {input,expense:q};
 }
 function forecast(){
  try{return {...quote(),valid:true};}catch(error){return {valid:false,error:error.message};}
 }
 function details(expense){
  return `<details class="expense-audit service-audit"><summary>${expense.kind==='mortgage'?'Mortgage details / audit':expense.kind==='maintenance'?'Maintenance details / audit':'Calculation / audit'}</summary>${facts(recurringExpenseDetails(expense))}<p class="help rule-footnote">${esc(expense.reference)}</p></details>`;
 }
 function overview(){
  const s=getState(),q=expenseOverview(s);
  return `<h2>Expenses</h2><h3>${esc(s.ship.name)}</h3><p class="help">Recurring costs use a 4-week (28-day) month. Select an expense name to open its controls.</p><table class="expense-table"><thead><tr><th scope="col">Expense</th><th scope="col" class="number">4-week cost</th><th scope="col">Next due</th></tr></thead><tbody>${q.rows.map(row=>'<tr><th scope="row">'+button(row.label+' ›','expense-open',row.kind).replace('class=""','class="expense-name"')+'</th><td class="number">'+esc(row.variable?'Variable':row.amount===null?'Not configured':money(row.amount))+'</td><td>'+esc(row.due)+'</td></tr>').join('')}</tbody><tfoot><tr><th scope="row">Regular 4-week total</th><td class="number">${money(q.total)}</td><td>${q.missing.length?'Partial total':''}</td></tr></tfoot></table><p class="help">Variable costs are excluded.${q.missing.length?' Not configured and excluded: '+esc(q.missing.join(', '))+'.':''}</p><p class="help">Payments are recorded only when you select Pay. Opening an expense changes only this view.</p>`;
 }
 function previewMarkup(f){
  if(!f.valid)return '<p class="notice" role="alert">'+esc(f.error)+'</p>';
  const q=f.expense,schedule=q.mortgage||q.maintenance;
  const rows=schedule?[['Next unpaid due',q.kind==='mortgage'&&!schedule.after.remainingPayments?'None · all scheduled payments paid':schedule.after.nextDueDate]]:q.kind==='salary'?[['Payments selected',session.draft.payments+' × 4 weeks']]:[['Weeks selected',session.draft.weeks]];
  return coveredExpensePayments(q)+facts([...rows,['Cash remaining after payment',money(String(credit(session.base.bank)-credit(q.amount)))]])+`<div class="expense-total service-total"><span>Total to pay</span><strong>${money(q.amount)}</strong></div>`+details(q);
 }
 function form(){
  const {kind,base,draft}=session,m=base.ship[kind];
  const previous=fixed(kind)?latestExpenseReceipt(getState(),kind):null;
  const previousMarkup=previous?'<p class="help">'+(m&&(kind!=='mortgage'||m.remainingPayments)?'New payment draft · ':'')+button('View last payment','expense-receipt',previous.id)+'</p>':'';
  if(fixed(kind)&&!m)return previousMarkup+'<p class="notice">'+esc(labels[kind])+' is not configured.</p><p class="help">Enter the fixed cost and next unpaid due date in Settings before paying.</p>'+button('Set up '+labels[kind].toLowerCase()+' in Settings','expense-settings',kind,false,!isEditable());
  if(kind==='mortgage'&&!m.remainingPayments)return previousMarkup+'<p class="notice">All scheduled mortgage payments are paid.</p><details class="expense-audit"><summary>Mortgage details / audit</summary>'+facts([['Original mortgage amount',money(m.originalAmount)],['Payments remaining','0'],['Total paid',money(m.totalPaid)]])+'</details>';
  const disabled=stale(),extra=disabled?' disabled':'';
  let fields;
  if(fixed(kind))fields=facts([['Fixed cost / 4 weeks',money(m.payment)],['First unpaid due',m.nextDueDate]])+field('payments','Number of payments',draft.payments,`min="1" step="1" required${kind==='mortgage'?' max="'+m.remainingPayments+'"':''}${extra}`);
  else if(kind==='salary')fields=field('monthly','Crew salaries · Cr / 4 weeks',draft.monthly,'min="1" step="1" required'+extra)+field('payments','Number of payments',draft.payments,'min="1" step="1" required'+extra)+'<p class="help">The entered monthly salary is saved only when this payment is recorded.</p>';
  else{
   let rate;
   try{rate=berthRate(session.world);}catch(error){
    const port=starport(session.world),canRoll=!!berthMultipliers[port]&&!session.world.emptySpace;
    return '<p class="notice">'+esc(session.world.emptySpace?'No berthing in empty space.':error.message)+'</p>'+(canRoll?button('Roll and save starport rate','expense-berthing-rate','',false,disabled||session.busy)+'<p class="help">This explicitly saves one 1D rate for this starport in History. No payment is made.</p>':'');
   }
   fields=facts([['Starport',session.world.name+' · '+rate.port],['Saved weekly rate',money(rate.weekly)],['Saved 1D roll',rate.die??'No roll required']])+field('weeks','Weeks to pay',draft.weeks,'min="1" step="1" required'+extra);
  }
  const f=forecast();
  return previousMarkup+'<form id="expense-form" data-expense-session="'+esc(session.token)+'">'+fields+'</form><div id="expense-quote" aria-live="polite">'+previewMarkup(f)+'</div><div class="expense-actions service-actions">'+button('Cancel','expense-cancel')+button(f.valid?'Pay '+money(f.expense.amount):'Pay','expense-pay','',true,disabled||!f.valid||session.busy)+'</div><p class="help">'+(session.busy?'Saving payment…':'Only Pay records the displayed payment. Back or Cancel discards unsaved changes.')+'</p>';
 }
 function receipt(){
  const entry=latestExpenseReceipt(getState(),session.kind,session.receiptId);
  if(!entry)return '<p class="notice" role="status">This saved payment is no longer in the ledger. It may have been undone or the campaign replaced. Return to Expenses to use the current campaign.</p>';
  const q=entry.expense,schedule=q.mortgage||q.maintenance;
  const rows=[['Paid amount',money(q.amount)],['Paid on',recordedPaymentDate(getState(),entry)]];
  if(schedule){rows.push(['Payments recorded',String(schedule.periods)],['Next unpaid due',q.kind==='mortgage'&&!schedule.after.remainingPayments?'None · all scheduled payments paid':schedule.after.nextDueDate]);if(q.kind==='mortgage')rows.push(['Payments remaining',String(schedule.after.remainingPayments)]);}
  return '<section class="expense-receipt" role="status" data-receipt-id="'+esc(entry.id)+'"><h3>✓ Payment recorded</h3>'+facts(rows)+'</section>'+coveredExpensePayments(q)+details(q);
 }
 function panel(){
  if(!session)return '';
  const summary=session.mode==='summary',receiptMode=['receipt','missing-receipt'].includes(session.mode),notice=status();
  const saved=receiptMode?latestExpenseReceipt(getState(),session.kind,session.receiptId):null;
  // Receipts describe where the saved transaction happened, never the ship's
  // current position. Legacy records without a resolvable location stay unknown.
  const location=receiptMode?'Recorded location: '+(saved?.expense?.worldName||getState().worlds[saved?.world]?.name||'Not recorded'):'Actual ship location: '+session.world.name;
  return `<aside id="expense-panel" class="panel world-screen expense-panel" aria-label="Ship expenses"><div class="screen-topline"><span>● Ship expenses</span><span>${summary?'Summary':receiptMode?'Receipt':'Payment'}</span></div>${button(summary?'← Back to world data':'← Back to Expenses',summary?'expense-close':'expense-back')}${summary?overview():`<h2>${esc(labels[session.kind])}${session.kind==='mortgage'?' payment':''}</h2><p class="help">${esc(session.base.ship.name)} · ${esc(location)}</p><p id="expense-status" class="notice" role="alert" ${notice?'':'hidden'}>${esc(notice)}</p>${receiptMode?receipt():form()}`}</aside>`;
 }
 function sync(){
  if(!session||session.mode!=='draft'||session.busy)return;
  const form=document.getElementById('expense-form');
  if(form&&form.dataset?.expenseSession===session.token&&!stale()){
   let changed=false;
   for(const el of form.elements)if(Object.hasOwn(session.draft,el.name)&&session.draft[el.name]!==el.value){session.draft[el.name]=el.value;changed=true;}
   if(changed){session.error='';const box=document.getElementById('expense-quote');if(box)box.innerHTML=previewMarkup(forecast());}
  }
  syncControls();
 }
 function syncControls(){
  if(!session||session.mode!=='draft')return;
  const invalid=stale(),f=forecast(),notice=status();
  document.querySelectorAll('#expense-panel [data-action="expense-pay"]').forEach(el=>{el.disabled=invalid||!f.valid||session.busy;el.textContent=f.valid?'Pay '+money(f.expense.amount):'Pay';});
  document.querySelectorAll('#expense-panel input,#expense-panel select,#expense-panel [data-action="expense-berthing-rate"],#expense-panel [data-action="expense-settings"]').forEach(el=>el.disabled=invalid||session.busy);
  const node=document.getElementById('expense-status');if(node){node.textContent=notice;node.hidden=!notice;}
 }
 function close(options={}){if(session?.busy){message('Wait for the current expense to finish saving.');return false;}session=null;notify();if(options.render!==false)render();return true;}
 function assertCurrent(current,state=getState()){
  if(session!==current||current.mode!=='draft'||stale(current)||state.revision!==current.revision||state.actual!==current.base.actual||state.hours!==current.base.hours||state.dateLabel!==current.base.dateLabel)throw Error('Campaign or editing ownership changed. Return to Expenses and reopen this payment with current values.');
 }
 async function savePayment(current){
  assertCurrent(current);const preview=quote(current),draft=structuredClone(current.draft);let entryId,applied=false;
  current.busy=true;current.error='';syncControls();
  try{
   await commit('Paid '+labels[current.kind].toLowerCase(),s=>{
    assertCurrent(current,s);if(applied)throw Error('This payment callback has already been used.');
    // Recalculate against the transaction's actual state, never a preview copy.
    const fresh=quote({...current,draft},s);
    if(JSON.stringify(fresh.expense)!==JSON.stringify(preview.expense)||s.bank!==current.base.bank)throw Error('Payment preview changed. Return to Expenses and reopen it.');
    applied=true;shipExpense(s,fresh.input);
    const entry=s.ledger.at(-1);entry.paidAt??={dateLabel:s.dateLabel,hours:s.hours};entryId=entry.id;
   },current.revision);
   if(!entryId||!latestExpenseReceipt(getState(),current.kind,entryId))throw Error('Payment was not saved. Check the campaign ledger before trying again.');
   if(session===current){current.mode='receipt';current.receiptId=entryId;current.base=structuredClone(getState());current.revision=current.base.revision;current.invalidated=false;notify();render();}
  }catch(error){if(session===current){current.error=error.message;render();}throw error;}
  finally{current.busy=false;if(session===current)syncControls();}
 }
 async function saveRate(current){
  assertCurrent(current);let applied=false;const die=rollDie();current.busy=true;current.error='';syncControls();
  try{
   await commit('Saved starport berthing rate',s=>{assertCurrent(current,s);if(applied)throw Error('This rate callback has already been used.');applied=true;saveBerthingRate(s,die);},current.revision);
   const saved=getState();if(saved.worlds[current.base.actual]?.berthingRate?.die!==die||saved.revision!==current.revision+1)throw Error('Berthing rate was not saved. Reopen Expenses to check the current rate.');
   if(session===current){current.base=structuredClone(saved);current.revision=saved.revision;current.world=current.base.worlds[saved.actual];current.invalidated=false;message('Starport berthing rate saved.');render();}
  }catch(error){if(session===current){current.error=error.message;render();}throw error;}
  finally{current.busy=false;if(session===current)syncControls();}
 }
 async function action(name,arg){
  if(!name.startsWith('expense-'))return false;
  if(!session||typeof arg!=='string'||!arg.startsWith(session.token+':'))return true;
  const value=arg.slice(session.token.length+1),current=session;
  if(current.busy)return true;
  if(name==='expense-close'){close();return true;}
  if(name==='expense-back'||name==='expense-cancel'){open('expenses');return true;}
  if(name==='expense-open'){open(value,{fresh:true});return true;}
  if(name==='expense-receipt'){open(current.kind,{receiptId:value});return true;}
  if(current.mode!=='draft'||current.busy)return true;
  if(name==='expense-settings'){
   assertCurrent(current);if(typeof showSettings!=='function')throw Error('Open Settings to configure '+labels[current.kind].toLowerCase()+'.');
   close({render:false});showSettings(current.kind);return true;
  }
  assertCurrent(current);sync();
  if(name==='expense-pay')await savePayment(current);
  else if(name==='expense-berthing-rate'&&current.kind==='berthing')await saveRate(current);
  return true;
 }
 return {active,open,panel,sync,syncControls,action,close,route,committing:()=>!!session?.busy};
}
