// Exact arithmetic for declared decimal Power values and proportional drive loads.
const gcd=(a,b)=>{a=a<0n?-a:a;while(b){const r=a%b;a=b;b=r;}return a;};
const ratio=(n,d=1n)=>{if(!d)throw Error('Invalid zero Power divisor.');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return {n:n/g,d:d/g};};
export function decimal(v){if(typeof v!=='number'||!Number.isFinite(v))throw Error('Power arithmetic needs a finite number.');const m=/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(v)),digits=m[2]+(m[3]??''),exponent=Number(m[4]??0)-(m[3]?.length??0),n=BigInt(digits)*(m[1]?-1n:1n);return exponent>=0?ratio(n*10n**BigInt(exponent)):ratio(n,10n**BigInt(-exponent));}
export const add=(a,b)=>ratio(a.n*b.d+b.n*a.d,a.d*b.d);
export const subtract=(a,b)=>ratio(a.n*b.d-b.n*a.d,a.d*b.d);
export const multiply=(a,b)=>ratio(a.n*b.n,a.d*b.d);
export const divide=(a,b)=>ratio(a.n*b.d,a.d*b.n);
export function exact(v){if(!v.n)return '0';let d=v.d,a=0,b=0;while(d%2n===0n){d/=2n;a++;}while(d%5n===0n){d/=5n;b++;}if(d!==1n)return v.n+'/'+v.d;const places=Math.max(a,b),negative=v.n<0n,n=(negative?-v.n:v.n)*2n**BigInt(places-a)*5n**BigInt(places-b),digits=String(n).padStart(places+1,'0');return (negative?'-':'')+(places?(digits.slice(0,-places)+'.'+digits.slice(-places)).replace(/0+$/,'').replace(/\.$/,''):digits);}
export function numeric(v){if(!v.n)return 0;const negative=v.n<0n,ns=String(negative?-v.n:v.n),ds=String(v.d),head=s=>Number(s.slice(0,16))/10**(Math.min(16,s.length)-1);return Number((negative?'-':'')+(head(ns)/head(ds))+'e'+(ns.length-ds.length));}
