import { SUITS, SYMBOL, evaluate } from '../cards.js';
import { SEATS, partnerOf, sideOf, seatAt } from '../auction.js';
import { advise, explain } from '../engine.js';
import { callLabel, rankLabel } from '../format.js';
import { FIREBASE, NOTES_URL } from '../config.js';
import { firebaseSync, localSync } from '../table/sync.js';
import {
  CODE, newCode, newTable, auctionOf, handOf, mySeat, isDone, turn,
  setOpponents, sit, leave, setSeatKind, call, playRobot, nextBoard, rebid, undo, lastOwnCall,
} from '../table/model.js';
import { reviewRows, systemAuction, contract } from '../table/review.js';
import { el, segmented, keepFocus } from './dom.js';
import { biddingBox } from './bidding-box.js';
import { copyButton } from './copy.js';
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
    handStyle: r.handStyle === 'list' ? 'list' : 'cards',
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
  const urlCode = (params.get('table') ?? '').toUpperCase();
  const mode = params.get('sync') === 'local' ? 'local' : FIREBASE ? 'firebase' : 'none';
  const ui = { sync: null, table: null, unwatch: null, error: '', joinCode: CODE.test(urlCode) ? urlCode : '', busy: false, hint: null, robotKey: '' };
  if (CODE.test(urlCode) && urlCode !== saved.code) saved.code = '';

  const save = () => store.save('table', saved);

  async function connect() {
    if (ui.sync) return ui.sync;
    ui.sync = mode === 'local' ? localSync() : await firebaseSync(FIREBASE);
    return ui.sync;
  }

  function watch(code) {
    ui.unwatch?.();
    ui.unwatch = ui.sync.watch(code, (t) => {
      ui.table = t;
      if (!t) ui.error = `Table ${code} was not found.`;
      ui.hint = null;
      driveRobots();
      render();
    });
  }

  async function act(fn, failure) {
    if (!ui.table) return;
    const res = await ui.sync.change(ui.table.code, fn);
    if (!res && failure) {
      ui.error = failure;
      render();
    }
  }

  // Robots (and always-pass seats) bid on every phone at the table; the transaction lets only one call through.
  function driveRobots() {
    const t = ui.table;
    if (!t || isDone(t)) return;
    const s = turn(t);
    if (!['robot', 'pass'].includes(t.seats[s].kind)) return;
    const key = `${t.code}:${t.board.n}:${t.board.calls}`;
    if (ui.robotKey === key) return;
    ui.robotKey = key;
    setTimeout(() => ui.sync.change(t.code, (cur) => cur && cur.board.n === t.board.n && cur.board.calls === t.board.calls ? playRobot(cur, advise) : undefined), 600);
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
    if (!saved.name.trim()) return fail('Enter your name first.');
    if (!CODE.test(code)) return fail('A table code has 6 letters and digits.');
    ui.busy = true;
    render();
    try {
      await connect();
      saved.code = code;
      save();
      ui.busy = false;
      watch(code);
      // Take the first free seat of North/South, then East/West, unless already seated.
      await ui.sync.change(code, (t) => {
        if (!t || mySeat(t, ui.sync.uid)) return undefined;
        const free = ['N', 'S', 'E', 'W'].find((s) => t.seats[s].kind === 'open');
        return free ? sit(t, free, ui.sync.uid, saved.name.trim()) : undefined;
      });
    } catch (err) {
      fail(`Could not connect. Check the internet connection and try again. (${err.message ?? err})`);
    }
  }

  function fail(msg) {
    ui.busy = false;
    ui.error = msg;
    render();
  }

  function exit() {
    const t = ui.table;
    if (t) ui.sync.change(t.code, (cur) => (cur ? leave(cur, ui.sync.uid) : undefined));
    ui.unwatch?.();
    ui.unwatch = null;
    ui.table = null;
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
          el('input', { 'data-key': 'tbl-code', class: 'field code', value: ui.joinCode, maxlength: 6, placeholder: 'CODE', autocapitalize: 'characters', 'aria-label': 'Table code', oninput: (e) => { ui.joinCode = e.target.value.toUpperCase(); } }),
          el('button', { type: 'button', class: 'pill on', 'data-key': 'join', disabled: ui.busy, onclick: () => open(ui.joinCode.trim()) }, 'Join'))),
      ui.error ? el('p', { class: 'muted', role: 'status' }, ui.error) : null);
  }

  function seatsView(t, me) {
    return el('div', { class: 'seats' }, ...['N', 'W', 'E', 'S'].map((s) => {
      const st = t.seats[s];
      const who = st.kind === 'human' ? st.name || 'Player' : st.kind === 'robot' ? 'Robot' : st.kind === 'pass' ? 'Always passes' : 'Empty';
      const actions = [];
      if (st.kind === 'open') {
        actions.push(el('button', { type: 'button', class: 'pill', 'data-key': `sit-${s}`, onclick: () => act((cur) => cur && sit(cur, s, ui.sync.uid, saved.name.trim() || 'Player')) }, me ? 'Move here' : 'Sit here'));
        actions.push(el('button', { type: 'button', class: 'pill', 'data-key': `robot-${s}`, onclick: () => act((cur) => cur && setSeatKind(cur, s, 'robot')) }, 'Robot'));
      } else if (st.kind === 'robot' && me && sideOf(s) === sideOf(me)) {
        actions.push(el('button', { type: 'button', class: 'pill', 'data-key': `free-${s}`, onclick: () => act((cur) => cur && setSeatKind(cur, s, 'open')) }, 'Free seat'));
      }
      return el('div', { class: `seat seat-${s}${s === me ? ' me' : ''}${turn(t) === s ? ' turn' : ''}` },
        el('div', { class: 'label' }, `${COMPASS[s]}${me ? ` · ${relative(me, s)}` : ''}`),
        el('div', { class: 'seat-name' }, who),
        actions.length ? el('div', { class: 'row-buttons' }, ...actions) : null);
    }));
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
    return el('div', { class: `plate${turn(t) === s ? ' turn' : ''}${s === me ? ' me' : ''}`, title: `${COMPASS[s]}: ${name}` },
      el('span', { class: `dir${isVul(b, s) ? ' vul' : ''}` }, s),
      el('span', { class: 'pname' }, name),
      b.dealer === s ? el('span', { class: 'dealer', 'aria-label': 'Dealer' }, 'D') : null);
  }

  const backs = (n, cls = '') => el('div', { class: `backs${cls}`, 'aria-hidden': 'true' }, ...Array.from({ length: n }, () => el('span', { class: 'back' })));

  function boardBox(t, me) {
    const b = t.board;
    const pos = around(me);
    const edge = (where) => (isVul(b, pos[where]) ? ' vul' : '');
    return el('div', { class: `bnum${edge('top') ? ' vt' : ''}${edge('bottom') ? ' vb' : ''}${edge('left') ? ' vl' : ''}${edge('right') ? ' vr' : ''}`, 'aria-label': `Board ${b.n}, dealer ${COMPASS[b.dealer]}, ${VUL_TEXT[b.vul]}` },
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

  function felt(t, me) {
    const pos = around(me);
    return el('div', { class: 'felt' },
      el('div', { class: 'f-board' }, boardBox(t, me)),
      el('div', { class: 'f-top' }, backs(13), plate(t, pos.top, me)),
      el('div', { class: 'f-left' }, backs(5, ' side'), plate(t, pos.left, me)),
      el('div', { class: 'f-center' }, auctionBox(t, me)),
      el('div', { class: 'f-right' }, backs(5, ' side'), plate(t, pos.right, me)),
      el('div', { class: 'f-bottom' }, plate(t, pos.bottom, me)));
  }

  // My hand as cards: spades, hearts, clubs, diamonds (alternating colours), overlapping to fit the screen.
  function cards(hand) {
    const list = ['S', 'H', 'C', 'D'].flatMap((s) => [...hand[s]].map((r) => [s, r]));
    const e = evaluate(hand);
    return el('div', { class: 'hand-wrap' },
      el('div', { class: 'cards', role: 'img', 'aria-label': `Your hand: ${SUITS.map((s) => `${SYMBOL[s]} ${hand[s] ? [...hand[s]].map(rankLabel).join(' ') : 'none'}`).join(', ')}` },
        ...list.map(([s, r]) => el('span', { class: `card${s === 'H' || s === 'D' ? ' redc' : ''}` },
          el('span', { class: 'rank' }, rankLabel(r)), el('span', { class: 'pip' }, SYMBOL[s])))),
      el('div', { class: 'hcp' }, `${e.hcp} HCP`));
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
              el('p', {}, el('b', {}, 'Tells partner: '), hint.meaning)]
          : el('button', { type: 'button', class: 'pill', 'data-key': 'hint', onclick: () => { ui.hint = advise(handOf(t.board, me), a); render(); } }, 'Show the Advisor\'s bid')),
      biddingBox(a, { doubles: true, onCall: (c) => act((cur) => cur && call(cur, me, c, ui.sync.uid), 'That call did not go through. Try again.') }));
  }

  function undoButton(t) {
    if (lastOwnCall(t, ui.sync.uid) < 0) return null;
    return el('button', { type: 'button', class: 'pill', 'data-key': 'undo', onclick: () => act((cur) => cur && undo(cur, ui.sync.uid), 'Too late to undo: another player has called since.') }, '↶ Undo my last call');
  }

  function review(t, me) {
    const b = t.board;
    const a = auctionOf(b);
    const k = contract(a);
    const rows = reviewRows(b, t.seats);
    const sys = systemAuction(b, t.seats);
    const sysK = contract(sys);
    const kText = (x) => (x ? `${callLabel(x.bid)}${x.doubled ? ` ${x.doubled === 'XX' ? 'redoubled' : 'doubled'}` : ''} by ${relative(me, x.declarer)}` : 'Passed out');
    return el('div', { class: 'stack' },
      el('div', { class: 'panel' },
        el('div', { class: 'eyebrow' }, 'Auction over'),
        el('div', { class: 'big' }, kText(k)),
        el('p', { class: 'muted' }, `The Advisor would reach: ${kText(sysK)} (${sys.calls.map(callLabel).join(' ')}).`)),
      el('div', { class: 'compass' }, ...['N', 'W', 'E', 'S'].map((s) => el('div', { class: `seat-${s}` }, handView(handOf(b, s), `${COMPASS[s]} (${relative(me, s)})`)))),
      el('div', {},
        el('div', { class: 'label' }, 'Call by call'),
        rows.some((r) => r.skipped) ? el('p', { class: 'muted' }, 'Only each player\'s first difference from the Advisor is shown: the calls after it depend on it.') : null,
        el('div', { class: 'lines' }, ...rows.filter((r) => r.call !== 'P' || r.human).map((r) => el('details', { class: `line${r.differs ? ' differs' : ''}${r.human ? '' : ' opp'}` },
          el('summary', {}, el('span', { class: 'who' }, relative(me, r.seat)), el('span', { class: 'bid-l' }, callLabel(r.call)),
            el('span', {}, r.differs ? `Advisor: ${callLabel(r.advisor.call)}` : r.meaning ?? (r.call === 'P' ? 'Pass' : 'No agreement'))),
          r.meaning ? el('p', {}, r.meaning) : null,
          r.differs ? el('p', {}, el('b', {}, `Advisor's ${callLabel(r.advisor.call)}: `), `${r.advisor.meaning}${r.advisor.reasons?.length ? ` (${r.advisor.reasons.join('; ')})` : ''}`) : null,
          r.differs && r.misfit?.length ? el('p', {}, el('b', {}, `Why ${callLabel(r.call)} does not fit your hand: `), `${r.misfit.join('; ')}.`) : null,
          r.differs && r.advisor.close ? el('p', { class: 'close' }, el('b', {}, 'Close call: '), r.advisor.close) : null,
          r.entry || r.notes ? el('a', { href: `${NOTES_URL}#${r.entry?.notes ?? r.notes}` }, 'Read more in the system notes') : null)))),
      el('div', { class: 'row-buttons' },
        el('button', { type: 'button', class: 'pill on', 'data-key': 'next-board', onclick: () => act((cur) => cur && nextBoard(cur, rand)) }, 'Next board'),
        el('button', { type: 'button', class: 'pill', 'data-key': 'rebid', onclick: () => act((cur) => cur && rebid(cur)) }, 'Bid it again')),
      copyButton('Copy this board', () => boardReport(t, me), 'copy-board'));
  }

  function tableScreen(t) {
    const me = mySeat(t, ui.sync.uid);
    const b = t.board;
    const now = turn(t);
    const waiting = now && t.seats[now].kind === 'open' ? `Waiting for a player in the ${COMPASS[now]} seat.` : now && t.seats[now].kind === 'human' ? `Waiting for ${relative(me, now) === 'Partner' ? 'partner' : t.seats[now].name || COMPASS[now]}…` : now ? 'The robot is thinking…' : '';
    const someoneMissing = SEATS.some((s) => t.seats[s].kind === 'open');
    return el('div', { class: 'stack' },
      el('div', { class: 'table-head' },
        el('div', {}, el('div', { class: 'label' }, 'Table'), el('div', { class: 'code-big' }, t.code)),
        el('div', { class: 'row-buttons' },
          el('button', { type: 'button', class: 'pill', 'data-key': 'share', onclick: () => share(t.code) }, 'Invite'),
          el('button', { type: 'button', class: 'pill', 'data-key': 'leave', onclick: exit }, 'Leave'))),
      el('div', { class: 'board-line' }, el('b', {}, `Board ${b.n}`), ` · Dealer ${relative(me, b.dealer)} · ${VUL_TEXT[b.vul]}`),
      felt(t, me),
      me ? myHand(handOf(b, me)) : null,
      isDone(t) ? null : me && now === me ? null : el('p', { class: 'muted', role: 'status' }, me ? waiting : 'You are watching. Pick an empty seat below to play.'),
      undoButton(t) ? el('div', { class: 'row-buttons' }, undoButton(t)) : null,
      isDone(t) ? review(t, me) : me && now === me ? myTurn(t, me) : null,
      !isDone(t) ? el('label', { class: 'toggle' },
        el('input', { type: 'checkbox', 'data-key': 'hints', checked: saved.hints, onchange: (e) => { saved.hints = e.target.checked; save(); render(); } }),
        ' Show what each call means') : null,
      !isDone(t) && saved.hints ? meanings(t, me) : null,
      el('details', { class: 'manage', open: someoneMissing || !me },
        el('summary', {}, 'Seats and opponents'),
        seatsView(t, me),
        me === 'N' || me === 'S' ? segmented('Opponents', [['robot', 'Robots'], ['pass', 'Always pass'], ['players', 'Players']], t.opponents, (v) => act((cur) => cur && setOpponents(cur, v))) : null),
      ui.error ? el('p', { class: 'muted', role: 'status' }, ui.error) : null);
  }

  function render() {
    keepFocus(root, () => {
      if (ui.table) root.replaceChildren(tableScreen(ui.table));
      else if (saved.code && ui.busy) root.replaceChildren(el('p', { class: 'muted' }, 'Connecting…'));
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
