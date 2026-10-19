import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {playerSnapshotFixture as fixture} from '../js/player-snapshot-fixture.mjs';
import {prepareSnapshotForLink,measureSnapshotLink,encodeSnapshotLink,decodeSnapshotLink,PROPOSED_PREFIX} from '../js/player-snapshot-codec.mjs';
const options={maxUrlLength:100000};
const link = data => encodeSnapshotLink(data,options);
const decode = value => decodeSnapshotLink(value,options);
const clone = () => structuredClone(fixture);
const mutate = (url, fn) => {const b=Buffer.from(url.slice(PROPOSED_PREFIX.length),'base64url');return PROPOSED_PREFIX+Buffer.from(fn(b)??b).toString('base64url');};
test('round trips the full public contract, rounds only costs, preserves source and unknowns',()=>{
  for (const rounding of [100,1000]) {
    const source=clone(), before=structuredClone(source), expected=prepareSnapshotForLink(source,{rounding});
    assert.deepEqual(decode(encodeSnapshotLink(source,{...options,rounding})),expected);
    assert.deepEqual(source,before); assert.deepEqual(expected.ship,source.ship);
    assert.equal(expected.expenses.incidentals.expected,null); assert.equal(expected.expenses.fuel.paid,'0');
    assert.equal(expected.buy.offers[0].creditsPerTon,rounding===100?'500':'1000');
    assert.equal(expected.cargo[1].name,'Other'); assert.equal(expected.cargo[2].name,'Other'); assert.equal(expected.cargo.length,4);
    assert.ok(Object.isFrozen(expected.cargo[0]));
  }
});
test('world overrides, Unicode, markup and exact decimal representation survive',()=>{
  const d=clone(); d.world.name='<img src=x onerror=alert(1)> 🪐'; d.world.uwp='B000000-0'; d.ship.name='\uFEFF航船'; d.cargo[0].tons='0.000000'; d.ship.cashCredits='999999999999999.999999';
  assert.deepEqual(decode(link(d)),prepareSnapshotForLink(d));
  d.world.location='Custom sector / 0101'; assert.deepEqual(decode(link(d)),prepareSnapshotForLink(d));
});
test('budget has no truncation or alternative delivery and reports exact size',()=>{
  const oversized=clone();oversized.expenses.berth.basis='Unique public explanation '.repeat(8);
  const m=measureSnapshotLink(oversized); assert.equal(m.characters,PROPOSED_PREFIX.length+m.payload.length);
  assert.throws(()=>encodeSnapshotLink(oversized),new RegExp('needs '+m.characters));
  assert.equal(encodeSnapshotLink(oversized,{maxUrlLength:m.characters}).length,m.characters);
  assert.throws(()=>decodeSnapshotLink(link(oversized)),/Invalid/);
  for(const n of [NaN,-1,Infinity,1.5,100001]) assert.throws(()=>encodeSnapshotLink(fixture,{maxUrlLength:n}));
});
test('invalid versions, IDs, lengths, UTF-8, base64, truncation and trailing bytes reject',()=>{
  const encoded=link(fixture);
  for(const index of [0,1,2,3,4]) assert.throws(()=>decode(mutate(encoded,b=>{b[index]=255;})),/Invalid/);
  for(let i=PROPOSED_PREFIX.length;i<encoded.length;i++) assert.throws(()=>decode(encoded.slice(0,i)),/Invalid/);
  for(const tail of ['=','%20','!','\n']) assert.throws(()=>decode(encoded+tail),/Invalid/);
  assert.throws(()=>decode(mutate(encoded,b=>Buffer.concat([b,Buffer.from([0])]))),/Invalid/);
  const unicode=clone();unicode.capturedAt='X';assert.throws(()=>decode(mutate(link(unicode),b=>{b[7]=255;})),/Invalid/);
  assert.throws(()=>decode(encoded.replace('https:','http:')),/Invalid/);
  assert.throws(()=>decode(PROPOSED_PREFIX+'A'.repeat(99999)),/Invalid/);
});
test('cost overflow and invalid text fail explicitly; GM extras never serialize',()=>{
  const d=clone(); d.expenses.fuel.paid='999999999999999.999999'; assert.throws(()=>link(d),/numeric range/);
  d.expenses.fuel.paid='1'; d.ship.name='bad\ud800'; assert.throws(()=>link(d),/Unicode/);
  const a=clone(); a.secret='private'; a.world.gmNotes='private'; a.cargo[0].profit='private';
  assert.equal(link(a),link(fixture));
});
test('maximum rows stay distinct and independent snapshots have no retained codec state',()=>{
  const d=clone(); for(const [key,priced] of [['cargo',false],['buy',true],['sell',true]]) {const rows=Array.from({length:200},(_,i)=>({name:'custom '+i,tons:(i/10).toFixed(1),...(priced?{creditsPerTon:String(i*123)}:{})})); if(priced)d[key].offers=rows;else d[key]=rows;}
  const expected=prepareSnapshotForLink(d); assert.deepEqual(decode(link(d)),expected); assert.equal(expected.cargo.length,200);
  assert.deepEqual(decode(link(fixture)),prepareSnapshotForLink(fixture));
  d.cargo.push(d.cargo[0]); assert.throws(()=>link(d));
});
test('deterministic hostile packet fuzz either rejects or yields validated data',()=>{
  const base=link(fixture); let seed=17;
  for(let i=0;i<500;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const changed=mutate(base,b=>{b[seed%b.length]^=(seed>>>16)&255;});try {const d=decode(changed); assert.ok(Object.isFrozen(d)); assert.ok(d.cargo.length<=200);}catch(e){assert.match(e.message,/Invalid/);}}
});

test('codec 1 catalog 1 wire format stays stable',()=>{
 assert.equal(createHash('sha256').update(measureSnapshotLink(fixture,{codecVersion:1}).payload).digest('hex'),'5eb946e635c903b3309416120bfa9e6406036c30088edcfad063930a8d63fc1b');
});
test('percentage rows reconstruct exact quotes; noncanonical prices use explicit escape',()=>{
 const d=clone();d.buy.offers=Array.from({length:50},(_,i)=>({name:'Common Electronics',tons:String(i+1),creditsPerTon:String(10000+i%5*1000)}));d.sell.offers=structuredClone(d.buy.offers);
 const percent=measureSnapshotLink(d),plain=measureSnapshotLink(d,{percentages:false});assert.ok(percent.bytes<plain.bytes);
 assert.deepEqual(decode(PROPOSED_PREFIX+percent.payload),prepareSnapshotForLink(d));
 d.buy.offers.push({name:'Other',tons:'1',creditsPerTon:'12345'},{name:'Common Electronics',tons:'2',creditsPerTon:'12345'});
 assert.deepEqual(decode(link(d)),prepareSnapshotForLink(d));assert.equal(prepareSnapshotForLink(d).buy.offers.at(-1).creditsPerTon,'12400');
});
test('forged percent price cannot contradict the declared rounding quantum',()=>{
 const d=clone();d.buy.offers=Array.from({length:50},()=>({name:'Advanced Electronics',tons:'1',creditsPerTon:'100000'}));d.sell.offers=[{name:'Common Consumables',tons:'1',creditsPerTon:'500'}];
 const encoded=link(d);assert.equal(Buffer.from(encoded.slice(PROPOSED_PREFIX.length),'base64url')[4]&2,2);
 assert.throws(()=>decode(mutate(encoded,b=>{b[b.length-1]=43;})),/Invalid/); // 105% of Cr500 = Cr525, not a Cr100 increment.
});

test('codec 2 compact templates preserve exact labels, custom text and codec 1 links',()=>{
 assert.deepEqual(decode(PROPOSED_PREFIX+measureSnapshotLink(fixture,{codecVersion:1}).payload),prepareSnapshotForLink(fixture));
 for(const capturedAt of ['2026-10-19T15:00:00.123Z','9999-12-31T23:59:59.999Z','1960-01-01T00:00:00.000Z','2026-02-30 15:00 UTC (example)','custom captain date 🪐']) {
  const d=clone();d.capturedAt=capturedAt;d.expenses.salary.basis='Custom crew agreement — 12 days';d.expenses.visitLabel='A custom visit';assert.deepEqual(decode(link(d)),prepareSnapshotForLink(d));
 }
 const d=clone();d.world.name='Custom world';d.expenses.visitLabel='Custom world · this stop, 001–365-1200 planned';d.expenses.fuel.basis='Planned 3.500000 t refined top-up at Cr500.000000/t';assert.deepEqual(decode(link(d)),prepareSnapshotForLink(d));
 assert.equal(measureSnapshotLink(fixture).characters,197);
});

test('compact decimal packets preserve maximum precision and every trailing zero',()=>{
 const d=clone();d.ship.cashCredits='999999999999999.999999';d.ship.fuel.current='0.000000';d.ship.lifeSupport.cargoLss='0.0';d.cargo[0].tons='999999999999999.999999';assert.deepEqual(decode(link(d)),prepareSnapshotForLink(d));
 assert.deepEqual(decodeSnapshotLink(encodeSnapshotLink(fixture)),prepareSnapshotForLink(fixture));
});
