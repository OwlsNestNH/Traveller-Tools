import {aslanFamilyDie} from './aslan-family-popup.mjs';
const characteristics=['STR','DEX','END','INT','EDU','SOC'];
export function aslanRitePopupModel(state){
 if(!state.currentAslanOrigin?.familyPresentation)return null;
 const equipment=state.aslanEventOutcome?.kind==='rite-equipment';
 if(!['aslan-rite','aslan-rite-result'].includes(state.stage)&&!equipment)return null;
 return {rite:state.currentAslanOrigin.rite,stats:state.character.stats,gender:state.currentAslanOrigin.gender.value,creditRecorded:state.character.equipmentCredits?.some(c=>c.origin==='aslan-rite-2+2'),equipment};
}
export function riteTagKey(rite){return !rite?null:rite.dice[0]!==rite.dice[1]?'rite:ordinary':'rite:'+({2:'shares',4:'reward',6:'contact',8:'rival',10:'scar',12:'endurance'}[rite.total]);}
export function riteEventSummary(model){
 const r=model.rite;if(!r)return '';if(r.dice[0]!==r.dice[1])return 'No doubles. These dice do not trigger an additional rite event.';
 switch(r.total){
 case 2:return 'Double 1: '+(r.additionalRolls?.[0]?.total??'Recorded')+' Clan Shares awarded. The source-required quantity die is shown below.';
 case 4:return model.gender==='female'?'Double 2: Cr5000 cash awarded.':model.equipment?'Double 2: record Cr5000 of restricted credit for art, armour or weapons. It is not cash.':!model.creditRecorded?'Double 2: resolved by a recorded referee ruling. See the Full Log for its specific effects.':'Double 2: Cr5000 restricted equipment credit recorded for art, armour or weapons. Choose items at finalization; it is not cash.';
 case 6:return 'Double 3: a Contact has been recorded.';
 case 8:return 'Double 4: a Rival has been recorded.';
 case 10:return 'Double 5: a distinctive rite scar has been recorded.';
 case 12:return 'Double 6: END increased by 1, after calculating RITE.';
 default:return '';
 }
}
function riteInformation(model,esc){
 const r=model.rite,stats=r?.statsBefore??model.stats;
 const comparisons=r?'<ul class="rite-comparisons">'+characteristics.map(k=>{const n=stats[k],counts=n>r.total;return '<li data-counts="'+counts+'"><strong>'+k+' '+esc(n)+'</strong><span>'+esc(n)+' '+(counts?'&gt;':n===r.total?'=':'&lt;')+' '+esc(r.total)+' · '+(counts?'+1 RITE':'No count')+'</span></li>';}).join('')+'</ul>':'<ul class="rite-starting-stats">'+characteristics.map(k=>'<li><span>'+k+'</span><strong>'+esc(stats[k])+'</strong></li>').join('')+'</ul>';
 return '<dialog id="aslan-rite-info" aria-labelledby="aslan-rite-info-title"><div class="info-heading"><h2 id="aslan-rite-info-title">What the rite means</h2><button type="button" id="aslan-rite-info-close" aria-label="Close Rite of Passage information">×</button></div><p>The Rite of Passage marks your place among Aslan adults.</p><p>Your RITE modifier is used directly for checks that call for RITE. It is not converted to an ordinary characteristic modifier.</p><p>After the rite, review pre-career education or go straight to careers. Neither is chosen automatically.</p><p>AoCS1 Update 2026, pp. 20–21.</p></dialog><dialog id="aslan-rite-calculation-info" aria-labelledby="aslan-rite-calculation-title"><div class="info-heading"><h2 id="aslan-rite-calculation-title">'+(r?'Your RITE calculation':'How RITE works')+'</h2><button type="button" id="aslan-rite-calculation-close" aria-label="Close RITE calculation information">×</button></div><p>Add the two dice. Count each of STR, DEX, END, INT, EDU and SOC that is <strong>greater than the total</strong>. Equal does not count. Use the scores before any rite event changes them.</p>'+(r?'<p><strong>'+r.dice.map(esc).join(' + ')+' = '+esc(r.total)+' · RITE +'+esc(r.modifier)+'</strong></p>':'<p>Your characteristics before the rite:</p>')+comparisons+'<h3>Matching dice</h3><p>Doubles also trigger a rite event, resolved after calculating RITE. Double 1 adds a Clan Share quantity die.</p><p>Your actual dice, event and any required choice stay on the main screen.</p><p>AoCS1 Update 2026, p. 21.</p></dialog>';
}
export function aslanRitePopupView(model,{esc}){
 const {rite:r}=model;
 const ready='<div class="aslan-family-ready"><div class="rite-dice">'+aslanFamilyDie()+aslanFamilyDie()+'</div><h3>Take your place among the adults.</h3><p class="rite-instruction">Roll 2D to discover your RITE modifier.</p><button type="button" id="aslan-family-roll" aria-label="Roll 2D for the Rite of Passage">Roll 2D</button><p class="aslan-family-hint">Your dice and result will appear here.</p></div><p class="rite-boundary-note">Doubles may add an event or a quantity die.</p>';
 const result=r?'<div class="rite-result-roll"><div class="rite-dice">'+r.dice.map(aslanFamilyDie).join('')+'</div><div><span class="rite-roll-label">Rite roll · 2D</span><strong>'+r.dice.map(esc).join(' + ')+' = '+esc(r.total)+'</strong></div></div><div class="rite-result-card"><div><p class="rite-result-label">Your Rite of Passage modifier</p><h3 class="rite-result-name">RITE +'+esc(r.modifier)+'</h3></div><p class="rite-result-explanation">'+esc(r.modifier)+' of 6 characteristics are greater than '+esc(r.total)+'.</p></div><p class="rite-event">'+esc(riteEventSummary(model))+'</p>'+(r.additionalRolls??[]).map(roll=>'<div class="rite-extra-roll"><span>'+esc(roll.label)+'</span><div class="rite-dice">'+roll.values.map(aslanFamilyDie).join('')+'</div><strong>'+roll.values.map(esc).join(' + ')+' = '+esc(roll.total)+'</strong></div>').join('')+(model.equipment?'<button type="button" data-action="aslan-source-review" class="rite-source-review">Review exceptional source outcome</button>':'')+(model.tagline?'<p class="aslan-family-tagline">'+esc(model.tagline)+'</p>':'')+(!model.equipment?'<p class="rite-next">Next: pre-career choices.</p>':''):'';
 return '<dialog id="aslan-family-dialog" class="aslan-family-dialog aslan-rite-dialog" aria-labelledby="aslan-family-title"><p class="aslan-family-eyebrow">RITE OF PASSAGE · '+(r?'YOUR RESULT':'ROLL 2D')+'</p><div class="rite-title-row"><h2 id="aslan-family-title" tabindex="-1">Your Rite of Passage</h2><button type="button" id="aslan-rite-info-open" aria-label="What the Rite of Passage means" aria-haspopup="dialog" aria-controls="aslan-rite-info">i</button></div><p class="aslan-family-band">Aslan · Background skills complete</p><div class="rite-help-row"><span>'+(r?'How this result was calculated':'How RITE works')+'</span><button type="button" id="aslan-rite-calculation-open" aria-label="How RITE is calculated and how doubles work" aria-haspopup="dialog" aria-controls="aslan-rite-calculation-info">i</button></div>'+(r?result:ready)+'<footer><p>AoCS1 Update 2026, pp. 20–21</p>'+(r?'<button type="button" id="aslan-family-continue">'+(model.equipment?'Record restricted credit':'Continue to pre-career')+' <span aria-hidden="true">→</span></button>':'')+'</footer><p id="aslan-family-error" role="alert"></p></dialog>'+riteInformation(model,esc);
}
export function mountAslanRiteInformation(root){
 for(const [dialogId,openId,closeId] of [['aslan-rite-info','aslan-rite-info-open','aslan-rite-info-close'],['aslan-rite-calculation-info','aslan-rite-calculation-open','aslan-rite-calculation-close']]){
  const info=root.querySelector('#'+dialogId),button=root.querySelector('#'+openId);if(!info||!button)continue;
  button.addEventListener('click',()=>{info.showModal();info.scrollTop=0;});root.querySelector('#'+closeId).addEventListener('click',()=>info.close());info.addEventListener('close',()=>button.focus({preventScroll:true}));
 }
}
