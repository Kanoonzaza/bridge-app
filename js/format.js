import { SYMBOL } from './cards.js';

export function callLabel(call) {
  if (call === 'P') return 'Pass';
  if (call === 'X') return 'Dbl';
  if (call === 'XX') return 'Rdbl';
  return call[0] + SYMBOL[call[1]];
}

export const rankLabel = (r) => (r === 'T' ? '10' : r);
