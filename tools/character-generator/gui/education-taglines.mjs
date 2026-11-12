// Approved presentation-only copy. No rules RNG, save fields or log changes.
export const EDUCATION_TAGLINES = {
  "university": {
    "admissionSuccess": [
      "You’re in. Try to look educated.",
      "Admissions has made a terrible mistake.",
      "Welcome aboard, future know-it-all.",
      "Your academic career is off to a suspiciously good start.",
      "They let you in. Standards are clearly slipping.",
      "Congratulations. You now have somewhere to be late."
    ],
    "admissionFailure": [
      "Even the rejection letter used small words.",
      "The university has standards. Apparently.",
      "Your application made the admissions office laugh.",
      "They suggested you try a different building.",
      "Higher education has asked you to aim lower.",
      "The university regrets your application."
    ],
    "graduationSuccess": [
      "You passed. The faculty is still checking.",
      "A degree at last. Common sense sold separately.",
      "You’re officially educated. Please stop proving otherwise.",
      "Your diploma says qualified. Your professors say finally.",
      "You can now be wrong with confidence.",
      "Congratulations. You’re someone else’s problem now."
    ],
    "graduationHonours": [
      "Top marks. Try not to mention it every five minutes.",
      "You graduated with honours and no known humility.",
      "Your diploma comes with bragging rights. We regret this.",
      "You made it look easy. Everyone resents you.",
      "The faculty is impressed. You can stop nodding now.",
      "Congratulations, you magnificent swot."
    ],
    "graduationFailure": [
      "You just wasted four years, loser.",
      "Your diploma is a bar tab.",
      "The dean recommends piracy.",
      "Four years, countless lectures, and a lovely souvenir mug.",
      "Your cap and gown have been reassigned.",
      "At least you know where the library is now."
    ]
  },
  "armyAcademy": {
    "admissionSuccess": [
      "Accepted. The galaxy has plenty of mud left.",
      "Welcome to the Army Academy. Your boots have a promising academic future.",
      "Admitted. Even grav tanks need someone to blame.",
      "Time to study the fine art of making everyone else march.",
      "Welcome, cadet. “Strategic withdrawal” sounds better with an education.",
      "Soon you’ll explain uphill charges with diagrams."
    ],
    "admissionFailure": [
      "The Army needs field commanders, not field decorations.",
      "Even the mud has standards.",
      "A grav tank is expensive enough without putting you in charge.",
      "The supply corps can’t issue you common sense.",
      "The parade ground will struggle on without your leadership.",
      "The Army has enough problems it can’t solve with artillery."
    ],
    "graduationSuccess": [
      "All that marching finally got you somewhere.",
      "Your plans now come with proper map symbols.",
      "You can make “take that hill” sound impressively complicated.",
      "A solid grounding in ground.",
      "You’re educated enough to argue with the terrain.",
      "A fine foundation for a career in boots and paperwork."
    ],
    "graduationHonours": [
      "Even your fallback plans have fallback plans.",
      "You’ve turned getting muddy into an exact science.",
      "Your supply lines have admirers.",
      "You make manoeuvres look suspiciously intentional.",
      "You can spot a bad position before occupying it.",
      "Even the contour lines seem to respect you."
    ],
    "graduationFailure": [
      "Your strategy still needs adult supervision.",
      "The map is not an aspirational document.",
      "Enthusiasm is not a substitute for ammunition.",
      "“More tanks” is not an entire doctrine.",
      "The terrain remains unconvinced.",
      "You have a gift for making retreat look ambitious."
    ]
  },
  "marineAcademy": {
    "admissionSuccess": [
      "Welcome aboard. Eventually, someone else’s.",
      "The Navy gets you there. We teach you how to get in.",
      "Your timetable includes Applied Door Removal.",
      "Hands-on learning comes with gauntlets.",
      "Even in zero gravity, our expectations remain crushing.",
      "Diplomacy has requested that you stand behind it."
    ],
    "admissionFailure": [
      "Your application failed to establish a beachhead.",
      "Admission denied. Please do not attempt a breach.",
      "The Academy has elected to keep this hatch closed.",
      "Your application has been reassigned to the civilian sector.",
      "Your tactical withdrawal from higher education is approved.",
      "The Corps wishes you luck somewhere with softer landings."
    ],
    "graduationSuccess": [
      "Qualified to board ships without waiting for an invitation.",
      "Your education is complete. Other people’s bulkheads are concerned.",
      "Certified in making an entrance. Doors optional.",
      "The Navy provides transport. You now provide the problem.",
      "Your diploma is the only paper armour you’ll be issued.",
      "Ready to turn a hostile reception into a beachhead."
    ],
    "graduationHonours": [
      "Top of the class. First through the breach.",
      "Honours awarded. The doors would like to appeal.",
      "Graduated with distinction and exceptional disregard for locked hatches.",
      "Even the instructors would prefer you on their side.",
      "Outstanding potential. Preferably aimed away from the Academy.",
      "Proof that an excellent education can still be a boarding hazard."
    ],
    "graduationFailure": [
      "Further study recommended: which side of cover to stand on.",
      "Your diploma remains an unsecured objective.",
      "Further training required. Start with “friendly” and “fire.”",
      "The Academy recommends breaching a textbook first.",
      "The Corps has postponed making you everyone else’s problem.",
      "Your qualifications are still awaiting extraction."
    ]
  },
  "navyAcademy": {
    "admissionSuccess": [
      "Welcome to the Navy Academy. Space is vast; your cabin won’t be.",
      "Admitted. Please keep your ego inside the pressure hull.",
      "Your timetable now includes finding out which alarm that was.",
      "The stars await. So does the maintenance schedule.",
      "Welcome, cadet. The airlock is not a shortcut.",
      "You’re in. Try not to make the simulator file a complaint."
    ],
    "admissionFailure": [
      "The admissions board recommends keeping your ambitions planetside.",
      "Application rejected. Even vacuum has fewer gaps.",
      "The Academy has declined your request for docking clearance.",
      "Your aptitude test gave the navigation staff a headache.",
      "The fleet has enough unidentified hazards.",
      "Space is unforgiving. So was the admissions board."
    ],
    "graduationSuccess": [
      "You passed. The simulator can finally relax.",
      "Your education now comes with a sensible respect for warning lights.",
      "You can tell a tactical display from a very expensive screensaver.",
      "A sound education in keeping the interesting bits inside the hull.",
      "You’ve learned why “close enough” is not a docking procedure.",
      "Ready for a future of star charts and surprisingly small rooms."
    ],
    "graduationHonours": [
      "Top marks. Even your course corrections look planned.",
      "The navigation instructors have stopped reaching for the controls.",
      "Your simulator scores have become everyone else’s problem.",
      "Honours awarded. Try to leave some stars for the rest of the class.",
      "You’ve made orbital mechanics look dangerously straightforward.",
      "Graduated with distinction. The bridge will never hear the end of it."
    ],
    "graduationFailure": [
      "The simulator has requested a different cadet.",
      "Your final approach needs a different ending.",
      "You’ve confused a course correction with a change of subject.",
      "The Academy suggests reviewing what keeps the air inside.",
      "Your calculations have discovered several exciting ways to miss.",
      "You’ve mastered space. The ship remains a concern."
    ]
  }
};
for(const outcomes of Object.values(EDUCATION_TAGLINES)){for(const lines of Object.values(outcomes))Object.freeze(lines);Object.freeze(outcomes);}Object.freeze(EDUCATION_TAGLINES);
const keys={'core.university':'university','core.academy-army':'armyAcademy','core.academy-marine':'marineAcademy','core.academy-navy':'navyAcademy'};
export function educationTagline(id,kind,outcome,actionId){
 const key=keys[id],result=kind==='admission'?(outcome==='success'?'admissionSuccess':outcome==='failure'?'admissionFailure':null):kind==='graduation'?(outcome==='success'?'graduationSuccess':outcome==='honours'?'graduationHonours':outcome==='failure'?'graduationFailure':null):null;
 const lines=EDUCATION_TAGLINES[key]?.[result];if(!lines||typeof actionId!=='string'||!actionId)return null;
 let hash=2166136261;for(const char of 'outcome-tagline/v1/education/'+id+'/'+result+'/'+actionId)hash=Math.imul(hash^char.charCodeAt(0),16777619);
 return lines[(hash>>>0)%lines.length];
}
