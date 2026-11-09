import {readFile} from 'node:fs/promises';
export async function downloadedActionLog(page){
 const downloading=page.waitForEvent('download');
 await page.locator('#log-download').click();
 const download=await downloading;
 if(download.suggestedFilename()!=='traveller-action-log.txt')throw Error('Unexpected troubleshooting log filename');
 return readFile(await download.path(),'utf8');
}
