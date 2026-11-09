import {equipmentFixture} from './concise-result-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {finalEventRows,finalEventsView} from '../gui/final-sheet-history.mjs';
import {api,exportSession,project} from '../engine/session.mjs';
import {finalSheetFixture,run} from './final-sheet-fixtures.mjs';
import {lifeFixture} from './core-life-event-fixtures.mjs';
const catalog=api({operation:'catalog'});
function synthetic(actions){
 return {session:{events:actions.map(({type,payload={}})=>({command:{type,payload}}))},log:actions.map(({type,summary='',rolls=[],changes=[],...extra},index)=>({number:index+1,type,summary,rolls,changes,...extra}))};
}

test('finished event history omits setup, rerolls, raw modifiers and correction bookkeeping without changing the full audit',()=>{
 const r=finalSheetFixture(),saved=exportSession(r.session),before=JSON.stringify(r),rows=finalEventRows(r,r.session,catalog),html=finalEventsView(r,r.session,catalog);
 assert.equal(rows.length,7);assert.deepEqual(rows.map(row=>row.number),[13,15,17,18,20,21,23]);
 assert.match(html,/Entered Intermediary \/ Arbitrator/);assert.match(html,/Qualification succeeded \(11 against 10\+\)/);assert.match(html,/Survival failed \(5 against 6\+\)/);
 assert.match(html,/Qualification: \[4, 5\] = 9/);assert.match(html,/Mishap table: \[5\] = 5/);assert.match(html,/Injury table: \[2\] = 2/);
 assert.match(html,/STR: 11 → 7/);assert.match(html,/STR: 7 → 11/);assert.match(html,/Medical bill: Cr20,000/);assert.match(html,/remaining medical debt Cr20000/);
 assert.doesNotMatch(html,/Started|Rolled statistics|GM override|GM replaced|Source check regression|Background skills|Skipped pre-career|Action \d+|&quot;(?:natural|modifier|success)&quot;|Career terms|Age:|Treatment selected|Officer commission removed|Benefit rolls: none/);
 assert.equal(JSON.stringify(r),before);assert.equal(exportSession(r.session),saved);assert.match(saved,/Rolled statistics|GM replaced/);
 assert.equal(finalEventsView(project(r.session),r.session,catalog),html);
});

test('a replay keeps original current-branch consequences rather than reversals from the discarded branch',()=>{
 const r=finalSheetFixture(),survival=finalEventRows(r,r.session,catalog).find(row=>row.number===15),injury=finalEventRows(r,r.session,catalog).find(row=>row.number===17);
 assert.deepEqual(r.log[14].changes,[],'The replacement itself has no audit delta because it repeated the same survival result');
 assert.ok(survival.details.includes('Must leave this career.'));
 assert.ok(r.log[16].changes.some(change=>change.path==='age'&&change.after<change.before),'The stored correction audit includes a branch rewind');
 assert.doesNotMatch([injury.summary,...injury.details].join(' '),/22 → 18|1 → 0|removed|superseded/);
});

test('past promotion and restrictions do not pick up later corrections or the final character state',()=>{
 const r=synthetic([
  {type:'career',summary:'Entered Army / Infantry automatically.',changes:[{path:'careers.0.rank',before:null,after:0},{path:'careers.0.officer',before:null,after:false}]},
  {type:'advancement',summary:'Advancement: {"natural":8,"total":10,"target":8,"success":true}. Rank 1.',rolls:[{label:'Advancement',values:[4,4],total:8}],changes:[{path:'careers.0.rank',before:0,after:1},{path:'careers.0.forcedStay',before:false,after:true}]},
  {type:'gm-override',payload:{field:'cash',reason:'Correction belongs only in troubleshooting'},summary:'GM override cash: 0 → 25000. Reason: Correction belongs only in troubleshooting',changes:[{path:'cash',before:0,after:25000}]},
  {type:'benefit',summary:'Rolled cash benefit 2 (DM 0).',rolls:[{label:'Cash benefit',values:[2],total:2}],changes:[{path:'cash',before:25000,after:27000}]}
 ]);
 r.state={character:{careers:[{rank:6}],cash:27000}};
 const rows=finalEventRows(r,r.session,catalog),html=finalEventsView(r,r.session,catalog);
 assert.equal(rows.length,3);assert.match(rows[1].details.join(' '),/Rank: 0 → 1/);assert.match(rows[1].details.join(' '),/Must stay/);
 assert.doesNotMatch(html,/rank 6|Correction belongs|25,000|27,000/);assert.match(rows[2].details.join(' '),/Cash \+Cr2,000/);
});

test('minimum history retains named life events and their current source decisions',()=>{
 let r=lifeFixture({row:11});r=run(r,'resolve-life-event',{confirmed:true,outcome:'prisoner',reason:'Source-confirmed prison sentence.'});
 const html=finalEventsView(r,r.session,catalog);
 assert.match(html,/Core Life Event 11: Crime/);assert.match(html,/Source-confirmed prison sentence/);assert.match(html,/Required next career: Prisoner/);assert.match(html,/Prison sentence recorded/);assert.doesNotMatch(html,/GM replaced|Exercise a specific life event row/);
});

test('source effects are readable, preserve restrictions, and never serialize payloads or duplicate free-text notes',()=>{
 const note='Do not sell {this ship}. <img src=x> Effects: [].',effects=[{kind:'cash',value:1000}],payload={confirmed:true,note,effects};
 const r=synthetic([{type:'resolve-book',payload,summary:'Source-assisted native-effect confirmed. '+note+' Effects: '+JSON.stringify(effects)+'.',changes:[
  {path:'cash',before:0,after:1000},{path:'qualificationBanned',before:false,after:true},
  {path:'benefits.0',before:null,after:{name:'Ship Share',quantity:1,redeemableForCash:false,condition:'Not transferable'}},
  {path:'assets.0',before:null,after:{name:'Scout ship',ownership:'use',owner:'Scout Service',recallable:true,condition:'Return on recall',mortgagePaidPercent:25}}
 ]}]);
 const html=finalEventsView(r,r.session,catalog);
 assert.match(html,/Do not sell \{this ship\}\. &lt;img src=x&gt; Effects: \[\]\./);assert.match(html,/Cash: Cr0 → Cr1,000/);assert.match(html,/qualification is barred/);
 assert.match(html,/Not transferable/);assert.match(html,/cannot be redeemed for cash/);assert.match(html,/Use only/);assert.match(html,/owned by Scout Service/);assert.match(html,/owner may recall/);assert.match(html,/Mortgage 25% paid/);
 assert.doesNotMatch(html,/&quot;kind&quot;|&quot;value&quot;|<img src=x>/);assert.equal(html.match(/Do not sell/g).length,1);
});

test('actual roll dice, kept dice and totals are separate from modified check totals',()=>{
 const r=synthetic([{type:'training',summary:'Training assignment result 11.',rolls:[{label:'Training: assignment',values:[6,5,1],kept:[6,5],total:11}],changes:[{path:'skills.Pilot',before:0,after:1}]}]);
 const html=finalEventsView(r,r.session,catalog);assert.match(html,/\[6, 5, 1\] → keep \[6, 5\] = 11/);assert.match(html,/Pilot: 0 → 1/);
});

test('setup-only and bookkeeping-only histories stay empty, including replayed statistics',()=>{
 let r=api({operation:'create',seed:'concise-history-setup'});r=run(r,'setup',{species:'aezorgh',aezorghTwoDice:true});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[1],reason:'Synthetic initial-die correction'});
 assert.deepEqual(finalEventRows(r,r.session,catalog),[]);assert.match(finalEventsView(r,r.session,catalog),/No career events recorded/);
});

test('mechanical dice show their recorded conversion and modifier, without inventing extra rolls',()=>{
 const r=synthetic([{type:'choose-effect',summary:'Chose the recorded consequence.',rolls:[{label:'Loss (D3)',values:[5],kept:[3],modifier:0,total:3},{label:'Delay (1D+3)',values:[2],kept:[2],modifier:3,total:5}]}]);
 const html=finalEventsView(r,r.session,catalog);assert.match(html,/Loss \(D3\): \[5\] → \[3\] = 3/);assert.match(html,/Delay \(1D\+3\): \[2\] \+3 = 5/);
});

test('equipment history names the item once and preserves its recorded source ruling',()=>{
 const r=equipmentFixture().after,html=finalEventsView(r,r.session);
 assert.equal((html.match(/Synthetic weapon/g)??[]).length,1);assert.match(html,/Received Synthetic weapon/);assert.match(html,/Synthetic equipment ruling/);assert.doesNotMatch(html,/Benefit: Synthetic weapon|Asset: Synthetic weapon|Owned by Traveller/);
});
