/* Catch module-graph failures outside that graph. No engine or saved-data dependency. */
import('./app.mjs').catch(error=>window.CrowTechnicalError.show('Unable to load the character builder: '+error.message,{startup:true}));
