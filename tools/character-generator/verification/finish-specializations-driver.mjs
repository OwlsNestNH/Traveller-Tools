// Exercise the same finalization controls as a user; never mutate the saved character.
export async function finishWithSpecializations(page){
 for(let i=0;i<40;i++){
  await page.waitForFunction(()=>!document.querySelector('#new').disabled);
  if(await page.getByRole('heading',{name:'Your Traveller is ready to review',exact:true}).count())return;
  if(await page.locator('#award-skill').count()){
   const base=await page.locator('#award-base').inputValue();
   const names=await page.locator('#award-speciality option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean));
   const name=names.find(n=>n.includes(' ('))??(['Science','Language','Profession'].includes(base)?base+' (fixture subject '+i+')':null);
   if(!name)throw Error('No eligible specialty for pending '+base+' award');
   await page.locator('#award-skill').fill(name);await page.locator('[data-action=choose-skill]').click();
  }else await page.getByRole('button',{name:'Finish character',exact:true}).click();
 }
 throw Error('Finalization did not resolve within 40 UI actions');
}
