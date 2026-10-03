# Tool visit counters

Enabled October 3, 2026. Each of the five tools linked on the home page has a separate shared page-open counter.

- Hits (https://github.com/silentsoft/hits) records a hit when a canonical published tool document becomes visible. Reloads count; this is not a unique-person count. Browser blocking, caching and bots can affect totals.
- Vehicle Builder counts its actual standalone HTML, not the redirect page. Source previews and audit pages do not count. Local/offline copies and other hosts do not count.
- Only the canonical public tool path is in the counter URL. No campaign state, designs, query parameters or fragments are sent. Referrer transmission is disabled. The external services receive ordinary network request information.
- Homepage Shields dynamic JSON badges read Hits' /api/urns/{canonical-path} endpoint and select $.total. This endpoint does not increment counters. Badges cache results and can lag by several minutes.
- New counters appear after the first tool open; before that a badge may report an unavailable resource. Service failures do not prevent tools loading or navigating. No credentials, paid services or backend deployment are required.
- Existing pre-counter traffic cannot be recovered. Production verification visits are included in initial totals.
- To disable counting, remove the tool-visits.js hooks and the homepage badges.

Implementation: assets/js/tool-visits.js; integration hooks in each tool's main HTML. The Vehicle Builder source HTML includes its hook so rebuilding the standalone preserves it. To add a new tool, extend the script's allowlist, add its integration hook and its read-only homepage badge.
