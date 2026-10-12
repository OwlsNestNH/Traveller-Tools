import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fixture,setup,loadPlannedRouteHarness,canonical,ui,display,same,sha} from './planned-route-save-harness.mjs';
import {legacyRouteEditorMarkup} from './route-editor-legacy-markup.mjs';

// Full released-source oracle, including Store, controller, state, routing,
// world-picker and all their transitive production imports. Never overlays an
// old target function onto newer candidate helpers.
const root=process.env.TRAVELLER_PLANNED_ROUTE_APP_ROOT;
const recording=process.env.TRAVELLER_PLANNED_ROUTE_RECORD_ORIGINAL==='1';
const commit='dc9006ad649aff7973be1d24276b7a64946ae982';
const releasedAppSHA256='a65a796d1a075cce8661763b2c0c5cbfcbd33b967827e8307dfbc577d099de09';
if(recording){assert.ok(root,'Explicit independently preserved released source required');assert.equal(sha(await readFile(root.replace(/\/$/,'')+'/js/app.mjs','utf8')),releasedAppSHA256);}
const source=root?await loadPlannedRouteHarness(root):undefined;
const directory=new URL('./fixtures/planned-route-original/',import.meta.url),seedURL=new URL('seeds.json',directory),expectedURL=new URL('expected.json',directory);
let seeds;
try{seeds=JSON.parse(await readFile(seedURL,'utf8'));}catch(error){if(!recording)throw error;seeds=[false,true].flatMap(spent=>[false,true].map(legacy=>({name:`spent=${spent}, legacy=${legacy}`,campaign:fixture({spent,legacy})})));await writeFile(seedURL,JSON.stringify(seeds));}
const expected=recording?null:JSON.parse(await readFile(expectedURL,'utf8')),captured=[];
function observation(h){same(h.api.state,h.persisted());return {campaign:h.persisted(),routeDraft:h.api.routeDraft,interface:{...ui(h),tab:h.api.tab,view:h.api.view,renderedSHA256:Object.fromEntries(Object.entries(display(h)).map(([key,value])=>[key,sha(key==='main'?legacyRouteEditorMarkup(value):value)]))},writes:h.counters.writes};}
for(const kind of ['map','auto','plot'])for(const seed of seeds)test(`independent full .60 ${kind} route submit/close/reload/Undo observation: ${seed.name}`,async()=>{
 const h=setup(seed.campaign,{source,kind});await h.open();const review=body(h),checkpoints=[];
 const operation=h.submit();checkpoints.push({phase:'submit stack',...observation(h)});
 await Promise.resolve();checkpoints.push({phase:'first microtask',...observation(h)});
 await operation;checkpoints.push({phase:'settled',...observation(h)});
 const fresh=setup(h.store.read(),{source,kind,draft:false});checkpoints.push({phase:'reloaded',...observation(fresh)});
 await fresh.runAction('undo');checkpoints.push({phase:'ordinary Undo',...observation(fresh)});
 const value=canonical({kind,name:seed.name,reviewSHA256:sha(review),checkpoints,routeCalls:h.map.calls.filter(c=>c.kind==='loadWorld'||c.kind==='nearby')},seed.campaign);
 if(recording)captured.push(value);else same(value,expected.observations.find(item=>item.kind===kind&&item.name===seed.name));
 assert.equal(checkpoints[0].writes,1);assert.equal(checkpoints[0].interface.modalOpen,true);assert.equal(checkpoints[1].interface.modalOpen,false);assert.equal(checkpoints[2].routeDraft,null);
});
function body(h){const value=h.dom.ids.get('modal-body').innerHTML;if(!root){assert.ok(value.startsWith('<p class="planned-route-review">'),'Approved wrapping class is restricted to route-name paragraph and optional fuel notice');let normalized=value.replace('<p class="planned-route-review">','<p>');normalized=normalized.replace('<p class="notice planned-route-review" role="alert">','<p class="notice" role="alert">');assert.doesNotMatch(normalized,/planned-route-review/,'No other accepted markup changes are normalized');return normalized;}return value;}

async function manifest(base,part){let rows=[];for(const entry of (await readdir(base+'/'+part,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const path=part+'/'+entry.name;if(entry.isDirectory())rows.push(...await manifest(base,path));else if(/\.(mjs|json)$/.test(path))rows.push({path,bytes:(await readFile(base+'/'+path)).length,sha256:sha(await readFile(base+'/'+path,'utf8'))});}return rows;}
test('full original observations retain source provenance, deterministic synthetic seeds and complete imported source hashes',async()=>{
 if(recording){const sources=[...await manifest(root,'js'),...await manifest(root,'rules')];await writeFile(expectedURL,JSON.stringify({sourceCommit:commit,sourceTree:'3ea07e318412343f9cc986b096a6066dd195b16f',sourceAppSHA256:releasedAppSHA256,sources,seedsSHA256:sha(await readFile(seedURL,'utf8')),observations:captured}));}
 else{assert.equal(expected.sourceCommit,commit);assert.equal(expected.sourceAppSHA256,releasedAppSHA256);assert.equal(expected.seedsSHA256,sha(await readFile(seedURL,'utf8')));assert.equal(expected.observations.length,seeds.length*3);assert.ok(expected.sources.some(s=>s.path==='js/world-picker.mjs'));assert.ok(expected.sources.some(s=>s.path==='js/campaign-controller.mjs'));for(const seed of seeds){assert.equal(seed.campaign.lots[0].id,'11111111-2222-4333-8444-555555555555');same(seed.campaign,fixture({spent:seed.name.includes('spent=true'),legacy:seed.name.includes('legacy=true')}));}}
});
