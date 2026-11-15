import {failedAcademyPrank} from './visible-education-event-fixtures.mjs';
import{readFile}from'node:fs/promises';import assert from'node:assert/strict';import{api,project}from'../engine/session.mjs';import{prisonerBasicTrainingFixture}from'./prisoner-basic-training-fixtures.mjs';
const source=JSON.parse(await readFile(new URL('./required-career-choice-fixtures.json',import.meta.url)))[1].session;
export function command(r,type,payload={}){const next=api({operation:'command',session:r.session,command:{type,payload}});assert.equal(next.ok,true,next.error?.message);return next;}
export function requiredPrisonerFixture(){let r={session:structuredClone(source),...project(source)};r=command(r,'choose-effect',{index:0});r=command(r,'leave-career');r=command(r,'benefit',{cash:true,lifeBonusIds:[],creditIds:[]});assert.equal(r.state.stage,'career');assert.equal(r.state.forcedCareer,'core.prisoner');return r;}
export function legacyAezorghPrisonerFixture(){const {basic}=prisonerBasicTrainingFixture(),session=structuredClone(basic.session);assert.equal(session.events.at(-1).command.type,'career');session.events.pop();const r={session,...project(session)};assert.equal(r.state.stage,'career');assert.equal(r.state.forcedCareer,'core.prisoner');return r;}

export const humanAcademyPrisonerFixture=failedAcademyPrank;
