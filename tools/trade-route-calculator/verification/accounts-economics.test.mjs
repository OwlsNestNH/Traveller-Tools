import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as S from '../js/state.mjs';
import * as report from '../js/report.mjs';
import {accountsHarness,loadAccountsHarness} from './accounts-save-harness.mjs';
import {executeEconomics,canonical} from './accounts-economic-observations.mjs';

// Fixed outputs from the complete released .58 app, its original imports,
// original controller and original Store. The independent oracle executed the
// exact user action sequences before candidate evaluation. CI compares entire
// live campaigns, serialized durable bytes, reports, reload/import, every audit
// and inverse Undo, rather than substituting candidate helpers into the oracle.
// Only consistently mapped generated UUID identity and the explicit report
// release-version line are canonicalized. No business/economic field is omitted.
const readJSON=async name=>JSON.parse(await readFile(new URL('./fixtures/accounts-original/'+name,import.meta.url),'utf8'));
const expected=await readJSON('expected.json'),seeds=await readJSON('seeds.json'),scenarios=await readJSON('scenarios.json');
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url),'utf8'));
const kinds=['berthing','fuel','staterooms','passengerSupport','salary','mortgage','maintenance'];
const factory=await loadAccountsHarness();
const sha=value=>createHash('sha256').update(value).digest('hex');
test('Accounts complete-state oracle is pinned to independently released .58 source and all eighty scenarios',()=>{
 assert.equal(expected.originalSource.releasedMerge,'81011e305aef7e8561b4b2f9f9417f4059676b44');
 assert.equal(expected.originalSource.releasedTree,'3ce9475096d364f337569d833ab862a658418ba4');
 assert.equal(expected.originalSource.originalAppSha256,'add72aaf7dabcf60683fccff152c828b180e8d9186cf64a44923b1f8b1e7d0ba');
 assert.equal(scenarios.length,80);assert.equal(expected.cases.length,80);assert.equal(Object.keys(seeds).length,80);
 assert.deepEqual(scenarios.map(s=>s.name),expected.cases.map(s=>s.name));
 for(const source of ['campaign-controller','persistence','state','expenses','rounding','fuel','life-support','mortgage','maintenance'])assert.match(expected.productionSourceHashes['tools/trade-route-calculator/js/'+source+'.mjs'],/^[a-f\d]{64}$/);
});
for(const [index,spec]of scenarios.entries())test('original complete-state parity: '+spec.name,async()=>{
 const result=await executeEconomics(spec,seeds[spec.name],factory,report,S,{accountsHarness,kinds,core,S}),record=expected.cases[index];
 assert.equal(result.writes,record.writes);assert.equal(result.rolls,record.rolls);assert.deepEqual(result.checkpoints.map(checkpoint=>checkpoint.stage),record.checkpoints);
 const value=canonical(result).value;
 assert.equal(sha(JSON.stringify(value)),record.canonicalSha256,'Full original app/controller/Store state, saved JSON, UI quote, accounting/audit/stock, ephemera, reload, report and Undo must all match; investigate the first changed field before updating any fixture.');
 const saved=result.checkpoints.find(checkpoint=>checkpoint.stage==='saved');
 if(saved){assert.equal(saved.durable.bank,record.economics.bankAfter);assert.equal(saved.durable.revision,record.economics.revisionAfter);assert.equal(saved.durable.hours,record.economics.hoursAfter);}
});
test('canonical oracle preserves seeded identities and every UUID/version-shaped user string, including inverse values and saved JSON',()=>{
 const oldId='00000000-0000-0000-0000-000000000000',newId='11111111-2222-3333-4444-555555555555',otherId='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 const original={checkpoints:[{live:{ledger:[{id:oldId}]}}],ledger:[{id:newId,reason:newId,description:'Version 2026.10.11.58 '+otherId,batchId:otherId}],fields:{reason:{value:newId}},savedJSON:JSON.stringify({ledger:[{id:newId,reason:newId,batchId:otherId}],undo:[{inverse:[{path:['ledger',0,'reason'],value:otherId},{path:['ledger',0,'id'],value:newId}]}]})};
 const result=canonical(original).value;assert.equal(result.checkpoints[0].live.ledger[0].id,oldId);assert.equal(result.ledger[0].id,'generated-0');assert.equal(result.ledger[0].reason,newId);assert.equal(result.ledger[0].description,original.ledger[0].description);assert.equal(result.fields.reason.value,newId);const disk=JSON.parse(result.savedJSON);assert.equal(disk.ledger[0].reason,newId);assert.equal(disk.undo[0].inverse[0].value,otherId);assert.equal(disk.undo[0].inverse[1].value,'generated-0');
 const changed=structuredClone(original);changed.ledger[0].reason=otherId;assert.notDeepEqual(canonical(changed).value,result);changed.ledger[0].description='Version 2026.10.11.59 '+otherId;assert.notDeepEqual(canonical(changed).value,result);
});
