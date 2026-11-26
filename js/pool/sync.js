// Convention cards shared between partners by code (Plan 13, phase 6). Stored at cards/{code}:
//   { card: { v, name, base, picks, discuss, text, updated }, members: { a: creator uid, b?: partner uid }, created }
// Two fixed member slots, so the database rules can limit a card to two partners without counting.
// Who may write what (database.rules.cards.json, the same rules the memory store below enforces):
//   create  the whole record with members.a = my uid, only when the code is free
//   join    members/b = my uid, only while it is empty (and I am not the creator)
//   save    card, only by a member
// Every transport offers: uid · load(code) · watch(code, onShared) · create(code, card) · join(code) · save(code, card)
// load/watch give a normalized shared record or null; create/join/save resolve to true, or false when refused.
import { normalizeCard } from './card.js';
import { firebaseApp } from '../table/sync.js';

export const MAX_MEMBERS = 2;

// What the database returns (arrays as objects, empty objects missing) becomes a well-formed record, or null.
export function normalizeShared(raw) {
  if (!raw || typeof raw !== 'object' || !raw.card || typeof raw.card !== 'object') return null;
  const c = raw.card;
  const discuss = Array.isArray(c.discuss) ? c.discuss : c.discuss && typeof c.discuss === 'object' ? Object.values(c.discuss) : [];
  const card = normalizeCard({ ...c, discuss });
  const m = raw.members && typeof raw.members === 'object' ? raw.members : {};
  const members = [m.a, m.b].filter((u) => typeof u === 'string' && u);
  return { card: { ...card, updated: Number(c.updated) || 0 }, members, created: Number(raw.created) || 0 };
}

// The card as it is stored (no code: the code is the key).
export const storedCard = (card, now) => {
  const { code: _code, ...rest } = normalizeCard(card);
  return { ...rest, updated: now };
};

export const isMember = (shared, uid) => Boolean(shared && shared.members.includes(uid));
export const isFull = (shared) => Boolean(shared && shared.members.length >= MAX_MEMBERS);

// ---------- Firebase ----------
export async function firebaseCards(config, now = () => Date.now()) {
  const { db, database, uid } = await firebaseApp(config);
  const at = (code, path = '') => db.ref(database, `cards/${code}${path}`);
  const tryWrite = async (fn) => { try { await fn(); return true; } catch { return false; } };
  return {
    uid,
    async load(code) {
      try { return normalizeShared((await db.get(at(code))).val()); } catch { return null; }
    },
    watch(code, onShared) {
      return db.onValue(at(code), (snap) => onShared(normalizeShared(snap.val())), () => onShared(null));
    },
    async create(code, card) {
      try {
        const res = await db.runTransaction(at(code), (cur) => (cur ? undefined : { card: storedCard(card, now()), members: { a: uid }, created: now() }), { applyLocally: false });
        return res.committed;
      } catch {
        return false;
      }
    },
    join: (code) => tryWrite(() => db.set(at(code, '/members/b'), uid)),
    save: (code, card) => tryWrite(() => db.set(at(code, '/card'), storedCard(card, now()))),
  };
}

// ---------- In memory (tests) and browser tabs (?sync=local): the same rules, enforced here ----------
// read(code) / write(code, value) reach the shared data; written() is called after every accepted write.
function ruledStore(read, write, uid, now, written = () => {}) {
  const listeners = new Map();
  const emit = (code) => (listeners.get(code) ?? new Set()).forEach((f) => f(normalizeShared(read(code))));
  const change = (code, fn) => {
    const next = fn(read(code));
    if (next === undefined) return false;
    write(code, next);
    written(code);
    return true;
  };
  return {
    uid,
    emit,
    async load(code) { return normalizeShared(read(code)); },
    watch(code, onShared) {
      if (!listeners.has(code)) listeners.set(code, new Set());
      listeners.get(code).add(onShared);
      onShared(normalizeShared(read(code)));
      return () => listeners.get(code).delete(onShared);
    },
    async create(code, card) {
      return change(code, (cur) => (cur ? undefined : { card: storedCard(card, now()), members: { a: uid }, created: now() }));
    },
    async join(code) {
      return change(code, (cur) => {
        if (!cur || cur.members?.b || cur.members?.a === uid) return undefined;
        return { ...cur, members: { ...cur.members, b: uid } };
      });
    },
    async save(code, card) {
      return change(code, (cur) => (cur && (cur.members?.a === uid || cur.members?.b === uid) ? { ...cur, card: storedCard(card, now()) } : undefined));
    },
  };
}

// Several "devices" sharing one memory, for tests: memoryCards() returns (uid) => store.
export function memoryCards(now = () => Date.now()) {
  const data = new Map();
  const stores = [];
  const read = (code) => structuredClone(data.get(code) ?? null);
  const write = (code, v) => data.set(code, structuredClone(v));
  return (uid) => {
    const store = ruledStore(read, write, uid, now, (code) => stores.forEach((x) => x.emit(code)));
    stores.push(store);
    return store;
  };
}

// Browser tabs on one device (localStorage + storage events): each tab is a member of its own.
export function localCards(now = () => Date.now()) {
  const key = (code) => `bc:sharedcard:${code}`;
  let uid = sessionStorage.getItem('bc:uid');
  if (!uid) {
    uid = `local-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('bc:uid', uid);
  }
  const read = (code) => { try { return JSON.parse(localStorage.getItem(key(code)) ?? 'null'); } catch { return null; } };
  const write = (code, v) => localStorage.setItem(key(code), JSON.stringify(v));
  const store = ruledStore(read, write, uid, now, (code) => store.emit(code));
  window.addEventListener('storage', (e) => { if (e.key?.startsWith('bc:sharedcard:')) store.emit(e.key.slice('bc:sharedcard:'.length)); });
  return store;
}
