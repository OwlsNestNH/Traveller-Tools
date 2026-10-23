# Ship Combat Alpha — Under construction

This is a working **movement prototype**, not a complete combat simulator or a verified implementation of Mongoose Traveller 2e rules. Open `index.html` through a static HTTP server. There is no server API, account, storage, campaign import, telemetry, or external runtime dependency.

## Try it

Select one of five sample ships. Gold arrows show velocity and the next coast position, **not facing**. The selected ship's reachable targets are centred on its coast position, so ships with identical thrust and different velocity have different target areas. Click a highlighted hex, or enter axial Q/R coordinates and choose **Plot target**. **Advance round** applies every plot and moves every ship; ships without plots keep coasting. Thrust is not an automatic speed reset or a fixed maximum speed.

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

The catalogue contains 55 source variants from **Core Rulebook Update 2022** and **High Guard Update 2022**, including small craft and 400-ton ships. Each retains only displacement, printed thrust, hull points, armour when listed and printed-page citations. Book variants remain separate. Missing armour is `null` (not inferred zero). The Express Boat (High Guard, printed p. 158) has no manoeuvre drive: it uses zero thrust and can only coast in this movement prototype; its jump drive does not provide a thrust budget. No hull values are derived from displacement. High Guard's laboratory ship preserves its printed 360-ton hull / 400-ton drive configuration caveat; its Gazelle uses internal tankage without attached drop tanks. The catalogue is not a full ship sheet, rules database or catalogue of every possible module/configuration. No costs, source prose, deck plans or weapon tables are reproduced. The physical thrust-to-map conversion remains the prototype assumption above.

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

Ship map dots are replaced by fixed-orientation, solid silhouettes. The seven unmodified Samuel Penn CC0 WebPs are bundled locally; the browser turns their alpha into a solid side-coloured mask using an SVG filter. No external asset fetches occur at runtime. Provenance, the pinned upstream revision and SHA-256 hashes are in [assets/ships/PROVENANCE.md](assets/ships/PROVENANCE.md). No other source artwork or repository code was copied.

Side A is teal and Side B is orange; visible A/B labels and a dashed selection ring supplement colour. Side is presentation metadata only and does not introduce allegiance rules. Velocity arrows remain independent and are never used to rotate the hull symbol. Silhouettes and hit targets keep a readable screen size through zoom; they are not physical ship scale. The map coordinates, range lines, camera and motion remain proportional.

The Empress Marava design has its corresponding source token. Other class mappings use representative Free Trader, Scout, Light Fighter, Ship’s Boat, System Defence Boat or Patrol Corvette tokens; the interface says representative rather than claiming an exact depiction of every variant. Research ships use a custom top-down toroid symbol instead of the unwanted edge-on lab_ship token. Corsair and Other use original custom fallback shapes, explicitly labelled noncanonical. Automatic mapping can be overridden under Map symbol and side without editing design facts, crew, condition, velocity or plots. Custom ships begin with a generic symbol; the user can choose a representative class symbol.

State adds `appearance:{side:'A'|'B',icon:'auto'|<available symbol key>}`. Legacy ship inputs default to A/auto. `add-ship` optionally accepts appearance; `set-appearance` changes it for one `shipId` only, with normal revision/atomic-validation guarantees. `appearance.mjs` owns presentation choices and fallback glyphs; movement math has no facing or icon-dependent modifiers.
