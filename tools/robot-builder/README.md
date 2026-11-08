# Robot Builder (construction preview)

This tool is in active development. It does **not** yet cover every legal Robot Handbook design and must not be presented as complete.

## Architecture

- `engine/`: deterministic rules, typed catalogue, source references, design schema, validation and calculation. No DOM, browser storage or network dependence.
- `engine/composites.mjs`: source-scoped integration of independently revalidated robot snapshots. Component construction costs are distinct from listed prices and external host costs.
- `js/api.mjs`: application API. It composes the engine with explicit named-design saves, import/export and read-only statblock projection. Browser persistence is injected and independently tested.
- `js/app.mjs`: rendering and user interaction only. It imports the API, never the rules modules. Dropdown choices and constraints come from the engine.
- `js/review-model.mjs` projects engine output without DOM or construction calculations; `js/review.mjs` renders that read-only API result. The same projection supplies the printable statblock.
- No server is required for the current adapter. The boundary is a stable programmatic API, not a claim that presentation and rules share one implementation.

The six navigation stages retain the Handbook names: Chassis Size, Locomotion, Physical Options, Robot Brain, Skill Packages, Finalisation. Special construction paths provide their own metadata and rules.

## Sources and coverage

The implementation cites printed pages of **Robot Handbook (Mongoose Publishing, 2022)**. Core characteristic DMs follow **Traveller Core Rulebook Update 2022**, p9. Source books and private research files are not included in this repository. The older spreadsheet is not an authoritative source.

The engine catalogue and every evaluation return a current coverage inventory. The [source coverage matrix](verification/source-coverage-matrix.md) and [remaining construction inventory](verification/construction-gap-inventory.md) separate concrete implementation gaps from external dependencies, source ambiguities and contextual operating rules. A result can be invalid, blocked, or checked only within the implemented subset. These states are shown separately from referee-dependent choices. Missing options are not silently represented by zero cost or a generic override.

Current coverage continues to change during implementation. See `getCatalogue(design).coverage` and `evaluateDesign(design).coverage` rather than assuming that a row in a catalogue proves all of its prerequisites and operating rules are implemented.

## Saved designs

Storage is isolated under `traveller.robot-builder.designs.v1`. No existing tool save is read, migrated or rewritten. Only explicit Save / Save a copy writes a named design. Import stages an unsaved draft and never overwrites saved designs.

Writes use an exclusive Web Lock plus expected prior bytes and post-write verification. Stale editors must refresh the saved list. A failed or uncertain write retains the draft for export and does not blindly retry. Corrupt or future-version storage blocks writes without deleting recoverable bytes. Browser support for Web Locks is required to save, but construction and export remain available without it. JSON backups are recommended.

## Component snapshots and augmentation scope

Composite records copy a selected saved or imported robot. They are not live links and never edit the original save. The engine revalidates each snapshot, propagates its diagnostics, derives fit and brain inputs, and accounts for each component once. Imported totals and verification flags are not trusted. Nested composites and incompatible construction estimates are rejected; component count and input size are bounded. A validated robot does not certify a ship hull, vehicle, biological host or operational radio link.

Cybernetic parts keep their own equipment, weapons, software and capacity. An implant's skills are not silently granted to its recipient. Whole-body, limb-mounted and separate-servo construction remain distinct. Miscellaneous implants use source-defined Slot or mass admission, with the shared three-device limit. Explicit source interpretations remain necessary where the book does not settle a price basis.

Direct payloads, associated launchers and stored individual rounds are distinct records. Unknown container masses, external equipment and unsupported combined firing arrangements are never converted into assumed free capacity or automatic attack modifiers.

Delayed file reads carry a draft revision so an earlier import cannot overwrite a newer draft. Saving, importing and referencing a component remain separate actions.

## Verification

From the repository root:

```sh
node --test tools/robot-builder/verification/*.test.mjs
python3 -m http.server 8778 --bind 127.0.0.1
# In another terminal:
node tools/robot-builder/verification/browser.mjs /path/to/playwright
node tools/robot-builder/verification/construction-browser.mjs /path/to/playwright
```

`ROBOT_TEST_URL` overrides the local preview URL. `ROBOT_BROWSER_CHANNEL=msedge` selects Edge for local Windows verification; CI uses pinned Chromium. All browser tests use a fresh isolated context with synthetic fixtures, not a user's campaign data.

Native checks independently exercise construction arithmetic, all 224 source equipment rows, published reconstructions, scoped special types and API persistence. Browser checks exercise navigation, dropdowns, explicit saves, reload, export, invalid imports, equipment allocation, weapon installation and accessories, separate equipment settings, custom skills, clone learned specialties and responsive layouts at 320, 390, 768, 1100 and 1440 pixels. A passing suite is not proof of exhaustive Handbook coverage. See [published robot validation](verification/published-validation.md) for the comparison scope, assumptions and unresolved source discrepancies.

No standalone linter/typechecker is configured in this plain ECMAScript-module tool. Syntax checks, schema validation, deterministic tests and independent rules/UI reviews are required before a release.
