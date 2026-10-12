import { el } from './dom.js';

// A button that copies a report; if the phone blocks the clipboard, the text appears in a box to copy by hand.
export function copyButton(label, getText, key) {
  const status = el('span', { class: 'muted copy-status', role: 'status' });
  const box = el('div');
  const button = el('button', {
    type: 'button',
    class: 'pill',
    'data-key': key,
    onclick: async () => {
      const text = getText();
      try {
        await navigator.clipboard.writeText(text);
        status.textContent = 'Copied. Paste it into your chat with Claude and add your question.';
        box.replaceChildren();
      } catch {
        status.textContent = 'Select the text below and copy it.';
        const area = el('textarea', { class: 'field copy-area', readonly: true, rows: 12, 'aria-label': 'Board report' });
        area.value = text;
        box.replaceChildren(area);
        area.focus();
        area.select();
      }
    },
  }, label);
  return el('div', { class: 'copy' }, el('div', { class: 'row-buttons' }, button, status), box);
}
