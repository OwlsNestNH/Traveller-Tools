export function equipmentCatalogueView(p,esc){
 if(!p.catalogueItems)return '';
 return '<label>Equipment selection<select id="benefit-item-id"><option value="">Custom / other book item</option>'+p.catalogueItems.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.name)+' — TL '+i.techLevel+', Cr'+i.cost+' (Core 2022 p. '+i.source.page+')</option>').join('')+'</select></label><p class="help">This is a small verified Core catalogue, filtered for this award. Other equipment and augmentations still need your book and referee. Catalogue selection records item identity, price, TL and weapon skill only; combat effects are not automated.</p>';
}
export function syncEquipmentCatalogue(p,document){
 const item=p?.catalogueItems?.find(i=>i.id===document.querySelector('#benefit-item-id')?.value);
 for(const [id,key]of [['benefit-item-name','name'],['benefit-item-cost','cost'],['benefit-item-tl','techLevel'],['benefit-weapon-skill','weaponSkill']]){
  const input=document.getElementById(id);if(!input)continue;
  input.value=item?.[key]??'';if(input.tagName==='SELECT')input.disabled=!!item;else input.readOnly=!!item;
 }
 const confirmed=document.getElementById('book-confirm');if(confirmed)confirmed.checked=false;
}
