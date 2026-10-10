import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardPanel} from '../js/dashboard-view.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
const fixture=()=>({initialized:true,bank:'1000',dateLabel:'001-1105',hours:0,worlds:{a:{name:'Origin'},b:{name:'Destination'}},ledger:[],dashboardBaseline:{version:1,origin:'opening',bank:'1000',dateLabel:'001-1105',hours:0,excludedLedgerIds:[]}});
const add=(s,type,amount,detail={})=>{s.ledger.push({id:'entry-'+s.ledger.length,type,amount:String(amount),hours:s.ledger.length,...detail});s.bank=String(BigInt(s.bank)+BigInt(amount));};
test('Dashboard has four accessible local SVG cards and exact data tables without state changes',()=>{
 const s=fixture();add(s,'Manual expense',-100);add(s,'Sale',300,{audit:{adjusted:'100'}});add(s,'Jump',0,{from:'a',to:'b'});add(s,'Mail delivery',50);const raw=JSON.stringify(s),html=dashboardPanel(s);assert.equal((html.match(/class="dashboard-card"/g)||[]).length,4);assert.equal((html.match(/role="img"/g)||[]).length,4);assert.equal((html.match(/<caption>/g)||[]).length,4);assert.match(html,/Cr 1,250/);assert.match(html,/Transport income/);assert.match(html,/Each jump starts a destination visit/);assert.doesNotMatch(html,/<script|NaN|Infinity|https?:/);assert.equal(JSON.stringify(s),raw);
});
test('Huge exact amounts stay finite in graphic scaling and unrounded in the table',()=>{
 const s=fixture(),huge='1'+'0'.repeat(48);s.bank=huge;s.dashboardBaseline.bank=huge;add(s,'Sale',huge,{audit:{adjusted:'-'+huge}});add(s,'Manual expense','-'+huge);const html=dashboardPanel(s);assert.doesNotMatch(html,/NaN|Infinity/);assert.match(html,/Cr 1,000,000,000,000,000,000,000,000,000,000,000,000,000,000,000/);assert.match(html,/dashboard-loss/);
});
test('Large cash graphs are bounded while exact rows and visit totals remain available',()=>{
 const s=fixture();for(let i=0;i<250;i++)add(s,'Manual deposit',1);const html=dashboardPanel(s);assert.match(html,/chart groups 251 entries/);assert.match(html,/Cash balance data \(251 entries\)/);assert.equal((html.match(/<th scope="row">Manual deposit/g)||[]).length,250);
 for(let i=0;i<30;i++)add(s,'Jump',0,{from:'a',to:'b'});assert.match(dashboardPanel(s),/Latest 24 of 31 visits shown/);
});
test('Untrusted labels are escaped and missing sale result is unavailable, not zero',()=>{
 const s=fixture();add(s,'<img src=x onerror=alert(1)>',-10);add(s,'Sale',50);s.worlds.a.name='<script>bad</script>';add(s,'Jump',0,{from:'a',to:'b'});const html=dashboardPanel(s);assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;img/);assert.match(html,/&lt;script&gt;/);assert.match(html,/Incomplete records/);assert.match(html,/Incomplete sale audit/);
});
test('Read-only pending baseline and fixed earlier-history adjustment have clear notices',()=>{
 const s=fixture();delete s.dashboardBaseline;assert.match(dashboardPanel(s),/Read-only viewing does not save/);s.dashboardBaseline=createDashboardBaseline(s);s.bank='900';const html=dashboardPanel(s);assert.match(html,/Earlier-history adjustment: Cr -100/);assert.match(html,/excluded from profit/);assert.match(html,/Before surviving tracked activity/);
});
