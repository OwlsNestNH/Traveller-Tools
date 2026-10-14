// Normalize only the approved .87 presentation additions for frozen route oracles.
// All pre-existing summary numbers and route/economic observations remain checked.
export function legacyStatusSummaryMarkup(html){
 return html.replace('class="stat cargo-counter"','class="stat"')
  .replace(/<div class="status-cargo-gauge"[^>]*>[\s\S]*?<\/div>/g,'')
  .replace(/<span class="help status-fuel-numbers">[^<]*<\/span>/g,'')
  .replace(/<div class="status-bladder-gauge">[\s\S]*?<\/div>/g,'')
  .replace(/<progress class="status-main-fuel"[^>]*aria-valuetext="(\d+) tons total aboard; \d+ of (\d+) tons in main tank; \d+ of (\d+) tons in bladders"><\/progress>/g,(_,aboard,base,bladder)=>'<progress max="'+(Number(base)+Number(bladder))+'" value="'+aboard+'" aria-label="Jump fuel aboard" aria-valuetext="'+aboard+' tons aboard of '+(Number(base)+Number(bladder))+' tons total capacity"></progress>');
}
