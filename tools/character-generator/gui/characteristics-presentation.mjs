// Read-only presentation for the characteristic rolling stage. Rules stay in the engine.
const labels={STR:'Strength',DEX:'Dexterity',END:'Endurance',INT:'Intellect',EDU:'Education',SOC:'Social standing',CHA:'Charisma',PSI:'Psionic strength'};
function primaryCodes(state,catalog){
 const species=catalog.species.find(item=>item.id===state.character.species);
 return Object.keys(species?.dice??{}).slice(0,6).map(code=>state.character.species==='vargr'&&state.character.culture==='imperial'&&code==='CHA'?'SOC':code);
}
export function emptyStatisticsView(state,catalog,{esc}){
 const codes=primaryCodes(state,catalog);
 return '<div class="stats statistics-empty" aria-label="Characteristics not yet rolled">'+codes.map(code=>'<div class="stat stat-empty"><span class="code">'+esc(code)+'</span><strong aria-label="Not rolled">—</strong><span>'+esc(labels[code]??code)+'</span><span>Not rolled</span></div>').join('')+'</div>';
}
export function selectedOptionalStatistics(state,catalog){
 const selected=new Set(state.config.extras??[]);
 const species=catalog.species.find(item=>item.id===state.character.species);
 const inherent=new Set(Object.keys(species?.dice??{}));
 if(state.optionalImperialCharisma&&state.character.species==='vargr'&&state.character.culture==='imperial')inherent.delete('CHA');
 if(state.character.species==='aezorgh')inherent.add('CHA');
 return catalog.extraStats.filter(extra=>selected.has(extra.id)&&!inherent.has(extra.id));
}
export function statisticsCardsView(state,catalog,baseHtml,{esc}){
 const extras=selectedOptionalStatistics(state,catalog);
 if(!extras.length)return baseHtml;
 const value=extra=>Object.hasOwn(state.character.stats,extra.id)?state.character.stats[extra.id]:extra.id==='PSI'?'Untested':'Pending';
 const inline=extras.length===1&&extras[0].id==='PSI';
 const cards=extras.map(extra=>{
  const score=value(extra),known=Object.hasOwn(state.character.stats,extra.id);
  return '<button type="button" class="stat stat-extra'+(known?'':' stat-pending')+'" data-optional-stat="'+esc(extra.id)+'" data-opening-help="extras" aria-haspopup="dialog" aria-controls="opening-help-dialog" aria-label="'+esc(extra.name)+': '+esc(score)+'. About optional characteristics"><span class="code">'+esc(extra.id)+'</span><strong>'+esc(score)+'</strong><span>'+esc(extra.name)+'</span><span>'+(known?'About this score':extra.id==='LCK'&&state.config.flatLuck?'6 after Keep (house rule)':'After Keep')+' <span aria-hidden="true">ⓘ</span></span></button>';
 }).join('');
 const addition=inline?cards:'<div class="statistics-extras" role="group" aria-label="Selected additional characteristics">'+cards+'</div>';
 const end=baseHtml.lastIndexOf('</div>');
 return (baseHtml.slice(0,end)+addition+baseHtml.slice(end)).replace(/class="stats([^"]*)"/,'class="stats$1 '+(inline?'statistics-psi-inline':'statistics-with-extras')+'"');
}
export function statisticsSummaryView(state,{esc}){
 const total=state.pool.length?esc(state.rollTotal):'—';
 const availability=state.config.gm?'GM rerolls enabled.':state.config.minimumReroll?'Reroll below this total.':'Minimum-total rerolls are off.';
 return '<div class="statistics-summary"><p class="total">Raw total: <strong class="statistics-total-value">'+total+'</strong></p><p class="help">Reroll threshold: '+esc(state.statisticsRerollThreshold)+'. <span>'+availability+'</span></p><p class="statistics-total-help">Species modifiers and extra characteristics are excluded.'+(state.config.aezorghTwoDice?' The total is checked before placement and halving.':'')+'</p></div>';
}
export function statisticsControlsView(state,controls,{esc}){
 const summary='<summary><span>GM Controls</span><small>Setup: '+esc(state.config.boons)+' boon rolls · Corrections '+(state.config.gm?'on':'off')+'</small></summary><p class="tiny statistics-boon-setting">Boon rolls: '+esc(state.config.boons)+' of six. This setup choice applies before placement; it does not change an already-rolled set.</p>';
 return '<div id="statistics-gm-controls">'+controls.replace('<summary>GM result controls</summary>',summary)+'</div>';
}

// Keep roll feedback brief here; the existing read-only log popup retains every roll.
export function statisticsRollFeedback(event,state){
 if(state?.stage!=='statistics'||event?.type!=='roll-statistics')return null;
 return event.summary?.startsWith('Rerolled statistics')?'Six characteristics rerolled.':'Six characteristics rolled.';
}
export function statisticsRollFeedbackView(event,state,{esc}){
 const text=statisticsRollFeedback(event,state);if(!text)return null;
 return '<section id="last-action-result" class="statistics-roll-feedback" data-result-status="info" aria-label="Latest result"><p>'+esc(text)+'</p><button type="button" class="quiet" data-action="statistics-roll-details" aria-haspopup="dialog" aria-controls="simple-action-log"><span aria-hidden="true">i</span> Roll details</button></section>';
}
