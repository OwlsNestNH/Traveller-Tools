import test from 'node:test';
import {legacyPackets,wholeCodec3} from './player-snapshot-legacy-fixtures.mjs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {playerSnapshotFixture as fixture,makePlayerSnapshotExample} from '../js/player-snapshot-fixture.mjs';
import {prepareSnapshotForLink,measureSnapshotLink,encodeSnapshotLink,decodeSnapshotLink,PROPOSED_PREFIX} from '../js/player-snapshot-codec.mjs';
const options={maxUrlLength:100000};
const link = data => encodeSnapshotLink(data,options);
const decode = value => decodeSnapshotLink(value,options);
const clone = () => structuredClone(fixture);
const legacyFixture=()=>decodeSnapshotLink(PROPOSED_PREFIX+legacyPackets.whole[1],{maxUrlLength:8192});
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
  const d=clone(); d.world.name='<img src=x onerror=alert(1)> 🪐'; d.world.uwp='B000000-0'; d.ship.name='\uFEFF航船'; d.cargo[0].tons='0'; d.ship.cashCredits='999999999999999.999999';
  assert.deepEqual(decode(link(d)),prepareSnapshotForLink(d));
  d.world.location='Custom sector / 0101'; assert.deepEqual(decode(link(d)),prepareSnapshotForLink(d));
});
test('budget has no truncation or alternative delivery and reports exact size',()=>{
  const oversized=clone();oversized.expenses.berth.basis='Unique public explanation '.repeat(8);
  const m=measureSnapshotLink(oversized); assert.equal(m.characters,PROPOSED_PREFIX.length+m.payload.length);
  assert.throws(()=>encodeSnapshotLink(oversized,{maxUrlLength:200}),new RegExp('needs '+m.characters));
  assert.equal(encodeSnapshotLink(oversized,{maxUrlLength:m.characters}).length,m.characters);
  assert.throws(()=>decodeSnapshotLink(link(oversized),{maxUrlLength:200}),/Invalid/);
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
  const d=clone(); for(const [key,priced] of [['cargo',false],['buy',true],['sell',true]]) {const rows=Array.from({length:200},(_,i)=>({name:'custom '+i,tons:priced?(i/10).toFixed(1):String(i),...(priced?{creditsPerTon:String(i*123)}:{})})); if(priced)d[key].offers=rows;else d[key]=rows;}
  const expected=prepareSnapshotForLink(d); assert.deepEqual(decode(link(d)),expected); assert.equal(expected.cargo.length,200);
  assert.deepEqual(decode(link(fixture)),prepareSnapshotForLink(fixture));
  d.cargo.push(d.cargo[0]); assert.throws(()=>link(d));
});
test('deterministic hostile packet fuzz either rejects or yields validated data',()=>{
  const base=link(fixture); let seed=17;
  for(let i=0;i<500;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const changed=mutate(base,b=>{b[seed%b.length]^=(seed>>>16)&255;});try {const d=decode(changed); assert.ok(Object.isFrozen(d)); assert.ok(d.cargo.length<=200);}catch(e){assert.match(e.message,/Invalid|whole tons/);}}
});

test('codec 1 catalog 1 wire format stays stable',()=>{
 assert.equal(createHash('sha256').update(legacyPackets.fractional[0]).digest('hex'),'5eb946e635c903b3309416120bfa9e6406036c30088edcfad063930a8d63fc1b');
 assert.equal(measureSnapshotLink(legacyFixture(),{codecVersion:1}).payload,legacyPackets.whole[0]);
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
 assert.deepEqual(decode(PROPOSED_PREFIX+measureSnapshotLink(legacyFixture(),{codecVersion:1}).payload),prepareSnapshotForLink(legacyFixture()));
 for(const capturedAt of ['2026-10-19T15:00:00.123Z','9999-12-31T23:59:59.999Z','1960-01-01T00:00:00.000Z','2026-02-30 15:00 UTC (example)','custom captain date 🪐']) {
  const d=clone();d.capturedAt=capturedAt;d.expenses.salary.basis='Custom crew agreement — 12 days';d.expenses.visitLabel='A custom visit';assert.deepEqual(decode(link(d)),prepareSnapshotForLink(d));
 }
 const d=clone();d.world.name='Custom world';d.expenses.visitLabel='Custom world · this stop, 001–365-1200 planned';d.expenses.fuel.basis='Planned 3.500000 t refined top-up at Cr500.000000/t';assert.deepEqual(decode(link(d)),prepareSnapshotForLink(d));
 assert.ok(measureSnapshotLink(fixture).characters<500);
});

test('compact decimal packets preserve maximum precision and every trailing zero',()=>{
 const d=clone();d.ship.cashCredits='999999999999999.999999';d.ship.fuel.current='0.000000';d.ship.lifeSupport.cargoLss='0.0';d.ship.lifeSupport.cargoReservedTons='0';d.cargo[0].tons='999999999999999';assert.deepEqual(decode(link(d)),prepareSnapshotForLink(d));
 assert.deepEqual(decodeSnapshotLink(encodeSnapshotLink(fixture)),prepareSnapshotForLink(fixture));
});

test('10 and 12 actual cargo lots retain repeated IDs, quantities, every field and both offer lists',()=>{
 for(const count of [10,12]) for(const rounding of [100,1000]) {
  const data=makePlayerSnapshotExample(count),before=structuredClone(data);
  const encoded=encodeSnapshotLink(data,{rounding}),decoded=decodeSnapshotLink(encoded);
  assert.deepEqual(decoded,prepareSnapshotForLink(data,{rounding}));
  assert.equal(decoded.cargo.length,count);
  assert.equal(decoded.cargo[0].name,decoded.cargo[4].name);
  assert.notEqual(decoded.cargo[0].tons,decoded.cargo[4].tons);
  assert.deepEqual(decoded.buy,prepareSnapshotForLink(fixture,{rounding}).buy);
  assert.deepEqual(decoded.sell,prepareSnapshotForLink(fixture,{rounding}).sell);
  assert.deepEqual(data,before);assert.ok(encoded.length>200);
 }
});


test('whole cargo boundary rejects fractional known and Other lots without changing inventory or prices',()=>{
 for(const name of ['Advanced Electronics','Other'])for(const tons of ['8.5','0.1','12.000000']) {
  const data=clone();data.cargo[0]={name,tons};const before=structuredClone(data);
  assert.throws(()=>encodeSnapshotLink(data),/whole tons/);assert.deepEqual(data,before);
 }
 for(const payload of legacyPackets.fractional)assert.throws(()=>decodeSnapshotLink(PROPOSED_PREFIX+payload,{maxUrlLength:8192}),/No inventory was rounded or changed/);
 for(const payload of legacyPackets.whole)assert.deepEqual(decodeSnapshotLink(PROPOSED_PREFIX+payload,{maxUrlLength:8192}),prepareSnapshotForLink(legacyFixture()));
 const data=clone();data.ship.cargoCapacityTons='82.5';assert.throws(()=>encodeSnapshotLink(data),/whole tons/);
});
test('explicit LSS days round-trip without stock conversion; older codecs preserve unknown duration',()=>{
 const d=clone();d.ship.lifeSupport.daysRemaining='3.5';d.ship.lifeSupport.daysCapacity='8';
 assert.deepEqual(decode(link(d)),prepareSnapshotForLink(d));
 assert.throws(()=>measureSnapshotLink(d,{codecVersion:2}),/cannot represent/);
 d.ship.lifeSupport.daysRemaining='9';assert.throws(()=>link(d),/Invalid/);
 for(const payload of legacyPackets.whole){const saved=decode(PROPOSED_PREFIX+payload);assert.equal(saved.ship.lifeSupport.current,'168');assert.equal(saved.ship.lifeSupport.daysRemaining,null);assert.equal(saved.ship.lifeSupport.daysCapacity,null);}
});

test('canonical map reference round-trips separately from public world text; old codec3 snapshots keep their origin',()=>{
 const before=decode(PROPOSED_PREFIX+wholeCodec3);assert.equal(before.world.name,'Port Meridian');assert.equal(before.world.mapReference,null);assert.equal(before.ship.lifeSupport.daysRemaining,'21');
 const current=decode(link(fixture));assert.equal(current.world.name,'Regina');assert.deepEqual(current.world.mapReference,{sector:'Spinward Marches',hex:'1910'});
 assert.throws(()=>measureSnapshotLink(fixture,{codecVersion:3}),/cannot represent/);
 for(const hex of ['0000','3341','<img>']){const d=clone();d.world.mapReference.hex=hex;assert.throws(()=>link(d));}
 const d=clone();d.world.mapReference.secret='GM';assert.deepEqual(decode(link(d)).world.mapReference,current.world.mapReference);
});

test('codec5 carries each lot purchase provenance without inferring from catalog or rounded costs',()=>{
 const source=clone();source.cargo=[
  {name:'Advanced Electronics',tons:'2',purchase:{retailPerTon:'1000',percent:'62.5',paidPerTon:'625'}},
  {name:'Advanced Electronics',tons:'3',purchase:{retailPerTon:'1000',percent:'80',paidPerTon:'800'}},
  {name:'Other',tons:'1',purchase:{retailPerTon:'0',percent:null,paidPerTon:'0'}},
  {name:'Other',tons:'7'},
  {name:'Textiles',tons:'5',purchase:{retailPerTon:null,percent:null,paidPerTon:'123.45'}}];
 const before=structuredClone(source);
 for(const rounding of [100,1000]){const encoded=encodeSnapshotLink(source,{rounding}),result=decodeSnapshotLink(encoded);assert.deepEqual(result,prepareSnapshotForLink(source,{rounding}));assert.equal(result.cargo[0].purchase.percent,'62.5');assert.equal(result.cargo[0].purchase.retailPerTon,'1000');assert.equal(result.cargo[0].purchase.paidPerTon,rounding===100?'700':'1000');assert.equal(result.cargo[1].purchase.percent,'80');assert.equal(result.cargo[2].purchase.paidPerTon,'0');assert.equal(result.cargo[2].purchase.percent,null);assert.equal(result.cargo[3].purchase,null);assert.equal(result.cargo[4].purchase.retailPerTon,null);}
 assert.deepEqual(source,before);assert.throws(()=>measureSnapshotLink(source,{codecVersion:4}),/cannot represent cargo/);
 const overflow=clone();overflow.cargo[0].purchase={paidPerTon:'999999999999999.999999'};assert.throws(()=>encodeSnapshotLink(overflow),/numeric range/);
});
test('older codecs never fabricate cargo purchase history and codec4 bytes stay stable',()=>{
 for(const version of [1,2,3,4]){const input=clone();if(version<4)input.world.mapReference=null;if(version<3){input.ship.lifeSupport.daysRemaining=null;input.ship.lifeSupport.daysCapacity=null;input.ship.lifeSupport.cargoReservedTons=null;}
  const packet=measureSnapshotLink(input,{codecVersion:version});const old=decodeSnapshotLink(PROPOSED_PREFIX+packet.payload);assert.ok(old.cargo.every(row=>row.purchase===null));assert.equal(measureSnapshotLink(old,{codecVersion:version}).payload,packet.payload);
 }
});

test('lot totals round exact unit cost times shown tons, independently of unit rounding',()=>{
 const source=clone();source.cargo=[{name:'Other',tons:'2',purchase:{retailPerTon:'1000',percent:'62.5',paidPerTon:'625'}},{name:'Other',tons:'4',purchase:{paidTotal:'1001'}},{name:'Other',tons:'0',purchase:{paidPerTon:'0'}},{name:'Other',tons:'3'}];
 for(const rounding of [100,1000]){const result=decodeSnapshotLink(encodeSnapshotLink(source,{rounding}));assert.equal(result.cargo[0].purchase.paidTotal,rounding===100?'1300':'2000');assert.equal(result.cargo[0].purchase.paidPerTon,rounding===100?'700':'1000');assert.equal(result.cargo[1].purchase.paidTotal,rounding===100?'1100':'2000');assert.equal(result.cargo[1].purchase.paidPerTon,null);assert.equal(result.cargo[2].purchase.paidTotal,'0');assert.equal(result.cargo[3].purchase,null);assert.deepEqual(prepareSnapshotForLink(result,{rounding}),result);}
 source.cargo[0].tons='999999999999999';assert.throws(()=>encodeSnapshotLink(source),/numeric range/);
});
