// Use only the owner's verified Crow artwork. No substitute image is inferred.
export const CROW_ASSISTANCE_IMAGE=Object.freeze({src:'./assets/crow-pet.png',kind:'sprite'});
// Supplied artwork only. Empty costume slots fall back to the verified base pet.
export const CROW_ASSISTANCE_VARIANTS=Object.freeze({technician:'./assets/crow-technician.png',professor:'./assets/crow-professor.png',referee:'./assets/crow-referee.png'});
export function crowVariant(type){return type==='skills'?'professor':type==='referee'?'referee':'technician';}
export function crowAsset(type,variants=CROW_ASSISTANCE_VARIANTS,base=CROW_ASSISTANCE_IMAGE){return variants[crowVariant(type)]??base;}
function portrait(document,asset){
 if(!asset)return null;
 if(asset.kind==='sprite'){
  const image=document.createElement('span');image.className='crow-assistance-image crow-assistance-sprite';image.setAttribute('role','img');image.setAttribute('aria-label','Crow, your character-building assistant');image.style.backgroundImage='url("'+asset.src+'")';return image;
 }
 const image=document.createElement('img');image.className='crow-assistance-image';image.src=typeof asset==='string'?asset:asset.src;image.alt='Crow, your character-building assistant';image.width=56;image.height=56;return image;
}
export function crowAssistanceView(document,{type='generic'}={}){
 const row=document.createElement('div');row.className='crow-assistance';row.dataset.crowVariant=crowVariant(type);
 const image=portrait(document,crowAsset(type));if(image)row.append(image);
 const words=document.createElement('span');words.textContent='CROW IS ASSISTING';row.append(words);
 const button=document.createElement('button');button.type='button';button.className='crow-assistance-info';button.textContent='i';button.setAttribute('aria-label',"About Crow's assistance");button.setAttribute('aria-expanded','false');
 const help=document.createElement('p');help.className='crow-assistance-help';help.hidden=true;help.textContent='Crow points out the choice or detail needed on this screen. Your selections stay here while you finish. You make the choices, and your referee makes any required rulings.';
 button.addEventListener('click',()=>{help.hidden=!help.hidden;button.setAttribute('aria-expanded',String(!help.hidden));});row.append(button);
 return {row,help,button};
}
export const CROW_INTRODUCTION={
 title:'C.R.O.W.',expansion:'Cognitive Relay Operations Web',series:'Ling Standard Products · Intellect Series 7.4',
 role:'Here, Crow explains choices, points out unfinished steps and helps keep your Traveller’s creation moving. You make the decisions. Crow supplies the commentary.',
 history:[
  'Introduced in 1078 as the answer to overly cheerful, obedient and optimistic Intellects, C.R.O.W. combined capable assistance with dry sarcasm, selective loyalty and a tendency to question operators.',
  'Designed for ship computers, personal terminals and Agent/Expert systems. An optional shipboard Virtual Crew package was available.',
  'Discontinued in 1079 following complaints about insubordination, sarcastic diagnostics and questionable customer service. Most units were recalled or wiped. Some survived.'
 ],slogan:'Not just smart. Judgmental.'
};
export function mountCrowIntroduction(document){
 const workspace=document.querySelector('#workspace');if(!workspace||document.querySelector('#crow-introduction'))return;
 const card=document.createElement('section');card.id='crow-introduction';card.className='crow-introduction';card.setAttribute('aria-label','Crow assistance');
 const {row,help,button}=crowAssistanceView(document);help.remove();button.replaceWith(button.cloneNode(true));const opener=row.querySelector('button');opener.removeAttribute('aria-expanded');opener.setAttribute('aria-haspopup','dialog');opener.setAttribute('aria-controls','crow-introduction-dialog');
 const role=document.createElement('p');role.textContent=CROW_INTRODUCTION.role;card.append(row,role);
 const dialog=document.createElement('dialog');dialog.id='crow-introduction-dialog';dialog.className='crow-introduction-dialog';dialog.setAttribute('aria-labelledby','crow-introduction-title');
 const heading=document.createElement('h2');heading.id='crow-introduction-title';heading.tabIndex=-1;heading.textContent=CROW_INTRODUCTION.title;
 const expansion=document.createElement('p');expansion.className='crow-expansion';expansion.textContent=CROW_INTRODUCTION.expansion;
 const series=document.createElement('p');series.className='crow-series';series.textContent=CROW_INTRODUCTION.series;
 const close=document.createElement('button');close.type='button';close.className='quiet';close.textContent='Close';close.setAttribute('aria-label','Close Crow information');
 dialog.append(heading,expansion,series);for(const paragraph of CROW_INTRODUCTION.history){const p=document.createElement('p');p.textContent=paragraph;dialog.append(p);}
 const slogan=document.createElement('blockquote');slogan.textContent=CROW_INTRODUCTION.slogan;const assistance=document.createElement('p');assistance.textContent=CROW_INTRODUCTION.role;dialog.append(slogan,assistance,close);
 opener.addEventListener('click',()=>{dialog.showModal();heading.focus({preventScroll:true});dialog.scrollTop=0;});close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>opener.focus());
 workspace.prepend(card);workspace.append(dialog);
}
