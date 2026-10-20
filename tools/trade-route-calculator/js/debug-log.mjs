// Session-only diagnostics. Detailed entries stay local; safeReport constructs
// an explicit allowlist instead of redacting a campaign/debug-report object.
export const APP_BUILD = '2026.10.20.99';

const ACTIONS = new Set([
  'runtime', 'action', 'modal-submit', 'window-error', 'unhandled-rejection',
  'startup', 'startup-rules', 'startup-read', 'startup-acquire',
  'copy-error-report', 'copy-debug-report', 'copy-debug-link',
  'cargo-add', 'cargo-correct', 'rounding-apply', 'campaign-replace',
  'route-plan-entry', 'accounts-details', 'jump-prepare', 'jump-commit', 'world-field-revert',
  'accounts-save', 'clear-route-save', 'contact-search-save',
  'contract-lifecycle-save', 'contract-offer-save', 'deposit-save',
  'expense-save', 'insurance-save', 'location-save', 'passenger-save',
  'planned-route-save', 'purchase-save', 'route-save', 'sale-save',
  'service-save', 'settings-save', 'setup-save', 'time-save',
  'undo-jump-save', 'undo-save', 'world-save',
]);
const SCREENS = new Set([
  'Overview', 'Trade', 'Cargo', 'Contracts', 'Accounts', 'Dashboard',
  'History', 'Settings', 'Startup', 'Unknown',
]);
const objectLike = value => value !== null && (typeof value === 'object' || typeof value === 'function');
function read(value, key) {
  try { return value?.[key]; } catch { return undefined; }
}
function detail(value, fallback) {
  try { return String(value).slice(0, 4000); } catch { return fallback; }
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  try { return new Date(value).toISOString() === value ? value : null; } catch { return null; }
}
function outcome(error) {
  const code = read(error, 'code'), committed = read(error, 'committed');
  if (code === 'SAVE_NOT_COMMITTED' && committed === false) {
    return {code, outcome:'not-committed', committed:false};
  }
  const revision = read(error, 'revision');
  if (code === 'SAVE_COMMITTED_PUBLICATION_FAILED' && committed === true && Number.isSafeInteger(revision) && revision >= 0) {
    return {code, outcome:'committed-publication-failed', committed:true, revision};
  }
  return {code:'unknown', outcome:'unknown', committed:null};
}
function safeEvent(entry) {
  const action = read(entry, 'action'), screen = read(entry, 'screen');
  return {
    time:timestamp(read(entry, 'time')),
    action:ACTIONS.has(action) ? action : 'unknown',
    screen:SCREENS.has(screen) ? screen : 'Unknown',
    ...outcome(entry),
  };
}

export function createDebugLog({limit = 50, now = () => new Date().toISOString()} = {}) {
  const capacity = Number.isSafeInteger(limit) && limit >= 0 ? Math.min(limit, 50) : 50;
  const entries = [];
  let reported = new WeakMap();
  function time() {
    try { return timestamp(now()); } catch { return null; }
  }
  function record(error, context = 'runtime', options = {}) {
    // Read inside this boundary: even getters on error/options may throw.
    try {
      if (read(options, 'newOccurrence') !== true) {
        const seen = new Set();
        let current = error;
        for (let depth = 0; depth < 16 && objectLike(current) && !seen.has(current); depth++) {
          seen.add(current);
          const previous = reported.get(current);
          if (previous && entries.includes(previous)) {
            const classification = outcome(error);
            // A terminal wrapper can establish the durable save after an
            // earlier catch. Preserve the occurrence and never downgrade it.
            if (classification.committed === true && previous.committed !== true || classification.committed === false && previous.committed === null) {
              Object.assign(previous, classification);
            }
            if (objectLike(error)) reported.set(error, previous);
            return previous;
          }
          current = read(current, 'cause');
        }
      }
      const message = read(error, 'message'), stack = read(error, 'stack');
      const action = read(options, 'action'), screen = read(options, 'screen');
      const selectedAction = action === undefined ? context : action;
      const entry = {
        time:time(),
        context:detail(context, 'unknown'),
        message:detail(message ?? error, 'Unable to read error'),
        stack:stack == null ? null : detail(stack, null),
        action:ACTIONS.has(selectedAction) ? selectedAction : 'unknown',
        screen:SCREENS.has(screen) ? screen : 'Unknown',
        ...outcome(error),
      };
      entries.push(entry);
      if (entries.length > capacity) entries.splice(0, entries.length - capacity);
      // Map only the reported outer error. Two Store wrappers may share a raw
      // cause while representing different attempts, so never register roots.
      if (objectLike(error)) reported.set(error, entry);
      return entry;
    } catch {
      // Diagnostics must never replace the original operation's result.
      return undefined;
    }
  }
  function clear() {
    entries.length = 0;
    reported = new WeakMap();
  }
  function safeReport() {
    return {
      formatVersion:1,
      build:APP_BUILD,
      generatedAt:time(),
      events:capacity ? entries.slice(-capacity).map(safeEvent) : [],
    };
  }
  return {entries, record, clear, safeReport};
}
