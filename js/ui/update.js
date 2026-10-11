export function registerUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const bar = document.getElementById('update-bar');
  const btn = document.getElementById('update-btn');
  let waiting = null;
  const offer = (worker) => {
    waiting = worker;
    bar.hidden = false;
    document.body.classList.add('has-update');
  };
  const watch = (w) => {
    if (!w) return;
    if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
    w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
    });
  };
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
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
