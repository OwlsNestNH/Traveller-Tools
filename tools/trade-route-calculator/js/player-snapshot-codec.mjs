import {encodeCampaignPolitics,decodeCampaignPolitics} from './campaign-politics-codec.mjs';
// Standalone browser codec prototype. No DOM, storage, network or production adapter.
import {projectPlayerSnapshot, EXPENSE_KINDS, SNAPSHOT_VERSION, LEGACY_MAINTENANCE, CargoTonnageError} from './player-snapshot.mjs?v=zone-zoom-20261020-105';
import {CATALOG_VERSION, COMMODITIES, WORLDS, TEXT_FRAGMENTS, BASE_PRICES, STATIC_TEXT_V2, DESTINATIONS_V2} from './player-snapshot-catalog.mjs';
export const PROPOSED_PREFIX = 'https://owlsnestnh.github.io/Traveller-Tools/p#'; // NOT DEPLOYED
export const CODEC_VERSION = 8;
const MAX_BYTES = 65536, MAX_URL = 100000;
const worldKeys = ['name','location','uwp','tradeCodes','travelZone','starport'];
const statuses = ['available','not-checked','expired'];
const commodityIds = new Map(Object.entries(COMMODITIES).map(([id,name]) => [name, Number(id)]));
const invalid = () => { throw new Error('Invalid or unsupported snapshot link. Request a fresh compatible link.'); };
const scale = s => {const [a,b=''] = s.split('.'); return BigInt(a)*1000000n+BigInt(b.padEnd(6,'0'));};
function rounded(s, quantum) {
  if (s === null) return null;
  const q = BigInt(quantum)*1000000n;
  const result = String(((scale(s)+q-1n)/q)*BigInt(quantum));
  if (result.length > 15) throw new Error('Rounded cost exceeds the snapshot numeric range.');
  return result;
}
export function prepareSnapshotForLink(input, {rounding=100}={}) {
  if (![100,1000].includes(rounding)) throw new Error('Choose Cr100 or Cr1000 rounding.');
  const data = structuredClone(projectPlayerSnapshot(input));
  for (const kind of EXPENSE_KINDS) for (const key of ['expected','paid']) data.expenses[kind][key] = rounded(data.expenses[kind][key],rounding);
  for (const list of [data.cargo,data.buy.offers,data.sell.offers]) for (const row of list) {
    row.name = COMMODITIES[commodityIds.get(row.name) ?? 0];
    if(row.purchase){
      const purchase=row.purchase;
      // Cost of the tons in this lot, from exact unit cost BEFORE rounding.
      let total=purchase.paidTotal;
      if(total===null && purchase.paidPerTon!==null){const digits=String(scale(purchase.paidPerTon)*BigInt(row.tons)).padStart(7,'0');total=digits.slice(0,-6)+'.'+digits.slice(-6);}
      purchase.paidTotal=rounded(total,rounding);
      purchase.paidPerTon=rounded(purchase.paidPerTon,rounding);
      purchase.originalBrokerCommission=rounded(purchase.originalBrokerCommission,rounding);
    }
    if ('creditsPerTon' in row) row.creditsPerTon = rounded(row.creditsPerTon,rounding);
  }
  return projectPlayerSnapshot(data);
}
function packet(input, bytes, rounding, percentages=true, codecVersion=CODEC_VERSION) {
  const reading = bytes !== undefined, output = []; let position = 0;
  const byte = value => {
    if (reading) {if (position >= bytes.length) invalid(); return bytes[position++];}
    output.push(value); if (output.length > MAX_BYTES) throw new Error('Snapshot exceeds the binary size limit.'); return value;
  };
  const uint = value => {
    if (reading) {
      let result=0n;
      for (let i=0;i<(codecVersion>=2?11:10);i++) {const next=byte(); result |= BigInt(next&127)<<BigInt(i*7); if (!(next&128)) {if (i && next===0) invalid(); return result;} }
      invalid();
    }
    let n=BigInt(value); do {const next=Number(n&127n); n >>= 7n; byte(next | (n ? 128 : 0));} while(n);
    return BigInt(value);
  };
  const small = (value, max) => {const n=uint(value); if (n>BigInt(max)) invalid(); return Number(n);};
  const rawString = value => {
    if (reading) {const length=small(undefined,960); if (position+length>bytes.length) invalid(); const result=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes.subarray(position,position+length)); position+=length; return result;}
    // TextEncoder replaces lone surrogates; reject instead of silently changing data.
    if (!value.isWellFormed()) throw new Error('Snapshot text contains an invalid Unicode surrogate.');
    const encoded=new TextEncoder().encode(value); uint(encoded.length); for (const n of encoded) byte(n); return value;
  };
  const legacyString = value => {
    if (reading) {
      const count=small(undefined,241); let result='';
      for(let i=0;i<count;i++) {const token=small(undefined,TEXT_FRAGMENTS.length); result+=token ? TEXT_FRAGMENTS[token-1] : rawString(); if(result.length>240) invalid();}
      return result;
    }
    const parts=[]; let rest=value, literal='';
    const flush=()=>{if(literal){parts.push([0,literal]);literal='';}};
    while(rest) {
      const index=TEXT_FRAGMENTS.findIndex(fragment=>rest.startsWith(fragment));
      if(index>=0){flush();parts.push([index+1]);rest=rest.slice(TEXT_FRAGMENTS[index].length);}
      else {literal+=rest[0];rest=rest.slice(1);}
    }
    flush(); uint(parts.length); for(const [token,text] of parts){uint(token);if(!token)rawString(text);} return value;
  };
  const decimal = value => {
    if(codecVersion>=2) {
      if(reading){const code=uint();if(code===0n)return null;const tag=Number(code&7n);if(tag===0)invalid();const places=tag-1,digits=String(code>>3n).padStart(places+1,'0');return places?digits.slice(0,-places)+'.'+digits.slice(-places):digits;}
      if(value===null){uint(0);return null;}const [a,b='']=value.split('.');uint((BigInt(a+b)<<3n)|BigInt(b.length+1));return value;
    }
    if (reading) {const tag=byte(); if (!tag) return null; if (tag>7) invalid(); const places=tag-1, digits=String(uint()).padStart(places+1,'0'); return places ? digits.slice(0,-places)+'.'+digits.slice(-places) : digits;}
    if (value===null) {byte(0); return null;} const [a,b='']=value.split('.'); byte(b.length+1); uint(BigInt(a+b)); return value;
  };
  const string = (value,context={}) => {
    if(codecVersion===1)return legacyString(value);
    const pad=(n,width)=>String(n).padStart(width,'0');
    if(reading) {
      const tag=small(undefined,12);
      if(tag===0)return rawString();
      if(tag<=5)return STATIC_TEXT_V2[tag-1];
      if(tag===6){const minutes=small(undefined,4223371679),iso=new Date(minutes*60000).toISOString();return iso.slice(0,10)+' '+iso.slice(11,16)+' UTC (example)';}
      if(tag===7)return new Date(small(undefined,253402300799999)).toISOString();
      if(tag===8){const year=small(undefined,9999),day=small(undefined,999),minute=small(undefined,1439);return pad(day,3)+'-'+pad(year,4)+', '+pad(Math.floor(minute/60),2)+':'+pad(minute%60,2);}
      if(tag===9||tag===10){if(typeof context.worldName!=='string')invalid();const year=tag===9?context.year:pad(small(undefined,9999),4);if(typeof year!=='string'||!/^\d{4}$/.test(year))invalid();return context.worldName+' · this stop, '+pad(small(undefined,999),3)+'–'+pad(small(undefined,999),3)+'-'+year+' planned';}
      if(tag===11)return DESTINATIONS_V2[small(undefined,DESTINATIONS_V2.length-1)];
      const tons=decimal(),rate=decimal();if(tons===null||rate===null)invalid();return 'Planned '+tons+' t refined top-up at Cr'+rate+'/t';
    }
    const fixed=STATIC_TEXT_V2.indexOf(value);if(fixed>=0){uint(fixed+1);return value;}
    let match=/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC \(example\)$/.exec(value);
    if(match){const ms=Date.parse(match[1]+'T'+match[2]+':00.000Z');if(Number.isFinite(ms)&&ms>=0&&new Date(ms).toISOString().slice(0,16)===match[1]+'T'+match[2]){uint(6);uint(ms/60000);return value;}}
    if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)){const ms=Date.parse(value);if(Number.isFinite(ms)&&ms>=0&&new Date(ms).toISOString()===value){uint(7);uint(ms);return value;}}
    match=/^(\d{3})-(\d{4}), (\d{2}):(\d{2})$/.exec(value);
    if(match&&Number(match[3])<24&&Number(match[4])<60){uint(8);uint(Number(match[2]));uint(Number(match[1]));uint(Number(match[3])*60+Number(match[4]));return value;}
    const prefix=context.worldName+' · this stop, ';match=typeof context.worldName==='string'&&value.startsWith(prefix)?/^(\d{3})–(\d{3})-(\d{4}) planned$/.exec(value.slice(prefix.length)):null;
    if(match){const same=match[3]===context.year;uint(same?9:10);if(!same)uint(Number(match[3]));uint(Number(match[1]));uint(Number(match[2]));return value;}
    const destination=DESTINATIONS_V2.indexOf(value);if(destination>=0){uint(11);uint(destination);return value;}
    match=/^Planned ((?:0|[1-9]\d{0,14})(?:\.\d{1,6})?) t refined top-up at Cr((?:0|[1-9]\d{0,14})(?:\.\d{1,6})?)\/t$/.exec(value);
    if(match){uint(12);decimal(match[1]);decimal(match[2]);return value;}
    uint(0);rawString(value);return value;
  };
  const money = value => {
    if (reading) {const n=uint(); return n===0n ? null : String((n-1n)*BigInt(rounding));}
    uint(value===null ? 0n : BigInt(value)/BigInt(rounding)+1n); return value;
  };
  const price = (value,id) => {
    if(!percentages) return money(value);
    const base=BASE_PRICES[id];
    if(reading) {const code=uint(); if(code&1n) {if(!Number.isSafeInteger(base)||base<=0)invalid(); const product=(code>>1n)*BigInt(base);if(product%20n || (product/20n)%BigInt(rounding))invalid();return String(product/20n);}return String((code>>1n)*BigInt(rounding));}
    const amount=BigInt(value), explicit=(amount/BigInt(rounding))<<1n;
    let code=explicit;
    if(percentages && Number.isSafeInteger(base) && base>0 && amount*20n%BigInt(base)===0n) {
      const percent=((amount*20n/BigInt(base))<<1n)|1n;
      const size=n=>{let count=1;while(n>=128n){n>>=7n;count++;}return count;};
      if(size(percent)<size(explicit))code=percent;
    }
    uint(code);return value;
  };
  if(byte(80)!==80)invalid();codecVersion=byte(codecVersion);if(![1,2,3,4,5,6,7,8].includes(codecVersion))invalid();
  if(byte(codecVersion>=3?codecVersion:2)!==(codecVersion>=3?codecVersion:2)||byte(CATALOG_VERSION)!==CATALOG_VERSION)invalid();
  const mode=byte((rounding===1000?1:0)|(percentages?2:0)); if (mode>3) invalid(); rounding=mode&1 ? 1000 : 100; percentages=Boolean(mode&2);
  const source=input ?? {}, result={version:SNAPSHOT_VERSION};
  result.capturedAt=string(source.capturedAt); result.campaignDate=string(source.campaignDate);
  // Reference by stable location, then explicitly carry EVERY differing world field.
  const worldId=small(reading ? undefined : Number(Object.keys(WORLDS).find(id=>WORLDS[id].location===source.world.location) ?? 0),255);
  if (worldId && !WORLDS[worldId]) invalid();
  const reference=WORLDS[worldId] ?? {}, mask=byte(reading ? undefined : worldKeys.reduce((n,key,i)=>n | (source.world[key]!==reference[key] ? 1<<i : 0),0));
  if (mask>63 || (!worldId && mask!==63)) invalid();
  result.world=Object.fromEntries(worldKeys.map((key,i)=>[key,mask&(1<<i) ? string(source.world?.[key]) : reference[key]]));
  result.world.mapReference=null;
  if(codecVersion>=4 && small(reading?undefined:Number(source.world.mapReference!==null),1))result.world.mapReference={sector:string(source.world?.mapReference?.sector),hex:string(source.world?.mapReference?.hex)};
  const ship=source.ship ?? {}; result.ship={name:string(ship.name),cargoCapacityTons:decimal(ship.cargoCapacityTons),cashCredits:decimal(ship.cashCredits),fuel:{},lifeSupport:{}};
  for (const key of ['fuel','lifeSupport']) for (const field of ['current','capacity']) result.ship[key][field]=decimal(ship[key]?.[field]);
  result.ship.lifeSupport.cargoLss=decimal(ship.lifeSupport?.cargoLss);
  for(const field of ['daysRemaining','daysCapacity','cargoReservedTons'])result.ship.lifeSupport[field]=codecVersion>=3?decimal(ship.lifeSupport?.[field]):null;
  result.ship.destination=string(ship.destination);
  result.expenses={maintenance:LEGACY_MAINTENANCE,visitLabel:string(source.expenses?.visitLabel,{worldName:result.world.name,year:/^\d{3}-(\d{4}), \d{2}:\d{2}$/.exec(result.campaignDate)?.[1]})};
  for (const kind of EXPENSE_KINDS.filter(k=>codecVersion>=6||k!=='maintenance')) {const row=source.expenses?.[kind]; result.expenses[kind]={expected:money(row?.expected),paid:money(row?.paid),basis:string(row?.basis)};}
  const rows = (list, priced) => Array.from({length:small(list?.length,200)},(_,i)=>{
    const row=list?.[i], id=small(reading ? undefined : commodityIds.get(row.name),255);
    if (!Object.hasOwn(COMMODITIES,id)) invalid();
    const next={name:COMMODITIES[id],tons:decimal(row?.tons)}; if (priced) next.creditsPerTon=price(row?.creditsPerTon,id);
    else {next.purchase=null;if(codecVersion>=5 && small(reading?undefined:Number(row.purchase!==null),1))next.purchase={retailPerTon:decimal(row?.purchase?.retailPerTon),percent:decimal(row?.purchase?.percent),paidPerTon:money(row?.purchase?.paidPerTon),paidTotal:money(row?.purchase?.paidTotal),originalBrokerCommission:codecVersion>=7?money(row?.purchase?.originalBrokerCommission):null};}
    return next;
  });
  result.cargo=rows(source.cargo,false);
  for (const key of ['buy','sell']) {const status=small(reading ? undefined : statuses.indexOf(source[key].status),2); result[key]={status:statuses[status],offers:rows(source[key]?.offers,true)};}
  result.campaignPolitics=null;
  if(codecVersion>=8){
    if(reading){const length=small(undefined,4000);if(position+length>bytes.length)invalid();result.campaignPolitics=decodeCampaignPolitics(bytes.subarray(position,position+length));position+=length;}
    else {const politics=encodeCampaignPolitics(source.campaignPolitics);uint(politics.length);for(const n of politics)byte(n);}
  }
  if (reading) {if (position!==bytes.length) invalid(); return projectPlayerSnapshot(result);}
  return Uint8Array.from(output);
}
const base64 = bytes => btoa(Array.from(bytes,n=>String.fromCharCode(n)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function budget(value) {if (!Number.isInteger(value) || value<PROPOSED_PREFIX.length || value>MAX_URL) throw new Error('Invalid URL character budget.'); return value;}
export function measureSnapshotLink(input, {rounding=100,percentages=true,codecVersion=CODEC_VERSION}={}) {
  if(![1,2,3,4,5,6,7,8].includes(codecVersion))invalid();
  const snapshot=prepareSnapshotForLink(input,{rounding});
  if(codecVersion<8 && snapshot.campaignPolitics!==null)throw Error('Older codecs cannot represent campaign territory.');
  if(codecVersion<7 && snapshot.cargo.some(row=>row.purchase?.originalBrokerCommission!=null))throw Error('Older codecs cannot represent Broker commission.');
  if(codecVersion<6 && (snapshot.expenses.maintenance.expected!==null||snapshot.expenses.maintenance.paid!==null))throw Error('Older codecs cannot represent separate maintenance.');
  if(codecVersion<5 && snapshot.cargo.some(row=>row.purchase!==null))throw Error('Older codecs cannot represent cargo purchase history.');
  if(codecVersion<4 && snapshot.world.mapReference!==null)throw Error('Older codecs cannot represent the map reference.');
  if(codecVersion<3 && [snapshot.ship.lifeSupport.daysRemaining,snapshot.ship.lifeSupport.daysCapacity,snapshot.ship.lifeSupport.cargoReservedTons].some(value=>value!==null))throw Error('Older codecs cannot represent explicit life-support days or reserved cargo space.');
  const plain=packet(snapshot,undefined,rounding,false,codecVersion), candidate=percentages?packet(snapshot,undefined,rounding,true,codecVersion):plain;
  const bytes=candidate.length<plain.length?candidate:plain, payload=base64(bytes);
  return Object.freeze({bytes:bytes.length,characters:PROPOSED_PREFIX.length+payload.length,payload,snapshot,rounding,prefix:PROPOSED_PREFIX});
}
export function encodeSnapshotLink(input, {rounding=100,maxUrlLength=8192}={}) {
  budget(maxUrlLength); const result=measureSnapshotLink(input,{rounding});
  if (result.characters>maxUrlLength) throw new Error(`Snapshot needs ${result.characters} URL characters; limit is ${maxUrlLength}. No link generated and no rows omitted.`);
  return PROPOSED_PREFIX+result.payload;
}
export function decodeSnapshotLink(url, {maxUrlLength=8192}={}) {
  budget(maxUrlLength);
  if (typeof url!=='string' || url.length>maxUrlLength || !url.startsWith(PROPOSED_PREFIX)) invalid();
  const payload=url.slice(PROPOSED_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || payload.length%4===1 || payload.length>Math.ceil(MAX_BYTES*4/3)) invalid();
  try {
    const bytes=Uint8Array.from(atob(payload.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    if (bytes.length>MAX_BYTES || base64(bytes)!==payload) invalid();
    return packet(undefined,bytes);
  } catch(error) {if(error instanceof CargoTonnageError)throw error;invalid();}
}
// Metadata is read only after the complete packet has passed validation.
export function decodeSnapshotEnvelope(url,options) {
  const snapshot=decodeSnapshotLink(url,options), mode=atob(url.slice(PROPOSED_PREFIX.length).replace(/-/g,'+').replace(/_/g,'/')).charCodeAt(4);
  return Object.freeze({snapshot,rounding:mode&1?1000:100});
}
