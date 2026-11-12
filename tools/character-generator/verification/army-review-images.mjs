// Numbered, synthetic review images only. Copy original screenshot bytes unchanged.
import {copyFile} from 'node:fs/promises';
export async function writeArmyReviewImages(out){
 const frames=[['career-choice','career-choice'],['application','specialty-selection'],['survival-result','support-result'],['infantry-survival-result','infantry-result'],['cavalry-survival-result','cavalry-result'],['required-skill-warning','required-choice'],['technical-failure','technical-error'],['survival-failed','survival-failure'],['rule-information','rule-information'],['rule-information-scrolled','rule-information-scrolled']];
 const images=[];
 for(const [source,label] of frames)for(const width of [1440,390]){
  const name='army-pilot-review-'+String(images.length+1).padStart(2,'0')+'-'+label+'-'+(width===1440?'desktop':'mobile')+'.png';
  await copyFile(new URL('army-pilot-'+source+'-'+width+'-'+(source==='technical-failure'?'http':'static')+'.png',out),new URL(name,out));images.push(name);
 }
 return images;
}
