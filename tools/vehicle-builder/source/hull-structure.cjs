/* Preserve the source value. Interpret a label only when it equals calculated Hull exactly. */
function classifyHullStructure(published,hull,structure){
 const rawMatch=published===structure;
 const inferredHullLabel=!rawMatch&&published===hull;
 return {publishedLabel:'STRUCTURE',published,hull,structure,rawMatch,inferredHullLabel,
  match:rawMatch||inferredHullLabel,
  interpretedStructure:rawMatch?published:inferredHullLabel?Math.ceil(published/10):null,
  classification:rawMatch?'Matches Structure':inferredHullLabel?'Probable Hull labelled Structure':'Unresolved value difference',
  explanation:rawMatch?'Printed Structure agrees with the handbook calculation.':inferredHullLabel?
   `Printed STRUCTURE ${published} exactly equals calculated Hull ${hull}. Treating the value as Hull gives Structure ${structure}. This is an inferred label correction, not official errata.`:
   `Printed STRUCTURE ${published} matches neither calculated Hull ${hull} nor Structure ${structure}; no label correction is applied.`};
}
module.exports={classifyHullStructure};
