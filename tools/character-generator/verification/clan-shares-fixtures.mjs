import assert from 'node:assert/strict';
import {buildAslanOriginFixture,run,force,rejected} from './aslan-origin-fixtures.mjs';
import {aslanEvent,aslanEndTerm,settle} from './aslan-officer-fixtures.mjs';
export {run,force,rejected};
const cache=new Map();
export function buildClanSharesFixture({gender='female',shares=6,stage='precareer',extras=[]}={}){
 const key=JSON.stringify({gender,shares,stage,extras});if(cache.has(key))return structuredClone(cache.get(key));
 let r=buildAslanOriginFixture({seed:'clan-share-source-'+(gender==='male'?9:50),gender,stage:'aslan-rite'});r=run(r,'roll-aslan-rite');assert.deepEqual(r.state.currentAslanOrigin.rite.dice,[1,1]);r=run(r,'gm-replay',{revision:r.revision,rollIndex:1,values:[shares],reason:'Source-earned Rite share quantity boundary'});
 if(r.state.stage==='aslan-rite-result')r=run(r,'acknowledge-aslan-rite');
 for(const id of extras)r=run(r,'add-extra',{id});
 if(stage!=='precareer')r=run(r,'skip-precareer');
 if(stage==='term-end'){r=settle(force(r,'career',{id:'aslan.military',assignment:gender==='male'?'warrior':'support'},[6,6]));r=aslanEndTerm(settle(aslanEvent(r,8)));}
 if(stage==='finish')r=run(r,'finish');assert.equal(r.state.stage,stage);cache.set(key,structuredClone(r));return r;
}
export function buildUnverifiedClanSharesFixture({stage='precareer'}={}){
 let r=force(buildAslanOriginFixture({stage:'aslan-rite'}),'roll-aslan-rite',{},[2,2]);assert.equal(r.state.pending.effect.kind,'equipment-credit');
 r=run(r,'resolve-book',{confirmed:true,note:'Explicit manual referee fixture award, not an automatically source-verified exchange.',effects:[{kind:'benefit',name:'Clan Share',value:3},{kind:'relationship',role:'Contact',name:'Same name'},{kind:'relationship',role:'Contact',name:'Same name'}]});
 if(r.state.stage==='aslan-rite-result')r=run(r,'acknowledge-aslan-rite');
 if(stage==='career')r=run(r,'skip-precareer');return r;
}

export function buildClanShareMedicalFixture(){
 let r=buildClanSharesFixture({stage:'career'});r=settle(force(r,'career',{id:'aslan.military',assignment:'support'},[6,6]));r=force(r,'survival',{},[1,1]);r=run(r,'injury-loss',{index:0});r=run(r,'injury-treatment',{restore:r.state.injuryRestorable,inService:false});assert.equal(r.state.character.medicalBills[0].personalCost,10000);return run(r,'leave-career');
}
