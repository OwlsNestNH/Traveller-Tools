// Additive commands resolve existing source checkpoints without rewriting historical effects.
export function aslanEventPending(state){
 const p=state.pending,e=p?.effect;
 if(state.stage==='book-step'&&p?.kind==='native-effect'&&p.source==='aliens'&&p.page===21&&e?.kind==='equipment-credit'&&e.credits===5000&&JSON.stringify(e.categories)===JSON.stringify(['Art','Armour','Weapon']))return 'rite-equipment';
 if(state.stage==='book-step'&&p?.kind==='native-effect'&&p.source==='aliens'&&[26,27].includes(p.page)&&e?.kind==='deferred-benefit'&&e.name==='Clan Share'&&e.dice==='1D')return 'guardian-secret';
 if(state.stage==='book-step'&&p?.kind==='native-effect'&&p.source==='aliens'&&[40,41].includes(p.page)&&e?.kind==='career-status'&&e.action==='auto-qualify'&&JSON.stringify(e.careerChoices)===JSON.stringify(['aslan.outlaw','aslan.wanderer']))return 'outcast-opportunity';
 if(state.stage!=='book-step'||p?.kind!=='native-effect'||p.source!=='aliens'||e?.kind!=='source-required')return null;
 if(p.page===46&&e.reason==='Broker, Diplomat, Gun Combat or Melee (natural) check changes land by Effect increments, or SOC when landless; the source does not supply a target.')return 'territory-challenge';
 if(p.page===46&&e.reason==='Defend using Advocate8 (+2 with a clan Contact/Ally) or Melee(natural)10. Failure sets SOC2 and Outcast status.')return 'dishonoured';
 if(p.page===45&&e.reason==='Raise SOC to at least9, then receive a landhold at the SOC-based parcel size.')return 'wanderer-land';
 return null;
}

export function aslanOutcastEntry(state,careerId){return (state.character.aslanOutcastOpportunities??[]).find(r=>r.status==='available'&&r.availableAtCompletedTerms===state.character.terms&&r.careers.includes(careerId));}

export function aslanOwnedLand(state){return [...(state.character.aslanLandholds??[]).map(r=>({...r,ledger:'aslanLandholds'})),...(state.character.assets??[]).filter(r=>r.active&&r.ownership==='personal'&&r.category==='land').map(r=>({...r,ledger:'assets'}))].filter(r=>r.parcels>0);}
