import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,setup,loadClearRouteHarness,canonical,ui,display,same} from './clear-route-save-harness.mjs';

// Independent full-source .59 oracle. The recording run loads its app, Store,
// controller, state and helper imports from the preserved released tree. CI
// compares the candidate to those fixed outcomes; it does not reconstruct old
// behavior by overlaying only the original clearPlannedRoute function.
const root=process.env.TRAVELLER_CLEAR_ROUTE_APP_ROOT;
const recording=process.env.TRAVELLER_CLEAR_ROUTE_RECORD_ORIGINAL==='1';
const releasedAppSHA256='5c8a401800d7650104c56f480405ff52f101da61693961f6bf35463c92c700ed';
if(recording)assert.ok(root,'Recording requires an explicit independent released source root');
if(recording)assert.equal(createHash('sha256').update(await readFile(root.replace(/\/$/,'')+'/js/app.mjs')).digest('hex'),releasedAppSHA256,'Only exact released .59 source may regenerate expected observations');
const factory=root?await loadClearRouteHarness(root):null;
const directory=new URL('./fixtures/clear-route-original/',import.meta.url);
const seedURL=new URL('seeds.json',directory),expectedURL=new URL('expected.json',directory);
let seeds;
try{seeds=JSON.parse(await readFile(seedURL,'utf8'));}catch(error){if(!recording)throw error;seeds=[false,true].flatMap(spent=>[false,true].map(legacy=>({name:`spent=${spent}, legacy=${legacy}`,campaign:fixture({spent,legacy})})));await writeFile(seedURL,JSON.stringify(seeds));}
const expected=recording?null:JSON.parse(await readFile(expectedURL,'utf8'));
const captured=[];
function observation(h){same(h.api.state,h.persisted());return {campaign:h.persisted(),routeDraft:h.api.routeDraft,interface:{...ui(h),tab:h.api.tab,view:h.api.view,renderedSHA256:Object.fromEntries(Object.entries(display(h)).map(([key,value])=>[key,createHash('sha256').update(value).digest('hex')]))},writes:h.counters.writes};}
for(const seed of seeds)test(`independent full .59 clear/close/reload/Undo observation: ${seed.name}`,async()=>{
 const h=setup(seed.campaign,{factory});h.open();const checkpoints=[];
 const operation=h.submit();checkpoints.push({phase:'submit stack',...observation(h)});
 await Promise.resolve();checkpoints.push({phase:'first microtask',...observation(h)});
 await operation;checkpoints.push({phase:'settled',...observation(h)});
 const fresh=setup(h.store.read(),{factory,draft:false});checkpoints.push({phase:'reloaded',...observation(fresh)});
 await fresh.runAction('undo');checkpoints.push({phase:'ordinary Undo',...observation(fresh)});
 const value=canonical({name:seed.name,checkpoints},seed.campaign);
 if(recording)captured.push(value);else same(value,expected.observations.find(item=>item.name===seed.name));
 assert.equal(checkpoints[0].writes,1);assert.equal(checkpoints[0].interface.modalOpen,true);assert.equal(checkpoints[1].interface.modalOpen,false);assert.equal(checkpoints[2].routeDraft,null);
});
test('full original capture provenance and seed identities are independently recorded',async()=>{
 if(recording){const source=await readFile(root.replace(/\/$/,'')+'/js/app.mjs','utf8');await writeFile(expectedURL,JSON.stringify({sourceCommit:'ae68a384318581131f6575c38c147e34411bf120',sourceAppSHA256:createHash('sha256').update(source).digest('hex'),observations:captured}));}
 else{assert.equal(expected.sourceCommit,'ae68a384318581131f6575c38c147e34411bf120');assert.equal(expected.sourceAppSHA256,releasedAppSHA256);assert.equal(expected.observations.length,seeds.length);for(const seed of seeds)assert.equal(seed.campaign.lots[0].id,'11111111-2222-4333-8444-555555555555');}
});
