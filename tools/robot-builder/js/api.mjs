import * as engine from '../engine/index.mjs';
import {projectReview,formatStatblock} from './review-model.mjs';

// Local service boundary. The GUI imports this API, never the rules engine.
export const STORE_KEY = 'traveller.robot-builder.designs.v1';
export const LOCK_NAME = 'traveller.robot-builder.designs.v1.write';
const MAX_BYTES = 4 * 1024 * 1024;
const clone = value => JSON.parse(JSON.stringify(value));
const fault = (code, message) => Object.assign(new Error(message), { code });
const makeId = () => globalThis.crypto.randomUUID();
const ok = () => ({ level: 'ok', code: 'ready', message: 'Saved designs stay in this browser. Export a backup to keep a separate copy.', canSave: true });

export function createRobotApi(options = {}) {
  let storage;
  try { storage = options.storage ?? globalThis.localStorage; } catch {}
  const locks = options.locks ?? globalThis.navigator?.locks;
  const idFactory = options.idFactory ?? makeId;
  const clock = options.clock ?? (() => new Date().toISOString());
  const listeners = new Set();
  let design = engine.createDesign({kind:'standard',techLevel:12});
  let saved = {schemaVersion:1,revision:0,designs:[]};
  let expected = null;
  let currentId = null;
  let baseline = JSON.stringify(design);
  let status = ok();
  let busy = false;

  function decodeStore(raw) {
    if (raw === null) return {schemaVersion:1,revision:0,designs:[]};
    if (typeof raw !== 'string' || raw.length > MAX_BYTES) throw fault('invalid-store', 'Saved designs cannot be read safely. Existing browser data has not been changed.');
    let value;
    try { value = JSON.parse(raw); } catch { throw fault('invalid-store', 'Saved designs contain invalid JSON. Existing browser data has not been changed.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.designs) || value.designs.length > 500 || Object.keys(value).some(key => !['schemaVersion','revision','designs'].includes(key))) {
      throw fault('invalid-store', 'Saved designs use an unsupported or damaged format. Existing browser data has not been changed.');
    }
    const ids = new Set();
    for (const entry of value.designs) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(entry.id) || ids.has(entry.id) || typeof entry.updatedAt !== 'string' || entry.updatedAt.length > 40 || Object.keys(entry).some(key => !['id','updatedAt','design'].includes(key))) {
        throw fault('invalid-store', 'A saved design record is damaged. Existing browser data has not been changed.');
      }
      ids.add(entry.id);
      entry.design = engine.importDesign(JSON.stringify(entry.design));
    }
    return value;
  }
  function storageFailure(error, code = 'storage-unavailable') {
    status = {level:'error',code,message:error.message || 'Browser storage is unavailable. Export the current design to keep it.',canSave:false};
  }
  function readStore() {
    if (!storage || typeof storage.getItem !== 'function') throw fault('storage-unavailable','Browser storage is unavailable. You can still build and export designs.');
    const raw = storage.getItem(STORE_KEY);
    const parsed = decodeStore(raw);
    expected = raw;
    saved = parsed;
  }
  try { readStore(); } catch(error) { storageFailure(error, error.code); }
  if (status.canSave && !locks?.request) status = {level:'warning',code:'locks-unavailable',message:'This browser cannot safely coordinate saves between tabs. Building, importing and exporting still work.',canSave:false};
  function assertIdle() { if (busy) throw fault('save-pending','A save is in progress. Wait before changing the design.'); }
  function listSaved() { return saved.designs.map(entry => ({id:entry.id,name:entry.design.name,kind:entry.design.kind,techLevel:entry.design.techLevel,updatedAt:entry.updatedAt})); }
  function getReview() {
    return projectReview(design,engine.getCatalogue(design),engine.evaluateDesign(design));
  }
  function getStatblock() { return formatStatblock(getReview()); }
  function getView() {
    const catalogue=engine.getCatalogue(design),evaluation=engine.evaluateDesign(design);
    const review=projectReview(design,catalogue,evaluation);
    return clone({design,catalogue,evaluation,review,savedDesigns:listSaved(),storageStatus:{...status,canSave:status.canSave&&!busy},dirty:baseline !== JSON.stringify(design),busy,currentId,statblock:formatStatblock(review)});
  }
  function emit() {
    const view = getView();
    for (const listener of listeners) { try { listener(clone(view)); } catch(error) { globalThis.console?.error('Robot Builder view listener failed',error); } }
    return view;
  }
  function changed(next) { design = next; return emit(); }
  function setIdentity(patch) {
    assertIdle();
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !['name','kind','techLevel'].includes(key))) throw fault('invalid-identity','Only name, robot type and Tech Level can be changed here.');
    const next = patch.kind !== undefined && patch.kind !== design.kind
      ? {...engine.createDesign({kind:patch.kind,techLevel:patch.techLevel ?? design.techLevel}),name:patch.name ?? design.name}
      : {...clone(design),...patch};
    return changed(engine.importDesign(JSON.stringify(next)));
  }
  function select(command) { assertIdle(); return changed(engine.applySelection(design, command)); }
  function newDesign(kind = 'standard') {
    assertIdle(); currentId = null;
    const next = engine.createDesign({kind,techLevel:design.techLevel}); baseline = JSON.stringify(next);
    return changed(next);
  }
  function loadDesign(id) {
    assertIdle();
    const entry = saved.designs.find(item => item.id === id);
    if (!entry) throw fault('not-found','That saved design is no longer available. Refresh the saved list.');
    design = clone(entry.design); currentId = entry.id; baseline = JSON.stringify(design);
    return emit();
  }
  function importDesign(json) {
    assertIdle();
    let next; try { next = engine.importDesign(json); } catch(error) { if(error instanceof SyntaxError) throw fault('invalid-json','This is not valid Robot Builder JSON. Your current design and saved designs are unchanged.'); throw error; }
    currentId = null; baseline = null;
    return changed(next);
  }
  function refreshSaved() {
    assertIdle();
    try { readStore(); status = locks?.request ? ok() : {level:'warning',code:'locks-unavailable',message:'Safe browser saves are unavailable. Export a backup instead.',canSave:false}; }
    catch(error) { storageFailure(error,error.code); emit(); throw error; }
    return emit();
  }
  async function saveDesign({asNew = false} = {}) {
    assertIdle();
    if (!status.canSave) throw fault(status.code,status.message);
    const snapshot = clone(design);
    engine.importDesign(JSON.stringify(snapshot));
    const targetId = asNew || currentId === null ? idFactory() : currentId;
    if (typeof targetId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(targetId)) throw fault('invalid-id','Unable to create a safe saved-design identifier.');
    const wasExisting = currentId !== null && !asNew;
    busy = true; emit();
    try {
      await locks.request(LOCK_NAME, {mode:'exclusive'}, async () => {
        const actual = storage.getItem(STORE_KEY);
        if (actual !== expected) {
          status = {level:'warning',code:'stale-store',message:'Saved designs changed in another tab. Your draft is safe. Refresh the saved list before saving.',canSave:false};
          throw fault(status.code,status.message);
        }
        const records = clone(saved.designs);
        const index = records.findIndex(entry => entry.id === targetId);
        if ((!wasExisting && index !== -1) || (wasExisting && index === -1)) throw fault('id-conflict','The saved-design identifier changed. Refresh the saved list and save a copy.');
        if (index === -1 && records.length >= 500) throw fault('save-limit','This browser already contains 500 saved designs. Export the current design instead.');
        const entry = {id:targetId,updatedAt:clock(),design:snapshot};
        if (index === -1) records.push(entry); else records[index] = entry;
        const candidate = {schemaVersion:1,revision:saved.revision+1,designs:records};
        const bytes = JSON.stringify(candidate);
        if (bytes.length > MAX_BYTES) throw fault('save-limit','Saved designs exceed the safe storage limit. Export the current design instead.');
        decodeStore(bytes);
        try { storage.setItem(STORE_KEY,bytes); }
        catch(error) {
          let after;
          try { after = storage.getItem(STORE_KEY); }
          catch { status = {level:'error',code:'save-uncertain',message:'Storage could not confirm whether the save completed. Export your draft and reload before saving again.',canSave:false}; throw fault(status.code,status.message); }
          if (after !== bytes) {
            if (after !== expected) { status = {level:'error',code:'save-uncertain',message:'Storage changed during the save. Export your draft and refresh before saving again.',canSave:false}; throw fault(status.code,status.message); }
            status = {level:'warning',code:'save-failed',message:'The browser did not save this design. Your previous saves are unchanged; retry or export a backup.',canSave:true};
            throw fault(status.code,status.message);
          }
        }
        let confirmed;
        try { confirmed = storage.getItem(STORE_KEY); }
        catch { status = {level:'error',code:'save-uncertain',message:'The save was written but could not be verified. Export your draft and reload before saving again.',canSave:false}; throw fault(status.code,status.message); }
        if (confirmed !== bytes) {
          status = {level:'error',code:'save-uncertain',message:'The browser returned different data after saving. Export your draft and refresh before saving again.',canSave:false};
          throw fault(status.code,status.message);
        }
        expected = bytes; saved = candidate; currentId = targetId; baseline = JSON.stringify(snapshot); status = ok();
      });
    } finally { busy = false; emit(); }
    return getView();
  }
  function listExamples() { return typeof engine.getExamples === 'function' ? clone(engine.getExamples()) : []; }
  function loadExample(id) {
    assertIdle();
    if (typeof engine.createExample !== 'function') throw fault('examples-unavailable','Verified examples are not available yet.');
    const next = engine.createExample(id); currentId = null; baseline = null; return changed(next);
  }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  return {getView,getStatblock,listExamples,loadExample,setIdentity,select,newDesign,saveDesign,listSaved,loadDesign,importDesign,exportDesign:()=>engine.exportDesign(design),refreshSaved,subscribe};
}
