import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {applyCommand} from '../engine.mjs';
import {directFireFixture} from './direct-fire-fixture.mjs';
import {workflowAction} from './console-navigation.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const root=process.env.SHIP_COMBAT_TEST_ROOT||'http://127.0.0.1:8767/';
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const fixture=applyCommand(directFireFixture({}),{type:'next-battle-phase',phase:'attacks'});
const browser=await chromium.launch({headless:true});
try{for(const width of [1876,390,320]){
 const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<500}),p=await context.newPage();
 await p.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source+`\nimport {normalizeState as restoreNav} from './engine.mjs';state=restoreNav(${JSON.stringify(fixture)});selected=state.ships[0].id;render();window.__navState=()=>structuredClone(state);`}));
 await p.goto(new URL('tools/ship-combat-alpha/',root).href);const initial=await p.evaluate(()=>window.__navState());
 for(const nextWidth of [width,320,width,320,width]){await p.setViewportSize({width:nextWidth,height:900});await workflowAction(p,'round-review');assert.equal(await p.locator('#combat-report').isVisible(),true);await p.keyboard.press('Escape');assert.deepEqual(await p.evaluate(()=>window.__navState()),initial);}
 await context.close();console.log(`PASS workflow navigation ${width}`);
}}finally{await browser.close();}
