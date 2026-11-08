import test from 'node:test';
import assert from 'node:assert/strict';
import {clanShareSelection,clanShareView,clanShareSheet} from '../gui/clan-share-view.mjs';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const context={esc,button:(label,action,cls='',attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>',sourceLabel:(id,page)=>id+' p. '+page};
const options={balance:3,checkpointAvailable:true,lots:[{id:'lot-1',label:'Source award',available:2,clanName:'Named clan',sourceVerified:true,clanVerified:true},{id:'lot-2',label:'Unknown clan',available:1,sourceVerified:true,clanVerified:false,needsClanVerification:true}],choices:[{id:'cash',name:'Cash',available:true,lotIds:['lot-1','lot-2']},{id:'contact',name:'Clan Contact',available:true,lotIds:['lot-1']},{id:'ally',name:'Upgrade Contact',available:true,lotIds:['lot-1']},{id:'unsupported',name:'Unavailable route',available:false,lotIds:[]}],contacts:[{id:'person-1',name:'Same name',eligibleLotIds:['lot-1']},{id:'person-2',name:'Same name',eligibleLotIds:[],verificationRequired:true}],clans:[{id:'clan-1',name:'Named clan'}]};
const state=(overrides={})=>({config:{gm:false},character:{},clanShareOptions:structuredClone(options),...overrides});
test('share choice helpers use only projected lot and Contact eligibility',()=>{
 const cash=clanShareSelection(options,'cash','lot-2');assert.equal(cash.lots.length,2);assert.equal(cash.lot.id,'lot-2');assert.equal(cash.favour,false);
 const ally=clanShareSelection(options,'ally','lot-1');assert.deepEqual(ally.contacts.map(c=>c.id),['person-1']);assert.equal(ally.favour,true);
 assert.equal(clanShareSelection(options,'contact','lot-2').lot,undefined);assert.deepEqual(clanShareSelection(options,'missing','lot-1').lots,[]);
});
test('normal exchanges are optional, start unselected and keep unspent shares',()=>{
 const html=clanShareView(state(),context);assert.match(html,/3 unspent/);assert.match(html,/You may keep shares unspent/);
 assert.match(html,/id="clan-share-kind"><option value=""/);assert.match(html,/value="unsupported" disabled/);assert.match(html,/data-action="redeem-clan-shares" disabled/);
 assert.doesNotMatch(html,/<table| checked|selected>/);
});
test('unknown clan source does not masquerade as a cash or Ship Share restriction',()=>{
 const html=clanShareView(state(),context);assert.match(html,/Known-source cash and Ship Shares do not need a named clan/);assert.match(html,/never adds shares or changes the awarded quantity/);
 assert.match(html,/Source only; clan unknown/);assert.match(html,/id="clan-verify-lot" disabled/);
});
test('GM provenance forms preserve stable duplicate-name identity and source-only verification',()=>{
 const html=clanShareView(state({config:{gm:true}}),context);assert.match(html,/value="person-2"/);assert.match(html,/Same name · person-2/);assert.match(html,/value="__source"/);assert.match(html,/value="__new"/);assert.doesNotMatch(html,/value="person-1">Same name/);
 assert.match(html,/id="clan-verify-reason" rows="3" maxlength="500"/);assert.match(html,/id="clan-verify-new" maxlength="80"/);
});
test('post-finish conversion warns that debt is not silently repaid',()=>{
 assert.match(clanShareView(state({stage:'finish'}),context),/New cash does not automatically repay existing debt/);
 assert.doesNotMatch(clanShareView(state({stage:'precareer'}),context),/Medical settlement is already recorded/);
});
test('reserved continuations and missing projection have no exchange or verification action',()=>{
 const blocked=state();blocked.clanShareOptions.checkpointAvailable=false;blocked.clanShareOptions.checkpointReason='Finish the pending effect.';
 const html=clanShareView(blocked,context);assert.match(html,/Finish the pending effect/);assert.doesNotMatch(html,/<button|<select/);
 assert.equal(clanShareView(state({clanShareOptions:null}),context),'');
 assert.doesNotMatch(clanShareView(state({clanShareOptions:{balance:2,checkpointAvailable:true}}),context),/<button/);
});
test('projected names and source labels are escaped, with wrapping live summaries',()=>{
 const s=state({config:{gm:true}});s.clanShareOptions.contacts[1].name='<Contact>';s.clanShareOptions.clans[0].name='<Clan>';
 const html=clanShareView(s,context);assert.match(html,/&lt;Contact&gt;/);assert.match(html,/&lt;Clan&gt;/);assert.doesNotMatch(html,/<Contact>|<Clan>/);
 for(const id of ['clan-share-lot-help','clan-share-contact-help','clan-verify-lot-help','clan-verify-contact-help','clan-verify-target-help','clan-contact-clan-help'])assert.match(html,new RegExp('id="'+id+'"[^>]*aria-live="polite"'));
});
test('sheet retains original awards, partial spending and forfeiture separately',()=>{
 const s={character:{clanShareLots:[{id:'lot-1',awarded:3,available:0,spent:1,forfeited:2}],clanShareRedemptions:[{kind:'contact',quantity:1,outputs:{relationshipAfter:{name:'<Person>'}}}]}};
 const html=clanShareSheet(s,context);assert.match(html,/3 awarded; 0 available; 1 exchanged; 2 forfeited/);assert.match(html,/&lt;Person&gt;/);assert.doesNotMatch(html,/<Person>/);assert.equal(clanShareSheet({character:{}},context),'');
});
