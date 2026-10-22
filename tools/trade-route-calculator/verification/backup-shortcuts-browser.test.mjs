import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {guiFixture,campaignKey} from './fixtures/gui-parity.mjs';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390,320])for(const location of ['toolbar','settings']){
 const f=guiFixture(),bytes=JSON.stringify(f.state),context=await browser.newContext({viewport:{width,height:1000}});
 await context.addInitScript(({key,bytes})=>{localStorage.setItem(key,bytes);globalThis.copied=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>copied.push(text)},configurable:true});},{key:campaignKey,bytes});
 await context.route('https://travellermap.com/**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/universe')?f.universe:u.pathname.endsWith('/metadata')?f.metadata:u.pathname.endsWith('/sec')?f.sec:{Worlds:f.apiWorlds}});});
 const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto(process.env.TRAVELLER_TEST_URL||'http://127.0.0.1:8765/');await page.getByText('Editing in this tab',{exact:true}).waitFor();
 const raw=()=>page.evaluate(k=>localStorage.getItem(k),campaignKey),toolbar=page.locator('#player-link-share');
 assert.deepEqual(await toolbar.locator('button').allTextContents(),['Copy Player Link','Backup','Load']);
 assert.equal(await toolbar.locator('[data-action=export]').getAttribute('data-mutate'),null);
 assert.notEqual(await toolbar.locator('[data-action=import]').getAttribute('data-mutate'),null);
 for(const b of await toolbar.locator('button').all()){const r=await b.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width&&r.height>=44,'Toolbar controls fit and retain touch targets');}
 assert.equal(await page.locator('#import-file').count(),1,'One shared file input');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await toolbar.getByRole('button',{name:'Copy Player Link',exact:true}).click();assert.equal(await page.evaluate(()=>copied.length),1);assert.equal(await raw(),bytes);
 await page.locator('#tabs [data-arg=Settings]').click();
 const settings=page.locator('[data-settings-group=backup-data]');await settings.locator('summary').click();
 assert.equal(await settings.locator('[data-action=export]').count(),1);assert.equal(await settings.locator('[data-action=import]').count(),1);
 const scope=location==='toolbar'?toolbar:settings;
 const draft=page.locator('#settings-form [name=name]');for(const d of await draft.locator('xpath=ancestor::details').all())if(!await d.evaluate(el=>el.open))await d.locator(':scope > summary').click();await draft.fill('Unsaved synthetic draft');
 const downloading=page.waitForEvent('download');await scope.locator('[data-action=export]').click();const download=await downloading;assert.equal(await readFile(await download.path(),'utf8'),bytes,'Backup uses saved bytes, not unsaved draft');assert.equal(await raw(),bytes);
 const load=async text=>{const choosing=page.waitForEvent('filechooser');await scope.locator('[data-action=import]').click();await (await choosing).setFiles(text===null?[]:{name:'synthetic-backup.json',mimeType:'application/json',buffer:Buffer.from(text)});};
 await load(null);assert.equal(await raw(),bytes);assert.equal(await page.locator('#modal').evaluate(x=>x.open),false);
 for(let i=0;i<2;i++){await load(bytes);await page.getByRole('heading',{name:'Load campaign (JSON)',exact:true}).waitFor();assert.equal(await page.locator('#import-file').inputValue(),'');assert.equal(await page.locator('#modal [name=backed]').isChecked(),false);assert.equal(await raw(),bytes);await page.locator('#modal-cancel').click();assert.equal(await draft.inputValue(),'Unsaved synthetic draft');assert.equal(await raw(),bytes);}
 for(const invalid of ['not JSON','{}']){await load(invalid);await page.locator('#message.error').waitFor();assert.equal(await page.locator('#modal').evaluate(x=>x.open),false);assert.equal(await raw(),bytes);assert.equal(await page.locator('#import-file').inputValue(),'');}
 const next=structuredClone(f.state);next.name='Imported synthetic campaign';await load(JSON.stringify(next));await page.getByRole('heading',{name:'Load campaign (JSON)',exact:true}).waitFor();await page.locator('#modal-submit').click();await page.locator('#modal-error').filter({hasText:/backup|proceed/i}).waitFor();assert.equal(await raw(),bytes,'Acknowledgement is required');
 await page.locator('#modal [name=backed]').check();await page.evaluate(key=>{const original=Storage.prototype.setItem;let fail=true;Storage.prototype.setItem=function(k,v){if(k===key&&fail){fail=false;throw Error('Synthetic shortcut save failure');}return Reflect.apply(original,this,[k,v]);};},campaignKey);
 await page.locator('#modal-submit').click();await page.locator('#modal-error').filter({hasText:/Synthetic shortcut save failure/}).waitFor();assert.equal(await raw(),bytes,'Failed replacement never changes saved campaign');await page.locator('#modal-cancel').click();assert.equal(await raw(),bytes);
 await load(JSON.stringify(next));await page.getByRole('heading',{name:'Load campaign (JSON)',exact:true}).waitFor();await page.locator('#modal [name=backed]').check();await page.locator('#modal-submit').click();await page.locator('#modal').waitFor({state:'hidden'});assert.equal(JSON.parse(await raw()).name,next.name);assert.equal(JSON.parse(await raw()).revision,f.state.revision+1);
 const after=await raw();await toolbar.getByRole('button',{name:'Copy Player Link',exact:true}).click();assert.equal(await raw(),after);assert.equal(await page.evaluate(()=>copied.length),2);
 await mkdir(new URL('../verification-artifacts/',import.meta.url),{recursive:true});await toolbar.screenshot({path:new URL(`../verification-artifacts/backup-shortcuts-${location}-${width}.png`,import.meta.url).pathname});
 await context.close();console.log('PASS backup/load '+location+' '+width);
}}finally{await browser.close();}
