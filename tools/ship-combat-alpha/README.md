# Ship Combat Alpha — Under construction

This is a working **movement prototype**, not a complete combat simulator or a verified implementation of Mongoose Traveller 2e rules. Open `index.html` through a static HTTP server. There is no server API, account, storage, campaign import, telemetry, or external runtime dependency.

## Try it

Select one of five sample ships. Gold arrows show velocity and the next coast position, **not facing**. The selected ship's reachable targets are centred on its coast position, so ships with identical thrust and different velocity have different target areas. Click a highlighted hex, or enter axial Q/R coordinates and choose **Plot target**. **Advance round** applies every plot and moves every ship; ships without plots keep coasting. Thrust is not an automatic speed reset or a fixed maximum speed.

Edit the selected ship to enter a name, position, velocity and thrust budget. The sample fighter has thrust 9; there is no ceiling of six. Integer budgets from 0 to 10,000 are supported. This is a prototype input bound, not a Traveller rule. Edits clear that ship's plot and leave the camera fixed. Reset or reload starts a fresh sample.

The map is a single proportional axial-hex projection. Pan and zoom never compress separate pair distances. Fit ships frames their actual positions. Range lines join the selected ship to the others; the sidebar lists those same abstract hex-step distances. Hex detail automatically disappears at distant zoom and can also be toggled off. Grid enumeration is bounded to 1,800 cells; target legality uses an analytic distance check even when grid detail is hidden. Large thrust never enumerates its millions of reachable targets.

## Unverified assumptions and limits

The default round lasts six minutes. One thrust changes velocity by one hex per round; apply the impulse **before** moving with the updated velocity. This integration order and conversion are explicit prototype assumptions, not claims of rules accuracy. There is no physical hex scale, kilometre conversion, verified range band, reaction-engine performance model, mixed six-minute/six-second dogfight clock, weapons, damage, missiles, crew model or templates catalogue. No licensed book text or rule tables are included.

Positions and velocity components are whole axial coordinates bounded to ±1,000,000; thrust is a nonnegative whole number ≤10,000. Up to eight ships are supported by the engine. Invalid, nonfinite, fractional, oversized, stale or out-of-range commands fail without modifying the supplied state. These safety bounds are prototype limits, not physical rules.

## Engine and command/state API

`engine.mjs` has no browser or I/O dependencies. It owns validation and movement. `geometry.mjs` owns the affine projection and bounded visible-grid calculation. `app.mjs` is an adapter between DOM controls and explicit commands. Capability data (`capabilities.thrust`) is separate from mutable motion (`motion.position`, `velocity`, `impulse`); crew and a real ship-definition catalogue are intentionally absent.

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
