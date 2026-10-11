export function registerUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const bar = document.getElementById('update-bar');
  const btn = document.getElementById('update-btn');
  let waiting = null;
  const offer = (worker) => {
    waiting = worker;
    bar.hidden = false;
  };
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
  }).catch(() => {});
  btn.addEventListener('click', () => waiting?.postMessage('skip'));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (waiting && !reloaded) {
      reloaded = true;
      location.reload();
    }
  });
}
