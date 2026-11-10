// UI defaults only. Engine/API defaults and every recorded configuration remain unchanged.
export function aezorghSetupMethod(state,log=[]){
 return state.config?.aezorghTwoDice||(state.aezorghRoundUp===true&&log.length===0)?'house':'raw';
}
function methodSummary(method,roundUp){return method==='raw'?'Published mixed 1D / 2D.':roundUp?'2D6 ÷ 2 · default for new Aezorgh.':'2D6 ÷ 2 · historical round-down rules.';}
export function aezorghRollChoiceView(state,log,{esc,infoButton}){
 const method=aezorghSetupMethod(state,log),house=state.aezorghRoundUp?'House · round up':'House · round down';
 return '<div id="aezorgh-roll-choice" class="opening-info-field" hidden><div class="opening-label-help">'+infoButton('aezorgh')+'<label for="setup-aezorgh-method">Aezorgh stat rolls</label></div><select id="setup-aezorgh-method" name="aezorghTwoDice" aria-describedby="aezorgh-method-summary" data-round-up="'+!!state.aezorghRoundUp+'" disabled><option value="house"'+(method==='house'?' selected':'')+'>'+esc(house)+'</option><option value="raw"'+(method==='raw'?' selected':'')+'>RAW · mixed dice</option></select><small id="aezorgh-method-summary" aria-live="polite">'+methodSummary(method,!!state.aezorghRoundUp)+'</small></div>';
}
export function syncAezorghMethodSummary(form){
 const select=form.elements.aezorghTwoDice,summary=form.querySelector('#aezorgh-method-summary');
 if(summary)summary.textContent=methodSummary(select.value,select.dataset.roundUp==='true');
}
