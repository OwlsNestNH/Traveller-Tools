# Nav Calculator

Static in-system transit calculator. Open through GitHub Pages or a static server.

## Calculation assumptions

- Direct transit starts from rest, with constant acceleration or symmetric flip-and-burn braking.
- One AU is approximated as 150,000,000 km. Light time is approximated as 8.3 minutes per AU.
- System-map separation uses chord geometry with an eight-point compass: 0°, 45°, 90°, 135° or 180°.
- Trans-solar flight distance retains the existing selectable detour factors. Communication delay uses direct endpoint separation; blockage and relay paths are not modelled.
- 100D results are advisory and are not added to the route.
- Time reductions must remain below 100%, and calculated travel time must be positive and finite.
- Editing inputs invalidates the previous result and copied brief. Changing the transit profile recalculates an available route or the active 100D-only calculation.

The existing World Builder's Handbook orbit table and Astrogation rule definitions were not independently source-verified as part of these bug fixes.

## Regression verification

Requires Node.js and Playwright for development only; the deployed calculator has no added dependencies.

```sh
node verification/nav.test.mjs
```

An optional first argument supplies an existing Playwright module path. Set `NAV_BROWSER_CHANNEL` to `msedge` or `chrome` to use an installed browser. Set `NAV_TEST_URL` to test a hosted copy; otherwise the test reads the adjacent calculator HTML.

On 2026-10-03, 25 checks passed in Microsoft Edge, covering direct-distance timing, angular geometry, communication delay, invalid percentages/effects, 100D profile changes, complete map reset, and stale-result/brief invalidation. The tests use a fresh browser context and do not access the user's saved browser data.
