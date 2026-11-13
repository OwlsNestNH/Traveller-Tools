import test from 'node:test';
import assert from 'node:assert/strict';
import {aslanTemplateAllSpecialties,aslanTemplateEntry,aslanTemplateTerm,settleTemplate,run,force,assertTemplateReplay} from './aslan-template-fixtures.mjs';
for(const {career,assignment,gender} of aslanTemplateAllSpecialties())test('Aslan complete native career: '+career.id+'/'+assignment.id+' ('+gender+')',()=>{
 let r=aslanTemplateEntry(career.id,assignment.id,gender);const original=structuredClone(r.state.character.careers[0]);
 for(let term=0;term<3;term++){r=aslanTemplateTerm(r);assertTemplateReplay(r);if(term<2)r=run(r,'continue-career');}
 assert.equal(r.state.character.careers[0].terms,3);assert.equal(r.state.character.careers[0].assignment,original.assignment);r=run(r,'leave-career');let awards=0;while(r.state.stage==='benefits'&&awards<12){r=settleTemplate(force(r,'benefit',{cash:false},[1]));awards++;assertTemplateReplay(r);}assert.ok(awards>=3);assert.notEqual(r.state.stage,'benefits','All available benefit rolls are consumed exactly once');assert.ok(r.state.character.careers[0].exit);assert.ok(['career','retirement','equipment-finalization'].includes(r.state.stage),'Living career exit reaches a normal continuation or finalization stage');assert.equal(r.state.character.species,'aslan');assertTemplateReplay(r);
});
