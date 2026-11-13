import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {project,exportSession,execute} from '../engine/session.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures/aslan-33-deployed-replay.json',import.meta.url),'utf8')),digest=x=>createHash('sha256').update(x).digest('hex');
test('substantial .33 Aslan history matches deployed baseline state, log, RNG and future continuation',()=>{
 assert.equal(fixture.sourceCommit,'1154faf1ad62642aa4fcf10650d87a2f8d175f18');assert.equal(fixture.session.events.length,67);assert.equal(project(fixture.session).state.character.terms,3);assert.equal(digest(JSON.stringify(project(fixture.session))),fixture.projectionSHA256);assert.equal(digest(exportSession(fixture.session)),fixture.exportSHA256);const next=execute(fixture.session,fixture.nextCommand,{id:fixture.nextActionId});assert.equal(digest(JSON.stringify(project(next.session))),fixture.nextProjectionSHA256);assert.equal(digest(exportSession(next.session)),fixture.nextExportSHA256);
});
