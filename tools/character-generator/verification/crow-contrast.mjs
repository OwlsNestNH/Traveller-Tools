// WCAG sRGB contrast arithmetic for actual browser-computed colors.
export function contrastRatio(first,second){
 const luminance=color=>{
  const channels=color.match(/[\d.]+/g)?.slice(0,3).map(Number);if(channels?.length!==3)throw new Error('Expected an opaque computed rgb color: '+color);
  const linear=channels.map(n=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
 };
 const a=luminance(first),b=luminance(second);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
