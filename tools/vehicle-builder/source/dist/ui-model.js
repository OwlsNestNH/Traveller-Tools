/* Presentation grouping; construction authority remains in engine.js. */
(function(root){
'use strict';
function family(name){
 name=name.trim();
 if(name.startsWith('Sensor System'))return name.includes('underwater')?'Underwater sensors':'Sensor System';
 if(name.startsWith('Long Range Transceiver'))return name.includes('Tightbeam')?'Long Range Transceiver · tightbeam':'Long Range Transceiver';
 return name.replace(/\/fib$/, '').replace(/\s*\([^)]*\).*$/, '').replace(/\/\d+$/, '').replace(/,\s*[\d,]+\s*km$/, '');
}
function searchText(group){const aliases={ 'Tow Hitch':'tow cable towing cables hooks connector',Winch:'tow cable towing cables recovery','Life Support':'life-support air oxygen breathing','Transceiver Encryption':'encrypt radio secure communications','Transceiver Tightbeam':'laser maser radio communications','Satellite Uplink':'radio transceiver communications'};return (group.name+' '+(aliases[group.name]||'')+' '+group.options.map(o=>o.Name).join(' ')).toLowerCase().replaceAll('-',' ');}
function quantityLabel(o){if(!o)return 'Quantity';if(/^Life Support \(/.test(o.Name))return 'People supported';if(o.Name==='Tow Hitch')return 'Powered towed Spaces';if(/^(Docking Bay|Hangar Bay|Digger Blade)$/.test(o.Name))return 'Allocated Spaces';if(/^(Landing|Launch) Deck/.test(o.Name))return 'Largest aircraft Spaces';return 'Quantity';}
function section(o,engine){const c=engine.category(o);if(c==='Core systems')return 'equipment';if(c==='Automation')return 'automation';if(c==='Exterior'||c==='Defence')return o.Name==='Air Lock'?'internal':'external';return 'internal';}
function groups(options){
 const grouped=new Map();
 for(const option of options){if(option.Name.startsWith('Control System'))continue;const key=family(option.Name);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(option);}
 return [...grouped].map(([name,options])=>({name,options}));
}
function availableFeatures(engine,state){return engine.features.filter(f=>!engine.featureReasons(f['Feature Effect'],state).length);}
function unavailableSelected(engine,state){return state.features.filter(name=>engine.featureReasons(name,state).length);}
const api={family,groups,availableFeatures,unavailableSelected,searchText,quantityLabel,section};root.VehicleUI=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
