import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {ICONS,glyphRotation} from '../appearance.mjs';
import {iconRadius} from '../icon-bounds.mjs';
export async function verifyWrecks(page,width,artifacts){
 const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8'),marker='state=createState(),selected=',icons=Object.keys(ICONS).filter(k=>k!=='auto'),records=[],cards=[];
 assert.equal(source.split(marker).length,2);
 for(let start=0;start<icons.length;start+=5){
  const group=icons.slice(start,start+5),ships=group.map((icon,i)=>({id:'wreck-'+i,name:icon,appearance:{icon,side:'B',heading:i*31-90},condition:{hull:0},capabilities:{thrust:2},motion:{position:{q:(i-2)*6,r:0},velocity:{q:1,r:0},impulse:{q:0,r:0}}}));
  const p=await page.context().newPage();p.setDefaultTimeout(15000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/app.mjs',r=>r.fulfill({contentType:'text/javascript',body:source.replace(marker,'state=createState({ships:'+JSON.stringify(ships)+'}),selected=')+`\nimport {normalizeState as reloadState} from './engine.mjs'; window.__wreckState=()=>structuredClone(state);window.__wreckReload=s=>{state=reloadState(s);render();};window.__wreckZoom=z=>{camera={x:0,y:0,zoom:z};drawMap();};`}));
  try{
   await p.goto(page.url());await p.locator('.ship-node').first().waitFor();assert.equal(await p.locator('.ship-node.wrecked').count(),ships.length);
   const initial=await p.evaluate(()=>window.__wreckState());await p.evaluate(s=>window.__wreckReload(JSON.parse(JSON.stringify(s))),initial);assert.deepEqual(await p.evaluate(()=>window.__wreckState()),initial);
   for(let i=0;i<ships.length;i++){
    const node=p.locator('[data-ship="wreck-'+i+'"]'),icon=group[i];assert.equal(await node.getAttribute('data-icon'),icon);assert.equal(await node.locator('.ship-glyph').getAttribute('transform'),`rotate(${glyphRotation(icon,initial.ships[i].appearance.heading)})`);
    if(ICONS[icon].file)assert.equal(await node.locator('image').getAttribute('href'),'assets/ships/'+ICONS[icon].file);
    // Decode exactly the attached image cohort before collecting visual evidence.
    await node.locator('image').evaluateAll(async es=>{await Promise.all(es.map(async e=>{const img=new Image();img.src=new URL(e.getAttribute('href'),location.href).href;await img.decode();}));});
    if(width===1440)cards.push({icon,art:await node.locator('.ship-art').innerHTML(),normal:await node.locator('.wreck-hull').innerHTML(),radius:iconRadius(icon,ICONS[icon].file)});
   }
   // The renderer enumerates only the supplied visible encounter, never contacts elsewhere.
   assert.deepEqual(await p.locator('.ship-node').evaluateAll(es=>es.map(e=>e.dataset.ship)),ships.map(s=>s.id));
   for(const zoom of [.33,1,4]){
    await p.evaluate(z=>window.__wreckZoom(z),zoom);await p.waitForFunction(z=>Number(document.querySelector('#map').dataset.zoom)===z,zoom);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const measurements=await p.locator('.ship-node').evaluateAll(es=>es.map(e=>{const art=e.querySelector('.ship-art'),m=art.getScreenCTM(),world=document.querySelector('#scene').getScreenCTM(),hit=e.querySelector('.ship-hit').getBoundingClientRect();return {icon:e.dataset.icon,scale:Math.hypot(m.a,m.b),apothem:26*Math.sqrt(3)/2*Math.hypot(world.a,world.b),hitWidth:hit.width,hitHeight:hit.height};}));
    for(const m of measurements){assert.ok(iconRadius(m.icon,ICONS[m.icon].file)*m.scale<=m.apothem*.91+.01,JSON.stringify({width,zoom,...m}));assert.ok(Math.abs(m.hitWidth-50)<1);assert.ok(Math.abs(m.hitHeight-50)<1);}records.push({group,zoom,measurements});
   }
   await p.evaluate(()=>window.__wreckZoom(1));await p.locator('#map').scrollIntoViewIfNeeded();const node=p.locator('[data-ship="wreck-2"]');if(group.length>2){if(width<500)await node.locator('.ship-hit').tap();else{await node.focus();await p.keyboard.press('Enter');}assert.equal(await node.getAttribute('aria-pressed'),'true');assert.match(await node.getAttribute('aria-description'),/Wrecked/);}
   await p.locator('[data-select="wreck-0"]').click();await p.locator('[data-open-stat=hull]').click();await p.locator('#console-hull').fill('1');assert.equal(await p.locator('.wrecked').count(),ships.length);await p.locator('#console-cancel').click();assert.deepEqual(await p.evaluate(()=>window.__wreckState()),initial);
   await p.locator('[data-open-stat=hull]').click();await p.locator('#console-hull').fill('1');await p.locator('#console-commit').click();assert.equal(await p.locator('[data-ship="wreck-0"]').evaluate(e=>e.classList.contains('wrecked')),false);
   const repaired=await p.evaluate(()=>window.__wreckState());const expected=structuredClone(initial.ships);expected[0].condition.hull=1;assert.deepEqual(repaired.ships,expected);
   await p.locator('[data-open-stat=hull]').click();await p.locator('#console-hull').fill('');await p.locator('#console-commit').click();assert.equal(await p.locator('[data-ship="wreck-0"] .wreck-hull').count(),0);
   await p.evaluate(s=>window.__wreckReload(s),initial);assert.equal(await p.locator('.wrecked').count(),ships.length);
   if(start===0&&[1440,320].includes(width)){await p.locator('#expand-map').click();await p.evaluate(()=>window.__wreckZoom(4));await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.locator('#map').scrollIntoViewIfNeeded();await p.locator('.map-panel').screenshot({path:artifacts+'wreck-map-'+width+'.png'});}
   assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>window.__storageAccesses),[]);
  }finally{await p.close();}
 }
 await writeFile(artifacts+'wreck-checks-'+width+'.json',JSON.stringify({width,icons,records},null,2));
 if(width===1440){
  const {WRECK_DEFS}=await import('../wreck.mjs'),p=await page.context().newPage(),base=new URL('../',page.url()).href+'ship-combat-alpha/';
  try{await p.setViewportSize({width:1000,height:1600});await p.setContent(`<style>body{margin:0;background:#0b1722;color:#d4e0e6;font:14px system-ui}main{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px}section{text-align:center;background:#102432;border-radius:8px;padding:8px}svg{width:100%;height:100px}p{margin:0}small{color:#8b969d}</style><main>${cards.map(({icon,art,normal})=>`<section><p>${icon}</p><svg viewBox="-65 -32 130 64"><defs>${WRECK_DEFS}<filter id="silhouette-B"><feFlood flood-color="#ffad86"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs><g transform="translate(-32 0)">${normal}</g><g transform="translate(32 0)">${art}</g></svg><small>Operational / Hull 0</small></section>`).join('')}</main>`.replaceAll('href="assets/',`href="${base}assets/`));await p.locator('image').evaluateAll(async es=>{await Promise.all(es.map(async e=>{const img=new Image();img.src=e.getAttribute('href');await img.decode();}));});await p.locator('main').screenshot({path:artifacts+'wreck-all-silhouettes.png'});}finally{await p.close();}
 }
}
