// Logical SVG geometry shared by rendering, clipping and visible-area loading.
// Keep these baseline dimensions until the separate GUI viewport change.
const width=520,height=320;
export const MAP_GEOMETRY=Object.freeze({
 width,height,halfWidth:width/2,halfHeight:height/2,
 // Preserve the historical two-pixel projection offset. Camera/fetch radii
 // remain centered on the half dimensions, with their existing overscan.
 originX:width/2,originY:height/2-2
});
