// Shared, unchanged Core p.38 threshold; presentation must not imply a dice check.
export function nobleAutomaticQualification(careerId,stats={}){return careerId==='core.noble'&&Number.isFinite(stats.SOC)&&stats.SOC>=10;}
