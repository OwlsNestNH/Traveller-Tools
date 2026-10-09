import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/state.mjs';
import {configureFuel,bladderSpace} from '../js/fuel.mjs';
import {currentJumpAttempt} from '../js/jump-attempts.mjs';
const world=(x,name)=>({id:`${x},0`,x,y:0,name,sector:'Test',hex:`0${x+1}01`,uwp:'A788899-C',zone:'Safe'});
const worlds=[world(0,'Origin'),world(1,'Destination'),world(2,'Other')];
const roll=n=>({dice:Array(6).fill(n),total:6*n});
const roundtrip=s=>S.validate(JSON.parse(JSON.stringify(s)));
function campaign(){const s=S.initial();Object.assign(s,{initialized:true,actual:'0,0',worlds:Object.fromEntries(worlds.map(w=>[w.id,w])),route:['0,0','1,0','2,0'],bank:'100000'});s.ship.capacity='100';s.ship.fuel=configureFuel(200,40,60,1,2);s.ship.lifeSupport={capacityHours:672,remainingHours:672,elapsedHours:0};s.lots=[{id:'cargo',commodity:'11',description:'Existing cargo',quantity:'5',basis:'1000',goodsValue:'1000'}];s.policies=[{id:'policy',lotId:'cargo',claims:[],status:'active',initialQuantity:'5',remainingQuantity:'5',insuredValue:'1000',remainingValue:'1000',coverage:70,route:['0,0','1,0'],routeProgress:0,destination:'1,0'}];s.snapshots=[{id:'supplier',kind:'supplier',worldId:'0,0',hours:0,startedHours:0,offers:[{id:'offer',commodity:'11',description:'Saved offer',expired:false,remaining:'2',unitPrice:'100'}]}];s.contracts=[{id:'mail',kind:'mail',status:'accepted',firstDeparture:null,origin:'0,0',destination:'1,0',quantity:'5',payment:'1000',dueHours:null}];return S.validate(s);}
const material=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['events','undo','revision','jumpAttempts'].includes(key)));
function jump(original,n=2,elapsed=160){const p=S.prepareJump(original,()=>roll(n));return S.transition(p.state,'Jump: '+p.state.actual+' → '+p.state.route[p.state.routeIndex+1],s=>S.commitJump(s,{attemptId:p.attempt.id,elapsed}));}
test('one mulligan atomically restores actual origin, route, date, tank/bladders, life support, mail, insurance and saved cargo/market',()=>{
 const before=campaign(),after=jump(before);assert.equal(after.actual,'1,0');assert.equal(after.policies[0].status,'arrived');assert.equal(bladderSpace(after.ship),0);assert.equal(after.contracts[0].firstDeparture.to,'1,0');
 const undone=roundtrip(S.undoJump(roundtrip(after)));assert.deepEqual(material(undone),material(before));assert.equal(bladderSpace(undone.ship),20);assert.equal(currentJumpAttempt(undone).mulliganUsed,true);assert.equal(undone.events.filter(e=>e.label==='Jump audit').length,1);assert.match(undone.events.at(-1).reason,/mulligan/);assert.equal(undone.undo.length,before.undo.length);
 const rerolled=S.prepareJump(undone,()=>roll(6));assert.deepEqual(rerolled.roll,roll(6));const retried=jump(roundtrip(rerolled.state),1);assert.deepEqual(retried.events.findLast(e=>e.label==='Jump audit').dice,roll(6));assert.throws(()=>S.undoJump(retried),/Mulligan used/);assert.throws(()=>S.undo(retried),/Mulligan used/);
});
test('cancel, reopening, reload, changed destination and ordinary Undo never supply additional rolls',()=>{
 let calls=0;const rng=()=>{calls++;return roll(calls);};
 let s=S.prepareJump(campaign(),rng).state;const original=structuredClone(currentJumpAttempt(s));
 for(let i=0;i<3;i++)s=S.prepareJump(roundtrip(s),rng).state;
 s=S.transition(s,'Changed route',x=>x.route=['0,0','2,0']);s=S.prepareJump(s,rng).state;s=S.undo(s);s=S.prepareJump(roundtrip(s),rng).state;
 assert.equal(calls,1);assert.deepEqual(currentJumpAttempt(s),original);
 s=jump(s);s=S.undoJump(s);s=S.prepareJump(s,rng).state;s=S.prepareJump(roundtrip(s),rng).state;assert.equal(calls,2);assert.equal(currentJumpAttempt(s).mulliganUsed,true);assert.equal(currentJumpAttempt(s).rolls.length,2);
});
test('a later campaign action blocks Jump Undo even after that action is itself undone',()=>{
 let s=jump(campaign());s=S.transition(s,'Deposit',x=>S.deposit(x,10,'Later transaction'));
 assert.equal(S.jumpUndoEligibility(s).allowed,false);assert.throws(()=>S.undoJump(s),/later campaign change/);
 s=S.undo(s);assert.equal(s.bank,'100000');assert.throws(()=>S.undoJump(s),/later campaign change/);assert.throws(()=>S.undo(s),/later campaign change/);
});
test('a genuinely new departure visit gets its own allowance and preserves the spent previous record',()=>{
 let s=S.undoJump(jump(campaign()));s=jump(s,4);const first=s.jumpAttempts[0];s=jump(s,5);assert.equal(s.jumpAttempts.length,2);assert.equal(s.jumpAttempts[0].id,first.id);assert.equal(s.jumpAttempts[0].mulliganUsed,true);assert.equal(S.jumpUndoEligibility(s).allowed,true);s=S.undoJump(s);assert.equal(s.actual,'1,0');assert.equal(s.jumpAttempts[1].mulliganUsed,true);
});
test('fuel-warning, empty-space and zero-hour jumps still reverse all state',()=>{
 const s=campaign();s.ship.fuel.aboardTons=1;s.worlds['1,0'].emptySpace=true;s.worlds['1,0'].name='Empty hex';const after=jump(s,2,0);assert.equal(after.ship.fuel.aboardTons,0);assert.equal(after.events.find(e=>e.label==='Jump audit').fuel.shortfall,19);assert.deepEqual(material(S.undoJump(after)),material(s));
});
test('new allowance fields validate on export/import and cannot occur in any inverse patch',()=>{
 const s=jump(campaign());assert.deepEqual(roundtrip(s),s);assert.ok(s.undo.every(e=>e.inverse.every(op=>op.path[0]!=='jumpAttempts')));
 for(const mutate of [s=>delete s.jumpAttempts,s=>s.jumpAttempts='bad',s=>s.jumpAttempts[0].mulliganUsed='yes',s=>s.jumpAttempts[0].rolls[0].dice[0]=7,s=>s.jumpAttempts.push(structuredClone(s.jumpAttempts[0])),s=>s.jumpAttempts[0].rolls.push(roll(2)),s=>s.undo[0].inverse.push({path:['jumpAttempts'],value:[]})]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>roundtrip(bad));}
});
test('a complete legacy latest-jump audit can use one mulligan without rewriting prior history',()=>{
 const old=jump(campaign());old.events=old.events.filter(e=>e.label!=='Jump roll prepared');delete old.jumpAttempts;delete old.undo.at(-1).jumpEventId;const audit=old.events.find(e=>e.label==='Jump audit');delete audit.jumpAttemptId;delete audit.mulliganUsed;const saved=roundtrip(old);assert.equal(S.jumpUndoEligibility(saved).allowed,true);const undone=S.undoJump(saved);assert.equal(undone.actual,'0,0');assert.equal(currentJumpAttempt(undone).mulliganUsed,true);assert.deepEqual(undone.events.slice(0,-1),saved.events);assert.throws(()=>S.undo(jump(undone)),/Mulligan used/);
});
test('older incomplete jump audits remain explicitly unsupported by the dedicated control without breaking historical Undo',()=>{
 const old=jump(campaign());old.events=old.events.filter(e=>e.label!=='Jump roll prepared');delete old.jumpAttempts;delete old.undo.at(-1).jumpEventId;const audit=old.events.find(e=>e.label==='Jump audit');delete audit.jumpAttemptId;delete audit.dice;assert.equal(S.jumpUndoEligibility(old).allowed,false);assert.match(S.jumpUndoEligibility(old).reason,/older jump/);assert.equal(S.undo(old).actual,'0,0');
});
test('legacy later transactions remain disqualifying after reload and their History Undo',()=>{
 let s=jump(campaign());s=S.transition(s,'Deposit',x=>S.deposit(x,10,'Later legacy deposit'));delete s.jumpAttempts;s.events=s.events.filter(e=>e.label!=='Jump roll prepared');for(const e of s.events){delete e.jumpAttemptId;delete e.mulliganUsed;}for(const u of s.undo)delete u.jumpEventId;
 s=S.undo(roundtrip(s));assert.equal(s.bank,'100000');assert.equal(S.jumpUndoEligibility(s).allowed,false);assert.throws(()=>S.undoJump(s),/later campaign change/);assert.throws(()=>S.undo(s),/later campaign change/);
});
test('saved preview revision audits preserve complete legacy Mail proof across cancel, later actions and jump Undo',()=>{
 let source=campaign();source.contracts=[];source=S.transition(source,'Accepted mail',s=>S.acceptContract(s,{offerId:'legacy-mail-offer',kind:'mail',origin:'0,0',destination:'1,0',quantity:'5',payment:'1000',dueHours:null}));const id=source.contracts[0].id;delete source.contracts[0].firstDeparture;delete source.contracts[0].acceptanceEventId;
 assert.equal(S.mailCancellationEligibility(source,id).allowed,true);
 let cancelled=S.prepareJump(source,()=>roll(3)).state;cancelled=S.transition(cancelled,'Deposit',s=>S.deposit(s,1,'After cancelled preview'));assert.equal(S.mailCancellationEligibility(roundtrip(cancelled),id).allowed,true);
 let undone=S.undoJump(jump(source));assert.equal(S.mailCancellationEligibility(roundtrip(undone),id).allowed,true);assert.equal(Object.hasOwn(undone.contracts[0],'firstDeparture'),false);
 // An unrecorded replacement revision is still a real ambiguous seam.
 let seam=structuredClone(source);seam.revision++;seam=S.prepareJump(seam,()=>roll(3)).state;seam=S.transition(seam,'Deposit',s=>S.deposit(s,1,'After import seam'));assert.equal(S.mailCancellationEligibility(seam,id).allowed,false);
});
test('legacy Mail revision bridge rejects missing, duplicate, reordered and unknown preparation evidence',()=>{
 let source=campaign();source.contracts=[];source=S.transition(source,'Accepted mail',s=>S.acceptContract(s,{offerId:'bridge-mail',kind:'mail',origin:'0,0',destination:'1,0',quantity:'5',payment:'1000',dueHours:null}));const id=source.contracts[0].id;delete source.contracts[0].firstDeparture;
 const prepared=S.prepareJump(source,()=>roll(2)).state;
 const deposited=S.transition(prepared,'Deposit',s=>S.deposit(s,1,'Bridge test'));
 for(const mode of ['missing','duplicate','wrong-revision','unknown-attempt']){
  const bad=structuredClone(deposited),index=bad.events.findIndex(e=>e.label==='Jump roll prepared');
  if(mode==='missing')bad.events.splice(index,1);
  if(mode==='duplicate')bad.events.splice(index,0,{...bad.events[index],id:'duplicate-preparation'});
  if(mode==='wrong-revision')bad.events[index].preparedRevision--;
  if(mode==='unknown-attempt')bad.events[index].jumpAttemptId='unknown';
  assert.equal(S.mailCancellationEligibility(bad,id).allowed,false,mode);
 }
});
