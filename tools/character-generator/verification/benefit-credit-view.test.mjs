import test from 'node:test';
import assert from 'node:assert/strict';
import {benefitCreditView} from '../gui/benefit-credit-view.mjs';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
test('one-roll benefit credits are visible, escaped and never preselected',()=>{const html=benefitCreditView({benefitCreditOptions:[{id:'credit-1',label:'<source>',value:1}]},{esc});assert.match(html,/name="benefit-credit" value="credit-1"/);assert.match(html,/&lt;source&gt;/);assert.doesNotMatch(html,/ checked|<source>/);assert.match(html,/Unused bonuses stay available/);});
test('no eligible one-roll credit produces no controls',()=>{assert.equal(benefitCreditView({benefitCreditOptions:[]},{esc}),'');});

test('one-roll credit uses its complete source label without repeating the bonus',()=>{const html=benefitCreditView({benefitCreditOptions:[{id:'credit-1',label:'Any career benefit +1',value:1}]},{esc});assert.match(html,/<span>Any career benefit \+1<\/span>/);assert.doesNotMatch(html,/\+1 \/ \+1/);});
