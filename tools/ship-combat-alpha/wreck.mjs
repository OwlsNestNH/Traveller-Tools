// Presentation only. Never infer current damage from design hull or missing data.
export const isWrecked=ship=>Number.isFinite(ship?.condition?.hull)&&ship.condition.hull<=0;
// Shared definitions contain no ship/contact data. Cuts keep the original hull in
// place; debris stays inside radius 20, the smallest existing icon envelope.
export const WRECK_DEFS=`<filter id="wreck-gray" x="-5%" y="-5%" width="110%" height="110%"><feFlood flood-color="#8b969d"/><feComposite in2="SourceAlpha" operator="in"/></filter><mask id="wreck-breaks" maskUnits="userSpaceOnUse" x="-34" y="-34" width="68" height="68"><rect x="-34" y="-34" width="68" height="68" fill="white"/><path d="M-34-5 L-12-5 -8-2 -3-5 2-1 7-4 13-1 34-1 L34 2 12 2 7-1 2 2 -3-2 -8 1 -13-2 -34-2Z M7 34 L7 14 4 10 7 6 6 1 8 0 10 6 7 10 10 14 10 34Z" fill="black"/></mask>`;
export function wreckArt(symbol){return `<g class="wreck-hull" filter="url(#wreck-gray)" mask="url(#wreck-breaks)">${symbol}</g><path class="wreck-debris" fill="#8b969d" d="M-17 6l2-1 1 2-2 1Z M15-10l2 1-1 2-2-1Z M9 16l2 1-1 2-2-1Z"/>`;}
