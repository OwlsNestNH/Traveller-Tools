import {pendingSkillAwardSource,skillAwardSource} from './skill-award-provenance.mjs';

// Only replay-observed pending rank awards open this chooser. Rank, skill names
// and academy history alone never establish an entitlement.
export function rankAwardPopupView(state,presentation,catalog,controls,{esc,readOnly=false}){
 const origin=presentation?.pending;
 if(readOnly||state.stage!=='skill-choice'||origin?.kind!=='rank'||!skillAwardSource(origin,catalog))return null;
 const career=catalog.careers.find(c=>c.id===origin.careerId).name;
 const identity=[career,origin.title,'Rank '+origin.rank].filter(Boolean).join(' • ');
 return '<button type="button" data-open-rank-award aria-haspopup="dialog" aria-controls="rank-award-dialog">Choose rank award</button><dialog id="rank-award-dialog" class="rank-award-dialog" aria-labelledby="rank-award-title"><div class="rank-award-heading"><h2 id="rank-award-title" tabindex="-1">Rank Award</h2><button type="button" class="quiet" data-close-rank-award>Close</button></div><p class="rank-award-identity">'+esc(identity)+'</p>'+pendingSkillAwardSource(presentation,state,catalog,{esc})+controls+'</dialog>';
}
export function mountRankAwardPopup(document,{readOnly=false}={}){
 const dialog=document.getElementById('rank-award-dialog'),trigger=document.querySelector('[data-open-rank-award]');
 if(!dialog||!trigger||readOnly)return;
 const open=()=>{if(!dialog.open){dialog.showModal();dialog.querySelector('h2').focus();}};
 const close=()=>{dialog.close();trigger.focus();};
 trigger.addEventListener('click',open);
 dialog.querySelector('[data-close-rank-award]').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 open();
}
