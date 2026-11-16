import {showOpeningInformation} from './opening-help.mjs';
import {lifeEventIdentity} from './life-event-presentation.mjs';
export function mountLifeDecisionClarity(document,projection,active){
 const state=projection.state,pending=state.pending,panel=document.getElementById('core-life-decision');
 if(!panel||pending?.kind!=='core-life-decision'||pending.decision!=='betrayal')return;
 const record=(state.character.lifeEvents??[]).find(r=>r.id===pending.lifeEventId);
 if(!record)return;
 const event=projection.log.filter(e=>active.has(e.number)).reverse().find(e=>(e.eventResults??[]).some(r=>r.table===record?.table&&r.row===record?.row));
 const outcome=event?.eventResults?.find(r=>r.table===record.table&&r.row===record.row);
 if(!outcome?.description||!Number.isFinite(outcome.roll?.total))return; // Preserve legacy/source-assisted views without recorded narrative and dice evidence.
 const speech=document.querySelector('#workspace .career-crow-speech');
 if(!speech)return; // Pre-career and other shells retain their existing narrative until separately reviewed.
 const parent=event.eventResults.find(r=>r!==outcome),identity=lifeEventIdentity(record.table,record.row),workspace=document.getElementById('workspace');
 document.getElementById('step-title').textContent=identity?.title??outcome.title;
 const source=workspace.querySelector(':scope > .source');if(source)source.textContent='Core Rulebook Update 2022 - p. '+(pending.page??46);
 workspace.querySelector('#last-action-result')?.remove();
 for(const p of workspace.querySelectorAll(':scope > p:not(.step-count):not(.source)'))p.remove();
 speech.textContent=outcome.description;
 const guidance=workspace.querySelector('.career-pilot-guidance');if(guidance)guidance.dataset.tone='information';
 for(const n of panel.querySelectorAll(':scope > h3,:scope > p'))n.remove();
 const context=document.createElement('p');context.className='life-decision-context';context.textContent=parent?parent.title+' — '+parent.description:'Your recorded life event';panel.prepend(context);
 const result=document.createElement('p');result.className='life-decision-effect';result.textContent=pending.label;context.after(result);
 const roll=document.createElement('div');roll.className='life-decision-roll';const total=document.createElement('span');total.className='recorded-total-die';total.textContent=outcome.roll.total;total.setAttribute('aria-label','Recorded Life Event total '+total.textContent);const label=document.createElement('strong');label.textContent='Life Event '+record.row;roll.append(total,label);result.before(roll);
 const info=document.createElement('button');info.type='button';info.className='opening-info-trigger';info.textContent='i';info.setAttribute('aria-label','Event details and source');info.addEventListener('click',()=>showOpeningInformation(document,{title:identity?.title??outcome.title,paragraphs:[...(parent?[parent.title+': '+parent.description]:[]),outcome.description,outcome.summary??pending.label,...(panel.querySelector('#life-relationship')?['The existing name is retained.']:[])],source:'Core Rulebook Update 2022, p. '+(pending.page??46)+'. Recorded event details; the full action log retains the underlying rolls and history.'},info));roll.append(info);
 const reason=panel.querySelector('#life-reason');if(reason){const label=reason.closest('label');label.firstChild.textContent='Decision notes (required)';reason.rows=2;reason.placeholder='Record your decision';}
 const submit=panel.querySelector('[data-action="resolve-life-event"]');if(submit){submit.textContent='Confirm choice';submit.classList.add('life-decision-confirm');}
 for(const option of panel.querySelectorAll('#life-relationship option'))option.textContent=option.textContent.replace(/ · r-[^ ]+$/,'');
 if(!document.getElementById('life-decision-clarity-style')){const style=document.createElement('style');style.id='life-decision-clarity-style';style.textContent='.life-decision-context{font-size:18px;line-height:1.5}.life-decision-effect{font-size:22px;font-weight:700;line-height:1.4}.life-decision-roll{display:flex;align-items:center;gap:16px;margin:18px 0}.life-decision-roll .recorded-total-die{font-size:36px;color:#ffd43b;border:3px solid #ffd43b;border-radius:12px;padding:8px 16px}.life-decision-roll .opening-info-trigger{margin-left:auto}#core-life-decision .actions{display:block}#core-life-decision .life-decision-confirm{width:100%;min-height:64px;font-size:24px}';document.head.append(style);}
}
