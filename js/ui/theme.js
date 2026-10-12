// The theme switch: Auto (follow the phone) → Dark → Light. index.html applies the saved choice before first paint.
const NEXT = { auto: 'dark', dark: 'light', light: 'auto' };
const LABEL = { auto: '◐ Auto', dark: '☾ Dark', light: '☀ Light' };
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
    button.textContent = LABEL[theme];
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
