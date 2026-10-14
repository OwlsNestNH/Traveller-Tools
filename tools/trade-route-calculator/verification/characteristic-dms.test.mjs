import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../js/rules.mjs';
import * as S from '../js/state.mjs';
import {harness} from './app-harness.mjs';
import {guiFixture} from './fixtures/gui-parity.mjs';

for(const characteristic of [-3,0,4])test(`legacy search ${characteristic} and distinct mail SOC round-trip without migration`,()=>{
 const s=guiFixture().state;s.trader.characteristic=characteristic;s.trader.soc=-2;
 const raw=JSON.stringify(s),d=R.characteristicDMs(s.trader);
 assert.deepEqual(d,{int:0,edu:characteristic,soc:characteristic});
 for(const method of ['normal','blackMarket','online'])assert.equal(R.tradeSearchCharacteristic(s.trader,method),characteristic);
 S.validate(s);assert.equal(JSON.stringify(s),raw);assert.deepEqual(S.validate(JSON.parse(raw)).trader,s.trader);
 assert.equal(s.trader.soc,-2);assert.equal('characteristics' in s.trader,false);
});
test('split trade search defaults select one permitted DM; stored INT and mail SOC are independent',()=>{
 const trader={characteristic:7,soc:9,characteristics:{int:20,edu:-2,soc:3}};
 assert.equal(R.tradeSearchCharacteristic(trader,'normal'),3);
 assert.equal(R.tradeSearchCharacteristic(trader,'blackMarket'),3);
 assert.equal(R.tradeSearchCharacteristic(trader,'online'),-2);
 trader.characteristics.int=-30;trader.soc=-8;
 assert.equal(R.tradeSearchCharacteristic(trader,'blackMarket'),3);
 assert.equal(R.tradeSearchCharacteristic(trader,'online'),-2);
 assert.equal(trader.characteristic,7);assert.equal(trader.soc,-8);
});
test('partial or malformed split imports are rejected rather than reseeded',()=>{
 for(const characteristics of [null,[],{int:0,edu:1},{int:0,edu:'1',soc:2},{int:0.5,edu:1,soc:2},{int:0,edu:Infinity,soc:2}]){
  const s=guiFixture().state;s.trader.characteristics=characteristics;
  assert.throws(()=>S.validate(s),/Characteristic DMs/);
 }
});
test('actual Settings save persists all three DMs without merging mail/legacy values; reload and Undo restore old backup',async()=>{
 const s=guiFixture().state;s.trader.characteristic=2;s.trader.soc=-1;
 const before=structuredClone(s),h=harness(s);h.api.actions['settings-edit']();
 h.fill({intDM:'5',eduDM:'-2',tradeSocDM:'3'});await h.submit();
 const saved=h.persisted();assert.deepEqual(saved.trader,{...before.trader,characteristics:{int:5,edu:-2,soc:3}});
 for(const key of ['bank','ledger','lots','contracts','policies','snapshots','hours','actual','route'])assert.deepEqual(saved[key],before[key],key);
 const imported=S.validate(JSON.parse(JSON.stringify(saved)));assert.deepEqual(imported.trader,saved.trader);
 assert.equal(imported.undo.length,before.undo.length+1);
 const undone=S.undo(imported);assert.deepEqual(undone.trader,before.trader);assert.equal('characteristics' in undone.trader,false);
 assert.equal(R.tradeSearchCharacteristic(undone.trader,'online'),2);
});
test('actual supplier search records an explicit characteristic override and preserves existing audits',async()=>{
 const s=guiFixture().state;s.trader.characteristic=2;s.trader.soc=-1;s.trader.characteristics={int:20,edu:-2,soc:3};
 const before=structuredClone(s),h=harness(s);h.api.searchDialog();
 assert.equal(h.dom.fields().get('characteristic').value,'-2','Online initial default is EDU');
 h.fill({party:'Synthetic overridden search',method:'blackMarket',dice:'12',duration:'1',characteristic:'-4'});await h.submit();await h.submit();
 const saved=h.persisted(),snapshot=saved.snapshots.at(-1);assert.equal(snapshot.search.characteristic,-4);assert.equal(snapshot.search.method,'blackMarket');assert.equal(snapshot.search.hours,24);
 assert.deepEqual(saved.snapshots.slice(0,-1),before.snapshots);assert.deepEqual(saved.trader,before.trader);
});

for(const method of ['normal','blackMarket','online'])for(const override of ['', '0'])test(`actual buyer ${method} search uses ${override===''?'permitted characteristic default':'explicit zero'} when reviewing`,async()=>{
 const s=guiFixture().state;s.trader.characteristics={int:20,edu:-2,soc:3};
 const before=structuredClone(s),h=harness(s);h.api.searchDialog('buyer');
 h.fill({party:'Synthetic characteristic buyer',method,dice:'12',duration:'1',characteristic:override});
 await h.submit();assert.deepEqual(h.persisted(),before,'Reviewing never saves');await h.submit();
 const saved=h.persisted(),snapshot=saved.snapshots.at(-1);
 assert.equal(snapshot.search.characteristic,override==='0'?0:method==='online'?-2:3);
 assert.equal(snapshot.search.method,method);assert.equal(snapshot.search.hours,method==='online'?1:24);
 assert.deepEqual(saved.trader,before.trader);assert.deepEqual(saved.snapshots.slice(0,-1),before.snapshots);
 assert.equal(saved.bank,before.bank);assert.deepEqual(saved.lots,before.lots);
});
