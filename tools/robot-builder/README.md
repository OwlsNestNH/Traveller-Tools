# Robot Builder (construction preview)

This tool is in active development. It does **not** yet cover every legal Robot Handbook design and must not be presented as complete.

## Architecture

- `engine/`: deterministic rules, typed catalogue, source references, design schema, validation and calculation. No DOM, browser storage or network dependence.
- `engine/composites.mjs`: source-scoped integration of independently revalidated robot snapshots. Component construction costs are distinct from listed prices and external host costs. A composite robot keeps its own selected list price without replacing combined construction accounting.
- `js/api.mjs`: application API. It composes the engine with explicit named-design saves, import/export and read-only statblock projection. Browser persistence is injected and independently tested.
- `js/app.mjs`: rendering and user interaction only. It imports the API, never the rules modules. Dropdown choices and constraints come from the engine.
- `js/review-model.mjs` projects engine output without DOM or construction calculations; `js/review.mjs` renders that read-only API result. The same projection supplies the printable statblock.
- No server is required for the current adapter. The boundary is a stable programmatic API, not a claim that presentation and rules share one implementation.

The six navigation stages retain the Handbook names: Chassis Size, Locomotion, Physical Options, Robot Brain, Skill Packages, Finalisation. Special construction paths provide their own metadata and rules.

## Sources and coverage

The implementation cites printed pages of **Robot Handbook (Mongoose Publishing, 2022)**. Core characteristic DMs follow **Traveller Core Rulebook Update 2022**, p9. Long-range missile case procurement additionally cites **High Guard Update 2022**, pp 36-37, using the inspected revised printing (copyright 2026). Individual long-range pricing remains unresolved. A bounded forty-three-device miscellaneous-implant subset cites **Central Supply Catalogue Update 2023**, pp 63-65, 73-79, 82-83, 86, 88, 90-91, 105-107, 121, 125-126 and 129-130, from its revised printing (copyright 2026); these edition-specific choices do not replace Core rows. One hundred and three additional weapon profiles (thirty-one slug, twenty-two energy, twenty-seven heavy, nine melee, five archaic, two standard-ammunition launchers and seven direct payloads) and twenty source-specific weapon accessories cite the same CSC printing, pp131-155 and 157-179, with distinct source IDs rather than overwriting Core profiles. Source books and private research files are not included in this repository. The standard deconstruction chamber uses the explicit Robot Handbook p119 installation row. Five fixed-purpose drone/swarm consoles from pp 119 and 122 use their printed masses through the p92 miscellaneous-implant route; they do not become generic computers. The older spreadsheet is not an authoritative source.

The engine catalogue and every evaluation return a current coverage inventory. The [source coverage matrix](verification/source-coverage-matrix.md) and [remaining construction inventory](verification/construction-gap-inventory.md) separate concrete implementation gaps from external dependencies, source ambiguities and contextual operating rules. A result can be invalid, blocked, or checked only within the implemented subset. These states are shown separately from referee-dependent choices. Missing options are not silently represented by zero cost or a generic override.

Current coverage continues to change during implementation. See `getCatalogue(design).coverage` and `evaluateDesign(design).coverage` rather than assuming that a row in a catalogue proves all of its prerequisites and operating rules are implemented.

## Saved designs

Storage is isolated under `traveller.robot-builder.designs.v1`. No existing tool save is read, migrated or rewritten. Only explicit Save / Save a copy writes a named design. Import stages an unsaved draft and never overwrites saved designs.

Writes use an exclusive Web Lock plus expected prior bytes and post-write verification. Stale editors must refresh the saved list. A failed or uncertain write retains the draft for export and does not blindly retry. Corrupt or future-version storage blocks writes without deleting recoverable bytes. Browser support for Web Locks is required to save, but construction and export remain available without it. JSON backups are recommended.

## Component snapshots and augmentation scope

Composite records copy a selected saved or imported robot. They are not live links and never edit the original save. The engine revalidates each snapshot, propagates its diagnostics, derives fit and brain inputs, and accounts for each component once. Imported totals and verification flags are not trusted. Nested composites and incompatible construction estimates are rejected; component count and input size are bounded. A validated robot does not certify a ship hull, vehicle, biological host or operational radio link.

Cybernetic parts keep their own equipment, weapons, software and capacity. An implant's skills are not silently granted to its recipient. General-computer programs include the thirteen Robot Handbook pp122-123 creator and control tiers, alongside Core software. Active control programs require Intelligent Interface on the same computer; external links and targets remain unverified. Whole-body, limb-mounted and separate-servo construction remain distinct. Miscellaneous implants use source-defined Slot or mass admission, with the shared three-device limit. Core and supported CSC devices retain their own source labels, prices and operating conditions. Returned augmentation catalogues and evaluated device details are detached from the rules data. CSC medical and diagnostic devices retain per-subject calibration, consumable and contextual-use conditions rather than granting recipient skills or universal bonuses. The standard deconstruction chamber preserves per-chamber capacity, destructive operation and separate data storage; it does not manufacture objects or restore memories. Explicit source interpretations remain necessary where the book does not settle a price basis.

Direct payloads, associated launchers and stored individual rounds are distinct records. Seventy explicitly classified CSC profiles can allocate spare magazines or power packs to installed storage using the rule-of-thumb mass estimates on CSC p142. These estimates share the approximate two-kilogram-per-Slot storage budget with known-mass loose Core grenades. Included or separately purchased initial loads are not counted as spare cargo, linked copies are counted once each, and an autoloader does not also reserve compartment space. The ten-extra-load autoloader rule remains separate from the application's one-hundred-load stored-cargo input bound. Unknown pack locations, chemical containers, unpriced replacements and unsupported source families do not inherit an estimate. Estimates remain labelled rather than presented as measured masses; no storage choice certifies hazardous handling or automatic reloading.

Medical nanorobot records distinguish purchased active packages, purchased reserves and declared existing active packages. Costs apply only to purchases, while active counts and effects are combined across records. Physical enhancements retain explicit STR/DEX/END targets and mental enhancement uses INT; same-target records cannot evade the cumulative package requirement. Existing unknown package types, application outcomes and expiry remain qualified. Single-package designs still import, and switching to itemised records preserves the original selection without charging it twice. Anti-ageing reduction above effective TL15 is not specified: itemised effects remain blocked, while the old single-package extrapolation is explicitly labelled as a legacy assumption.

Delayed file reads carry a draft revision so an earlier import cannot overwrite a newer draft. Saving, importing and referencing a component remain separate actions.

Sixteen explicitly magazine-fed CSC configurations support separately selected standard/high-capacity initial loads and mixed spare quantities. The high-capacity accessory has its own TL4 gate and p175 capacity/price multipliers; its mass doubles the original p142 estimate once. Standard and high-capacity spares may use different compartments or a combined autoloader, with a shared ten-magazine autoload limit. Referee-dependent compatibility remains qualified, particularly shotguns, and other finite-capacity supplies do not automatically acquire this conversion. Optional fields preserve old backups; invalid retained choices stay visible and removable.

An optional explicit allocation can divide additional supplies between the autoloader and separately stored reserves. Existing quantities remain total extras; only the allocated subset attracts the doubled loader package price, and only the remainder reserves cargo space. The source limit is ten supplies per loader. The separate application bound is one hundred stored reserves per linked copy, allowing at most 110 total extras in explicit mode. Old designs omit the allocation object and retain their previous meaning and limits. Opening the allocation disclosure does not change a draft; selecting split mode preserves the existing effective allocation before editing.

Linked weapons can retain different initial loads, spare variants, loader allocations and storage assignments through optional complete per-copy specifications. Unlisted copies inherit the shared settings; customised copies do not change when shared quantities change. Hardware and fire control remain linked, with ammunition and capacity summed once per installed copy. Reducing the linked count retains out-of-range specifications for correction without counting removed copies. No averaged magazine capacity or per-weapon supply count is invented. Legacy designs omit the optional list and retain their previous meaning.

Remaining ammunition cases include ARL standard/support magazine interchange, included-pack replacement disposition and unverified high-capacity feed compatibility. Empty fitted-loader pricing and fitting already-owned supplies remain unmodelled. These are application or source boundaries, not claims that such constructions are prohibited.

## Held weapon grips

Supported held two-handed weapons use one weapon record with two distinct installed manipulators. Both grips participate in held-loadout occupancy checks; an arm-mounted attachment does not automatically occupy its gripping hand. A second grip never duplicates the weapon, ammunition, accessories or fire-control purchase. Missing, removed, shared or inapplicable references remain visible and repairable. Source-marked optional two-handed use is supported without inventing a damage benefit.

Actual arm characteristics are reported separately. Multi-arm effective characteristics and attack modifiers remain unresolved; no highest, averaged, summed or first-arm value is invented. Carrying fit, reach and coordinated operation remain referee-dependent, and archaic handedness remains a qualified physical interpretation. Held vehicle-class weapons and whole-recipient cyberlimb grip assignments remain outside this route. Mount-size prerequisites apply to attached mounts, not to held grips.

## Rules presentation

The editor, design review and printable statblock show concise labels, selected figures and source references. Full reference rows and long rule explanations are not displayed. Estimated values, incomplete coverage, unresolved results, source interpretations and referee-dependent conditions remain labelled; corrective checks identify the relevant part, weapon and linked copy. Detailed engine diagnostics remain available for verification without becoming presentation text. User-entered design names and specialties are retained.

## Clone development

Clones use biological templates, growth services and learned skills rather than a robot chassis/brain conversion. Accelerated growth can stop at the convenient whole-month choices or a bounded custom fractional month. Source-dependent pricing, partial-year education and calendar interpretations are recorded explicitly; no prorated fee or premature completed-year training grant is invented.

Timed INT purchases preserve cumulative costs, point banking and annual EDU progression. Actual post-maturity training advances the ageing clock, and uncredited partial creche months still count toward the sixteen-year limit. Required ageing rolls are not manufactured: affected designs retain a provisional calendar and ageing obligations while current-character certification is blocked. The printed thirty-three-versus-thirty-four-year calendar conflict remains visible. Natural-grown clone backgrounds and immature characteristics require their appropriate biological or character records.

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

Native checks independently exercise construction arithmetic, all 224 source equipment rows, published reconstructions, scoped special types and API persistence. Browser checks exercise navigation, dropdowns, explicit saves, reload, export, invalid imports, equipment allocation, weapon installation and accessories, separate equipment settings, custom skills, clone learned specialties, early-stop development, timed training, implanted computer programs, component snapshots and responsive layouts at 320, 390, 768, 1100 and 1440 pixels. A passing suite is not proof of exhaustive Handbook coverage. See [published robot validation](verification/published-validation.md) for the comparison scope, assumptions and unresolved source discrepancies.

No standalone linter/typechecker is configured in this plain ECMAScript-module tool. Syntax checks, schema validation, deterministic tests and independent rules/UI reviews are required before a release.
