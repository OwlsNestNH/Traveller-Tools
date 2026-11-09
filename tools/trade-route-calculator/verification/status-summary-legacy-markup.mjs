import {floor,cmp,sub,div,mul,decimal} from '../js/amounts.mjs';
import {supportCargo,supportStock,supportDisplay} from '../js/life-support.mjs';
import {passengerShip} from '../js/passengers.mjs';
// Normalize approved presentation changes for the frozen route oracles.
// All pre-existing summary numbers and route/economic observations remain checked.
export function legacyStatusSummaryMarkup(html,state){
 // Restore only the approved whole-day text to the old display for frozen hashes.
 // Restore its matching whole-day gauge to the historical precise display only.
 // Stock, campaign and economic observations remain untouched.
 const support=state?.ship.lifeSupport?supportStock(passengerShip(state)):null,remaining=support?.remainingDays??null;
 if(remaining!==null){
  const prefix='<div class="stat life-support-counter"><span class="label">Life support</span><span class="value">';
  html=html.replace(prefix+String(floor(remaining))+' days',prefix+String(Number(Number(remaining).toFixed(2)))+' days');
  const whole=String(floor(remaining)),above=cmp(whole,support.targetDays)>0?decimal(sub(whole,support.targetDays)):'0',scale=above==='0'?support.targetDays:whole;
  const description=(state.ship.stationLifeSupport===true?'Station supply active; onboard consumption paused. ':'')+whole+' whole days onboard; '+support.targetDays+'-day target; '+above+' days above target. Scale: 0 to '+scale+' days.';
  const extra=above==='0'?'':'<span class="status-lss-above" aria-hidden="true" style="width:'+String(Number(floor(mul(div(above,scale),100000000)))/1000000)+'%"></span>';
  const expected='<div class="status-lss-gauge" title="'+description+'"><progress max="'+scale+'" value="'+whole+'" aria-label="Life support endurance against standard refill target" aria-valuetext="'+description+'"></progress>'+extra+'</div>';
  html=html.replace(expected,'<progress max="'+support.targetDays+'" value="'+remaining+'" aria-label="Life support endurance against standard refill target"></progress>');
  if(above!=='0'){const units=String(Number(Number(support.remainingUnits).toFixed(2))),target=String(Number(Number(support.targetDays).toFixed(2)));html=html.replace('<span class="help">'+units+' LSS · <span class="status-lss-target-label">'+support.targetDays+'d target</span> +<span class="status-lss-above-label">'+above+'d above</span></span>','<span class="help">'+units+' LSS aboard · '+target+'-day target</span>');}
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

// The new explicit docking switch is a separate control after the existing
// service row. Remove only that addition for frozen route UI hashes; all old
// service actions and all campaign bytes remain compared to the original.
export function legacyShipActionsMarkup(html){
 return html.replace('Advance 24 hours. Onboard LSS is used unless station life support is enabled. Undo restores the date and supplies together.','Advance 24 hours and consume life support supplies. Undo restores the date and supplies together.').replace(/<div class="station-support-control"><button[^>]*data-action="station-life-support"[^>]*>[\s\S]*?<\/button><span class="help">[^<]*<\/span><\/div>$/,'');
}
