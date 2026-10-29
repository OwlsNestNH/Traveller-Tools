// Real UI navigation for controls moved from the old scrolling station pane.
export async function closeStation(page){if(await page.locator('#station-control-popup').isVisible())await page.locator('#station-control-popup [data-close-console]').click();}
export async function openStation(page,role='pilot'){
 if(await page.locator('#station-control-popup').isVisible()&&await page.locator('#station-pane').getAttribute('data-station')===role)return;
 await closeStation(page);if(role==='pilot'&&await page.locator('[data-console-pilot]').isVisible()){await page.locator('[data-console-pilot]').click();return;}const mobile=page.viewportSize().width<701||await page.locator('body').evaluate(e=>e.classList.contains('map-expanded'));
 if(mobile&&!await page.locator('.mobile-stations').evaluate(e=>e.open))await page.locator('.mobile-stations summary').click();
 const node=page.locator((mobile?'.mobile-stations ':'.station-regions ')+'[data-console-station="'+role+'"]');await node.focus();await page.keyboard.press('Enter');await page.locator('#station-control-popup').waitFor({state:'visible'});
}
export const openPilot=page=>openStation(page,'pilot');
export async function advanceMovement(page){await openPilot(page);await page.locator('[data-pilot-commit=advance]').click();await closeStation(page);}
export async function workflowAction(page,action){await closeStation(page);const button=page.locator('[data-workflow="'+action+'"]');if(!await button.isVisible())await page.locator('[data-console-more]').click();await button.click();}
export async function openWorkflowInfo(page){await closeStation(page);if(!await page.locator('#workflow-more').isVisible())await page.locator('[data-console-more]').click();}
