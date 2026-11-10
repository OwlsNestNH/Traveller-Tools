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
 if(state.character.species==='aezorgh')inherent.add('CHA');
 return catalog.extraStats.filter(extra=>selected.has(extra.id)&&!inherent.has(extra.id));
}
export function statisticsCardsView(state,catalog,baseHtml,{esc,infoButton}){
 const extras=selectedOptionalStatistics(state,catalog);
 if(!extras.length)return baseHtml;
 const value=extra=>Object.hasOwn(state.character.stats,extra.id)?state.character.stats[extra.id]:extra.id==='PSI'?'Untested':'Pending';
 if(extras.length===1&&extras[0].id==='PSI'){
  const score=value(extras[0]),known=Object.hasOwn(state.character.stats,'PSI');
  const card='<button type="button" class="stat stat-extra" data-optional-stat="PSI" data-opening-help="extras" aria-haspopup="dialog" aria-controls="opening-help-dialog" aria-label="PSI: '+esc(score)+'. About optional characteristics"><span class="code">PSI</span><strong>'+esc(score)+'</strong><span>Psionic strength</span><span>'+(known?'About this score':'After Keep')+' <span aria-hidden="true">ⓘ</span></span></button>';
  const end=baseHtml.lastIndexOf('</div>');
  return (baseHtml.slice(0,end)+card+baseHtml.slice(end)).replace(/class="stats([^"]*)"/,'class="stats$1 statistics-psi-inline"');
 }
 return baseHtml+'<div class="statistics-extras" role="group" aria-label="Selected additional characteristics">'+infoButton('extras')+extras.map(extra=>'<span class="statistics-extra-value" data-optional-stat="'+esc(extra.id)+'" title="'+esc(extra.name)+'"><span class="code">'+esc(extra.id)+'</span><strong>'+esc(value(extra))+'</strong></span>').join('')+'<span class="statistics-extras-timing">Generated when you keep this set.</span></div>';
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
