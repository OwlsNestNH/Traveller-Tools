import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignDate,parseDate,displayDate} from '../js/calendar.mjs';
test('Imperial day and year rollover',()=>{
 assert.equal(campaignDate('001-1105',0),'001-1105 · 00:00');
 assert.equal(campaignDate('001-1105',23),'001-1105 · 23:00');
 assert.equal(campaignDate('001-1105',24),'002-1105 · 00:00');
 assert.equal(campaignDate('365-1105',24),'001-1106 · 00:00');
 assert.equal(campaignDate('001-1105',365*24*2+160),'007-1107 · 16:00');
});
test('Validation and compatibility with saved campaign labels',()=>{
 for(const x of ['000-1105','366-1105','Monday'])assert.throws(()=>parseDate(x));
 assert.throws(()=>campaignDate('001-1105',-1));
 assert.throws(()=>campaignDate('001-1105',1.5));
 assert.match(displayDate('Old custom date',24),/Old custom date \+ 1d 0h/);
});
