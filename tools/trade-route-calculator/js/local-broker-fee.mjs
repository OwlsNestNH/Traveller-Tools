// New transaction inputs only: never rewrite historical fee amounts or terms.
export function localBrokerFeePercent(contact, input = undefined) {
 if (contact?.options?.local !== true) return 0;
 if (input === undefined) return 10;
 if ((typeof input !== 'string' && typeof input !== 'number') || String(input).trim() === '') throw Error('Enter a broker commission from 0 to 100%.');
 const value=Number(input);
 if (!Number.isFinite(value) || value<0 || value>100) throw Error('Enter a broker commission from 0 to 100%.');
 return value;
}
