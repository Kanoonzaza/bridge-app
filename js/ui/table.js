import { SUITS, SYMBOL, evaluate, suitOrder } from '../cards.js';
import { SEATS, partnerOf, sideOf, seatAt } from '../auction.js';
import { advise, explain, summarize } from '../engine.js';
import { callLabel, rankLabel } from '../format.js';
import { FIREBASE, NOTES_URL } from '../config.js';
import { firebaseSync, localSync } from '../table/sync.js';
import {
  CODE, parseCode, seatsAtBidding, say, restoreChat, chatKey, newCode, newTable, auctionOf, handOf, mySeat, isDone, turn,
  setOpponents, sit, leave, setSeatKind, PROTO, hostOf, kick, allowBack, moveSeat, takeOver, giveBack, keepRobot, choicePending, autoDeclare, call, playRobot, nextBoard, rebid, undo, lastOwnCall,
  phase, isOver, actor, playOf, playCard, skipPlay, undoCard, lastOwnCard, claimChance, pendingClaim, requestClaim, answerClaim, cancelClaim, requestUndo, answerUndo, cancelUndo, pendingUndo,
} from '../table/model.js';
import { legalCards, controller } from '../table/play.js';
import { sharedPool, poolChoose } from '../table/pool.js';
import { simulatedAdvice } from '../sim-advice.js';
import { resultText } from '../report.js';
import { reviewRows, systemAuction, contract } from '../table/review.js';
import { el, segmented, keepFocus } from './dom.js';
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
  const ui = { peek: {}, open: { chat: saved.chatOpen }, claiming: false, claimN: null, chatDraft: saved.chatDraft, chatSeen: 0, sync: null, table: null, unwatch: null, error: '', joinCode: CODE.test(urlCode) ? urlCode : '', busy: false, hint: null, robotKey: '', prev: false, dd: new Map() };
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
    ui.unwatch = ui.sync.watch(code, (t) => {
      const joining = ui.joining === code;
      // The stamp this version leaves on every write is gone: a phone with an older version rewrote the table.
      if (t?.proto) ui.sawProto = true;
      ui.stale = t ? (ui.sawProto && !t.proto ? 'old' : t.proto > PROTO ? 'new' : '') : '';
      if (joining) settleJoin();
      ui.table = t;
      if (t) mirrorChat(t);
      if (!t) {
        ui.error = `Table ${code} was not found. Check the code with whoever made the table.`;
        if (joining) { saved.code = ''; save(); ui.unwatch?.(); ui.unwatch = null; }
      }
      ui.hint = null;
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
    }, 600);
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

  function plate(t, s, me) {
    const st = t.seats[s];
    const name = st.kind === 'human' ? st.name || 'Player' : st.kind === 'robot' ? 'Robot' : st.kind === 'pass' ? 'Passes' : 'Empty';
    const b = t.board;
    return el('div', { class: `plate${nowAt(t) === s ? ' turn' : ''}${s === me ? ' me' : ''}`, title: `${COMPASS[s]}: ${name}` },
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
  function trickBox(t, me, st) {
    const pos = around(me);
    const last = st.tricks.at(-1);
    const shown = st.current.length ? st.current : last ? last.cards : [];
    const at = Object.fromEntries(shown.map((p) => [p.seat, p.card]));
    const spot = (where) => {
      const c = at[pos[where]];
      return el('div', { class: `tspot t-${where}` }, c ? playedCard(c) : null);
    };
    const k = st.contract;
    return el('div', { class: `tbox${st.current.length ? '' : ' last'}`, 'aria-label': 'Cards played to this trick' },
      el('div', { class: 'thead' }, `${callLabel(k.bid)}${k.doubled ? ` ${k.doubled === 'XX' ? 'XX' : 'X'}` : ''} by ${relative(me, k.declarer)}`),
      spot('top'), spot('left'), spot('right'), spot('bottom'),
      el('div', { class: 'tfoot' }, st.current.length || !last ? `Tricks: declarer ${st.declarerTricks}, defence ${st.defenderTricks}` : `${relative(me, last.winner)} won trick ${st.tricks.length} · declarer ${st.declarerTricks}, defence ${st.defenderTricks}`));
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
    const st = phase(t) === 'play' ? playOf(t.board) : null;
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
      requestNote(t, 'undo'));
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
      el('div', { class: 'frog-track', 'aria-hidden': 'true' }, el('span', { class: 'frog' }, '🐸')),
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
        el('p', { class: 'muted' }, `The Advisor would reach: ${kText(sysK)} (${sys.calls.map(callLabel).join(' ')}).`)),
      el('div', { class: 'compass' }, ...['N', 'W', 'E', 'S'].map((s) => el('div', { class: `seat-${s}` }, handView(handOf(b, s), `${COMPASS[s]} (${relative(me, s)})`)))),
      ddPanel(t, me, k),
      playRecord(t.board),
      saveBoardButton(t, me),
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
      past ? null : el('div', { class: 'row-buttons' },
        el('button', { type: 'button', class: 'pill on', 'data-key': 'next-board', onclick: () => act((cur) => cur && nextBoard(cur, rand)) }, 'Next board'),
        el('button', { type: 'button', class: 'pill', 'data-key': 'rebid', onclick: () => act((cur) => cur && rebid(cur)) }, 'Bid it again')),
      copyButton('Copy this board', () => boardReport(t, me, ui.dd.get(ddKey(t))), 'copy-board'));
  }

  // The play of a board, trick by trick: who played what, and who won.
  function playRecord(b) {
    const st = playOf(b);
    if (!st || !b.play) return null;
    const line = (cards, winner) => el('div', { class: 'trick-line' }, ...cards.flatMap((p) => [el('span', { class: `tseat${p.seat === winner ? ' won' : ''}` }, p.seat), el('span', { class: `tcard${p.seat === winner ? ' won' : ''}` }, `${SYMBOL[p.card[0]]}${rankLabel(p.card[1])}`)]));
    return el('details', { class: 'manage', 'data-key': 'play-record', open: true },
      el('summary', {}, `The play (${st.tricks.length} trick${st.tricks.length === 1 ? '' : 's'}${st.trump ? `, trumps ${SYMBOL[st.trump]}` : ', notrump'})`),
      el('div', { class: 'lines' },
        ...st.tricks.map((tr, i) => el('div', { class: 'line' }, el('div', { class: 'row' }, el('span', { class: 'who' }, String(i + 1)), line(tr.cards, tr.winner), el('span', { class: 'muted' }, `${tr.winner} wins`)))),
        ...(st.current.length ? [el('div', { class: 'line' }, el('div', { class: 'row' }, el('span', { class: 'who' }, String(st.tricks.length + 1)), line(st.current, null)))] : [])));
  }

  // Saving a finished board on this phone, to look at again later (also after the table is gone).
  const boardId = (t) => `${t.code}:${t.board.n}`;
  function saveBoardButton(t, me) {
    const id = boardId(t);
    const have = saved.boards.some((x) => x.id === id);
    return el('div', { class: 'row-buttons' },
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
      felt(pt, x.me),
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
      felt(pt, me),
      review(pt, me, true));
  }

  function tableScreen(t) {
    const me = mySeat(t, ui.sync.uid);
    const b = t.board;
    const prev = t.history[b.n - 1];
    const viewed = ui.prev && Number(ui.prev) < b.n ? t.history[Number(ui.prev)] : null;
    if (viewed) return previousScreen(t, me, viewed);
    const ph = phase(t);
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
      felt(t, me),
      requestNote(t, 'claim'),
      st ? playArea(t, me, st) : chatPanel(t, me),
      st ? chatPanel(t, me) : me ? myHand(handOf(b, me)) : null,
      ph === 'over' ? null : me && now === me ? null : el('p', { class: 'muted', role: 'status' }, me ? waiting : 'You are watching. Pick an empty seat below to play.'),
      st && me ? claimControls(t, me) : null,
      undoButton(t) || (st && me) ? el('div', { class: 'row-buttons' }, undoButton(t),
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
