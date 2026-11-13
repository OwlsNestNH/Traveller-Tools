// Read-only presentation of engine-projected fallback rights. No eligibility or RNG rules.
export function failedQualificationModel(state,catalog){
 if(state.stage!=='failed-entry'||!state.fallbackOptions||state.fallbackOptions.forced)return null;
 const transition=state.character?.careerTransitions?.at(-1),id=state.failedQualificationContext?.careerId??transition?.toCareerId;
 if(state.character?.species==='aslan'&&state.character.culture==='native'&&(state.failedQualificationContext?.group==='aslan'||id?.startsWith('aslan.')))return null;
 const career=catalog.careers.find(c=>c.id===id)??{id,name:'Career'};
 return {fallback:true,template:{id:'qualification-failure',source:'Core Rulebook Update 2022 · pp. 18–20'},career,record:null,phase:0,specialties:[]};
}
export function qualificationFallbackInformation(state){
 const p=state.fallbackOptions;
 return {title:'After failed qualification',book:'Core Rulebook Update 2022',page:'18–20',pageLabel:'pp.',url:'https://www.mongoosepublishing.com/products/traveller-core-rulebook-update-2022',summary:'After failing to qualify, the ordinary Core alternatives are the draft or Drifter for that term. This is not limited to the first term. The ordinary draft is once per lifetime, unless an explicit rule or event says otherwise. A failed assignment change that retains the current career does not grant a draft choice; changes treated as a new career follow the qualification rules. Source-specific rights and restrictions still apply. '+(p?.draft.available?'The draft button records one draft roll and enters the assigned career.':'The Core draft is unavailable here: '+(p?.draft.reason??'follow the projected source choices.'))};
}
export function fallbackView(state,{esc,button}){
 const p=state.fallbackOptions;if(!p)return '<p class="warning">Fallback choices are unavailable. Preserve the current save and log.</p>';
 if(p.forced)return '<p>Your Drifter event requires the Core draft for your next term, even if you have been drafted before.</p><div class="actions">'+button(esc(p.normal.name),'fallback','',p.normal.available?'':'disabled')+button(esc(p.draft.name),'draft','quiet',p.draft.available?'':'disabled')+'</div>'+(p.normal.reason?'<p class="help">'+esc(p.normal.reason)+'</p>':'')+(p.draft.reason?'<p class="help">'+esc(p.draft.reason)+'</p>':'');
 const nativeAslan=state.character?.species==='aslan'&&state.character.culture==='native'&&(state.failedQualificationContext?.group==='aslan'||state.character.careerTransitions?.at(-1)?.toCareerId?.startsWith('aslan.')&&state.failedQualificationContext?.group!=='core'||p.normal.careerId==='aslan.outcast');
 const reference=nativeAslan?'Aliens of Charted Space Volume 1 Update 2026 · pp. 18–23. Use the projected Outcast fallback or a recorded outward route; this failure does not grant a Core draft.':'Core Rulebook Update 2022 · pp. 18–20. Source-specific exceptions remain authoritative.';
 const normal=button(esc(p.normal.name),'fallback','',p.normal.available?'':'disabled'),draft=button(esc(p.draft.available?'Roll the Core draft':p.draft.name),'draft','',p.draft.available?'':'disabled');
 return '<section id="qualification-fallback" aria-labelledby="qualification-fallback-title"><h3 id="qualification-fallback-title">Choose your next step</h3><p>Your failed qualification is recorded. Choose a permitted alternative for this term; closing this window does not undo the roll.</p><div class="actions">'+(p.draft.available?draft+normal:normal+draft)+'</div>'+(p.normal.reason?'<p class="help">'+esc(p.normal.reason)+'</p>':'')+(p.draft.reason?'<p class="help">'+esc(p.draft.reason)+'</p>':'')+'<p class="source">'+esc(reference)+'</p></section>';
}
