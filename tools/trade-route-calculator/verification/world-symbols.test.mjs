import test from 'node:test';
import assert from 'node:assert/strict';
import {worldMapFacts,worldSymbols,mapKeyMarkup} from '../js/world-symbols.mjs';
import {planetInformation} from '../js/planet-info.mjs';
const make=(raw={})=>({name:'Test',sector:'Test',hex:'0101',uwp:'C774622-5',zone:'Safe',gasGiants:3,raw});
test('published symbol data preserves unknown, explicit absence, and eHex counts',()=>{
 const missing=worldMapFacts(make());assert.equal(missing.gasGiants,null);assert.equal(missing.bases,null);assert.equal(missing.zone,null);assert.equal(missing.naval,null);
 const none=worldMapFacts(make({Bases:'',PBG:'000',Zone:''}));assert.equal(none.gasGiants,0);assert.equal(none.naval,false);assert.equal(none.scout,false);assert.equal(none.zone,'');
 assert.equal(worldMapFacts(make({PBG:'10J'})).gasGiants,18);
 assert.equal(worldMapFacts(make({UWP:'XXXXXXX-X'})).starport,null);
 assert.equal(worldMapFacts(make({UWP:'???????-?'})).starport,null);
 assert.equal(worldMapFacts(make({UWP:'X000000-0'})).starport,'X');
 assert.equal(planetInformation(make({UWP:'XXXXXXX-X',PBG:'000'})).summary.find(r=>r[0]==='Population')[1],'Not supplied');
 for(const value of [undefined,null,'?'])assert.equal(planetInformation(make({Bases:value})).system.find(r=>r[0]==='Bases')[1],'Not supplied');
 for(const value of ['',' ','-'])assert.equal(planetInformation(make({Bases:value})).system.find(r=>r[0]==='Bases')[1],'None recorded');
});
test('modern base codes do not conflate way stations, depots, or legacy codes',()=>{
 for(const bases of ['N','K','NS'])assert.equal(worldMapFacts(make({Bases:bases})).naval,true);
 for(const bases of ['D','O','A','B','F','H'])assert.equal(worldMapFacts(make({Bases:bases})).naval,false);
 assert.equal(worldMapFacts(make({Bases:'NS'})).scout,true);
 assert.equal(worldMapFacts(make({Bases:'KM',Allegiance:'ZhCo'})).naval,false);
 for(const bases of ['NW','W','V'])assert.equal(worldMapFacts(make({Bases:bases})).scout,false);
});
test('published starport and zones remain separate from effective calculator overrides',()=>{
 const world={...make({UWP:'C774622-5',Zone:'A',Bases:'NS',PBG:'101'}),overrideUWP:'X000000-0',zone:'Red'};
 const before=structuredClone(world),facts=worldMapFacts(world);assert.equal(facts.starport,'C');assert.equal(facts.zone,'A');
 const close=worldSymbols(world,100,200,{close:true,selected:true,actual:true,scale:120});
 for(const cls of ['symbol-starport','symbol-gas-giant','symbol-naval','symbol-scout','zone-amber','symbol-selection','symbol-ship'])assert.ok(close.includes(cls),cls);
 assert.ok(!worldSymbols(world,100,200,{close:false,scale:50}).includes('symbol-starport'));
 for(const [zone,expect] of [['U','A'],['F','R'],['G',''],['-',''],['?',null]])assert.equal(worldMapFacts(make({Zone:zone})).zone,expect);
 assert.deepEqual(world,before);assert.match(mapKeyMarkup(),/Political borders show allegiance territory, not travel zones/);
});
