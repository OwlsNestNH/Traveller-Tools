import {effectiveDesign} from './setup.mjs';
export const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const shown=value=>value==null?'Unknown':String(value);
export const signed=value=>value==null?'Unassigned':(value>=0?'+':'')+value;
export const classLabel=ship=>effectiveDesign(ship)?.record?.className??effectiveDesign(ship)?.name??'Synthetic / unclassified';
export const sourceLabel=t=>t?.source?`${t.source.book}, printed p${t.source.endPage?'p':''}. ${t.source.page}${t.source.endPage?'–'+t.source.endPage:''}`:'Custom / synthetic: no verified book source';
