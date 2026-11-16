import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]);
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});const errors=[],checks=[];
try{for(const width of [1440,390,320]){
const p=await browser.newPage({viewport:{width,height:900}});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port);await p.locator('#setup-form').waitFor();
for(const key of ['species','extras','generation']){
await p.evaluate(async key=>{const m=await import('./gui/opening-help.mjs');m.showOpeningInformation(document,m.OPENING_HELP[key],document.getElementById('setup-species'));},key);
await p.locator('#opening-help-dialog').waitFor({state:'visible'});
const result=await p.locator('#opening-help-copy .opening-help-crow').evaluate(n=>{const q=n.querySelector('blockquote'),i=n.querySelector('img');return{xs:[...q.querySelectorAll('p')].map(p=>p.getBoundingClientRect().x),quote:q.getBoundingClientRect().x,imageRight:i.getBoundingClientRect().right,overflow:document.documentElement.scrollWidth>innerWidth+1||n.scrollWidth>n.clientWidth+1};});
assert.ok(result.xs.every(x=>Math.abs(x-result.xs[0])<1));assert.equal(result.overflow,false);if(width>600)assert.ok(result.quote>result.imageRight);
await p.locator('#opening-help-copy').evaluate(n=>{n.scrollTop=n.scrollHeight});await p.locator('[data-opening-help-close]').click();checks.push({width,key});
}await p.close();}assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors}));}finally{await browser.close();server.closeAllConnections();server.close();}
