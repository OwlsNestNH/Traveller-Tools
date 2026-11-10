import test from 'node:test';
import {openingInfoButton} from '../gui/opening-help.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {setupOptionalSummary,syncSetupOptionalSummary} from '../gui/setup-options.mjs';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('optional setup summary distinguishes defaults and retained selected settings',()=>{
 assert.equal(setupOptionalSummary(),'No optional extras · GM changes off');
 assert.equal(setupOptionalSummary(['LCK','PSI'],true),'Optional extras: LCK, PSI · GM changes on');
 assert.equal(setupOptionalSummary([],true,true),'No optional extras · GM changes on · Zhodani PSI option on');
 const summary={textContent:''},selected=[{value:'LCK'}],gm={checked:false},form={querySelector:()=>summary,querySelectorAll:()=>selected,elements:{gm}};
 syncSetupOptionalSummary(form);assert.equal(summary.textContent,'Optional extras: LCK · GM changes off');gm.checked=true;syncSetupOptionalSummary(form);assert.equal(summary.textContent,'Optional extras: LCK · GM changes on');assert.deepEqual(selected,[{value:'LCK'}]);assert.equal(gm.checked,true);
 assert.doesNotThrow(()=>syncSetupOptionalSummary(null));
});
test('actual setup view keeps essential fields and Begin outside the optional disclosure',()=>{
 const source=read('gui/app.mjs'),start=source.indexOf('function setupView(){'),end=source.indexOf('\nfunction syncPsiOptions(',start);
 const setup=vm.runInNewContext(source.slice(start,end)+';setupView()', {projection:{state:{}},catalog:{species:[{id:'human'},{id:'vargr',variants:[]}],extraStats:[{id:'LCK',name:'Luck',source:'Companion 2024 p. 5'},{id:'PSI',name:'Psionic strength',source:'Core 2022 p. 228'}]},options:()=>'',esc:String,setupOptionalSummary,openingInfoButton});
 const parts=setup.match(/^([\s\S]*?)<details name="opening-gm-sections" id="setup-optional-settings">([\s\S]*?)<\/details>([\s\S]*)$/);assert.ok(parts);
 for(const name of ['name','species','gender','homeworld','boons','allocation','minimumReroll'])assert.ok(parts[1].includes('name="'+name+'"'),name);
 assert.match(parts[2],/<summary>Characteristic options<span id="setup-optional-summary">No optional extras · GM changes off<\/span><\/summary>/);
 assert.match(parts[2],/name="extras" value="LCK"/);assert.match(parts[2],/name="extras" value="PSI"/);assert.doesNotMatch(parts[2],/name="extras" value="PSI"[^>]*disabled/);assert.match(parts[1],/name="gm"/);assert.doesNotMatch(parts[1],/name="gm"[^>]*checked/);assert.match(parts[3],/name="aezorghTwoDice"/);assert.match(parts[3],/name="academyServiceSkill"/);
 assert.match(parts[3],/<button type="submit">Begin character<\/button>/);
 assert.match(source,/syncPrisonerLawyerControls\(\$\)/);assert.match(source,/syncSetupOptionalSummary\(event.target.form\)/);
});
test('compact warning keeps complete limits in the same disclosure and retains every file action',()=>{
 const html=read('index.html'),css=read('styles.css');
 assert.match(html,/<strong>Source-assisted beta\.<\/strong> Some outcomes need your books and referee\./);
 const limits=html.match(/<details id="automation-limits">([\s\S]*?)<\/details>/)?.[1];assert.ok(limits);
 for(const text of ['not a fully automated or independently rules-certified generator','explicit source confirmation','keep unsupported consequences with your referee','Zhodani are deferred','Notes do not automate future modifiers','older rules revisions can be recovered unchanged and read only'])assert.ok(limits.includes(text),text);
 for(const id of ['export','import','print','new','log-download'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(css,/font:18px\/1\.55/);assert.match(css,/\.toolbar button,\.toolbar \.button\{min-height:54px\}/);assert.match(css,/#automation-limits>summary\{min-height:44px\}/);
});

test('saved identity GM state is shown honestly and setup can explicitly disable it',()=>{
 const source=read('gui/app.mjs'),start=source.indexOf('function setupView(){'),end=source.indexOf('\nfunction syncPsiOptions(',start);
 const setup=vm.runInNewContext(source.slice(start,end)+';setupView()', {projection:{state:{config:{gm:true}}},catalog:{species:[{id:'human'},{id:'vargr',variants:[]}],extraStats:[]},options:()=>'',esc:String,setupOptionalSummary,openingInfoButton});
 assert.match(setup,/GM changes on/);assert.match(setup,/name="gm" type="checkbox" checked/);
 assert.ok(source.includes("if(!!values.get('gm')!==projection.state.config.gm&&!await send('gm-mode',{enabled:!!values.get('gm')}))return;"));
});
test('setup wording distinguishes current round-up from historical undefined flag',()=>{
 const source=read('gui/app.mjs'),start=source.indexOf('function setupView(){'),end=source.indexOf('\nfunction syncPsiOptions(',start);
 const render=state=>vm.runInNewContext(source.slice(start,end)+';setupView()', {projection:{state},catalog:{species:[{id:'human'},{id:'vargr',variants:[]}],extraStats:[]},options:()=>'',esc:String,setupOptionalSummary,openingInfoButton});
 assert.match(render({aezorghRoundUp:true}),/rounding up, then apply/);
 assert.match(render({}),/rounding down \(historical save\), then apply/);
});
