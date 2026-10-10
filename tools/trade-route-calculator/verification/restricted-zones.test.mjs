import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalize} from '../js/map.mjs';
import {worldMapFacts} from '../js/world-symbols.mjs';
import * as R from '../js/rules.mjs';
import * as S from '../js/state.mjs';
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url)));
const mp=JSON.parse(await readFile(new URL('../rules/merchant-prince-1e.json',import.meta.url)));
const raw=zone=>({WorldX:0,WorldY:0,Sector:'Test',Hex:'0101',Name:'Restricted world',UWP:'A788899-C',PBG:'703',Zone:zone});
const destination={...normalize(raw('')),id:'1,0',x:1,hex:'0201',name:'Safe destination'};
for(const [code,zone,total,premium]of [['A','Amber',14,'10000'],['U','Amber',14,'10000'],['R','Red',10,'13000'],['F','Red',10,'13000'],['','Safe',16,'8000'],['G','Safe',16,'8000'],['-','Safe',16,'8000']]){
 test(`Traveller Map ${code||'blank'} agrees across symbols, pricing, freight/mail traffic and insurance`,()=>{
  const w=normalize(raw(code)),ctx=R.context(w,core),dest=R.context(destination,core);
  assert.equal(w.zone,zone);assert.equal(ctx.zone,zone);assert.equal(worldMapFacts(w).zoneName,zone);
  assert.equal(R.freightDM(ctx,dest,1,0,core).total,total);
  assert.equal(R.mailModifiers(ctx,dest,1,0,{armed:false},{rank:0,soc:0},core).dm.total,total);
  assert.equal(R.insuranceQuote(100000,70,1,[ctx.zone,dest.zone],mp).premium,premium);
  assert.equal(w.raw.Zone,code);
 });
}
test('Referee effective zone overrides and saved historical audits remain untouched',()=>{
 for(const code of ['U','F']){
  const w=normalize(raw(code));w.zone='Safe';assert.equal(R.context(w,core).zone,'Safe');assert.notEqual(worldMapFacts(w).zoneName,'Safe');
  const s=S.initial();s.worlds={[w.id]:w,[destination.id]:destination};s.actual=w.id;s.initialized=true;s.route=[w.id,destination.id];
  s.events=[{id:'zone-history',label:'Old freight audit',hours:0,audit:{world:{...w,zone:'Safe'},dm:16}}];
  const before=JSON.stringify(s);S.validate(s);assert.equal(JSON.stringify(s),before);
 }
});
