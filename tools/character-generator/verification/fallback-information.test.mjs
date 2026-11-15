import test from 'node:test';import assert from 'node:assert/strict';
import {failedQualificationModel,fallbackView,qualificationFallbackInformation} from '../gui/qualification-fallback.mjs';
const context={esc:String,button:(name,action,cls='',attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+name+'</button>'};
const base={stage:'failed-entry',character:{species:'human'},fallbackOptions:{normal:{name:'Enter Drifter',available:true,careerId:'core.drifter'},draft:{name:'Apply to the Core draft',available:false,reason:'The draft has already been used.'}}};
test('main fallback keeps actions and unavailable reason but puts detailed rules in information',()=>{
 const state=structuredClone(base),before=JSON.stringify(state),main=fallbackView(state,context),info=qualificationFallbackInformation(state);
 assert.match(main,/Your failed roll stays recorded/);assert.match(main,/The draft has already been used/);assert.match(main,/data-action="fallback"/);assert.match(main,/data-action="draft" disabled/);assert.doesNotMatch(main,/Rulebook|Use the.*projected|first term|once per lifetime/);assert.match(info.summary,/not limited to the first term/);assert.match(info.summary,/once per lifetime/);assert.match(info.summary,/already been used/);assert.equal(info.page,'18–20');assert.equal(JSON.stringify(state),before);
});
test('explicit Vargr fallback rights remain authoritative for Vargr and Companion career groups',()=>{
 for(const group of ['vargr','companion']){const state={...structuredClone(base),character:{species:'vargr',culture:'native'},failedQualificationContext:{group},fallbackOptions:{...structuredClone(base.fallbackOptions),normal:{name:'Enter Loner',careerId:'vargr.loner',available:true},drifter:{name:'Enter Drifter',available:true}}},before=JSON.stringify(state),info=qualificationFallbackInformation(state);assert.equal(info.page,'186–187');assert.match(info.summary,/Core Drifter or Loner/);assert.match(info.summary,/draft is unavailable/);assert.doesNotMatch(info.summary,/Available here:.*Vargr draft/);assert.equal(JSON.stringify(state),before);}
});
test('native Aslan fallback information preserves the distinct Outcast and Core-draft restriction',()=>{
 const state={...structuredClone(base),failedQualificationContext:{group:'aslan'},fallbackOptions:{...structuredClone(base.fallbackOptions),normal:{name:'Enter Outcast',available:true,careerId:'aslan.outcast'}}},info=qualificationFallbackInformation(state);assert.equal(info.page,'18–23');assert.match(info.summary,/does not by itself grant a Core draft/);assert.match(info.summary,/does not undo/);
});

test('Aezorgh Vargr-path generic fallback uses the matching source without changing species or rights',()=>{
 const state={...structuredClone(base),character:{species:'aezorgh',culture:'native'},failedQualificationContext:{group:'vargr',careerId:'vargr.citizen'},fallbackOptions:structuredClone(base.fallbackOptions)},before=JSON.stringify(state),model=failedQualificationModel(state,{careers:[{id:'vargr.citizen',name:'Citizen'}]});assert.equal(model.fallback,true);assert.equal(model.career.id,'vargr.citizen');assert.equal(model.template.source,'Core Rulebook Update 2022 · pp. 18–20');assert.doesNotMatch(qualificationFallbackInformation(state).summary,/Loner|Vargr draft/);assert.equal(JSON.stringify(state),before);
});

test('legacy Loner-only fallback cites Aliens without advertising newer draft or Drifter permissions',()=>{
 const state={...structuredClone(base),character:{species:'vargr',culture:'native'},failedQualificationContext:{group:'vargr'},fallbackOptions:{normal:{name:'Enter Loner',careerId:'vargr.loner',available:true},draft:{name:'Apply to the Core draft',available:false,reason:'This saved route does not authorise a draft.'}}},before=JSON.stringify(state),info=qualificationFallbackInformation(state);assert.equal(info.page,'186–187');assert.match(info.summary,/Available here: Loner/);assert.match(info.summary,/does not authorise/);assert.doesNotMatch(info.summary,/Core Drifter|Vargr draft|records one roll/);assert.equal(JSON.stringify(state),before);
});
