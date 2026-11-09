import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingInformation} from '../engine/training-information.mjs';
import {trainingInformationView,skillResultNotice} from '../gui/training-information.mjs';
import {api,exportSession} from '../engine/session.mjs';
import {trainingFixture,run} from './training-information-fixtures.mjs';
import {sourceTrainingFixture} from './source-training-fixtures.mjs';
import {coverResult} from './agent-cover-fixtures.mjs';
import {aslanSetup,aslanEvent,force,settle} from './aslan-officer-fixtures.mjs';
const esc=value=>String(value).replaceAll('<','&lt;');
test('table popup preserves implemented outcome order and characteristic bumps without dice labels',()=>{
 const skill=name=>({kind:'skill',name});
 const result=trainingInformation([[skill('Zeta')],[skill('Admin'),skill('Admin')],[{kind:'choice',options:[{effects:[skill('Broker')]},{effects:[skill('Admin')]}]}],[{kind:'stat',name:'INT',value:1}],[{kind:'conditional',condition:{gender:'male'},then:[skill('Male')],otherwise:[skill('Female')]}]],()=>true);
 assert.deepEqual(result,{skills:['Admin','Broker','Male','Zeta'],characteristics:['INT'],other:[],entries:['Zeta','Admin, Admin','Broker or Admin','INT +1','Male']});
 assert.doesNotMatch(JSON.stringify(result),/effects|value|row|dice|Female/);
 assert.match(trainingInformationView(result,'<script>',esc),/&lt;script>/);
});
test('ordinary, source and borrowed training project information without changing saves',()=>{
 const r=trainingFixture(),raw=exportSession(r.session);
 assert.ok(r.state.trainingOptions.every(option=>option.information.skills.length+option.information.characteristics.length+option.information.other.length));
 assert.deepEqual(api({operation:'import',raw}).session,r.session);
 assert.equal(exportSession(r.session),raw);
 let source=run(sourceTrainingFixture(),'choose-effect',{index:0});
 assert.ok(source.state.pendingChoice.options.every(option=>option.information.skills.length+option.information.characteristics.length+option.information.other.length));
 const borrowed=coverResult({vargr:true,careerId:'vargr.citizen'});
 assert.equal(borrowed.state.stage,'cross-career-training');
 assert.ok(borrowed.state.currentCrossCareerTraining.options.every(option=>option.information.skills.length+option.information.characteristics.length+option.information.other.length));
});
test('result notice reports actual skill gains and pending specialities without premature awards',()=>{
 const event={type:'training',changes:[{path:'skills.Recon',before:0,after:1}],rolls:[]};
 assert.equal(skillResultNotice(event,{stage:'survival'}),'Received: Recon 1 (was 0).');
 assert.equal(skillResultNotice({...event,changes:[]},{stage:'skill-choice',pendingChoice:{allowed:['Gun Combat']}}),'Pending award: Gun Combat. Choose the skill or speciality below to apply it.');
 assert.match(skillResultNotice({...event,changes:[]},{stage:'book-step'}),/source decision/);
 assert.equal(skillResultNotice({...event,changes:[]},{stage:'survival'}),'No skill or characteristic increase was applied.');
 assert.match(skillResultNotice({...event,changes:[{path:'stats.STR',before:8,after:9}]},{stage:'survival'}),/STR 9 \(was 8\)/);
});
test('actual training notification is grounded in audit and old summaries stay replayable',()=>{
 const pending=trainingFixture();
 for(const option of pending.state.trainingOptions){
  const r=run(pending,'training',{table:option.id}),event=r.log.at(-1),notice=skillResultNotice(event,r.state);
  assert.match(event.summary,/^Training \w+ result \d+\.$/);
  for(const change of event.changes.filter(c=>c.path.startsWith('skills.')&&c.after>c.before))assert.ok(notice.includes(change.path.slice(7)));
  assert.ok(notice.length);assert.deepEqual(api({operation:'import',raw:exportSession(r.session)}).log,r.log);
 }
});
test('Aslan Military assignment previews contain only reachable outcomes for each modifier',()=>{
 const cases=[
  {gender:'male',soc:8,skills:['Drive','Flyer','Gun Combat','Mechanic','Medic','Navigation','Pilot (small craft)']},
  {gender:'male',soc:5,skills:['Admin','Drive','Gun Combat','Mechanic','Medic','Navigation']},
  {gender:'female',soc:8,skills:['Admin','Electronics','Flyer','Gun Combat','Mechanic','Navigation','Pilot (small craft)']}
 ];
 for(const {gender,soc,skills} of cases){
  let r=aslanSetup('training-preview-'+gender+'-'+soc,gender);
  r=run(r,'gm-override',{field:'stat.SOC',value:soc,reason:'Reachable assignment preview boundary'});
  r=settle(force(r,'career',{id:'aslan.military',assignment:'support'},[6,6]));
  if(r.state.stage!=='training')r=settle(force(settle(aslanEvent(r,8)),'advancement',{},[6,6]));
  assert.equal(r.state.stage,'training');
  const raw=exportSession(r.session),information=r.state.trainingOptions.find(option=>option.id==='assignment').information;
  assert.deepEqual({skills:information.skills,characteristics:information.characteristics,other:information.other},{skills,characteristics:[],other:[]},gender+' SOC '+soc);
  assert.equal(information.entries.length,6);assert.ok(information.entries.every(Boolean));
  const imported=api({operation:'import',raw});assert.equal(imported.ok,true);
  assert.deepEqual(imported.state.trainingOptions,r.state.trainingOptions);
  assert.equal(exportSession(imported.session),raw);
 }
});

test('popup entries retain duplicate rows and signed characteristic amounts',()=>{
 const info=trainingInformation([[{kind:'skill',name:'Melee'}],[{kind:'stat',name:'STR',value:2}],[{kind:'skill',name:'Melee'}],[{kind:'stat',name:'END',value:-1}]]);
 assert.deepEqual(info.entries,['Melee','STR +2','Melee','END -1']);
 const html=trainingInformationView(info,'Personal development',esc);
 assert.match(html,/popover="auto"/);assert.match(html,/role="dialog"/);assert.match(html,/popovertargetaction="hide"/);assert.match(html,/aria-label="View skills and outcomes: Personal development"/);
 assert.ok(html.indexOf('Melee</li>')<html.indexOf('STR +2</li>'));assert.equal((html.match(/Melee<\/li>/g)||[]).length,2);
 assert.doesNotMatch(html,/<details|<summary|alphabetically/);
});
