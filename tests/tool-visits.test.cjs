const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/../assets/js/tool-visits.js','utf8');
function run(path,host='owlsnestnh.github.io',hidden=false){
 const requests=[],events={};const document={visibilityState:hidden?'hidden':'visible',body:{appendChild(){}},addEventListener:(e,f)=>events[e]=f,removeEventListener:e=>delete events[e]};
 const context=vm.createContext({location:{hostname:host,pathname:path},window:{},document,Image:class{set src(v){requests.push(v)}remove(){}}});
 vm.runInContext(code,context);vm.runInContext(code,context);
 return {requests,document,events};
}
for(const tool of ['nav-calculator','traveller_ship_logger_v2','traveller_tools_buttons','trade-route-calculator','ship-combat-alpha','robot-builder','character-generator'])for(const file of ['', 'index.html'])assert.equal(run('/Traveller-Tools/tools/'+tool+'/'+file).requests.length,1);
assert.equal(run('/Traveller-Tools/tools/vehicle-builder/Traveller-Vehicle-Builder.html').requests.length,1);
for(const path of ['/Traveller-Tools/','/Traveller-Tools/tools/vehicle-builder/','/Traveller-Tools/tools/vehicle-builder/source/dist/index.html','/Traveller-Tools/tools/spec-trade/','/Traveller-Tools/tools/nav-calculator/audit.html'])assert.equal(run(path).requests.length,0);
assert.equal(run('/Traveller-Tools/tools/nav-calculator/','localhost').requests.length,0);
const h=run('/Traveller-Tools/tools/nav-calculator/','owlsnestnh.github.io',true);assert.equal(h.requests.length,0);h.document.visibilityState='visible';h.events.visibilitychange();assert.equal(h.requests.length,1);
const html=fs.readFileSync(__dirname+'/../index.html','utf8');assert.equal((html.match(/img.shields.io\/badge\/dynamic\/json/g)||[]).length,8);assert.ok(!html.includes('hits.sh/owlsnestnh'));assert.match(html,/<h2>Traveller Ship Operations — Beta<\/h2>/);assert.doesNotMatch(html,/<h2>Traveller Ship Operations — Alpha<\/h2>/);
const cards = [...html.matchAll(/<section class="tool-card">([\s\S]*?)<\/section>/g)].map(match => match[1]);
assert.deepEqual(cards.map(card => card.match(/<h2>(.*?)<\/h2>/)[1]), [
 'Nav Calculator',
 'Traveller Tool Locker',
 'Traveller Ship Operations — Beta',
 'Character Generator - Beta',
 'Traveller Vehicle Builder',
 'Robot Builder - Beta',
 'Ship Combat Alpha',
 'Ship’s Log &amp; Ledger'
], 'Homepage tool order must keep Character Generator fourth and Ship Combat seventh.');
for (const [index, tool, changelog] of [[3, 'character-generator', 'character'], [6, 'ship-combat-alpha', 'combat']]) {
 const card = cards[index];
 assert.deepEqual([...card.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match => match[1]), [
  `tools/${tool}/`, `changes/${changelog}.html`
 ], `${tool} must retain its own launch and changelog links.`);
 assert.match(card, new RegExp(`<a href="tools/${tool}/" target="_blank" rel="noopener">`));
 assert.match(card, new RegExp(`<a class="changelog-link" href="changes/${changelog}\\.html">`));
 const badges = [...card.matchAll(/<img\b[^>]*src="([^"]+)"/g)];
 assert.equal(badges.length, 1, `${tool} must retain one visit badge.`);
 const badge = new URL(badges[0][1].replaceAll('&amp;', '&'));
 assert.equal(badge.origin + badge.pathname, 'https://img.shields.io/badge/dynamic/json');
 assert.equal(badge.searchParams.get('url'), `https://hits.sh/api/urns/owlsnestnh.github.io/Traveller-Tools/tools/${tool}`);
 assert.equal(badge.searchParams.get('query'), '$.total');
 assert.equal(badge.searchParams.get('label'), 'visits');
}
assert.match(cards[6], /<strong>Under construction<\/strong>/);
console.log('PASS homepage tool order and moved-card launch links, changelogs, status and independent visit badges.');
console.log('PASS eight independent tool counters, redirect exclusion, read-only homepage, canonical paths, duplicate script guard, background-tab deferral and offline/preview exclusion.');


assert.equal(run('/Traveller-Tools/tools/ship-combat-alpha/','localhost').requests.length,0);
assert.equal(run('/Traveller-Tools/archive/').requests.length,0);
const ship=run('/Traveller-Tools/tools/ship-combat-alpha/');assert.equal(ship.requests[0],'https://hits.sh/owlsnestnh.github.io/Traveller-Tools/tools/ship-combat-alpha.svg');
