import {crowSpeakingPanel} from './crow-speaking-panel.mjs';
const names={'core.university':'University','core.academy-army':'Army academy','core.academy-marine':'Marine academy','core.academy-navy':'Navy academy'};
export function educationPoliticalView(model,{esc}){
 const check=model.childRolls?.find(r=>r.check)?.check;
 const changes=(model.appliedChanges??[]).flatMap(g=>g.changes??[]);
 const roles=changes.filter(c=>c.path.startsWith('relationships.')&&!c.before&&c.after?.role).map(c=>c.after.role);
 const results=roles.length?roles.map(role=>'Gain 1 '+role+'.').join(' '):model.mode==='result'?'No Ally or Enemy gained.':'Roll SOC 8+ to see whether you become a leading figure.';
 const tone=check?(check.success?'success':'failure'):'information';
 const id=model.educationId??'core.university';
 const total=check?.total??model.eventTotal;
 const die='<svg class="aslan-family-die" viewBox="0 0 100 100" role="img" aria-label="'+esc((check?'SOC check total: ':'Event total: ')+total)+'"><rect x="3" y="3" width="94" height="94" rx="16" fill="none" stroke="currentColor" stroke-width="5"/><text x="50" y="68" text-anchor="middle" fill="currentColor" font-size="52" font-weight="800">'+esc(total)+'</text></svg>';
 const fields=(model.relationships??[]).map(r=>'<label class="education-relationship-name">'+esc(r.role)+' name<input maxlength="120" data-education-relationship="'+esc(r.id)+'" data-legacy-political="'+!!model.legacy+'" data-pending-id="'+esc(model.pendingId)+'" value="'+esc(r.name?.startsWith('Unnamed ')?'':r.name)+'" placeholder="Optional name"></label>').join('');
 const control=model.mode==='roll'?'<button type="button" class="education-event-roll" data-action="roll-education-event-step" data-pending-id="'+esc(model.pendingId)+'">Roll SOC check</button>':'<button type="button" class="education-event-roll" data-action="'+(model.legacy?'acknowledge-legacy-political-event':'acknowledge-education-event')+'" data-pending-id="'+esc(model.pendingId)+'">Continue to graduation</button>';
 return '<section class="education-war-draft education-political-result"><p class="education-war-context">'+esc(names[id])+' · Event 8</p><h3 class="education-war-outcome" data-tone="'+tone+'">'+(check?(check.success?'SUCCESS':'FAILURE'):'Political movement')+'</h3>'+crowSpeakingPanel({message:'You become active in a political movement. '+results,type:id==='core.academy-navy'?'navy':id.includes('academy')?'military':'skills',tone})+'<div class="education-recorded-dice">'+die+'</div><p class="education-war-equation">'+(check?'SOC check: '+esc(check.total)+' · Target 8+':'Event total: 8')+'</p>'+fields+control+'</section>';
}
