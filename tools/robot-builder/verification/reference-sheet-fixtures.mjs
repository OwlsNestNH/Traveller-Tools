import {createDesign,updateDesign} from '../engine/index.mjs';
// Synthetic regression designs only. No user design or reference-image data.
export function sheetFixtures() {
  const baseline=updateDesign(createDesign(),{name:'Reference regression robot'});
  const populated=updateDesign(createDesign({techLevel:15}),{
    name:'Survey reference fixture',
    selections:{
      chassis:{size:'size-7'},locomotion:{primary:'grav',secondary:'walker'},
      brain:{model:'very-advanced-tl14',bandwidthUpgrade:'bw-6'},
      skills:{packages:['electronics-all-1','admin-0','recon-0']},
      physical:{options:['storage-compartment'],optionParameters:{'storage-compartment':{quantity:3}},
        weapons:[{id:'reference-weapon',weaponId:'csc-gauss-sniper-rifle',placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,initialMagazines:1,extraMagazines:0,weaponManufactureTL:12,initialAmmunitionModification:'apds'}]},
      finalisation:{priceMode:'custom',customPrice:76543}
    }
  });
  const long=updateDesign(populated,{name:'Long reference fixture',selections:{chassis:{size:'size-8'},skills:{customPackages:Array.from({length:32},(_,i)=>({id:'long-skill-'+i,skill:'profession',speciality:'Synthetic reference speciality '+(i+1)+' with extended scenario label for pagination',level:0}))},physical:{
    optionInstances:Array.from({length:100},(_,i)=>({id:'long-option-'+i,optionId:'storage-compartment',parameters:{quantity:1}}))
  }}});
  const provisional=updateDesign(createDesign({kind:'metamorphic',techLevel:17}),{name:'Provisional reference fixture',special:{metamorphicTier:'basic'}});
  const invalid=updateDesign(provisional,{techLevel:16});
  const component=role=>updateDesign(createDesign({kind:'vehicle-brain',techLevel:19}),{name:role+' reference host',special:{designReferences:[{id:'reference-child',role,quantity:1,design:populated}]}});
  return {baseline,populated,long,provisional,invalid,blocked:updateDesign(createDesign({kind:'biological',techLevel:12}),{name:'Blocked reference fixture'}),wholeComponent:component('installed-robot'),brainComponent:component('installed-brain')};
}
