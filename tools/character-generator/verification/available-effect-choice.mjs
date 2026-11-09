// Verification driver helper: preserve original API indices; never adjudicate an unavailable outcome.
export function availableEffectChoiceIndex(options,offset=0){
 const indices=options.flatMap((option,index)=>option.available===false?[]:[index]);
 if(!indices.length)throw Error('No available mandatory effect choice.');
 return indices[offset%indices.length];
}
