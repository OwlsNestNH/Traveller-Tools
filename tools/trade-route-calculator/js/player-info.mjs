// Read-only accessible help. Text is always inserted as text, never HTML.
export function informationButton(document, title, paragraphs, mount=document.body) {
 const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=make('button','i');button.type='button';button.className='cargo-info-button';button.setAttribute('aria-label','About '+title);button.setAttribute('aria-haspopup','dialog');
 button.addEventListener('click',()=>{
  const dialog=make('dialog'),heading=make('h2',title);dialog.setAttribute('aria-label',title);dialog.append(heading,...paragraphs.map(text=>make('p',text)));
  const close=make('button','Close');close.type='button';close.addEventListener('click',()=>dialog.close());dialog.append(close);
  dialog.addEventListener('close',()=>{dialog.remove();if(button.isConnected)button.focus();});
  dialog.addEventListener('click',event=>{const b=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom))dialog.close();});
  mount.append(dialog);dialog.showModal();close.focus();
 });return button;
}
