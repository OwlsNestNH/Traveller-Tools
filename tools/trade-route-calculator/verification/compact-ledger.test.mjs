import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const renderer=app.slice(app.indexOf('function bankLedger(){'),app.indexOf('\nfunction accountsPanel(){'));
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>'Cr '+BigInt(value).toLocaleString('en-US');
function render(){
 const state={bank:'99820',dateLabel:'001-1105',lots:[],contracts:[],ledger:[
  {id:'opening',type:'Opening bank',amount:'100000',hours:0,world:'regina'},
  {id:'expense',type:'Manual expense',amount:'-250',hours:2,world:'regina',reason:'Port fees <test>'},
  {id:'deposit',type:'Manual deposit',amount:'75',hours:1,world:'regina',reason:'Refund'},
  {id:'legacy',eventId:'legacy-event',type:'Historical <type> & entry',amount:'-5',hours:3,world:'regina',reason:'Legacy audit'},
  {id:'zero',type:'Zero-cost activity',amount:'0',hours:4,world:'regina'}
 ]};
 const before=structuredClone(state),result={};
 runInNewContext(renderer+'\nbankLedger();',{
  state,A:{credit:BigInt},esc:escape,money,displayDate:(_label,hours)=>hours+'h',world:()=>({name:'Regina'}),good:()=>null,
  btn:(label,action,id,_mutates,style)=>'<button class="'+style+'" data-action="'+action+'" data-arg="'+id+'">'+label+'</button>',
  auditFacts:rows=>{result.totals=Array.from(rows,pair=>Array.from(pair));return '';},
  table:(headers,rows,className)=>{result.headers=Array.from(headers);result.rows=Array.from(rows);result.className=className;return rows.join('');},
  empty:()=>''
 });
 return {...result,state,before};
}

test('compact entry wrapper puts Details before escaped labels and preserves each original action',()=>{
 const {rows}=render();
 assert.match(rows[0],/<td><div class="ledger-entry"><button class="small" data-action="event-audit" data-arg="legacy-event">Details<\/button><span class="ledger-entry-label">Historical &lt;type&gt; &amp; entry<\/span><\/div><\/td>/);
 assert.match(rows[1],/<button class="small" data-action="ledger-audit" data-arg="deposit">Details<\/button><span class="ledger-entry-label">Manual deposit<\/span>/);
 assert.match(rows[2],/Port fees &lt;test&gt;/);
});

test('compact presentation leaves ledger order, all seven columns, amounts and campaign unchanged',()=>{
 const {rows,headers,className,totals,state,before}=render();
 assert.equal(className,'large-scroll bank-ledger');
 assert.deepEqual(headers,['Date/Time','Planet','Entry','Expenses','Deposit','Total Balance','Note']);
 assert.equal(rows.length,4,'Zero-cost entries retain their existing omission');
 assert.deepEqual(rows.map(row=>row.match(/data-arg="([^"]+)"/)[1]),['legacy-event','deposit','expense','opening']);
 for(const row of rows)assert.equal((row.match(/<td(?:>| )/g)||[]).length,7);
 assert.match(rows[0],/<td class="number bad">Cr 5<\/td><td class="number good">—<\/td><td class="number"><strong>Cr 99,820<\/strong>/);
 assert.match(rows[1],/<td class="number bad">—<\/td><td class="number good">Cr 75<\/td><td class="number"><strong>Cr 99,825<\/strong>/);
 assert.match(rows[2],/<td class="number bad">Cr 250<\/td><td class="number good">—<\/td><td class="number"><strong>Cr 99,750<\/strong>/);
 assert.deepEqual(totals,[['Total expenses','Cr 255'],['Total deposits (including opening funds)','Cr 100,075'],['Current balance','Cr 99,820']]);
 assert.deepEqual(state,before);
});
