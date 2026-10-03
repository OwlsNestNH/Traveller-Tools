// Exact rational arithmetic for Credits and decimal tons. JSON stores strings.
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b];}return a||1n;};
export function rat(n,d=1n){n=BigInt(n);d=BigInt(d);if(!d)throw Error('Division by zero');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return {n:n/g,d:d/g};}
export function dec(value){if(value&&typeof value==='object'&&typeof value.n==='bigint')return value;const s=String(value).trim();if(!/^-?\d+(\.\d+)?$/.test(s)||s.length>100)throw Error('Enter a finite decimal number (up to 100 characters).');const [a,b='']=s.split('.');return rat(BigInt(a+b),10n**BigInt(b.length));}
export const add=(a,b)=>{a=dec(a);b=dec(b);return rat(a.n*b.d+b.n*a.d,a.d*b.d);};
export const sub=(a,b)=>{b=dec(b);return add(a,rat(-b.n,b.d));};
export const mul=(a,b)=>{a=dec(a);b=dec(b);return rat(a.n*b.n,a.d*b.d);};
export const div=(a,b)=>{a=dec(a);b=dec(b);return rat(a.n*b.d,a.d*b.n);};
export const cmp=(a,b)=>{const x=sub(a,b).n;return x<0n?-1:x>0n?1:0;};
export const floor=a=>{a=dec(a);return a.n>=0n?a.n/a.d:-((-a.n+a.d-1n)/a.d);};
export const sum=xs=>xs.reduce(add,rat(0));
export function decimal(a){a=dec(a);const negative=a.n<0n;let n=negative?-a.n:a.n;let s=String(n/a.d),r=n%a.d;if(r){s+='.';for(let i=0;r&&i<100;i++){r*=10n;s+=String(r/a.d);r%=a.d;}if(r)throw Error('Nonterminating decimal; retain the rational audit value.');}return (negative?'-':'')+s;}
export const auditNumber=a=>{a=dec(a);return {numerator:String(a.n),denominator:String(a.d)};};
export function credit(v){const s=String(v);if(!/^-?\d+$/.test(s)||s.length>50)throw Error('Credits must be a whole number.');return BigInt(s);}
export function positive(v,label='Amount'){if(cmp(v,0)<=0)throw Error(label+' must be positive.');return decimal(v);}
export function allocate(total,items){total=BigInt(total);if(total<0n)throw Error('Negative allocation');const weights=items.map(x=>dec(x.weight));if(weights.some(x=>x.n<0n))throw Error('Negative weight');const den=sum(weights);if(!den.n){if(total)throw Error('No positive allocation weights');return items.map(()=>0n);}const exact=weights.map(w=>mul(total,div(w,den)));const out=exact.map(floor);let left=total-out.reduce((a,b)=>a+b,0n);const order=items.map((x,i)=>({i,id:x.id,remainder:sub(exact[i],out[i])})).sort((a,b)=>-cmp(a.remainder,b.remainder)||a.id.localeCompare(b.id));for(const x of order){if(left<=0n)break;out[x.i]++;left--;}return out;}
