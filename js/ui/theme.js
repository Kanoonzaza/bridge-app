// The look of the app: a style (Classic, Old luxury, Minimal, Card nerd) and a mode (Auto follows the phone, or Light,
// or Dark). The header button opens a small menu with both. index.html applies the saved choice before first paint.
export const MODES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
export const STYLES = [['classic', 'Classic', '#1d6a49'], ['luxury', 'Old luxury', '#7b1e2b'], ['minimal', 'Minimal', '#111111'], ['nerd', 'Card nerd', '#0057ff']];
const isMode = (m) => MODES.some(([k]) => k === m);
const isStyle = (s) => STYLES.some(([k]) => k === s);

// Drawn icons: the text glyphs (◐ ☾ ☀) render clipped or as emoji on some phones.
const ICON = {
  auto: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor"/>',
  dark: '<path d="M10.5 2.2A6 6 0 1 0 13.8 10 4.8 4.8 0 0 1 10.5 2.2z" fill="currentColor"/>',
  light: '<circle cx="8" cy="8" r="3" fill="currentColor"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1"/></g>',
};

export function applyTheme(mode, style = 'classic') {
  const root = document.documentElement;
  if (mode === 'auto') delete root.dataset.theme;
  else root.dataset.theme = mode;
  if (style === 'classic') delete root.dataset.style;
  else root.dataset.style = style;
  const dark = mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const css = getComputedStyle(root);
  const bar = css.getPropertyValue(dark ? '--bar-dark' : '--bar').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar || (dark ? '#0e1512' : '#1d6a49'));
}

export function setupTheme(button, store) {
  const saved = store.load('theme', {});
  let mode = isMode(saved.theme) ? saved.theme : 'auto';
  let style = isStyle(saved.style) ? saved.style : 'classic';
  let menu = null;
  const keep = () => store.save('theme', { theme: mode, style });
  const show = () => {
    applyTheme(mode, style);
    const name = STYLES.find(([k]) => k === style)[1];
    button.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${ICON[mode]}</svg><span>${name}</span>`;
    button.setAttribute('aria-label', `Look: ${name}, ${mode === 'auto' ? 'light or dark like the phone' : mode}. Tap to change.`);
    button.setAttribute('aria-expanded', String(!!menu));
    if (menu) fill();
  };
  const group = (label, items, current, pick) => {
    const box = document.createElement('div');
    const l = document.createElement('div');
    l.className = 'label';
    l.textContent = label;
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', label);
    for (const [key, text, swatch] of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pill${key === current ? ' on' : ''}`;
      b.dataset.key = `${label === 'Style' ? 'style' : 'mode'}-${key}`;
      b.setAttribute('aria-pressed', String(key === current));
      if (swatch) {
        const dot = document.createElement('span');
        dot.className = 'style-swatch';
        dot.style.background = swatch;
        b.append(dot);
      }
      b.append(text);
      b.addEventListener('click', () => { pick(key); keep(); show(); });
      seg.append(b);
    }
    box.append(l, seg);
    return box;
  };
  const fill = () => menu.replaceChildren(
    group('Style', STYLES, style, (k) => { style = k; }),
    group('Light or dark', MODES, mode, (k) => { mode = k; }),
  );
  const close = () => {
    if (!menu) return;
    menu.remove();
    menu = null;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', outside, true);
    document.removeEventListener('keydown', esc);
  };
  const outside = (e) => { if (menu && !menu.contains(e.target) && !button.contains(e.target)) close(); };
  const esc = (e) => { if (e.key === 'Escape') { close(); button.focus(); } };
  button.setAttribute('aria-haspopup', 'true');
  button.addEventListener('click', () => {
    if (menu) { close(); return; }
    menu = document.createElement('div');
    menu.className = 'theme-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'Look of the app');
    menu.dataset.key = 'theme-menu';
    fill();
    button.parentElement.append(menu);
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', outside, true);
    document.addEventListener('keydown', esc);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => mode === 'auto' && show());
  show();
}
