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
  // Exact ten rows in the reported TL9 / 12-Space rover screenshot.
  await page.getByRole('button',{name:'Features',exact:false}).click();
  const reportedFeatures={Agile:['Agility +1','100% of baseline'],Fast:['Speed +1 band','Range is halved'],Monowheel:['Agility +2','Port and starboard armour must remain zero'],'Off-Roader':['Rough terrain','15% of baseline'],'Open-Topped':['Dorsal armour must remain zero','half cover'],Responsive:['Halves the time','Range 25% shorter'],Slow:['Speed -1 band','Range 50% greater'],'Smart Wheels':['Range 10% greater','terrain penalty by 1'],Streamlined:['Agility +1','Speed +1 band'],Unresponsive:['Doubles the time','Saves 25%']};
  assert.equal(await page.locator('[data-feature-choice]').count(),10);
  for(const [name,fragments] of Object.entries(reportedFeatures)){
   const button=page.getByRole('button',{name:'Explain '+name,exact:true});await button.focus();await page.keyboard.press('Enter');
   const text=await page.locator('#info-content').innerText();for(const fragment of fragments)assert.ok(text.includes(fragment),name+' missing '+fragment);assert.match(text,/Limits:.*Minimum TL/s);assert.match(text,/Current choice:/);assert.match(text,/Vehicle Handbook/);
   if(['Agile','Fast','Monowheel'].includes(name))await page.screenshot({path:path.join(artifacts,'vehicle-feature-'+name.toLowerCase()+'-'+(build.startsWith('source')?'source':'standalone')+'-'+width+'.png')});
   await page.keyboard.press('Escape');assert.equal(await button.evaluate(el=>document.activeElement===el),true,'Feature help focus '+name);
  }
  await page.locator('[data-feature-choice="Agile"]').selectOption('yes');await page.getByRole('button',{name:'Explain Agile',exact:true}).click();assert.match(await page.locator('#info-content').innerText(),/Current choice: Fitted/);await page.keyboard.press('Escape');await page.locator('[data-feature-choice="Agile"]').selectOption('no');
  await page.getByRole('button',{name:'Chassis',exact:false}).click();
  const type=page.locator('[data-key="type"]');
  await type.selectOption('Walker');await page.getByRole('button',{name:'Explain Vehicle type · Walker',exact:true}).click();assert.match(await page.locator('#info-content').innerText(),/moved by legs/);await page.keyboard.press('Escape');
  await type.selectOption('Ground Vehicle');
  await page.getByRole('button',{name:'Power & mobility',exact:false}).click();await page.getByRole('button',{name:'Explain Primary power · Powered',exact:true}).click();assert.match(await page.locator('#info-content').innerText(),/not a fixed TL3 engine/);assert.match(await page.locator('#info-content').innerText(),/Fission and fusion are separate choices/);await page.screenshot({path:path.join(artifacts,'vehicle-powered-help-'+(build.startsWith('source')?'source':'standalone')+'-'+width+'.png')});await page.keyboard.press('Escape');await page.locator('[data-key="power"]').selectOption('Fission (basic)');
  await page.getByRole('button',{name:'Explain Primary power · Fission (basic)',exact:true}).click();assert.match(await page.locator('#info-content').innerText(),/Hostile Environment Protection/);await page.keyboard.press('Escape');
  await page.locator('[data-key="power"]').selectOption('Powered');
  await page.getByRole('button',{name:'Armour & hull',exact:false}).click();await page.locator('[data-key="hull"]').selectOption('Reinforced');
  await page.getByRole('button',{name:'Explain Hull construction · Reinforced',exact:true}).click();assert.match(await page.locator('#info-content').innerText(),/10% Hull/);await page.keyboard.press('Escape');await page.locator('[data-key="hull"]').selectOption('Standard');
  await page.getByRole('button',{name:'Chassis',exact:false}).click();
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
  const system=page.locator('[data-system]').first();await system.selectOption({label:'Transceiver, 500 km · TL6+'});
  const radioInfo=page.getByRole('button',{name:'Explain Transceiver, 500 km',exact:true});await radioInfo.focus();await page.keyboard.press('Enter');assert.match(await page.locator('#info-content').innerText(),/two-way radio.*500 km/s);await page.keyboard.press('Escape');assert.equal(await radioInfo.evaluate(el=>document.activeElement===el),true);
  await system.selectOption({label:'Transceiver, 5 km · TL5+'});await page.getByRole('button',{name:'Explain Transceiver, 5 km',exact:true}).click();assert.match(await page.locator('#info-content').innerText(),/5 km/);assert.doesNotMatch(await page.locator('#info-content').innerText(),/500 km/);await page.keyboard.press('Escape');
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
  await page.getByRole('button',{name:'External options',exact:false}).click();
  const exterior=page.locator('.system-category').filter({has:page.locator('summary').filter({hasText:'Exterior'})});
  await exterior.locator('summary').click();const exteriorQuantity=exterior.locator('[data-system-qty]').first();
  await exteriorQuantity.focus();await exteriorQuantity.press('ArrowUp');assert.equal(await exteriorQuantity.evaluate(el=>document.activeElement===el),true,'Focus lost after large-category edit');
  const sections=await page.locator('#nav button').allTextContents();
  for(const name of sections){await page.locator('#nav button').filter({hasText:name}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow '+name+' at '+width);}
  await page.getByRole('button',{name:'Core systems',exact:false}).click();
  await page.locator('.system-category').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(artifacts,`vehicle-${build.startsWith('source')?'source':'standalone'}-${width}.png`)});
  await page.locator('.system-card .info-button').first().click();await page.screenshot({path:path.join(artifacts,`vehicle-help-${build.startsWith('source')?'source':'standalone'}-${width}.png`)});await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Chassis',exact:false}).click();await page.screenshot({path:path.join(artifacts,`vehicle-chassis-${build.startsWith('source')?'source':'standalone'}-${width}.png`)});
  if(width===1440){
   await page.getByRole('button',{name:'Record & checks',exact:false}).click();await page.emulateMedia({media:'print'});
   assert.equal(await page.locator('.vehicle-sheet').isVisible(),true);assert.equal(await page.locator('#summary').isVisible(),false);assert.equal(await page.locator('#nav').isVisible(),false);
   assert.match(await page.locator('.vehicle-sheet').innerText(),/Frontier utility rover/);assert.match(await page.locator('.vehicle-sheet').innerText(),/Transceiver, 5 km/);
   const printName=build.startsWith('source')?'source':'standalone';await page.screenshot({path:path.join(artifacts,'vehicle-print-'+printName+'.png'),fullPage:true});
   const pdf=await page.pdf({path:path.join(artifacts,'vehicle-print-'+printName+'.pdf'),format:'A4',printBackground:true});assert.ok(pdf.length>10000);assert.equal(pdf.subarray(0,4).toString(),'%PDF');await page.emulateMedia({media:'screen'});
  }
  const audit=await context.newPage();audit.on('pageerror',e=>errors.push(e.message));await audit.goto(origin+'/tools/vehicle-builder/'+build);
  await audit.getByRole('button',{name:'Crew & cargo',exact:false}).click();await audit.getByRole('button',{name:'Add passenger group',exact:true}).click();
  await audit.getByRole('button',{name:'Weapon mounts',exact:false}).first().click();await audit.getByRole('button',{name:'Add mount',exact:false}).click();
  await audit.getByRole('button',{name:'Core systems',exact:false}).click();await audit.locator('[data-install-system]').first().click();
  const sectionAudit=[];
  for(const section of await audit.locator('#nav button').allTextContents()){
   await audit.locator('#nav button').filter({hasText:section}).click();
   const result=await audit.locator('#editor input,#editor select,#editor textarea').evaluateAll(controls=>({count:controls.length,missing:controls.filter(el=>{
    const label=el.closest('label'),next=label?.nextElementSibling||el.nextElementSibling;
    const help=next?.matches('.info-button')?next:el.closest('.worksheet-field,.choice-toggle,.quantity-row,.transfer-row,.feature,td')?.querySelector('.info-button');
    return !help?.dataset.info||help.dataset.info.replace(/<[^>]*>/g,'').trim().length<30;
   }).map(el=>el.getAttribute('aria-label')||el.dataset.key||el.outerHTML.slice(0,120))}));
   assert.deepEqual(result.missing,[],'Missing useful adjacent help in '+section+' '+width);sectionAudit.push({section,controls:result.count});
  }
  await audit.getByRole('button',{name:'Weapon mounts',exact:false}).first().click();await audit.locator('[data-prop="weapon"]').selectOption('No weapon installed');await audit.locator('[data-prop="mount"]').selectOption('Turret');
  for(const prop of ['ratedSpaces','reservedCrew']){assert.ok(await audit.locator('[data-prop="'+prop+'"]').count()>0);}
  await audit.close();
  assert.deepEqual(errors,[]);checks.push({width,build,result:'passed',sectionAudit});await context.close();
 }
 await writeFile(path.join(artifacts,'vehicle-browser-results.json'),JSON.stringify(checks,null,2));
 console.log('Both builds: desktop/mobile/320px, all sections, repeated edits, popup keyboard/close/backdrop/focus, totals, equipment, browser save, JSON download/upload and overflow passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
