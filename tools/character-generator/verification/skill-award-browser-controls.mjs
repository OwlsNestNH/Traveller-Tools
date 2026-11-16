// Exercise fixed-base or multiple-base controls. Unlisted base injection is explicit and
// restricted to existing backend-rejection tests, never normal user routes.
export async function selectAwardSkill(page,name,{allowUnlisted=false}={}){
 const base=name.split(' (')[0],selector=page.locator('#award-base');await selector.waitFor({state:'attached'});
 if(await selector.getAttribute('type')==='hidden'){
  if(await selector.inputValue()!==base){if(!allowUnlisted)throw new Error('Skill base not offered: '+base);await selector.evaluate((n,base)=>{n.value=base;n.dispatchEvent(new Event('change',{bubbles:true}));},base);}
 }else{
 const present=await selector.locator('option').evaluateAll((ns,base)=>ns.some(n=>n.value===base),base);
 if(!present){if(!allowUnlisted)throw new Error('Skill base not offered: '+base);await selector.evaluate((n,base)=>n.add(new Option(base,base)),base);}
 await selector.selectOption(base);
 }
 const speciality=page.locator('#award-speciality');if(!await speciality.count())return;
 const exact=await speciality.locator('option').evaluateAll((ns,name)=>ns.some(n=>n.value===name),name);
 if(exact){await speciality.selectOption(name);return;}
 await speciality.selectOption('__custom__');
 const subject=name.startsWith(base+' (')&&name.endsWith(')')?name.slice(base.length+2,-1):name;
 await page.locator('#award-skill').fill(subject);
}
