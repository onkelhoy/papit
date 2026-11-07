import * as network from '@papit/game-network';

// the tests drive everything through `window.network` in `page.evaluate`
window.network = network;
document.body.dataset.ready = "true";
