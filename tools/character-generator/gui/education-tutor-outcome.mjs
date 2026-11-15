import{currentEducationEvent}from'./current-education-event.mjs';
import{aslanFamilyDie}from'./aslan-family-popup.mjs';
import{recordedTotalDie}from'./recorded-total-die.mjs';
// Read the accepted check, never recalculate it from a subsequently changed skill.
export function educationTutorOutcome(projection,session){
 const state=projection?.state,record=state?.character?.educations?.[state.education];if(record?.event!==10||!record.checkedSkill)return null;
 const event=currentEducationEvent(projection,session),m=event?.summary.match(/Education (.+) check (-?\d+) against (\d+)\.$/),roll=event?.rolls?.find(r=>r.label==='Education skill check: '+record.checkedSkill);
 if(!m||m[1]!==record.checkedSkill||!roll||!Number.isFinite(roll.total))return null;
 const total=Number(m[2]),target=Number(m[3]),faces=roll.values;
 const known=Array.isArray(faces)&&faces.length===2&&faces.every(n=>Number.isInteger(n)&&n>=1&&n<=6)&&faces.reduce((a,b)=>a+b,0)===roll.total;
 return {name:record.checkedSkill,total,target,natural:roll.total,modifier:total-roll.total,success:total>=target,faces:known?faces:null};
}
export function educationTutorOutcomeView(model,{esc}){
 if(!model)return '';
 return '<section class="education-current-event-dice education-tutor-check-result" aria-label="Recorded study challenge"><h4>Study challenge · '+(model.success?'Success':'Failure')+'</h4><div class="education-recorded-dice">'+(model.faces?model.faces.map(n=>'<span data-study-face="'+n+'">'+aslanFamilyDie(n)+'</span>').join(''):recordedTotalDie(model.natural,{esc}))+'</div><p>'+esc(model.name)+' · Raw '+esc(model.natural)+' '+(model.modifier<0?'− '+Math.abs(model.modifier):'+ '+model.modifier)+' = <strong>'+esc(model.total)+'</strong> · Target '+esc(model.target)+'+</p></section>';
}
