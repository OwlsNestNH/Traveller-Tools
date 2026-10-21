import test from 'node:test';import assert from 'node:assert/strict';
import {playerSnapshotFixture} from '../js/player-snapshot-fixture.mjs';
import {playerTradePrint,gmTradePrint,marketCsv,openTradePrint} from '../js/trade-exports.mjs';
const fixture=()=>({...structuredClone(playerSnapshotFixture),version:8});
test('player reports include only allowlisted public details with no hidden GM payload',()=>{
 const d=fixture();d.gm='GM_PRIVATE';d.buy.offers[0].audit={secret:'GM_PRIVATE'};d.world.notes='GM_PRIVATE';const before=JSON.stringify(d);
 for(const text of [playerTradePrint(d),playerTradePrint(d,{marketOnly:true}),marketCsv(d)]){assert.ok(!text.includes('GM_PRIVATE'));assert.ok(text.includes('Regina'));assert.ok(text.includes(d.capturedAt));}
 const html=playerTradePrint(d);for(const section of ['Planetary information','Ship and supplies','Cargo aboard','Current-system expenses','Buy offers','Sell offers'])assert.ok(html.includes(section));assert.ok(!playerTradePrint(d,{marketOnly:true}).includes('Cargo aboard'));assert.equal(JSON.stringify(d),before);
});
test('untrusted names and audit text are escaped and CSV formulas neutralized',()=>{
 const d=fixture();d.world.name='<img src=x onerror=alert(1)>';d.buy.offers[0].name='  =HYPERLINK("evil")';const html=playerTradePrint(d),csv=marketCsv(d);
 assert.ok(html.includes('&lt;img'));assert.doesNotMatch(html,/<(?:script|img|iframe)\b/i);assert.ok(csv.includes("'  =HYPERLINK"));
 const gm=[{side:'buy',name:'@formula',id:'private-lot',audit:{secret:'GM_PRIVATE',markup:'</pre><script>alert(1)</script>'}}];
 const gmHtml=gmTradePrint(d,gm),gmCsv=marketCsv(d,{gmRows:gm});assert.ok(gmHtml.includes('GM ONLY'));assert.ok(gmHtml.includes('GM_PRIVATE'));assert.ok(gmHtml.includes('&lt;/pre&gt;'));assert.doesNotMatch(gmHtml,/<script\b/i);assert.ok(gmCsv.includes("'@formula"));assert.ok(gmCsv.includes('GM_PRIVATE'));
});
test('CSV keeps distinct rows, exact prices, unknown commission and effective retail',()=>{
 const d=fixture();d.buy.offers=[{name:'Common Electronics',tons:'2',creditsPerTon:'17000',retailPerTon:'20000'},{name:'Common Electronics',tons:'3',creditsPerTon:'17000',retailPerTon:'10000'}];
 const csv=marketCsv(d);assert.ok(csv.includes('"85%"'));assert.ok(csv.includes('"170%"'));assert.equal(csv.split('"Common Electronics"').length-1,2);assert.ok(csv.includes('Unknown; separate'));assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.endsWith('\r\n'));
});
test('oversized reports and blocked print windows fail without partial output',()=>{
 const d=fixture(),gm=[{side:'buy',name:'Other',audit:{large:'x'.repeat(2*1024*1024)}}];assert.throws(()=>gmTradePrint(d,gm),/2 MiB/);assert.throws(()=>marketCsv(d,{gmRows:gm}),/2 MiB/);assert.throws(()=>openTradePrint(playerTradePrint(d),{open:()=>null}),/Allow popups/);
});
