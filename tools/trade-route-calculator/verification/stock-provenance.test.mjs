import {createHash} from 'node:crypto';import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import * as R from '../js/rules.mjs';import {campaign,core,harness} from './app-harness.mjs';
const baseline=JSON.parse(await readFile(new URL('./fixtures/stock-provenance-baseline.json',import.meta.url)));
for(const c of baseline.cases)test('recording stock origins preserves every economic field and dice draw: '+c.seed+'/'+c.options.illegal,()=>{
 let n=c.seed;const dice=[],rng=()=>{n=n*48271%2147483647;const die=n%6+1;dice.push(die);return die;};const offers=R.market(R.context(c.world,core),c.options,core,rng),plain=structuredClone(offers);
 for(const o of plain){delete o.audit.stockSource;for(const q of o.audit.quantityRolls??[])delete q.source;}
 assert.equal(createHash('sha256').update(JSON.stringify(plain)).digest('hex'),c.offersSha256);assert.deepEqual(plain.map(({commodity,quantity,unitPrice})=>({commodity,quantity,unitPrice})),c.economics);assert.deepEqual(dice,c.dice);
 for(const o of offers)for(const q of o.audit.quantityRolls??[]){const s=q.source;assert.ok(['common','trade-code','random'].includes(s.kind));if(s.kind==='random')assert.equal(o.audit.randomDraws[s.draw-1],o.commodity);if(s.kind==='trade-code')assert.ok(s.codes.length>0&&s.codes.every(code=>o.audit.world.codes.includes(code)));}
});
test('common and repeated random sources are separately attached to each recorded quantity roll',()=>{
 const offers=R.market(R.context({name:'Synthetic',uwp:'A788899-C',zone:'Safe'},core),{skill:0,counterparty:2},core,()=>1),o=offers.find(o=>o.commodity==='11');
 assert.equal(o.audit.quantityRolls[0].source.kind,'common');assert.equal(o.audit.quantityRolls.filter(q=>q.source.kind==='random').length,8);
 assert.deepEqual(o.audit.quantityRolls.slice(1).map(q=>q.source.draw),[1,2,3,4,5,6,7,8]);
});
test('audit displays recorded origins, preserves dice and never invents historical provenance',()=>{
 const h=harness(campaign()),offer={audit:{world:{codes:['Ri']},randomDraws:['11'],quantityRolls:[{dice:[2,3],populationDM:0,multiplier:10,tons:50}]}},before=JSON.stringify(offer);
 assert.match(h.api.availabilityAudit(offer,'11'),/Historical stock origin was not recorded/);assert.match(h.api.availabilityAudit(offer,'11'),/Not recorded/);assert.doesNotMatch(h.api.availabilityAudit(offer,'11'),/Common stock/);assert.equal(JSON.stringify(offer),before);
 offer.audit.quantityRolls[0].source={kind:'random',draw:1,id:'<img src=x>'};const html=h.api.availabilityAudit(offer,'11');assert.match(html,/Random draw 1/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(html,/2 \+ 3 = 5/);
});
