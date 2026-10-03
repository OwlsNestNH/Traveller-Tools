const fs=require('node:fs');
require('./dist/data.js');const F=require('./dist/engine.js'),U=require('./dist/ui-model.js');
function excluded(o){
 if(/Biotech|Natural Weapons/i.test(o.Name||o.Weapon)||o.Bio==='B')return 'Biological construction omitted by scope.';
 if(/Manipulator Arms/.test(o.Name||''))return 'Represented by the configurable Robot Manipulator Arm selector; vehicle installation p67 and Robot Handbook pp25–27.';
 if(/Custom|Robot|Manipulator Arms|\+STR or DEX/i.test(o.Name||o.Weapon))return 'Custom or robot design requires component specifications; not a fixed-price catalog item.';
 if(/Spare Space/i.test(o.Name))return 'Represented by the live remaining-capacity display.';
 if(/^(Ram|Ram \(metal tipped\))$/.test(o.Weapon))return 'Installed through the Ram external-option dropdown.';
 if(/last|none|no weapon|Personal Weapons|Infrastructure|Fabricator|Industrial Zone/i.test(o.Name||o.Weapon))return 'Worksheet heading, placeholder or unspecified equipment record.';
 return 'Worksheet lacks a defined TL and/or complete price/space inputs; requires a sourced manual specification.';
}
const rows=VEHICLE_DATA.Options.map(o=>{const found=F.options.find(x=>x.Name===o.Name);const changed=found?['TL','Costing','CostU','CostP','CostS','FSpaces'].filter(k=>found[k]!==o[k]).map(k=>`${k}: ${o[k]??'blank'} → ${found[k]??'blank'}`).join('; '):'';return {name:o.Name,source:o._source,status:found?'Included':'Not a fixed catalog selection',location:found?(o.Name.startsWith('Control System')?'Core systems':U.section(found,F)):'Source audit',notes:found?(changed||'Catalog row retained; detailed combination checks follow the coverage notes.'):excluded(o)};});
const weaponRows=VEHICLE_DATA.Weapons.map(w=>({name:w.Weapon,source:w._source,status:F.weapons.some(x=>x.Weapon===w.Weapon)?'Included':'Outside weapon dropdown',notes:F.weapons.some(x=>x.Weapon===w.Weapon)?'Weapon mounts':excluded(w)}));
const additions=F.options.filter(o=>!VEHICLE_DATA.Options.some(x=>x.Name===o.Name)).map(o=>({name:o.Name,source:o._source,book:o._book,pages:o._pages}));
const coverage=[
 ['58–61','Core systems','Control, autopilot, radios and upgrades, navigation, sensor grades/customisations, underwater sensors, camouflage, holographic hull, reflec, stealth.'],
 ['62–72','External options','Environment protection, connectors/towing, mobility tools, arms, decks and exterior equipment; configurable robot arms and vehicle-arm characteristic increases are included.'],
 ['73–77','Defence','Defensive options plus self-contained anti-missile systems in Weapon mounts.'],
 ['78–90','Internal options','Life support, accommodation, safety, laboratories, bays and utility facilities. Variable quantities have explicit units.'],
 ['91','Other books','Worksheet-sourced specialist items are budgeted with review flags; this is not a complete import of other books.'],
 ['92–100','Automation','Computers including /fib, ship computers, software, drone controls and preset robot brains; bespoke robot design omitted.'],
 ['101–119, 124–126','Weapons','Non-biological worksheet weapons; mounts, shield, fire control, loaders, ammunition and external fuel tanks. Personal-weapon gunports and empty mounts are included; unspecified custom weapons need their own data.'],
 ['120–123','Special ammunition','26 profiles for purchased reserve ammunition, with TL/cost checks and explicit compatibility review. Combined modifiers and combat damage resolution are not automated.'],
 ['127–130','Refits','Reviewed. Existing-vehicle modifications, compatibility/labour, salvage and unsafe tuning are excluded from new-construction costs.'],
 ['131 onward','Biological','Omitted by scope.']
];
const data={date:new Date().toISOString(),spreadsheet:'VehicleDesignWorksheet-v056Blank.xlsx',book:'Vehicle Handbook Update 2026',rows,weaponRows,additions,coverage,counts:{worksheetOptions:rows.length,includedOptions:rows.filter(x=>x.status==='Included').length,worksheetWeapons:weaponRows.length,includedWeapons:weaponRows.filter(x=>x.status==='Included').length}};
fs.writeFileSync('catalog-audit.json',JSON.stringify(data,null,2));
fs.writeFileSync('dist/audit-data.js','globalThis.EQUIPMENT_AUDIT='+JSON.stringify(data)+';\n');
const escape=s=>String(s).replaceAll('|','/').replaceAll('\n',' ');
let md='# Equipment coverage audit\n\nSources: **VehicleDesignWorksheet-v056Blank.xlsx** and **Vehicle Handbook Update 2026**, printed pp58–130. Only blank construction controls and reference tables were audited; existing vehicle designs were not used as targets.\n\n';
md+=`Accounted for ${rows.length} worksheet option rows (${data.counts.includedOptions} catalog selections) and ${weaponRows.length} weapon rows (${data.counts.includedWeapons} non-biological weapon selections). This is a coverage audit, not a claim that every operating rule or every numerical table cell has been independently reconciled.\n\n`;
md+='## Handbook coverage\n\n| Printed pages | Section | Coverage |\n|---|---|---|\n'+coverage.map(r=>'| '+r.map(escape).join(' | ')+' |').join('\n');
md+='\n\n## Restored and corrected options\n\n'+F.corrections.slice(0,7).map(([n,c,p,t])=>`- **${n}:** ${t} Vehicle Handbook Update 2026, pp${p}; worksheet ${c}.`).join('\n');
md+='\n\n## Every worksheet option row\n\n| Equipment | Worksheet cells | Status | Notes |\n|---|---|---|---|\n'+rows.map(r=>'| '+[r.name,r.source,r.status,r.notes].map(escape).join(' | ')+' |').join('\n');
md+='\n\n## Every worksheet weapon row\n\n| Weapon | Worksheet cells | Status | Notes |\n|---|---|---|---|\n'+weaponRows.map(r=>'| '+[r.name,r.source,r.status,r.notes].map(escape).join(' | ')+' |').join('\n');
fs.writeFileSync('EQUIPMENT-AUDIT.md',md+'\n');
console.log(JSON.stringify(data.counts));
