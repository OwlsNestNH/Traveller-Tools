import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {REFERENCE_VERSION,SOURCE_BOOKS,RULE_REFERENCES,ruleInfo,ruleReference,referenceMarkup,referenceIndex} from '../js/rule-references.mjs';

const plain=id=>RULE_REFERENCES[id].parts.map(part=>part.kind+': '+part.text).join(' ');
test('all reference entries have frozen display-only classifications and printed-page provenance',()=>{
 assert.equal(REFERENCE_VERSION,'2026.10.10.1');assert.equal(Object.keys(RULE_REFERENCES).length,29);
 const allowed=/^(Published rule|Published context|Home rule|App convention|Referee input|Explanation)/;
 for(const [id,entry] of Object.entries(RULE_REFERENCES)){
  assert.equal(ruleReference(id),entry);assert.ok(entry.title);assert.ok(Object.isFrozen(entry));assert.ok(Object.isFrozen(entry.parts));assert.ok(entry.parts.length);
  for(const part of entry.parts){assert.match(part.kind,allowed);assert.ok(part.text);assert.ok(Object.isFrozen(part));}
  for(const source of entry.sources){assert.ok(SOURCE_BOOKS[source.book]);assert.match(source.pages,/^[\d, –]+$/);assert.ok(Object.isFrozen(source));}
  const html=referenceMarkup(id);assert.doesNotMatch(html,/<(?:script|iframe|img|form|input|table)|https?:|file_|libfile_|PDF p\.|pdf page|\/workspace\//i);
  assert.match(ruleInfo(id),/type="button"/);assert.match(ruleInfo(id),/aria-haspopup="dialog"/);assert.match(ruleInfo(id),/aria-label="Rules reference for /);assert.match(ruleInfo(id),/<span aria-hidden="true">i<\/span>/);
  assert.doesNotMatch(ruleInfo(id),/data-mutate|data-action|\bid=/);
 }
 assert.throws(()=>ruleInfo('unrecognised'),/Unknown rules reference/);
 assert.equal((referenceIndex().match(/data-rule-info=/g)||[]).length,29);
});
test('current campaign interpretations do not inherit superseded inventory descriptions',()=>{
 assert.match(plain('contact-search'),/first committed supplier or buyer search/);assert.match(plain('contact-search'),/All penalties clear together after 28 days/);assert.match(plain('contact-search'),/same month/);assert.match(plain('contact-search'),/Core does not specify this grouped 28-day clock/);assert.match(plain('contact-search'),/Previews and cancelled searches do not count/);
 assert.match(plain('bladders'),/directly in whole tons/);assert.doesNotMatch(plain('bladders'),/adds capacity in.*jumps/);
 assert.match(plain('accommodation'),/newly booked Middle/);assert.match(plain('trade-price'),/greatest absolute magnitude.*retaining its sign/);assert.match(plain('trade-price'),/equal opposing magnitudes use the positive value/);
 assert.match(plain('broker'),/Home rule · INT-001/);assert.doesNotMatch(plain('broker'),/INT-003/);
});
test('optional references cite the verified first-edition pages and label the source-table correction',()=>{
 assert.match(referenceMarkup('insurance'),/Merchant Prince 1e pp\. 82–83/);assert.match(referenceMarkup('tax'),/Merchant Prince 1e pp\. 86–87/);
 assert.match(referenceMarkup('tax'),/discussion is on p\.86 and its table on p\.87/);assert.match(plain('tax'),/Cr75,001–76,000.*INT-009/);assert.match(plain('tax'),/not a publisher erratum/);
 assert.equal(SOURCE_BOOKS.merchant.edition,'Mongoose Traveller First Edition, 2010');
 assert.match(referenceMarkup('jump-duration'),/Core 2022 p\. 157/);assert.doesNotMatch(referenceMarkup('jump-duration'),/Core 2022 pp\./);
});
test('reference content keeps prices, physical stock and humour within their reviewed scopes',()=>{
 assert.match(plain('lss'),/1 LSS per awake person per day/);assert.match(plain('lss'),/0\.1 per occupied low berth/);assert.match(plain('lss'),/4 LSS per hull ton/);assert.match(plain('lss'),/0\.01 cargo ton per LSS/);
 assert.match(plain('support-pricing'),/Round the combined extra charge UP once to Cr100/);assert.match(plain('support-pricing'),/not Cluster Truck supply prices/);
 assert.match(plain('rounding'),/Partial-sale cost-basis allocation rounds down/);assert.match(plain('rounding'),/Historical amounts keep their recorded precision/);
 const jokes=Object.entries(RULE_REFERENCES).filter(([,r])=>r.parts.some(p=>p.kind==='Explanation')).map(([id])=>id);assert.deepEqual(jokes,['complication','support-stock']);
});
test('popover has an isolated presentation boundary and never calls campaign APIs',async()=>{
 const source=await readFile(new URL('../js/rule-popover.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/localStorage|sessionStorage|\.save\(|\.commit\(|\.requestSubmit\(|fetch\(|data-mutate/);
 assert.match(source,/document\.createElement\('dialog'\)/);assert.match(source,/event\.key==='Escape'/);assert.match(source,/el\?\.isConnected/);assert.match(source,/candidates\[origin\?\.ordinal\]/);assert.match(source,/target\.focus\(\{preventScroll:true\}\)/);assert.match(source,/event\.stopImmediatePropagation/);
});
