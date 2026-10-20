import {measureSnapshotLink} from './player-snapshot-codec.mjs?v=map-details-20261020-101';
// Budget the actual deployed URL, not the codec's proposed short prefix.
export function playerSnapshotUrl(snapshot,pageUrl,{maxUrlLength=8192}={}){
 if(!Number.isSafeInteger(maxUrlLength)||maxUrlLength<100||maxUrlLength>8192)throw Error('Invalid player link size limit.');
 const base=new URL('player-snapshot-preview.html',pageUrl);
 if(!['http:','https:'].includes(base.protocol))throw Error('Open the hosted calculator before copying a player link.');
 base.search='';base.hash=measureSnapshotLink(snapshot).payload;
 if(base.href.length>maxUrlLength)throw Error('This snapshot needs '+base.href.length+' URL characters; the limit is '+maxUrlLength+'. No link generated and no rows omitted.');
 return base.href;
}
