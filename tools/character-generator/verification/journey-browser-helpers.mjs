// Exercise the actual record/step controls; never disable or bypass the shell.
export async function openLiveRecord(page){
 const record=page.locator('#journey-record');
 if(!await record.count()||await page.evaluate(()=>matchMedia('print').matches))return;
 if(await page.locator('#journey-dialog').evaluate(el=>el.open))await page.locator('#journey-close').click();
 if(!await record.evaluate(el=>el.open))await record.locator(':scope > summary').click();
 await page.locator('#sheet').waitFor({state:'visible'});
}
export async function reopenStep(page){
 const dialog=page.locator('#journey-dialog');
 if(await dialog.count()&&!await dialog.evaluate(el=>el.open))await page.locator('#journey-reopen').click();
 await page.locator('#workspace').waitFor({state:'visible'});
}
export async function liveRecordText(page,selector='#sheet'){
 const dialog=page.locator('#journey-dialog');
 const wasOpen=await dialog.count()&&await dialog.evaluate(el=>el.open);
 const printing=await page.evaluate(()=>matchMedia('print').matches);
 await openLiveRecord(page);
 try{return await page.locator(selector).innerText();}
 finally{if(wasOpen&&!printing)await reopenStep(page);}
}
