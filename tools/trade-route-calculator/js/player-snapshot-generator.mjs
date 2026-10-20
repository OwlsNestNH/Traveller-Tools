import {makePlayerSnapshotExample} from './player-snapshot-fixture.mjs?v=map-parity-20261020-100';
import {measureSnapshotLink} from './player-snapshot-codec.mjs?v=map-parity-20261020-100';
const result=document.getElementById('result'),link=document.getElementById('link'),open=document.getElementById('open');
document.getElementById('generate').addEventListener('click',()=>{
  link.value='';open.hidden=true;open.removeAttribute('href');
  try {
    const rounding=Number(document.getElementById('rounding').value),budget=Number(document.getElementById('budget').value);
    if(![200,500,2048,8192].includes(budget))throw Error('Choose a supported test budget.');
    const data=makePlayerSnapshotExample(Number(document.getElementById('cargo-lots').value));data.capturedAt=new Date().toISOString();
    const measured=measureSnapshotLink(data,{rounding}),url=new URL('player-snapshot-preview.html',location.href);url.hash=measured.payload;
    if(url.href.length>budget)throw Error(`Needs ${url.href.length} characters; selected limit is ${budget}. No link generated and no data omitted.`);
    link.value=url.href;open.href=url.href;open.hidden=false;result.textContent=`${url.href.length} characters · costs rounded up to Cr${rounding}. Cash and quantities unchanged. Unknown commodities use Other.`;
  }catch(error){result.textContent=error.message;}
});
