import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
test('all supported historical PSI generation saves retain exact state, bytes and random sequence',()=>{
 const data=JSON.parse(readFileSync(new URL('./psi-historical.json',import.meta.url),'utf8'));
 for(const c of data.cases){
  let s={...createSession('psi-historical-'+c.species),rulesRevision:'character-preview-2026-11-09.'+c.revision};
  for(const [type,payload] of [['configure',{extras:['PSI','LCK']}],['setup',{species:c.species,culture:'imperial',gender:'female'}],['roll-statistics',{}]])s=execute(s,{type,payload}).session;
  s=execute(importSession(exportSession(s)),{type:'accept-statistics',payload:{}}).session;
  const raw=exportSession(s);assert.equal(hash(raw),c.saveHash,JSON.stringify(c));assert.equal(hash(JSON.stringify(project(s).state)),c.stateHash,JSON.stringify(c));assert.equal(exportSession(importSession(raw)),raw);
 }
});

