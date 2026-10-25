import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
export async function verifyMapStability(page,width,artifacts){
 const p=await page.context().newPage(),records=[];
 const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');await p.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source}));
 const paint=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const measure=()=>p.evaluate(()=>{const b=document.querySelector('#map').getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,scrollY,transform:document.querySelector('#scene').getAttribute('transform'),zoom:document.querySelector('#zoom-level').textContent};});
 const click=s=>p.locator(s).first().evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
 try{await p.goto(page.url());await p.locator('.ship-node').first().waitFor();
  for(const expanded of [false,true]){
   if(expanded)await click('#expand-map');await p.evaluate(()=>scrollTo(0,0));await paint();const before=await measure();
   const same=async label=>{await paint();const after=await measure();for(const key of ['x','y','width','height'])assert.ok(Math.abs(after[key]-before[key])<=.1,label+' '+key);assert.equal(after.scrollY,before.scrollY,label+' page jump');assert.equal(after.transform,before.transform,label+' transform');assert.equal(after.zoom,before.zoom,label+' zoom');records.push({expanded,label,before,after});};
   for(const role of ['engineer','sensors','pilot','engineer']){await click('.station-regions [data-console-station='+role+']');await same('station '+role);}
   await p.locator('.engineer-row details').evaluateAll(es=>es.forEach(e=>e.open=true));await same('all source references expanded');
   await click('[data-station-system][type=checkbox]');await same('pending Engineer');await click('[data-station-cancel]');await same('cancel Engineer');await click('[data-station-system][type=checkbox]');await click('[data-station-commit]');await same('commit Engineer');
   for(const id of ['scout','merchant']){await click('[data-select='+id+']');await same('select '+id);}
   const unknown=p.locator('#ship-console [data-unknown-value]').first();if(await unknown.count()){await unknown.evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));await same('unknown editor');await p.locator('#unknown-value-dialog').getByRole('button',{name:'Cancel',exact:true}).evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));await same('unknown cancel');}
   await click('[data-details=merchant]');await same('details');await click('#sheet-close');await same('details close');
   // Synthetic DOM growth isolates intrinsic layout from unrelated encounter commands.
   await p.locator('#ships').evaluate(e=>{for(let i=0;i<12;i++){const n=e.firstElementChild.cloneNode(true);n.dataset.layoutProbe='';e.append(n);}});await same('roster growth');await p.locator('[data-layout-probe]').evaluateAll(es=>es.forEach(e=>e.remove()));await same('roster restore');
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if([1440,320].includes(width)){await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.ship-node image')].map(async e=>{const i=new Image();i.src=e.href.baseVal;await i.decode();}));});await p.screenshot({path:artifacts+'map-stability-'+(expanded?'expanded-':'normal-')+width+'.png'});}
  }
  await writeFile(artifacts+'map-stability-checks-'+width+'.json',JSON.stringify({width,passed:true,records},null,2));
 }finally{await p.close();}
}
