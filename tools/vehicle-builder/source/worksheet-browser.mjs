import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.resolve(process.argv[2]));
const root=path.resolve(new URL('../../..',import.meta.url).pathname),artifacts=path.resolve('verification-artifacts');
await mkdir(artifacts,{recursive:true});
const server=createServer(async(req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))throw Error('Path');if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true}),checks=[];
try{
 for(const width of [1440,390,320])for(const build of ['source/dist/index.html','Traveller-Vehicle-Builder.html']){
  const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tools/vehicle-builder/'+build);
  const input=page.getByLabel('Nominal Spaces',{exact:true});
  for(const value of ['12','13','14']){await input.fill(value);await input.press('Tab');assert.equal(await input.inputValue(),value);}
  const help=page.getByRole('button',{name:'Explain Nominal Spaces',exact:true});
  await help.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Nominal Spaces',exact:true}).waitFor();await page.keyboard.press('Escape');await assert.doesNotReject(()=>help.evaluate(el=>{if(document.activeElement!==el)throw Error('Focus not restored');}));
  await help.click();await page.getByRole('button',{name:'Close explanation'}).click();assert.equal(await page.locator('#info-dialog').isVisible(),false);
  await help.click();await page.mouse.click(2,2);assert.equal(await page.locator('#info-dialog').isVisible(),false);
  await page.getByRole('button',{name:'Features',exact:false}).click();
  const feature=page.locator('[data-feature-choice]').first();await feature.selectOption('yes');await feature.selectOption('no');
  await page.getByRole('button',{name:'Core systems',exact:false}).click();
  await page.getByRole('searchbox',{name:'Search equipment'}).fill('transceiver');
  const system=page.locator('[data-system]').first();await system.selectOption({index:0});
  const quantity=page.locator('[data-system-qty]').first();await quantity.fill('2');await quantity.press('Tab');
  await page.locator('[data-install-system]').first().click();
  assert.match(await page.locator('#editor').innerText(),/Installed:/);
  await page.getByRole('button',{name:'Crew & cargo',exact:false}).click();
  const cargo=page.getByLabel('Cargo Spaces',{exact:true});await cargo.fill('100000');await cargo.press('Tab');assert.match(await page.locator('.section-warnings').innerText(),/SPACE_BUDGET/);
  await cargo.fill('1');await cargo.press('Tab');
  await page.getByRole('button',{name:'Save in this browser',exact:true}).click();
  await cargo.fill('2');await cargo.press('Tab');await page.getByRole('button',{name:'Restore browser save',exact:true}).click();assert.equal(await cargo.inputValue(),'1');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save JSON',exact:true}).click();const saved=await download;const savedPath=await saved.path();
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Open design',exact:true}).click();await(await chooser).setFiles(savedPath);await page.getByText('Design opened',{exact:true}).waitFor();assert.equal(await cargo.inputValue(),'1');
  const sections=await page.locator('#nav button').allTextContents();
  for(const name of sections){await page.locator('#nav button').filter({hasText:name}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow '+name+' at '+width);}
  await page.getByRole('button',{name:'Core systems',exact:false}).click();
  await page.screenshot({path:path.join(artifacts,`vehicle-${build.startsWith('source')?'source':'standalone'}-${width}.png`)});
  await page.getByRole('button',{name:'Chassis',exact:false}).click();await page.screenshot({path:path.join(artifacts,`vehicle-chassis-${build.startsWith('source')?'source':'standalone'}-${width}.png`)});
  assert.deepEqual(errors,[]);checks.push({width,build,result:'passed'});await context.close();
 }
 await writeFile(path.join(artifacts,'vehicle-browser-results.json'),JSON.stringify(checks,null,2));
 console.log('Both builds: desktop/mobile/320px, all sections, repeated edits, popup keyboard/close/backdrop/focus, totals, equipment, browser save, JSON download/upload and overflow passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
