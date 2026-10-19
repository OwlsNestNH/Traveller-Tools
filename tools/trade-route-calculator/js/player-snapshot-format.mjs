// Presentation only: never write rounded labels back into snapshot data.
export function formatSnapshotTons(value) {
  if (value === null) return 'Unknown';
  const [whole, fraction = ''] = value.split('.');
  const rounded = BigInt(whole) + (/[1-9]/.test(fraction) ? 1n : 0n);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatSnapshotWholeDown(value) {
  return value === null ? 'Unknown' : value.split('.')[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Expense basis text may contain explicitly labelled tonnage. Prices (/t),
// dates and other numbers remain verbatim. Explicit LSS stock rounds down.
export const formatSnapshotLss = formatSnapshotWholeDown;

export function formatSnapshotQuantityText(value, {fuel=false}={}) {
  return value.replace(/(?<![\w.,+\-])(\d+(?:,\d{3})*(?:\.\d+)?)(\s*(?:tonnes?|tons?|t))\b/gi,
    (_, amount, unit) => (fuel ? formatSnapshotWholeDown : formatSnapshotTons)(amount.replaceAll(',', '')) + unit).replace(/(?<![\w.,+\-])(\d+(?:,\d{3})*(?:\.\d+)?)(\s*LSS)\b(?!\s*(?:\/|per\b))/gi,
    (_, amount, unit) => formatSnapshotLss(amount.replaceAll(',', '')) + unit);
}
