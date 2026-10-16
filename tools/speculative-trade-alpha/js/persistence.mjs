// Browser-independent command/save boundary. Storage and exclusive ownership are injected.
// A failed write never causes a command (and its dice) to run a second time.
export const SAVE_KEY = 'traveller.speculative-trade.alpha.v1';
export class SaveBoundary {
  constructor({storage, initial, validate, exclusive, allowInvalidExisting=false}) {
    this.storage = storage;
    this.validate = validate;
    this.exclusive = exclusive;
    this.pending = null;
    this.uncertain = false;
    this.state = structuredClone(initial);
    validate(this.state);
    this.raw = storage.getItem(SAVE_KEY);
    if (this.raw !== null) {
      try { const parsed=JSON.parse(this.raw); validate(parsed); this.state=parsed; }
      catch(error) { if(!allowInvalidExisting)throw error; }
    }
  }
  snapshot() { return structuredClone(this.state); }
  async command(id, transition, {replaceHistory=false}={}) {
    if (this.uncertain) throw Error('Save outcome uncertain. Reload before continuing.');
    if (this.pending) throw Error('Retry the pending save before continuing.');
    if (typeof id !== 'string' || !id) throw Error('A command ID is required.');
    return this.exclusive(async () => {
      if (this.uncertain) throw Error('Save outcome uncertain. Reload before continuing.');
      if (this.pending) throw Error('Retry the pending save before continuing.');
      this.assertCurrent();
      if (this.state.appliedCommands.includes(id)) return this.snapshot();
      const candidate = transition(this.snapshot());
      candidate.revision = this.state.revision + 1;
      candidate.appliedCommands = [...(replaceHistory?candidate.appliedCommands:this.state.appliedCommands), id];
      this.validate(candidate);
      this.pending = {candidate: structuredClone(candidate), raw: JSON.stringify(candidate)};
      return this.persist();
    });
  }
  async retry() {
    if (this.uncertain) throw Error('Save outcome uncertain. Reload before continuing.');
    if (!this.pending) return this.snapshot();
    return this.exclusive(async () => {
      if (this.uncertain) throw Error('Save outcome uncertain. Reload before continuing.');
      this.assertCurrent();
      return this.pending ? this.persist() : this.snapshot();
    });
  }
  assertCurrent() {
    let actual;
    try { actual = this.storage.getItem(SAVE_KEY); }
    catch { this.uncertain = true; throw Error('Cannot read save. Reload before continuing.'); }
    if (actual !== this.raw) {
      this.uncertain = true;
      throw Error('Save changed in another editor. Reload before continuing.');
    }
  }
  persist() {
    const pending = this.pending;
    try { this.storage.setItem(SAVE_KEY, pending.raw); }
    catch { /* Read back: a storage adapter may throw after a successful write. */ }
    let actual;
    try { actual = this.storage.getItem(SAVE_KEY); }
    catch { this.uncertain = true; throw Error('Save outcome uncertain. Reload before continuing.'); }
    if (actual === pending.raw) {
      this.state = pending.candidate;
      this.raw = pending.raw;
      this.pending = null;
      return this.snapshot();
    }
    if (actual === this.raw) throw Error('Save not written. Retry save; the prepared result is retained.');
    this.uncertain = true;
    throw Error('Save outcome uncertain. Reload before continuing.');
  }
}

// All same-origin alpha tabs must use this same lock; no live-calculator key is read.
export function browserExclusive(navigator) {
  return operation => {
    if (!navigator.locks?.request) throw Error('This browser lacks safe editor locks. Use a supported browser.');
    return navigator.locks.request(SAVE_KEY, {mode:'exclusive'}, operation);
  };
}
