// Presentation-only flavor, selected without touching game dice or random state.
export const ASLAN_ORIGIN_TAGLINES=Object.freeze(Object.fromEntries(Object.entries({
 'first-son':['The first son gets the opening paragraph.','Your place in the family list is easy to find.','The sons’ introductions begin with you.','First in this list; plenty of story still ahead.','The family chronology starts your section early.','An early entry in a long family story.'],
 'second-son':['The sons’ chapter had already begun.','Another name made the family list more interesting.','Not the opening paragraph, but a chapter of your own.','The family story had room for another son.','Your introduction follows an earlier one.','Later in the list, with your own story to tell.'],
 daughter:['Your chapter needs no numbered introduction.','The family story has room for your own voice.','A daughter’s introduction can stand on its own.','The family album has a page with your name on it.','Your place in the story comes without a numbered queue.','A familiar name, an unwritten next chapter.'],
 estate:['The family estate gets a paragraph of its own.','There is a little more family history on the map.','The family’s landholding comes with a longer description.','The family estate is part of the backdrop to your story.','A family map makes an interesting conversation piece.','The family’s estate adds another page to the album.'],
 'no-estate':['The estate section keeps its introduction brief.','No estate entry; plenty of family story.','This page leaves the property tour for another time.','The family introduction continues without an estate entry.','A family story does not need an estate appendix.','The estate column is quiet; the story carries on.'],
}).map(([key,lines])=>[key,Object.freeze(lines)])));
export function originTagline(key,actionId=''){
 if(!Object.hasOwn(ASLAN_ORIGIN_TAGLINES,key))return '';
 let hash=0x811c9dc5;for(const char of JSON.stringify([key,String(actionId)]))hash=Math.imul(hash^char.charCodeAt(0),0x01000193)>>>0;
 return ASLAN_ORIGIN_TAGLINES[key][hash%6];
}
