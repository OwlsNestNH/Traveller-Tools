import test from 'node:test';
import assert from 'node:assert/strict';
import {campaign,core,origin,destination,bindings,same} from './app-harness.mjs';
import {depositHarness} from './deposit-save-harness.mjs';
import {planetInformation} from '../js/planet-info.mjs';
const publishedUWP='A788899-C',effectiveUWP='B563456-8';
function fixture(){
 const s=campaign();
 for(const w of Object.values(s.worlds))w.raw={UWP:publishedUWP,Zone:'',PBG:'703',Bases:'NS',SubsectorName:'Fixture',Allegiance:'Im'};
 s.snapshots=[{id:'historic-world',kind:'supplier',worldId:s.actual,world:bindings.R.context(s.worlds[s.actual],core),party:'fixture',partyName:'Fixture supplier',hours:0,startedHours:0,options:{},offers:[]}];
 return s;
}
const setup=(s=fixture(),id=s.actual)=>{const h=depositHarness(s,{setTimeout:()=>0,clearTimeout(){}});h.api.setTab('Overview');h.api.setView(id);h.api.render();return h;};
const screen=h=>h.dom.ids.get('main').innerHTML.match(/<aside id="world-information-panel"[\s\S]*?<\/aside>/)[0];
const profile=html=>html.match(/<section class="screen-uwp">[\s\S]*?<\/section>/)[0];
const fields=html=>[...profile(html).matchAll(/<tr><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)].map(m=>m.slice(1));
const summary=(html,label)=>html.match(new RegExp('<dt>'+label+'<\\/dt><dd>([^<]*)<\\/dd>'))?.[1];
for(const target of [origin,destination])test(`effective UWP MFD save/cancel/reload/Undo at ${target.name} preserves source and campaign economics`,async()=>{
 const h=setup(fixture(),target.id),before=h.persisted(),beforeScreen=screen(h);
 const open=()=>{h.api.actions.override(target.id);h.fill({uwp:effectiveUWP,reason:'Campaign survey <confirmed>'});};
 open();same(h.persisted(),before);h.api.closeModal();same(h.persisted(),before);assert.equal(screen(h),beforeScreen);
 open();await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'');assert.equal(h.counters.writes,1);
 const after=h.persisted(),w=after.worlds[target.id],html=screen(h),effective=planetInformation(w,{uwp:effectiveUWP});
 assert.equal(w.overrideUWP,effectiveUWP);assert.equal(after.actual,before.actual);assert.equal(h.api.view,target.id);
 assert.match(profile(html),/Effective Universal World Profile/);assert.match(profile(html),/>B563456-8<\/span>/);
 same(fields(html),effective.decoded);assert.equal(fields(html).length,8);
 assert.equal(summary(html,'Population'),'7 × 10^4 = 70,000');
 assert.match(html,/Published UWP: <span class="mono">A788899-C<\/span>/);assert.match(html,/Reason: Campaign survey &lt;confirmed&gt;/);assert.match(html,/published PBG multiplier/);
 for(const key of ['actual','bank','hours','route','lots','contracts','ship','ledger','snapshots'])same(after[key],before[key]);same(w.raw,before.worlds[target.id].raw);
 same(planetInformation(w),planetInformation(before.worlds[target.id]));same(bindings.worldMapFacts(w),bindings.worldMapFacts(before.worlds[target.id]));
 for(const label of ['Sector / hex','Subsector','Allegiance','Travel zone','Gas giants','Bases'])assert.equal(summary(html,label),summary(beforeScreen,label));
 for(const code of bindings.R.context(w,core).codes)assert.ok(html.includes('>'+code+'</span>'));
 for(let i=0;i<6;i++)h.api.actions['map-zoom-in']();h.api.render();assert.match(h.dom.ids.get('main').innerHTML,/class="world-uwp"[^>]*>B563456-8<\/text>/);
 const fresh=setup(after,target.id);assert.equal(profile(screen(fresh)),profile(html));assert.match(screen(fresh),/Reason: Campaign survey &lt;confirmed&gt;/);
 fresh.api.actions.undo();same(fresh.persisted().worlds[target.id],before.worlds[target.id]);assert.match(profile(screen(fresh)),/>A788899-C<\/span>/);assert.doesNotMatch(screen(fresh),/Campaign UWP override/);
});

test('published decoder stays default; explicit UWP replaces every decoded field and population exponent only',()=>{
 const w=fixture().worlds[origin.id],before=structuredClone(w),published=planetInformation(w),effective=planetInformation(w,{uwp:effectiveUWP});
 assert.equal(published.uwp,publishedUWP);assert.equal(effective.uwp,effectiveUWP);
 assert.deepEqual(effective.decoded.map(r=>r[1]),['B','5','6','3','4','5','6','8']);
 assert.deepEqual(effective.summary.filter(r=>r[0]!=='Population'),published.summary.filter(r=>r[0]!=='Population'));
 for(const key of ['system','remarks','sections'])assert.deepEqual(effective[key],published[key]);assert.deepEqual(w,before);
});
for(const pbg of [undefined,'???','?03'])test(`missing population multiplier stays unknown with PBG ${pbg}`,()=>{
 const s=fixture(),w=s.worlds[s.actual];w.raw.PBG=pbg;w.overrideUWP=effectiveUWP;
 const h=setup(s);assert.equal(summary(screen(h),'Population'),'Not supplied');assert.match(profile(screen(h)),/>B563456-8<\/span>/);
});
for(const [uwp,pbg,pop]of [['B563?56-8','703','Not supplied'],['???????-?','703','Not supplied'],['X000000-0','000','0 × 10^0 = 0'],['B563456-8','003','1 × 10^4 = 10,000 (Traveller Map assumes multiplier 1 when recorded as 0)']])test(`effective unknown/zero population ${uwp}, ${pbg} remains explicit`,()=>{
 const s=fixture(),w=s.worlds[s.actual];w.overrideUWP=uwp;w.raw.PBG=pbg;
 const h=setup(s);assert.equal(summary(screen(h),'Population'),pop);assert.equal(fields(screen(h)).length,8);assert.equal(planetInformation(w).uwp,publishedUWP);
});
for(const invalid of ['invalid','B563Z56-8'])test(`invalid effective UWP ${invalid} shows published fallback without mutation`,()=>{
 const s=fixture();s.worlds[s.actual].overrideUWP=invalid;const h=setup(s),before=h.persisted(),html=screen(h);
 assert.match(html,/Effective UWP unavailable; published UWP and population are shown/);assert.match(profile(html),/>A788899-C<\/span>/);assert.doesNotMatch(profile(html),/Effective Universal/);assert.equal(summary(html,'Population'),'7 × 10^8 = 700,000,000');same(h.persisted(),before);assert.equal(h.counters.writes,0);
});
test('invalid editor value and missing reason do not save or update the MFD',async()=>{
 for(const values of [{uwp:'invalid',reason:'Fixture'},{uwp:effectiveUWP,reason:''}]){
  const h=setup(),before=h.persisted(),original=screen(h);h.api.actions.override(origin.id);h.fill(values);await h.submit();assert.ok(h.dom.ids.get('modal-error').textContent);assert.equal(h.dom.ids.get('modal').open,true);assert.equal(h.counters.writes,0);same(h.persisted(),before);assert.equal(screen(h),original);
 }
});
test('absent raw metadata is retained as unknown while an effective UWP still decodes',()=>{
 const s=fixture(),w=s.worlds[s.actual];delete w.raw;w.overrideUWP=effectiveUWP;const h=setup(s),html=screen(h);
 assert.match(profile(html),/>B563456-8<\/span>/);assert.equal(summary(html,'Population'),'Not supplied');assert.equal(summary(html,'Gas giants'),'Not supplied');assert.equal(summary(html,'Bases'),'Not supplied');assert.match(html,/Reason: Not recorded/);
});
