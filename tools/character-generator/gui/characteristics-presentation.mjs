// Read-only presentation for the characteristic rolling stage. Rules stay in the engine.
const labels={STR:'Strength',DEX:'Dexterity',END:'Endurance',INT:'Intellect',EDU:'Education',SOC:'Social standing',CHA:'Charisma',PSI:'Psionic strength'};
export function emptyStatisticsView(state,catalog,{esc}){
 const species=catalog.species.find(item=>item.id===state.character.species);
 const codes=Object.keys(species?.dice??{}).slice(0,6);
 return '<div class="stats statistics-empty" aria-label="Characteristics not yet rolled">'+codes.map(code=>'<div class="stat stat-empty"><span class="code">'+esc(code)+'</span><strong aria-label="Not rolled">—</strong><span>'+esc(labels[code]??code)+'</span><span>Not rolled</span></div>').join('')+'</div>';
}
export function statisticsSummaryView(state,{esc}){
 const total=state.pool.length?esc(state.rollTotal):'—';
 const availability=state.config.gm?'GM rerolls enabled.':state.config.minimumReroll?'Reroll below this total.':'Minimum-total rerolls are off.';
 return '<div class="statistics-summary"><p class="total">Raw total: '+total+'</p><p class="help">Reroll threshold: '+esc(state.statisticsRerollThreshold)+'. <span>'+availability+'</span></p><p class="statistics-total-help">Species modifiers and extra characteristics are excluded.'+(state.config.aezorghTwoDice?' The total is checked before placement and halving.':'')+'</p></div>';
}
export function statisticsControlsView(state,controls,{esc}){
 const summary='<summary><span>GM Controls</span><small>Setup: '+esc(state.config.boons)+' boon rolls · Corrections '+(state.config.gm?'on':'off')+'</small></summary><p class="tiny statistics-boon-setting">Boon rolls: '+esc(state.config.boons)+' of six. This setup choice applies before placement; it does not change an already-rolled set.</p>';
 return '<div id="statistics-gm-controls">'+controls.replace('<summary>GM result controls</summary>',summary)+'</div>';
}
