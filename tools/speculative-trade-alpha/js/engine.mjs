import * as M from '../../trade-route-calculator/js/amounts.mjs';

export const SETTINGS_VERSION = 'first-playtest-2026-10-16-q125-expertise12';
export const RISK = Object.freeze({
  low:Object.freeze([70,75,80,85,90,95,100,105,110,115,120]),
  moderate:Object.freeze([50,60,70,80,90,100,110,120,130,140,150]),
  high:Object.freeze([10,20,40,60,80,100,125,150,175,200,225])
});
export class UnresolvedRule extends Error {}
export const rational = value => value && typeof value === 'object' && 'numerator' in value
  ? M.rat(value.numerator,value.denominator) : M.dec(value);
export const packed = value => M.auditNumber(rational(value));
export const add = (a,b) => packed(M.add(rational(a),rational(b)));
export const subtract = (a,b) => packed(M.sub(rational(a),rational(b)));
export const compare = (a,b) => M.cmp(rational(a),rational(b));
export const approximate = a => {a=rational(a);return Number(a.n)/Number(a.d);};
const max = (a,b) => M.cmp(a,b)>=0?a:b;
const nonnegative = (v,label) => {const r=rational(v);if(r.n<0n)throw Error(label+' cannot be negative');return r;};
const positive = (v,label) => {const r=nonnegative(v,label);if(!r.n)throw Error(label+' must be positive');return r;};
const integer = (v,label,min=-100,maxValue=100) => {
  if(!Number.isSafeInteger(v)||v<min||v>maxValue)throw Error('Invalid '+label);return v;
};
export function expertise(baseBroker) {
  integer(baseBroker,'base Broker',0,100);
  if(baseBroker>4)throw new UnresolvedRule('Expertise above base Broker 4 needs a ruling.');
  return [0,0,0,1,2][baseBroker];
}
export function diceTotal(dice) {
  if(!Array.isArray(dice)||dice.length!==2)throw Error('Two individual d6 are required');
  return dice.reduce((total,d)=>total+integer(d,'d6',1,6),0);
}
export function baseline(input) {
  const {purchase,tonnes,investment,normalHold,monthlyCosts,monthlyTarget,freight,
    plannedJumps=2,premiumEnabled=false,freightRate=0}=input;
  const k=nonnegative(investment,'Investment');
  if(!k.n)return {version:SETTINGS_VERSION,status:'no_speculative_lot'};
  const p=positive(purchase,'Purchase');
  if(M.cmp(p,k)>0)throw Error('Lot principal exceeds departure investment');
  const floor=M.mul(positive(normalHold,'Normal hold'),2000);
  const contribution=M.div(M.add(nonnegative(monthlyCosts,'Monthly costs'),rational(monthlyTarget)),integer(plannedJumps,'planned jumps',1,24));
  const gap=M.sub(contribution,nonnegative(freight,'Freight'));
  const a0=gap.n>0n?M.mul(p,M.add(1,M.div(M.mul('1.25',gap),max(k,floor)))):p;
  let a=a0;
  if(typeof premiumEnabled!=='boolean')throw Error('Premium activation must be explicit');
  if(premiumEnabled) {
    const displaced=M.mul(positive(tonnes,'Lot tonnes'),nonnegative(freightRate,'Freight rate'));
    a=max(a0,M.div(M.add(p,M.mul('1.10',displaced)),'0.95'));
  }
  return {version:SETTINGS_VERSION,baseline:packed(a),beforePremium:packed(a0),gap:packed(gap),floor:packed(floor),premiumEnabled};
}
export function quote({departure,risk,dice,baseBroker,statDM,opposingBroker=3,localDM=2,tradeDM=0,otherSaleDM=0,dataNetDiscount=null}) {
  if(departure.version!==SETTINGS_VERSION)throw Error('Unsupported departure settings version');
  if(!Object.hasOwn(RISK,risk))throw Error('Unknown risk tier');
  const raw=diceTotal(dice), bonus=expertise(baseBroker);
  const modified=raw+baseBroker+integer(statDM,'stat DM')+bonus+integer(tradeDM,'trade DM')+
    integer(otherSaleDM,'other sale DM')-integer(opposingBroker,'opposing Broker',0)-integer(localDM,'local DM');
  const negotiationPP=Math.max(-10,Math.min(10,2*(modified-5)));
  const riskPercent=RISK[risk][raw-2];
  let gross=M.mul(rational(departure.baseline),M.div(riskPercent+negotiationPP,100));
  if(dataNetDiscount!==null)throw new UnresolvedRule('Use applyDataNet with the original purchase principal.');
  return {version:SETTINGS_VERSION,dice:[...dice],raw,baseBroker,statDM,expertise:bonus,opposingBroker,localDM,tradeDM,otherSaleDM,
    modified,negotiationPP,risk,riskPercent,baseline:structuredClone(departure.baseline),gross:packed(gross)};
}
export function applyDataNet(sale,purchase,discount) {
  const d=rational(discount);
  if(M.cmp(d,'0.05')<0||M.cmp(d,'0.20')>0)throw Error('Data Net reduction must be 5–20%');
  const surplus=max(M.sub(rational(sale.gross),positive(purchase,'Purchase')),M.rat(0));
  return {...structuredClone(sale),normalGross:sale.gross,dataNetDiscount:packed(d),gross:packed(M.sub(rational(sale.gross),M.mul(d,surplus)))};
}
export function buyerSearch({dice,baseBroker,statDM,risk,population}) {
  integer(baseBroker,'base Broker',0,100);integer(statDM,'stat DM');integer(population,'population',0,33);
  if(population===0)throw new UnresolvedRule('Population 0 has no ordinary local buyer market.');
  if(!Object.hasOwn(RISK,risk))throw Error('Unknown risk tier');
  const raw=diceTotal(dice),riskDM={low:2,moderate:0,high:-2}[risk];
  const populationDM=population<=3?-2:population<=5?-1:population<=8?0:1;
  const total=raw+baseBroker+statDM+riskDM+populationDM;
  return {dice:[...dice],raw,baseBroker,statDM,riskDM,populationDM,total,success:total>=8,duration:'one working day'};
}
export function adminSearch({dice,adminSkill,statDM,otherDM,durationDie,rushed=false,techLevel,discountPercent}) {
  integer(techLevel,'tech level',0,33);if(techLevel<8)throw new UnresolvedRule('Data Net requires TL8 or higher.');
  integer(adminSkill,'Admin skill',0,100);integer(statDM,'GM-selected Admin stat DM');integer(otherDM,'GM-selected Admin search DMs');
  integer(durationDie,'duration d6',1,6);integer(discountPercent,'surplus reduction',5,20);
  if(typeof rushed!=='boolean')throw Error('Rush must be explicit');const raw=diceTotal(dice),rushDM=rushed?-2:0;
  const total=raw+adminSkill+statDM+otherDM+rushDM;
  return {method:'Admin',dice:[...dice],raw,adminSkill,statDM,otherDM,rushDM,total,success:total>=8,durationDie,rushed,
    durationMinutes:durationDie*(rushed?10:60),discountPercent,techLevel,gmModifierSelection:true};
}
export function fixtureFees(tonnes) {
  const t=nonnegative(tonnes,'Sold tonnes');
  return packed(t.n?M.add(max(M.rat(500),M.mul(t,20)),M.mul(t,20)):0);
}
export function profitTax(gain,government,taxChart,{zeroLossTrial=false}={}) {
  gain=rational(gain);
  if(gain.n<=0n) {
    if(!zeroLossTrial)throw new UnresolvedRule('Nonpositive profit tax requires the explicit zero-tax trial.');
    return {tax:packed(0),rate:0,trial:true,bracket:null};
  }
  const row=taxChart.governmentRates.find(r=>r.uwpGovernmentCode===String(government));
  if(!row)throw new UnresolvedRule('Government has no verified tax mapping.');
  const index=taxChart.brackets.findIndex(b=>M.cmp(gain,b.minCredits)>=0&&(b.maxCredits===null||M.cmp(gain,b.maxCredits)<=0));
  if(index<0)throw new UnresolvedRule('Fractional tax bracket boundary requires a rounding ruling.');
  const rate=row.rates[index];
  if(!rate||!Number.isFinite(rate.percent))throw new UnresolvedRule('This government rate requires an explicit ruling/dice input.');
  return {tax:packed(M.mul(gain,M.div(rate.percent,100))),rate:rate.percent,bracket:index,government:String(government),trial:false};
}
export function settle({lines,fees,government,taxChart,zeroLossTrial=false}) {
  if(!Array.isArray(lines)||!lines.length)throw Error('Select at least one quoted sale');
  const gross=M.sum(lines.map(l=>nonnegative(l.gross,'Gross sale')));
  const principal=M.sum(lines.map(l=>positive(l.purchase,'Purchase')));
  const sellingFees=nonnegative(fees,'Selling fees');
  const gain=M.sub(M.sub(gross,principal),sellingFees);
  const tax=profitTax(gain,government,taxChart,{zeroLossTrial});
  return {gross:packed(gross),principal:packed(principal),fees:packed(sellingFees),gain:packed(gain),...tax,
    cashCredit:packed(M.sub(M.sub(gross,sellingFees),rational(tax.tax))),profit:packed(M.sub(gain,rational(tax.tax)))};
}

// JSON-safe seed and individual die audit. Advancing the seed is a state transition.
export function roll2d6(seed) {
  integer(seed,'dice seed',1,4294967295);const dice=[];let next=seed;
  for(let i=0;i<2;i++){next=(Math.imul(next,1664525)+1013904223)>>>0;dice.push(Math.floor(next/4294967296*6)+1);}
  return {dice,seed:next||1};
}
export function rollD6(seed) {
  integer(seed,'dice seed',1,4294967295);const next=(Math.imul(seed,1664525)+1013904223)>>>0;
  return {die:Math.floor(next/4294967296*6)+1,seed:next||1};
}
