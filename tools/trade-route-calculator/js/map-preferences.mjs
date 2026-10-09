// View preference only: never part of a campaign save, import or reset.
export const POLITICAL_TERRITORY_KEY='traveller-trade-route-calculator:political-territory:v1';

export function readPoliticalTerritory(){
 try{return localStorage.getItem(POLITICAL_TERRITORY_KEY)!=='false';}
 catch{return true;}
}

export function savePoliticalTerritory(enabled){
 try{localStorage.setItem(POLITICAL_TERRITORY_KEY,String(enabled));}
 catch{/* Optional persistence must not prevent changing the current view. */}
}
