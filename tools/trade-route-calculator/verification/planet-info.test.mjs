import test from 'node:test';
import assert from 'node:assert/strict';
import {planetInformation,worldSheetURL} from '../js/planet-info.mjs';
const fist={name:'Fist',sector:'Trojan Reach',hex:'2918',uwp:'B789430-C',raw:{UWP:'B789430-C',PBG:'313',Zone:'',Bases:'',Allegiance:'ImDd',AllegianceName:'Third Imperium, Domain of Deneb',Stellar:'F1 V',Ix:'{ 1 }',Ex:'(A34-3)',Cx:'[1517]',Nobility:'B',Worlds:10,ResourceUnits:-360,Remarks:'Ni Ht',SubsectorName:'Tobia'}};
test('Fist live API example decodes planetary and system details without mutation',()=>{
 const before=structuredClone(fist),d=planetInformation(fist);
 assert.equal(d.decoded.find(r=>r[0]==='Atmosphere')[2],'Dense');
 assert.equal(d.summary.find(r=>r[0]==='Population')[1],'3 × 10^4 = 30,000');
 assert.equal(d.system.find(r=>r[0]==='Other worlds')[1],'5');
 assert.match(d.system.find(r=>r[0]==='Stars')[1],/Yellow-White Dwarf/);
 assert.equal(d.sections.find(r=>r[0]==='Economics')[1].at(-1)[2],'Poor');
 assert.deepEqual(d.remarks,[['Ni','Non-Industrial'],['Ht','High Technology']]);assert.deepEqual(fist,before);
 const url=new URL(worldSheetURL(fist));assert.equal(url.searchParams.get('sector'),'Trojan Reach');assert.equal(url.searchParams.get('milieu'),'M1105');
});
test('unknown data remains unknown, zero counts survive, overrides do not alter published information',()=>{
 const missing=planetInformation({sector:'Test',hex:'0101',uwp:'????????-?'});assert.equal(missing.summary.find(r=>r[0]==='Population')[1],'Not supplied');assert.equal(missing.system.find(r=>r[0]==='Gas giants')[1],'Not supplied');
 const x=planetInformation({...fist,overrideUWP:'X000000-0',raw:{...fist.raw,PBG:'000',UWP:'X000000-0',Worlds:1,Ex:'(A34+2)',Stellar:'M0 V D'}});
 assert.equal(x.summary.find(r=>r[0]==='Population')[1],'0 × 10^0 = 0');assert.equal(x.system.find(r=>r[0]==='Other worlds')[1],'0');assert.match(x.system.find(r=>r[0]==='Stars')[1],/White Dwarf/);assert.equal(x.sections.find(r=>r[0]==='Economics')[1].at(-1)[2],'Good');
 assert.equal(planetInformation({...fist,overrideUWP:'X000000-0'}).uwp,fist.uwp);
});
