// Surprises: a full-screen gag that pops up on a player's screen for about three seconds when someone taps their name
// at the table. Made of emoji, CSS and a small canvas of fireworks; the phone buzzes where it can.
import { el } from './dom.js';

export const FX_MS = 3200;
// Each kind: a title, the emoji it is made of, and how they move (ring: circle around the middle; rain: falling; march: across).
export const FX_KINDS = [
  { title: 'Ho ho ho!', items: ['🎅', '🦌', '🎅', '🦌', '🦌', '🎅', '🦌', '🦌'], move: 'ring', fireworks: true },
  { title: 'Frog conga!', items: ['🐸', '🐸', '🐸', '🐸', '🐸', '🐸', '🐸'], move: 'march', fireworks: true },
  { title: 'Pizza party!', items: ['🍕', '🍕', '🍕', '🍕', '🍕', '🍕', '🍕', '🍕', '🍕', '🍕'], move: 'rain', fireworks: false },
  { title: 'Quack quack!', items: ['🦆', '🦆', '🦆', '🦆', '🦆', '🦆'], move: 'march', fireworks: false },
  { title: 'Disco penguins!', items: ['🐧', '🪩', '🐧', '🪩', '🐧', '🪩', '🐧'], move: 'ring', fireworks: true },
  { title: 'Cat attack!', items: ['😻', '🐈', '😸', '🐈‍⬛', '😹', '🐱', '😽', '🐈'], move: 'rain', fireworks: false },
];

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// The buzz: short pulses building up to a long one. Phones that cannot vibrate (iPhones) simply skip it.
export function buzz() {
  try { navigator.vibrate?.([60, 40, 60, 40, 60, 40, 120, 60, 120, 60, 300, 80, 500]); } catch { /* not allowed or not supported */ }
}

function fireworks(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = (canvas.width = innerWidth * dpr);
  const h = (canvas.height = innerHeight * dpr);
  const sparks = [];
  const colours = ['#ffd54a', '#ff5c5c', '#6cf', '#9f6', '#f9f', '#fff'];
  const burst = () => {
    const x = (0.12 + Math.random() * 0.76) * w;
    const y = (0.12 + Math.random() * 0.5) * h;
    const c = colours[Math.floor(Math.random() * colours.length)];
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (1.5 + Math.random() * 5) * dpr;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c });
    }
  };
  let raf = 0;
  let last = 0;
  let nextBurst = 0;
  const tick = (now) => {
    if (now >= nextBurst) { burst(); if (Math.random() < 0.6) burst(); nextBurst = now + 230; }
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const dt = Math.min((now - (last || now)) / 16, 3);
    last = now;
    for (const s of sparks) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.06 * dpr * dt; s.vx *= 0.99; s.life -= 0.014 * dt;
      ctx.globalAlpha = Math.max(s.life, 0);
      ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.arc(s.x, s.y, 2.2 * dpr, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

let active = null;

// Cover the screen with a surprise for about three seconds (a tap closes it early).
export function playFx(kind, fromName, { haptic = true } = {}) {
  active?.close();
  const k = FX_KINDS[((Number(kind) % FX_KINDS.length) + FX_KINDS.length) % FX_KINDS.length];
  const calm = reduced();
  const n = k.items.length;
  const items = k.items.map((emoji, i) => {
    const a = (360 / n) * i;
    return el('span', { class: `fx-item fx-${k.move}`, style: `--a:${a}deg;--i:${i};--n:${n};--x:${Math.round((i / n) * 100)}%` }, emoji);
  });
  const stage = el('div', { class: `fx-stage fx-stage-${k.move}` }, ...items);
  const canvas = k.fireworks && !calm ? el('canvas', { class: 'fx-canvas', 'aria-hidden': 'true' }) : null;
  const layer = el('div', { class: `fx-layer${calm ? ' calm' : ''}`, role: 'status', 'aria-live': 'polite', 'data-key': 'fx' },
    canvas, stage,
    el('div', { class: 'fx-title' }, k.title),
    fromName ? el('div', { class: 'fx-from' }, `from ${fromName}`) : null,
    el('div', { class: 'fx-skip' }, 'Tap to close'));
  document.body.append(layer);
  const stopFireworks = canvas ? fireworks(canvas) : () => {};
  if (haptic && !calm) buzz();
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    stopFireworks();
    try { navigator.vibrate?.(0); } catch { /* ignore */ }
    layer.classList.add('out');
    setTimeout(() => layer.remove(), 250);
    if (active?.close === close) active = null;
  };
  const timer = setTimeout(close, calm ? 2000 : FX_MS);
  layer.addEventListener('click', close);
  active = { close };
  return close;
}

// A short note on the sender's own screen ("Surprise sent to Ploy").
export function toast(text) {
  document.querySelector('.fx-toast')?.remove();
  const t = el('div', { class: 'fx-toast', role: 'status' }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}
