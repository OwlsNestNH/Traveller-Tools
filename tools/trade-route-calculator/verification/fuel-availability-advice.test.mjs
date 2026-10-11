import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/expenses.mjs';
import * as S from '../js/state.mjs';
import {ruleInfo,referenceIndex,referenceMarkup} from '../js/rule-references.mjs';
const world=port=>({id:'0,0',name:'Synthetic port',uwp:port+'788999-C'});
test('fuel advice follows the Core 2022 facilities table and labels A/B unrefined as referee discretion',()=>{
 for(const port of ['A','B'])assert.match(E.fuelAvailabilityAdvice(world(port)),/Refined.*Unrefined.*referee discretion/);
 for(const port of ['C','D'])assert.match(E.fuelAvailabilityAdvice(world(port)),/Unrefined fuel is available/);
 for(const port of ['E','X','?'])assert.match(E.fuelAvailabilityAdvice(world(port)),/No starport fuel supply.*water collection.*roleplay/);
 assert.match(E.fuelAvailabilityAdvice({...world('A'),emptySpace:true}),/Starport None/);
 assert.match(E.fuelAvailabilityAdvice({...world('A'),overrideUWP:'D788999-C'}),/Starport D: Unrefined/);
 assert.match(ruleInfo('fuel-availability'),/data-rule-info="fuel-availability"/);assert.match(referenceIndex(),/fuel-availability/);assert.match(referenceMarkup('fuel-availability'),/257/);
});
test('fuel alert is optional for old saves, validates types, survives save/Undo and never changes fuel quotes',()=>{
 const s=S.initial();assert.equal(s.settings.fuelAvailabilityAlert,false);
 const old=structuredClone(s);delete old.settings.fuelAvailabilityAlert;S.validate(old);
 const n=S.transition(old,'Fuel advice setting',v=>v.settings.fuelAvailabilityAlert=true);S.validate(JSON.parse(JSON.stringify(n)));assert.equal(S.undo(n).settings.fuelAvailabilityAlert,undefined);
 for(const v of ['true',1,null]){const bad=structuredClone(s);bad.settings.fuelAvailabilityAlert=v;assert.throws(()=>S.validate(bad),/fuel-availability/);}
 for(const port of ['A','B','C','D','E','X'])for(const grade of ['refined','unrefined','water']){
  const w=world(port),input={kind:'fuel',fuelType:grade,tons:'3',otherSupplier:true,notes:'Synthetic referee supplier'};
  const before=E.expenseQuote(w,input);E.fuelAvailabilityAdvice(w);assert.deepEqual(E.expenseQuote(w,input),before);assert.equal(before.amount,grade==='refined'?'1500':grade==='unrefined'?'300':'0');
 }
});
