import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlanetSearchSession,planetSearchLabel,createGlobalWorldSearch} from '../js/global-world-search.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const row=(Name='Terra',Sector='Solomani Rim',SectorX=0,HexX=18,HexY=27)=>({World:{Name,Sector,SectorX,SectorY:0,HexX,HexY}});
const response=data=>({ok:true,json:async()=>data});
let instance=0;
async function map(){return import('../js/map.mjs?global-search-native-'+ ++instance);}
async function withFetch(mock,body){const original=globalThis.fetch;globalThis.fetch=mock;try{await body(await map());}finally{globalThis.fetch=original;}}

test('world-only M1105 API deduplicates locations, retains duplicate names and joins authoritative subsectors',async()=>{
 const urls=[];
 await withFetch(async url=>{url=new URL(url);urls.push(url);return response(url.pathname.endsWith('/search')?{Results:{Count:5,Items:[row('Terra Minor','Solomani Rim',0,19,27),row(),row(),row('Terra','Outer Reaches',1,26,27),{Subsector:{Name:'Terra'}}]}}:{Subsectors:[{Index:'K',Name:'Sol'},{Index:'L',Name:'Outer worlds'}]});},async m=>{
  const result=await m.searchWorlds(' Terra ');assert.equal(result.worlds.length,3);assert.equal(result.missingNames,0);assert.equal(result.limited,false);
  assert.deepEqual(result.worlds.map(w=>[w.name,w.sector,w.hex,w.subsectorName]),[['Terra','Outer Reaches','2627','Outer worlds'],['Terra','Solomani Rim','1827','Sol'],['Terra Minor','Solomani Rim','1927','Sol']]);
 });
});

test('exact names sort before prefixes, four-digit padding and A/P boundaries are correct',async()=>{
 const urls=[];
 await withFetch(async url=>{url=new URL(url);urls.push(url);return response(url.pathname.endsWith('/search')?{Results:{Count:3,Items:[row('Terra Minor','A',0,1,1),row('Terra','B',1,32,40),row('Terra','C',2,1,1)]}}:{Subsectors:[{Index:'A',Name:'First'},{Index:'P',Name:'Last'}]});},async m=>{
  const result=await m.searchWorlds('terra');assert.deepEqual(result.worlds.map(w=>[w.name,w.hex,w.subsectorName]),[['Terra','3240','Last'],['Terra','0101','First'],['Terra Minor','0101','First']]);
  assert.equal(planetSearchLabel(result.worlds[0]),'Terra — Last — B — 3240');
  assert.ok(urls.every(u=>u.searchParams.get('milieu')==='M1105'));
  assert.equal(urls[0].searchParams.get('types'),'worlds');assert.equal(urls[0].searchParams.get('q'),'terra');
  assert.ok(urls.slice(1).every(u=>u.searchParams.has('sx')&&u.searchParams.has('sy')&&!u.searchParams.has('sector')));
 });
});

test('metadata loads once per coordinate with bounded concurrency and is reused for new queries',async()=>{
 let active=0,peak=0,metadata=0;
 await withFetch(async url=>{url=new URL(url);if(url.pathname.endsWith('/search'))return response({Results:{Count:12,Items:Array.from({length:12},(_,i)=>row('Duplicate','Sector '+i,i))}});
  metadata++;peak=Math.max(peak,++active);await tick();active--;return response({Subsectors:[{Index:'K',Name:'Real name'}]});
 },async m=>{assert.equal((await m.searchWorlds('Duplicate')).worlds.length,12);assert.equal(peak,4);assert.equal(metadata,12);await m.searchWorlds('Dup');assert.equal(metadata,12);});
});

test('metadata failures preserve results with explicit unknown names and retry failures',async()=>{
 let calls=0;
 await withFetch(async url=>new URL(url).pathname.endsWith('/search')?response({Results:{Count:1,Items:[row()]}}):++calls===1?{ok:false,status:503}:response({Subsectors:[{Index:'K',Name:'Sol'}]}),async m=>{
  const first=await m.searchWorlds('Terra');assert.equal(first.missingNames,1);assert.equal(first.worlds[0].subsectorName,'Subsector K (name unavailable)');
  assert.equal((await m.searchWorlds('Terra')).worlds[0].subsectorName,'Sol');assert.equal(calls,2);
 });
});

test('absent metadata names are never guessed and cap reports returned limit, not total matches',async()=>{
 await withFetch(async url=>response(new URL(url).pathname.endsWith('/search')?{Results:{Count:160,Items:[row()]}}:{Subsectors:[]}),async m=>{
  const result=await m.searchWorlds('Terra');assert.equal(result.limited,true);assert.equal(result.missingNames,1);assert.equal(result.worlds[0].subsectorName,'Subsector K (name unavailable)');
 });
});

test('empty searches avoid network; empty and malformed responses are distinguished',async()=>{
 let data={Results:{Count:0,Items:[]}},calls=0;
 await withFetch(async()=>{calls++;return response(data);},async m=>{
  assert.deepEqual(await m.searchWorlds(' '),{worlds:[],limited:false,missingNames:0});assert.equal(calls,0);
  assert.equal((await m.searchWorlds('Missing')).worlds.length,0);
  data={};await assert.rejects(m.searchWorlds('Missing'),/Invalid planet-search/);
  for(const item of [row('Bad','Sector',0,33,10),row('Bad','Sector',0,0,10),row('Bad','Sector',0,1,41),row('Bad','Sector',0,1.5,1),{World:{Name:'No coordinates'}}]){data={Results:{Items:[item]}};await assert.rejects(m.searchWorlds('Bad'),/Invalid|outside/);}
 });
});

test('aborting metadata enrichment prevents scheduling additional sectors',async()=>{
 const gate=deferred(),controller=new AbortController();let calls=0;
 await withFetch(async url=>{if(new URL(url).pathname.endsWith('/search'))return response({Results:{Items:Array.from({length:9},(_,i)=>row('Terra','Sector '+i,i))}});calls++;await gate.promise;return response({Subsectors:[]});},async m=>{
  const request=m.searchWorlds('Terra',{signal:controller.signal});await tick();assert.equal(calls,4);controller.abort();gate.resolve();await assert.rejects(request,{name:'AbortError'});assert.equal(calls,4);
 });
});

function session(overrides={}){const renders=[],browsed=[];const s=createPlanetSearchSession({render:x=>renders.push(x),delay:100000,search:async()=>({worlds:[{name:'Terra',sector:'Rim',hex:'1827',subsectorName:'Sol'}]}),resolve:async()=>({id:'17,-13'}),onBrowse:async w=>browsed.push(w),...overrides});return {s,renders,browsed,last:()=>renders.at(-1)};}

test('typing only schedules; explicit search cancels the debounce and empty input clears results',async()=>{
 let calls=0;const h=session({search:async()=>{calls++;return {worlds:[]};}});
 h.s.input('t');await h.s.run();assert.equal(calls,0);
 h.s.input('terra');assert.equal(calls,0);await h.s.run();assert.equal(calls,1);assert.match(h.last().message,/No planets/);
 h.s.input('');assert.equal(h.last().rows.length,0);await h.s.choose(0);assert.equal(h.browsed.length,0);h.s.cancel();
});

test('out-of-order queries cannot replace the newest results even if the transport ignores abort',async()=>{
 const old=deferred(),fresh=deferred(),signals=[];const h=session({search:(q,{signal})=>{signals.push(signal);return q==='old'?old.promise:fresh.promise;}});
 h.s.input('old');const a=h.s.run();h.s.input('fresh');const b=h.s.run();assert.equal(signals[0].aborted,true);
 fresh.resolve({worlds:[{name:'Newest'}]});await b;old.resolve({worlds:[{name:'Old'}]});await a;assert.equal(h.last().rows[0].name,'Newest');h.s.cancel();
});

test('late failures cannot overwrite current success; API failures remain retryable',async()=>{
 const old=deferred();let fail=true;const h=session({search:q=>q==='old'?old.promise:fail?Promise.reject(Error('503')):Promise.resolve({worlds:[]})});
 h.s.input('old');const a=h.s.run();h.s.input('new');await h.s.run();assert.match(h.last().message,/503/);assert.equal(h.last().error,true);
 fail=false;await h.s.run();const message=h.last().message;old.reject(Error('old error'));await a;assert.equal(h.last().message,message);h.s.cancel();
});

test('duplicate result clicks resolve only once and browse the chosen location',async()=>{
 const gate=deferred(),calls=[];const h=session({resolve:(sector,hex)=>{calls.push([sector,hex]);return gate.promise;}});
 h.s.input('Terra');await h.s.run();const first=h.s.choose(0);await h.s.choose(0);assert.deepEqual(calls,[['Rim','1827']]);
 gate.resolve({id:'chosen'});await first;assert.deepEqual(h.browsed,[{id:'chosen'}]);h.s.cancel();
});

test('editing query during exact lookup prevents browsing and lets next query run',async()=>{
 const gate=deferred();const h=session({resolve:()=>gate.promise});h.s.input('Terra');await h.s.run();const chosen=h.s.choose(0);
 h.s.input('New');gate.resolve({id:'old'});await chosen;assert.equal(h.browsed.length,0);await h.s.run();assert.equal(h.last().busy,false);h.s.cancel();
});

test('editing query during nearby lookup invalidates the application browse callback',async()=>{
 const gate=deferred(),applied=[];const h=session({onBrowse:async(w,current)=>{await gate.promise;if(current())applied.push(w);}});h.s.input('Terra');await h.s.run();const chosen=h.s.choose(0);await tick();
 h.s.input('New');gate.resolve();await chosen;assert.deepEqual(applied,[]);h.s.cancel();
});

test('closing or replacing the dialog makes late search and selections inert',async()=>{
 let open=true;const gate=deferred();const h=session({isCurrent:()=>open,search:()=>gate.promise});h.s.input('Terra');const request=h.s.run();open=false;const before=h.renders.length;gate.resolve({worlds:[{name:'Late'}]});await request;assert.equal(h.renders.length,before);await h.s.choose(0);assert.equal(h.browsed.length,0);h.s.cancel();
 const exact=deferred();open=true;const next=session({isCurrent:()=>open,resolve:()=>exact.promise});next.s.input('Terra');await next.s.run();const chosen=next.s.choose(0);open=false;exact.resolve({id:'Late'});await chosen;assert.equal(next.browsed.length,0);next.s.cancel();
});

test('failed selection re-enables the existing results for retry without browsing',async()=>{
 let fail=true;const h=session({resolve:async()=>{if(fail)throw Error('No world');return {id:'good'};}});h.s.input('Terra');await h.s.run();await h.s.choose(0);assert.equal(h.last().busy,false);assert.equal(h.last().rows.length,1);assert.match(h.last().message,/Select it again/);assert.equal(h.browsed.length,0);fail=false;await h.s.choose(0);assert.deepEqual(h.browsed,[{id:'good'}]);h.s.cancel();
});

test('a different picker intent invalidates pending global lookup before it can browse',async()=>{
 let version=0;const claimIntent=()=>{const own=++version;return()=>own===version;};
 const gate=deferred();const h=session({claimIntent,resolve:()=>gate.promise});h.s.input('Terra');await h.s.run();const chosen=h.s.choose(0);
 const legacyCurrent=claimIntent();gate.resolve({id:'old'});await chosen;assert.equal(legacyCurrent(),true);assert.equal(h.browsed.length,0);
 h.s.input('New');assert.equal(legacyCurrent(),false);h.s.cancel();
});

// Execute the real Find World integration with its I/O boundaries doubled.
// This checks shared ownership between global and legacy controls, not a copy
// of the production handler or campaign mutation implementation.
import {readFile} from 'node:fs/promises';
const appSource=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const findSource=appSource.slice(appSource.indexOf('function findWorld(){'),appSource.indexOf('\nconst planetCache='));
function findHarness(){
 let submit,searchOptions,current=true,view=null,nearby=async()=>[],resolve=async()=>({id:'legacy'}),location=null,renders=0;
 const elements=new Map(['find-world','global-world-search','choose-starting-world','modal-error'].map(id=>[id,{disabled:false,textContent:''}]));
 const appSession={},known={};
 // Find World now binds mutable handoff to this campaign/editor tenure.
 // These unchanged ambient values keep the isolated browse fixture editable.
 const campaignContext={state:{revision:0},campaignPublicationEpoch:0,editingLossEpoch:0,store:{editable:true},campaignReloadRequired:false};
 const env={...campaignContext,modal:(title,body,handler)=>{submit=handler;},createWorldPicker:()=>({resolve:()=>resolve()}),createGlobalWorldSearch:(host,options)=>{searchOptions=options;},$:id=>elements.get(id),viewed:()=>null,activeModal:appSession,modalCurrent:s=>current&&s===appSession,M:{nearby:()=>nearby()},known,render:()=>renders++,scheduleMapAreas(){},rememberWorld(){},closeModal:()=>current=false,setLocation:w=>{location=w;current=false;}};
 const setup=new Function(...Object.keys(env),'let view=null,mapPan={},mapZoom=1;'+findSource+'; findWorld();return()=>view;')(...Object.values(env));
 return {elements,known,search:()=>searchOptions,setResolve:f=>resolve=f,setNearby:f=>nearby=f,submit:()=>submit(null,()=>current),get view(){return setup();},get location(){return location;},get renders(){return renders;}};
}

test('global input supersedes legacy browse at exact and nearby stages without stale close or mutation',async()=>{
 for(const phase of ['exact','nearby']){
  const h=findHarness(),gate=deferred();if(phase==='exact')h.setResolve(()=>gate.promise);else h.setNearby(()=>gate.promise);
  const legacy=h.submit();await tick();h.search().claimIntent();gate.resolve(phase==='exact'?{id:'old'}:[]);
  assert.equal(await legacy,false,'Stale submit must not close the modal');assert.equal(h.view,null);assert.deepEqual(h.known,{});assert.equal(h.renders,0);
 }
});

test('superseded legacy browse errors stay out of the newer dialog',async()=>{
 const h=findHarness(),gate=deferred();h.setResolve(()=>gate.promise);const legacy=h.submit();h.search().claimIntent();gate.reject(Error('old failure'));
 assert.equal(await legacy,false);assert.equal(h.elements.get('modal-error').textContent,'');assert.equal(h.view,null);
});

test('starting-world lookup cannot open a confirmation after a newer global intent',async()=>{
 for(const failed of [false,true]){
  const h=findHarness(),gate=deferred();h.setResolve(()=>gate.promise);const old=h.elements.get('choose-starting-world').onclick();h.search().claimIntent();
  if(failed)gate.reject(Error('old failure'));else gate.resolve({id:'old'});await old;
  assert.equal(h.location,null);assert.equal(h.elements.get('modal-error').textContent,'');assert.equal(h.elements.get('choose-starting-world').disabled,false);assert.deepEqual(h.known,{});
 }
});

test('legacy browse remains atomic and shared intent retires a pending global completion',async()=>{
 const h=findHarness(),near=deferred(),oldCurrent=h.search().claimIntent();h.setNearby(()=>near.promise);
 const legacy=h.submit();await tick();assert.equal(oldCurrent(),false);assert.equal(h.view,null);assert.deepEqual(h.known,{});
 near.resolve([{id:'neighbor'}]);assert.equal(await legacy,undefined);assert.equal(h.view,'legacy');assert.deepEqual(Object.keys(h.known).sort(),['legacy','neighbor']);
});

test('an old debounce cannot reclaim intent after an explicit legacy selection',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let version=0,searches=0;const claimIntent=()=>{const own=++version;return()=>version===own;};
 const h=session({delay:300,claimIntent,search:async()=>{searches++;return {worlds:[]};}});
 h.s.input('Terra');t.mock.timers.tick(299);const legacyCurrent=claimIntent();t.mock.timers.tick(1);
 assert.equal(searches,0);assert.equal(legacyCurrent(),true);h.s.cancel();
});

test('superseded global activity returns to usable results without stealing legacy ownership',async()=>{
 let version=0;const claimIntent=()=>{const own=++version;return()=>own===version;};
 const gate=deferred();const h=session({claimIntent,resolve:()=>gate.promise});h.s.input('Terra');await h.s.run();const chosen=h.s.choose(0);
 const legacy=claimIntent();gate.resolve({id:'old'});await chosen;assert.equal(h.last().busy,false);assert.equal(h.last().rows.length,1);assert.equal(legacy(),true);assert.equal(h.browsed.length,0);h.s.cancel();
});


test('Escape in the search input dismisses once and suppresses native search-field clearing',()=>{
 const original=globalThis.document;
 function element(){return {children:[],listeners:{},classList:{add(){}},append(...xs){this.children.push(...xs);},setAttribute(){},replaceChildren(...xs){this.children=xs;},addEventListener(name,fn){this.listeners[name]=fn;},closest(){return null;},focus(){this.focused=true;}};}
 globalThis.document={createElement:element};
 try{
  const host=element();let dismissed=0,prevented=0,stopped=0;
  createGlobalWorldSearch(host,{onBrowse:()=>assert.fail('Escape must not browse'),isCurrent:()=>true,onDismiss:()=>dismissed++});
  const input=host.children[1].children[0].children[1];
  assert.equal(input.type,'search');assert.equal(input.focused,true);
  input.listeners.keydown({key:'Escape',preventDefault:()=>prevented++,stopPropagation:()=>stopped++});
  assert.equal(dismissed,1);assert.equal(prevented,1);assert.equal(stopped,1);
 }finally{globalThis.document=original;}
});
