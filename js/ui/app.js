import { store } from '../store.js';
import { cleanTab } from '../state.js';
import { advisorView } from './advisor.js';
import { decoderView } from './decoder.js';
import { tableView } from './table.js';
import { setupTheme } from './theme.js';
import { registerUpdates } from './update.js';

registerUpdates();
setupTheme(document.getElementById('theme-btn'), store);

const TABS = ['advisor', 'decoder', 'table'];
const views = { advisor: document.getElementById('advisor'), decoder: document.getElementById('decoder'), table: document.getElementById('table') };
const buttons = [...document.querySelectorAll('[data-tab]')];

function show(tab, { focus = false } = {}) {
  for (const [name, node] of Object.entries(views)) node.hidden = name !== tab;
  for (const b of buttons) {
    const on = b.dataset.tab === tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  }
  store.save('tab', { tab });
}

// Tabs work before (and even if) a view fails to start.
for (const b of buttons) {
  b.addEventListener('click', () => show(b.dataset.tab));
  b.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    show(TABS[(TABS.indexOf(b.dataset.tab) + step + TABS.length) % TABS.length], { focus: true });
  });
}
// An invitation link opens the Table tab.
show(new URLSearchParams(location.search).has('table') ? 'table' : cleanTab(store.load('tab', {}), TABS));

// A bad saved state must never leave a blank screen: reset that view's storage and start from defaults.
function start(key, root, view) {
  try {
    view(root, store);
  } catch {
    store.save(key, {});
    try {
      view(root, store);
    } catch {
      root.replaceChildren(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Something went wrong. Please reload the page.' }));
    }
  }
}

start('advisor', views.advisor, advisorView);
start('decoder', views.decoder, decoderView);
start('table', views.table, tableView);
