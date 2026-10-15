# Independent Life Support refill review

Branch: feat/lss-refill-controls. Baseline main d28a9fba5a7e216df73612486302bd60e9977123 (PR88 / UI2026.10.14.89). No merge or deployment authorized.

## Implemented

The application now enables independent internal/cargo controls, paid Confirm Refill and bank-neutral GM Adjustment through the existing completion-aware service controller. Exact optional cargo allocation preserves a single authoritative total and cargo-first travel consumption. Whole-number display formatting does not modify stock. Cancel and preview are detached; only successful transactions can discard a compartment fraction. Undo restores exact prior stock, including legacy representation.

Consumables use the approved Middle/High per-person rates and every occupied frozen Low berth, prorated over28days. New Middle/High rate fields are in the existing Life support Settings group. Cabin upkeep is enabled separately in Ship expenses at existing cabin rates. Comfort remains collapsible, requires a note when spending, adds once and adds no supplies. New and historical accounting references are distinct. GM changes and pricing inputs are auditable.

All accounting choices are settled; see RULES_REVIEW.md. Total-inventory correction in existing Settings retains its prior internal-first replacement semantics, now explained; compartment-specific corrections use GM Adjustment. Rate-only Settings saves preserve exact compartment stock.

## Evidence and remaining release checks

- Baseline:6477 native tests passed. Integrated final native run:6517 passed; zero failures. Rules227 and shared-tool checks passed.
- Actual browser: paid and GM flows passed at1440/390/320px; rate-only Settings save preserved exact allocation. All30 desktop/mobile real service-completion cases passed, including delayed/prewrite/uncertain/publication failures, repeated clicks, locking, reload and History Undo.
- Updated full service-panel browser suite passed, including responsive layout, keyboard labels, price/Low/comfort/fraction cases, receipts, navigation and Undo. Combined-cabins and day-controls browser suites passed with new economics.
- Independent source review and99 focused tests passed; reported forecast, validity, preview-total and pricing-reference defects were corrected. Final independent source review found no transaction/save blocker. Top and total screenshots were inspected at desktop and narrow widths; the final review wording correction identifies configurable rates as defaults.
- Some local Edge broader suites encounter startup or reload editing-lock timeouts; these remain recorded and require exact-head CI assessment. Earlier failed runs are retained outside the repo. No assertions or application ownership guards were weakened to bypass them.
- Homestead completed6 jumps and79 exact accounting checkpoints. Legacy Accounts, Clear Route and Route Save fixture gates passed with original monetary/Undo oracles retained and reviewed compartment-module source pins added.
- CI initially identified stale controls, ledger schema assumptions and source pins in broader tests; these were updated without weakening economic or save assertions. The new Settings rate unit moved to existing help text to fit compact mobile controls. Exact-head CI status and final run links are tracked on draft PR89; this source record does not claim a pending run passed.

Fixtures and screenshots contain synthetic campaign data only. Approved Library mockup metadata/extracted labels were read; its pixel download was blocked by a Windows extended-attribute helper error. Existing app and synthetic preview screenshots were inspected directly.
