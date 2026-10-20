// Surprises: a full-screen gag that pops up on a player's screen for about three seconds when someone taps their name
// at the table. Made of emoji, CSS and a small canvas of fireworks; the phone buzzes where it can.
import { el } from './dom.js';

export const FX_MS = 3400;
const many = (n, pick) => Array.from({ length: n }, (_, i) => (typeof pick === 'function' ? pick(i) : pick[i % pick.length]));
const CONFETTI = ['🎉', '✨', '🎊', '💥', '⭐', '🎈'];
// Each kind: a title and layers of emoji; a layer's move is how they go about it (ring: circle the middle, clockwise or
// not; rain: fall and spin; march: parade across; pop: burst in and out all over; zoom: one giant one rushing at you;
// bounce: ricochet around). Every kind also gets confetti, fireworks, a shake and a strobe: the more mess the better.
export const FX_KINDS = [
  { title: 'Ho ho ho!', layers: [
    { move: 'ring', rad: 'min(38vw,170px)', dir: 1, items: ['🎅', '🦌', '🦌', '🎅', '🦌', '🦌', '🎅', '🦌'] },
    { move: 'ring', rad: 'min(21vw,95px)', dir: -1, items: ['🦌', '🎁', '🦌', '🎁', '🦌', '🎁'] },
    { move: 'march', items: ['🛷', '🦌', '🦌', '🦌', '🎅'] },
    { move: 'rain', items: many(22, ['❄️', '🎁', '❄️', '🔔']) },
    { move: 'zoom', items: ['🎅'] },
  ] },
  { title: 'Frog conga!', layers: [
    { move: 'march', items: many(12, ['🐸']) },
    { move: 'bounce', items: many(8, ['🐸', '🪰']) },
    { move: 'pop', items: many(10, ['🐸', '🎶', '🪷']) },
    { move: 'zoom', items: ['🐸'] },
  ] },
  { title: 'Pizza party!', layers: [
    { move: 'rain', items: many(30, ['🍕', '🍕', '🧀', '🍄', '🫒']) },
    { move: 'ring', rad: 'min(30vw,140px)', dir: 1, items: many(8, ['🍕']) },
    { move: 'zoom', items: ['🍕'] },
  ] },
  { title: 'Quack quack!', layers: [
    { move: 'march', items: many(14, ['🦆', '🦆', '🐥']) },
    { move: 'bounce', items: many(10, ['🦆', '🐤', '🥖']) },
    { move: 'rain', items: many(14, ['🪶']) },
    { move: 'zoom', items: ['🦆'] },
  ] },
  { title: 'Disco penguins!', layers: [
    { move: 'ring', rad: 'min(38vw,170px)', dir: 1, items: many(8, ['🐧', '🪩']) },
    { move: 'ring', rad: 'min(20vw,90px)', dir: -1, items: many(6, ['🐧']) },
    { move: 'pop', items: many(16, ['🪩', '✨', '🎶', '🕺']) },
    { move: 'zoom', items: ['🪩'] },
  ] },
  { title: 'Cat attack!', layers: [
    { move: 'rain', items: many(26, ['😻', '🐈', '😸', '🐈‍⬛', '😹', '🐱', '😽', '🙀']) },
    { move: 'bounce', items: many(8, ['🐈', '🧶', '🐟']) },
    { move: 'zoom', items: ['🙀'] },
  ] },
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
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (1.5 + Math.random() * 5) * dpr;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c });
    }
  };
  let raf = 0;
  let last = 0;
  let nextBurst = 0;
  const tick = (now) => {
    if (now >= nextBurst) { burst(); burst(); if (Math.random() < 0.7) burst(); nextBurst = now + 170; }
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
  const rnd = (a, b) => a + Math.random() * (b - a);
  const layers = [...k.layers, { move: 'pop', items: many(14, CONFETTI) }];
  const stages = layers.map((layer) => {
    const n = layer.items.length;
    const items = layer.items.map((emoji, i) => {
      const vars = {
        '--a': `${(360 / n) * i}deg`, '--rad': layer.rad ?? 'min(36vw,150px)', '--dir': layer.dir ?? 1,
        '--x': `${rnd(-4, 96).toFixed(1)}%`, '--y': `${rnd(4, 88).toFixed(1)}%`,
        '--d': `${(layer.move === 'march' ? i * 0.16 : rnd(0, 1.4)).toFixed(2)}s`, '--dur': `${rnd(1.1, 2.2).toFixed(2)}s`,
        '--s': rnd(0.7, 1.8).toFixed(2), '--r': `${Math.round(rnd(-720, 720))}deg`,
        '--bx': `${Math.round(rnd(-45, 45))}vw`, '--by': `${Math.round(rnd(-40, 40))}vh`,
        '--row': `${(8 + ((i * 37) % 80)).toFixed(0)}%`,
      };
      return el('span', { class: `fx-item fx-${layer.move}`, style: Object.entries(vars).map(([key, v]) => `${key}:${v}`).join(';') }, emoji);
    });
    return el('div', { class: `fx-stage fx-stage-${layer.move}` }, ...items);
  });
  const canvas = calm ? null : el('canvas', { class: 'fx-canvas', 'aria-hidden': 'true' });
  // No caption: the mess speaks for itself (the name is only read out by screen readers).
  const layer = el('div', { class: `fx-layer${calm ? ' calm' : ''}`, role: 'status', 'aria-live': 'polite', 'aria-label': k.title, 'data-key': 'fx' },
    calm ? null : el('div', { class: 'fx-strobe', 'aria-hidden': 'true' }),
    canvas, ...(calm ? stages.slice(0, 1) : stages),
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
