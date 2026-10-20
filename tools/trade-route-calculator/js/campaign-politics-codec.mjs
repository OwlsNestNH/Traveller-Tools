// Public campaign claims only. Canonical bounded binary data; no campaign storage.
import {projectCampaignPolitics,MAX_CLAIM_HEXES,MAX_ALLEGIANCE_WORLDS} from './campaign-politics.mjs';
const bad=()=>{throw Error('Invalid or unsupported campaign territory. Request a fresh player link.');};
export function encodeCampaignPolitics(input){
 const value=projectCampaignPolitics(input),out=[];
 const uint=n=>{do{out.push((n&127)|(n>127?128:0));n=Math.floor(n/128);}while(n);};
 uint(value?1:0);
 if(value)for(const kind of ['claims','allegiances']){uint(value[kind].length);for(const pair of value[kind])for(const n of pair)uint(n<0?-n*2-1:n*2);}
 return Uint8Array.from(out);
}
export function decodeCampaignPolitics(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length>4000)bad();let at=0;
 const uint=()=>{let n=0;for(let i=0;i<3;i++){if(at>=bytes.length)bad();const b=bytes[at++];n+=(b&127)*2**(7*i);if(!(b&128)){if(i&&b===0)bad();return n;}}bad();};
 const version=uint();if(version>1)bad();let value=null;
 if(version){value={version:1};for(const [kind,limit]of [['claims',MAX_CLAIM_HEXES],['allegiances',MAX_ALLEGIANCE_WORLDS]]){const count=uint();if(count>limit)bad();value[kind]=Array.from({length:count},()=>Array.from({length:2},()=>{const n=uint();return n&1?-(n+1)/2:n/2;}));}}
 if(at!==bytes.length)bad();return projectCampaignPolitics(value);
}
export function campaignPoliticsFragment(value){return btoa(String.fromCharCode(...encodeCampaignPolitics(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function campaignPoliticsFromFragment(text){
 if(typeof text!=='string'||text.length>5334||!text||!/^[\w-]+$/.test(text)||text.length%4===1)bad();
 try{const bytes=Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)),value=decodeCampaignPolitics(bytes);if(campaignPoliticsFragment(value)!==text)bad();return value;}catch{bad();}
}
