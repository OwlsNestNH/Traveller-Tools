import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {join} from 'node:path';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const artifacts=fileURLToPath(new URL('../verification-artifacts/',import.meta.url));await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true}),base=process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/';
function fixture({unknown=false,long=false,backdatedVisit=false}={}){
 const f=guiFixture(),s=f.state,w=s.actual;
 const entry=(id,type,amount,day,note)=>({id,type,amount,hours:(day-1)*24+(day===66?23:0),world:w,reason:note});
 s.dateLabel='001-1105';s.hours=66*24-1;s.bank='117000';
 s.ledger=[entry('account-opening','Opening bank','100000',1,'Starting campaign funds'),entry('account-freight','Freight delivery','15000',60,'Freight income'),entry('account-fuel','Manual expense','-5000',61,'Fuel purchase'),entry('account-fare','Manual deposit','10000',64,'Passenger fares'),entry('account-port','Manual expense','-3000',66,'PRIVATE_NOTE <img src=x onerror=alert(1)>')];
 s.events=[{id:'account-setup',label:'Campaign setup',world:w,hours:0}];
 if(unknown)s.ledger.shift();
 if(long){for(let i=0;i<48;i++)s.ledger.push(entry('long-'+i,'Manual deposit','1',66,'Long synthetic transaction '+i+' - '+('Recorded accounting detail with wrapping and safe text. '.repeat(3))));const huge='9999999999999999999999999999999999999999';s.ledger.push(entry('huge-in','Manual deposit',huge,66,'Exact large credit'),entry('huge-out','Manual expense','-'+huge,66,'Exact large debit'));s.bank='117048';}
 if(backdatedVisit){s.hours=144;s.bank='100010';s.ledger=[s.ledger[0],{id:'arrival',type:'Jump',amount:'0',hours:168,world:w,from:'previous-world',to:w,eventId:'arrival-event'},{id:'backdated',type:'Manual deposit',amount:'10',hours:144,world:w}];s.events.push({id:'arrival-event',label:'Jump audit',from:'previous-world',to:w,hours:168});}
 return f;
}
async function open(width,options={}){
 const f=fixture(options),bytes=JSON.stringify(f.state),context=await browser.newContext({viewport:{width,height:1000}});
 await context.addInitScript(({key,bytes})=>localStorage.setItem(key,bytes),{key:campaignKey,bytes});
 await context.route('https://travellermap.com/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
 const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto(base);await page.getByText('Editing in this tab',{exact:true}).waitFor();await page.locator('#tabs [data-arg=Accounts]').click();
 return {page,context,bytes,raw:()=>page.evaluate(k=>localStorage.getItem(k),campaignKey)};
}
const values=p=>p.locator('#accounting-summary .value').allTextContents();
async function range(p,from='060-1105',to='066-1105'){await p.locator('#accounting-from').fill(from);await p.locator('#accounting-to').fill(to);await p.getByRole('button',{name:'Apply',exact:true}).click();}
async function preview(page,context){const pending=context.waitForEvent('page');await page.getByRole('button',{name:'Preview PDF',exact:true}).click();const popup=await pending;await popup.getByRole('heading',{name:'Accounting report',exact:true}).waitFor();return popup;}
async function savePdf(page,path){const viewport=page.viewportSize();await page.setViewportSize({width:1032,height:703});await page.emulateMedia({media:'print'});await page.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await page.pdf({path,format:'A4',landscape:true,printBackground:true});await page.emulateMedia({media:'screen'});await page.setViewportSize(viewport);}
try{
 for(const width of [1440,390,320]){
  const {page:p,context,bytes,raw}=await open(width);try{
   assert.deepEqual(await values(p),['Cr 0','Cr 125,000','Cr 8,000','Cr 117,000']);assert.equal(await p.locator('.bank-ledger tbody tr').count(),5);
   for(const name of ['Ship expenses','Record expense','Record deposit','Referee bank correction','Export report (TXT)','Save campaign (JSON)'])assert.equal(await p.getByRole('button',{name,exact:true}).count(),1);
   for(const b of await p.locator('.accounting-period button,.accounting-pdf button').all()){assert.equal(await b.getAttribute('data-mutate'),null);const r=await b.boundingBox();assert.ok(r.height>=44&&r.x>=0&&r.x+r.width<=width+1);}
   await p.locator('#accounting-from').fill('060-1105');assert.equal(await p.getByRole('button',{name:'Preview PDF',exact:true}).isDisabled(),true);await p.locator('#accounting-to').fill('059-1105');await p.getByRole('button',{name:'Apply',exact:true}).click();await p.locator('#accounting-error').filter({hasText:'From must be on or before To'}).waitFor();assert.match(await p.locator('#accounting-active').textContent(),/All dates/);assert.equal(await p.locator('.bank-ledger tbody tr').count(),5);assert.equal(await raw(),bytes);
   await range(p);assert.deepEqual(await values(p),['Cr 100,000','Cr 25,000','Cr 8,000','Cr 117,000']);assert.equal(await p.locator('.bank-ledger tbody tr').count(),4);assert.equal(await p.locator('#accounting-error').isVisible(),false);assert.equal(await p.getByRole('button',{name:'Preview PDF',exact:true}).isDisabled(),false);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.locator('#main').screenshot({path:join(artifacts,'accounting-period-'+width+'.png')});
   const summary=await preview(p,context);assert.match(await summary.locator('body').textContent(),/PRIVATE ACCOUNTING/);assert.equal(await summary.locator('tbody tr').count(),0);assert.ok(!(await summary.locator('body').textContent()).includes('PRIVATE_NOTE'));
   if(width===1440)await savePdf(summary,join(artifacts,'accounting-summary.pdf'));
   await summary.evaluate(()=>{window.printCalls=0;window.print=()=>window.printCalls++;});await summary.getByRole('button',{name:'Print / Save as PDF',exact:true}).click();assert.equal(await summary.evaluate(()=>window.printCalls),1);await summary.close();
   await p.locator('#accounting-detail').check();const detail=await preview(p,context);assert.equal(await detail.locator('tbody tr').count(),4);assert.equal(await detail.locator('img,script,iframe').count(),0);assert.match(await detail.locator('body').textContent(),/PRIVATE_NOTE <img/);assert.ok(await detail.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await detail.screenshot({path:join(artifacts,'accounting-print-'+width+'.png'),fullPage:true});await detail.close();
   await p.getByRole('button',{name:'Current visit',exact:true}).click();assert.match(await p.locator('#accounting-active').textContent(),/Current visit/);assert.equal(await p.locator('.bank-ledger tbody tr').count(),5);
   await p.getByRole('button',{name:'Clear',exact:true}).click();assert.equal(await p.locator('#accounting-from').inputValue(),'');assert.match(await p.locator('#accounting-active').textContent(),/All dates/);
   await range(p,'067-1105','067-1105');assert.equal(await p.locator('.bank-ledger').count(),0);assert.deepEqual(await values(p),['Cr 117,000','Cr 0','Cr 0','Cr 117,000']);await p.getByRole('button',{name:'All dates',exact:true}).click();assert.equal(await raw(),bytes);
   console.log('PASS accounting filters, private preview, print and unchanged campaign '+width);
  }finally{await context.close();}
 }
 const backwards=await open(390,{backdatedVisit:true});try{await backwards.page.getByRole('button',{name:'Current visit',exact:true}).click();assert.match(await backwards.page.locator('#accounting-active').textContent(),/All dates/);assert.match(await backwards.page.locator('#accounting-error').textContent(),/boundary is not recorded reliably/);const report=await preview(backwards.page,backwards.context);assert.match(await report.locator('.period').textContent(),/All dates/);assert.ok(!(await report.locator('body').textContent()).includes('Current visit:'));await report.close();assert.equal(await backwards.raw(),backwards.bytes);}finally{await backwards.context.close();}
 const imported=await open(390,{unknown:true});try{await range(imported.page);assert.deepEqual(await values(imported.page),['Unknown','Cr 25,000','Cr 8,000','Unknown']);assert.match(await imported.page.locator('#accounting-summary').locator('..').textContent(),/history is incomplete/);assert.equal(await imported.raw(),imported.bytes);}finally{await imported.context.close();}
 const long=await open(390,{long:true});try{await range(long.page);await long.page.locator('#accounting-detail').check();const report=await preview(long.page,long.context);await savePdf(report,join(artifacts,'accounting-detail.pdf'));assert.equal(await report.locator('tbody tr').count(),54);assert.equal(await long.raw(),long.bytes);await report.close();}finally{await long.context.close();}
 console.log('PASS unknown opening history and paginated accounting PDF evidence');
}finally{await browser.close();}
