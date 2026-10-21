// Derived from public displayed prices only; never reconstruct a dice/table result.
const units=value=>{if(typeof value!=='string'||!/^(0|[1-9]\d{0,14})(\.\d{1,6})?$/.test(value))return null;const [a,b='']=value.split('.');return BigInt(a)*1000000n+BigInt(b.padEnd(6,'0'));};
export function derivedRetailPercent(row){
 const price=units(row?.creditsPerTon),base=units(row?.retailPerTon);
 if(price===null||base===null||base===0n)return 'Unknown';
 const tenths=(price*1000n+base/2n)/base;
 return String(tenths/10n)+(tenths%10n?'.'+String(tenths%10n):'')+'%';
}
