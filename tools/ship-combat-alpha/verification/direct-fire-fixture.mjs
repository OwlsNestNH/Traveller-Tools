import {gunneryFixture} from './gunnery-fixture.mjs';
import {applyCommand,normalizeState} from '../engine.mjs';
import {holdMounts} from '../gunnery.mjs';
import {effectiveDesign} from '../setup.mjs';
import {inventoryFromShip} from '../ammunition.mjs';
export function directFireFixture(choices={high:[['mixed:1','Pulse laser','low']]},{hull=1000,armour=0}={}){
 let s=gunneryFixture();s.ships.forEach((ship,i)=>{ship.motion.position={q:i,r:0};ship.template.hull=hull;ship.template.armour=armour;ship.template.record.jump=1;ship.template.record.sensors='Military';ship.condition.hull=hull;ship.condition.criticals=[];ship.condition.usableHull=null;ship.condition.powerOutput=100;ship.condition.powerUsed=20;ship.systems.mode='manual';ship.systems.loads.forEach(l=>l.enabled=true);ship.systems.software.installed=[];ship.flight.evasion=0;ship.condition.ammunition=inventoryFromShip(ship,effectiveDesign(ship));ship.condition.ammunition.loaded.filter(p=>p.kind==='sand').forEach(p=>p.count=4);});s=normalizeState(s);
 for(const shipId of s.workflow.gunnery.order){const ship=s.ships.find(v=>v.id===shipId),rows=holdMounts(ship);for(const [mountId,weapon,targetId]of choices[shipId]??[]){const i=rows.findIndex(r=>r.mountId===mountId);rows[i]={mountId,weapon,action:weapon==='Sandcaster'?'sand':targetId?'attack':'point-defense',targetId:targetId??null};}s=applyCommand(s,{type:'declare-gunnery',shipId,mounts:rows});}return s;
}
