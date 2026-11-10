// UI defaults only. Engine/API defaults and every recorded configuration remain unchanged.
export function aezorghSetupMethod(state,log=[]){
 return state.config?.aezorghTwoDice||(state.aezorghRoundUp===true&&log.length===0)?'house':'raw';
}
export function aezorghRollChoiceView(state,log,{infoButton}){
 const checked=aezorghSetupMethod(state,log)==='house';
 return '<div id="aezorgh-roll-choice" class="opening-aezorgh-check" hidden><div class="opening-label-help">'+infoButton('aezorgh')+'<label class="check" for="setup-aezorgh-method"><input id="setup-aezorgh-method" name="aezorghTwoDice" type="checkbox"'+(checked?' checked':'')+' disabled><span>Aezorgh: use 2D6 ÷ 2 for Stats</span></label></div></div>';
}
