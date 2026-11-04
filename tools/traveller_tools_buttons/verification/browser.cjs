const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
 const page=await browser.newPage({acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root=process.env.LOCKER_TEST_URL || 'http://127.0.0.1:8765';
 await page.goto(root+'/tools/traveller_tools_buttons/');
 const links=page.locator('#grid a');
 const count=await links.count();assert.equal(count,44);
 const derelict=page.getByRole('link',{name:/Derelict Maps/});
 assert.equal(await derelict.count(),1);
 assert.equal(await derelict.getAttribute('href'),'https://derelictmaps.com/');
 assert.equal(await derelict.getAttribute('target'),'_blank');
 assert.equal(await derelict.getAttribute('rel'),'noopener noreferrer');
 for(const host of ['mytravelleruniverse.net','taunoyen.com','pgarriga.github.io','DoNotResuscitate/traveller-sector-gen','cthulhustig/autojimmy','travellercc.avorial.com'])assert.equal(await links.filter({has:page.locator('[class="url"]', {hasText:host})}).count(),1);
 for(const [query,expected] of [['derelict',1],['self-hosting',1],['command-line',1],['edition-agnostic',1],['ship sheets',1],['no-match-xyz',0]]){
  await page.locator('#search').fill(query);assert.equal(await links.count(),expected);
 }
 await page.locator('#search').fill('');
 await page.getByRole('button',{name:'Trade, Travel & Shops',exact:true}).click();assert.equal(await links.count(),4);
 const downloadEvent=page.waitForEvent('download');await page.locator('#export-links').click();
 const download=await downloadEvent;const exported=fs.readFileSync(await download.path(),'utf8');
 assert.equal((exported.match(/^- \[/gm)||[]).length,count);assert.match(exported,/public testing instance/);assert.match(exported,/\[Derelict Maps\]\(<https:\/\/derelictmaps\.com\/>\)/);
 await page.getByRole('button',{name:'All',exact:true}).click();
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+width);
 }
 await page.getByRole('link',{name:'Tool Locker Changelog'}).click();
 assert.match(await page.title(),/Traveller Tool Locker/);assert.ok(await page.locator('time[datetime="2026-11-03"]').count()>=2);
 assert.equal(await page.getByRole('heading',{name:/Derelict Maps/}).count(),1);
 assert.equal(await page.getByRole('link',{name:'Release #216',exact:true}).getAttribute('href'),'https://github.com/OwlsNestNH/Traveller-Tools/pull/216');
 for(const a of await page.locator('nav a').all()) {const response=await page.request.get(new URL(await a.getAttribute('href'),page.url()).href);assert.equal(response.status(),200);}
 await page.getByRole('link',{name:'Open Traveller Tool Locker'}).click();assert.ok(page.url().endsWith('/tools/traveller_tools_buttons/'));
 await page.goto(root+'/');await page.getByRole('link',{name:'Tool Locker Changelog'}).click();assert.ok(page.url().endsWith('/changes/locker.html'));
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS 44 links, Derelict Maps URL, safe new-tab attributes, search and export, six unique additions, description search, categories, complete export, responsive layout and changelog navigation');
})().catch(e=>{console.error(e);process.exit(1)});
