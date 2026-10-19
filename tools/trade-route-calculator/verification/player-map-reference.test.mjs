import test from 'node:test';import assert from 'node:assert/strict';
import {referenceOrigin,referenceWorld,referenceFacts,hexDistance,referenceSectorAreas} from '../js/player-map-reference.mjs';
const raw={Name:'Regina',Sector:'Spinward Marches',Hex:'1910',WorldX:-110,WorldY:-70,UWP:'A788899-C',Bases:'NS',Zone:'',PBG:'703',Remarks:'Ri Pa Ph',Allegiance:'ImDd'};
test('explicit canonical reference and global coordinates stay bounded and consistent',()=>{
 assert.deepEqual(referenceOrigin(new URLSearchParams()),{sector:'Spinward Marches',hex:'1910'});
 for(const hex of ['0000','3341','191','<svg>'])assert.throws(()=>referenceOrigin(new URLSearchParams({sector:'Spin',hex})));
 const w=referenceWorld(raw);assert.equal(w.sectorX,-4);assert.equal(w.sectorY,-1);assert.equal(hexDistance(w,{x:-110,y:-69}),1);
 assert.throws(()=>referenceWorld({...raw,WorldX:1}));assert.throws(()=>referenceWorld({...raw,WorldX:Infinity}));
});
test('all eight UWP fields keep standard order with meanings, compact supplemental facts and no importance',()=>{
 const facts=referenceFacts(referenceWorld(raw),new Map([['ImDd','Third Imperium']]));
 assert.deepEqual(facts.fields.map(x=>x[0]),['Starport','Size','Atmosphere','Hydrographics','Population','Government','Law Level','Tech Level']);
 assert.equal(facts.fields[0][2],'Excellent');assert.match(facts.bases,/Scout/);assert.match(facts.zone,/Normal/);assert.equal(facts.gasGiants,'3');assert.match(facts.allegiance,/Third Imperium/);assert.match(facts.tradeCodes,/Ri/);assert.equal('importance' in facts,false);
 for(const [zone,label] of [['A','Amber'],['R','Red']])assert.match(referenceFacts(referenceWorld({...raw,Zone:zone})).zone,new RegExp(label));
});
test('missing and malformed source data stays unknown; markup remains text data',()=>{
 const f=referenceFacts(referenceWorld({...raw,Name:'<img src=x>',UWP:'bad',Bases:undefined,Zone:undefined,PBG:undefined,Remarks:undefined,Allegiance:undefined}));
 assert.equal(f.bases,'Unknown');assert.equal(f.zone,'Unknown');assert.equal(f.gasGiants,'Unknown');assert.equal(f.tradeCodes,'Unknown');assert.equal(f.allegiance,'Unknown');assert.ok(f.fields.every(x=>x[1]==='?'));
});

test('political coverage includes empty neighboring sectors across boundaries',()=>{
 assert.deepEqual(referenceSectorAreas({x:-97,y:-70},1),[{x:-4,y:-1},{x:-3,y:-1}]);
 assert.equal(referenceSectorAreas({x:-97,y:-79},5).length,4);
});
