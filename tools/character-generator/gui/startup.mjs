/* Catch module-graph failures outside that graph. No engine or saved-data dependency. */
for(const control of document.querySelectorAll('.toolbar button,.toolbar input')){if(!control.disabled){control.dataset.busyDisabled='true';control.disabled=true;}}
import('./app.mjs').catch(error=>window.CrowTechnicalError.show('Unable to load the character builder: '+error.message,{startup:true}));
