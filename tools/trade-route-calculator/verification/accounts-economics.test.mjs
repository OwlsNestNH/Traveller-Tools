import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as S from '../js/state.mjs';
import * as report from '../js/report.mjs';
import {accountsHarness,loadAccountsHarness} from './accounts-save-harness.mjs';
import {canonical} from './accounts-economic-observations.mjs';
import {combinedAccountsObservation} from './accounts-combined-observations.mjs';

// Fixed outputs from the complete released .58 app, its original imports,
// original controller and original Store. The independent oracle executed the
// exact user action sequences before candidate evaluation. CI compares entire
// live campaigns, serialized durable bytes, reports, reload/import, every audit
// and inverse Undo, rather than substituting candidate helpers into the oracle.
// Only consistently mapped generated UUID identity and the explicit report
// release-version line are canonicalized. The approved .64 fuel-help sentence
// is compared using its historical spelling below. No business/economic field
// is omitted.
const readJSON=async name=>JSON.parse(await readFile(new URL('./fixtures/accounts-original/'+name,import.meta.url),'utf8'));
const expected=await readJSON('expected.json'),seeds=await readJSON('seeds.json'),scenarios=await readJSON('scenarios.json');
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url),'utf8'));
const kinds=['berthing','fuel','salary','mortgage','maintenance'];
const combined=JSON.parse(await readFile(new URL('./fixtures/accounts-combined-support.json',import.meta.url),'utf8'));
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
// The original oracle is kept immutable. The approved LSS change retires two
// payment controls and adds cost explanations to reports. A separate snapshot
// pins that UI, while each surviving ledger entry must still match the original, except the
// explicitly authorized fixed-payment incidental allowance calculated from the
// independently observed schedule. Direct attempts to pay retired charges are
// covered by expense-panels.test and rejected atomically by the state API.
for(const [index,spec]of scenarios.entries())test('combined-support compatibility: '+spec.name,async()=>{
 const value=await combinedAccountsObservation(spec,seeds[spec.name],factory,report,S,{accountsHarness,kinds,core,S},expected.cases[index]);
 assert.equal(combined.cases[index].name,spec.name);
 assert.equal(sha(JSON.stringify(value)),combined.cases[index].canonicalSha256,'Complete current UI, state, durable bytes, report, import and Undo snapshot; investigate before changing the fixture.');
 if(spec.kind!=='bundle'){
  // These operations have no approved economic change. Remove only the three
  // new informational LSS report lines and retain the full original hash check.
  for(const checkpoint of value.checkpoints)checkpoint.report=checkpoint.report.replace(/^(?:LSS cabin \+ person cost \/ 28 days|LSS daily cost rounded up|LSS billing)[^\n]*\n/gm,'');
  assert.equal(sha(JSON.stringify(value)),expected.cases[index].canonicalSha256,'Unchanged operation matches original whole-state oracle apart from added report information');
 }
});

test('canonical oracle preserves seeded identities and every UUID/version-shaped user string, including inverse values and saved JSON',()=>{
 const oldId='00000000-0000-0000-0000-000000000000',newId='11111111-2222-3333-4444-555555555555',otherId='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 const original={checkpoints:[{live:{ledger:[{id:oldId}]}}],ledger:[{id:newId,reason:newId,description:'Version 2026.10.11.58 '+otherId,batchId:otherId}],fields:{reason:{value:newId}},savedJSON:JSON.stringify({ledger:[{id:newId,reason:newId,batchId:otherId}],undo:[{inverse:[{path:['ledger',0,'reason'],value:otherId},{path:['ledger',0,'id'],value:newId}]}]})};
 const result=canonical(original).value;assert.equal(result.checkpoints[0].live.ledger[0].id,oldId);assert.equal(result.ledger[0].id,'generated-0');assert.equal(result.ledger[0].reason,newId);assert.equal(result.ledger[0].description,original.ledger[0].description);assert.equal(result.fields.reason.value,newId);const disk=JSON.parse(result.savedJSON);assert.equal(disk.ledger[0].reason,newId);assert.equal(disk.undo[0].inverse[0].value,otherId);assert.equal(disk.undo[0].inverse[1].value,'generated-0');
 const changed=structuredClone(original);changed.ledger[0].reason=otherId;assert.notDeepEqual(canonical(changed).value,result);changed.ledger[0].description='Version 2026.10.11.59 '+otherId;assert.notDeepEqual(canonical(changed).value,result);
});
