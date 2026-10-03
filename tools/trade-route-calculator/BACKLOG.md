# Traveller Trade Route Calculator — Deferred Backlog

These ideas are outside locked V1 scope. They are candidates for later design, not promises or reasons to delay V1. See [REQUIREMENTS.md](REQUIREMENTS.md) for required behavior.

| Idea | Later scope / design needed |
| --- | --- |
| Passengers | Availability, passage classes, stateroom/low-berth capacity, life support, bookings, delivery, and payments. Explicitly excluded from V1. |
| More route modes | Profit-oriented, shortest, safest, fuel-aware alternatives, circuit/loop routes, and comparisons. Define objectives and constraints before adding optimization. |
| Full ship economics | Automated fuel quantities/consumption and cost, maintenance, mortgages, crew pay, life support, and recurring port/operating expenses. V1 supports manual expenses and fuel-availability route validation. |
| Saved trader profiles | Reusable named trader/crew/broker configurations and switching among profiles. V1 retains the active trader state. |
| Persistent campaign-specific world overrides | A reusable world-override registry with campaign identity, reset/version controls, and conflict handling. V1 supports editable effective UWP and preserves applied values in snapshots/state; a managed registry is deferred. |
| Offline cache | Durable world/navigation cache, offline status, freshness policy, and refresh controls. V1 local campaign persistence does not imply offline API availability. |
| Multiple campaigns | Campaign selection, isolated storage, migrations, and archive management. |
| Expanded analytics | Route/commodity comparisons, long-term profitability, cash flow, and ledger reporting. |
| Additional rules/options | Supplements, alternative editions, configurable house rules beyond the locked profit modes, and more detailed legal consequences. Independently verify each ruleset. |
| Sharing and collaboration | Portable campaign sharing beyond JSON files; any future hosting/service choice must respect the free-only constraint. |
| Enhanced market lifecycle | Optional referee-defined expiration policies or economic simulation. V1 offers remain active until manually expired. |

## Required implementation preparation, not deferred scope

Before coding rules, confirm the Core Rulebook edition and independently verify commodity tables, trade-code conditions, DMs, brokers/fees, freight/mail, and date/jump handling with rule references and worked examples. Apply the locked round-down policy and verify fee/cost-basis accounting consistently, including partial cargo-lot sales and profit-adjustment ledger entries.

Do not use the buggy/untrusted existing `tools/spec-trade/` tool as rules authority. Reuse is allowed only after independent verification against the Core Rulebook.

Future ideas may be promoted into a release only through an explicit scope decision. Do not implement the app as part of this documentation task.
