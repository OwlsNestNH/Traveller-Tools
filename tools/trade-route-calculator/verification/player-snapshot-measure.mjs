// Reproducible synthetic measurements, not a supported transport-limit claim.
import {playerSnapshotFixture,makePlayerSnapshotExample} from '../js/player-snapshot-fixture.mjs';
import {measureSnapshotLink} from '../js/player-snapshot-codec.mjs';
const results=[];
for(const count of [null,0,50,200]) for(const rounding of [100,1000]) {
 const data=structuredClone(playerSnapshotFixture);
 if(count!==null) for(const key of ['cargo','buy','sell']) {
  const rows=Array.from({length:count},(_,i)=>({name:i%2?'Custom 雪 '+i:'Advanced Electronics',tons:key==='cargo'?String(i):(i/10).toFixed(1),...(key!=='cargo'?{creditsPerTon:String(i*7919+420)}:{})}));
  if(key==='cargo')data.cargo=rows;else data[key].offers=rows;
 }
 const result=measureSnapshotLink(data,{rounding});
 results.push({rows:count===null?'4 / 3 / 3':`${count} / ${count} / ${count}`,rounding,bytes:result.bytes,urlCharacters:result.characters,fits200:result.characters<=200});
}
console.log(JSON.stringify({proposedPrefix:'https://owlsnestnh.github.io/Traveller-Tools/p# (UNDEPLOYED)',results},null,2));
const standard=structuredClone(playerSnapshotFixture);
standard.buy.offers=Array.from({length:50},(_,i)=>({name:'Common Electronics',tons:String(i+1),creditsPerTon:String(10000+i%5*1000)}));standard.sell.offers=structuredClone(standard.buy.offers);
console.log(JSON.stringify({profile:'4 cargo / 50 buy / 50 sell, canonical base-price percentages',comparison:[false,true].map(percentages=>{const m=measureSnapshotLink(standard,{percentages});return {percentages,bytes:m.bytes,urlCharacters:m.characters};})},null,2));

for(const cargoLots of [10,12])for(const rounding of [100,1000]) {
 const m=measureSnapshotLink(makePlayerSnapshotExample(cargoLots),{rounding});
 const actualPrefix='https://owlsnestnh.github.io/Traveller-Tools/tools/trade-route-calculator/player-snapshot-preview.html#';
 console.log(JSON.stringify({cargoLots,buyOffers:3,sellOffers:3,rounding,bytes:m.bytes,proposedShortUrlCharacters:m.characters,fullPagesPathCharacters:actualPrefix.length+m.payload.length,pagesPathDeployed:true}));
}
