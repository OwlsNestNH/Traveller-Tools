# Traveller Trade Route Calculator — Deferred Backlog

[Rules verification status and evidence](RULES_VERIFICATION.md)

These ideas are outside locked V1 scope. They are candidates for later design, not promises or reasons to delay V1. See [REQUIREMENTS.md](REQUIREMENTS.md) for required behavior.

| Idea | Later scope / design needed |
| --- | --- |
| Passengers | Availability, passage classes, stateroom/low-berth capacity, life support, bookings, delivery, and payments. Explicitly excluded from V1. |
| More route modes | Profit-oriented, least-distance as a primary objective, safest, fuel-cost optimization, circuit/loop routes, and comparisons. V1 already includes automatic Fewest jumps with editable mandatory stops, fuel-availability validation, and distance as a tie-breaker. |
| Full ship economics | Automated fuel quantities/consumption and cost, maintenance, mortgages, crew pay, life support, and recurring port/operating expenses. V1 supports manual expenses and fuel-availability route validation. |
| Saved trader profiles | Reusable named trader/crew/broker configurations and switching among profiles. V1 retains the active trader state. |
| Persistent campaign-specific world overrides | A reusable world-override registry with campaign identity, reset/version controls, and conflict handling. V1 supports editable effective UWP and preserves applied values in snapshots/state; a managed registry is deferred. |
| Offline cache | Durable world/navigation cache, offline status, freshness policy, and refresh controls. V1 local campaign persistence does not imply offline API availability. |
| Multiple campaigns | Campaign selection, isolated storage, migrations, and archive management. |
| Expanded analytics | Route/commodity comparisons, long-term profitability, cash flow, and ledger reporting. |
| Additional rules/options | Supplements, alternative editions, configurable house rules beyond the agreed options, and more detailed legal consequences. The explicitly approved, off-by-default Merchant Prince insurance/tax adaptation is now V1 scope; see OPTIONAL_RULES.md. Independently verify each ruleset. |
| Sharing and collaboration | Portable campaign sharing beyond JSON files; any future hosting/service choice must respect the free-only constraint. |
| Enhanced market lifecycle | Optional referee-defined expiration policies or economic simulation. V1 offers remain active until manually expired. |

## Required implementation preparation, not deferred scope

Rules verification is pending. Use Traveller Core Rulebook Update 2022 as the intended baseline and confirm its exact edition/update and applicable errata during verification. Before implementing the trading engine, check in a versioned rules dataset, edition/page or table references, and worked examples with expected results. Independently verify commodity tables, trade-code conditions, DMs and their combination, brokers/fees, illegal goods, freight/mail, and date/jump handling. PDFs and personal reference links must stay out of the repository and runtime.

Verify the agreed monetary round-down policy while preserving decimal cargo quantities. Cover partial-lot cost allocation, shared fees, per-lot positive-profit adjustment, unchanged losses, bank reconciliation, and freight/mail exclusion from the adjustment. Also cover Fewest jumps with mandatory stops and per-offer expiration/undo. These are required V1 checks, not deferred features.

Do not use the buggy/untrusted existing `tools/spec-trade/` tool as rules authority. Reuse is allowed only after independent verification against the Core Rulebook.

Future ideas may be promoted into a release only through an explicit scope decision. Do not implement the app as part of this documentation task.
