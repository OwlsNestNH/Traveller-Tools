// Optional Companion Update2024 p13 setting: no rolls or state mutation here.
export function ironManOptionAvailable(state){return !!state.config?.gm&&!state.pending&&['identity','statistics','background','precareer','career','survival','training','career-event','career-mishap','term-end','benefits','retirement','finish','deceased'].includes(state.stage);}
