// Explicit test-only harness. No URL, request, environment or GUI unlock.
// This server is not the shipped entry point; it preserves deferred regression coverage.
import {createRulesServer} from '../server-runtime.mjs';
import {developmentApi} from '../engine/session.mjs';
export function createServer(){return createRulesServer(developmentApi);}
