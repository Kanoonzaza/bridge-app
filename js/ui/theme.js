// The theme switch: Auto (follow the phone) → Dark → Light. index.html applies the saved choice before first paint.
const NEXT = { auto: 'dark', dark: 'light', light: 'auto' };
const LABEL = { auto: 'Auto', dark: 'Dark', light: 'Light' };
// Drawn icons: the text glyphs (◐ ☾ ☀) render clipped or as emoji on some phones.
const ICON = {
  auto: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor"/>',
  dark: '<path d="M10.5 2.2A6 6 0 1 0 13.8 10 4.8 4.8 0 0 1 10.5 2.2z" fill="currentColor"/>',
  light: '<circle cx="8" cy="8" r="3" fill="currentColor"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1"/></g>',
};
const BAR = { light: '#1d6a49', dark: '#0e1512' };

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? BAR.dark : BAR.light);
}

export function setupTheme(button, store) {
  let theme = store.load('theme', {}).theme;
  if (!NEXT[theme]) theme = 'auto';
  const show = () => {
    applyTheme(theme);
    button.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${ICON[theme]}</svg><span>${LABEL[theme]}</span>`;
    button.setAttribute('aria-label', `Theme: ${theme === 'auto' ? 'automatic' : theme}. Tap to change.`);
  };
  button.addEventListener('click', () => {
    theme = NEXT[theme];
    store.save('theme', { theme });
    show();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => theme === 'auto' && show());
  show();
}
