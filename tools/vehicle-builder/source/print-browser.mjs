// Real Chromium pagination and text retention, at 100% scale on A4 and Letter.
// Requires Poppler's pdfinfo and pdftotext; PDFs are retained for visual review.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.resolve(process.argv[2]));
require('./dist/data.js');const F=require('./dist/engine.js');
const root=path.resolve(new URL('../../..',import.meta.url).pathname);
const artifacts=path.resolve('verification-artifacts');await mkdir(artifacts,{recursive:true});
const equipment=names=>names.map(name=>({name,quantity:1}));
const armed={...structuredClone(F.defaults),name:'Armed survey rover',spaces:30,crew:2,passengers:4,
 equipment:equipment(['Transceiver, 500 km','Navigation System (basic)','Fire Extinguishers']),
 weapons:[{weapon:'Machinegun (light)',mount:'Pintle Mount',facing:'Dorsal',quantity:1,fireControl:'none'}]};
const operating=process.argv[3]==='operating';
const fixtures={
 basic:{design:structuredClone(F.defaults),pages:1},
 armed:{design:armed,pages:1},
 seating:{design:{...structuredClone(F.defaults),version:2,spaces:30,name:'Survey passenger carrier',passengerGroups:[{name:'Fold-down seats',count:2,space:.5}],equipment:equipment(['Transceiver, 500 km','Navigation System (basic)'])},pages:1},
 dense:{design:JSON.parse(await readFile(new URL('appendix-i-design.json',import.meta.url),'utf8')),pages:operating?1:2},
 longnotes:{design:{...armed,description:Array.from({length:60},(_,i)=>`Inspection line ${String(i).padStart(3,'0')}: Keep this complete operational instruction.`).join('\n')},minPages:2}
};
if(operating){
 fixtures.custom={design:{...structuredClone(armed),tl:14,spaces:50,name:'Custom systems and linked weapons',equipment:[{name:'Sensor System (improved)',quantity:1,rangeBoost:1,highFidelity:true,hardened:true,mast:true},{name:'Robot Manipulator Arm',quantity:3,armSize:6,strIncrease:1,dexIncrease:4}],weapons:[{weapon:'Machinegun (light)',quantity:2,mount:'Turret',facing:'Dorsal',remote:true,fireControl:'Basic',ammo:100,ammoType:'Armour Piercing',gunShield:3,autoloader:true,popup:true,modular:true},{weapon:'No weapon installed',mount:'Turret',quantity:1,ratedSpaces:4,reservedCrew:1}],description:'Retain every fitting, range modification and ammunition effect.'},minPages:1};
 fixtures.narrative={design:{...fixtures.dense.design,description:Array.from({length:15},(_,i)=>`Survey segment ${i+1} records terrain, crew duties, supplies, maintenance and mission conditions.`).join(' ').split(/\s+/).slice(0,150).join(' ')},minPages:1};
}
const server=createServer(async(req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep))throw Error('Path');if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}: {})});
const compact=s=>s.replace(/\s/g,'').toLowerCase(),checks=[];
try{
 for(const build of ['source/dist/index.html','Traveller-Vehicle-Builder.html']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/vehicle-builder/${build}`);
  for(const [name,{design,pages:expected,minPages}] of Object.entries(fixtures)){
   await page.emulateMedia({media:'screen'});
   await page.locator('#file-input').setInputFiles({name:'print-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(design))});
   await page.getByRole('button',{name:'Record & checks',exact:false}).click();
   assert.match(await page.locator('.vehicle-sheet h1').innerText(),new RegExp(design.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
   if(operating)await page.locator('[data-record-view]').selectOption('operating');
   await page.emulateMedia({media:'print'});
   if(operating){assert.equal(await page.locator('.operating-sheet').evaluate(e=>getComputedStyle(e).fontSize),'12px');assert.equal(await page.locator('.op-section').count()>0,true);}
   assert.equal(await page.locator('.skip').isVisible(),false);
   assert.equal(await page.locator('#summary').isVisible(),false);
   // Capture each visible text node, so table column reading order cannot mask lost text.
   const expectedText=await page.locator('.vehicle-sheet').evaluate(sheet=>{
    const walker=document.createTreeWalker(sheet,NodeFilter.SHOW_TEXT),text=[];
    for(let node;node=walker.nextNode();){const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect();if(r.width&&r.height&&node.textContent.trim())text.push(...node.textContent.split(/\n/).map(s=>s.trim()).filter(Boolean));}return text;
   });
   for(const format of ['A4','Letter'])for(const headers of [false,true]){
    const id=`vehicle-${operating?'operating':'print'}-${build.startsWith('source')?'source':'standalone'}-${name}-${format}-${headers?'headers':'plain'}`;
    const file=path.join(artifacts,id+'.pdf');
    await page.pdf({path:file,format,scale:1,displayHeaderFooter:headers,printBackground:false});
    const info=execFileSync('pdfinfo',[file],{encoding:'utf8'}),count=Number(info.match(/Pages:\s+(\d+)/)[1]);
    if(expected)assert.equal(count,expected,id);else assert.ok(count>=minPages,id);
    assert.match(info,format==='A4'?/Page size:.*A4/:/Page size:.*letter/i,id+' selected paper');
    const text=execFileSync('pdftotext',['-raw',file,'-'],{encoding:'utf8'}),flat=compact(text);
    assert.ok(!text.includes('Skip to builder'),id+' skip link leaked');
    for(const fragment of expectedText)assert.ok(flat.includes(compact(fragment)),id+' missing text: '+fragment);
    const bbox=execFileSync('pdftotext',['-bbox',file,'-'],{encoding:'utf8'});
    let dimensions;
    for(const token of bbox.matchAll(/<page width="([\d.]+)" height="([\d.]+)"|<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)"/g)){
     if(token[1])dimensions=[Number(token[1]),Number(token[2])];
     else assert.ok(Number(token[3])>=0&&Number(token[4])>=0&&Number(token[5])<=dimensions[0]&&Number(token[6])<=dimensions[1],id+' text outside paper');
    }
    checks.push({id,pages:count,retainedTextNodes:expectedText.length});
   }
  }
  if(operating){
   await page.emulateMedia({media:'screen'});
   await page.locator('[data-record-view]').selectOption('construction');
   const specification=await page.locator('.construction-spec pre').innerText();
   assert.equal(JSON.parse(specification).description,fixtures.narrative.design.description);
   assert.ok(await page.locator('.construction-spec table tbody tr').count()>1);
   const constructionFile=path.join(artifacts,`vehicle-construction-${build.startsWith('source')?'source':'standalone'}.pdf`);
   await page.emulateMedia({media:'print'});
   await page.pdf({path:constructionFile,format:'A4',scale:1,displayHeaderFooter:false});
   assert.ok(compact(execFileSync('pdftotext',['-raw',constructionFile,'-'],{encoding:'utf8'})).includes(compact(specification)),'Complete printed specification lost text');
   await page.emulateMedia({media:'screen'});

   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save JSON',exact:true}).click();
   const file=await (await download).path();assert.deepEqual(JSON.parse(await readFile(file,'utf8')),JSON.parse(specification));
   await page.locator('[data-record-view]').selectOption('detailed');assert.equal(await page.locator('.operating-sheet').count(),0);
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 await writeFile(path.join(artifacts,operating?'vehicle-operating-results.json':'vehicle-print-results.json'),JSON.stringify(checks,null,2)+'\n');
 console.log(JSON.stringify(checks,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
