// Plain text and HTML are separate contracts. Format exact saved values as
// strings; never coerce Credits through Number or change historical rounding.
export function escapeHtml(value) {
 return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

// Preserve the existing app/expense/passenger grouping, including historical
// non-integer or malformed display values. Validation belongs to state/rules.
export function formatCreditsText(value) {
 return 'Cr '+String(value).replace(/\B(?=(\d{3})+(?!\d))/g,',');
}

// Service price text has always grouped only the whole part. Retain its first
// decimal part when nonempty without changing that distinct display convention.
export function formatDecimalCreditsText(value) {
 const [whole,fraction]=String(value).split('.');
 return formatCreditsText(whole)+(fraction?'.'+fraction:'');
}

// Compatibility wrapper for existing application HTML callers. Callers that
// need plain text use formatCreditsText and escape once at their own HTML sink.
export function moneyHtml(value) {
 return value==null?'Not recorded':escapeHtml(formatCreditsText(value));
}
