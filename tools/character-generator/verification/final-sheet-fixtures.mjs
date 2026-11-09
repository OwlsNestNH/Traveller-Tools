// Synthetic public-command fixture; never uses a player's character or save.
import {sourceCheckFixture,run} from './source-check-fixtures.mjs';
export {run};
export function finalSheetFixture({finish=true}={}){
 let r=sourceCheckFixture({career:'vargr.intermediary',assignment:'arbitrator'});
 r=run(r,'choose-effect',{index:0});
 r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[1,1],reason:'Synthetic final-sheet injury fixture'});
 r=run(r,'injury-loss',{index:0});
 r=run(r,'injury-treatment',{restore:r.state.injuryRestorable,inService:true});
 r=run(r,'resolve-book',{confirmed:true,note:'Source-confirmed synthetic treatment note.',medicalCoveredCost:0,effects:[]});
 r=run(r,'leave-career');
 r=run(r,'notes',{text:'Synthetic background notes. <script>not executable</script>'});
 return finish?run(r,'finish'):r;
}
