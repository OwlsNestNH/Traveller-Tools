import test from 'node:test';
import assert from 'node:assert/strict';
import {playerSnapshotFixture} from '../js/player-snapshot-fixture.mjs';
import {projectPlayerSnapshot} from '../js/player-snapshot.mjs';
import {derivedRetailPercent} from '../js/player-retail-percent.mjs';
import {encodeSnapshotLink,decodeSnapshotLink,measureSnapshotLink,PROPOSED_PREFIX} from '../js/player-snapshot-codec.mjs';
const fixture=()=>({...structuredClone(playerSnapshotFixture),version:8});
const offer=(retailPerTon='20000',creditsPerTon='17000',name='Common Electronics')=>({name,tons:'2',creditsPerTon,retailPerTon});
test('derived displayed percentage is independent of fees and original table percentages',()=>{
 assert.equal(derivedRetailPercent(offer()),'85%');assert.equal(derivedRetailPercent({...offer(),fee:'99',percent:'140'}),'85%');
 assert.equal(derivedRetailPercent(offer('10000')),'170%');assert.equal(derivedRetailPercent(offer('12345.67','10000','Other')),'81%');
 for(const value of [null,undefined,'0','bad','-1',Infinity])assert.equal(derivedRetailPercent({...offer(),retailPerTon:value}),'Unknown');
 assert.equal(derivedRetailPercent(offer('999999999999999.999999','999999999999999.999999')),'100%');
});
test('version9 carries verified standard, capped and custom bases without modifying campaign input',()=>{
 const d=fixture();d.buy.offers=[offer(),offer('10000'),offer('12345.67','10000','Other'),offer(null),offer('0')];d.sell.offers=[offer('20000','17001')];
 const before=structuredClone(d),result=decodeSnapshotLink(encodeSnapshotLink(d));
 assert.deepEqual(d,before);assert.deepEqual(result.buy.offers.map(x=>x.retailPerTon),['20000','10000','12345.67',null,null]);
 assert.equal(result.sell.offers[0].creditsPerTon,'17100');assert.equal(derivedRetailPercent(result.sell.offers[0]),'85.5%');
 assert.equal(derivedRetailPercent(decodeSnapshotLink(encodeSnapshotLink(d,{rounding:1000})).sell.offers[0]),'90%');
});
test('old schema and codec links never infer effective retail from the catalog',()=>{
 const d=fixture();d.buy.offers=[offer()];d.sell.offers=[];
 assert.equal(projectPlayerSnapshot({...d,version:7}).buy.offers[0].retailPerTon,null);
 for(const codecVersion of [7,8]){const old=PROPOSED_PREFIX+measureSnapshotLink(d,{codecVersion}).payload;assert.equal(decodeSnapshotLink(old).buy.offers[0].retailPerTon,null);}
});
test('basis validation rejects malicious and oversized inputs; no hidden fields survive',()=>{
 for(const value of ['-1','NaN','1e6','1.0000001','9'.repeat(16),{},Infinity]){const d=fixture();d.buy.offers=[offer(value)];assert.throws(()=>encodeSnapshotLink(d));}
 const d=fixture();d.buy.offers=[{...offer(),audit:{secret:'GM_ONLY'},notes:'GM_ONLY'}];assert.ok(!JSON.stringify(decodeSnapshotLink(encodeSnapshotLink(d))).includes('GM_ONLY'));
 const link=encodeSnapshotLink(d);assert.equal(encodeSnapshotLink(d,{maxUrlLength:link.length}),link);assert.throws(()=>encodeSnapshotLink(d,{maxUrlLength:link.length-1}),/No link generated/);
 d.buy.offers=Array.from({length:200},()=>offer('999999999999999.999999','999999999999900'));d.sell.offers=structuredClone(d.buy.offers);
 assert.throws(()=>encodeSnapshotLink(d),/limit is 8192/);assert.equal(d.buy.offers.length,200);
});
test('measured basis overhead stays compact at 1, 10 and 30 offers',()=>{
 for(const count of [1,10,30])for(const [basis,name] of [['20000','Common Electronics'],['10000','Common Electronics'],['12345.67','Other'],[null,'Common Electronics']]){
  const d=fixture();d.buy.offers=Array.from({length:count},()=>offer(basis,'17000',name));d.sell.offers=[];
  const current=measureSnapshotLink(d),old=measureSnapshotLink(d,{codecVersion:8});
  const decoded=decodeSnapshotLink(PROPOSED_PREFIX+current.payload);assert.equal(decoded.buy.offers.length,count);assert.equal(decoded.buy.offers[0].retailPerTon,basis);
  const extra=current.characters-old.characters;assert.ok(extra<=Math.ceil(count*16/3));if(basis==='20000')assert.equal(extra,0);
  console.log(JSON.stringify({count,basis,characters:current.characters,extra}));
 }
});
