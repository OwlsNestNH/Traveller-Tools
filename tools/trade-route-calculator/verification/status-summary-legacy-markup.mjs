import {floor} from '../js/amounts.mjs';
import {supportCargo,supportStock,supportDisplay} from '../js/life-support.mjs';
import {passengerShip} from '../js/passengers.mjs';
// Normalize approved presentation changes for the frozen route oracles.
// All pre-existing summary numbers and route/economic observations remain checked.
export function legacyStatusSummaryMarkup(html,state){
 // Restore only the approved whole-day text to the old display for frozen hashes.
 // Keep the precise gauge, stock, campaign and economic observations untouched.
 const remaining=state?.ship.lifeSupport?supportStock(passengerShip(state)).remainingDays:null;
 if(remaining!==null){
  const prefix='<div class="stat life-support-counter"><span class="label">Life support</span><span class="value">';
  html=html.replace(prefix+String(floor(remaining))+' days',prefix+String(Number(Number(remaining).toFixed(2)))+' days');
 }
 // Restore only the removed header label for the historical rendered hash.
 // Its exact value still comes from the observed state; frozen evidence stays intact.
 if(state&&!html.includes('Life support overflow:')){
  const ship=passengerShip(state),tons=supportStock(ship).cargoTons===null?'Unknown':supportDisplay(supportCargo(ship));
  html=html.replace(/(<div class="hold-breakdown"><p class="help">)([\s\S]*?)(<\/p>)/,(_,start,body,end)=>start+body+'<br>Life support overflow: '+tons+' t'+end);
 }
 return html.replace('class="stat cargo-counter"','class="stat"')
  .replace(/<div class="status-cargo-gauge"[^>]*>[\s\S]*?<\/div>/g,'')
  .replace(/<span class="help status-fuel-numbers">[^<]*<\/span>/g,'')
  .replace(/<div class="status-bladder-gauge">[\s\S]*?<\/div>/g,'')
  .replace(/<progress class="status-main-fuel"[^>]*aria-valuetext="(\d+) tons total aboard; \d+ of (\d+) tons in main tank; \d+ of (\d+) tons in bladders"><\/progress>/g,(_,aboard,base,bladder)=>'<progress max="'+(Number(base)+Number(bladder))+'" value="'+aboard+'" aria-label="Jump fuel aboard" aria-valuetext="'+aboard+' tons aboard of '+(Number(base)+Number(bladder))+' tons total capacity"></progress>');
}
