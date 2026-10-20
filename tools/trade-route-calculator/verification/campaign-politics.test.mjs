import test from 'node:test';
import assert from 'node:assert/strict';
import {projectCampaignPolitics,createPoliticsDraft,campaignClaimGeometry,campaignTerritoryMarkup,DRINAX_PRESET} from '../js/campaign-politics.mjs';
const value=claims=>({version:1,claims,allegiances:[]});
test('legacy campaigns have no automatic preset; explicit preset is undoable and isolated',()=>{assert.equal(projectCampaignPolitics(undefined),null);const d=createPoliticsDraft(null);assert.equal(d.value().claims.length,0);d.preset();assert.deepEqual(d.value().claims,[...DRINAX_PRESET].sort((a,b)=>a[0]-b[0]));assert.equal(d.canUndo(),true);d.undo();assert.deepEqual(d.value(),value([]));assert.equal(d.undo(),false);});
test('manual clicks toggle only the chosen cell; world allegiance is separate',()=>{const d=createPoliticsDraft(null);d.toggle('claims',0,0);d.toggle('claims',0,3);assert.deepEqual(d.value().claims,[[0,0],[0,3]]);assert.deepEqual(d.value().allegiances,[]);d.toggle('allegiances',0,0);d.toggle('claims',0,0);assert.deepEqual(d.value().claims,[[0,3]]);assert.deepEqual(d.value().allegiances,[[0,0]]);d.undo();d.undo();assert.deepEqual(d.value(),value([[0,0],[0,3]]));});
test('exact union removes shared edges but never fills gaps or holes',()=>{assert.equal(campaignClaimGeometry(value([[0,0]])).edges.length,6);assert.equal(campaignClaimGeometry(value([[0,0],[1,0]])).edges.length,10);assert.equal(campaignClaimGeometry(value([[0,0],[0,2]])).edges.length,12);assert.equal(campaignClaimGeometry(value([[0,0],[0,3]])).polygons.length,2);assert.equal(campaignClaimGeometry(value([[-107,-17],[-108,-17]])).edges.length,10);const ring=[[0,-1],[1,-1],[1,0],[0,1],[-1,0],[-1,-1]];const g=campaignClaimGeometry(value(ring));assert.equal(g.polygons.length,6);assert.equal(g.edges.length,24,'outer perimeter plus unclaimed central hole');});
test('projection validates hostile/oversized data and excludes non-public fields',()=>{for(const x of [{version:2,claims:[],allegiances:[]},value([[NaN,0]]),value([[0,0],[0,0]]),value([[32768,0]]),value(Array.from({length:513},(_,i)=>[i,0])),{version:1,claims:[],allegiances:'bad'}])assert.throws(()=>projectCampaignPolitics(x));assert.deepEqual(projectCampaignPolitics({...value([[0,0]]),refereeNotes:'PRIVATE'}),value([[0,0]]));});
test('shared SVG is inert and deterministic for main and player projections',()=>{const p=value([[0,0],[1,0]]),before=structuredClone(p),project=(x,y)=>[x*100,y*100];const s=campaignTerritoryMarkup(p,project);assert.match(s,/pointer-events="none"/);assert.match(s,/#8754c9/);assert.match(s,/#d8b4ff/);assert.doesNotMatch(s,/data-action|onclick|script/);assert.equal(s,campaignTerritoryMarkup(value([[1,0],[0,0]]),project));assert.deepEqual(p,before);});

test('sparse claim lists and sparse coordinates are rejected',()=>{for(const claims of [new Array(2),[[,1]],[[0,]]])assert.throws(()=>projectCampaignPolitics({version:1,claims,allegiances:[]}));});

test('territory validator is the only non-cache change to released economic state source',async()=>{
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto'),{withoutCampaignPoliticsValidation}=await import('./campaign-politics-source-guard.mjs');
 const source=await readFile(new URL('../js/state.mjs',import.meta.url),'utf8');
 const hash=s=>createHash('sha256').update(s.replace(/(^import [^\n]*?)\?v=[^'"]+/gm,'$1?v=<release>')).digest('hex');
 const released='52005db750ee3a281b1c02e0ccd644d7c0b873178fe6d3037f539cbfd2252dc0';
 assert.equal(hash(withoutCampaignPoliticsValidation(source)),released);
 assert.notEqual(hash(withoutCampaignPoliticsValidation(source.replace('s.bank=','s.bank ='))),released,'Economic edits cannot bypass the existing source guard');
});
