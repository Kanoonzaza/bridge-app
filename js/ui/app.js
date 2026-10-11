import { store } from '../store.js';
import { advisorView } from './advisor.js';
import { decoderView } from './decoder.js';
import { registerUpdates } from './update.js';

const views = { advisor: document.getElementById('advisor'), decoder: document.getElementById('decoder') };
advisorView(views.advisor, store);
decoderView(views.decoder, store);

function show(tab) {
  for (const [name, node] of Object.entries(views)) node.hidden = name !== tab;
  for (const b of document.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  store.save('tab', { tab });
}

for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => show(b.dataset.tab));
show(store.load('tab', { tab: 'advisor' }).tab);
registerUpdates();
