const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
 const page=await browser.newPage({acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root=process.env.LOCKER_TEST_URL || 'http://127.0.0.1:8765';
 await page.goto(root+'/tools/traveller_tools_buttons/');
 const discussions=page.getByRole('link',{name:'GitHub Discussions — help & feedback',exact:true});
 assert.equal(await discussions.count(),1);
 assert.equal(await discussions.getAttribute('href'),'https://github.com/OwlsNestNH/Traveller-Tools/discussions');
 assert.equal(await discussions.getAttribute('target'),'_blank');
 assert.equal(await discussions.getAttribute('rel'),'noopener noreferrer');
 const links=page.locator('#grid a');
 const count=await links.count();assert.equal(count,45);
 const missouri=page.getByRole('link',{name:/Missouri Archive/});
 assert.equal(await missouri.count(),1);
 assert.equal(await missouri.getAttribute('href'),'https://missouri.codemonki.net/');
 assert.equal(await missouri.getAttribute('target'),'_blank');
 assert.equal(await missouri.getAttribute('rel'),'noopener noreferrer');
 assert.equal(await missouri.locator('xpath=ancestor::section').getAttribute('data-section'),'Other Tools & Resources');
 const derelict=page.getByRole('link',{name:/Derelict Maps/});
 assert.equal(await derelict.count(),1);
 assert.equal(await derelict.getAttribute('href'),'https://derelictmaps.com/');
 assert.equal(await derelict.getAttribute('target'),'_blank');
 assert.equal(await derelict.getAttribute('rel'),'noopener noreferrer');
 for(const host of ['mytravelleruniverse.net','taunoyen.com','pgarriga.github.io','DoNotResuscitate/traveller-sector-gen','cthulhustig/autojimmy','travellercc.avorial.com'])assert.equal(await links.filter({has:page.locator('[class="url"]', {hasText:host})}).count(),1);
 for(const [query,expected] of [['missouri',1],['codemonki',1],['derelict',1],['self-hosting',1],['command-line',1],['edition-agnostic',1],['ship sheets',1],['no-match-xyz',0]]){
  await page.locator('#search').fill(query);assert.equal(await links.count(),expected);assert.ok(await discussions.isVisible());
 }
 await page.locator('#search').fill('');
 await page.getByRole('button',{name:'Trade, Travel & Shops',exact:true}).click();assert.equal(await links.count(),4);
 const downloadEvent=page.waitForEvent('download');await page.locator('#export-links').click();
 const download=await downloadEvent;const exported=fs.readFileSync(await download.path(),'utf8');
 assert.equal((exported.match(/^- \[/gm)||[]).length,count);assert.match(exported,/public testing instance/);assert.match(exported,/\[Derelict Maps\]\(<https:\/\/derelictmaps\.com\/>\)/);
 assert.ok(exported.includes('[Missouri Archive](<https://missouri.codemonki.net/>)'));
 await page.getByRole('button',{name:'All',exact:true}).click();
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+width);
 }
 await discussions.scrollIntoViewIfNeeded();
 await discussions.focus();assert.ok(await discussions.evaluate(el=>el===document.activeElement));
 const destination='https://github.com/OwlsNestNH/Traveller-Tools/discussions';
 await page.context().route(destination,route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Discussions destination</title>'}));
 const popupEvent=page.waitForEvent('popup');await discussions.click();
 const popup=await popupEvent;await popup.waitForLoadState();assert.equal(popup.url(),destination);await popup.close();
 await page.getByRole('link',{name:'Tool Locker Changelog'}).click();
 assert.match(await page.title(),/Traveller Tool Locker/);assert.ok(await page.locator('time[datetime="2026-11-03"]').count()>=2);
 assert.equal(await page.getByRole('heading',{name:/Derelict Maps/}).count(),1);
 assert.equal(await page.getByRole('link',{name:'Release #216',exact:true}).getAttribute('href'),'https://github.com/OwlsNestNH/Traveller-Tools/pull/216');
 for(const a of await page.locator('nav a').all()) {const response=await page.request.get(new URL(await a.getAttribute('href'),page.url()).href);assert.equal(response.status(),200);}
 await page.getByRole('link',{name:'Open Traveller Tool Locker'}).click();assert.ok(page.url().endsWith('/tools/traveller_tools_buttons/'));
 // Keep the optional remote badges pending to reproduce an unavailable image service.
 // The homepage UI, reload and keyboard flows must remain independently verifiable.
 const pendingBadges=[];
 await page.route('https://img.shields.io/**',route=>{pendingBadges.push(route);});
 const badgesPending=async()=>{
  await assert.rejects(page.waitForLoadState('load',{timeout:250}),{name:'TimeoutError'});
  assert.ok(pendingBadges.length>0,'homepage requested visit badge images');
  assert.equal(await page.evaluate(()=>document.readyState),'interactive');
 };
 const finishBadges=async()=>{
  await Promise.all(pendingBadges.splice(0).map(route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="90" height="20"><rect width="90" height="20" fill="#2b4cff"/></svg>'})));
  await page.waitForLoadState('load');
 };
 await page.goto(root+'/',{waitUntil:'domcontentloaded'});
 const homeDiscussions=page.getByRole('link',{name:'GitHub Discussions — Questions & Feedback',exact:true});
 await homeDiscussions.waitFor({state:'visible'});await badgesPending();
 assert.equal(await homeDiscussions.count(),1);
 assert.equal(await homeDiscussions.getAttribute('href'),destination);
 assert.equal(await homeDiscussions.getAttribute('target'),'_blank');
 assert.equal(await homeDiscussions.getAttribute('rel'),'noopener noreferrer');
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:640});await page.evaluate(()=>scrollTo(0,0));
  assert.ok(await homeDiscussions.isVisible());
  const box=await homeDiscussions.boundingBox();
  assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=640,'homepage Discussions above fold at '+width);
  assert.ok(box.height>=44,'homepage Discussions touch target at '+width);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'homepage overflow at '+width);
 }
 await finishBadges();
 await page.reload({waitUntil:'domcontentloaded'});await homeDiscussions.waitFor({state:'visible'});await badgesPending();await page.keyboard.press('Tab');
 assert.ok(await homeDiscussions.evaluate(el=>el===document.activeElement),'Discussions is first keyboard destination');
 const homePopupEvent=page.waitForEvent('popup');await page.keyboard.press('Enter');
 const homePopup=await homePopupEvent;await homePopup.waitForLoadState();assert.equal(homePopup.url(),destination);await homePopup.close();
 await finishBadges();
 await page.getByRole('link',{name:'Tool Locker Changelog'}).click();assert.ok(page.url().endsWith('/changes/locker.html'));
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS homepage readiness and reload with pending visit badges; homepage Discussions above fold at desktop/mobile, touch target and keyboard navigation; Tool Locker Discussions link visibility, keyboard focus and new-tab navigation; 45 links, Missouri Archive URL/category/search/export, Derelict Maps URL, safe new-tab attributes, search and export, six unique additions, description search, categories, complete export, responsive layout and changelog navigation');
})().catch(e=>{console.error(e);process.exit(1)});
