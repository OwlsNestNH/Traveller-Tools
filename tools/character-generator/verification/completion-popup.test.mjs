import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceAssistedCoverageView} from '../gui/completion-popup.mjs';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
test('empty source coverage produces no empty heading or list',()=>{assert.equal(sourceAssistedCoverageView([],{labels:{},esc}),'');});
test('recorded coverage retains labels, order, fallback detail and inert text',()=>{const coverage=Object.freeze(['injury-zero','custom-<source>']),before=JSON.stringify(coverage),html=sourceAssistedCoverageView(coverage,{labels:{'injury-zero':'Injury survival rulings'},esc});assert.equal(html,'<h3>Source-assisted coverage</h3><ul><li>Injury survival rulings</li><li>custom &lt;source&gt;</li></ul>');assert.equal(JSON.stringify(coverage),before);assert.doesNotMatch(html,/<source>/);});
