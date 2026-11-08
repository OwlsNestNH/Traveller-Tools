import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const url=new URL('../engine/session.mjs',import.meta.url);let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));source+='\nexport const audit={initial,apply};';
const {audit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function rite(values,gender='male'){
 const s=a.initial('rite');s.character.species='aslan';s.character.gender=gender;s.character.stats={STR:8,DEX:8,END:8,INT:8,EDU:8,SOC:8};
 s.stage='book-step';s.pending={kind:'species-setup',source:'aliens',page:16,next:'background'};s._override={index:0,values};
 const rolls=[];a.apply(s,{type:'resolve-book',payload:{confirmed:true,effects:[],birthOrder:gender==='male'?'second-son':'daughter'}},rolls);return {s,rolls};
}
test('ordinary Aslan rite uses one roll and applies no doubles event',()=>{
 const {s,rolls}=rite([1,2]);assert.equal(s.character.stats.RITE,6);assert.equal(s.stage,'background');assert.equal(rolls.length,1);assert.deepEqual(s.character.benefits,[]);
});
test('double1 rite awards the sourced Clan Shares and logs their separate roll',()=>{
 const {s,rolls}=rite([1,1]);assert.equal(s.character.stats.RITE,6);assert.equal(rolls.length,2);assert.equal(s.character.benefits[0].name,'Clan Share');assert.equal(s.character.benefits[0].quantity,rolls[1].total);assert.equal(s.stage,'background');
});
test('double6 rite applies END gain after calculating its DM',()=>{
 const {s}=rite([6,6]);assert.equal(s.character.stats.RITE,0);assert.equal(s.character.stats.END,9);assert.equal(s.stage,'background');
});
test('double2 rite respects female cash versus male equipment choice',()=>{
 assert.equal(rite([2,2],'female').s.character.cash,5000);
 const {s}=rite([2,2],'male');assert.equal(s.stage,'book-step');assert.equal(s.pending.source,'aliens');assert.equal(s.pending.page,21);assert.equal(s.pending.effect.kind,'equipment-credit');assert.equal(s.character.cash,0);
});
