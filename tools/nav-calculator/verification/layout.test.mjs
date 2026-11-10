import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const modulePath=process.env.PLAYWRIGHT_MODULE||process.argv[2]||'playwright';
const {chromium}=createRequire(import.meta.url)(modulePath);
const root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url)));
let server;
let base=process.env.NAV_TEST_ROOT;
if(!base){
  server=createServer(async(req,res)=>{
    try{
      let target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
      const relative=path.relative(root,target);
      if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Outside test root');
      if((await stat(target)).isDirectory())target=path.join(target,'index.html');
      const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[path.extname(target)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':type});res.end(await readFile(target));
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}/`;
}
base=base.replace(/\/?$/,'/');
const url=base+'tools/nav-calculator/';
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.NAV_BROWSER_CHANNEL?{channel:process.env.NAV_BROWSER_CHANNEL}:{})});
  const context=await browser.newContext();
  // Third-party visit images and analytics are irrelevant to UI correctness.
  await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  const actions=page.getByRole('group',{name:'Navigation actions'});
  assert.deepEqual(await actions.getByRole('button').allTextContents(),['Solve Route','Compute 100D Only','Clear']);
  const geometry=async(label)=>{
    const measurements=await actions.locator('button').evaluateAll(buttons=>buttons.map(button=>{
      const box=button.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(button);
      return {x:box.x,y:box.y,width:box.width,height:box.height,clientWidth:button.clientWidth,scrollWidth:button.scrollWidth,clientHeight:button.clientHeight,scrollHeight:button.scrollHeight,textRects:[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom})),right:box.right,bottom:box.bottom};
    }));
    for(const box of measurements){
      assert.ok(Math.abs(box.width-measurements[0].width)<1,label+': equal widths');
      assert.ok(Math.abs(box.height-measurements[0].height)<1,label+': equal heights');
      assert.ok(Math.abs(box.y-measurements[0].y)<1,label+': same row');
      assert.ok(box.height>=44,label+': touch target');
      assert.ok(box.scrollWidth<=box.clientWidth&&box.scrollHeight<=box.clientHeight,label+': no clipped text');
      for(const text of box.textRects)assert.ok(text.left>=box.x&&text.right<=box.right&&text.top>=box.y&&text.bottom<=box.bottom,label+': text inside button');
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': document overflow');
    assert.deepEqual(await page.locator('input,select,button,.toolNav a,.rightStatus,.primary').evaluateAll(nodes=>nodes.filter(n=>{
      const r=n.getBoundingClientRect();return r.width&&r.height&&(r.x<0||r.right>innerWidth);
    }).map(n=>n.id||n.textContent.trim())),[],label+': visible controls outside viewport');
  };
  for(const width of [1440,1024,1001,1000,768,520,390,320]){
    await page.setViewportSize({width,height:900});
    await geometry('default '+width);
    await page.locator('#distMode').selectOption('map');await page.locator('#routeType').selectOption('trans');
    await page.getByRole('button',{name:'Why trans-solar multipliers?'}).click();
    await page.locator('#use100d').check();await page.locator('#useAstro').check();
    await geometry('expanded '+width);
    await page.getByRole('button',{name:'Why trans-solar multipliers?'}).click();
    await page.getByRole('button',{name:'Clear',exact:true}).click();
    if(process.env.NAV_SCREENSHOT_DIR&&(width===1440||width===320)){
      await mkdir(process.env.NAV_SCREENSHOT_DIR,{recursive:true});
      await actions.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.NAV_SCREENSHOT_DIR,`nav-controls-${width}.png`)});
    }
  }
  // Larger button text must expand the common row instead of clipping labels.
  await page.addStyleTag({content:'.primaryActions button{font-size:24px}'});await geometry('200% button text');
  await page.reload();await page.locator('#thrust').fill('1');await page.locator('#distanceKm').fill('100000');
  for(let i=0;i<2;i++){
    await page.getByRole('button',{name:'Solve Route',exact:true}).click();assert.equal(await page.locator('#mainTime').textContent(),'0d 1h 46m');
  }
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  const dialog=page.waitForEvent('dialog');const copy=page.getByRole('button',{name:'Copy NAV Brief',exact:true}).click();
  const alert=await dialog;assert.match(alert.message(),/No NAV solution/);await alert.accept();await copy;
  assert.equal(await page.locator('#thrust').inputValue(),'');
  const changelog=page.getByRole('link',{name:'Nav Changelog',exact:true});
  await changelog.focus();assert.ok(await changelog.evaluate(el=>el===document.activeElement));
  await page.keyboard.press('Enter');await page.waitForURL(base+'changes/nav.html');
  assert.equal(await page.getByRole('heading',{name:'Nav Calculator changelog',exact:true}).count(),1);
  assert.equal(await page.locator('time[datetime="2026-11-10"]').count(),4);
  assert.deepEqual(await page.locator('section[aria-labelledby="recent-heading"] h3').allTextContents(),[
    'November 10, 2026 · Updated navigation dashboard',
    'November 10, 2026 · Reusable calculation engine',
    'November 10, 2026 · Audit fixes, aligned controls and changelog',
    'October 3, 2026 · Calculation and reset fixes'
  ]);
  assert.equal(await page.getByRole('link',{name:'Calculation fix commit'}).getAttribute('href'),'https://github.com/OwlsNestNH/Traveller-Tools/commit/2cd61ac7e07111cc5c02b800b5b70d5365f7f4dd');
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'changelog overflow '+width);
  }
  for(const link of await page.locator('nav a').all())assert.equal((await page.request.get(new URL(await link.getAttribute('href'),page.url()).href)).status(),200);
  await page.goBack();assert.equal(page.url(),url);await page.goForward();assert.equal(page.url(),base+'changes/nav.html');
  await page.getByRole('link',{name:'Open Nav Calculator',exact:true}).click();await page.waitForURL(url);
  await page.getByRole('link',{name:'Traveller Tools',exact:true}).click();await page.waitForURL(base);
  await page.getByRole('link',{name:'Nav Changelog',exact:true}).click();await page.waitForURL(base+'changes/nav.html');
  assert.deepEqual(errors,[]);
  console.log('PASS Nav layout: equal aligned buttons at 8 widths, expanded inputs, 200% button text, touch targets, no clipping/overflow; repeated solve, Clear, empty Copy dismissal; keyboard changelog, Back/Forward, return and homepage links.');
  await browser.close();browser=undefined;
  // Run the calculation suite against the same HTTP/live deployment as the UI suite.
  // Asynchronous child execution lets the local fixture server answer its requests.
  const {spawn}=await import('node:child_process');
  for(const suite of ['nav.test.mjs','audit.test.mjs']){
  const exitCode=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(new URL('./'+suite,import.meta.url)),modulePath],{stdio:'inherit',env:{...process.env,NAV_TEST_URL:url}});
    child.on('error',reject);child.on('exit',resolve);
  });
  assert.equal(exitCode,0,'HTTP regression suite: '+suite);
  }
}finally{
  if(browser)await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
}
