// Presentation only: standalone local runs link to the published release notes.
// The shared counter is loaded only on the canonical published tool page.
export function attachSiteLinks(document, location) {
 const canonicalPath='/Traveller-Tools/tools/character-generator/';
 const published=location.hostname==='owlsnestnh.github.io'&&[canonicalPath,canonicalPath+'index.html'].includes(location.pathname);
 const changelog=document.getElementById('release-changelog');
 if(changelog&&!/\/tools\/character-generator\/(?:index\.html)?$/.test(location.pathname))changelog.href='https://owlsnestnh.github.io/Traveller-Tools/changes/character.html';
 if(published){
  const counter=document.createElement('script');
  counter.src='../../assets/js/tool-visits.js';
  counter.async=true;
  document.body.appendChild(counter);
 }
}
if(typeof document!=='undefined')attachSiteLinks(document,location);
