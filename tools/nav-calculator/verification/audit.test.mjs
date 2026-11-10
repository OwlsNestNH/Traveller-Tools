import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.NAV_BROWSER_CHANNEL?{channel:process.env.NAV_BROWSER_CHANNEL}:{})});
let checks=0;
const check=(value,expected,label)=>{assert.deepEqual(value,expected,label);checks++;};
try{
 const page=await browser.newPage({viewport:{width:320,height:740}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 if(process.env.NAV_TEST_URL)await page.goto(process.env.NAV_TEST_URL);
 else await page.setContent(await readFile(new URL('../index.html',import.meta.url),'utf8'));
 const fill=(id,value)=>page.locator('#'+id).fill(String(value));
 const select=(id,value)=>page.locator('#'+id).selectOption(String(value));
 const text=id=>page.locator('#'+id).textContent();
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 const active=()=>page.evaluate(()=>document.activeElement.id);
 await page.getByRole('checkbox',{name:'Show 100D jump clearance (advisory)',exact:true}).check();
 await select('jumpBodyType','gg_std');await click('Clear');await fill('thrust',1);await click('Compute 100D Only');
 check(await page.locator('#sizeCodeBlock').isVisible(),true,'rocky size restored');
 check(await active(),'resultsTop','100D focus');
 check((await text('statusText')).includes(await text('jumpOut')),true,'100D value announced');
 await page.locator('#use100d').uncheck();check(await text('d100Preview'),'100D clearance: —','disabled clearance preview');
 await fill('thrust','1e-320');await click('Compute 100D Only');check((await text('errorBox')).includes('finite range'),true,'clearance overflow rejected');
 await click('Clear');await select('distMode','orbit');await select('orbitEndWhole','12');await fill('orbitEndFrac',.5);
 check((await text('orbitPreview')).includes('460.5000'),true,'input preview');
 await click('Clear');await select('distMode','orbit');check((await text('orbitPreview')).includes('4.2000'),true,'reset preview');
 await fill('thrust',1);
 for(const id of ['orbitStartFrac','orbitEndFrac']){
   for(const value of [-5,1,'',.001]){
     await fill(id,value);await click('Solve Route');check((await text('errorBox')).includes('Enter Orbit#'),true,id+' rejects '+value);
     check(await page.evaluate(()=>lastBrief),'','invalid brief');check(await active(),'errorBox','error focus');
   }
   await fill(id,0);
 }
 for(const [whole,frac] of [[-1,0],[21,0],[1.5,0],['',0],[3,Infinity],[3,NaN],[3,'junk']]){
   check(await page.evaluate(([w,f])=>Number.isNaN(orbitToAU(w,f)),[whole,frac]),true,'invalid orbit conversion');
 }
 for(const frac of [0,.99]){await fill('orbitStartFrac',frac);await click('Solve Route');check(await text('errorBox'),'','valid boundary');}
 await select('distMode','map');await select('aMode','orbit');await select('bMode','orbit');
 for(const id of ['aOrbitFrac','bOrbitFrac']){
   await fill(id,-5);await click('Solve Route');check((await text('errorBox')).includes('Enter Orbit#'),true,'map rejects fraction');
   await fill(id,0);
 }
 await click('Clear');await select('distMode','map');await fill('au1',1);await fill('au2',5);
 check((await text('mapAUPreview')).includes('B 5.0000 AU'),true,'map preview on input');
 await click('Clear');check(await text('mapAUPreview'),'Map radii: —','map preview reset');
 await fill('thrust',1);await fill('distanceKm',100000);await click('Solve Route');
 await click('Compute 100D Only');await fill('thrust',2);await page.locator('#profile').focus();await select('profile','const');
 check(/\d/.test(await text('mainTime')),false,'route not revived');check(await page.evaluate(()=>lastBrief),'','brief not revived');check((await text('statusText')).startsWith('100D'),true,'explicit clearance mode');check(await active(),'profile','profile recompute retains focus');
 await click('Solve Route');check(/\d/.test(await text('mainTime')),true,'explicit route switches back');
 await click('Clear');await fill('thrust',1);await fill('distanceKm',100000);await select('profile','const');check(/\d/.test(await text('mainTime')),true,'clear resets route mode');
 check(await page.getByRole('checkbox',{name:'Apply Astrogation deviations (Effect)',exact:true}).count(),1,'astro name');
 await page.locator('#useAstro').check();check(await page.getByRole('checkbox',{name:'Auto-roll deviation dice',exact:true}).count(),1,'dice name');
 await select('distMode','map');await select('routeType','trans');const toggle=page.locator('#multHelpToggle');
 await toggle.focus();await page.keyboard.press('Enter');check(await toggle.getAttribute('aria-expanded'),'true','keyboard expands');await page.keyboard.press('Space');check(await toggle.getAttribute('aria-expanded'),'false','keyboard closes');
 await toggle.click();await select('routeType','direct');check(await toggle.getAttribute('aria-expanded'),'false','route hides help');
 await click('Clear');await fill('thrust',1);await fill('distanceKm',100000);
 for(let i=0;i<2;i++){await click('Solve Route');check(await active(),'resultsTop','repeated solve focus');check(await page.locator('#resultsTop').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.top<innerHeight;}),true,'results revealed');}
 check(await page.locator('[aria-live]').count(),1,'single live announcement');check((await text('statusText')).includes(await text('mainTime')),true,'result announced');
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'320px no overflow');
 check(await page.locator('.primary,.tile,.statusLine,.panelHead').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth)),true,'readouts do not clip');
 check((await page.locator('#jumpBlock').textContent()).includes('Added as a separate leg'),false,'truthful helper');
 for(const [api,fallback,success] of [['resolve','throw',true],['reject','true',true],['reject','false',false],['missing','throw',false],['missing','missing',false]]){
   await page.evaluate(({api,fallback})=>{
     window.copyCalls=0;window.copyAlerts=[];window.alert=message=>copyAlerts.push(message);
     Object.defineProperty(navigator,'clipboard',{configurable:true,value:api==='missing'?undefined:{writeText:async()=>{if(api==='reject')throw Error('denied');}}});
     document.execCommand=fallback==='missing'?undefined:()=>{copyCalls++;if(fallback==='throw')throw Error('failed');return fallback==='true';};
   },{api,fallback});
   await click('Copy NAV Brief');
   check(await page.evaluate(()=>copyAlerts.length),1,'one copy message');
   check(await page.evaluate(()=>copyAlerts[0].startsWith('NAV brief copied')),success,'truthful '+api+'/'+fallback);
   check(await page.locator('textarea').count(),0,'copy cleanup');
   check(await page.getByRole('button',{name:'Copy NAV Brief',exact:true}).evaluate(el=>el===document.activeElement),true,'copy focus restored');
   if(api==='resolve')check(await page.evaluate(()=>copyCalls),0,'no fallback after API success');
 }
 check(errors,[],'no browser exceptions');
 console.log(`PASS: ${checks} Nav audit regression checks (validation, reset/previews, explicit mode, clipboard failure, accessibility, focus and mobile readouts).`);
}finally{await browser.close();}

