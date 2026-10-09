import assert from 'node:assert/strict';

export async function worldReadability(page,{oneLineFacts=false}={}){
 const result=await page.locator('.world-screen.world-info').evaluate(screen=>{
  const box=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
  const selectors=['.screen-source','.world-facts dt','.world-facts dd','.screen-uwp th','.screen-uwp td','.screen-override','.world-actions .help','.world-actions button','.map-key li>span','.map-key .help','.map-key h3>span','.screen-footer'];
  const text=selectors.flatMap(selector=>[...screen.querySelectorAll(selector)].map(el=>{
   const range=document.createRange();range.selectNodeContents(el);
   const rects=[...range.getClientRects()].filter(r=>r.width&&r.height).map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}));
   return {selector,text:el.textContent,font:parseFloat(getComputedStyle(el).fontSize),overflow:el.scrollWidth-el.clientWidth,box:box(el),rects};
  }));
  return {viewport:innerWidth,screen:box(screen),text,nameFont:parseFloat(getComputedStyle(screen.querySelector('.screen-title strong')).fontSize),uwpFont:parseFloat(getComputedStyle(screen.querySelector('.screen-section-heading>.mono')).fontSize),overflow:document.documentElement.scrollWidth-innerWidth};
 });
 assert.equal(result.nameFont,result.viewport<=620?24:28,'Selected-world name size is unchanged');
 assert.equal(result.uwpFont,result.viewport<=620?18:20,'The existing UWP heading size is unchanged');
 assert.ok(result.overflow<=1,'The larger readout adds no page overflow');
 for(const text of result.text){
  const diagnostic=JSON.stringify(text);
  assert.ok(text.font>=14,'Small World Data text is at least 14px: '+diagnostic);
  assert.ok(text.overflow<=1,'Text stays within its own readout cell: '+diagnostic);
  assert.ok(text.rects.every(r=>r.left>=text.box.left-1&&r.right<=text.box.right+1),'All text remains visible within its cell: '+diagnostic);
  if(oneLineFacts&&['.world-facts dt','.world-facts dd'].includes(text.selector))assert.ok(new Set(text.rects.map(r=>Math.round(r.top))).size<=1,'Ordinary desktop facts do not gain unnecessary wrapping: '+diagnostic);
 }
 return result;
}

export async function resourceBarGeometry(page){
 const result=await page.locator('#summary').evaluate(summary=>{
  const box=el=>{if(!el)return null;const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
  const counter=selector=>{const el=summary.querySelector(selector),progress=el.querySelector('progress');return {box:box(el),label:box(el.querySelector('.label')),value:box(el.querySelector('.value')),note:box(el.querySelector('.help')),bar:box(progress),max:progress?.max,fill:progress?.value};};
  return {viewport:innerWidth,box:box(summary),fuel:counter('.fuel-counter'),support:counter('.life-support-counter'),overflow:summary.scrollWidth-summary.clientWidth};
 });
 assert.ok(result.overflow<=1,'Summary tracks fit the viewport');
 assert.ok(result.fuel.bar&&result.support.bar,'Both configured resource counters retain their progress indicators');
 for(const [name,counter]of [['fuel',result.fuel],['support',result.support]]){
  if(!counter.bar)continue;
  assert.ok(counter.bar.top>=Math.max(counter.value.bottom,counter.note?.bottom??-Infinity),'The '+name+' bar follows all wrapped text');
  assert.ok(counter.bar.bottom<=counter.box.bottom,'The '+name+' bar stays inside its counter');
 }
 if(Math.abs(result.fuel.box.top-result.support.box.top)<1&&result.fuel.bar&&result.support.bar){
  assert.ok(Math.abs(result.fuel.bar.top-result.support.bar.top)<1,'Fuel and life-support bars share a baseline when side by side');
  assert.ok(Math.abs(result.fuel.value.top-result.support.value.top)<1,'Resource values share a content-sized row even when labels wrap');
 }
 return result;
}
