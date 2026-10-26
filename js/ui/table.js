import { SUITS, SYMBOL, evaluate, suitOrder } from '../cards.js';
import { SEATS, partnerOf, sideOf, seatAt } from '../auction.js';
import { advise, explain, summarize } from '../engine.js';
import { callLabel, rankLabel } from '../format.js';
import { FIREBASE, NOTES_URL } from '../config.js';
import { firebaseSync, localSync } from '../table/sync.js';
import {
  CODE, parseCode, seatsAtBidding, say, restoreChat, chatKey, newCode, newTable, auctionOf, handOf, mySeat, isDone, turn,
  setOpponents, sit, leave, setSeatKind, PROTO, prank, hostOf, kick, allowBack, moveSeat, takeOver, giveBack, keepRobot, choicePending, autoDeclare, call, playRobot, nextBoard, rebid, undo, lastOwnCall,
  phase, isOver, actor, playOf, playCard, skipPlay, undoCard, lastOwnCard, claimChance, pendingClaim, requestClaim, answerClaim, cancelClaim, requestUndo, answerUndo, cancelUndo, pendingUndo,
} from '../table/model.js';
import { legalCards, controller, splitPlay, playState } from '../table/play.js';
import { sharedPool, poolChoose } from '../table/pool.js';
import { simulatedAdvice } from '../sim-advice.js';
import { resultText } from '../report.js';
import { reviewRows, systemAuction, contract } from '../table/review.js';
import { el, segmented, keepFocus } from './dom.js';
import { playFx, toast, FX_KINDS } from './fx.js';
import { confRow } from './conf.js';
import { biddingBox } from './bidding-box.js';
import { copyButton } from './copy.js';
import { parLine, tableRows } from '../table/ddtext.js';
import { boardReport } from '../report.js';

const COMPASS = { N: 'North', E: 'East', S: 'South', W: 'West' };
const VUL_TEXT = { none: 'None vulnerable', NS: 'N-S vulnerable', EW: 'E-W vulnerable', both: 'Both vulnerable' };
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;

function cleanSaved(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    code: CODE.test(r.code ?? '') ? r.code : '',
    name: typeof r.name === 'string' ? r.name.slice(0, 24) : '',
    hints: r.hints !== false,
    autoTake: r.autoTake !== false,
    handStyle: r.handStyle === 'list' ? 'list' : 'cards',
    chatOpen: r.chatOpen === true,
    chatDraft: typeof r.chatDraft === 'string' ? r.chatDraft.slice(0, 200) : '',
    // What this phone has seen said at the table it is at: kept here too, so a reload or a lost write never empties the chat.
    boards: Array.isArray(r.boards) ? r.boards.filter((x) => x && typeof x.id === 'string' && x.board && typeof x.board.hands === 'object' && typeof x.board.calls === 'string' && x.seats && typeof x.seats === 'object').slice(-100) : [],
    chatCode: typeof r.chatCode === 'string' ? r.chatCode : '',
    chatLog: Array.isArray(r.chatLog) ? r.chatLog.filter((m) => m && typeof m.text === 'string' && m.text).slice(-200).map((m) => ({ uid: String(m.uid ?? ''), name: String(m.name ?? '').slice(0, 24), seat: String(m.seat ?? ''), text: m.text.slice(0, 200), at: Number(m.at) || 0 })) : [],
  };
}

// Who a seat is, seen from my seat.
function relative(me, s) {
  if (!me) return COMPASS[s];
  if (s === me) return 'You';
  if (s === partnerOf(me)) return 'Partner';
  return SEATS[(SEATS.indexOf(me) + 1) % 4] === s ? 'Left' : 'Right';
}

function handView(hand, title) {
  const e = evaluate(hand);
  return el('div', { class: 'hand' },
    title ? el('div', { class: 'label' }, `${title} · ${e.hcp} HCP`) : el('div', { class: 'label' }, `${e.hcp} HCP`),
    ...SUITS.map((s) => el('div', { class: 'hand-row' },
      el('span', { class: `suit${s === 'H' || s === 'D' ? ' red' : ''}` }, SYMBOL[s]),
      el('span', {}, hand[s] ? [...hand[s]].map(rankLabel).join(' ') : '—'))));
}

export function tableView(root, store) {
  const saved = cleanSaved(store.load('table', {}));
  const params = new URLSearchParams(location.search);
  const urlCode = parseCode(params.get('table') ?? '');
  const mode = params.get('sync') === 'local' ? 'local' : FIREBASE ? 'firebase' : 'none';
  const ui = { peek: {}, open: { chat: saved.chatOpen }, claiming: false, claimN: null, chatDraft: saved.chatDraft, chatSeen: 0, sync: null, table: null, unwatch: null, error: '', joinCode: CODE.test(urlCode) ? urlCode : '', busy: false, hint: null, robotKey: '', prev: false, dd: new Map(), pv: new Map(), pvAt: new Map() };
  if (CODE.test(urlCode) && urlCode !== saved.code) saved.code = '';

  const save = () => store.save('table', saved);

  async function connect() {
    if (ui.sync) return ui.sync;
    // The database libraries load from the internet: stop waiting when they do not come.
    let timer;
    const late = new Promise((_, no) => { timer = setTimeout(() => no(new Error('no answer from the server')), 20000); });
    try {
      ui.sync = mode === 'local' ? localSync() : await Promise.race([firebaseSync(FIREBASE), late]);
    } finally {
      clearTimeout(timer);
    }
    const raw = ui.sync;
    ui.sync = { ...raw, change: (code, fn) => raw.change(code, (cur) => { const next = fn(cur); return next === undefined || next === null ? next : { ...next, proto: PROTO }; }) };
    return ui.sync;
  }

  // Joining ends when the table first answers, is not found, or does not answer in time.
  function settleJoin() {
    clearTimeout(ui.joinTimer);
    ui.joining = '';
    ui.busy = false;
  }

  function watch(code) {
    ui.unwatch?.();
    ui.sawProto = false;
    ui.fxSeen = undefined;
    ui.unwatch = ui.sync.watch(code, (t) => {
      const joining = ui.joining === code;
      // The stamp this version leaves on every write is gone: a phone with an older version rewrote the table.
      if (t?.proto) ui.sawProto = true;
      ui.stale = t ? (ui.sawProto && !t.proto ? 'old' : t.proto > PROTO ? 'new' : '') : '';
      if (joining) settleJoin();
      ui.table = t;
      if (t) { mirrorChat(t); chatBubbles(t); }
      if (!t) {
        ui.error = `Table ${code} was not found. Check the code with whoever made the table.`;
        if (joining) { saved.code = ''; save(); ui.unwatch?.(); ui.unwatch = null; }
      }
      ui.hint = null;
      // A surprise for me: show each one once (what was already there when the table opened is not replayed).
      if (t?.fx) {
        if (ui.fxSeen === undefined) ui.fxSeen = t.fx.n;
        else if (t.fx.n > ui.fxSeen) {
          ui.fxSeen = t.fx.n;
          if (t.fx.to === ui.sync.uid) playFx(t.fx.kind, t.fx.name);
        }
      } else if (t && ui.fxSeen === undefined) ui.fxSeen = 0;
      // Alone with robots and my partner (a robot) declares: take the contract over, unless I turned that off.
      if (t && saved.autoTake && choicePending(t) && autoDeclare(t) !== t) act((cur) => cur && autoDeclare(cur));
      // Start the solvers while the board is being read, if a robot will need them.
      if (t && !ui.warmed && SEATS.some((x) => t.seats[x].kind === 'robot')) {
        ui.warmed = true;
        try { sharedPool().warm(); } catch { /* no workers: the rule-based robots play */ }
      }
      driveRobots();
      render();
    }, (err) => {
      // The server refused the read (database rules) or the connection broke.
      if (ui.joining === code) { settleJoin(); saved.code = ''; save(); }
      fail(`The table server did not allow this (${err?.code ?? err?.message ?? err}).`);
    });
  }

  // New chat messages float over the top of the table for a few seconds (the board stays in view and usable).
  // What was already said when the table opened is not shown again.
  const BUBBLE_MS = 5000;
  function chatBubbles(t) {
    const keys = (t.chat ?? []).map(chatKey);
    if (ui.bubbleCode !== t.code) { ui.bubbleCode = t.code; ui.bubbleSeen = new Set(keys); ui.bubbles = []; return; }
    const fresh = (t.chat ?? []).filter((m) => !ui.bubbleSeen.has(chatKey(m)));
    if (!fresh.length) return;
    for (const m of fresh) ui.bubbleSeen.add(chatKey(m));
    const now = Date.now();
    ui.bubbles = [...(ui.bubbles ?? []).filter((b) => now - b.at < BUBBLE_MS), ...fresh.map((m) => ({ key: chatKey(m), name: m.name || 'Player', seat: m.seat, text: m.text, at: now }))].slice(-3);
    clearTimeout(ui.bubbleTimer);
    const next = () => {
      const left = (ui.bubbles ?? []).filter((b) => Date.now() - b.at < BUBBLE_MS);
      if (left.length !== ui.bubbles.length) { ui.bubbles = left; render(); }
      if (left.length) ui.bubbleTimer = setTimeout(next, Math.max(50, BUBBLE_MS - (Date.now() - left[0].at)));
    };
    ui.bubbleTimer = setTimeout(next, BUBBLE_MS);
  }
  function bubblesOnTable(me) {
    const now = Date.now();
    const list = (ui.bubbles ?? []).filter((b) => now - b.at < BUBBLE_MS);
    if (!list.length) return null;
    // A negative delay keeps each bubble's fade where it was when the table is drawn again.
    return el('div', { class: 'chat-bubbles', 'aria-live': 'polite' }, ...list.map((b) => el('div', { class: 'chat-bubble', style: `animation-delay:-${now - b.at}ms` },
      el('b', {}, `${b.seat && me ? relative(me, b.seat) === 'You' ? 'You' : b.name : b.name}: `), b.text.length > 90 ? `${b.text.slice(0, 88)}…` : b.text)));
  }

  // Keep a copy of the table's chat on this phone, and put back anything the table has lost.
  function mirrorChat(t) {
    if (saved.chatCode !== t.code) { saved.chatCode = t.code; saved.chatLog = []; }
    const have = new Set(saved.chatLog.map(chatKey));
    const fresh = (t.chat ?? []).filter((m) => !have.has(chatKey(m)));
    if (fresh.length) {
      saved.chatLog = [...saved.chatLog, ...fresh.map(({ uid, name, seat, text, at }) => ({ uid, name, seat, text, at }))].sort((a, b) => a.at - b.at).slice(-200);
      save();
    }
    const onTable = new Set((t.chat ?? []).map(chatKey));
    const lost = saved.chatLog.filter((m) => !onTable.has(chatKey(m)));
    if (lost.length && ui.sync && mySeat(t, ui.sync.uid) && Date.now() - (ui.lastHeal ?? 0) > 4000) {
      ui.lastHeal = Date.now();
      act((cur) => cur && restoreChat(cur, lost));
    }
  }

  async function act(fn, failure) {
    if (!ui.table) return;
    let res;
    try {
      res = await ui.sync.change(ui.table.code, fn);
    } catch (err) {
      ui.error = `The table server did not accept that (${err?.code ?? err?.message ?? err}). If this keeps happening, update the app on every phone at the table.`;
      render();
      return;
    }
    if (!res && failure) {
      ui.error = failure;
      render();
    }
  }

  // Robots (and always-pass seats) bid on every phone at the table; the transaction lets only one call through.
  // The key only stops a second attempt while one is pending. Once it settles the key is cleared, so the same
  // position is played again after a take-back, and a write that failed (a dropped connection) is retried.
  // In the play, a robot's card comes from the double-dummy robot: sampled deals solved in parallel by a pool of
  // background workers (one per processor core, like the robots on Bridge Base Online); if that is unavailable or
  // slow, the rule-based robot plays instead.
  async function ddCard(t) {
    try {
      const pool = sharedPool();
      const b = t.board;
      const rows = explain(auctionOf(b), undefined, { general: true });
      const r = await poolChoose(pool, {
        hands: Object.fromEntries(SEATS.map((s) => [s, handOf(b, s)])),
        contract: playOf(b).contract,
        play: b.play,
        constraints: Object.fromEntries(SEATS.map((s) => [s, summarize(rows, s)])),
        total: 16 * pool.size,
      });
      return r?.card ?? null;
    } catch {
      return null;
    }
  }

  // A robot's judgment call in the bidding is checked by simulation; null means "use the rule-based call".
  async function ddBid(t) {
    const s = turn(t);
    if (!s || t.seats[s].kind !== 'robot') return null;
    const a = auctionOf(t.board);
    const hand = handOf(t.board, s);
    const sim = await simulatedAdvice(hand, a, advise(hand, a));
    return sim?.sim?.changed ? sim.call : null;
  }

  // A robot waits a little before acting; after a finished trick it waits until the trick has slid off the table.
  function robotPause(t) {
    const st = phase(t) === 'play' ? playOf(t.board) : null;
    return st && st.tricks.length && !st.current.length && !reduceMotion() ? TRICK_STAY + TRICK_OUT + 100 : 600;
  }

  function driveRobots() {
    const t = ui.table;
    if (!t || isOver(t) || choicePending(t)) return;
    const s = actor(t);
    if (!['robot', 'pass'].includes(t.seats[s].kind)) return;
    const key = `${t.code}:${t.board.n}:${t.board.calls}:${t.board.play}`;
    if (ui.robotKey === key) return;
    ui.robotKey = key;
    setTimeout(async () => {
      let failed = false;
      try {
        const chosen = phase(t) === 'play' ? await ddCard(t) : phase(t) === 'bidding' ? await ddBid(t) : null;
        await ui.sync.change(t.code, (cur) => (cur && cur.board.n === t.board.n && cur.board.calls === t.board.calls && cur.board.play === t.board.play ? playRobot(cur, advise, chosen) : undefined));
      } catch {
        failed = true;
      }
      if (ui.robotKey !== key) return;
      ui.robotKey = '';
      // Still this robot's turn (the write failed): try again shortly.
      if (failed) setTimeout(driveRobots, 2000);
    }, robotPause(t));
  }

  async function start(opponents) {
    if (!saved.name.trim()) return fail('Enter your name first.');
    ui.busy = true;
    render();
    try {
      await connect();
      for (let tries = 0; tries < 5; tries++) {
        const code = newCode(rand);
        const t = await ui.sync.change(code, (cur) => (cur ? undefined : newTable({ code, uid: ui.sync.uid, name: saved.name.trim(), seat: 'S', opponents, rand, now: Date.now() })));
        if (t) {
          saved.code = code;
          save();
          ui.busy = false;
          watch(code);
          return;
        }
      }
      fail('Could not create a table. Try again.');
    } catch (err) {
      fail(`Could not connect. Check the internet connection and try again. (${err.message ?? err})`);
    }
  }

  async function open(code) {
    ui.error = '';
    if (!saved.name.trim()) return fail('Enter your name first, then press Join.', 'tbl-name');
    code = parseCode(code);
    if (!CODE.test(code)) return fail('A table code has 6 letters and digits (no 0, 1, I or O). You can also paste the invite link.', 'tbl-code');
    ui.busy = true;
    ui.joining = code;
    saved.code = code;
    save();
    render();
    clearTimeout(ui.joinTimer);
    ui.joinTimer = setTimeout(() => {
      if (ui.joining !== code) return;
      settleJoin();
      ui.unwatch?.();
      ui.unwatch = null;
      saved.code = '';
      save();
      fail(`No answer for table ${code}. Check the code and the internet connection, then press Join again.`);
    }, 20000);
    try {
      await connect();
      if (ui.joining !== code) return;
      watch(code);
      // Take the first free seat of North/South, then East/West, unless already seated.
      await ui.sync.change(code, (t) => {
        if (!t || mySeat(t, ui.sync.uid)) return undefined;
        const free = ['N', 'S', 'E', 'W'].find((s) => t.seats[s].kind === 'open');
        return free ? sit(t, free, ui.sync.uid, saved.name.trim()) : undefined;
      });
    } catch (err) {
      if (ui.joining === code) settleJoin();
      saved.code = '';
      save();
      fail(`Could not connect. Check the internet connection and try again. (${err.message ?? err})`);
    }
  }

  function fail(msg, focusKey) {
    ui.busy = false;
    ui.error = msg;
    render();
    if (focusKey) root.querySelector(`[data-key="${focusKey}"]`)?.focus();
  }

  function exit() {
    const t = ui.table;
    if (t) ui.sync.change(t.code, (cur) => (cur ? leave(cur, ui.sync.uid) : undefined));
    ui.unwatch?.();
    ui.unwatch = null;
    ui.table = null;
    ui.error = '';
    saved.code = '';
    save();
    history.replaceState(null, '', location.pathname + (mode === 'local' ? '?sync=local' : ''));
    render();
  }

  function share(code) {
    const url = `${location.origin}${location.pathname}?table=${code}${mode === 'local' ? '&sync=local' : ''}`;
    const text = `Bid with me on Bridge Coach: table ${code}`;
    if (navigator.share) navigator.share({ title: 'Bridge Coach table', text, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => { ui.error = 'Link copied.'; render(); }, () => {});
  }

  // ---------- Views ----------
  function lobby() {
    if (mode === 'none') {
      return el('div', { class: 'panel muted' }, 'Live tables are being set up. They will work as soon as the app is connected to its database.');
    }
    return el('div', { class: 'stack' },
      ui.error ? el('p', { class: 'notice', role: 'alert' }, ui.error) : null,
      el('div', {},
        el('label', { class: 'label', for: 'tbl-name' }, 'Your name'),
        el('input', { id: 'tbl-name', 'data-key': 'tbl-name', class: 'field', value: saved.name, maxlength: 24, autocomplete: 'nickname', oninput: (e) => { saved.name = e.target.value; save(); } })),
      el('div', { class: 'panel' },
        el('div', { class: 'eyebrow' }, 'Start a table'),
        el('p', { class: 'muted' }, 'You sit South. Share the link with your partner (North). Opponents:'),
        el('div', { class: 'row-buttons' },
          el('button', { type: 'button', class: 'pill', 'data-key': 'start-robot', disabled: ui.busy, onclick: () => start('robot') }, 'Robots'),
          el('button', { type: 'button', class: 'pill', 'data-key': 'start-pass', disabled: ui.busy, onclick: () => start('pass') }, 'Always pass'),
          el('button', { type: 'button', class: 'pill', 'data-key': 'start-players', disabled: ui.busy, onclick: () => start('players') }, 'Players'))),
      el('div', { class: 'panel' },
        el('div', { class: 'eyebrow' }, 'Join a table'),
        el('div', { class: 'join' },
          el('input', { 'data-key': 'tbl-code', class: 'field code', value: ui.joinCode, maxlength: 200, placeholder: 'CODE or invite link', autocapitalize: 'characters', 'aria-label': 'Table code', oninput: (e) => { ui.joinCode = e.target.value.toUpperCase(); } }),
          el('button', { type: 'button', class: 'pill on', 'data-key': 'join', disabled: ui.busy, onclick: () => open(ui.joinCode) }, 'Join'))),
      savedBoards());
  }

  const autoBox = () => el('label', { class: 'muted' }, el('input', { type: 'checkbox', 'data-key': 'auto-take', checked: saved.autoTake, onchange: (e) => { saved.autoTake = e.target.checked; save(); } }), ' Always take over when I am alone with robots');

  // Before the first card: take over a robot partner's contract, or hand it back to the robot.
  function declarerChoice(t) {
    if (phase(t) !== 'play' || t.board.play) return null;
    const uid = ui.sync.uid;
    if (takeOver(t, uid)) {
      return el('div', { class: 'panel row-buttons', 'data-key': 'declarer-choice' },
        el('span', {}, 'Your partner (a robot) is the declarer.'),
        el('button', { type: 'button', class: 'pill on', 'data-key': 'take-declarer', onclick: () => act((cur) => cur && takeOver(cur, uid), 'The first card has already been played.') }, 'Play it myself'),
        el('button', { type: 'button', class: 'pill', 'data-key': 'keep-robot', onclick: () => act((cur) => cur && keepRobot(cur, uid)) }, 'Let the robot play it'),
        el('label', { class: 'muted' }, el('input', { type: 'checkbox', 'data-key': 'auto-take', checked: saved.autoTake, onchange: (e) => { saved.autoTake = e.target.checked; save(); } }), ' Always take over when I am alone with robots'));
    }
    if (giveBack(t, uid)) {
      return el('div', { class: 'panel row-buttons', 'data-key': 'declarer-choice' },
        el('span', {}, 'You are playing the contract your robot partner bid.'),
        el('button', { type: 'button', class: 'pill', 'data-key': 'give-declarer', onclick: () => act((cur) => cur && giveBack(cur, uid), 'The first card has already been played.') }, 'Let the robot play it'),
        autoBox());
    }
    return null;
  }

  function seatsView(t, me) {
    const isHost = hostOf(t) === ui.sync.uid;
    const moving = isHost && ui.moving && t.seats[ui.moving]?.kind === 'human' ? ui.moving : null;
    if (ui.moving && !moving) ui.moving = null;
    const removed = t.kicked?.[ui.sync.uid];
    return el('div', {},
      removed ? el('p', { class: 'notice', role: 'status' }, 'The host removed you from this table. You can watch, but not sit, unless the host lets you back.') : null,
      el('div', { class: 'seats' }, ...['N', 'W', 'E', 'S'].map((s) => {
        const st = t.seats[s];
        const who = st.kind === 'human' ? st.name || 'Player' : st.kind === 'robot' ? 'Robot' : st.kind === 'pass' ? 'Always passes' : 'Empty';
        const actions = [];
        if (st.kind === 'open') {
          if (!removed) actions.push(el('button', { type: 'button', class: 'pill', 'data-key': `sit-${s}`, onclick: () => act((cur) => cur && sit(cur, s, ui.sync.uid, saved.name.trim() || 'Player')) }, me ? 'Move here' : 'Sit here'));
          actions.push(el('button', { type: 'button', class: 'pill', 'data-key': `robot-${s}`, onclick: () => act((cur) => cur && setSeatKind(cur, s, 'robot')) }, 'Robot'));
        } else if (st.kind === 'robot' && me && sideOf(s) === sideOf(me)) {
          actions.push(el('button', { type: 'button', class: 'pill', 'data-key': `free-${s}`, onclick: () => act((cur) => cur && setSeatKind(cur, s, 'open')) }, 'Free seat'));
        }
        if (isHost) {
          if (moving && s !== moving && ['open', 'human'].includes(st.kind)) {
            actions.push(el('button', { type: 'button', class: 'pill on', 'data-key': `put-${s}`, onclick: () => { const from = moving; ui.moving = null; act((cur) => cur && moveSeat(cur, ui.sync.uid, from, s), 'That move is not possible now.'); render(); } }, `Put ${t.seats[moving].name || 'player'} here`));
          } else if (moving === s) {
            actions.push(el('button', { type: 'button', class: 'pill', 'data-key': 'move-cancel', onclick: () => { ui.moving = null; render(); } }, 'Cancel move'));
          } else if (st.kind === 'human' && st.uid !== ui.sync.uid && !moving) {
            actions.push(el('button', { type: 'button', class: 'pill', 'data-key': `move-${s}`, onclick: () => { ui.moving = s; render(); } }, 'Move'));
            actions.push(el('button', { type: 'button', class: 'pill', 'data-key': `kick-${s}`, onclick: () => { if (confirm(`Remove ${st.name || 'this player'} from the table?`)) act((cur) => cur && kick(cur, ui.sync.uid, s), 'Only the host can remove a player.'); } }, 'Remove'));
          }
        }
        const tag = st.kind === 'human' && st.uid === hostOf(t) ? ' · host' : '';
        return el('div', { class: `seat seat-${s}${s === me ? ' me' : ''}${nowAt(t) === s ? ' turn' : ''}` },
          el('div', { class: 'label' }, `${COMPASS[s]}${me ? ` · ${relative(me, s)}` : ''}${tag}`),
          el('div', { class: 'seat-name' }, who),
          actions.length ? el('div', { class: 'row-buttons' }, ...actions) : null);
      })),
      isHost && t.kicked ? el('div', { class: 'stack' }, ...Object.entries(t.kicked).map(([uid, name]) =>
        el('div', { class: 'row-buttons' }, el('span', { class: 'muted' }, `${name} was removed`),
          el('button', { type: 'button', class: 'pill', 'data-key': `allow-${uid}`, onclick: () => act((cur) => cur && allowBack(cur, ui.sync.uid, uid)) }, 'Allow back')))) : null);
  }

  // ---------- The table, drawn like a card table: partner on top, opponents left and right, me at the bottom ----------
  const isVul = (b, s) => b.vul === 'both' || b.vul === sideOf(s);
  const around = (me) => {
    const m = me ?? 'S';
    const i = SEATS.indexOf(m);
    return { bottom: m, left: SEATS[(i + 1) % 4], top: SEATS[(i + 2) % 4], right: SEATS[(i + 3) % 4] };
  };

  // Tapping a player's name sends them a surprise (a random gag over their screen); tapping my own shows it to me.
  function surprise(t, s, me) {
    const st = t.seats[s];
    if (st.kind !== 'human') return;
    const kind = Math.floor(Math.random() * FX_KINDS.length);
    if (s === me) { playFx(kind, '', { haptic: true }); return; }
    if (!me) return;
    if (Date.now() - (ui.lastFx ?? 0) < 6000) { toast('Easy: one surprise every few seconds.'); return; }
    ui.lastFx = Date.now();
    act((cur) => cur && prank(cur, ui.sync.uid, s, kind), 'That surprise did not go through.');
    toast(`Surprise sent to ${st.name || 'Player'} 🎉`);
  }

  function plate(t, s, me) {
    const st = t.seats[s];
    const name = st.kind === 'human' ? st.name || 'Player' : st.kind === 'robot' ? 'Robot' : st.kind === 'pass' ? 'Passes' : 'Empty';
    const b = t.board;
    const tappable = st.kind === 'human';
    return el('div', {
      class: `plate${nowAt(t) === s ? ' turn' : ''}${s === me ? ' me' : ''}`,
      title: `${COMPASS[s]}: ${name}${tappable ? ' (tap for a surprise)' : ''}`,
      ...(tappable ? { role: 'button', tabindex: '0', 'aria-label': `${name}: ${s === me ? 'preview a surprise' : 'send a surprise'}`, 'data-key': `plate-${s}`, onclick: () => surprise(t, s, me), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); surprise(t, s, me); } } } : {}),
    },
      el('span', { class: `dir${isVul(b, s) ? ' vul' : ''}` }, s),
      el('span', { class: 'pname' }, name),
      b.dealer === s ? el('span', { class: 'dealer', 'aria-label': 'Dealer' }, 'D') : null);
  }

  const backs = (n, cls = '') => el('div', { class: `backs${cls}`, 'aria-hidden': 'true' }, ...Array.from({ length: n }, () => el('span', { class: 'back' })));

  function boardBox(t, me) {
    const b = t.board;
    const pos = around(me);
    const edge = (where) => (isVul(b, pos[where]) ? ' vul' : '');
    const live = ui.table && ui.table.code === t.code ? ui.table : null;
    const viewing = !!live && b.n !== live.board.n;
    const target = live ? (viewing ? 0 : live.history[b.n - 1] ? b.n - 1 : 0) : 0;
    const cls = `bnum${edge('top') ? ' vt' : ''}${edge('bottom') ? ' vb' : ''}${edge('left') ? ' vl' : ''}${edge('right') ? ' vr' : ''}`;
    const label = `Board ${b.n}, dealer ${COMPASS[b.dealer]}, ${VUL_TEXT[b.vul]}`;
    // During the play, with a trick already played, the board number flashes the last trick.
    const st = live && !viewing && phase(live) === 'play' ? playOf(live.board) : null;
    if (st && st.tricks.length) {
      return el('button', { type: 'button', class: `${cls} tap`, 'data-key': 'board-number', 'aria-label': `${label}. Tap to see the last trick`, title: 'Tap to see the last trick for a moment', onclick: () => showLastTrick(live) },
        el('span', {}, String(b.n)));
    }
    if (!live || (!viewing && !target)) return el('div', { class: cls, 'aria-label': label }, el('span', {}, String(b.n)));
    return el('button', { type: 'button', class: `${cls} tap`, 'data-key': 'board-number', 'aria-label': `${label}. ${viewing ? 'Tap to go back to the current board' : 'Tap to see the last board and its play'}`, title: viewing ? 'Back to the current board' : 'Tap to see the last board', onclick: () => { ui.prev = target || false; render(); } },
      el('span', {}, String(b.n)));
  }

  function auctionBox(t, me) {
    const a = auctionOf(t.board);
    const pos = around(me);
    const cols = [pos.left, pos.top, pos.right, pos.bottom];
    const cells = [];
    for (let i = 0; i < cols.indexOf(a.dealer); i++) cells.push(el('span', { class: 'cell' }));
    a.calls.forEach((c, i) => cells.push(el('span', { class: `cell${seatAt(a, i) === me ? ' mine' : ''}` }, callLabel(c))));
    if (!isDone(t)) cells.push(el('span', { class: 'cell next' }, '?'));
    return el('div', { class: 'abox', role: 'table', 'aria-label': 'Auction' },
      el('div', { class: 'ahead' }, ...cols.map((s) => el('span', { class: `${isVul(t.board, s) ? 'vul' : ''}${s === me ? ' me' : ''}`, title: relative(me, s) }, s))),
      el('div', { class: 'abody' }, ...cells));
  }

  // My hand as cards or as a list (each phone remembers its choice).
  function myHand(hand) {
    const asCards = saved.handStyle === 'cards';
    return el('div', { class: 'my-hand' },
      asCards ? cards(hand) : handView(hand, 'Your hand'),
      el('div', { class: 'hand-switch' },
        el('button', { type: 'button', class: 'pill small', 'data-key': 'hand-style', onclick: () => { saved.handStyle = asCards ? 'list' : 'cards'; save(); render(); } }, asCards ? 'Show as list' : 'Show as cards')));
  }

  // The seat to call or play now (during the play: the seat whose card it is, dummy included).
  const nowAt = (t) => (phase(t) === 'play' ? playOf(t.board).next : turn(t));

  // The trick on the table, each card in front of its player; between tricks, the last trick.
  // The table's centre: the trick being played, or the last one between tricks. Tapping the board number shows the last
  // finished trick for a moment (ui.back = 1; 0 = the normal view).
  function trickBox(t, me, st) {
    const pos = around(me);
    const n = st.tricks.length;
    const back = reviewBack(t, st);
    const old = back ? st.tricks[n - back] : null;
    const last = old ?? st.tricks.at(-1);
    const shown = old ? old.cards : st.current.length ? st.current : last ? last.cards : [];
    // Where each shown card sits in the whole play (to know when it arrived).
    const first = old ? (n - back) * 4 : st.current.length ? n * 4 : (n - 1) * 4;
    const at = Object.fromEntries(shown.map((p, i) => [p.seat, { card: p.card, idx: first + i }]));
    const showing = old || !st.current.length ? last : null; // a finished trick is on show
    // Motion: a card slides in from its player's side; a finished trick stays a moment, then slides to the winner.
    const live = !old && !reduceMotion();
    const now = Date.now();
    const seen = cardTimes(t, now);
    const collecting = live && showing && !st.complete ? (() => {
      const done = seen.get(n * 4 - 1) ?? 0;
      return { delay: TRICK_STAY - (now - done), to: Object.keys(pos).find((w) => pos[w] === showing.winner) };
    })() : null;
    const spot = (where) => {
      const c = at[pos[where]];
      // Negative delays keep each animation where it was when the table is drawn again.
      const anim = [];
      if (c && live) {
        const age = now - (seen.get(c.idx) ?? 0);
        if (age < CARD_IN) anim.push(`card-in-${where} ${CARD_IN}ms cubic-bezier(.2,.8,.2,1) -${age}ms both`);
        if (collecting) anim.push(`trick-out ${TRICK_OUT}ms ease-in ${collecting.delay}ms forwards`);
      }
      // Every card of the finished trick heads for the winner's side of the table.
      const v = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
      const go = collecting ? [0, 1].map((k) => `${Math.round((v[collecting.to][k] * 1.6 - v[where][k]) * 34)}px`) : null;
      const style = anim.length ? `animation:${anim.join(',')};${go ? `--tx:${go[0]};--ty:${go[1]}` : ''}` : '';
      return el('div', { class: `tspot t-${where}${showing && c && showing.winner === pos[where] ? ' won' : ''}` },
        c ? el('span', { class: 'tmove', style }, playedCard(c.card)) : null);
    };
    const k = st.contract;
    // The corners already count the tricks, so the footer only says who won the trick on show.
    const foot = old ? `${relative(me, old.winner)} won it.` : !st.current.length && last ? `${relative(me, last.winner)} won trick ${n}` : '';
    return el('div', { class: `tbox${st.current.length && !old ? '' : ' last'}`, 'aria-label': old ? `Trick ${n - back + 1} of ${n}` : 'Cards played to this trick' },
      el('div', { class: 'thead' }, old ? `${back === 1 ? 'Last trick' : 'Earlier trick'} (${n - back + 1} of ${n})` : `${callLabel(k.bid)}${k.doubled ? ` ${k.doubled === 'XX' ? 'XX' : 'X'}` : ''} by ${relative(me, k.declarer)}`),
      spot('top'), spot('left'), spot('right'), spot('bottom'),
      el('div', { class: 'tfoot' }, foot || '\u00a0')); // kept when empty, so the box does not jump
  }
  // When this phone first showed each card of the board (by its place in the play). Cards already played when the
  // board was opened count as old, so nothing replays on a reload.
  const CARD_IN = 320;
  const TRICK_STAY = 1000;
  const TRICK_OUT = 380;
  const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function cardTimes(t, now) {
    const key = `${t.code}:${t.board.n}`;
    const count = splitPlay(t.board.play).length;
    if (ui.cardKey !== key || !ui.cardSeen || count < ui.cardSeen.size) {
      ui.cardKey = key;
      ui.cardSeen = new Map(Array.from({ length: count }, (_, i) => [i, 0]));
    }
    for (let i = ui.cardSeen.size; i < count; i++) ui.cardSeen.set(i, now);
    return ui.cardSeen;
  }
  // How many tricks back the board number has taken the table's centre (0 once the play moves on).
  function reviewBack(t, st) {
    if (!ui.back) return 0;
    const key = `${t.code}:${t.board.n}:${t.board.play}`;
    if (ui.backKey !== key || ui.back > st.tricks.length) { ui.back = 0; return 0; }
    return ui.back;
  }
  // A tap on the board number flashes the last finished trick for a moment, then the table shows the current trick again.
  function showLastTrick(t) {
    const st = phase(t) === 'play' ? playOf(t.board) : null;
    if (!st || !st.tricks.length) return;
    ui.backKey = `${t.code}:${t.board.n}:${t.board.play}`;
    ui.back = 1;
    clearTimeout(ui.backTimer);
    ui.backTimer = setTimeout(() => { ui.back = 0; render(); }, 1200);
    render();
  }
  const playedCard = (c) => el('span', { class: `card small${c[0] === 'H' || c[0] === 'D' ? ' redc' : ''}` }, el('span', { class: 'rank' }, rankLabel(c[1])), el('span', { class: 'pip' }, SYMBOL[c[0]]));

  // The cards I may play now: from my own hand, or from the dummy when I am the declarer.
  const playableBy = (st, me, seat) => (me && controller(st, seat) === me && st.next === seat
    ? { legal: new Set(legalCards(st, seat)), onPlay: (c) => act((cur) => cur && playCard(cur, seat, c, ui.sync.uid), 'That card did not go through. Try again.') }
    : null);

  // The dummy, face up at its own seat, listed by suit (the cards I may play are buttons when I am the declarer).
  function dummyAt(hand, play, trump = null) {
    return el('div', { class: 'dcol', 'data-key': 'dummy-hand', role: play ? 'group' : 'img', 'aria-label': `Dummy: ${SUITS.map((s) => `${SYMBOL[s]} ${hand[s] ? [...hand[s]].map(rankLabel).join(' ') : 'none'}`).join(', ')}` },
      ...suitOrder(trump).map((s) => el('div', { class: `drow${s === 'H' || s === 'D' ? ' redc' : ''}` },
        el('span', { class: 'dpip' }, SYMBOL[s]),
        ...[...hand[s]].map((r) => {
          if (!play) return el('span', { class: 'dcard' }, rankLabel(r));
          const ok = play.legal.has(s + r);
          return el('button', { type: 'button', class: `dcard${ok ? ' playable' : ' dim'}`, disabled: !ok, 'data-key': `card-${s}${r}`, 'aria-label': `${rankLabel(r)} ${SYMBOL[s]}`, onclick: () => play.onPlay(s + r) }, rankLabel(r));
        }))));
  }

  // Peeking: the dummy sees the declarer's hand, and can look at a defender's cards for as long as a finger stays on them
  // (shaded, as if looking over a shoulder). The cards are in the page already; touching only shows them, so nothing redraws.
  function peekButton(seat, hand, back, trump) {
    const open = !!ui.peek[seat];
    const btn = el('button', { type: 'button', class: `peek-btn${open ? ' open' : ''}`, 'data-key': `peek-${seat}`, 'aria-label': `Hold to peek at ${COMPASS[seat]}'s hand`, title: 'Hold to peek' },
      back, el('div', { class: 'peek-open', 'aria-hidden': 'true' }, el('div', { class: 'dlabel' }, 'Peeking…'), dummyAt(hand, null, trump)));
    const show = (on) => { ui.peek[seat] = on; btn.classList.toggle('open', on); };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); show(true); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, () => show(false));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    btn.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); show(true); } });
    btn.addEventListener('keyup', () => show(false));
    btn.addEventListener('blur', () => show(false));
    return btn;
  }

  function felt(t, me) {
    const pos = around(me);
    const st = phase(t) === 'play' || isHeld(t) ? playOf(t.board) : null;
    // After the opening lead the dummy's cards are shown at the dummy's seat (unless that seat is mine).
    const dummy = st && st.started && st.dummy !== me ? st.dummy : null;
    const iAmDummy = !!st && !!me && st.dummy === me;
    // While a claim is open the declarer's remaining cards are turned face up for everyone, to judge the claim.
    const claimed = !!st && !!pendingClaim(t) && st.declarer !== me;
    const shows = (where) => (where === ['top', 'left', 'right'].find((w) => pos[w] === dummy) ? 'dummy'
      : (iAmDummy || claimed) && pos[where] === st.declarer ? 'declarer'
      : null);
    const hand = (where, back) => {
      const kind = shows(where);
      const seat = pos[where];
      if (kind === 'dummy') return el('div', { class: 'dwrap' }, el('div', { class: 'dlabel' }, 'Dummy'), dummyAt(handFromCards(st.remaining[dummy]), playableBy(st, me, dummy), st.trump));
      if (kind === 'declarer') return el('div', { class: 'dwrap' }, el('div', { class: 'dlabel' }, 'Declarer'), dummyAt(handFromCards(st.remaining[seat]), null, st.trump));
      if (iAmDummy && pos[where] !== st.declarer) return peekButton(seat, handFromCards(st.remaining[seat]), back, st.trump);
      return back;
    };
    // Corners: the bidding record (small) and the tricks of declarer and defenders, as on Bridge Base Online.
    const tally = (label, n, cls) => el('div', { class: `tally ${cls}`, 'aria-label': `${label}: ${n} trick${n === 1 ? '' : 's'}` },
      el('span', { class: 'pile', 'aria-hidden': 'true' }, ...Array.from({ length: Math.min(n, 7) }, (_, i) => el('span', { class: 'pback', style: `--i:${i}` }))),
      el('span', { class: 'tcount' }, String(n)), el('span', { class: 'tlabel' }, label));
    const wide = (w) => ['dummy', 'declarer'].includes(shows(w));
    const widths = `${wide('left') ? 112 : 72}px minmax(0,1fr) ${wide('right') ? 112 : 72}px`;
    return el('div', { class: `felt${st ? ' play' : ''}`, style: wide('left') || wide('right') ? `grid-template-columns:${widths}` : null },
      el('div', { class: 'f-board' }, boardBox(t, me)),
      el('div', { class: 'f-top' }, hand('top', backs(st ? st.remaining[pos.top].length : 13)), plate(t, pos.top, me)),
      el('div', { class: 'f-left' }, hand('left', backs(5, ' side')), plate(t, pos.left, me)),
      el('div', { class: 'f-center' }, st ? trickBox(t, me, st) : auctionBox(t, me)),
      el('div', { class: 'f-right' }, hand('right', backs(5, ' side')), plate(t, pos.right, me)),
      el('div', { class: 'f-bottom' }, plate(t, pos.bottom, me)),
      st ? el('button', { type: 'button', class: `f-auc bids-btn${ui.bigAuction ? ' on' : ''}`, 'data-key': 'auction-mini', 'aria-expanded': String(!!ui.bigAuction), 'aria-label': 'Show the bidding', onclick: () => { ui.bigAuction = !ui.bigAuction; render(); } }, 'Bids') : null,
      st && ui.bigAuction ? el('div', { class: 'req auction-big', 'data-key': 'auction-big' }, el('div', { class: 'req-title' }, 'The bidding'), auctionBox(t, me), el('button', { type: 'button', class: 'pill on', 'data-key': 'auction-close', onclick: () => { ui.bigAuction = false; render(); } }, 'Close')) : null,
      st ? el('div', { class: 'f-dec' }, tally('Declarer', st.declarerTricks, 'dec')) : null,
      st ? el('div', { class: 'f-def' }, tally('Defence', st.defenderTricks, 'def')) : null,
      requestNote(t, 'undo'),
      bubblesOnTable(me));
  }

  // A hand as cards: spades, hearts, clubs, diamonds (alternating colours), overlapping to fit the screen.
  // play: { legal: Set of cards, onPlay(card) } makes the legal cards buttons; who names the hand for screen readers.
  function cards(hand, { play = null, who = 'Your hand', hcp = true, trump = null } = {}) {
    const list = suitOrder(trump).flatMap((s) => [...hand[s]].map((r) => [s, r]));
    const e = evaluate(hand);
    const face = (s, r) => [el('span', { class: 'rank' }, rankLabel(r)), el('span', { class: 'pip' }, SYMBOL[s])];
    return el('div', { class: 'hand-wrap' },
      el('div', { class: `cards${play ? ' to-play' : ''}`, style: `--gaps:${Math.max(list.length - 1, 1)}`, role: play ? 'group' : 'img', 'aria-label': `${who}: ${SUITS.map((s) => `${SYMBOL[s]} ${hand[s] ? [...hand[s]].map(rankLabel).join(' ') : 'none'}`).join(', ')}` },
        ...list.map(([s, r]) => {
          const cls = `card${s === 'H' || s === 'D' ? ' redc' : ''}`;
          if (!play) return el('span', { class: cls }, ...face(s, r));
          const ok = play.legal.has(s + r);
          return el('button', { type: 'button', class: `${cls}${ok ? ' playable' : ' dim'}`, disabled: !ok, 'data-key': `card-${s}${r}`, 'aria-label': `${rankLabel(r)} ${SYMBOL[s]}`, onclick: () => play.onPlay(s + r) }, ...face(s, r));
        })),
      hcp ? el('div', { class: 'hcp' }, `${e.hcp} HCP`) : null);
  }
  const handFromCards = (list) => Object.fromEntries(SUITS.map((s) => [s, list.filter((c) => c[0] === s).map((c) => c[1]).join('')]));

  // During the play: dummy (face up after the opening lead) and my hand, with the cards I may play now.
  function playArea(t, me, st) {
    const dummy = st.dummy;
    const mine = (seat) => me && controller(st, seat) === me && st.next === seat;
    const note = st.started && dummy !== me && mine(dummy) ? el('div', { class: 'label' }, `Your turn to play from dummy (${relative(me, dummy)}): tap a card at that seat`) : null;
    const myBlock = me
      ? el('div', {}, el('div', { class: 'label' }, me === dummy ? 'Your hand (dummy: partner plays it)' : mine(me) ? 'Your turn: play a card' : 'Your hand'),
        cards(handFromCards(st.remaining[me]), { play: playableBy(st, me, me), hcp: false, trump: st.trump }))
      : null;
    return el('div', { class: 'play-hand' }, note, myBlock);
  }

  function meanings(t, me) {
    const a = auctionOf(t.board);
    const rows = explain(a, undefined, { general: true }).filter((r) => r.call !== 'P' || r.entry);
    if (!rows.length) return null;
    return el('div', {},
      el('div', { class: 'label' }, 'What the calls mean'),
      el('div', { class: 'lines' }, ...rows.map((r) => {
        const ours = me ? sideOf(r.seat) === sideOf(me) : sideOf(r.seat) === 'NS';
        const text = r.meaning ? (ours ? r.meaning : `Probably: ${r.meaning}`) : 'No agreement for this call.';
        return el('div', { class: `line${ours ? '' : ' opp'}` },
          el('div', { class: 'row' }, el('span', { class: 'who' }, relative(me, r.seat)), el('span', { class: 'bid-l' }, callLabel(r.call)), el('span', {}, text)));
      })));
  }

  function myTurn(t, me) {
    const a = auctionOf(t.board);
    const hint = ui.hint;
    return el('div', { class: 'stack' },
      el('div', { class: 'panel answer' },
        el('div', { class: 'eyebrow' }, 'Your call'),
        hint
          ? [el('div', { class: 'big' }, callLabel(hint.call)),
              hint.reasons.length ? el('p', {}, el('b', {}, 'Why: '), `${hint.reasons.join('; ')}.`) : null,
              el('p', {}, el('b', {}, 'Tells partner: '), hint.meaning),
              hint.checking ? el('p', { class: 'muted' }, 'Checking by simulation…') : null,
              hint.close && hint.sim ? el('p', { class: 'close' }, hint.close) : null]
          : el('button', { type: 'button', class: 'pill', 'data-key': 'hint', onclick: () => showHint(t, me, a) }, 'Show the Advisor\'s bid')),
      biddingBox(a, { doubles: true, onCall: (c) => act((cur) => cur && call(cur, me, c, ui.sync.uid), 'That call did not go through. Try again.') }));
  }

  // The Advisor's bid at once; a judgment call is then checked by simulation and the answer updated.
  function showHint(t, me, a) {
    const hand = handOf(t.board, me);
    const r = advise(hand, a);
    const mine = { ...r, checking: r.fallback === 'judgment' };
    ui.hint = mine;
    render();
    if (!mine.checking) return;
    simulatedAdvice(hand, a, r).then((better) => {
      if (ui.hint !== mine) return;
      ui.hint = better ?? { ...r };
      render();
    });
  }

  // A section that remembers whether it is open across redraws.
  const section = (key, summary, ...children) => el('details', { class: 'manage', 'data-key': key, open: !!ui.open[key], ontoggle: (e) => { ui.open[key] = e.target.open; if (key === 'chat') { saved.chatOpen = e.target.open; save(); } } },
    el('summary', {}, summary), ...children);

  // Table talk: the last messages of this table, newest at the bottom. A message not yet on the table shows "sending…".
  function chatPanel(t, me) {
    const onTable = new Set((t.chat ?? []).map(chatKey));
    const mine = saved.chatCode === t.code ? saved.chatLog : [];
    const msgs = [...(t.chat ?? []), ...mine.filter((m) => !onTable.has(chatKey(m)))].sort((a, b) => a.at - b.at);
    const lastAt = msgs.at(-1)?.at ?? 0;
    const open = !!ui.open.chat;
    if (open) ui.chatSeenAt = lastAt;
    const unread = open ? 0 : msgs.filter((m) => m.at > (ui.chatSeenAt ?? 0) && m.uid !== ui.sync.uid).length;
    const send = () => {
      const text = ui.chatDraft.trim();
      if (!text || !me) return;
      const at = Date.now();
      ui.chatDraft = '';
      saved.chatDraft = '';
      if (saved.chatCode !== t.code) { saved.chatCode = t.code; saved.chatLog = []; }
      saved.chatLog = [...saved.chatLog, { uid: ui.sync.uid, name: t.seats[me].name || 'Player', seat: me, text: text.slice(0, 200), at }].slice(-200);
      save();
      render();
      act((cur) => cur && say(cur, ui.sync.uid, text, at), 'The table did not take that message. It stays on this phone and is sent again.');
    };
    return section('chat', `Chat${unread ? ` (${unread} new)` : msgs.length ? ` (${msgs.length})` : ''}`,
      el('div', { class: 'chat-log', 'data-key': 'chat-log', role: 'log', 'aria-live': 'polite' },
        ...(msgs.length ? msgs.map((m) => el('div', { class: `chat-msg${m.uid === ui.sync.uid ? ' mine' : ''}` }, el('b', {}, `${m.name || COMPASS[m.seat]} (${m.seat}): `), m.text,
          onTable.has(chatKey(m)) ? null : el('span', { class: 'muted' }, ' · sending…')))
          : [el('p', { class: 'muted' }, 'No messages yet.')])),
      me ? el('form', { class: 'chat-form', onsubmit: (e) => { e.preventDefault(); send(); } },
        el('input', { class: 'field', 'data-key': 'chat-input', value: ui.chatDraft, maxlength: 200, placeholder: 'Say something to the table', autocomplete: 'off', 'aria-label': 'Chat message', oninput: (e) => { ui.chatDraft = e.target.value; saved.chatDraft = ui.chatDraft; save(); } }),
        el('button', { type: 'submit', class: 'pill on', 'data-key': 'chat-send' }, 'Send'))
        : el('p', { class: 'muted' }, 'Sit at the table to chat.'));
  }

  // My calls so far, each beside what the Advisor would have bid at that point (for the hand and auction I had then).
  function myCallsCheck(t, me) {
    if (!me) return null;
    const a = auctionOf(t.board);
    const hand = handOf(t.board, me);
    const rows = a.calls.map((c, i) => (seatAt(a, i) === me ? { i, c, r: advise(hand, { ...a, calls: a.calls.slice(0, i) }) } : null)).filter(Boolean);
    if (!rows.length) return null;
    return section('my-calls', "The Advisor's view of my calls",
      el('div', { class: 'lines' }, ...rows.map(({ c, r }) => {
        const call = r.notCovered ? 'P' : r.call;
        const same = call === c;
        return el('div', { class: `line${same ? '' : ' differs'}` },
          el('div', { class: 'row' }, el('span', { class: 'who' }, 'You'), el('span', { class: 'bid-l' }, callLabel(c)),
            el('span', {}, same ? 'Same as the Advisor' : `Advisor: ${callLabel(call)}${r.meaning ? ` (${r.meaning}${r.reasons?.length ? `; ${r.reasons.join('; ')}` : ''})` : ''}`)));
      })));
  }

  // Claiming the rest of the tricks. The defenders (people, or the solver for robots) accept or reject it.
  async function makeClaim(t, n) {
    const b = t.board;
    const k = contract(auctionOf(b));
    ui.claiming = false;
    let dd = n;
    if (SEATS.some((x) => ['robot', 'pass'].includes(t.seats[x].kind) && sideOf(x) !== sideOf(k.declarer))) {
      let part = null;
      try { part = await sharedPool().one({ kind: 'claim', hands: Object.fromEntries(SEATS.map((x) => [x, handOf(b, x)])), contract: k, play: b.play }); } catch { /* no solver */ }
      if (!part) { ui.error = 'The robot defenders cannot judge a claim here (no solver on this device). Play on, or skip the play.'; render(); return; }
      dd = part.dd;
      if (n > dd) { ui.error = `The defenders do not accept: with every card in view you can take at most ${dd} of the last ${part.left} tricks. Play on, or claim ${dd}.`; render(); return; }
    }
    act((cur) => cur && requestClaim(cur, ui.sync.uid, n, dd), 'That claim did not go through (the position has changed).');
  }
  function claimControls(t, me) {
    if (pendingClaim(t)) return null;
    const chance = claimChance(t, ui.sync.uid);
    if (!chance) return null;
    if (!ui.claiming) return el('button', { type: 'button', class: 'pill', 'data-key': 'claim', onclick: () => { ui.claiming = true; ui.claimN = chance.left; render(); } }, 'Claim');
    const n = Math.min(ui.claimN ?? chance.left, chance.left);
    return el('div', { class: 'panel', 'data-key': 'claim-form' },
      el('p', {}, `Claim how many of the last ${chance.left} tricks?`),
      el('div', { class: 'row-buttons' }, ...Array.from({ length: chance.left + 1 }, (_, i) => chance.left - i).map((v) =>
        el('button', { type: 'button', class: `pill${v === n ? ' on' : ''}`, 'data-key': `claim-n-${v}`, 'aria-pressed': String(v === n), onclick: () => { ui.claimN = v; render(); } }, v === chance.left ? `All ${v}` : String(v)))),
      el('div', { class: 'row-buttons' },
        el('button', { type: 'button', class: 'pill on', 'data-key': 'claim-confirm', onclick: () => makeClaim(t, n) }, 'Claim'),
        el('button', { type: 'button', class: 'pill', 'data-key': 'claim-close', onclick: () => { ui.claiming = false; render(); } }, 'Cancel')));
  }

  // Taking a call or card back works like on Bridge Base Online: ask, and any human who played after it must allow it.
  const humanName = (t, id) => SEATS.map((s) => t.seats[s]).find((x) => x.kind === 'human' && x.uid === id)?.name || 'A player';
  function undoButton(t) {
    if (pendingUndo(t)) return null;
    const play = phase(t) === 'play';
    if ((play ? lastOwnCard(t, ui.sync.uid) : lastOwnCall(t, ui.sync.uid)) < 0) return null;
    return el('button', { type: 'button', class: 'pill', 'data-key': play ? 'undo-card' : 'undo', onclick: () => act((cur) => cur && requestUndo(cur, ui.sync.uid), 'Nothing to take back.') }, play ? '↶ Take back my last card' : '↶ Take back my last call');
  }
  // A claim brings out a chicken doll on a spring: it boings, wobbles its head and rolls its googly eyes.
  const CHICKEN = `<svg viewBox="0 0 60 92" width="54" height="83" aria-hidden="true">
    <ellipse cx="30" cy="88" rx="15" ry="3.5" fill="#3a2a1a" opacity=".55"/>
    <rect x="21" y="84" width="18" height="5" rx="2" fill="#8d5a2b"/>
    <polyline class="ck-spring" points="30,85 21,81 39,77 21,73 39,69 21,65 39,61 21,57 30,53" fill="none" stroke="#cfd8dc" stroke-width="3" stroke-linejoin="round"/>
    <g class="ck-bob"><g class="ck-wob">
      <ellipse cx="30" cy="38" rx="17" ry="16" fill="#ffd54a" stroke="#c99a12" stroke-width="1.5"/>
      <ellipse class="ck-wing" cx="15" cy="42" rx="5" ry="8" fill="#ffc107" stroke="#c99a12"/>
      <ellipse class="ck-wing ck-wing-r" cx="45" cy="42" rx="5" ry="8" fill="#ffc107" stroke="#c99a12"/>
      <circle cx="23" cy="20" r="4.5" fill="#e53935"/><circle cx="30" cy="17" r="5.5" fill="#e53935"/><circle cx="37" cy="20" r="4.5" fill="#e53935"/>
      <circle cx="23" cy="31" r="6.5" fill="#fff" stroke="#222" stroke-width="1"/><circle cx="37" cy="31" r="7.5" fill="#fff" stroke="#222" stroke-width="1"/>
      <circle class="ck-pupil" cx="24" cy="32" r="2.6" fill="#111"/><circle class="ck-pupil ck-pupil-r" cx="36" cy="30" r="3.2" fill="#111"/>
      <polygon points="27,37 37,40.5 27,44" fill="#ff8f00" stroke="#b35f00" stroke-width=".8"/>
      <ellipse cx="29" cy="47" rx="2.6" ry="3.6" fill="#e53935"/>
    </g></g>
  </svg>`;
  function chickenDoll() {
    const span = document.createElement('span');
    span.className = 'chick';
    span.innerHTML = CHICKEN;
    return span;
  }
  // An open take-back or claim, shown on the table itself with a hopping frog. The asker waits (and can withdraw);
  // the players who must answer see Allow / Deny (Accept / Reject for a claim).
  // A claim is shown under the table, so the cards being judged stay in view; a take-back sits on the table.
  function requestNote(t, only) {
    if (!ui.sync || (!t.undoReq && !t.claimReq)) return null;
    const me = ui.sync.uid;
    const u = only === 'claim' ? null : pendingUndo(t);
    const c = u || only === 'undo' ? null : pendingClaim(t);
    const r = u ?? c;
    if (!r) return null;
    const waiting = r.need.filter((x) => !r.ok.includes(x)).map((x) => humanName(t, x)).join(', ');
    const asker = humanName(t, r.uid);
    let text;
    let buttons;
    if (u) {
      const what = u.kind === 'card' ? 'card' : 'call';
      const answer = (yes) => act((cur) => cur && answerUndo(cur, me, yes), 'That request is no longer open.');
      if (u.uid === me) { text = `Taking back your last ${what} (and everything after it): waiting for ${waiting}…`; buttons = [['undo-cancel', 'Cancel the request', false, () => act((cur) => cur && cancelUndo(cur, me))]]; }
      else if (u.need.includes(me) && !u.ok.includes(me)) { text = `${asker} asks to take back their last ${what} and everything after it.`; buttons = [['undo-allow', 'Allow', true, () => answer(true)], ['undo-deny', 'Deny', false, () => answer(false)]]; }
      else text = `${asker} asks to take back their last ${what}. Waiting for ${waiting}…`;
    } else {
      const left = playOf(t.board).remaining[playOf(t.board).declarer].length;
      const what = `${c.tricks === left ? 'all' : c.tricks} of the last ${left} tricks`;
      const answer = (yes) => act((cur) => cur && answerClaim(cur, me, yes), 'That claim is no longer open.');
      if (c.uid === me) { text = `You claim ${what}. Waiting for ${waiting}…`; buttons = [['claim-cancel', 'Withdraw the claim', false, () => act((cur) => cur && cancelClaim(cur, me))]]; }
      else if (c.need.includes(me) && !c.ok.includes(me)) { text = `${asker} claims ${what}.`; buttons = [['claim-accept', 'Accept', true, () => answer(true)], ['claim-reject', 'Reject, play on', false, () => answer(false)]]; }
      else text = `${asker} claims ${what}. Waiting for ${waiting}…`;
      if (c.uid !== me) text += ' Declarer\'s cards are face up.';
    }
    return el('div', { class: u ? 'req' : 'req below', 'data-key': u ? 'undo-request' : 'claim-request', role: 'alertdialog', 'aria-label': u ? 'Take-back request' : 'Claim' },
      u ? el('div', { class: 'frog-track', 'aria-hidden': 'true' }, el('span', { class: 'frog' }, '🐸'))
        : el('div', { class: 'chick-track', 'aria-hidden': 'true' }, chickenDoll()),
      el('div', { class: 'req-title' }, u ? 'Take-back request' : 'Claim'),
      el('p', {}, text),
      buttons ? el('div', { class: 'row-buttons' }, ...buttons.map(([key, label, on, fn]) => el('button', { type: 'button', class: `pill${on ? ' on' : ''}`, 'data-key': key, onclick: fn }, label))) : null);
  }

  // Double dummy, once the board is over: the tricks each seat takes in each strain, and par.
  // Solved in a background worker (about half a second); the board screen shows it when it arrives.
  const ddKey = (t) => `${t.code}:${t.board.n}`;
  function ensureDD(t) {
    const key = ddKey(t);
    if (ui.dd.has(key)) return;
    ui.dd.set(key, undefined);
    for (const old of [...ui.dd.keys()].slice(0, -6)) ui.dd.delete(old);
    const b = t.board;
    let job;
    try {
      job = sharedPool().one({ kind: 'review', hands: Object.fromEntries(SEATS.map((s) => [s, handOf(b, s)])), dealer: b.dealer, vul: b.vul });
    } catch {
      job = Promise.resolve(null);
    }
    job.then((d) => { ui.dd.set(key, d ?? false); render(); });
  }
  function ddPanel(t, me, k) {
    ensureDD(t);
    const d = ui.dd.get(ddKey(t));
    const head = el('div', { class: 'label' }, 'Double dummy');
    if (d === undefined) return el('div', { class: 'panel muted', 'data-key': 'dd' }, head, el('p', {}, 'Solving the deal…'));
    if (!d) return el('div', { class: 'panel muted', 'data-key': 'dd' }, head, el('p', {}, 'The double-dummy solver is not available on this device.'));
    const rows = tableRows(d.table);
    const par = parLine(d, { name: (s) => relative(me, s), side: (s) => (me ? (sideOf(s) === sideOf(me) ? 'your side' : 'their side') : sideOf(s) === 'NS' ? 'N-S' : 'E-W') });
    const seats = ['N', 'E', 'S', 'W'];
    return el('div', { class: 'panel', 'data-key': 'dd' }, head,
      el('div', { class: 'dd-wrap' }, el('table', { class: 'dd-table' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Tricks as declarer'), ...seats.map((s) => el('th', {}, relative(me, s))))),
        el('tbody', {}, ...rows.map((r) => el('tr', {}, el('th', {}, r.strain), ...seats.map((s) => el('td', { class: k && k.declarer === s && callLabel(k.bid).endsWith(r.strain) ? 'dd-hit' : '' }, String(r[s])))))))),
      par ? el('p', { class: 'muted' }, par) : null);
  }

  // The play card by card, as on Bridge Base Online: all four hands, and under each card the player to move may play,
  // the tricks declarer ends with if that card is played (double dummy). It starts before the opening lead; the whole
  // board is solved at once in a worker (well under a second). The arrows sit in the middle of the table, under the trick.
  const pvKey = (t) => `${t.code}:${t.board.n}:${t.board.play ?? ''}`;
  function ensureCards(t, k) {
    const key = pvKey(t);
    if (ui.pv.has(key)) return;
    ui.pv.set(key, undefined);
    for (const old of [...ui.pv.keys()].slice(0, -6)) ui.pv.delete(old);
    const b = t.board;
    let job;
    try {
      job = sharedPool().one({ kind: 'cards', hands: Object.fromEntries(SEATS.map((s) => [s, handOf(b, s)])), contract: k, play: b.play ?? '' }, 60000);
    } catch {
      job = Promise.resolve(null);
    }
    job.then((steps) => { ui.pv.set(key, steps ?? false); render(); });
  }
  // live: the board just played at this table (chat bubbles and a take-back request show on it, as on the table).
  function playViewer(t, me, live = false) {
    const b = t.board;
    const end = playOf(b);
    if (!end) return null;
    const k = end.contract;
    const key = pvKey(t);
    // The double-dummy numbers show only after a tap on DD (as on Bridge Base Online); the deal is solved then.
    if (ui.ddOn) ensureCards(t, k);
    const d = ui.ddOn ? ui.pv.get(key) : null;
    const played = splitPlay(b.play);
    const last = played.length;
    const step = Math.min(ui.pvAt.get(key) ?? 0, last);
    const go = (n) => {
      ui.pvAt.set(key, Math.max(0, Math.min(last, n)));
      render();
      // An arrow that has just been disabled drops the focus: keep it on the viewer so the arrow keys still work.
      if (document.activeElement === document.body) document.querySelector('[data-key="play-viewer"]')?.focus({ preventScroll: true });
    };
    const st = playState(Object.fromEntries(SEATS.map((s) => [s, handOf(b, s)])), k, played.slice(0, step).join(' '));
    const scores = d?.[step] ?? null;
    const next = step < last ? played[step] : null; // the card that was really played here
    const forDecl = st.next && sideOf(st.next) === sideOf(st.declarer);
    const vals = scores ? Object.values(scores) : [];
    const best = vals.length ? (forDecl ? Math.max(...vals) : Math.min(...vals)) : null;
    const pos = around(me);
    // A hand as on Bridge Base Online: a white box with the seat on a strip, one tight line a suit; under each card the
    // player to move may play, a small number (green: best, red: gives tricks away). The card that was played is ringed.
    const hand = (seat) => {
      const toPlay = st.next === seat;
      const role = seat === st.declarer ? 'declarer' : seat === st.dummy ? 'dummy' : '';
      return el('div', { class: `pv-hand${toPlay ? ' to-play' : ''}`, 'data-key': `pv-hand-${seat}`, 'aria-label': `${COMPASS[seat]}${role ? `, ${role}` : ''}` },
        el('div', { class: 'pv-name' }, el('span', { class: 'pv-seat' }, seat), el('span', { class: 'pv-who' }, me ? relative(me, seat) : COMPASS[seat]), el('span', { class: 'pv-hcp' }, String(evaluate(handOf(b, seat)).hcp))),
        ...suitOrder(st.trump).map((s) => {
          const list = st.remaining[seat].filter((c) => c[0] === s);
          return el('div', { class: `pv-row${s === 'H' || s === 'D' ? ' red' : ''}` },
            el('span', { class: 'pv-pip' }, SYMBOL[s]),
            ...list.map((c) => {
              const n = toPlay && scores && c in scores ? scores[c] : null;
              const cls = `pv-c${n === null ? '' : n === best ? ' best' : ' worse'}`;
              const label = `${rankLabel(c[1])} ${SYMBOL[s]}${n === null ? '' : `: declarer ${n}`}`;
              const face = [el('span', { class: 'pv-r' }, rankLabel(c[1])), n === null ? null : el('span', { class: 'pv-n' }, String(n))];
              return toPlay && c === next
                ? el('button', { type: 'button', class: `${cls} next`, 'data-key': 'pv-play', 'aria-label': `${label}, played: tap for the next card`, onclick: () => go(step + 1) }, ...face)
                : el('span', { class: cls, 'aria-label': label }, ...face);
            }));
        }));
    };
    // The middle: the bidding before the opening lead, then the trick being played (or the trick just won, shaded).
    const won = st.current.length ? null : st.tricks.at(-1) ?? null;
    const trick = st.current.length ? st.current : won?.cards ?? [];
    const middle = step === 0 ? auctionBox(t, me)
      : el('div', { class: `pv-trick${won ? ' done' : ''}` },
        ...['top', 'left', 'right', 'bottom'].map((w) => {
          const p = trick.find((x) => x.seat === pos[w]);
          return el('div', { class: `tspot t-${w}${won && won.winner === pos[w] ? ' won' : ''}` }, p ? playedCard(p.card) : null);
        }));
    const arrow = (k2, label, aria, to, off) => el('button', { type: 'button', class: 'pv-arrow', 'data-key': k2, 'aria-label': aria, disabled: off, onclick: () => go(to) }, label);
    const ns = st.tricks.filter((x) => sideOf(x.winner) === 'NS').length;
    return el('div', { class: 'pv', 'data-key': 'play-viewer', tabindex: '-1', 'aria-label': 'Play by play, double dummy',
      onkeydown: (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(step + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(step - 1); } } },
    el('div', { class: 'pv-corner pv-tl' }, boardBox(t, me)),
    el('div', { class: 'pv-top' }, hand(pos.top)),
    el('div', { class: 'pv-corner pv-tr' },
      el('button', { type: 'button', class: `pv-dd${ui.ddOn ? ' on' : ''}`, 'data-key': 'pv-dd', 'aria-pressed': String(!!ui.ddOn), 'aria-label': 'Double dummy: show the tricks under each card', onclick: () => { ui.ddOn = !ui.ddOn; render(); } }, 'DD'),
      ui.ddOn && d === undefined ? el('span', { class: 'pv-note' }, 'Solving…') : ui.ddOn && d === false ? el('span', { class: 'pv-note' }, 'Not available') : null),
    el('div', { class: 'pv-left' }, hand(pos.left)),
    el('div', { class: 'pv-mid' }, middle),
    el('div', { class: 'pv-right' }, hand(pos.right)),
    el('div', { class: 'pv-corner pv-bl' },
      arrow('pv-prev', '‹', 'Previous card', step - 1, step === 0),
      arrow('pv-next', '›', 'Next card', step + 1, step === last)),
    el('div', { class: 'pv-bottom' }, hand(pos.bottom)),
    el('div', { class: 'pv-corner pv-br' },
      el('div', { class: 'pv-k' }, `${callLabel(k.bid)}${k.doubled ? ` ${k.doubled}` : ''}`, el('small', {}, COMPASS[k.declarer])),
      el('div', { class: 'pv-tricks' }, el('span', { 'aria-label': `North-South ${ns} tricks` }, el('small', {}, 'NS'), String(ns)), el('span', { 'aria-label': `East-West ${st.tricks.length - ns} tricks` }, el('small', {}, 'EW'), String(st.tricks.length - ns)))),
    live ? requestNote(t, 'undo') : null,
    live ? bubblesOnTable(me) : null);
  }

  // past: the previous board, looked at again from this phone only (no Next board / Bid it again).
  function review(t, me, past = false) {
    const b = t.board;
    const a = auctionOf(b);
    const k = contract(a);
    const rows = reviewRows(b, seatsAtBidding(t));
    const meBid = b.swap ? b.swap[0] : me; // who I was while bidding
    const sys = systemAuction(b, seatsAtBidding(t));
    const sysK = contract(sys);
    const kText = (x) => (x ? `${callLabel(x.bid)}${x.doubled ? ` ${x.doubled === 'XX' ? 'redoubled' : 'doubled'}` : ''} by ${relative(me, x.declarer)}` : 'Passed out');
    return el('div', { class: 'stack' },
      el('div', { class: 'panel' },
        el('div', { class: 'eyebrow' }, 'Board over'),
        el('div', { class: 'big' }, kText(k)),
        k ? el('p', { 'data-key': 'result' }, el('b', {}, 'Result: '), resultText(b, (s) => relative(me, s))) : null,
        el('p', { class: 'muted' }, `The Advisor would reach: ${kText(sysK)} (${sys.calls.map(callLabel).join(' ')}).`),
        past ? null : el('div', { class: 'row-buttons' },
          el('button', { type: 'button', class: 'pill on', 'data-key': 'next-board', onclick: () => act((cur) => cur && nextBoard(cur, rand)) }, 'Next board'),
          el('button', { type: 'button', class: 'pill', 'data-key': 'rebid', onclick: () => act((cur) => cur && rebid(cur)) }, 'Bid it again'))),
      playOf(b) ? null : el('div', { class: 'compass' }, ...['N', 'W', 'E', 'S'].map((s) => el('div', { class: `seat-${s}` }, handView(handOf(b, s), `${COMPASS[s]} (${relative(me, s)})`)))),
      ui.ddOn || !playOf(b) ? ddPanel(t, me, k) : (ensureDD(t), null), // solved anyway, for Copy this board
      el('div', {},
        el('div', { class: 'label' }, 'Call by call'),
        rows.some((r) => r.skipped) ? el('p', { class: 'muted' }, 'Only each player\'s first difference from the Advisor is shown: the calls after it depend on it.') : null,
        el('div', { class: 'lines' }, ...rows.filter((r) => r.call !== 'P' || r.human).map((r) => el('details', { class: `line${r.differs ? ' differs' : ''}${r.human ? '' : ' opp'}` },
          el('summary', {}, el('span', { class: 'who' }, relative(meBid, r.seat)), el('span', { class: 'bid-l' }, callLabel(r.call)),
            el('span', {}, r.differs ? `Advisor: ${callLabel(r.advisor.call)}` : r.meaning ?? (r.call === 'P' ? 'Pass' : 'No agreement'))),
          r.meaning ? el('p', {}, r.meaning) : null,
          r.differs ? el('p', {}, el('b', {}, `Advisor's ${callLabel(r.advisor.call)}: `), `${r.advisor.meaning}${r.advisor.reasons?.length ? ` (${r.advisor.reasons.join('; ')})` : ''}`) : null,
          r.differs ? confRow(r.advisor.conf) : null,
          r.differs && r.misfit?.length ? el('p', {}, el('b', {}, `Why ${callLabel(r.call)} does not fit your hand: `), `${r.misfit.join('; ')}.`) : null,
          r.differs && r.advisor.close ? el('p', { class: 'close' }, el('b', {}, 'Close call: '), r.advisor.close) : null,
          r.entry || r.notes ? el('a', { href: `${NOTES_URL}#${r.entry?.notes ?? r.notes}` }, 'Read more in the system notes') : null)))),
      playRecord(t.board),
      el('div', { class: 'row-buttons' }, saveBoardButton(t, me), copyButton('Copy this board', () => boardReport(t, me, ui.dd.get(ddKey(t))), 'copy-board')));
  }

  // The play of a board, trick by trick: one row a trick, a column a seat; the lead is marked and the winner highlighted.
  function playRecord(b) {
    const st = playOf(b);
    if (!st || !b.play) return null;
    const seats = ['N', 'E', 'S', 'W'];
    const cell = (cards, winner, s) => {
      const p = cards.find((x) => x.seat === s);
      if (!p) return el('td', {});
      const red = p.card[0] === 'H' || p.card[0] === 'D';
      return el('td', { class: `${p.seat === winner ? 'won' : ''}${cards[0].seat === s ? ' lead' : ''}` },
        el('span', { class: red ? 'red' : '' }, SYMBOL[p.card[0]]), rankLabel(p.card[1]));
    };
    const rows = [...st.tricks.map((tr, i) => [i + 1, tr.cards, tr.winner]), ...(st.current.length ? [[st.tricks.length + 1, st.current, null]] : [])];
    return el('details', { class: 'manage', 'data-key': 'play-record' },
      el('summary', {}, `The play (${st.tricks.length} trick${st.tricks.length === 1 ? '' : 's'}${st.trump ? `, trumps ${SYMBOL[st.trump]}` : ', notrump'})`),
      el('table', { class: 'play-table' },
        el('thead', {}, el('tr', {}, el('th', {}, '#'), ...seats.map((s) => el('th', {}, s)))),
        el('tbody', {}, ...rows.map(([n, cards, winner]) => el('tr', {}, el('th', {}, String(n)), ...seats.map((s) => cell(cards, winner, s)))))),
      el('p', { class: 'muted small' }, 'Highlighted: the card that won the trick. Underlined: the lead.'));
  }

  // Saving a finished board on this phone, to look at again later (also after the table is gone).
  const boardId = (t) => `${t.code}:${t.board.n}`;
  function saveBoardButton(t, me) {
    const id = boardId(t);
    const have = saved.boards.some((x) => x.id === id);
    return (
      el('button', { type: 'button', class: `pill${have ? ' on' : ''}`, 'data-key': 'save-board', 'aria-pressed': String(have),
        onclick: () => {
          if (have) saved.boards = saved.boards.filter((x) => x.id !== id);
          else saved.boards = [...saved.boards, { id, code: t.code, at: Date.now(), me: me ?? 'S', seats: JSON.parse(JSON.stringify(t.seats)), board: JSON.parse(JSON.stringify(t.board)) }].slice(-100);
          save(); render();
        } }, have ? '★ Saved on this phone (tap to remove)' : '☆ Save this board'));
  }

  // The saved boards: list, view, delete.
  function savedBoards() {
    if (!saved.boards.length) return null;
    return section('saved-boards', `Saved boards (${saved.boards.length})`,
      el('div', { class: 'lines' }, ...[...saved.boards].reverse().map((x) => {
        const k = contract(auctionOf(x.board));
        const text = k ? `${callLabel(k.bid)}${k.doubled ? (k.doubled === 'XX' ? ' XX' : ' X') : ''} by ${COMPASS[k.declarer]}` : 'passed out';
        return el('div', { class: 'line' }, el('div', { class: 'row' },
          el('span', { class: 'who' }, `#${x.board.n}`), el('span', {}, `${text} · ${new Date(x.at).toLocaleDateString()}`),
          el('button', { type: 'button', class: 'pill small', 'data-key': `view-saved-${x.id}`, onclick: () => { ui.viewSaved = x.id; render(); } }, 'View'),
          el('button', { type: 'button', class: 'pill small', 'data-key': `delete-saved-${x.id}`, 'aria-label': `Delete saved board ${x.board.n}`, onclick: () => { saved.boards = saved.boards.filter((y) => y.id !== x.id); save(); render(); } }, 'Delete')));
      })));
  }
  function savedScreen(x) {
    const pt = { code: x.code, created: 0, opponents: 'robot', seats: x.seats, board: x.board, history: {} };
    return el('div', { class: 'stack' },
      el('div', { class: 'row-buttons' }, el('button', { type: 'button', class: 'pill on', 'data-key': 'close-saved', onclick: () => { ui.viewSaved = ''; render(); } }, 'Back')),
      el('div', { class: 'board-line' }, el('b', {}, `Saved board ${x.board.n}`), ` · Dealer ${COMPASS[x.board.dealer]} · ${VUL_TEXT[x.board.vul]}`),
      playViewer(pt, x.me) ?? felt(pt, x.me),
      review(pt, x.me, true));
  }

  // An earlier board, shown on this phone only; the table carries on for everyone else. Older and newer boards are one tap away.
  function previousScreen(t, me, prev) {
    const pt = { ...t, board: prev };
    const older = t.history[prev.n - 1] ? prev.n - 1 : 0;
    const newer = prev.n + 1 < t.board.n && t.history[prev.n + 1] ? prev.n + 1 : 0;
    const go = (n) => () => { ui.prev = n || false; render(); };
    return el('div', { class: 'stack' },
      el('div', { class: 'row-buttons' },
        older ? el('button', { type: 'button', class: 'pill', 'data-key': 'older-board', onclick: go(older) }, `← Board ${older}`) : null,
        newer ? el('button', { type: 'button', class: 'pill', 'data-key': 'newer-board', onclick: go(newer) }, `Board ${newer} →`) : null,
        el('button', { type: 'button', class: 'pill on', 'data-key': 'current-board', onclick: go(0) }, 'Back to the current board')),
      el('div', { class: 'board-line' }, el('b', {}, `Board ${prev.n}`), ` (${t.board.n - prev.n} back) · Dealer ${relative(me, prev.dealer)} · ${VUL_TEXT[prev.vul]}`),
      playViewer(pt, me) ?? felt(pt, me),
      review(pt, me, true));
  }

  // After the 13th card the last trick stays on the table for a few seconds before the result. Only when this phone saw
  // the board being played (opening a finished board goes straight to the result).
  const HOLD_MS = 3000;
  const boardKey = (t) => `${t.code}:${t.board.n}`;
  const isHeld = (t) => ui.holdKey === boardKey(t) && ui.heldDone !== boardKey(t);
  function holding(t) {
    const b = t.board;
    const key = boardKey(t);
    if (phase(t) !== 'over' || b.skip || Number.isInteger(b.claim) || !playOf(b)?.complete || ui.heldDone === key) return false;
    if (ui.holdKey !== key) {
      if (ui.lastPlayKey !== key) { ui.heldDone = key; return false; }
      ui.holdKey = key;
      clearTimeout(ui.holdTimer);
      ui.holdTimer = setTimeout(() => { ui.heldDone = key; render(); }, HOLD_MS);
    }
    return true;
  }

  function tableScreen(t) {
    const me = mySeat(t, ui.sync.uid);
    const b = t.board;
    const prev = t.history[b.n - 1];
    const viewed = ui.prev && Number(ui.prev) < b.n ? t.history[Number(ui.prev)] : null;
    if (viewed) return previousScreen(t, me, viewed);
    const hold = holding(t);
    if (phase(t) === 'play') ui.lastPlayKey = `${t.code}:${b.n}`;
    const ph = hold ? 'play' : phase(t);
    const st = ph === 'play' ? playOf(b) : null;
    const now = actor(t);
    const waiting = now && t.seats[now].kind === 'open' ? `Waiting for a player in the ${COMPASS[now]} seat.` : now && t.seats[now].kind === 'human' ? `Waiting for ${relative(me, now) === 'Partner' ? 'partner' : t.seats[now].name || COMPASS[now]}…` : now ? 'The robot is thinking…' : '';
    const someoneMissing = SEATS.some((s) => t.seats[s].kind === 'open');
    return el('div', { class: 'stack' },
      ui.stale ? el('p', { class: 'notice', role: 'alert', 'data-key': 'stale' }, ui.stale === 'old'
        ? 'Someone at this table is using an older version of the app, so claims, take-backs and chat can get lost. Ask them to open the app, tap Update (or reload it twice).'
        : 'This table was last changed by a newer version of the app. Reload this page, or tap Update, to get it.') : null,
      st ? el('div', { class: 'table-head compact' },
        el('div', { class: 'compact-line' }, el('b', {}, t.code), ` · Board ${b.n} · Dealer ${relative(me, b.dealer)} · ${VUL_TEXT[b.vul]}`),
        el('div', { class: 'row-buttons' },
          el('button', { type: 'button', class: 'pill small', 'data-key': 'share', onclick: () => share(t.code) }, 'Invite'),
          el('button', { type: 'button', class: 'pill small', 'data-key': 'leave', onclick: exit }, 'Leave')))
      : [el('div', { class: 'table-head' },
        el('div', {}, el('div', { class: 'label' }, 'Table'), el('div', { class: 'code-big' }, t.code)),
        el('div', { class: 'row-buttons' },
          el('button', { type: 'button', class: 'pill', 'data-key': 'share', onclick: () => share(t.code) }, 'Invite'),
          el('button', { type: 'button', class: 'pill', 'data-key': 'leave', onclick: exit }, 'Leave'))),
      el('div', { class: 'board-line' }, el('b', {}, `Board ${b.n}`), ` · Dealer ${relative(me, b.dealer)} · ${VUL_TEXT[b.vul]}`)],
      declarerChoice(t),
      b.swap ? el('p', { class: 'muted', 'data-key': 'swap-note' }, `Your partner (a robot) was the declarer, so you moved to ${COMPASS[b.swap[2]]} and play the contract; the robot sits ${COMPASS[b.swap[0]]} as dummy.`) : null,
      prev ? el('div', { class: 'row-buttons' }, el('button', { type: 'button', class: 'pill', 'data-key': 'previous-board', onclick: () => { ui.prev = prev.n; render(); } }, `← Earlier boards (${Math.min(b.n - 1, Object.keys(t.history).length)})`)) : null,
      (ph === 'over' && playViewer(t, me, true)) || felt(t, me),
      requestNote(t, 'claim'),
      ph === 'over' || hold ? null : me && now === me ? null : el('p', { class: 'muted status-line', role: 'status' }, me ? waiting : 'You are watching. Pick an empty seat below to play.'),
      hold ? el('div', { class: 'panel row-buttons', 'data-key': 'last-trick-hold' },
        el('span', {}, 'The last trick. The result comes up in a moment.'),
        el('button', { type: 'button', class: 'pill', 'data-key': 'show-result', onclick: () => { clearTimeout(ui.holdTimer); ui.heldDone = ui.holdKey; render(); } }, 'Show the result now'))
        : st ? playArea(t, me, st) : chatPanel(t, me),
      st ? chatPanel(t, me) : me && ph !== 'over' ? myHand(handOf(b, me)) : null,
      st && me && !hold ? claimControls(t, me) : null,
      !hold && (undoButton(t) || (st && me)) ? el('div', { class: 'row-buttons' }, undoButton(t),
        st && me ? el('button', { type: 'button', class: 'pill', 'data-key': 'skip-play', onclick: () => act((cur) => cur && skipPlay(cur)) }, 'Skip the play') : null) : null,
      ph === 'over' ? review(t, me) : ph === 'bidding' && me && now === me ? myTurn(t, me) : null,
      ph === 'over' ? null : myCallsCheck(t, me),
      ph === 'bidding' ? el('label', { class: 'toggle' },
        el('input', { type: 'checkbox', 'data-key': 'hints', checked: saved.hints, onchange: (e) => { saved.hints = e.target.checked; save(); render(); } }),
        ' Show what each call means') : null,
      ph === 'bidding' && saved.hints ? meanings(t, me) : null,
      el('details', { class: 'manage', open: someoneMissing || !me },
        el('summary', {}, 'Seats and opponents'),
        seatsView(t, me),
        me === 'N' || me === 'S' ? segmented('Opponents', [['robot', 'Robots'], ['pass', 'Always pass'], ['players', 'Players']], t.opponents, (v) => act((cur) => cur && setOpponents(cur, v))) : null),
      savedBoards(),
      ui.error ? el('p', { class: 'muted', role: 'status' }, ui.error) : null);
  }

  function render() {
    keepFocus(root, () => {
      const sv = ui.viewSaved && saved.boards.find((x) => x.id === ui.viewSaved);
      if (sv) root.replaceChildren(savedScreen(sv));
      else if (ui.table) {
        root.replaceChildren(tableScreen(ui.table));
        // When the play of a board starts, bring the table to the top of the screen once, so it and my hand fit together.
        const t = ui.table;
        const key = `${t.code}:${t.board.n}`;
        if (phase(t) === 'play' && ui.scrolledFor !== key && !ui.prev) {
          ui.scrolledFor = key;
          const head = root.querySelector('.table-head.compact');
          const bar = document.querySelector('header.top')?.getBoundingClientRect().height ?? 0; // the sticky title and tabs
          if (head) window.scrollTo({ top: window.scrollY + head.getBoundingClientRect().top - bar - 4 });
        }
      }
      else if (saved.code && ui.busy) root.replaceChildren(el('p', { class: 'muted', role: 'status' }, `Connecting to table ${saved.code}…`));
      else root.replaceChildren(lobby());
    });
  }

  render();
  // Come back to the table this phone was at, or open the invited one.
  if (mode !== 'none' && saved.name.trim()) {
    if (ui.joinCode) open(ui.joinCode);
    else if (saved.code) open(saved.code);
  }
}
