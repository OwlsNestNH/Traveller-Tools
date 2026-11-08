// Explicit per-ship docked state. Merely viewing or visiting a world never
// enables station supplies, and this flag never refills or reprices stock.
export function stationSupportAvailable(state){
 const w=state.worlds?.[state.actual];return !!w&&!w.emptySpace&&/^[ABCDE]/i.test(w.overrideUWP||w.uwp||'');
}
export function validateStationSupport(state){
 const enabled=state.ship?.stationLifeSupport;
 if(enabled!==undefined&&typeof enabled!=='boolean')throw Error('Station life support must be on or off.');
 if(enabled===true&&!stationSupportAvailable(state))throw Error('Station life support requires the actual ship to be docked at a port (A-E).');
}
export function clearStationSupportAfterTravel(before,after){
 if(after.ship.stationLifeSupport===true&&(before.actual!==after.actual||!stationSupportAvailable(after)))after.ship.stationLifeSupport=false;
}
