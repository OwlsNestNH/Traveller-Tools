// Per-instance presentation/manual fit notes. These never grant visibility or resolve effects.
export function normalizeIdentity(value={}){
 value??={};
 if(typeof value!=='object'||Array.isArray(value))throw Error('Ship identity must be a record.');
 const text=(v,max,label)=>{if(typeof v!=='string'||v.length>max)throw Error(label+' is too long or invalid.');return v.trim();};
 const allegiance=text(value.allegiance??'',80,'Allegiance'),specials=value.specials??null;
 if(specials!==null&&(!Array.isArray(specials)||specials.length>16))throw Error('At most 16 installed special records.');
 return {allegiance,specials:specials===null?null:Array.from(specials,s=>{if(!s||typeof s!=='object')throw Error('Enter an installed special record.');const name=text(s.name,80,'Special name');if(!name)throw Error('Special name is required.');return {name,detail:text(s.detail??'',240,'Special note')};})};
}
