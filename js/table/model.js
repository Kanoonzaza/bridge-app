// A shared table: four seats, the current board (bidding, then the play of the cards), and the boards already played.
// Pure functions only: every change returns a new table (or undefined when the change is not allowed),
// so the same code runs inside a Firebase transaction, in tests, and in the local two-tab mode.
import { SUITS, RANKS } from '../cards.js';
import { SEATS, legalCalls, isComplete, nextSeat, partnerOf, seatAt } from '../auction.js';
import { contract, playState, legalCards, controller, robotCard, splitPlay } from './play.js';

export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{6}$/;
export const KINDS = ['open', 'human', 'robot', 'pass'];
export const OPPONENTS = ['robot', 'pass', 'players'];
const HISTORY = 30;

// Standard duplicate rotation: board 1 dealer North, none vulnerable.
export const boardDealer = (n) => SEATS[(n - 1) % 4];
const VUL = ['none', 'NS', 'EW', 'both', 'NS', 'EW', 'both', 'none', 'EW', 'both', 'none', 'NS', 'both', 'none', 'NS', 'EW'];
export const boardVul = (n) => VUL[(n - 1) % 16];

// The table code in whatever was typed or pasted: the code itself, an invite link (?table=ABC234), or a sentence
// around it ("Table code: abc 234"). Returns '' when there is no valid code in it.
export function parseCode(text) {
  const t = String(text ?? '').toUpperCase();
  const fromLink = /[?&]TABLE=([A-Z0-9]{6})/.exec(t);
  if (fromLink && CODE.test(fromLink[1])) return fromLink[1];
  const squeezed = t.replace(/[^A-Z0-9]/g, '');
  if (CODE.test(squeezed)) return squeezed;
  return (t.match(/[A-Z0-9]{6}/g) ?? []).find((x) => CODE.test(x)) ?? '';
}

export function newCode(rand) {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]).join('');
}

// Hands are stored as "AKQ85.J7.Q84.QT5" (spades.hearts.diamonds.clubs): never empty, so no database drops them.
export const packHand = (h) => SUITS.map((s) => h[s]).join('.');
export function unpackHand(text) {
  const parts = String(text ?? '').split('.');
  return Object.fromEntries(SUITS.map((s, i) => [s, parts[i] ?? '']));
}

export function dealHands(rand) {
  const deck = SUITS.flatMap((s) => [...RANKS].map((r) => [s, r]));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const out = {};
  SEATS.forEach((seat, k) => {
    const h = { S: '', H: '', D: '', C: '' };
    for (const [s, r] of deck.slice(k * 13, k * 13 + 13)) h[s] += r;
    for (const s of SUITS) h[s] = [...h[s]].sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b)).join('');
    out[seat] = packHand(h);
  });
  return out;
}

function board(n, rand) {
  return { n, dealer: boardDealer(n), vul: boardVul(n), hands: dealHands(rand), calls: '', play: '', skip: false };
}

const splitCalls = (s) => (s ? String(s).split(' ').filter(Boolean) : []);

// Whatever the database returns (missing fields, arrays as objects) becomes a well-formed table, or null.
export function normalize(raw) {
  if (!raw || typeof raw !== 'object' || !raw.board) return null;
  const seats = {};
  for (const s of SEATS) {
    const v = raw.seats?.[s] ?? {};
    seats[s] = KINDS.includes(v.kind) ? { kind: v.kind, ...(v.kind === 'human' ? { uid: String(v.uid ?? ''), name: String(v.name ?? '').slice(0, 24) } : {}) } : { kind: 'open' };
  }
  const b = raw.board;
  const n = Number.isInteger(b.n) && b.n > 0 ? b.n : 1;
  const history = {};
  for (const [k, h] of Object.entries(raw.history ?? {})) if (h && typeof h === 'object') history[k] = { n: Number(k), dealer: h.dealer, vul: h.vul, hands: h.hands, calls: h.calls ?? '', play: h.play ?? '', skip: h.skip === true };
  return {
    code: String(raw.code ?? ''),
    created: Number(raw.created ?? 0),
    opponents: OPPONENTS.includes(raw.opponents) ? raw.opponents : 'robot',
    seats,
    board: { n, dealer: SEATS.includes(b.dealer) ? b.dealer : boardDealer(n), vul: VUL.includes(b.vul) ? b.vul : boardVul(n), hands: b.hands ?? {}, calls: b.calls ?? '', play: b.play ?? '', skip: b.skip === true },
    history,
    chat: normalChat(raw.chat),
    ...(normalUndo(raw.undoReq) ? { undoReq: normalUndo(raw.undoReq) } : {}),
  };
}

// ---------- Chat ----------
// The last messages of the table, oldest first: { id, uid, name, seat, text, at }.
export const CHAT_KEEP = 50;
export const CHAT_MAX = 200;
function normalChat(raw) {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
  return list.filter((m) => m && typeof m.text === 'string' && m.text)
    .map((m) => ({ id: Number(m.id ?? 0), uid: String(m.uid ?? ''), name: String(m.name ?? '').slice(0, 24), seat: SEATS.includes(m.seat) ? m.seat : '', text: m.text.slice(0, CHAT_MAX), at: Number(m.at ?? 0) }))
    .slice(-CHAT_KEEP);
}

// A seated player says something to the table. Returns undefined for an empty message or someone not seated.
export function say(t, uid, text, now = 0) {
  const seat = mySeat(t, uid);
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
  if (!seat || !clean) return undefined;
  const chat = t.chat ?? [];
  const id = (chat.at(-1)?.id ?? 0) + 1;
  return { ...t, chat: [...chat, { id, uid, name: t.seats[seat].name || 'Player', seat, text: clean, at: now }].slice(-CHAT_KEEP) };
}

// A pending take-back request (see requestUndo). need and ok are space-separated uids, so no database turns them into objects.
function normalUndo(u) {
  if (!u || typeof u !== 'object' || !u.uid || !['call', 'card'].includes(u.kind) || !Number.isInteger(u.i)) return null;
  return { uid: String(u.uid), n: Number(u.n ?? 0), kind: u.kind, i: u.i, len: Number(u.len ?? 0), need: String(u.need ?? ''), ok: String(u.ok ?? '') };
}

export function newTable({ code, uid, name, seat = 'S', opponents = 'robot', rand, now = 0 }) {
  const seats = Object.fromEntries(SEATS.map((s) => [s, { kind: 'open' }]));
  seats[seat] = { kind: 'human', uid, name };
  const t = { code, created: now, opponents: 'players', seats, board: board(1, rand), history: {} };
  return setOpponents(t, opponents) ?? t;
}

export const auctionOf = (b) => ({ dealer: b.dealer, vul: b.vul, calls: splitCalls(b.calls) });
export const handOf = (b, seat) => unpackHand(b.hands?.[seat]);
export const mySeat = (t, uid) => SEATS.find((s) => t.seats[s].kind === 'human' && t.seats[s].uid === uid) ?? null;
// isDone: the bidding is over. turn: whose call it is (null once the bidding is over).
export const isDone = (t) => isComplete(auctionOf(t.board));
export const turn = (t) => (isDone(t) ? null : nextSeat(auctionOf(t.board)));

// The play of the cards, once the bidding is over and there is a contract.
const allHands = (b) => Object.fromEntries(SEATS.map((s) => [s, handOf(b, s)]));
export const contractOf = (b) => contract(auctionOf(b));
export function playOf(b) {
  const k = isComplete(auctionOf(b)) ? contractOf(b) : null;
  return k ? playState(allHands(b), k, b.play) : null;
}
// bidding · play · over (passed out, all 13 tricks played, or the play was skipped).
export function phase(t) {
  if (!isDone(t)) return 'bidding';
  const st = playOf(t.board);
  return !st || st.complete || t.board.skip ? 'over' : 'play';
}
export const isOver = (t) => phase(t) === 'over';
// The seat whose card it is, and the seat whose player chooses it (declarer plays for dummy).
export const playTurn = (t) => (phase(t) === 'play' ? playOf(t.board).next : null);
export function actor(t) {
  const p = phase(t);
  if (p === 'bidding') return turn(t);
  if (p !== 'play') return null;
  const st = playOf(t.board);
  return controller(st, st.next);
}

export function playCard(t, seat, card, uid) {
  if (phase(t) !== 'play') return undefined;
  const st = playOf(t.board);
  if (st.next !== seat || !legalCards(st, seat).includes(card)) return undefined;
  const who = t.seats[controller(st, seat)];
  if (who.kind === 'human' ? who.uid !== uid : who.kind === 'open') return undefined;
  return { ...t, board: { ...t.board, play: [...splitPlay(t.board.play), card].join(' ') } };
}

// Stop playing this board: go straight to the review.
export const skipPlay = (t) => (phase(t) === 'play' ? { ...t, board: { ...t.board, skip: true } } : undefined);

// Take back my last card (or the card I played from dummy), and everything played after it.
export function lastOwnCard(t, uid) {
  const me = mySeat(t, uid);
  if (!me || phase(t) !== 'play') return -1;
  const st = playOf(t.board);
  const cards = splitPlay(t.board.play);
  const seats = [...st.tricks.flatMap((tr) => tr.cards), ...st.current].map((p) => p.seat);
  for (let i = cards.length - 1; i >= 0; i--) {
    if (controller(st, seats[i]) === me) return i;
  }
  return -1;
}
export function undoCard(t, uid) {
  const i = lastOwnCard(t, uid);
  if (i < 0) return undefined;
  return { ...t, board: { ...t.board, play: splitPlay(t.board.play).slice(0, i).join(' ') } };
}

// ---------- Taking a call or card back, as on Bridge Base Online ----------
// Anyone can ask to take back their last call (or card) and everything after it. Robots and always-pass seats
// never object; any other human who has called or played since must allow it first.
const length = (t) => (phase(t) === 'play' ? splitPlay(t.board.play).length : auctionOf(t.board).calls.length);

// What I would take back: { kind, i } or null.
function undoTarget(t, uid) {
  const i = phase(t) === 'play' ? lastOwnCard(t, uid) : lastOwnCall(t, uid);
  return i < 0 ? null : { kind: phase(t) === 'play' ? 'card' : 'call', i };
}

// The humans who acted after position i (they must allow it), other than uid.
function actedAfter(t, uid, { kind, i }) {
  const who = new Set();
  if (kind === 'call') {
    const a = auctionOf(t.board);
    for (let j = i + 1; j < a.calls.length; j++) { const st = t.seats[seatAt(a, j)]; if (st.kind === 'human' && st.uid !== uid) who.add(st.uid); }
  } else {
    const st = playOf(t.board);
    const seats = [...st.tricks.flatMap((tr) => tr.cards), ...st.current].map((p) => p.seat);
    for (let j = i + 1; j < seats.length; j++) { const h = t.seats[controller(st, seats[j])]; if (h.kind === 'human' && h.uid !== uid) who.add(h.uid); }
  }
  return [...who];
}

// The request that still applies (nothing has been called or played since it was made), or null.
export function pendingUndo(t) {
  const u = t.undoReq;
  if (!u || u.n !== t.board.n || u.len !== length(t) || u.kind !== (phase(t) === 'play' ? 'card' : 'call')) return null;
  return { ...u, need: u.need.split(' ').filter(Boolean), ok: u.ok.split(' ').filter(Boolean) };
}

const withoutRequest = (t) => { const { undoReq, ...rest } = t; return rest; };

// Ask to take back my last call or card. With nobody to ask (only robots after it) it happens at once.
export function requestUndo(t, uid) {
  const target = undoTarget(t, uid);
  if (!target || pendingUndo(t)) return undefined;
  const need = actedAfter(t, uid, target);
  if (!need.length) return withoutRequest(target.kind === 'card' ? undoCard(t, uid) : undo(t, uid));
  return { ...t, undoReq: { uid, n: t.board.n, kind: target.kind, i: target.i, len: length(t), need: need.join(' '), ok: '' } };
}

// A player who must allow the request says yes or no. When everyone has allowed it, it is done.
export function answerUndo(t, uid, yes) {
  const u = pendingUndo(t);
  if (!u || !u.need.includes(uid) || u.ok.includes(uid)) return undefined;
  if (!yes) return withoutRequest(t);
  const ok = [...u.ok, uid];
  if (u.need.every((x) => ok.includes(x))) {
    const done = u.kind === 'card' ? undoCard(t, u.uid) : undo(t, u.uid);
    return done ? withoutRequest(done) : withoutRequest(t);
  }
  return { ...t, undoReq: { ...t.undoReq, ok: ok.join(' ') } };
}

export const cancelUndo = (t, uid) => (pendingUndo(t)?.uid === uid ? withoutRequest(t) : undefined);

// The home pair (North-South: the table's creator and partner) chooses who sits East-West:
// robots, always pass, or open for players (anyone already seated there stays).
export function setOpponents(t, mode) {
  if (!OPPONENTS.includes(mode)) return undefined;
  const seats = { ...t.seats };
  for (const s of ['E', 'W']) {
    if (mode === 'players') seats[s] = seats[s].kind === 'human' ? seats[s] : { kind: 'open' };
    else seats[s] = { kind: mode };
  }
  return { ...t, opponents: mode, seats };
}

export function sit(t, seat, uid, name) {
  if (!SEATS.includes(seat) || !uid) return undefined;
  const cur = t.seats[seat];
  if (cur.kind === 'human' && cur.uid !== uid) return undefined;
  const seats = { ...t.seats };
  for (const s of SEATS) if (seats[s].kind === 'human' && seats[s].uid === uid) seats[s] = { kind: 'open' };
  seats[seat] = { kind: 'human', uid, name: String(name).slice(0, 24) };
  return { ...t, seats };
}

export function leave(t, uid) {
  const seat = mySeat(t, uid);
  if (!seat) return undefined;
  return { ...t, seats: { ...t.seats, [seat]: { kind: 'open' } } };
}

// A seat nobody has taken can be filled by a robot (e.g. partner is away), and freed again.
export function setSeatKind(t, seat, kind) {
  if (!SEATS.includes(seat) || !['open', 'robot'].includes(kind) || t.seats[seat].kind === 'human') return undefined;
  return { ...t, seats: { ...t.seats, [seat]: { kind } } };
}

export function call(t, seat, c, uid) {
  if (turn(t) !== seat) return undefined;
  const who = t.seats[seat];
  if (who.kind === 'human' ? who.uid !== uid : who.kind === 'open') return undefined;
  const a = auctionOf(t.board);
  if (!legalCalls(a).includes(c)) return undefined;
  return { ...t, board: { ...t.board, calls: [...a.calls, c].join(' ') } };
}

// The call a robot (or an always-pass seat) makes now; `advise` is the engine's Advisor.
// In the play, an always-pass seat plays like a robot.
export function robotCall(t, advise) {
  const seat = turn(t);
  if (!seat) return undefined;
  const kind = t.seats[seat].kind;
  if (kind === 'pass') return 'P';
  if (kind !== 'robot') return undefined;
  const r = advise(handOf(t.board, seat), auctionOf(t.board));
  return r.notCovered ? 'P' : r.call;
}

// chosen: a card (play) or call (bidding) already worked out for this robot by simulation; otherwise the rule-based choice.
export function playRobot(t, advise, chosen = null) {
  if (phase(t) === 'play') {
    const st = playOf(t.board);
    if (!['robot', 'pass'].includes(t.seats[controller(st, st.next)].kind)) return undefined;
    const card = chosen && legalCards(st, st.next).includes(chosen) ? chosen : robotCard(st, st.next, auctionOf(t.board));
    return card ? { ...t, board: { ...t.board, play: [...splitPlay(t.board.play), card].join(' ') } } : undefined;
  }
  // In the bidding, `chosen` is a call from the simulation; it is used only when it is legal.
  const c = chosen && legalCalls(auctionOf(t.board)).includes(chosen) ? chosen : robotCall(t, advise);
  return c === undefined ? undefined : call(t, turn(t), c);
}

export function nextBoard(t, rand) {
  if (!isOver(t)) return undefined;
  const history = { ...t.history, [t.board.n]: { ...t.board } };
  const keys = Object.keys(history).map(Number).sort((a, b) => a - b);
  for (const k of keys.slice(0, Math.max(0, keys.length - HISTORY))) delete history[k];
  return { ...t, board: board(t.board.n + 1, rand), history };
}

// Take back my last call and everything called after it (any player can do this, whoever has called since).
// Returns undefined when I have not called or the play has started.
export function lastOwnCall(t, uid) {
  const me = mySeat(t, uid);
  if (!me || (isDone(t) && t.board.play)) return -1;
  const a = auctionOf(t.board);
  for (let i = a.calls.length - 1; i >= 0; i--) {
    if (seatAt(a, i) === me) return i;
  }
  return -1;
}
export function undo(t, uid) {
  const i = lastOwnCall(t, uid);
  if (i < 0) return undefined;
  return { ...t, board: { ...t.board, calls: auctionOf(t.board).calls.slice(0, i).join(' ') } };
}

// Restart the current board's bidding (same cards), e.g. after a mis-click.
export function rebid(t) {
  return t.board.calls ? { ...t, board: { ...t.board, calls: '', play: '', skip: false } } : undefined;
}

export const partnerSeat = partnerOf;
