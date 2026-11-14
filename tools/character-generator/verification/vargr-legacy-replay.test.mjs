import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {project,execute,exportSession} from '../engine/session.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('52-action .34 Vargr history retains deployed state, log, RNG, bytes and next continuation',async()=>{
 const raw=await readFile(new URL('./fixtures/vargr-34-deployed-replay.json',import.meta.url),'utf8'),proof=JSON.parse(await readFile(new URL('./fixtures/vargr-34-deployed-replay-proof.json',import.meta.url),'utf8')),session=JSON.parse(raw);
 assert.equal(session.events.length,52);assert.equal(session.rulesRevision,'character-preview-2026-11-13.34');assert.equal(hash(project(session)),proof.projectionSha256);assert.equal(exportSession(session),raw);assert.equal(hash(execute(session,proof.continuation.command,{id:proof.continuation.id})),proof.continuation.sha256);
});
