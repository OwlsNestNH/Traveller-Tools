import {legacySampleShips} from './legacy-sample-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,applyCommand} from '../engine.mjs';
import {beginSetup,editSetup,saveSetup} from '../setup-session.mjs';
import {crewContribution,effectiveDesign} from '../setup.mjs';
import {remainingPower} from '../ship-record.mjs';
import {beginConsoleDraft,commitConsoleDraft,conditionLimits} from '../console-draft.mjs';
import {normalizeState} from '../engine.mjs';
import {normalizeIdentity} from '../ship-identity.mjs';
import {sheetRows} from '../ship-sheet.mjs';
import {normalizeCrew,RATINGS} from '../setup.mjs';
import {bandRadii,renderRangeOverlay,SPACE_RADIUS,normalizeRangeMode,RANGE_MODES} from '../range-overlay.mjs';
import {rangeInfo,RANGE_BANDS,HEX_KM} from '../movement-rules.mjs';
import {toWorld} from '../geometry.mjs';

test('five-level crew scale is explicit and unversioned legacy totals migrate without inflation',()=>{
 assert.deepEqual(RATINGS,{Green:1,Regular:2,Veteran:3,Elite:4,Heroic:5});
 for(const [rating,total] of Object.entries(RATINGS)){const c=normalizeCrew({mode:'quick',ratingVersion:2,rating});assert.equal(crewContribution(c,'pilot'),total);assert.deepEqual(normalizeCrew(JSON.parse(JSON.stringify(c))),c);}
 for(const [rating,newRating,total] of [['Green','Green',1],['Veteran','Regular',2],['Elite','Veteran',3]]){
  const old={mode:'quick',rating,bonus:null,overrides:{pilot:0},details:{engineer:{name:'Existing',skillName:'Engineer',skill:2,characteristicDM:1}}};
  const c=normalizeCrew(JSON.parse(JSON.stringify(old)));assert.equal(c.rating,newRating);assert.equal(c.ratingVersion,2);assert.equal(crewContribution(c,'sensors'),total);assert.equal(crewContribution(c,'pilot'),0);assert.equal(c.details.engineer.name,'Existing');assert.deepEqual(normalizeCrew(c),c);
  const manual=normalizeCrew({...old,bonus:5});assert.equal(crewContribution(manual,'sensors'),5);assert.equal(manual.bonus,5);
  const detailed=normalizeCrew({...old,mode:'detailed'});assert.equal(crewContribution(detailed,'engineer'),3);
 }
 const s=createState();s.ships[0].crew={mode:'quick',rating:'Elite',overrides:{pilot:-1},bonus:null};const imported=normalizeState(JSON.parse(JSON.stringify(s)));assert.equal(crewContribution(imported.ships[0].crew,'sensors'),3);assert.equal(imported.ships[0].crew.rating,'Veteran');assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(imported))),imported);
 assert.throws(()=>normalizeCrew({rating:'Elite',ratingVersion:3}),/rating/);
});

test('range overlays share verified Euclidean band boundaries and never change the ship',()=>{
 assert.deepEqual(RANGE_BANDS.map(b=>b.max),[1,15,38,77]);const s=createState().ships[0],before=structuredClone(s),bands=bandRadii();
 for(const b of bands){const p=toWorld({q:b.max,r:0});assert.ok(Math.abs(Math.hypot(p.x,p.y)-b.radius)<1e-9);assert.equal(b.km,b.max*HEX_KM);assert.equal(rangeInfo({q:0,r:0},{q:b.max,r:0}).band,b.name);assert.ok(Math.abs(b.radius/b.max-SPACE_RADIUS)<1e-9);}
 assert.deepEqual(RANGE_MODES,['off','on']);assert.equal(normalizeRangeMode('off'),'off');for(const old of ['rings','shaded'])assert.equal(normalizeRangeMode(old),'on');
 const on=renderRangeOverlay(s,'on',2);assert.equal((on.rings.match(/<circle /g)||[]).length,4);assert.equal((on.shade.match(/fill-rule="evenodd"/g)||[]).length,4);for(const old of ['rings','shaded'])assert.deepEqual(renderRangeOverlay(s,old,2),on);assert.deepEqual(renderRangeOverlay(s,'off'),{shade:'',rings:''});assert.deepEqual(renderRangeOverlay(null,'on'),{shade:'',rings:''});assert.deepEqual(s,before);
 assert.throws(()=>renderRangeOverlay(s,'invalid'),/Invalid/);
});
const position={q:1,r:2},velocity={q:0,r:0};
const template={name:'Manual hull',tons:400,thrust:3,hull:100,armour:0,record:{className:'Custom escort',tl:12,ratedPower:150,fuelCapacity:42.5,jump:2,sensors:'Military',computer:'Computer/10',software:'Manoeuvre; Library',requirements:[{name:'Basic systems',power:80},{name:'Sensors',power:null}],weapons:[{id:'turret-1',name:'Dorsal turret',type:'Beam laser',count:2,ammunition:null}]}};
const add=s=>applyCommand(s,{type:'add-ship',name:'A1',template,position,velocity});

test('ship sheet identity, Side D and manual specials survive replay without changing template, motion, crew or systems',()=>{
 const initial=add(createState({ships:[]})),before=structuredClone(initial),s=initial.ships[0];
 const next=applyCommand(initial,{type:'set-identity',shipId:s.id,name:'Resolute <script>',identity:{allegiance:'Independent / Drinax',specials:[{name:'Manual stealth fit',detail:'Effect unverified; no automatic modifier'}]},side:'D',expectedRevision:initial.revision});
 assert.equal(next.ships[0].appearance.side,'D');assert.equal(next.ships[0].identity.allegiance,'Independent / Drinax');
 for(const key of ['template','designOverrides','motion','crew','systems','condition','capabilities','flight'])assert.deepEqual(next.ships[0][key],before.ships[0][key]);
 assert.deepEqual(initial,before);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(next))),next);
 assert.throws(()=>applyCommand(next,{type:'set-identity',shipId:s.id,name:'bad',identity:{allegiance:'x'.repeat(81)},side:'A'}),/Allegiance/);
 assert.throws(()=>applyCommand(next,{type:'set-identity',shipId:s.id,name:'bad',identity:{},side:'E'}),/Choose Side/);
 assert.throws(()=>applyCommand(next,{type:'set-identity',shipId:s.id,name:'stale',identity:{},side:'A',expectedRevision:initial.revision}),/State changed/);
 assert.match(sheetRows(next.ships[0]).rows.find(r=>r[0]==='Manoeuvre drive')[1],/^Available thrust 3 \/ design 3/);
});

test('legacy ship identity remains unknown, special records stay bounded and missing source stats never become mockup values',()=>{
 const old=createState({ships:legacySampleShips()});for(const s of old.ships)delete s.identity;
 const normalized=normalizeState(JSON.parse(JSON.stringify(old)));assert.deepEqual(normalized.ships[0].identity,{allegiance:'',specials:null});
 assert.deepEqual(normalizeIdentity({specials:[]}),{allegiance:'',specials:[]});
 assert.throws(()=>normalizeIdentity({specials:Array.from({length:17},()=>({name:'x'}))}),/16/);
 assert.throws(()=>normalizeIdentity({specials:[{name:'',detail:'x'}]}),/required/);
 const {rows}=sheetRows(normalized.ships[0]);assert.match(rows[0][1],/Unknown/);assert.equal(normalized.ships[0].condition.powerOutput,null);
});

test('console previews commit atomically to their original ship and revision only',()=>{
 const s=add(add(createState({ships:[]}))),before=JSON.stringify(s),draft=beginConsoleDraft(s,'ship-1');draft.values.hull='40';draft.values.fuel='12.75';draft.values.powerOutput='90';
 assert.equal(JSON.stringify(s),before);assert.throws(()=>commitConsoleDraft(s,draft,'ship-2'),/Return to the draft ship/);
 const next=commitConsoleDraft(s,draft,'ship-1');assert.equal(next.revision,s.revision+1);assert.deepEqual(next.ships[1],s.ships[1]);assert.deepEqual(next.ships[0].template,s.ships[0].template);assert.equal(next.ships[0].condition.fuel,12.75);
 assert.throws(()=>commitConsoleDraft(applyCommand(s,{type:'advance-round'}),draft,'ship-1'),/State changed/);assert.equal(JSON.stringify(s),before);
});
test('manual usable capacities distinguish damage from quantities without repair, refill or allocation changes',()=>{
 let s=add(createState({ships:[]}));s=applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{hull:60,powerOutput:100,powerUsed:90,fuel:12.25,usableHull:80,usablePower:120,usableFuel:30}});
 assert.deepEqual(conditionLimits(s.ships[0],'fuel'),{rated:42.5,original:42.5,usable:30,scale:42.5,lost:12.5});assert.equal(s.ships[0].template.hull,100);
 const before=JSON.stringify(s);for(const c of [{...s.ships[0].condition,usableFuel:12},{...s.ships[0].condition,usableHull:59},{...s.ships[0].condition,usablePower:99},{...s.ships[0].condition,usableFuel:43}])assert.throws(()=>applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:c}));assert.equal(JSON.stringify(s),before);
 const d=beginConsoleDraft(s,'ship-1');d.values.usableHull='';d.values.usablePower='';d.values.usableFuel='';const n=commitConsoleDraft(s,d,'ship-1');assert.deepEqual([n.ships[0].condition.hull,n.ships[0].condition.powerOutput,n.ships[0].condition.powerUsed,n.ships[0].condition.fuel],[60,100,90,12.25]);assert.equal(conditionLimits(n.ships[0],'hull').usable,100);assert.deepEqual(createState(JSON.parse(JSON.stringify(n))).ships,n.ships);
});
test('unknown capacity remains unknown and empty fuel or used power never implies capacity damage',()=>{
 let s=applyCommand(createState({ships:[]}),{type:'add-ship',name:'Unknown',template:{name:'Unknown',tons:1,thrust:0},position,velocity});assert.equal(conditionLimits(s.ships[0],'fuel').usable,null);
 let d=beginConsoleDraft(s,'ship-1');d.values.fuel='0';d.values.usableFuel='2.5';s=commitConsoleDraft(s,d,'ship-1');assert.equal(conditionLimits(s.ships[0],'fuel').rated,null);assert.equal(conditionLimits(s.ships[0],'fuel').usable,2.5);
 const known=applyCommand(add(createState({ships:[]})),{type:'set-condition',shipId:'ship-1',condition:{hull:50,fuel:0,powerOutput:150,powerUsed:149}}).ships[0];assert.equal(conditionLimits(known,'fuel').lost,0);assert.equal(conditionLimits(known,'powerOutput').lost,0);assert.equal(conditionLimits(known,'hull').usable,100);
});
test('extended setup distinguishes absent facts, zero values and explicitly empty equipment lists',()=>{
 const s=add(createState({ships:[]})),t=s.ships[0].template;
 assert.equal(t.record.fuelCapacity,42.5);assert.equal(t.armour,0);assert.equal(t.record.weapons[0].count,2);assert.equal(t.record.weapons[0].ammunition,null);assert.equal(t.record.requirements[1].power,null);
 const unknown=applyCommand(createState({ships:[]}),{type:'add-ship',name:'Unknown',template:{name:'Unknown',tons:1,thrust:0},position,velocity}).ships[0];assert.equal(unknown.template.record.weapons,null);assert.equal(unknown.template.record.ratedPower,null);assert.equal(unknown.condition.fuel,null);assert.equal(unknown.condition.criticals,null);
 const none=applyCommand(s,{type:'set-design',shipId:'ship-1',template:{...template,record:{weapons:[],fuelCapacity:0,ratedPower:0,jump:0}}}).ships[0];assert.deepEqual(effectiveDesign(none).record.weapons,[]);assert.equal(effectiveDesign(none).record.ratedPower,0);assert.equal(effectiveDesign(none).record.jump,0);
});
test('manual fuel/power/critical/weapon condition is independent per instance with honest unknowns',()=>{
 let s=add(add(createState({ships:[]})));const other=structuredClone(s.ships[1]),motion=structuredClone(s.ships[0].motion);
 s=applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{hull:75,fuel:20.25,powerOutput:120,powerUsed:100,criticals:'Fuel leak: manual loss recorded; sensor offline',weapons:[{id:'turret-1',ammunition:0,status:'offline'}]}});
 assert.equal(s.ships[0].condition.fuel,20.25);assert.equal(remainingPower(s.ships[0].condition),20);assert.equal(s.ships[0].template.record.ratedPower,150);assert.deepEqual(s.ships[1],other);assert.deepEqual(s.ships[0].motion,motion);
 const before=JSON.stringify(s);for(const fuel of [-1,42.5001,NaN,Infinity,'2']){assert.throws(()=>applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{fuel}}));assert.equal(JSON.stringify(s),before);}
 assert.equal(remainingPower({powerOutput:null,powerUsed:0}),null);assert.equal(remainingPower({powerOutput:0,powerUsed:0}),0);assert.equal(remainingPower({powerOutput:10,powerUsed:12}),-2);
});
test('invalid optional equipment and duplicate mount IDs reject atomically without invented defaults',()=>{
 const s=add(createState({ships:[]})),before=JSON.stringify(s);
 for(const record of [{fuelCapacity:-1},{ratedPower:NaN},{jump:1.5},{weapons:[{id:'bad',name:'',type:'Laser',count:1}]},{weapons:[template.record.weapons[0],template.record.weapons[0]]},{requirements:[{name:'Drive',power:-1}]}]){assert.throws(()=>applyCommand(s,{type:'set-design',shipId:'ship-1',template:{...template,record}}));assert.equal(JSON.stringify(s),before);}
 assert.throws(()=>applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{weapons:[{id:'turret-1',status:'automatically-fired'}]}}));
});
test('setup draft add/edit/remove never mutates live; Save is atomic, single revision, and stale-safe',()=>{
 const live=createState(),before=JSON.stringify(live);let draft=beginSetup(live);draft=editSetup(draft,{type:'clear-ships'});draft=editSetup(draft,{type:'add-ship',name:'A1',template,position,velocity});draft=editSetup(draft,{type:'set-condition',shipId:'ship-1',condition:{fuel:20}});
 assert.equal(JSON.stringify(live),before); // Cancel means dropping the session; no rollback writes are necessary.
 const saved=saveSetup(live,draft);assert.equal(saved.ships.length,1);assert.equal(saved.ships[0].condition.fuel,20);assert.equal(saved.revision,live.revision+1);assert.equal(saved.round,live.round);assert.equal(JSON.stringify(live),before);
 assert.throws(()=>editSetup(draft,{type:'advance-round'}),/cannot run inside setup/);assert.throws(()=>editSetup(draft,{type:'plot',shipId:'ship-1',target:position}),/cannot run inside setup/);
 const moved=applyCommand(live,{type:'advance-round'});assert.throws(()=>saveSetup(moved,draft),/State changed/);assert.equal(moved.round,1);
 const invalid=structuredClone(draft);invalid.draft.ships[0].condition.fuel=100;assert.throws(()=>saveSetup(live,invalid));assert.equal(JSON.stringify(live),before);
});
test('general crew bonus, explicit role overrides and nameless detailed stations stay separate',()=>{
 let s=add(createState({ships:[]}));s=applyCommand(s,{type:'set-crew',shipId:'ship-1',crew:{mode:'quick',rating:'Green',bonus:2,overrides:{pilot:3}}});assert.equal(crewContribution(s.ships[0].crew,'pilot'),3);assert.equal(crewContribution(s.ships[0].crew,'sensors'),2);
 s=applyCommand(s,{type:'set-crew',shipId:'ship-1',crew:{...s.ships[0].crew,mode:'detailed',details:{pilot:{name:'',skillName:'Pilot (spacecraft)',skill:1,characteristicDM:2}}}});assert.equal(crewContribution(s.ships[0].crew,'pilot'),3);assert.equal(s.ships[0].crew.details.pilot.name,'');assert.equal(s.ships[0].crew.overrides.pilot,3);assert.equal(s.ships[0].template.record.className,'Custom escort');
});

test('every preset supports instance overrides without replacing published facts or repairing/refilling',()=>{
 let s=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:'core-194',name:'A1',position,velocity});const original=structuredClone(s.ships[0].template);s=applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{hull:50,fuel:5,powerOutput:10,powerUsed:6}});const condition=structuredClone(s.ships[0].condition);
 s=applyCommand(s,{type:'set-design',shipId:'ship-1',template:{...original,hull:90,thrust:4,record:{...original.record,ratedPower:150,fuelCapacity:10}}});assert.deepEqual(s.ships[0].template,original);assert.equal(effectiveDesign(s.ships[0]).hull,90);assert.equal(effectiveDesign(s.ships[0]).record.ratedPower,150);assert.deepEqual(s.ships[0].condition,condition);assert.equal(s.ships[0].capabilities.thrust,1);
 const before=JSON.stringify(s);assert.throws(()=>applyCommand(s,{type:'set-design',shipId:'ship-1',template:{...effectiveDesign(s.ships[0]),record:{...effectiveDesign(s.ships[0]).record,fuelCapacity:4}}}));assert.equal(JSON.stringify(s),before);
 s=applyCommand(s,{type:'set-design',shipId:'ship-1',template:original});assert.equal(s.ships[0].designOverrides,null);assert.deepEqual(s.ships[0].condition,condition);
});
test('manual critical/fuel/cargo/crew/life-support records do not resolve effects on advance',()=>{
 let s=add(createState({ships:[]}));s=applyCommand(s,{type:'set-condition',shipId:'ship-1',condition:{hull:50,fuel:10.5,cargo:0,crewAvailable:0,lifeSupport:'Manually checked',criticals:[{system:'Fuel',severity:1,effect:'Manual loss pending',status:'open'}]}});const c=structuredClone(s.ships[0].condition);s=applyCommand(s,{type:'advance-round'});assert.deepEqual(s.ships[0].condition,c);assert.equal(c.crewAvailable,0);assert.equal(c.cargo,0);
});
test('Harrier is repaired design, with unknown fuel/ammo condition and no campaign damage applied',()=>{
 const s=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:'drinax-harrier-restored',name:'Harrier',position,velocity}),ship=s.ships[0];assert.deepEqual([ship.template.tons,ship.template.hull,ship.template.armour,ship.template.thrust,ship.template.record.ratedPower,ship.template.record.fuelCapacity],[200,88,4,6,260,42]);assert.equal(ship.template.source.page,10);assert.equal(ship.template.source.endPage,11);assert.equal(ship.condition.hull,88);assert.equal(ship.condition.fuel,null);assert.equal(ship.condition.powerOutput,260);assert.equal(ship.condition.weapons,null);assert.equal(ship.condition.criticals,null);assert.equal(ship.template.record.weapons[1].ammunition,null);
});

test('malformed record/override shapes reject before altering live state',()=>{
 const s=add(createState({ships:[]})),before=JSON.stringify(s);for(const record of [[],5,'equipment'])assert.throws(()=>applyCommand(s,{type:'set-design',shipId:'ship-1',template:{...template,record}}));const bad=structuredClone(s);bad.ships[0].designOverrides=[];assert.throws(()=>beginSetup(bad),/overrides must be a record/);assert.equal(JSON.stringify(s),before);
});

test('setup software edits preserve independent allocations and source records',async()=>{
 const {softwareSetupSystems}=await import('../software-setup.mjs');
 const systems={basicOverride:17,software:{processingOverride:99,installed:[{id:'evade',installed:2,running:1,origin:'source-record'},{id:'library',installed:0,running:0,origin:'manual'}]}};
 const ship={template:{record:{software:'Evade / 2'}},designOverrides:null,systems};
 assert.equal(softwareSetupSystems(ship,{record:{software:'Evade / 2'}}),systems);
 assert.equal(softwareSetupSystems(ship,{record:{software:'Evade / 3'}}),systems);
 const changed=softwareSetupSystems(ship,{record:{software:'Evade / 3; Fire Control / 1; Library / 0'}},{explicit:true});
 assert.equal(changed.basicOverride,17);assert.equal(changed.software.processingOverride,99);
 assert.deepEqual(changed.software.installed.map(p=>[p.id,p.installed,p.running]),[['evade',3,1],['fire-control',1,null],['library',0,0]]);
 assert.equal(ship.template.record.software,'Evade / 2');assert.equal(ship.systems.software.installed[0].installed,2);
 const unknown={...ship,designOverrides:{record:{software:null}}};assert.equal(softwareSetupSystems(unknown,{record:{software:null}}),systems);
});

test('setup validates changed capacity and current quantity in one transaction',async()=>{
 const {applySetupFields}=await import('../setup-session.mjs');
 const initial=applyCommand(createState(),{type:'add-ship',presetId:'core-194',name:'Synthetic capacity',position:{q:0,r:0},velocity:{q:0,r:0}}),ship=initial.ships.at(-1),design=structuredClone(effectiveDesign(ship));design.hull=40;
 const next=applySetupFields(initial,ship.id,{design,condition:{...ship.condition,hull:35},basic:ship.systems.basic});
 assert.equal(next.ships.at(-1).condition.hull,35);assert.equal(effectiveDesign(next.ships.at(-1)).hull,40);assert.deepEqual(next.ships.at(-1).template,ship.template);assert.equal(ship.condition.hull,80);assert.equal(next.revision,initial.revision+1);
 assert.throws(()=>applySetupFields(initial,ship.id,{design,condition:{...ship.condition,hull:41}}),/hull|Hull|capacity/);
 assert.throws(()=>applySetupFields(next,ship.id,{design:{...design,hull:45}},initial.revision),/revision|stale|changed/i);
});
