import {displayPreferences} from './display-preferences.mjs';
// Read the existing sensor state; this panel changes only the saved visual choice.
export function sensorDisplayView(ship,display){
 if(!ship)return null;
 const systems=ship.systems,mode=systems.sensorMode==='passive'?'Passive':'Active',powered=systems.sensorsEnabled,displayOn=systems.sensorPing!==false,globalOn=displayPreferences(display).sensorPings;
 const blocked=[...(!displayOn?['this ship’s display is Off']:[]),...(!powered?['sensors are Off']:[]),...(mode==='Passive'?['Passive mode']:[]),...(!globalOn?['global Sensor Pings is Off']:[])];
 return {name:ship.name,sensorState:powered?mode:`Sensors Off (recorded mode: ${mode})`,displayOn,pingEnabled:!blocked.length,reason:blocked.length?'No ping: '+blocked.join('; ')+'.':'Ping display enabled for this ship.'};
}
export function createSensorDisplaySettings({root,getState,getSelected,isLocked,onChange}){
 let boundId=null,revision=null,checkbox=null,name=null,status=null,reason=null;
 function render(){
  const state=getState(),ship=state.ships.find(s=>s.id===getSelected()),id=ship?.id??null;
  if(!checkbox||boundId!==id){
   boundId=id;
   root.innerHTML='<legend>Highlighted ship · sensor ping</legend><p data-sensor-settings-name></p><p data-sensor-settings-state role="status" aria-live="polite"></p><label><input id="selected-ship-ping" type="checkbox"> Show this ship’s sensor ping</label><p data-sensor-settings-reason role="status" aria-live="polite"></p><p class="help">Display only. Active sensors can show a ping; Passive sensors have no ping animation. Sensor mode and power stay unchanged. Global Sensor Pings can hide every ship’s ping.</p>';
   checkbox=root.querySelector('input');name=root.querySelector('[data-sensor-settings-name]');status=root.querySelector('[data-sensor-settings-state]');reason=root.querySelector('[data-sensor-settings-reason]');
   const controlShip=id,control=checkbox;
   control.addEventListener('change',()=>{
    if(!control.isConnected||!controlShip||controlShip!==getSelected()||isLocked()||getState().revision!==revision){render();return;}
    onChange(controlShip,control.checked,revision);render();
   });
  }
  revision=state.revision;const view=sensorDisplayView(ship,state.display);
  name.textContent=view?'Highlighted ship: '+view.name:'No ship highlighted.';
  status.textContent=view?'Actual sensors: '+view.sensorState:'Add or highlight a ship to use this control.';
  checkbox.checked=view?.displayOn??false;checkbox.disabled=!view||isLocked();
  reason.textContent=view?view.reason+(isLocked()?' Finish or cancel pending edits to change this display choice.':''):'';
 }
 render();return {render};
}
