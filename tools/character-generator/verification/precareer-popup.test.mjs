import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../engine/session.mjs';
import {preCareerGroups,educationUnavailable,preCareerChoicesView,preCareerSourceView} from '../gui/precareer-popup.mjs';
const c=catalog(),esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const button=(label,action,cls='',attrs='')=>'<button data-action="'+action+'" class="'+cls+'" '+attrs+'>'+label+'</button>';
const state={stage:'precareer',character:{species:'human',terms:0,stats:{SOC:8}},educationAttemptTerms:[]};
const options={esc,button,sourceLabel:(s,p)=>s+' page '+p};
test('approved groups contain exactly four Core and five Companion choices',()=>{
 const groups=preCareerGroups(c);assert.deepEqual(groups.standard.map(p=>p.id),['core.university','core.academy-army','core.academy-marine','core.academy-navy']);
 assert.deepEqual(groups.additional.map(p=>p.id),['companion.colonial','companion.psionic','companion.merchant','companion.hard-knocks','companion.spacer']);assert.equal(new Set([...groups.standard,...groups.additional].map(p=>p.id)).size,9);
});
test('choice rendering preserves commands and supplies decorative artwork',()=>{
 const view=preCareerChoicesView(state,c,options);assert.equal((view.match(/data-action="precareer"/g)??[]).length,9);assert.equal((view.match(/class="precareer-art"/g)??[]).length,9);assert.equal((view.match(/aria-hidden="true"/g)??[]).length,11);
 for(const p of c.precareers)assert.ok(view.includes('data-id="'+p.id+'"'));assert.match(view,/id="precareer-extras" hidden/);assert.equal((view.match(/data-action="skip-precareer"/g)??[]).length,1);assert.doesNotMatch(view,/cancel-character|reset|restore/);
});
test('four Core illustrations are distinct',()=>{
 const view=preCareerChoicesView(state,{...c,precareers:preCareerGroups(c).standard},options);const svgs=[...view.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m=>m[0]);assert.equal(new Set(svgs).size,4);
});
test('term and attempted-term gates preserve disabled choices',()=>{
 for(const choice of c.precareers){assert.equal(!!educationUnavailable(state,choice),false);assert.equal(!!educationUnavailable({...state,character:{...state.character,terms:3}},choice),true);assert.equal(!!educationUnavailable({...state,educationAttemptTerms:[0]},choice),true);}
 assert.equal(!!educationUnavailable({...state,character:{...state.character,terms:1}},{maxTerm:1}),true);
 const blocked=preCareerChoicesView({...state,educationAttemptTerms:[0]},c,options);assert.equal((blocked.match(/ disabled/g)??[]).length,9);
});
test('returning Travellers are described as next career, not first',()=>{
 assert.match(preCareerChoicesView(state,c,options),/first.*career/);assert.match(preCareerChoicesView({...state,character:{...state.character,terms:1}},c,options),/next.*career/);
});
test('choice labels and source labels are escaped',()=>{
 const malicious={...c,precareers:[{id:'core.bad"<',name:'<img onerror=x>',source:'core',page:'<script>'}]};
 const view=preCareerChoicesView(state,malicious,options);assert.doesNotMatch(view,/<img|data-id="core.bad"</);assert.match(view,/&lt;img/);
 const source=preCareerSourceView(state,malicious,options);assert.doesNotMatch(source,/<img|<script>/);assert.match(source,/&lt;script&gt;/);
});
test('rules show all sources and never promise automatic admission',()=>{
 const source=preCareerSourceView(state,c,options);for(const p of c.precareers)assert.ok(source.includes(p.name));assert.match(source,/one entry attempt per term/);assert.match(source,/source decision/);
 const alien=preCareerSourceView({...state,character:{...state.character,stats:{}}},c,options);assert.match(alien,/does not grant admission or benefits automatically/);
});
test('views do not mutate catalog, state, attempts or scores',()=>{
 const before=structuredClone({state,c});preCareerGroups(c);preCareerChoicesView(state,c,options);preCareerSourceView(state,c,options);assert.deepEqual({state,c},before);
});
