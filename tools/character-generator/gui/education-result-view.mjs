import {crowSpeakingPanel} from './crow-speaking-panel.mjs';
// Pure presentation. The caller supplies verified recorded results and benefits.
// No rule imports, random selection, state transitions, or fabricated dice.
const outlines={
 bonusStar:'<path d="m40 10 9 19 21 3-15 15 4 21-19-10-19 10 4-21-15-15 21-3Z M7 13l8 6 M3 36h11 M67 17l8-7 M68 37h10"/>',
 militaryCap:'<path d="M12 44C-2 26 21 13 40 12c19 1 42 14 28 32l-8 7H20Z M20 45c13-5 27-5 40 0v17c-12 8-28 8-40 0Z M20 53c14-4 26-4 40 0"/><path d="m40 21 4 7 8 1-6 5 1 8-7-4-7 4 1-8-6-5 8-1Z"/>',
 cap:'<path d="M7 25 40 11 73 25 40 40Z M20 33v19c10 10 30 10 40 0V33 M69 29v27 M66 56h6l2 9H64Z"/>',
 book:'<path d="M8 20c12-7 22-7 32 1 10-8 20-8 32-1v43c-12-7-22-7-32 1-10-8-20-8-32-1Z M40 21v43 M17 29c5-2 10-2 15 1 M17 38c5-2 10-2 15 1 M17 47c5-2 10-2 15 1 M48 30c5-3 10-3 15-1 M48 39c5-3 10-3 15-1 M48 48c5-3 10-3 15-1 M14 11l-4-6 M31 8V2 M60 10l5-6"/>',
 success:'<rect x="14" y="14" width="52" height="52" rx="15"/><path d="m25 40 10 11 22-26 M8 22l-6-3 M8 40H1 M10 58l-7 4 M72 22l6-3 M72 40h7 M70 58l7 4"/>',
 failure:'<circle cx="40" cy="40" r="28"/><path d="m29 29 22 22 M51 29 29 51"/>',
 honours:'<path d="m40 7 9 4 10 1 5 9 7 8-2 11 1 10-8 8-6 9-11-1-10 3-8-7-10-4-2-11-4-9 5-10 2-10 11-3Z M27 62l-7 16 16-5 5 6 5-16 M51 63l8 15 2-10 13 2-13-17"/><path d="m40 20 6 12 13 2-10 9 3 13-12-7-12 7 3-13-10-9 13-2Z"/>'
};
const icon=(name,extra='')=>'<svg class="education-result-art '+extra+'" viewBox="0 0 80 80" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round">'+outlines[name]+'</g></svg>';
export const educationPresentationIcon=(name)=>Object.hasOwn(outlines,name)?icon(name):'';
const pipPositions={1:[[40,40]],2:[[22,22],[58,58]],3:[[22,58],[40,40],[58,22]],4:[[22,22],[58,22],[22,58],[58,58]],5:[[22,22],[58,22],[40,40],[22,58],[58,58]],6:[[22,20],[58,20],[22,40],[58,40],[22,60],[58,60]]};
function die(value){return '<svg class="education-result-die" viewBox="0 0 80 80" aria-hidden="true"><rect x="4" y="4" width="72" height="72" rx="13" fill="none" stroke="currentColor" stroke-width="4"/>'+pipPositions[value].map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="6.5" fill="currentColor"/>').join('')+'</svg>';}
const rows=(lines,esc)=>'<ul>'+lines.map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul>';

export function educationResultView(model,{esc,button,sourceLabel,studyHtml=''}={}){
 if(!model||!['admission','graduation'].includes(model.kind)||!['success','honours','failure'].includes(model.outcome))return '';
 const dice=model.dice;
 // Refuse source-pending or incomplete evidence rather than inventing a result.
 if(!Array.isArray(dice)||dice.length!==2||dice.some(d=>!Number.isInteger(d)||d<1||d>6)||!Number.isInteger(model.modifier)||!Number.isInteger(model.target)||model.total!==dice[0]+dice[1]+model.modifier)return '';
 const graduation=model.kind==='graduation',failed=model.outcome==='failure',honours=model.outcome==='honours';
 if(!graduation&&honours)return '';
 const headline=graduation?(failed?'You didn’t graduate':honours?'Graduated with honours!':'You graduated!'):(failed?'You didn’t get in':'You’re in!');
 const status=graduation?(failed?'Did not graduate':honours?'Graduated with honours':'Graduated'):(failed?'Not admitted':'Admitted');
 const target=honours&&Number.isInteger(model.honoursTarget)?'Honours '+model.honoursTarget+'+':'Target '+model.target+'+';
 const modifier=(model.modifier<0?'− ':'+ ')+Math.abs(model.modifier);
 const diceLabel=dice.join(' + ')+' '+modifier+' = '+model.total;
 const heading='<div class="education-result-heading">'+icon('cap')+'<h3>'+esc(model.name)+' '+model.kind+'</h3></div><div class="education-result-headline">'+icon(honours?'honours':failed?'failure':'success','education-result-status')+'<h4>'+headline+'</h4></div>'+(model.tagline?crowSpeakingPanel({message:model.tagline,type:'skills',tone:failed?'failure':'success',className:'education-result-crow education-result-tagline'}):'');
 const roll='<div class="education-result-roll"><div class="education-result-equation" role="img" aria-label="'+esc(diceLabel)+'">'+die(dice[0])+'<span aria-hidden="true">+</span>'+die(dice[1])+'<span class="education-result-equation-tail" aria-hidden="true">'+modifier+' = '+esc(model.total)+'</span></div><p>Total '+esc(model.total)+' · '+esc(target)+' · '+status+'</p></div>';
 const details=(model.details??[]).length?'<div class="education-result-details">'+rows(model.details,esc)+'</div>':'';
 let panel='';
 if(graduation||!model.study&&(model.benefits??[]).length){
  const benefits=model.benefits??[],retained=model.retained??[],missed=model.missed??[];
  const changes=model.actualAwardChanges??[],awardRows=(changes.some(c=>c.path.startsWith('skills.'))?1:0)+changes.filter(c=>!c.path.startsWith('skills.')).length;
  const bonuses=honours&&model.id==='core.university'&&Array.isArray(model.honoursBonuses)?model.honoursBonuses:[];
  const structured=bonuses.length>0&&bonuses.every(b=>['qualification','commission'].includes(b.kind)&&benefits.includes(b.text));
  const benefitRows=honours&&model.id==='core.university'&&(awardRows||structured)?'<ul>'+benefits.map((line,index)=>'<li'+(structured&&bonuses.some(b=>b.text===line)?' class="education-honours-canonical-bonus"':index===awardRows?' class="education-honours-rights-start"':'')+'>'+esc(line)+'</li>').join('')+'</ul>':rows(benefits,esc);
  const mobileBonuses=structured?'<section class="education-mobile-honours" aria-label="Honours bonuses"><h5>Honours bonuses</h5>'+bonuses.map(b=>'<div class="education-mobile-bonus-row">'+icon(b.kind==='qualification'?'bonusStar':'militaryCap','education-bonus-'+b.kind)+'<div><strong>'+(b.kind==='qualification'?'Qualification DM '+esc((b.modifier>=0?'+':'')+b.modifier):esc((b.modifier?(b.modifier>=0?'+':'')+b.modifier+' ':'')+b.scope+' commission'))+'</strong><p>'+(b.kind==='qualification'?'Eligible careers':(b.automatic?'Automatic':'Roll required')+' · First career')+'</p>'+(b.kind==='commission'?'<p>Before term '+esc(b.beforeTerm)+'</p>':'')+'</div></div>').join('')+'</section>':'';
  panel='<section class="education-result-benefits" aria-labelledby="education-benefits-title"><div class="education-result-benefit-art">'+icon('book')+icon(honours?'honours':failed?'failure':'success','education-result-award')+'</div><div><h4 id="education-benefits-title">'+(!graduation?'Initial education awards':failed?'Your '+esc(model.name)+' outcome':'Graduation benefits')+'</h4>'+(benefits.length?benefitRows:'')+mobileBonuses+(retained.length?'<h5>You keep</h5>'+rows(retained,esc):'')+(missed.length?'<h5>You miss</h5>'+rows(missed,esc):'')+'</div></section>';
 }
 const term=graduation&&Number.isFinite(model.years)&&Number.isInteger(model.terms)?'<p class="education-result-term">'+esc(model.years)+' years completed · '+esc(model.terms)+' education '+(model.terms===1?'term':'terms')+'</p>':'';
 studyHtml=studyHtml.replace(/<select(?: id="education-subject"| disabled)[\s\S]*?<\/select>/g,match=>'<span class="education-study-selector">'+icon('book')+match+'</span>');
 const study=model.study?'<section class="education-result-study"><h4>Choose your University skills</h4><p>Two different subjects: first at level 0, second at level 1.</p>'+studyHtml+'</section>':button('Continue <span aria-hidden="true">→</span>','acknowledge-education-result','education-result-continue');
 const source=model.source?'<p class="education-result-source">'+esc(sourceLabel(model.source.id,model.source.page))+'</p>':'';
 return '<section class="education-result" data-education-result="'+model.kind+'" data-education-outcome="'+model.outcome+'">'+heading+roll+details+panel+term+study+source+'</section>';
}

// Reuse the approved gold pip design for other recorded-result presentations.
export {die as educationResultDie};
