// Text with ♥ and ♦ wrapped in red spans.
export function suitText(s) {
  const frag = document.createDocumentFragment();
  for (const part of String(s).split(/([♥♦])/)) {
    if (!part) continue;
    if (part === '♥' || part === '♦') {
      const sp = document.createElement('span');
      sp.className = 'red';
      sp.textContent = part;
      frag.append(sp);
    } else {
      frag.append(document.createTextNode(part));
    }
  }
  return frag;
}

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : suitText(kid));
  }
  return n;
}

// Re-render a container without losing keyboard focus: remember the focused
// control's data-key, run render(), then focus the control with the same key.
export function keepFocus(container, render) {
  const active = document.activeElement;
  const key = active && container.contains(active) ? active.dataset?.key : undefined;
  render();
  if (!key) return;
  const esc = globalThis.CSS?.escape ? CSS.escape(key) : key.replace(/(["\\])/g, '\\$1');
  container.querySelector(`[data-key="${esc}"]`)?.focus();
}

export function segmented(label, options, value, onPick) {
  return el('div', {},
    el('div', { class: 'label' }, label),
    el('div', { class: 'seg', role: 'group', 'aria-label': label },
      ...options.map(([v, text]) => el('button', {
        type: 'button',
        'data-key': `pill-${label}-${v}`,
        class: `pill${v === value ? ' on' : ''}`,
        'aria-pressed': String(v === value),
        onclick: () => onPick(v),
      }, text))));
}
