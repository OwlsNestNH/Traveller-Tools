import {mountRecordBars} from './record-bars.mjs';
// Reuse the accepted Education record controls without copying editors or
// changing the current instruction, command, character data or navigation.
export const isSupportStage=stage=>['companion-admission','companion-skill','psionic-training'].includes(stage);
export function mountSupportRecord(document,state,{sessionKey=''}={}){
 const sheet=document.getElementById('sheet');if(!sheet)return;
 if(!isSupportStage(state.stage)){delete sheet.dataset.supportSession;delete sheet.dataset.openBar;return;}
 if(sheet.dataset.supportSession!==sessionKey){delete sheet.dataset.openBar;sheet.dataset.supportSession=sessionKey;}
 const nodes=[...sheet.children],stats=nodes.find(n=>n.querySelector('.stats')),skills=nodes.find(n=>n.querySelector('h3')?.textContent==='Skills'),notes=nodes.find(n=>n.id==='notes-connections'),origin=nodes.find(n=>n.matches('.aslan-origin-sheet'));
 const headers=nodes.filter(n=>n.matches('.eyebrow,h2,.sheet-meta,.sheet-facts,.physical-dice-warning')),overview=document.createElement('section');overview.className='support-record-overview';overview.append(...headers);
 const sheetButton=nodes.find(n=>n.matches('[data-action="open-current-character-sheet"]'));
 const groups=[['support-characteristics','Characteristics',stats?[stats]:[]],['support-aslan-origin','Aslan family and origin',origin?[origin]:[]],['support-skills','Skills',skills?[skills]:[]],['support-notes','Notes & connections',notes?[notes]:[]],['support-more-record','More character details',nodes.filter(n=>![stats,origin,skills,notes,sheetButton,...headers].includes(n))]];
 sheet.replaceChildren(...(sheetButton?[sheetButton]:[]),overview);mountRecordBars(document,{sheet,host:sheet,groups,notes,name:'support-record-bars'});
}
