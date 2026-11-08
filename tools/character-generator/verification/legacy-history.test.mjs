import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRecordedHistory,recordedHistoryText,MAX_HISTORY_BYTES} from '../gui/legacy-history.mjs';
const record={format:'traveller-character-session',version:1,seed:'legacy',events:[{id:'old',command:{type:'setup',payload:{name:'Original <Traveller>'}},summary:'Original result, not current rules',rolls:[{label:'Rite',values:[6,6],kept:[6,6],total:12}]}]};
test('legacy history preserves stored content without calculating or certifying results',()=>{
 const raw=JSON.stringify(record),history=inspectRecordedHistory(raw);assert.equal(history.rulesRevision,'Not recorded (legacy)');assert.equal(history.events[0].summary,record.events[0].summary);assert.deepEqual(JSON.parse(history.events[0].rolls[0]),record.events[0].rolls[0]);assert.equal(JSON.stringify(record),raw);assert.match(recordedHistoryText(history),/UNVERIFIED/);assert.match(recordedHistoryText(history),/Original <Traveller>/);assert.equal(history.character,undefined);
});
test('different rules revisions can be inspected without replaying them',()=>{
 const history=inspectRecordedHistory(JSON.stringify({...record,rulesRevision:'older-rules'}));assert.equal(history.rulesRevision,'older-rules');assert.match(recordedHistoryText(history),/older-rules/);
});
test('malformed, oversized and unrelated files are rejected without writes',()=>{
 for(const raw of ['{','{}',JSON.stringify({...record,events:{}}),JSON.stringify({...record,events:Array(2001).fill(null)})])assert.throws(()=>inspectRecordedHistory(raw));assert.throws(()=>inspectRecordedHistory('x'.repeat(MAX_HISTORY_BYTES+1)),/too large/);
});
test('malformed entries and untrusted text are returned only as data',()=>{
 const history=inspectRecordedHistory(JSON.stringify({...record,events:[null,{command:{type:'<script>bad()</script>'},summary:'<img src=x onerror=bad()>',rolls:[null,{},'bad']}]}));assert.equal(history.events[0].type,'Unreadable action');assert.equal(history.events[1].summary,'<img src=x onerror=bad()>');assert.equal(history.events[1].rolls.length,3);
});
test('long stored fields are labelled shortened without changing the original',()=>{
 const raw=JSON.stringify({...record,events:[{summary:'x'.repeat(9000),command:{type:'notes'},rolls:Array(101).fill({})}]}),history=inspectRecordedHistory(raw);assert.match(history.events[0].summary,/display shortened/);assert.equal(history.events[0].rolls.length,100);assert.equal(history.events[0].rollsShortened,true);assert.equal(JSON.parse(raw).events[0].summary.length,9000);
});

test('deeply nested recorded commands cannot crash history inspection',()=>{
 const depth=20000,raw='{"format":"traveller-character-session","version":1,"events":[{"command":'+ '['.repeat(depth)+'0'+']'.repeat(depth)+'}]}';
 const history=inspectRecordedHistory(raw);assert.match(history.events[0].command,/Nested data cannot be displayed/);
});
test('Unicode and whitespace are untouched by inspection',()=>{
 const raw='  \n'+JSON.stringify({...record,seed:'Zo'+String.fromCodePoint(0xeb)})+'\n  ',before=raw;inspectRecordedHistory(raw);assert.equal(raw,before);
});
