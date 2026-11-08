// Explicit snapshot capture only, never invoked by the test suite. Original
// release oracle remains untouched. Review changed UI and state before accepting.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as S from '../js/state.mjs';
import * as report from '../js/report.mjs';
import {accountsHarness,loadAccountsHarness} from './accounts-save-harness.mjs';
import {combinedAccountsObservation} from './accounts-combined-observations.mjs';
const read=async name=>JSON.parse(await readFile(new URL('./fixtures/accounts-original/'+name,import.meta.url),'utf8'));
const scenarios=await read('scenarios.json'),seeds=await read('seeds.json'),original=await read('expected.json'),factory=await loadAccountsHarness(),core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url),'utf8'));
const deps={accountsHarness,kinds:['berthing','fuel','salary','mortgage','maintenance'],core,S},cases=[];
for(const [index,spec]of scenarios.entries()){
 const value=await combinedAccountsObservation(spec,seeds[spec.name],factory,report,S,deps,original.cases[index]);
 cases.push({name:spec.name,canonicalSha256:createHash('sha256').update(JSON.stringify(value)).digest('hex')});
}
await writeFile(new URL('./fixtures/accounts-combined-support.json',import.meta.url),JSON.stringify({change:'2026-11-08: cabin/person costs folded into LSS; retire separate payments, add explanatory report lines. Original .58 economics independently checked for surviving entries, with separately computed Cr100 incidental allowance on scheduled payments.',cases},null,2)+'\n');
console.log('Captured 80 cases only after original economic entries and independent incidental allowances matched.');
