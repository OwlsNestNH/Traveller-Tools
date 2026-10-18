// Synthetic review fixture only. No campaign imports or storage dependencies.
export const playerSnapshotFixture = {
  version:1, capturedAt:'2026-10-18 18:00 UTC (example)', campaignDate:'042-1105, 14:00',
  world:{name:'Port Meridian', location:'Example Reach / 1824', uwp:'B867A74-C', tradeCodes:'Hi Ga', travelZone:'Amber — caution advised', starport:'B · refined fuel available'},
  ship:{name:'Far Horizon', cargoCapacityTons:'82', fuelTons:'36.5', destination:'New Dawn / 1924'},
  cargo:[{name:'Advanced Electronics', tons:'12'}, {name:'Machine Parts', tons:'8.5'}, {name:'Machine Parts', tons:'4'}, {name:'Textiles', tons:'6'}],
  buy:{status:'available', offers:[{name:'Common Consumables', tons:'25', creditsPerTon:'420'},{name:'Industrial Components', tons:'12.5', creditsPerTon:'8500'},{name:'Polymers', tons:'30', creditsPerTon:'6200'}]},
  sell:{status:'available', offers:[{name:'Advanced Electronics', tons:'12', creditsPerTon:'125000'},{name:'Machine Parts', tons:'8.5', creditsPerTon:'13500'},{name:'Textiles', tons:'6', creditsPerTon:'2300'}]}
};
