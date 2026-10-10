import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,campaign,origin,destination} from './route-selection-harness.mjs';

// These execute the released application functions and dispatchers with real
// state/routing modules. DOM/network doubles are not a browser accessibility test.
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const empty=id=>{const [x,y]=id.split(',').map(Number);return {...origin,id,x,y,name:'Empty '+id,hex:String(x+1).padStart(2,'0')+String(y+1).padStart(2,'0'),emptySpace:true};};
const bytes=h=>JSON.stringify(h.persisted());
function setup(mode='build',mapOverrides={}){
 const requests=[];
 const h=harness(campaign(),{nearby:async()=>[],loadMapHex:(x,y)=>new Promise((resolve,reject)=>requests.push({id:x+','+y,resolve,reject})),...mapOverrides});
 h.api.startMapRoute(mode);return {...h,requests};
}
function unchanged(h,before){assert.equal(bytes(h),before);assert.equal(h.calls.saves,0);}
function ids(h){return Array.from(h.api.routeDraft.stops);}
function path(h){return Array.from(h.api.routeDraft.path);}

test('Build route reserves empty-hex clicks before lookup, keeping reversed responses in click order',async()=>{
 const h=setup(),before=bytes(h),first=h.api.mapEmpty('2,1'),second=h.api.mapEmpty('2,0');
 assert.deepEqual(ids(h),['2,1','2,0']);assert.equal(h.api.routeDraft.loading,true);
 assert.throws(()=>h.api.saveMapRoute(),/valid route/);
 assert.match(h.api.mapRouteControls(),/Hex 2,1 \(checking…\)/);
 assert.deepEqual(Array.from(h.api.routeDraft.selections,s=>s.sequence),[1,2]);
 await tick();h.requests[1].resolve(empty('2,0'));await second;
 assert.equal(h.api.routeDraft.loading,true);assert.throws(()=>h.api.saveMapRoute(),/valid route/);
 h.requests[0].resolve(empty('2,1'));await first;
 assert.deepEqual(path(h),[origin.id,'2,1','2,0']);assert.equal(h.api.routeDraft.loading,false);assert.equal(h.api.routeDraft.error,'');unchanged(h,before);
});

test('Build route keeps a known world between pending unknown clicks, including duplicate suppression',async()=>{
 const h=setup(),before=bytes(h),first=h.api.mapEmpty('2,0');
 await h.api.mapWorld(destination.id);const last=h.api.mapEmpty('2,1');await h.api.mapEmpty('2,1');
 assert.deepEqual(ids(h),['2,0',destination.id,'2,1']);await tick();
 assert.equal(h.requests.length,2);h.requests[1].resolve(empty('2,1'));await last;
 assert.equal(h.api.routeDraft.loading,true);h.requests[0].resolve(empty('2,0'));await first;
 assert.deepEqual(path(h),[origin.id,'2,0',destination.id,'2,1']);assert.equal(h.api.routeDraft.error,'');unchanged(h,before);
});

for(const newer of ['known world','unknown hex','origin'])test('Auto plot ignores older lookup after newer '+newer,async()=>{
 const h=setup('auto'),before=bytes(h),old=h.api.mapEmpty('2,0');await tick();
 let latest;
 if(newer==='known world')await h.api.mapWorld(destination.id);
 if(newer==='origin')await h.api.mapWorld(origin.id);
 if(newer==='unknown hex'){latest=h.api.mapEmpty('2,1');await tick();h.requests[1].resolve(empty('2,1'));await latest;}
 const selected=ids(h),route=path(h),message=h.dom.ids.get('message').textContent;
 h.requests[0].resolve(empty('2,0'));await old;
 assert.deepEqual(ids(h),selected);assert.deepEqual(path(h),route);assert.equal(h.api.known['2,0'],undefined);assert.equal(h.dom.ids.get('message').textContent,message);
 assert.deepEqual(selected,newer==='origin'?[]:[newer==='known world'?destination.id:'2,1']);unchanged(h,before);
});

test('Selecting an unknown Auto destination immediately invalidates the prior route calculation',async()=>{
 const nearbyRequests=[];const h=setup('auto',{nearby:w=>new Promise(resolve=>nearbyRequests.push({id:w.id,resolve}))}),before=bytes(h);
 const old=h.api.mapWorld(destination.id);assert.equal(nearbyRequests.length,1);
 const latest=h.api.mapEmpty('2,0');await tick();nearbyRequests[0].resolve([]);await old;
 assert.deepEqual(ids(h),['2,0']);assert.deepEqual(path(h),[origin.id]);assert.equal(h.api.routeDraft.loading,true);
 h.requests[0].resolve(empty('2,0'));await tick();nearbyRequests[1].resolve([]);await tick();nearbyRequests[2].resolve([]);await latest;
 assert.deepEqual(path(h),[origin.id,'2,0']);unchanged(h,before);
});

test('A failed lookup remains an ordered, unsavable stop; Retry route restores the same position',async()=>{
 const h=setup(),before=bytes(h),failed=h.api.mapEmpty('2,0');await h.api.mapWorld(destination.id);await tick();
 h.requests[0].reject(Error('Synthetic offline response'));await assert.rejects(failed,/Synthetic offline response.*Retry route/);
 assert.deepEqual(ids(h),['2,0',destination.id]);assert.equal(h.api.routeDraft.loading,false);assert.match(h.api.routeDraft.error,/Could not check hex 2,0/);
 assert.match(h.api.mapRouteControls(),/lookup failed/);assert.throws(()=>h.api.saveMapRoute(),/valid route/);
 const retry=h.api.actions['route-retry']();await tick();assert.equal(h.api.routeDraft.loading,true);assert.equal(h.requests.length,2);
 h.requests[1].resolve(empty('2,0'));await retry;
 assert.deepEqual(path(h),[origin.id,'2,0',destination.id]);assert.equal(h.api.routeDraft.error,'');unchanged(h,before);
});

test('Removing a failed selection explicitly allows the remaining valid route',async()=>{
 const h=setup(),before=bytes(h),work=h.api.mapEmpty('2,0');await h.api.mapWorld(destination.id);await tick();
 h.requests[0].reject(Error('Offline'));await assert.rejects(work,/Offline/);await h.api.removeMapStop(0);
 assert.deepEqual(path(h),[origin.id,destination.id]);assert.equal(h.api.routeDraft.error,'');assert.equal(h.api.routeDraft.loading,false);unchanged(h,before);
});

for(const result of ['success','failure'])for(const boundary of ['cancel','new draft','revision change','import','ownership loss','remove','remove and reselect'])test('Pending '+result+' respects '+boundary,async()=>{
 const h=setup(),before=bytes(h),work=h.api.mapEmpty('2,0');await tick();let replacement;
 if(boundary==='cancel')h.api.actions['route-cancel']();
 if(boundary==='new draft')h.api.startMapRoute('build');
 if(boundary==='revision change'){const next=structuredClone(h.api.state);next.revision++;h.api.setState(next);}
 if(boundary==='import'){const next=campaign();next.revision++;next.ship.name='Imported campaign';h.api.setState(next);}
 if(boundary==='ownership loss'){h.store.editable=false;h.api.render();h.store.editable=true;}
 if(boundary==='remove'||boundary==='remove and reselect')await h.api.removeMapStop(0);
 if(boundary==='remove and reselect'){replacement=h.api.mapEmpty('2,0');await tick();}
 const message=h.dom.ids.get('message').textContent;
 if(result==='success')h.requests[0].resolve(empty('2,0'));else h.requests[0].reject(Error('Obsolete request'));
 await work;assert.equal(h.api.known['2,0'],undefined);assert.equal(h.dom.ids.get('message').textContent,message);
 if(replacement){assert.equal(h.api.routeDraft.loading,true);h.requests[1].resolve(empty('2,0'));await replacement;assert.deepEqual(path(h),[origin.id,'2,0']);}
 else assert.ok(!h.api.routeDraft?.stops.length);
 unchanged(h,before);
});

test('Ordinary tab navigation keeps the draft and ordered lookup response without saving campaign data',async()=>{
 const h=setup(),before=bytes(h),work=h.api.mapEmpty('2,0');await tick();h.api.actions.tab('Cargo');await h.api.mapWorld(destination.id);
 h.requests[0].resolve(empty('2,0'));await work;assert.deepEqual(path(h),[origin.id,'2,0',destination.id]);unchanged(h,before);
});

for(const key of ['Enter',' '])test('Keyboard '+JSON.stringify(key)+' awaits map errors through the normal visible error wrapper',async()=>{
 const h=setup(),before=bytes(h),target={dataset:{action:'map-empty',arg:'2,0'},matches:()=>true};let prevented=0;
 const dispatch=h.dom.dispatch('keydown',target,{key,preventDefault(){prevented++;}});await tick();
 h.requests[0].reject(Error('Synthetic API failure'));await dispatch;
 assert.equal(prevented,1);assert.match(h.dom.ids.get('message').textContent,/Synthetic API failure.*Retry route/);
 assert.equal(h.dom.ids.get('message').className,'visible error');assert.match(h.api.routeDraft.error,/Synthetic API failure/);assert.equal(h.api.routeDraft.loading,false);unchanged(h,before);
});

for(const key of ['Enter',' '])test('Keyboard '+JSON.stringify(key)+' cancellation consumes obsolete async failures',async()=>{
 const h=setup(),before=bytes(h),target={dataset:{action:'map-empty',arg:'2,0'},matches:()=>true};
 const dispatch=h.dom.dispatch('keydown',target,{key,preventDefault(){}});await tick();h.api.actions['route-cancel']();
 const message=h.dom.ids.get('message').textContent;h.requests[0].reject(Error('Cancelled API failure'));await dispatch;
 assert.equal(h.api.routeDraft,null);assert.equal(h.dom.ids.get('message').textContent,message);unchanged(h,before);
});

test('Only explicit route confirmation persists the ordered route; planning leaves campaign bytes unchanged',async()=>{
 const h=setup(),before=bytes(h),first=h.api.mapEmpty('2,1'),last=h.api.mapEmpty('2,0');await tick();
 h.requests[1].resolve(empty('2,0'));await last;h.requests[0].resolve(empty('2,1'));await first;unchanged(h,before);
 h.api.saveMapRoute();unchanged(h,before);await h.submit();
 assert.equal(h.dom.ids.get('modal-error').textContent,'');assert.equal(h.calls.saves,1);
 assert.deepEqual(h.persisted().mandatoryStops,['2,1','2,0']);assert.deepEqual(h.persisted().route,[origin.id,'2,1','2,0']);
 for(const name of ['actual','hours','bank','lots','contracts','policies'])assert.deepEqual(h.persisted()[name],JSON.parse(before)[name]);
});

test('Retrying multiple failed selections preserves order and repeated retry does not duplicate requests',async()=>{
 const h=setup(),before=bytes(h),a=h.api.mapEmpty('2,1'),b=h.api.mapEmpty('2,0');await tick();
 h.requests[0].reject(Error('First unavailable'));h.requests[1].reject(Error('Second unavailable'));
 await Promise.all([assert.rejects(a,/First unavailable/),assert.rejects(b,/Second unavailable/)]);
 const retry=h.api.retryMapRoute();await h.api.retryMapRoute();await tick();assert.equal(h.requests.length,4);
 h.requests[3].resolve(empty('2,0'));await tick();assert.equal(h.api.routeDraft.loading,true);assert.throws(()=>h.api.saveMapRoute(),/valid route/);
 h.requests[2].resolve(empty('2,1'));await retry;assert.deepEqual(path(h),[origin.id,'2,1','2,0']);assert.equal(h.api.routeDraft.error,'');unchanged(h,before);
});

test('Auto plot consumes obsolete lookup failures after a newer valid known destination',async()=>{
 const h=setup('auto'),before=bytes(h),old=h.api.mapEmpty('2,0');await tick();await h.api.mapWorld(destination.id);
 const message=h.dom.ids.get('message').textContent;h.requests[0].reject(Error('Obsolete outage'));await old;
 assert.equal(h.dom.ids.get('message').textContent,message);assert.equal(h.api.routeDraft.error,'');assert.deepEqual(path(h),[origin.id,destination.id]);unchanged(h,before);
});
