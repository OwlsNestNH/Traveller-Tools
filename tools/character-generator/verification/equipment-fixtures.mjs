import {createSession,execute} from '../engine/session.mjs';
export function awardedEquipmentFixture(revision){
 let session=createSession('benefit-public-4');if(revision)session.rulesRevision=revision;
 let r={session};const run=(type,payload={})=>r=execute(r.session,{type,payload});
 run('setup',{species:'human'});run('roll-statistics');run('accept-statistics');run('background',{skills:['Admin','Animals','Art']});run('skip-precareer');run('career',{id:'core.scout',assignment:'courier'});run('choose-effect',{index:0});run('survival');run('choose-effect',{index:0});run('advancement');run('training',{table:'service'});run('leave-career');run('gm-mode',{enabled:true});run('benefit',{cash:false});run('gm-replay',{revision:r.revision,rollIndex:0,values:[4],reason:'Equipment catalogue regression'});return r;
}

export function equipmentFixture(revision){let r=awardedEquipmentFixture(revision);if(r.state.stage!=='book-step'){r=execute(r.session,{type:'review-equipment'});r=execute(r.session,{type:'choose-deferred-equipment',payload:{id:r.state.character.deferredEquipment[0].id}});}return r;}

export function linkedFixture(){let r=awardedEquipmentFixture();const run=(type,payload={})=>r=execute(r.session,{type,payload});run('benefit',{cash:false});run('gm-replay',{revision:r.revision,rollIndex:0,values:[4],reason:'Repeated weapon award'});run('choose-effect',{index:1});return r;}

import {lifeFixture} from './core-life-event-fixtures.mjs';
export function artefactFinalizationFixture(row=3){let r=lifeFixture({seed:'life-566',unusual:row});for(const type of ['advancement','leave-career','benefit'])r=execute(r.session,{type,payload:type==='benefit'?{cash:true}:{}});return r;}
