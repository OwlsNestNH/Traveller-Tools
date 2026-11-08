import test from 'node:test';
import assert from 'node:assert/strict';
import {relationshipLossView,relationshipLossSheet} from '../gui/relationship-loss-view.mjs';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const context={esc,button:(label,action,cls='',attributes='')=>'<button data-action="'+action+'" '+attributes+'>'+label+'</button>',sourceLabel:(id,page)=>id+' p. '+page};
test('relationship removal presents only engine-eligible entries with stable indices',()=>{const html=relationshipLossView({relationshipLossOptions:[{index:2,role:'Ally',name:'<someone>'},{index:4,role:'Contact',name:''}]},context);assert.match(html,/data-index="2"/);assert.match(html,/data-index="4"/);assert.match(html,/&lt;someone&gt;/);assert.match(html,/Unnamed relationship/);assert.doesNotMatch(html,/data-absent|<someone>/);});
test('missing eligible relationship uses explicit source confirmation without inventing an entry',()=>{const html=relationshipLossView({relationshipLossOptions:[]},context);assert.match(html,/relationship-absent/);assert.match(html,/relationship-loss-reason/);assert.match(html,/data-absent="true"/);assert.doesNotMatch(html,/ checked|data-index/);});
test('removed relationship ledger distinguishes actual removal from source absence',()=>{const html=relationshipLossSheet({character:{relationshipLosses:[{removed:{role:'Contact',name:'<name>'}},{absent:true,reason:'<ruling>'}]}},{esc});assert.match(html,/Contact: &lt;name&gt;/);assert.match(html,/No eligible relationship recorded/);assert.match(html,/&lt;ruling&gt;/);});

test('missing relationship projection fails closed rather than offering an absent ruling',()=>{const html=relationshipLossView({},context);assert.match(html,/unavailable/);assert.doesNotMatch(html,/<button|data-absent/);});
