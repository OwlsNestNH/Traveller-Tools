import * as T from './planet-tables.mjs';
const unknown='Not supplied';
const hex=c=>c&&c!=='?'?'0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'.indexOf(c.toUpperCase()):-1;
const explain=(table,code)=>Object.hasOwn(table,code)?table[code]:'Unknown / not decoded';
const shown=x=>x===undefined||x===null||x===''||x==='?'?unknown:String(x);
export function worldSheetURL(world){const url=new URL('https://travellermap.com/world');url.search=new URLSearchParams({sector:world.sector,hex:world.hex,milieu:'M1105'});return url.href;}
// Published data remains the default for the reference dialog. The MFD can
// explicitly supply its validated effective UWP without changing source records.
export function planetInformation(world,{uwp:effectiveUWP}={}){
 const r=world.raw||{},uwp=String(effectiveUWP??(r.UWP||world.uwp||'????????-?')),pbg=String(r.PBG||'???');
 const fields=[['Starport',0,T.STARPORT_TABLE],['Size',1,T.SIZ_TABLE],['Atmosphere',2,T.ATM_TABLE],['Hydrographics',3,T.HYD_TABLE],['Population',4,T.POP_TABLE],['Government',5,T.GOV_TABLE],['Law level',6,T.LAW_TABLE],['Technology level',8,T.TECH_TABLE]];
 const decoded=fields.map(([name,i,t])=>[name,uwp[i]||'?',explain(t,uwp[i])]);
 const multiplier=hex(pbg[0]),exponent=uwp[4]==='X'?-1:hex(uwp[4]);let population=unknown;
 if(multiplier>=0&&exponent>=0){const effective=multiplier===0&&exponent>0?1:multiplier;population=effective+' × 10^'+exponent+' = '+(BigInt(effective)*10n**BigInt(exponent)).toLocaleString('en-US')+(effective!==multiplier?' (Traveller Map assumes multiplier 1 when recorded as 0)':'');}
 const belts=hex(pbg[1]),giants=hex(pbg[2]),total=r.Worlds===undefined||r.Worlds===null||r.Worlds===''?null:Number(r.Worlds);
 const other=total!==null&&Number.isInteger(total)&&total>=1&&belts>=0&&giants>=0&&total>=1+belts+giants?total-1-belts-giants:null;
 const stars=String(r.Stellar||'').replace(/[OBAFGKM][0-9] D/g,'D').split(/\s+(?!Ia|Ib|II|III|IV|V|VI|VII)/).filter(Boolean).map(code=>{
  const last=code.split(/\s+/).at(-1),color={O:'Blue',B:'Blue',A:'White',F:'Yellow-White',G:'Yellow',K:'Orange',M:'Red'}[code[0]];
  const type=/^[OBA][0-9] V$/.test(code)?'Main Sequence':explain(T.STELLAR_TABLE,last);
  return code+' — '+(/^[OBAFGKM][0-9] /.test(code)?color+' ':'')+type;
 });
 const sections=[];
 const ix=String(r.Ix||'').replace(/[{}\s]/g,'');if(ix)sections.push(['Importance',[['Importance',ix,explain(T.IX_IMP_TABLE,ix.replace(/^\+/,''))]]]);
 const ex=String(r.Ex||'').replace(/[()\s]/g,'');if(ex)sections.push(['Economics',[
  ['Resources',ex[0]||'?',explain(T.EX_RESOURCES_TABLE,ex[0])],['Labor',ex[1]||'?',explain(T.POP_TABLE,ex[1])],['Infrastructure',ex[2]||'?',explain(T.EX_INFRASTRUCTURE_TABLE,ex[2])],['Efficiency',ex.slice(3)||'?',explain(T.EX_EFFICIENCY_TABLE,ex.slice(3))]
 ]]);
 const cx=String(r.Cx||'').replace(/[\[\]\s]/g,'');if(cx)sections.push(['Culture',[
  ['Heterogeneity',cx[0]||'?',explain(T.CX_HETEROGENEITY_TABLE,cx[0])],['Acceptance',cx[1]||'?',explain(T.CX_ACCEPTANCE_TABLE,cx[1])],['Strangeness',cx[2]||'?',explain(T.CX_STRANGENESS_TABLE,cx[2])],['Symbols',cx[3]||'?',explain(T.CX_SYMBOLS_TABLE,cx[3])]
 ]]);
 const remarks=(String(r.Remarks||'').match(/\([^)]*\)\S*|\S+/g)||[]).map(code=>[code,explain(T.REMARKS_TABLE,code)]);
 const list=(codes,t)=>String(codes||'').trim()&&String(codes).trim()!=='-'?Array.from(String(codes).trim()).map(c=>c+' — '+explain(t,c)).join('; '):'None recorded';
 const zone=r.Zone==='A'?'Amber — Caution':r.Zone==='U'?'Amber — Unabsorbed':r.Zone==='R'?'Red — Restricted':r.Zone==='F'?'Red — Forbidden':['','-','G'].includes(r.Zone)?'Safe — no restriction recorded':shown(r.Zone);
 return {uwp,decoded,sections,remarks,summary:[['Sector / hex',world.sector+' '+world.hex],['Subsector',shown(r.SubsectorName)],['Allegiance',r.AllegianceName? r.AllegianceName+(r.Allegiance?' ('+r.Allegiance+')':''):shown(r.Allegiance)],['Travel zone',zone],['Population',population]],system:[['Stars',stars.join('; ')||unknown],['Gas giants',giants<0?unknown:String(giants)],['Planetoid belts',belts<0?unknown:String(belts)],['Other worlds',other===null?unknown:String(other)],['Total worlds',shown(r.Worlds)],['Bases',r.Bases==null||r.Bases==='?'?unknown:list(r.Bases,T.BASE_TABLE)],['Nobility',r.Nobility===undefined?unknown:list(r.Nobility,T.NOBILITY_TABLE)],['Resource units',shown(r.ResourceUnits)]]};
}
