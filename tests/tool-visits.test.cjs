const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/../assets/js/tool-visits.js','utf8');
function run(path,host='owlsnestnh.github.io',hidden=false){
 const requests=[],events={};const document={visibilityState:hidden?'hidden':'visible',body:{appendChild(){}},addEventListener:(e,f)=>events[e]=f,removeEventListener:e=>delete events[e]};
 const context=vm.createContext({location:{hostname:host,pathname:path},window:{},document,Image:class{set src(v){requests.push(v)}remove(){}}});
 vm.runInContext(code,context);vm.runInContext(code,context);
 return {requests,document,events};
}
for(const tool of ['nav-calculator','traveller_ship_logger_v2','traveller_tools_buttons','trade-route-calculator'])for(const file of ['', 'index.html'])assert.equal(run('/Traveller-Tools/tools/'+tool+'/'+file).requests.length,1);
assert.equal(run('/Traveller-Tools/tools/vehicle-builder/Traveller-Vehicle-Builder.html').requests.length,1);
for(const path of ['/Traveller-Tools/','/Traveller-Tools/tools/vehicle-builder/','/Traveller-Tools/tools/vehicle-builder/source/dist/index.html','/Traveller-Tools/tools/spec-trade/','/Traveller-Tools/tools/nav-calculator/audit.html'])assert.equal(run(path).requests.length,0);
assert.equal(run('/Traveller-Tools/tools/nav-calculator/','localhost').requests.length,0);
const h=run('/Traveller-Tools/tools/nav-calculator/','owlsnestnh.github.io',true);assert.equal(h.requests.length,0);h.document.visibilityState='visible';h.events.visibilitychange();assert.equal(h.requests.length,1);
const html=fs.readFileSync(__dirname+'/../index.html','utf8');assert.equal((html.match(/img.shields.io\/badge\/dynamic\/json/g)||[]).length,5);assert.ok(!html.includes('hits.sh/owlsnestnh'));assert.match(html,/<h2>Traveller Ship Operations — Beta<\/h2>/);assert.doesNotMatch(html,/<h2>Traveller Ship Operations — Alpha<\/h2>/);
console.log('PASS five independent tool counters, redirect exclusion, read-only homepage, canonical paths, duplicate script guard, background-tab deferral and offline/preview exclusion.');

