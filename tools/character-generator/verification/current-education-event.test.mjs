import test from 'node:test';import assert from 'node:assert/strict';import{currentEducationEvent}from'../gui/current-education-event.mjs';import{educationReady,forceEducation,command}from'./education-result-fixtures.mjs';
test('accepted event survives notes and actual GM-tool commands without altering its dice',()=>{
 let r=forceEducation(educationReady('core.academy-army'),'education-event',{},[6,6]);const id=r.log.at(-1).id,dice=r.log.at(-1).rolls;
 for(const[type,payload]of[['notes',{text:'Synthetic event note'}],['gm-mode',{enabled:false}],['gm-psi-mode',{enabled:true}]]){r=command(r,type,payload);const event=currentEducationEvent(r,r.session);assert.equal(event.id,id);assert.deepEqual(event.rolls,dice);assert.equal(r.log.at(-1).rolls.length,0);}
});
test('restored pre-event branch never resurrects a superseded result',()=>{const before=educationReady('core.academy-army');let r=forceEducation(before,'education-event',{},[6,6]);r=command(r,'restore',{revision:before.revision});assert.equal(currentEducationEvent(r,r.session),null);});
