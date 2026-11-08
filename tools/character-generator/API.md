# Rules API v1

The rules engine is independent of the GUI. Import `api` from `engine/session.mjs`, or POST the same JSON to `/api/v1` on the local server. No server-side sessions are retained.

## Operations

- `{"operation":"catalog"}` returns versioned species, career, pre-career, skill and source catalogues.
- `{"operation":"create","seed":"your-seed"}` returns a new session, projected state, empty log and revision 0.
- `{"operation":"project","session":{...}}` replays the entire session and returns state, log and revision.
- `{"operation":"command","session":{...},"command":{"type":"...","payload":{...}},"id":"unique-action-id","expectedRevision":3}` validates and appends one action.
- `{"operation":"import","raw":"...JSON save..."}` validates an exported save before returning a candidate session.

Success has `ok: true`. Invalid requests have `ok: false` and `error: {code: "INVALID_REQUEST", message: "..."}`. The HTTP adapter returns 200 or 400 respectively. `apiVersion` is reported by the catalogue. The session carries `version` as well.

## Session and concurrency

A session is `{format: "traveller-character-session", version: 1, seed, events}`. Each event carries an ID, command, generated dice and summary. Commands are validated against the current stage and applied to a clone: failed actions do not mutate the supplied session. Repeating an ID with the same command is idempotent, including a retry with its original expected revision; reusing it for a different command is rejected. Send `expectedRevision` to reject stale edits. Clients must retain the returned session on each accepted command.

Limits include 2 MB UTF-8 import/HTTP bodies and serialized saves (checked before accepting an action), 2,000 actions, bounded text and effect lists, and a rule-effect loop cap. These are guardrails for a local tool, not a hosted multi-user security design. A production host would need authentication, authorization, rate limits and a durable storage design.

## Core command families

- Setup: `configure`, `setup`, `gm-mode`.
- Characteristics: `roll-statistics`, `swap-statistics`, `accept-statistics`, `add-extra`.
- Life path: `background`, `precareer`, `skip-precareer`, `career`, `fallback`, `training`, `survival`, `advancement`, `commission`, `continue-career`, `leave-career`, `benefit`, `ageing`, `finish`.
- Decisions: `choose-effect`, `choose-skill`, education-specific commands where offered, `resolve-book`.
- Record: `notes`, `connection`.
- Audit-preserving corrections: `restore`, `gm-override`, `gm-replay`.

Use the projected stage and offered options rather than guessing a valid next command. The GUI is a reference client; integration tests show complete payloads. Some preview command payloads may change before a stable release.

## Audit semantics

`rolls` contains label, raw D6 values, kept values and computed total. D3 rolls keep the mapped values separately from the raw dice. Boon rolls retain the best N of N+1. The seeded PRNG is deterministic and reproducible, not a secure random service.

`restore` appends a record restoring character state to an earlier revision while retaining current random state and GM setting. `gm-replay` requires GM mode and a reason; it reruns the chosen original action with one replacement roll, restores character state to that point, and leaves all superseded actions in the log. Replacement values must have the original dice count and be valid D6 results. It is not an edit-in-place operation.

Import validates replay against stored dice and summaries. It does not authenticate the file's author or prove that fields were never removed or reconstructed externally.

## HTTP boundary

The local adapter binds to `127.0.0.1`, validates the Host header, rejects cross-origin requests, serves only supported local file types and exposes no write-file endpoint. It is intentionally not deployed as a public backend. The GUI can use `?api=local` for HTTP or omit it for the same in-process API.
