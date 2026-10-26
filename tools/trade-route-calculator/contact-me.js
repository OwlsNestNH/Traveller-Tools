// Shared, local-only contact popup. Opening it never sends a message.
(()=>{
 const opener=document.querySelector('[data-contact-open]');
 if(!opener)return;
 const dialog=document.createElement('dialog');
 dialog.id='contact-me-dialog';
 dialog.setAttribute('aria-labelledby','contact-me-title');
 dialog.setAttribute('aria-describedby','contact-me-note');
 dialog.innerHTML='<h2 id="contact-me-title">Contact Me</h2><p id="contact-me-note">Feel free to send any Bug Notes, Questions, Suggestions, or Feedback. Thanks!</p><p><a href="mailto:bows_cosmic.7e@icloud.com">bows_cosmic.7e@icloud.com</a></p><button type="button" data-contact-close autofocus>Close</button>';
 document.body.append(dialog);
 opener.setAttribute('aria-haspopup','dialog');
 opener.setAttribute('aria-controls',dialog.id);
 opener.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();});
 dialog.querySelector('[data-contact-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const first=dialog.querySelector('a'),last=dialog.querySelector('button');
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 dialog.addEventListener('close',()=>opener.focus({preventScroll:true}));
})();
