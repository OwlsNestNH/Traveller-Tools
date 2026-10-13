// Frozen calculation statements from searchDialog at b7222363c7555e8e4a0cea4b3144e9165303b930.
// Differential oracle only; never imported by the application.
function beforeContactSearchOutcome(input){
 const {skill,rolled,duration,characteristic,counterparty,previous}=input;
 const core={search:{starportDM:input.starportDM}},c={uwp:{starport:input.starport}},m={durationUnit:input.durationUnit},f={has:()=>input.successOverride},method='normal';
  if(![skill,rolled,duration,characteristic,counterparty].every(Number.isInteger)||rolled<2||rolled>12||duration<1||duration>6)throw Error('Invalid search input');
  const port=core.search.starportDM[c.uwp.starport]||0,total=rolled+skill+characteristic+port-previous,success=total>=8||f.has('success'),illegal=method==='blackMarket',hours=duration*(m.durationUnit==='days'?24:1);
 return {port,total,success,hours};
}
