import {ruleInfo} from './rule-references.mjs?v=modal-entry-20261011-51';
import {escapeHtml,formatCreditsText} from './display.mjs?v=modal-entry-20261011-51';
import {passengerShip} from './passengers.mjs?v=modal-entry-20261011-51';
import {credit} from './amounts.mjs';
import {expenseQuote,berthRate,starport,berthMultipliers,recurringExpenseDetails} from './expenses.mjs?v=modal-entry-20261011-51';
import {monthlySupport,supportComplement} from './life-support.mjs?v=modal-entry-20261011-51';
import {shipExpense,saveBerthingRate,uid} from './state.mjs?v=modal-entry-20261011-51';
import {recordedPaymentDate} from './payment-schedule.mjs?v=modal-entry-20261011-51';
import {creditStep} from './rounding.mjs?v=modal-entry-20261011-51';
import {roll} from './rules.mjs?v=modal-entry-20261011-51';
import {SaveCommittedPublicationError} from './persistence.mjs?v=modal-entry-20261011-51';

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
export function createExpensePanels({document,getState,isEditable,commit,render,showOverview,message=()=>{},openService,showSettings,onNavigate=()=>{},rollDie=()=>roll(1).total,onTerminalFailure=()=>{},onComplete=()=>{},canRetry=()=>true,captureContext=()=>()=>true}){
 let session=null,operation=null,generation=0,reloadMessage='';
 const active=()=>!!session;
 const route=()=>session?{kind:session.kind,...(session.mode==='receipt'?{receiptId:session.receiptId}:{})}:null;
 const notify=()=>onNavigate(route());
 const button=(text,action,value='',primary=false,disabled=false)=>`<button type="button" data-action="${action}" data-arg="${esc(session.token+':'+value)}" class="${primary?'primary':''}"${disabled?' disabled':''}>${esc(text)}</button>`;
 function open(kind='expenses',{fresh=false,receiptId}={}){
  if(session?.busy){message('Wait for the current expense to finish saving.');return false;}
  if(reloadMessage)throw Error(reloadMessage);
  if(!['expenses',...payableKinds,'fuel','support'].includes(kind))throw Error('Choose a ship expense.');
  if(kind==='fuel'||kind==='support'){
   if(typeof openService!=='function')throw Error('Ship service navigation is unavailable.');
   // A rejected destination (for example read-only fuel or empty-space
   // supplies) must leave the existing panel and its navigation token usable.
   const previous=session;openService(kind);
   if(session===previous)close({render:false});return;
  }
  const campaign=getState(),base=structuredClone(campaign);
  if(!base.initialized||!base.worlds[base.actual])throw Error('Set up a campaign first.');
  const receipt=kind!=='expenses'&&!fresh?latestExpenseReceipt(base,kind,receiptId):null;
  session={kind,token:uid(),mode:receipt?'receipt':receiptId?'missing-receipt':kind==='expenses'?'summary':'draft',receiptId:receipt?.id??receiptId,campaign,base,revision:base.revision,world:base.worlds[base.actual],editable:isEditable(),busy:false,invalidated:false,error:'',draft:{payments:'1',monthly:base.ship.expenses?.salary??'',weeks:'1'}};
  const opened=session;notify();if(session!==opened)return;showOverview();if(session!==opened)return;render();if(session!==opened)return;
  if(document.defaultView?.matchMedia?.('(max-width:1099px)').matches)document.getElementById('expense-panel')?.scrollIntoView({block:'start',behavior:'instant'});
 }
 function invalidate(){
  if(session)session.invalidated=true;
  if(operation){operation.invalidated=true;operation.publicationDeferred=false;}
 }
 // The host has already consumed the controller's one-use publication token.
 // A matching revision, receipt or die is never a substitute for that proof.
 function receiveCampaign(next,local){
  const owner=operation;
  if(local&&owner?.pending&&owner.prepared&&!owner.publication&&next.revision===owner.revision+1){
   owner.publication=next;
   owner.publicationDeferred=!owner.invalidated&&session===owner.session&&owner.context();
   return true;
  }
  invalidate();return false;
 }
 function stale(current=session){
  if(!current)return true;
  const now=getState(),owner=current.operation,expected=owner?.publication||current.campaign;
  const changed=!!reloadMessage||!current.editable||!isEditable()||now!==expected||now.revision!==(owner?.publication?.revision??current.revision)||current.base.actual!==now.actual;
  // Editing loss is permanent even if it is observed during an owned save.
  if(changed){current.invalidated=true;if(owner){owner.invalidated=true;owner.publicationDeferred=false;}}
  return current.invalidated||changed;
 }
 function status(){
  if(!session)return '';
  if(session.terminal)return reloadMessage;
  if(session.mode!=='draft')return '';
  if(stale())return session.staleReason||(!session.editable?'This tab is read-only. Take over editing, then return to Expenses and reopen this payment.':'Campaign or editing ownership changed. Return to Expenses and reopen this payment with current values.');
  if(session.busy)return 'Saving this expense. Wait for confirmation before continuing.';
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
  return `<details class="expense-audit service-audit"><summary>${expense.kind==='mortgage'?'Mortgage details / audit':expense.kind==='maintenance'?'Maintenance details / audit':'Calculation / audit'} ${ruleInfo(expense.kind)}</summary>${facts(recurringExpenseDetails(expense))}<p class="help rule-footnote">${esc(expense.reference)}</p></details>`;
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
   if(changed){session.intent=null;session.error='';const box=document.getElementById('expense-quote');if(box)box.innerHTML=previewMarkup(forecast());}
  }
  syncControls();
 }
 function syncControls(){
  const current=session;if(!current||current.mode!=='draft')return;
  const token=current.token,owner=current.operation,context=captureContext(),same=()=>session===current&&current.token===token&&current.operation===owner&&context();
  const invalid=stale(),f=forecast(),notice=status();
  for(const el of document.querySelectorAll('#expense-panel [data-action="expense-pay"]')){
   if(!same())return;el.disabled=invalid||!f.valid||current.busy;
   if(!same())return;el.textContent=f.valid?'Pay '+money(f.expense.amount):'Pay';
  }
  if(!same())return;
  for(const el of document.querySelectorAll('#expense-panel input,#expense-panel select,#expense-panel [data-action="expense-berthing-rate"],#expense-panel [data-action="expense-settings"]')){if(!same())return;el.disabled=invalid||current.busy;}
  if(!same())return;
  const node=document.getElementById('expense-status');if(node&&same()){node.textContent=notice;if(same())node.hidden=!notice;}
 }
 function close(options={}){if(session?.busy){message('Wait for the current expense to finish saving.');return false;}session=null;const context=captureContext();notify();if(!session&&context()&&options.render!==false)render();return true;}
 function assertCurrent(current,state=getState()){
  if(session!==current||current.mode!=='draft'||stale(current)||state.revision!==current.revision||state.actual!==current.base.actual||state.hours!==current.base.hours||state.dateLabel!==current.base.dateLabel)throw Error('Campaign or editing ownership changed. Return to Expenses and reopen this payment with current values.');
 }
 function ownerCurrent(owner){
  const current=owner.session,expected=owner.publication||owner.campaign;
  const valid=operation===owner&&session===current&&current.operation===owner&&!owner.invalidated&&!current.invalidated&&!current.terminal&&!reloadMessage&&isEditable()&&owner.context()&&getState()===expected&&expected.revision===(owner.publication?owner.revision+1:owner.revision);
  if(!valid){owner.invalidated=true;owner.publicationDeferred=false;if(current.operation===owner)current.invalidated=true;}
  return valid;
 }
 function publicationDeferred(){
  const owner=operation;if(!owner?.publicationDeferred||owner.invalidated)return false;
  // receiveCampaign records the owner before installing next. A reentrant
  // paint in that narrow handoff must not compare next with the old state.
  if(session===owner.session&&owner.session.operation===owner&&isEditable()&&owner.context())return true;
  owner.invalidated=true;owner.publicationDeferred=false;if(owner.session.operation===owner)owner.session.invalidated=true;
  return false;
 }
 function release(owner){
  owner.pending=false;owner.publicationDeferred=false;
  if(owner.session.operation===owner)owner.session.busy=false;
 }
 function terminalFailure(owner,error){
  if(owner.publication)error=new SaveCommittedPublicationError(owner.publication.revision,error);
  const committed=error?.code==='SAVE_COMMITTED_PUBLICATION_FAILED'&&error.committed===true&&Number.isSafeInteger(error.revision),name=owner.kind==='rate'?'Berthing rate':'Payment';
  const guidance=committed?name+' saved, but the display could not update. Reload this page before continuing; do not record this '+name.toLowerCase()+' again.':'The '+name.toLowerCase()+' save outcome could not be confirmed. Reload this page and check History before trying again.';
  const report=()=>session===owner.session&&owner.session.operation===owner&&owner.context();
  // Both guards precede role callbacks, reporting, rendering and control work.
  reloadMessage=guidance;owner.invalidated=true;owner.session.terminal=true;owner.session.invalidated=true;owner.session.error=guidance;release(owner);
  try{onTerminalFailure(error,guidance,report);}catch{/* The terminal latch must survive a failed host notification. */}
  try{if(report())render();}catch{/* Reload is already required. */}
  return false;
 }
 function fail(owner,error){
  const known=!owner.submitted||(error?.code==='SAVE_NOT_COMMITTED'&&error.committed===false&&!owner.publication);
  release(owner);
  if(!known)return terminalFailure(owner,error);
  // Only an unchanged, still-owned, demonstrably unwritten attempt can retry.
  // Its prepared input/die remains in the session; obsolete callbacks remain used.
  if(!ownerCurrent(owner))return false;
  if(owner.submitted){
   let unchanged=false,checked=false;try{unchanged=canRetry(owner.campaign)===true;checked=true;}catch{/* An unreadable baseline cannot authorize a retry. */}
   if(!ownerCurrent(owner))return false;
   if(!unchanged){
    owner.invalidated=true;owner.session.invalidated=true;
    reloadMessage='This expense was not saved. '+(checked?'The saved campaign no longer matches this draft.':'The saved campaign could not be checked.')+' Reload this page before reopening Expenses with current values.';
    owner.session.staleReason=reloadMessage;
    try{if(session===owner.session&&owner.context())render();}catch{/* The draft remains permanently retired. */}
    return false;
   }
  }
  owner.session.error=error.message;
  try{render();if(ownerCurrent(owner))syncControls();}catch{/* No provider write occurred; keep Back/Close and deliberate retry usable. */}
  if(ownerCurrent(owner))throw error;
  return false;
 }
 function finish(owner){
  try{
   const published=owner.publication,current=owner.session;
   if(!published||published.revision!==owner.revision+1)throw Error('Expense save completion did not publish the expected campaign.');
   if(!ownerCurrent(owner)){release(owner);return false;}
   if(owner.kind==='payment'&&!latestExpenseReceipt(published,current.kind,owner.entryId))throw Error('The saved payment receipt is missing.');
   if(owner.kind==='rate'&&published.worlds[owner.campaign.actual]?.berthingRate?.die!==owner.intent.die)throw Error('The saved berthing rate is missing.');
   const base=structuredClone(published);
   if(!ownerCurrent(owner))return false;
   current.campaign=published;current.base=base;current.revision=published.revision;current.world=base.worlds[base.actual];current.intent=null;current.error='';
   // A completed rate and its subsequent payment have different DOM actions.
   // Replaying a detached rate button cannot reroll or start a second write.
   current.token=uid();
   if(owner.kind==='payment'){current.mode='receipt';current.receiptId=owner.entryId;}
   release(owner);
   onComplete();if(!ownerCurrent(owner))return false;
   notify();if(!ownerCurrent(owner))return false;
   render();if(!ownerCurrent(owner))return false;
   syncControls();if(!ownerCurrent(owner))return false;
   message(owner.kind==='rate'?'Starport berthing rate saved.':'Paid '+labels[current.kind].toLowerCase()+' saved.');
   return true;
  }catch(error){return fail(owner,error);}
  finally{release(owner);}
 }
 function save(current,kind,intent){
  assertCurrent(current);
  const owner={session:current,kind,intent,campaign:current.campaign,revision:current.revision,context:captureContext(),pending:true,submitted:false,prepared:false,applied:false,invalidated:false,publication:null,publicationDeferred:false};
  operation=owner;current.operation=owner;current.intent=intent;current.busy=true;current.error='';generation++;
  let result;
  try{
   // Control entry can throw too. It is contained before calling the provider.
   syncControls();if(!ownerCurrent(owner))throw Error('Campaign or editing ownership changed. Reopen this expense.');
   owner.submitted=true;
   result=commit(kind==='rate'?'Saved starport berthing rate':'Paid '+labels[current.kind].toLowerCase(),s=>{
    assertCurrent(current,s);if(!ownerCurrent(owner)||owner.applied)throw Error('Campaign or editing ownership changed. This expense callback cannot be reused.');
    owner.applied=true;
    if(kind==='rate'){
     if(starport(s.worlds[s.actual])!==intent.port||s.worlds[s.actual].emptySpace)throw Error('Starport changed. Return to Expenses and reopen this rate.');
     saveBerthingRate(s,intent.die);
    }
    else{
     // Recalculate against the transaction's actual state, never a preview copy.
     const fresh=quote({...current,draft:intent.draft},s);
     if(JSON.stringify(fresh.expense)!==JSON.stringify(intent.expense)||s.bank!==owner.campaign.bank)throw Error('Payment preview changed. Return to Expenses and reopen it.');
     shipExpense(s,fresh.input);
     const entry=s.ledger.at(-1);entry.paidAt??={dateLabel:s.dateLabel,hours:s.hours};owner.entryId=entry.id;
    }
   },owner.revision,{announce:false,onPrepared:()=>{if(!ownerCurrent(owner))throw Error('Campaign or editing ownership changed. Reopen this expense.');owner.prepared=true;}});
   // Native Store completion remains in this stack. Only thenables yield.
   if(result&&typeof result.then==='function')return Promise.resolve(result).then(()=>finish(owner),error=>fail(owner,error));
  }catch(error){return fail(owner,error);}
  return finish(owner);
 }
 function savePayment(current){
  assertCurrent(current);
  const intent=current.intent?.kind==='payment'?current.intent:{kind:'payment',draft:structuredClone(current.draft),expense:quote(current).expense};
  return save(current,'payment',intent);
 }
 function saveRate(current){
  assertCurrent(current);
  const world=current.base.worlds[current.base.actual],port=starport(world);
  // Reject an obsolete action before consuming randomness, even if its DOM
  // token was retained by an embedding host after the rate was already saved.
  if(world.emptySpace||!berthMultipliers[port]||world.berthingRate?.port===port)return false;
  const intent=current.intent?.kind==='rate'?current.intent:{kind:'rate',port,die:rollDie()};
  return save(current,'rate',intent);
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
   const context=captureContext();close({render:false});if(!session&&context())showSettings(current.kind);return true;
  }
  assertCurrent(current);sync();
  if(name==='expense-pay')await savePayment(current);
  else if(name==='expense-berthing-rate'&&current.kind==='berthing')await saveRate(current);
  return true;
 }
 return {active,open,panel,sync,syncControls,action,close,route,invalidate,receiveCampaign,publicationDeferred,writeGeneration:()=>generation,committing:()=>!!session?.busy};
}
