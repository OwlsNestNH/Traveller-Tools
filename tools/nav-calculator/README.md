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

## Controls and changelog verification

```sh
node verification/layout.test.mjs
```

This suite starts a local static server, checks equal-size action buttons at eight widths from 320px to 1440px, expanded inputs, larger button text, keyboard navigation, repeated actions and changelog links, then repeats the calculation suite over HTTP. It shares `NAV_BROWSER_CHANNEL` and the optional Playwright module argument with the calculation suite. `PLAYWRIGHT_MODULE` supplies an alternative module path; `NAV_TEST_ROOT` supplies a hosted site root (including the repository prefix) instead of the local server. Optional `NAV_SCREENSHOT_DIR` saves desktop/mobile viewport screenshots.

The Nav Calculator GitHub workflow runs both suites with pinned Playwright/Chromium, plus the shared visit-counter tests. Release notes are in [`changes/nav.html`](../../changes/nav.html).

## Audit-fix verification

Run `node verification/audit.test.mjs` for focused checks of Orbit validation, synchronized reset/previews, route versus 100D mode persistence, clipboard API and fallback success/failure/cleanup, named controls, keyboard help toggling, live summaries and repeated results/error focus at 320px. It accepts the same Playwright module argument or `PLAYWRIGHT_MODULE`, browser channel and `NAV_TEST_URL` settings. The layout suite also runs this suite over HTTP, and CI runs both static and HTTP paths.

Orbit input validation enforces the existing control bounds: whole Orbit# 0–20 and fractions 0–0.99 in 0.01 steps. These are UI limits, not a new interpretation or independent verification of the handbook. Valid calculation formulas are unchanged. Profile changes retain the explicit route or 100D-only mode after other input edits; Clear restores route mode. Copy fallback always cleans up and restores focus, and reports failures truthfully.

## Reusable engine and frontend separation

The visible interface is unchanged. `index.html` owns markup/styles, `app.js` owns DOM input, events, local calculation mode, formatting, dice generation and clipboard handling, and `engine.js` owns calculations and validation. No server, storage, cloud sync or runtime dependency is added.

The versioned, standalone engine can be used from browser scripts, browser/Node ES modules via `engine.mjs`, or Node CommonJS. See [API.md](API.md) for the public input/output contract, units, errors, deterministic dice and copy/paste integration examples. Other tools are not integrated by this change.

Run the pure engine tests without a browser:

```sh
node --test verification/engine.test.mjs
```

Run independent before/after UI parity:

```sh
node verification/parity.test.mjs
```

The parity suite compares the refactor against the immutable PR264 HTML fixture at commit `ea48ea7d65699f99fd2a2f468c7c887c82695175`. It verifies the fixture SHA-256, runs deterministic inputs/dice at desktop/mobile widths, and compares outputs, clipboard text, errors, form state, focus, visibility and random-call count after every transition. A separate empty browser consumer checks the ES-module API. Existing static tests inline the exact deployed scripts; HTTP suites check actual relative script loading. CI runs all of these checks.
