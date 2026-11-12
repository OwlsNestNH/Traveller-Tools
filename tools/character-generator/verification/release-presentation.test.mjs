import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {restoredAslanTrainingTagline} from '../gui/aslan-training-tagline.mjs';
import {attachSiteLinks} from '../gui/site-integration.mjs';
import {api} from '../engine/session.mjs';
const read=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url),'utf8');
const home=read('index.html'),tool=read('tools/character-generator/index.html'),changes=read('changes/character.html');
const version=html=>html.match(/<meta name="application-version" content="([^"]+)"/)?.[1];

test('homepage exposes source-assisted beta fourth and Ship Combat before the retained final Log card',()=>{
 const cards=[...home.matchAll(/<section class="tool-card">([\s\S]*?)<\/section>/g)].map(m=>m[1]);
 assert.deepEqual(cards.map(card=>card.match(/<h2>(.*?)<\/h2>/)[1]),['Nav Calculator','Traveller Tool Locker','Traveller Ship Operations — Beta','Character Generator - Beta','Traveller Vehicle Builder','Robot Builder - Beta','Ship Combat Alpha','Ship’s Log &amp; Ledger']);
 assert.deepEqual(cards.map(card=>card.match(/<a href="(tools\/[^"]+)"/)[1]),['tools/nav-calculator/','tools/traveller_tools_buttons/','tools/trade-route-calculator/','tools/character-generator/','tools/vehicle-builder/','tools/robot-builder/','tools/ship-combat-alpha/','tools/traveller_ship_logger_v2/']);
 assert.match(cards[3],/source-assisted beta/);assert.match(cards[3],/Zhodani are deferred/);assert.match(cards[3],/href="changes\/character.html"/);
 assert.equal((home.match(/img.shields.io\/badge\/dynamic\/json/g)||[]).length,8);
 assert.doesNotMatch(home,/<script[^>]*tool-visits/);
});

test('beta version, notice, printable disclaimer and notes agree with the released catalogue',()=>{
 assert.equal(version(tool),'0.1.0-beta.1');assert.equal(version(changes),version(tool));
 assert.match(tool,/id="release-version">Beta 0\.1<\/span>/);
 assert.match(tool,/Source-assisted beta/);assert.match(tool,/not a fully automated or independently rules-certified generator/);
 assert.match(read('tools/character-generator/gui/app.mjs'),/Source-assisted Beta 0\.1/);
 assert.match(read('tools/character-generator/README.md'),/0\.1\.0-beta\.1/);
 assert.match(read('tools/character-generator/NOTICE.html'),/Non-commercial source-assisted beta/);
 assert.doesNotMatch(tool+read('tools/character-generator/README.md'),/development preview|Do not publish/);
 const catalog=api({operation:'catalog'});assert.equal(catalog.ok,true);assert.equal(catalog.species.length,4);assert.equal(catalog.careers.length,36);
});

test('visible limitations, always-on log and unchanged read-only recovery remain explicit',()=>{
 for(const text of ['id="beta-notice-copy"','Human, Aslan, Vargr and Aezorgh','Zhodani are deferred','A listed career does not mean every event or benefit is automated','Some Companion buyouts','unusual Vargr psionic access','Cross-book eligibility','Notes do not automate future modifiers','older rules revisions can be recovered unchanged and read only','Download full log','id="log-download"','Unverified historical record','Download unchanged original'])assert.ok(tool.includes(text),text);
 for(const text of ['36 career entries','Zhodani species, careers and their Intendant/Noble PSI option are deferred','Manual consequences stay manual','future modifiers, permissions, transfers or deferred awards','Believer buyouts','kinship, Brotherhood, Secret School','Optional anagathics','unverified, read-only','unchanged-original download','no automatic migration','not cryptographic proof','canonical tool path only'])assert.ok(changes.includes(text),text);
 assert.match(changes,/not a complete, fully automated or independently rules-certified generator/);
});

test('changelog has accessible navigation, existing feedback, source editions and publisher notice',()=>{
 for(const text of ['<html lang="en">','name="viewport"','nav aria-label="Page navigation"','href="../tools/character-generator/"','href="../#copyright-notice"','a:focus-visible','min-height:44px','id="release-beta-0-1"','datetime="2026-11-09"','Dates shown in UTC','Core Rulebook Update 2022','Companion Update 2024','Aliens of Charted Space Volume 1 Update 2026','Journal of the Travellers\' Aid Society Volume 11','publisher notice','Public source files expose'])assert.ok(changes.includes(text),text);
 const feedback=read('changes/robot.html').match(/href="(mailto:[^"]+)"/)[1];assert.ok(changes.includes('href="'+feedback+'"'));
 assert.doesNotMatch(changes,/<table|<script|C:[\\/]|\/workspace\/|\/agent_notes\//i);
 assert.match(tool,/<a[^>]*id="release-changelog"[^>]*href="\.\.\/\.\.\/changes\/character.html"[^>]*target="_blank"[^>]*rel="noopener"[^>]*aria-label="[^"]*new tab/);
});

const counter=read('assets/js/tool-visits.js');
function count(pathname,hostname='owlsnestnh.github.io',visibilityState='visible'){
 const requests=[],events={};
 const document={visibilityState,body:{appendChild(){}},addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name]};
 const context=vm.createContext({document,location:{hostname,pathname,search:'?character=private',hash:'#private'},window:{},Image:class{set src(value){requests.push(value)}remove(){}}});
 vm.runInContext(counter,context);vm.runInContext(counter,context);return{requests,events,document};
}
test('character counter is canonical, once per page and does not transmit character/query/fragment',()=>{
 const path='/Traveller-Tools/tools/character-generator/',hit='https://hits.sh/owlsnestnh.github.io/Traveller-Tools/tools/character-generator.svg';
 for(const suffix of ['','index.html'])assert.deepEqual(count(path+suffix).requests,[hit]);
 for(const extra of ['NOTICE.html','gui/app.mjs','verification/'])assert.deepEqual(count(path+extra).requests,[]);
 for(const host of ['localhost','127.0.0.1','preview.example'])assert.deepEqual(count(path,host).requests,[]);
 assert.deepEqual(count('/Traveller-Tools/changes/character.html').requests,[]);
 const hidden=count(path,undefined,'hidden');assert.deepEqual(hidden.requests,[]);hidden.document.visibilityState='visible';hidden.events.visibilitychange();assert.deepEqual(hidden.requests,[hit]);assert.equal(hidden.events.visibilitychange,undefined);
});
test('site decoration does not request unavailable assets in standalone local runs',()=>{
 function attach(pathname,hostname){const scripts=[],link={href:'../../changes/character.html'},document={getElementById:()=>link,createElement:tag=>({tag}),body:{appendChild:script=>scripts.push(script)}};attachSiteLinks(document,{pathname,hostname});return{scripts,link};}
 for(const pathname of ['/','/index.html']){const x=attach(pathname,'127.0.0.1');assert.deepEqual(x.scripts,[]);assert.equal(x.link.href,'https://owlsnestnh.github.io/Traveller-Tools/changes/character.html');}
 assert.deepEqual(attach('/tools/character-generator/','localhost').scripts,[]);
 for(const suffix of ['','index.html']){const x=attach('/Traveller-Tools/tools/character-generator/'+suffix,'owlsnestnh.github.io');assert.equal(x.scripts.length,1);assert.equal(x.scripts[0].src,'../../assets/js/tool-visits.js');assert.equal(x.link.href,'../../changes/character.html');}
});


test('routed presentation fixture preserves browser crypto secure-context requirements',()=>{
 const browser=read('tools/character-generator/verification/release-presentation-browser.mjs');
 const origins=browser.match(/const origin=published\?'([^']+)':'([^']+)'/);
 assert.ok(origins,'Both routed origins remain explicit');
 for(const origin of origins.slice(1))assert.equal(new URL(origin).protocol,'https:',origin+' must expose secure browser APIs without a crypto shim');
 assert.match(browser,/capability\.secureContext,true/);
 assert.match(browser,/capability\.randomUUID,'function'/);
 assert.match(browser,/startupDiagnostics/);
 assert.match(browser,/requestFailures/);
 assert.doesNotMatch(browser,/ignoreHTTPSErrors|unsafely-treat-insecure-origin-as-secure/);
});

test('actual GUI startup reports missing browser UUID instead of rendering a partial character',async()=>{
 const app=read('tools/character-generator/gui/app.mjs'),begin=app.indexOf('async function start(){'),end=app.indexOf('\nexport const startupReady=start();',begin);
 assert.ok(begin>=0&&end>begin,'Inspect the actual startup function, not a rewritten implementation');
 async function run(crypto){
  const calls=[],messages=[];let renders=0;
  const context={crypto,restoredAslanTrainingTagline,call:async request=>{calls.push(request.operation);return api(JSON.parse(JSON.stringify(request)));},localStorage:{getItem:()=>null},key:'test',projection:undefined,storageWarning:'',setBusy:()=>{},updateRecovery:()=>{},render:()=>renders++,notify:(message,error)=>messages.push({message,error})};
  const ready=await vm.runInNewContext(app.slice(begin,end)+'\nstart();',context);return{calls,messages,renders,ready};
 }
 const unavailable=await run({});assert.equal(unavailable.ready,false);assert.equal(unavailable.renders,0);assert.deepEqual(unavailable.calls,['catalog']);assert.equal(unavailable.messages[0].error,true);assert.match(unavailable.messages[0].message,/Unable to start the rules engine: crypto.randomUUID is not a function/);
 const available=await run({randomUUID:()=> 'startup-capability-check'});assert.equal(available.ready,true);assert.equal(available.renders,1);assert.deepEqual(available.calls,['catalog','create']);assert.deepEqual(available.messages,[]);
});
