# Cargo and Sell review captures

Captured on 2026-10-20 from the PR #106 implementation (UI build 2026.10.20.97), including the final buyer-search action fix. These images use only `verification/fixtures/gui-parity.mjs` and a synthetic five-ton GM addition at Cr 55,000/t. They contain no real campaign or user data. Chromium viewport widths are 1440px and 390px; modal images show optional details collapsed. The Delete image stops at confirmation; nothing is deleted to create these images.

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Cargo aboard | [1440px](cargo-1440.png) | [390px](cargo-390.png) |
| Add cargo | [1440px](add-1440.png) | [390px](add-390.png) |
| Edit cargo | [1440px](edit-1440.png) | [390px](edit-390.png) |
| Delete confirmation | [1440px](delete-1440.png) | [390px](delete-390.png) |
| GM cargo receipt | [1440px](gm-receipt-1440.png) | [390px](gm-receipt-390.png) |
| Sell selection | [1440px](sell-1440.png) | [390px](sell-390.png) |

Automated browser coverage additionally checks the live reference after quantity normalization, deletion save outcomes and Undo, purchase provenance, partial sales, and narrow layout. Screenshots illustrate presentation; they do not replace those assertions.
