// Original bounded Clan Share exchanges. Aliens Vol1 Update2026 pp22,47;
// converted Ship Shares retain Core Update2022 p47 restrictions.
export const CLAN_SHARE_SOURCE=Object.freeze({id:'aliens',page:47});
const need=(v,m)=>{if(!v)throw Error(m);};
const integer=(v,min,max,name)=>{need(Number.isSafeInteger(v)&&v>=min&&v<=max,name+' is out of range.');return v;};
export function clanShareInputs(lots,inputs){
 need(Array.isArray(inputs)&&inputs.length>0&&inputs.length<=100,'Select at least one Clan Share lot.');const ids=new Set();let quantity=0;
 const selected=inputs.map(input=>{need(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>['lotId','quantity'].includes(k)),'Use only lot ID and quantity.');need(typeof input.lotId==='string'&&!ids.has(input.lotId),'Choose each lot only once.');ids.add(input.lotId);const lot=lots.find(l=>l.id===input.lotId);need(lot,'The selected Clan Share lot no longer exists.');integer(input.quantity,1,1000000,'Share quantity');need(input.quantity<=lot.available,'The selected lot has insufficient unspent shares.');need(lot.provenance!=='unverified','Verify that this is a genuine Clan Share award before redemption.');quantity+=input.quantity;need(Number.isSafeInteger(quantity),'Share total is too large.');return {lotId:lot.id,awardId:lot.awardId,quantity:input.quantity,clanId:lot.clanId};});
 return {quantity,inputs:selected};
}
export function clanShareExchange({lots,inputs,kind,gender,relationship,clanId}={}){
 const selected=clanShareInputs(lots,inputs);need(['cash','ship-shares','contact','ally'].includes(kind),'This Clan Share exchange is not implemented.');
 if(kind==='cash')need(gender==='female','Male Clan Share redemption grants art or weapons, not cash. Equipment redemption remains source-assisted.');
 if(['contact','ally'].includes(kind)){need(clanId,'Verify the issuing clan before using a clan favour.');need(selected.quantity===1,'A clan favour consumes exactly one share.');need(selected.inputs.every(i=>i.clanId===clanId),'The favour must belong to the selected share clan.');}
 if(kind==='ally'){need(relationship?.role==='Contact','Select an existing Contact, not an Ally or other relationship.');need(relationship.clanFavour?.clanId===clanId&&relationship.clanFavour.upperEchelon===true,'Verify that this Contact belongs to this clan’s upper echelons first.');}
 return {...selected,kind,source:{...CLAN_SHARE_SOURCE},cash:kind==='cash'?selected.quantity*10000:0,shipShares:kind==='ship-shares'?selected.quantity:0,clanId:['contact','ally'].includes(kind)?clanId:null};
}
export function clanShareLotInvariant(lot){
 for(const key of ['awarded','available','spent','forfeited'])integer(lot[key],0,Number.MAX_SAFE_INTEGER,key);
 need(lot.awarded===lot.available+lot.spent+lot.forfeited,'Clan Share lot accounting does not balance.');return true;
}
