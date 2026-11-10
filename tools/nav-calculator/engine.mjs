// ESM entry point for browser modules and Node. The same engine serves every host.
import * as loaded from './engine.js';
const engine = loaded.default ?? globalThis.TravellerNav;
export const {API_VERSION, constants, orbitToAU, computeDistance, clearanceDistance,
  requiredDice, solveRoute, computeClearance} = engine;
export default engine;
