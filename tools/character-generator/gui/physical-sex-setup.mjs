// Presentation only. Keep the established gender payload for save/replay compatibility.
// The currently released species have no verified additional physical-sex choices
// in the implemented catalog. Add species-specific options only from verified rules.
export function physicalSexSelectView(){
 return '<select id="setup-gender" name="gender"><option value="" selected disabled>Choose physical sex</option><option value="female">Female</option><option value="male">Male</option></select>';
}
