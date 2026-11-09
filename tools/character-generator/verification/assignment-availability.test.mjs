import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CAREERS} from '../engine/catalog.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);
let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));
source+='\nexport const audit={initial,apply,availableCareers,conditionMatches,RULE_PACK};';
const {audit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function state(gender,soc,current=true){const s=a.initial('assignment-availability');if(current){s.deferredSpecializations=true;s.correctedCareerEvents=true;}s.stage='career';s.character.species='aslan';s.character.culture='native';s.character.gender=gender;s.character.stats={STR:9,DEX:9,END:9,INT:9,EDU:9,SOC:soc,RITE:6};return s;}
// Aliens 2026 p30: males with SOC9+ cannot enter Support; p23 summary agrees.
for(const gender of ['male','female'])for(const soc of [8,9])test('Military support visibility matches entry: '+gender+' SOC'+soc,()=>{
 const s=state(gender,soc),career=a.availableCareers(s).find(c=>c.id==='aslan.military'),assignment=career.assignments.find(x=>x.id==='support'),allowed=gender==='female'||soc<=8;
 assert.equal(!assignment.disabled,allowed);const command={type:'career',payload:{id:career.id,assignment:assignment.id}};
 if(allowed)assert.doesNotThrow(()=>a.apply(structuredClone(s),command,[]));else assert.throws(()=>a.apply(structuredClone(s),command,[]),/prerequisites|SOC|restriction/);
});
test('all Aslan assignment-specific prerequisites are reflected in new choices',()=>{
 for(const gender of ['male','female'])for(const soc of [6,8,9,12]){const s=state(gender,soc);for(const c of a.availableCareers(s).filter(c=>c.group==='aslan'))for(const assignment of c.assignments){const pre=a.RULE_PACK[c.id]?.prerequisites?.assignments?.[assignment.id],required=CAREERS.find(x=>x.id===c.id).eligibility?.[assignment.id];if(!a.conditionMatches(s,pre)||required&&required!==gender)assert.equal(assignment.disabled,true,c.id+'/'+assignment.id+' '+gender+' SOC'+soc);}}
});
test('historical projections retain their original assignment choice shape',()=>{const c=a.availableCareers(state('male',9,false)).find(c=>c.id==='aslan.military');assert.equal(Object.hasOwn(c.assignments.find(x=>x.id==='support'),'disabled'),false);});
