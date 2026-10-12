// How a table is shared between phones. Every transport offers the same three things:
//   uid                      this device's player id
//   watch(code, onTable)     calls onTable(table | null) now and on every change; returns an unsubscribe
//   change(code, fn)         atomically replaces the table with fn(table | null); fn returns undefined to cancel.
//                            Resolves to the committed table, or null when fn cancelled.
import { normalize } from './model.js';

const FIREBASE = '10.12.2';
const gstatic = (m) => `https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-${m}.js`;

// Firebase Realtime Database, anonymous sign-in. Loaded only when a table is opened.
export async function firebaseSync(config) {
  const [{ initializeApp }, { getAuth, signInAnonymously }, db] = await Promise.all([
    import(gstatic('app')), import(gstatic('auth')), import(gstatic('database')),
  ]);
  const app = initializeApp(config);
  const cred = await signInAnonymously(getAuth(app));
  const database = db.getDatabase(app);
  const at = (code) => db.ref(database, `tables/${code}`);
  return {
    uid: cred.user.uid,
    watch(code, onTable) {
      return db.onValue(at(code), (snap) => onTable(normalize(snap.val())), () => onTable(null));
    },
    async change(code, fn) {
      let cancelled = false;
      const res = await db.runTransaction(at(code), (cur) => {
        cancelled = false;
        const next = fn(normalize(cur));
        if (next !== undefined) return next;
        cancelled = true;
        // With no local copy yet, write nothing: the server answers with the real table and fn runs again.
        return cur === null ? null : undefined;
      }, { applyLocally: false });
      return res.committed && !cancelled ? normalize(res.snapshot.val()) : null;
    },
  };
}

// In-memory store shared by several "devices": for tests.
export function memoryHub() {
  const tables = new Map();
  const listeners = new Map();
  const emit = (code) => (listeners.get(code) ?? new Set()).forEach((f) => f(normalize(structuredClone(tables.get(code) ?? null))));
  return (uid) => ({
    uid,
    watch(code, onTable) {
      if (!listeners.has(code)) listeners.set(code, new Set());
      listeners.get(code).add(onTable);
      onTable(normalize(structuredClone(tables.get(code) ?? null)));
      return () => listeners.get(code).delete(onTable);
    },
    async change(code, fn) {
      const next = fn(normalize(structuredClone(tables.get(code) ?? null)));
      if (next === undefined) return null;
      tables.set(code, structuredClone(next));
      emit(code);
      return normalize(structuredClone(next));
    },
  });
}

// Browser tabs on one device (localStorage + storage events): to try a table without Firebase.
// Each tab is a separate player (its id lives in sessionStorage).
export function localSync() {
  const key = (code) => `bc:table:${code}`;
  let uid = sessionStorage.getItem('bc:uid');
  if (!uid) {
    uid = `local-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('bc:uid', uid);
  }
  const read = (code) => {
    try {
      return normalize(JSON.parse(localStorage.getItem(key(code)) ?? 'null'));
    } catch {
      return null;
    }
  };
  const local = new Map();
  return {
    uid,
    watch(code, onTable) {
      const onStorage = (e) => { if (e.key === key(code)) onTable(read(code)); };
      window.addEventListener('storage', onStorage);
      if (!local.has(code)) local.set(code, new Set());
      local.get(code).add(onTable);
      onTable(read(code));
      return () => { window.removeEventListener('storage', onStorage); local.get(code).delete(onTable); };
    },
    async change(code, fn) {
      const next = fn(read(code));
      if (next === undefined) return null;
      localStorage.setItem(key(code), JSON.stringify(next));
      (local.get(code) ?? new Set()).forEach((f) => f(read(code)));
      return read(code);
    },
  };
}
