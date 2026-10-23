# Ship Combat Alpha — Under construction

This is a working **movement prototype**, not a complete combat simulator or a verified implementation of Mongoose Traveller 2e rules. Open `index.html` through a static HTTP server. There is no server API, account, storage, campaign import, telemetry, or external runtime dependency.

## Try it

Select one of five sample ships. Side-coloured arrows show velocity and the next coast position, **not facing**. The selected ship's reachable targets are centred on its coast position, so ships with identical thrust and different velocity have different target areas. Click a highlighted hex, or enter axial Q/R coordinates and choose **Plot target**. **Advance round** applies every plot and moves every ship; ships without plots keep coasting. Thrust is not an automatic speed reset or a fixed maximum speed.

Edit the selected ship to enter a name, position, velocity and thrust budget. The sample fighter has thrust 9; there is no ceiling of six. Integer budgets from 0 to 10,000 are supported. This is a prototype input bound, not a Traveller rule. Edits clear that ship's plot and leave the camera fixed. Reset or reload starts a fresh sample.

The map is a single proportional axial-hex projection. Pan and zoom never compress separate pair distances. Fit ships frames their actual positions. Range lines join the selected ship to the others; the sidebar lists those same abstract hex-step distances. Hex detail automatically disappears at distant zoom and can also be toggled off. Grid enumeration is bounded to 1,800 cells; target legality uses an analytic distance check even when grid detail is hidden. Large thrust never enumerates its millions of reachable targets.

## Unverified assumptions and limits

The default round lasts six minutes. One thrust changes velocity by one hex per round; apply the impulse **before** moving with the updated velocity. This integration order and conversion are explicit prototype assumptions, not claims of rules accuracy. There is no physical hex scale, kilometre conversion, verified range band, reaction-engine performance model, mixed six-minute/six-second dogfight clock, weapons, damage resolution or missiles. No licensed book text or rule tables are included.

Positions and velocity components are whole axial coordinates bounded to ±1,000,000; thrust is a nonnegative whole number ≤10,000. Up to ten ships are supported by the engine. Invalid, nonfinite, fractional, oversized, stale or out-of-range commands fail without modifying the supplied state. These safety bounds are prototype limits, not physical rules.

## Engine and command/state API

`engine.mjs` has no browser or I/O dependencies. It owns validation and movement. `geometry.mjs` owns the affine projection and bounded visible-grid calculation. `app.mjs` is an adapter between DOM controls and explicit commands. Capability data (`capabilities.thrust`) is separate from mutable motion (`motion.position`, `velocity`, `impulse`); a separate template snapshot, crew record, situational modifiers and manual condition record accompany each instance.

```js
import {createState, applyCommand} from './engine.mjs';
let state = createState(); // API version 1, five deterministic sample ships
state = applyCommand(state, {
  type: 'plot', shipId: 'merchant', target: {q: -2, r: 2},
  expectedRevision: state.revision
});
state = applyCommand(state, {
  type: 'advance-round', expectedRevision: state.revision
});
```

State is plain JSON: `{version, revision, round, roundMinutes, ships}`. `round` counts completed rounds. Each ship is `{id, name, capabilities:{thrust}, motion:{position:{q,r}, velocity:{q,r}, impulse:{q,r}}}`. `createState({ships,roundMinutes})` accepts manual initial values and normalizes them. A successful command returns a new state and increments `revision`; the original object is unchanged.

Commands are `plot` with `shipId,target`; `coast` with `shipId`; `edit-ship` with `shipId,name,thrust,position,velocity`; and `advance-round`. `expectedRevision` is optional for standalone consumers; the UI always sends it. A given initial state and JSON command sequence replay deterministically. This contract can be adapted to another frontend or future server without importing the page.

## Verification

Run `node --test verification/engine.test.mjs` for movement, exact hex boundaries, persistent velocity, atomic rejection, high thrust, proportional geometry and replay checks. The Chromium browser suite exercises map plotting, round advance, numeric bounds, pan/zoom/fit, distant grid detail, index navigation, responsive layout, keyboard access, and storage isolation. All fixtures are synthetic.

## Ship selection and crew setup

**Add a ship** adds an independent preset or custom instance; it never replaces the selected ship. The alpha supports ten ships, an approved usability limit rather than a Traveller rule or proven browser ceiling. Initial position and velocity are explicit. Duplicate designs get unique encounter IDs and independent crew, condition and motion. Reset/reload restores the sample. Remove selected ship and Clear all ships require explicit confirmation; cancel leaves the encounter unchanged. Removing a ship preserves every remaining ID, crew, condition and plot. Clearing can leave an empty map, from which all ten slots can be filled with your own ships. Empty encounters cannot advance rounds; clearing ships preserves the round counter. No campaign storage is accessed.

The catalogue contains 56 source variants from **Core Rulebook Update 2022**, **High Guard Update 2022** and **The Pirates of Drinax, Book 2: The Trojan Reach (Updated)**, including small craft and 400-ton ships. Each retains only displacement, printed thrust, hull points, armour when listed and printed-page citations. Book variants remain separate. Missing armour is `null` (not inferred zero). The Express Boat (High Guard, printed p. 158) has no manoeuvre drive: it uses zero thrust and can only coast in this movement prototype; its jump drive does not provide a thrust budget. No hull values are derived from displacement. High Guard's laboratory ship preserves its printed 360-ton hull / 400-ton drive configuration caveat; its Gazelle uses internal tankage without attached drop tanks. The catalogue is not a full ship sheet, rules database or catalogue of every possible module/configuration. No costs, source prose, deck plans or weapon tables are reproduced. The physical thrust-to-map conversion remains the prototype assumption above.

Custom designs accept displacement greater than zero through 400 tons inclusive, thrust 0–10,000 and optional hull / armour; unknown values remain unknown. Current hull is a manual instance record bounded by known design hull. It does not automatically apply damage, change thrust or resolve combat. Adjusting current thrust in the movement editor leaves the original design facts intact and is labelled as a manual adjustment.

Each ship starts with a quick Green rating: Green **+1**, Veteran **+2**, Elite **+3** are TOTAL crew contributions, not skill levels to which a characteristic DM is added. Optional per-role TOTAL overrides replace that rating, including zero. Detailed mode records one named station holder per captain, pilot, astrogator, sensors, engineer, gunner, medic and steward role, including skill/specialty, skill level and characteristic DM. Its displayed crew contribution is skill + characteristic DM; blank holders are unassigned, never silently zero or trained. Switching modes preserves the other mode's saved values. Inactive controls are disabled for validation and are not serialized; applying the active mode keeps the inactive mode's last saved record, discarding any unfinished inactive draft. Switching back before applying preserves the draft controls. These are the user's setup conventions, not a claim that these ratings implement published check rules. Multiple stations of the same role and full character sheets are not modelled yet. Situational DMs are separate and are never added to the stored crew contribution. No checks are rolled or resolved.

**Plot stop (uses thrust)** is a convenience for plotting a zero resulting velocity. It costs the full axial magnitude of current velocity, rejects if this exceeds current thrust, and applies only when advancing the round. Faster ships must plot smaller velocity changes over multiple rounds. It does not instantly stop a ship. Thrust zero still coasts.

### Additional command/state contract (version 1, additive fields)

Normalized ships now include `template` (nullable design snapshot and source), `crew:{mode,rating,overrides,details}`, `condition:{hull}` and `situational` (per-role DMs), separately from capabilities/motion. Legacy initial ship inputs receive synthetic/unknown design defaults and Green crew. Unknown/private fields are discarded.

- `add-ship`: `presetId` or custom `template`, instance `name`, initial `position` and `velocity`. Successful commands assign the first available `ship-N` ID. Adds reject at ten without mutation.
- `set-crew`: `shipId`, complete `crew` and separate `situational` records.
- `set-condition`: `shipId`, `condition:{hull}` (`null` means unknown).
- `brake`: `shipId`; plots a stop only when the velocity-change budget permits it.
- `remove-ship`: `shipId`; removes that instance only.
- `clear-ships`: clears all ships while retaining encounter timing. The frontend confirms both removal commands before sending them; engine callers must supply their own user confirmation policy. Empty ship arrays are valid, with a neutral fit camera.

All existing expected-revision and atomic rejection guarantees still apply. Templates and crew do not supply implicit movement bonuses. Pure `setup.mjs` validates these records; `catalogue.mjs` contains the cited minimum design facts. No server, storage or external runtime dependency was added.

## Map silhouettes and sides

Ship map dots are replaced by solid silhouettes with cosmetic travel orientation. The 23 unmodified Samuel Penn CC0 WebPs are bundled locally; the browser turns their alpha into a solid side-coloured mask using an SVG filter. No external asset fetches occur at runtime. Provenance, the pinned upstream revision and SHA-256 hashes are in [assets/ships/PROVENANCE.md](assets/ships/PROVENANCE.md). No other source artwork or repository code was copied.

Side A is teal, Side B orange and Side C purple; visible A/B/C labels and a dashed selection ring supplement colour. Side is presentation metadata only and does not introduce allegiance rules. Velocity arrows remain independent; only the hull glyph rotates aesthetically to current travel direction. Silhouettes and hit targets keep a readable screen size through zoom; they are not physical ship scale. The map coordinates, range lines, camera and motion remain proportional.

The Empress Marava design has its corresponding source token. Each of the 56 presets has an explicit source-page mapping to its available named design-family token, or a labelled custom fallback when its variant has no verified matching token. Yacht, Launch, Gazelle, Far Trader, Seeker and other available designs no longer borrow a broad class symbol. These are illustrative artist depictions of design families, not certified 2022 loadouts; Gazelle attachments never imply current tankage. Research ships use a custom top-down toroid symbol instead of the unwanted edge-on lab_ship token. Corsair and Other use original custom fallback shapes, explicitly labelled noncanonical. Automatic mapping can be overridden under Map symbol and side without editing design facts, crew, condition, velocity or plots. Custom ships begin with a generic symbol; the user can choose a representative class symbol.

State adds `appearance:{side:'A'|'B',icon:'auto'|<available symbol key>}`. Legacy ship inputs default to A/auto. `add-ship` optionally accepts appearance; `set-appearance` changes it for one `shipId` only, with normal revision/atomic-validation guarantees. `appearance.mjs` owns presentation choices and fallback glyphs; movement math has no facing or icon-dependent modifiers.

## Encounter Setup and ship-computer console

**Encounter Setup** opens a large desktop dialog or full-screen phone editor. Base records, adding/removing ships, crew and appearance live there rather than filling the movement sidebar. The sidebar retains ship selection, movement and compact reference; each instance name has a smaller muted class/subtype beneath it. The persistent computer panel under the map shows selected-ship Hull, Power and Fuel gauges with numeric labels, Crew/Cargo/Life Support and manually recorded criticals. Unknown values remain explicitly unknown, distinct from recorded zero; mockup examples are not defaults.

Setup uses an isolated draft. All loaded-ship fields are collected and validated on **Save encounter**, which commits one guarded revision. Selecting another draft ship retains valid edits within the draft; **Cancel** or Escape discards the entire draft without rollback writes to live state. Removing/clearing ships requires explicit confirmation and affects the draft until Save. A stale draft cannot overwrite a changed live revision. Native dialogs provide keyboard focus containment and restore focus after closing; phone controls remain full width with a persistent Save/Cancel footer.

**Place on map** temporarily closes the dialog while keeping its draft. It shows a distinct placement preview over the proportional map. Dragging pans without placing; clicking/tapping a hex chooses a preview and updates the coordinate reference. **Use this position** returns the Q/R values to setup; **Add to draft** and **Save encounter** are still required. Cancel placement returns with the original input coordinates, and Cancel setup discards any draft additions. Ordinary map clicks retain movement/selection behaviour. Manual Q/R entry remains the keyboard fallback. No placement changes velocity or immediately adds a live ship.

### Complete optional records, manual condition and overrides

Custom entry accepts design/class, displacement (at most 400 tons), TL, hull/armour/thrust, rated plant output, mode-dependent system power requirements, fuel and cargo capacities, crew complement, jump rating, sensors, computer/software and named weapon mounts with types/counts/initial ammunition. Blank optional fields are unknown. Explicitly empty equipment lists differ from unknown equipment. Equipment validation bounds are prototype safety limits, not assertions about legal Traveller construction. Existing Core/High Guard presets retain their verified minimum hull/movement facts; untranscribed equipment is unknown rather than silently zero or inferred.

**Every ship can be manually adjusted.** The original `template` and source are preserved; `designOverrides` holds only changed fields for that instance. The editor marks overridden fields and shows the original template, and the console lists active override paths. Clearing an override to its original value removes that override. Custom designs retain their original entered template in the same way. Synthetic samples can optionally be given manual base facts. Editing design facts does not automatically repair hull, refill fuel/ammunition, change current power output or apply critical effects. Current thrust is separately editable; the API changes it to design thrust only when explicitly requested. Reducing a known capacity below its current recorded amount rejects rather than clamping the condition; adjust the manual condition first.

The separate **Edit condition** dialog records current hull, fractional fuel/cargo tons, crew available, life-support status, current plant output and used power, current ammunition/status and structured critical records (system, severity, recorded effect, manual status). Save validates nonnegative values and known capacity bounds; Cancel leaves state unchanged. Active/resolved critical records do not automatically alter any ship capability. Orphan weapon-condition records are retained and labelled if a base mount is removed, rather than silently deleted.

Power terms are deliberately separate: **rated plant output** is a base fact; **current output** and **used Power** are manual condition records. Remaining Power is current output minus used Power only when both are known; a negative value is shown as a deficit. Requirements are reference data, never blindly summed across mutually exclusive modes. Fuel capacity and current fuel are tons; they are not a reaction-engine thrust reserve. No fuel burn/leak, ammunition use, damage, repair, life-support or crew-loss simulation is performed by advancing a movement round.

Generic crew has one ship-wide total bonus by default (Green +1, Veteran +2, Elite +3) and an optional editable general total. **Adjust individual roles** provides optional total overrides; a visible indicator lists active overrides even when the disclosure is closed. Detailed mode records assigned stations with optional names, explicit skill/specialty, skill level and characteristic DM. Unassigned is not skill zero. Inactive-mode controls do not participate in validation/serialization; saved values of the other mode are preserved. Crew stays separate from hull templates and situational modifiers remain separate.

### Harrier source and starting convention

The **Harrier Commerce Raider — designed/restored** uses The Pirates of Drinax, **Book 2: The Trojan Reach (Updated), printed pp. 10–11**: TL15, 200 tons, Hull 88, armour 4, Thrust 6, Jump-2, rated plant output 260 and fuel capacity 42 tons, with cited equipment facts retained in its record. Choosing this expressly repaired preset initializes current Hull 88 and current output 260; used Power, current fuel and current ammunition remain unknown. The 12 missiles noted in storage are not added to an unspecified internal rack load. Ranges, weapon damage and missile type are not invented.

Book 2 p.12's campaign-start Hull 72/output 195 and special damage quirks are source notes only; no damaged-start preset or automatic effects are applied. The ventral feed problem has no invented numerical penalty or disabled status. Maintenance figures are outside this combat-setup scope and are omitted. The Harrier has no verified matching token in the pinned icon directory, so it uses the labelled custom generic symbol. All its base and current values remain manually adjustable per instance.

### Additive command/data contract and future multiplayer

Version 1 now has optional `template.record` fields and separate `designOverrides` / manual condition fields. `ship-record.mjs` validates equipment/condition; `setup-session.mjs` provides `beginSetup`, `editSetup`, and `saveSetup`. The latter validates and sends a single `replace-ships` command with the draft's base revision; round/time are not replaced. `set-design` changes per-instance overrides while retaining the original template, and `set-condition` updates a complete manual condition record. Existing IDs, movement commands, revision validation and deterministic JSON replay remain intact.

The browser currently owns one authoritative local state. The pure engine, validated command adapter, explicit revisions and isolated editor draft provide boundaries for a future server authority; they are not a multiplayer implementation. A future transport must authenticate actors, authorize commands/ownership, reject stale writes and project a strict allowlisted player view from private GM state. Full encounter replacement is a privileged setup operation, not a future unrestricted player endpoint. Player ownership must be explicit and must not be inferred from Side A/B/C. Snapshot sharing is a separate queued feature and is not live synchronization. No accounts, server, credentials, backend hosting or network access mechanism is added here.

Companion Update 2024 movement, velocity-aligned decorative hull rotation, sensor detection/range-band work and player snapshots remain separate changes. This candidate retains the existing movement assumptions; no initiative, combat resolution, facing, weapons firing, missiles or dogfight rules are added.

### Side C and cosmetic travel orientation
Side C is purple and explicitly labelled; sides are presentation groups, not player ownership or visibility. Existing A/B records remain valid. Appearance optionally retains a world-space heading (old records default north). Moving ships derive it from actual velocity; plotting alone does not turn the glyph. Zero-speed ships retain their last heading. Only glyphs rotate; labels, selection and velocity arrows remain independent. Token bow axes were visually inspected: cyan exhaust on the boat/pinnace families is aft; other imported tokens point down in the supplied art. The custom toroid remains unrotated. This has no facing, firing-arc or movement effect.

The main map has a direct **Add Ship** button. It opens a new isolated draft immediately; choose a design and placement, expand **Adjust ship stats** when needed, then add to draft and Save encounter. Custom records expose required base fields. Cancel never adds a ship.
