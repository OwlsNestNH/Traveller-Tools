// Synthetic review fixture only. Internal LSS duration explicitly assumes 8 stock units/day; 150 reserve LSS occupies 2 whole reserved tons, excluded from internal days. No campaign imports or storage dependencies.
export const playerSnapshotFixture = {
  version:6, capturedAt:'2026-10-19 15:00 UTC (example)', campaignDate:'042-1105, 14:00',
  world:{name:'Regina', location:'Spinward Marches / 1910', uwp:'A788899-C', tradeCodes:'Ri Pa Ph An Cp', travelZone:'Normal', starport:'A · refined fuel available', mapReference:{sector:'Spinward Marches',hex:'1910'}},
  ship:{name:'Far Horizon', cargoCapacityTons:'82', cashCredits:'127450', fuel:{current:'36.5', capacity:'40'}, lifeSupport:{current:'168', capacity:'800', cargoLss:'150', daysRemaining:'21', daysCapacity:'100', cargoReservedTons:'2'}, destination:'New Dawn / 1924'},
  expenses:{maintenance:{expected:null,paid:null,basis:'Maintenance not recorded in this example'},visitLabel:'Regina · this stop, 040–047-1105 planned',
    berth:{expected:'1500', paid:'1500', basis:'One week at the saved local berth rate'},
    fuel:{expected:'1750', paid:'0', basis:'Planned 3.5 t refined top-up at Cr500/t'},
    salary:{expected:'6000', paid:'0', basis:'One 28-day crew salary period selected for this stop'},
    mortgage:{expected:'25000', paid:'25000', basis:'One scheduled 28-day installment paid here'},
    lss:{expected:'6000', paid:'0', basis:'Illustrative standard refill quote; supplies and service charges'},
    incidentals:{expected:null, paid:'250', basis:'Recorded spending so far; further incidentals not estimated'}},
  cargo:[{name:'Advanced Electronics', tons:'12'}, {name:'Machine Parts', tons:'8'}, {name:'Machine Parts', tons:'4'}, {name:'Textiles', tons:'6'}],
  buy:{status:'available', offers:[{name:'Common Consumables', tons:'25', creditsPerTon:'420'},{name:'Industrial Components', tons:'12.5', creditsPerTon:'8500'},{name:'Polymers', tons:'30', creditsPerTon:'6200'}]},
  sell:{status:'available', offers:[{name:'Advanced Electronics', tons:'12', creditsPerTon:'125000'},{name:'Machine Parts', tons:'8.5', creditsPerTon:'13500'},{name:'Textiles', tons:'6', creditsPerTon:'2300'}]}
};

// Synthetic generator profiles retain every non-cargo field and all offers.
export function makePlayerSnapshotExample(cargoLots=4) {
  if (![4,10,12].includes(cargoLots)) throw new Error('Choose 4, 10 or 12 cargo lots.');
  const data=structuredClone(playerSnapshotFixture);
  if(cargoLots!==4) data.cargo=Array.from({length:cargoLots},(_,i)=>({
    name:playerSnapshotFixture.cargo[i%playerSnapshotFixture.cargo.length].name,
    tons:String(i+1)
  }));
  // Explicit synthetic purchase provenance; never infer it from current offers.
  data.cargo.forEach((row,i)=>{row.purchase=i%4===0?{retailPerTon:'100000',percent:String(80+i),paidPerTon:String(80000+i*1000)}:i%4===1?{retailPerTon:'20000',percent:'62.5',paidPerTon:'12500'}:i%4===3?{retailPerTon:'3000',percent:'85',paidPerTon:'2550'}:null;});
  return data;
}
