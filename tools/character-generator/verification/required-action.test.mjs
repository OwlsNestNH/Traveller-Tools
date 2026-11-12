import test from 'node:test';
import assert from 'node:assert/strict';
import {ARMY_SKILL_HEADLINES,REQUIRED_HEADLINES,requiredHeadline,actionRequirements,missingField,clearRequiredActions} from '../gui/required-action.mjs';
test('all eight approved banks have six stable, reachable headlines',()=>{
 assert.deepEqual(Object.keys(REQUIRED_HEADLINES),['starting','skills','rolls','career','event','details','referee','generic']);
 for(const [type,bank] of Object.entries(REQUIRED_HEADLINES)){
  assert.equal(bank.length,6);assert.equal(new Set(bank).size,6);
  const selected=new Set();for(let n=0;n<100;n++){const key='checkpoint-'+n;selected.add(requiredHeadline(type,key));assert.equal(requiredHeadline(type,key),requiredHeadline(type,key));}
  assert.deepEqual(selected,new Set(bank));
 }
 assert.equal(requiredHeadline('unknown','checkpoint'),requiredHeadline('generic','checkpoint'));
});
test('requirements follow actual conditional branches; optional paths invent no fields',()=>{
 assert.deepEqual(actionRequirements('setup',{}, {species:'human'}),[]);
 assert.equal(actionRequirements('setup',{}, {species:'aslan'})[0].selector,'#setup-gender');
 for(const action of ['skip-precareer','skip-education-commission','finish-psionic-training','retain-equipment-credit','resolve-landhold-details','resolve-artefact-details','network-error','corrupt-save','finish'])assert.deepEqual(actionRequirements(action),[]);
 assert.deepEqual(actionRequirements('resolve-aslan-restoration',{}, {accept:'false'}),[]);
 assert.deepEqual(actionRequirements('resolve-aslan-outlaw-restoration',{}, {decision:'decline'}),[]);
 assert.equal(actionRequirements('resolve-aslan-restoration',{}, {accept:'true'}).length,4);
 assert.ok(actionRequirements('resolve-book',{pending:{kind:'source-characteristic-check'}}).some(r=>r.selector==='#source-check-natural'&&r.type==='rolls'));
 assert.ok(!actionRequirements('resolve-book',{pending:{kind:'native-effect'}}).some(r=>r.selector==='#book-note'));
 assert.ok(!actionRequirements('resolve-life-event',{pending:{decision:'betrayal'}}).some(r=>r.selector==='#life-name'));
 assert.ok(actionRequirements('resolve-life-event',{pending:{decision:'artefact'}}).some(r=>r.selector==='#life-name'));
});
test('missing values include whitespace, unchecked confirmations and invalid numbers, while zero is valid',()=>{
 for(const value of ['', '  '])assert.equal(missingField({value}),true);
 assert.equal(missingField({value:'0',validity:{valid:true}}),false);
 assert.equal(missingField({value:'3.5',validity:{valid:false}}),true);
 assert.equal(missingField({type:'checkbox',checked:false}),true);
 assert.equal(missingField({type:'checkbox',checked:true}),false);
});

import {CROW_INTRODUCTION,crowVariant,crowAsset} from '../gui/crow-assistance.mjs';
test('Crow introduction keeps only the approved product history and assistance role',()=>{
 assert.equal(CROW_INTRODUCTION.expansion,'Cognitive Relay Operations Web');assert.match(CROW_INTRODUCTION.series,/Ling Standard Products.*7.4/);
 assert.match(CROW_INTRODUCTION.history.join(' '),/1078/);assert.match(CROW_INTRODUCTION.history.join(' '),/1079/);assert.match(CROW_INTRODUCTION.history.join(' '),/optional shipboard Virtual Crew/);
 assert.equal(CROW_INTRODUCTION.slogan,'Not just smart. Judgmental.');assert.doesNotMatch(JSON.stringify(CROW_INTRODUCTION),/Flort|Wages of Sin/);
 assert.match(CROW_INTRODUCTION.role,/You make the decisions/);
});

test('scope clearing hides an orphaned warning after its invalid effect control is removed',()=>{
 const warning={hidden:false};clearRequiredActions({querySelector:()=>null,querySelectorAll:selector=>selector==='.required-action-warning'?[warning]:[]});assert.equal(warning.hidden,true);
 const attrs=new Map([['aria-invalid','true'],['aria-describedby','original-help required-action-warning-1']]);
 const control={getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 clearRequiredActions({querySelector:()=>null,querySelectorAll:selector=>selector==='.required-action-warning'?[warning]:[control]});assert.equal(attrs.has('aria-invalid'),false);assert.equal(attrs.get('aria-describedby'),'original-help');
});

test('only the three approved costume roles are selected; absent artwork falls back to the real base',()=>{
 assert.equal(crowVariant('skills'),'professor');assert.equal(crowVariant('referee'),'referee');
 for(const type of ['starting','rolls','career','event','details','generic','unknown'])assert.equal(crowVariant(type),'technician');
 const base={verified:true},education={approved:true};assert.equal(crowAsset('skills',{professor:education},base),education);assert.equal(crowAsset('referee',{},base),base);assert.equal(crowAsset('skills',{},null),null);
});

test('Army skill warnings retain six reachable variants without education-only wording',()=>{
 assert.equal(ARMY_SKILL_HEADLINES.length,6);assert.equal(new Set(ARMY_SKILL_HEADLINES).size,6);
 const selected=new Set();for(let n=0;n<100;n++){const key='checkpoint-'+n;selected.add(requiredHeadline('skills',key,'core.army'));assert.equal(requiredHeadline('skills',key,'core.army'),requiredHeadline('skills',key,'core.army'));}
 assert.deepEqual(selected,new Set(ARMY_SKILL_HEADLINES));assert.ok(ARMY_SKILL_HEADLINES.every(text=>!/diploma|study|school/i.test(text)));
 assert.equal(requiredHeadline('skills','checkpoint','other'),requiredHeadline('skills','checkpoint'));
 for(const type of ['starting','rolls','career','event','details','referee','generic'])assert.equal(requiredHeadline(type,'checkpoint','core.army'),requiredHeadline(type,'checkpoint'));
});
