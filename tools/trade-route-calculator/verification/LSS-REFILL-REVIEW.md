# Life support refill draft review

Baseline: PR #88 merge `d28a9fb`, build 2026.10.14.89. This candidate is intentionally **not integrated into the live application**. Open `verification/lss-refill-preview.html` through a local static server to review the draft UI using synthetic data. No merge or deployment is authorized.

Implemented independently of accounting: internal capacity slider; independent cargo quantity, minus/plus and fill; prominent whole-number stock and days; equal-weight current/max figures; optional reason; one adapter-supplied total; Audit; Cancel; separate, currently disabled paid and GM actions. Untouched compartment fractions remain exact. All controls edit only a detached draft.

The UI does not invent a price. The total remains unavailable until a transaction adapter supplies an approved quote. This is a partial implementation for review, not a replacement refill workflow.

## Decisions before integration

1. With 12.8 internal LSS and 3.4 cargo LSS, a cargo-only refill could discard only the cargo fraction, both compartment fractions, or a pooled fraction. Which is intended? Existing payment logic rounds resulting total stock upward. No destructive truncation has been implemented.
2. Preserve the configured-target tariff boundary: cabin plus person charges for standard supply, then the existing fixed reserve tariff? Physical internal capacity is not that pricing boundary. Middle and High person rates are hardcoded; existing Settings adjusts cabin rates. Low frozen passenger billing is separate from awake low-service occupants.
Cargo-first travel consumption is settled: preserve the existing overflow-first behavior. A separate exact cargo allocation is needed because the existing single stock total implicitly fills internal stores before cargo. No new consumption policy is proposed.

The read-only campaign adapter now captures revision/location, exact internal/cargo stock and available cargo after fuel, freight, lots and passenger reservations. Legacy conversion occurs only in its detached copy; booked people contribute once. Unknown stock, missing hull capacity and overcommitted holds fail closed. This adapter is not yet connected to a transaction or live screen.

## Remaining implementation and verification

After decisions, add backward-compatible exact allocation validation, audited paid refill and GM adjustment adapters, and integrate with the existing revision/token/pending-save owner. Preserve Settings and unrelated accounting. Test independent capacity against fuel/luggage/contracts, exact travel and Undo, imports, pricing, frozen Low billing, no-write Cancel, stale sessions, delayed/failed saves and double payment. Then run full native/rules/browser checks and independent final source/pixel review. Existing accounting tests are baseline evidence only; they do not certify new controls that are not yet wired.

Library mockup identity was resolved and its extracted labels inspected. Pixel download was blocked by the Library helper's unsupported Windows extended-attribute operation. No private campaign data is included.

## Local evidence (CrowLT)

- Clean baseline: 6,477 native tests passed; focused life-support, service panel and completion baseline: 168 passed.
- Final candidate: 6,489 native tests passed; 227 rules-data checks passed. Initial candidate failed one release-token assertion; imports were corrected and the full suite rerun successfully.
- Temporary headless Edge: synthetic preview passed at 1280, 390 and 320 px, including real slider drag, independent controls, Cancel, no storage writes, disabled accounting and no horizontal overflow.
- Independent source review and 390 px screenshot inspection completed. The reviewer independently ran all 12 draft tests. Reported range-node replacement and fractional Fill edge cases were corrected.
- Windows checkout CRLF initially broke the existing VM harness; tracked files were restored to exact Git blob bytes before the passing runs. No repository-wide line-ending changes are included.
- Full application browser/CI coverage and final integrated save/payment verification remain outstanding. These results certify only the detached UI scope.
