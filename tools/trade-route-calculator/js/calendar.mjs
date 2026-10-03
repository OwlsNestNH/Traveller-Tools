// Imperial calendar: 365 numbered days per year, 24 hours per day.
export function parseDate(label){
 const match=/^(\d{3})-(\d{4,})$/.exec(String(label).trim());
 if(!match)throw Error('Use an Imperial date such as 001-1105 (day-year).');
 const day=Number(match[1]),year=Number(match[2]);
 if(day<1||day>365||!Number.isSafeInteger(year))throw Error('Imperial day must be 001–365.');
 return {day,year};
}
export function campaignDate(label,hours){
 const {day,year}=parseDate(label);
 if(!Number.isSafeInteger(hours)||hours<0)throw Error('Elapsed hours must be a whole nonnegative number.');
 const days=day-1+Math.floor(hours/24),currentYear=year+Math.floor(days/365);
 return String(days%365+1).padStart(3,'0')+'-'+String(currentYear).padStart(4,'0')+' · '+String(hours%24).padStart(2,'0')+':00';
}
export function displayDate(label,hours){
 try{return campaignDate(label,hours);}catch{return String(label)+' + '+Math.floor(hours/24)+'d '+hours%24+'h (set Imperial date in Campaign time)';}
}
