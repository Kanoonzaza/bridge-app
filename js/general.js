// General meanings for calls no rule covers, mostly in contested auctions.
// Built from the notes' general rules: penalty or takeout, raises by the Law of Total Tricks,
// free bids, cue-bids of their suit, and control bids once a suit is agreed.
import { SYMBOL } from './cards.js';
import { seatAt, sideOf, partnerOf, isBid, bidRank } from './auction.js';

const SUITS = ['S', 'H', 'D', 'C'];
const isMajor = (s) => s === 'H' || s === 'S';
const GAME = (c) => isBid(c) && bidRank(c) >= bidRank(c[1] === 'N' ? '3N' : isMajor(c[1]) ? `4${c[1]}` : `5${c[1]}`);
const list = (suits) => suits.map((s) => SYMBOL[s]).join(' and ');

// The suits a call shows (4+ cards). A call without a known meaning is taken as natural.
function suitsShown(r, min = 4) {
  if (r.shows?.len) return SUITS.filter((s) => (r.shows.len[s]?.[0] ?? 0) >= min);
  if (!r.entry && isBid(r.call) && r.call[1] !== 'N') return [r.call[1]];
  return [];
}

const general = (meaning, notes, shows = null) => ({ meaning, notes, shows, general: true });

export function describeCall(auction, i, rows) {
  const call = auction.calls[i];
  if (call === 'P') return null;
  const me = seatAt(auction, i);
  const pard = partnerOf(me);
  const side = sideOf(me);
  const prior = rows.slice(0, i);
  const ours = prior.filter((r) => sideOf(r.seat) === side);
  const theirs = prior.filter((r) => sideOf(r.seat) !== side);
  // Their suits need 4+ cards; ours count from 3 (an opening 1♣ or a 3-card raise still names the suit).
  const suitsBy = (rs, min) => new Set(rs.flatMap((r) => suitsShown(r, min)));
  const theirSuits = suitsBy(theirs, 4);
  const pardSuits = suitsBy(ours.filter((r) => r.seat === pard), 3);
  const mySuits = suitsBy(ours.filter((r) => r.seat === me), 3);
  const agreed = SUITS.find((s) => pardSuits.has(s) && mySuits.has(s) && !theirSuits.has(s)) ?? null;
  const lastBid = [...prior].reverse().find((r) => isBid(r.call));
  const theyBidLast = lastBid && sideOf(lastBid.seat) !== side;
  // Their double also counts: after it we are competing, not exploring.
  const lastAct = [...prior].reverse().find((r) => r.call !== 'P');
  const theyActedLast = lastAct && sideOf(lastAct.seat) !== side;
  const pardLast = [...ours].reverse().find((r) => r.seat === pard && r.call !== 'P');
  const iDoubled = ours.some((r) => r.seat === me && r.call === 'X');
  const iActed = ours.some((r) => r.seat === me && r.call !== 'P');
  const pardActed = ours.some((r) => r.seat === pard && r.call !== 'P');
  const opened = prior.find((r) => isBid(r.call));
  const weOpened = opened && sideOf(opened.seat) === side;
  const competitive = theirs.some((r) => r.call !== 'P');
  // Partner's takeout (or competitive) double was the last action: a suit bid answers it.
  const answering = lastAct && lastAct.seat === pard && lastAct.call === 'X' && /takeout/i.test(lastAct.meaning ?? '') && !/penalty/i.test(lastAct.meaning ?? '');
  // Partner's last call was a forcing bid and they passed: we had to bid something.
  const forced = lastAct && lastAct.seat === pard && isBid(lastAct.call) && ['round', 'game'].includes(lastAct.shows?.force);

  if (call === 'XX') {
    if (lastBid && !theyBidLast && GAME(lastBid.call)) return general('Redouble: to play. We expect to make it doubled.', 'penalty-or-takeout-the-general-rule');
    return general('Redouble: a good hand (about 10+ HCP). From here our doubles are for penalty; partner should not run without a reason.', 'penalty-or-takeout-the-general-rule', { hcp: [10, 37] });
  }

  if (call === 'X') {
    const lb = lastBid.call;
    const P = (why) => general(`Penalty double: ${why}.`, 'penalty-or-takeout-the-general-rule');
    if (lb[1] === 'N') return P('they bid notrump');
    // Their call was artificial (it does not show the suit named): double shows that suit.
    if (lastBid.entry && !suitsShown(lastBid, 3).includes(lb[1]) && !theirSuits.has(lb[1])) return general(`Double of their artificial ${SYMBOL[lb[1]]}: shows good cards in ${SYMBOL[lb[1]]} (a lead director).`, 'lead-directing-doubles');
    if (GAME(lb)) return P(ours.some((r) => isBid(r.call)) ? 'we expect to beat their contract' : 'they bid a game freely');
    if (agreed) return P(`we have already agreed ${SYMBOL[agreed]}, so this shows values and length in their suit`);
    if (ours.some((r) => r.call === 'XX')) return P("our redouble already showed values");
    if (Number(lb[0]) >= 4) return P('they are at the 4-level: values and tricks in their suit (partner pulls only with an unusual hand)');
    // A suit they opened counts as theirs even when it promised only 3 cards.
    const named = suitsBy(theirs, 3);
    const unbid = SUITS.filter((s) => !theirSuits.has(s) && !named.has(s) && !pardSuits.has(s) && !mySuits.has(s));
    // Opener doubles after partner has only passed.
    if (opened?.seat === me && !pardActed) {
      return general('Double by opener (partner has passed), for takeout: short in their suit with opening values, or a strong hand (about 18+) with no clear bid. Partner bids, or passes with length in their suit.', 'penalty-or-takeout-the-general-rule', { hcp: [13, 37] });
    }
    if (!iActed && !pardActed) {
      return general(`Takeout double: short in their suit, ${unbid.length ? `support for ${list(unbid)}` : 'support for the unbid suits'}, opening values or more.`, 'takeout-doubles', { hcp: [11, 37] });
    }
    // Partner overcalled, they bid on, and this is my first action: responsive.
    if (!iActed && pardActed && !weOpened) {
      return general(`Responsive double (takeout): values and ${unbid.length ? `cards in ${list(unbid)} (often 5 with a weaker hand)` : 'no clear bid'}, usually some support for partner too. Partner picks the contract.`, 'responsive-doubles');
    }
    return general(`Competitive double (takeout): extra values and no clear bid, short in their suit${unbid.length ? `; usually cards in ${list(unbid)}` : ''}. Partner picks the contract, or passes with length in their suit.`, 'penalty-or-takeout-the-general-rule');
  }

  const L = Number(call[0]);
  const s = call[1];
  const cheapest = lastBid ? (bidRank(`${lastBid.call[0]}${s}`) > bidRank(lastBid.call) ? Number(lastBid.call[0]) : Number(lastBid.call[0]) + 1) : 1;
  const jump = L > cheapest;
  const where = weOpened ? 'when-they-overcall-our-opening' : 'advancing-partners-overcall';

  // Replies to a general 4NT (RKCB 1430).
  if (pardLast?.call === '4N' && /RKCB|Key Card|Blackwood/i.test(pardLast.meaning ?? '') && L === 5 && !theyActedLast) {
    const REPLY = { C: '1 or 4 key cards', D: '0 or 3 key cards', H: '2 key cards without the trump queen', S: '2 key cards with the trump queen' };
    if (REPLY[s]) return general(`RKCB reply: ${REPLY[s]}.`, 'roman-key-card-blackwood-4nt');
  }

  if (s === 'N') {
    if (L >= 6) return general('To play: slam in notrump.', 'rkcb-1430-and-slam-tools-tier-1');
    if (L === 5) return general(agreed ? `5NT: grand slam try in ${SYMBOL[agreed]}.` : '5NT: pick a slam.', 'rkcb-1430-and-slam-tools-tier-1');
    if (L === 4) {
      const lastNatural = [...ours].reverse().find((r) => isBid(r.call) && r.call[1] !== 'N' && suitsShown(r).includes(r.call[1]));
      const T = agreed ?? lastNatural?.call[1];
      if (T) return general(`4NT: Roman Key Card Blackwood, ${SYMBOL[T]} as trumps.`, 'when-4nt-is-rkcb', { hcp: [13, 37] });
      return general('4NT: quantitative, invites 6NT.', 'when-4nt-is-rkcb');
    }
    const stop = theirSuits.size ? `, with a stopper in ${list([...theirSuits])}` : '';
    if (L === 3) return general(`To play: game in notrump${stop}.`, 'which-game');
    return general(`Natural notrump${stop}.`, competitive ? where : 'which-game');
  }

  // A cue-bid of their suit.
  if (theirSuits.has(s) && !pardSuits.has(s) && !mySuits.has(s)) {
    if (agreed && L >= 4) return general(`Control bid: a slam try in ${SYMBOL[agreed]}, with first- or second-round control of ${SYMBOL[s]}.`, 'control-bids-cue-bids');
    const ps = [...pardSuits][0];
    if (ps && !iActed) return general(`Cue-bid of their suit: a good raise of partner's ${SYMBOL[ps]} (limit raise or better, 10+), forcing.`, where, { hcp: [10, 37], len: { [ps]: [3, 13] }, force: 'round' });
    if (!pardActed && !iActed) return general('Cue-bid of their suit: a strong hand or a two-suiter, forcing.', 'competitive-bidding-tier-0', { force: 'round' });
    if (L >= 4) return general('Cue-bid of their suit: a strong hand, forcing. A slam try, usually with a fit for partner.', 'control-bids-cue-bids', { hcp: [12, 37], force: 'round' });
    return general('Cue-bid of their suit: a strong hand, forcing. Often asks partner for a stopper for 3NT, or shows a fit with extra values.', 'competitive-bidding-tier-0', { hcp: [12, 37], force: 'round' });
  }

  // Partner's suit: a raise.
  if (pardSuits.has(s) && !mySuits.has(s)) {
    const shown = Math.max(...ours.filter((r) => r.seat === pard).map((r) => r.shows?.len?.[s]?.[0] ?? 4));
    const need = Math.max(3, 8 - shown);
    if (L >= 6) return general(`To play: slam in ${SYMBOL[s]}.`, 'rkcb-1430-and-slam-tools-tier-1', { len: { [s]: [need, 13] } });
    if (GAME(call)) return general(`To play: game in partner's ${SYMBOL[s]}. Either values for game or a big fit and a weak hand (to take their room).`, 'competing-at-the-3-level', { len: { [s]: [need, 13] } });
    if (jump && competitive) return general(`Preemptive jump raise: 4+ ${SYMBOL[s]}, weak. Strong raises go through the cue-bid of their suit.`, where, { hcp: [0, 9], len: { [s]: [4, 13] } });
    if (jump) return general(`Invitational raise of partner's ${SYMBOL[s]}.`, 'which-game', { len: { [s]: [need, 13] } });
    if (theyActedLast) return general(`Competitive raise: ${need}+ ${SYMBOL[s]} support, competing for the part-score (Law of Total Tricks), not a game try.`, 'competing-at-the-3-level', { len: { [s]: [need, 13] } });
    return general(`Preference or raise: support for partner's ${SYMBOL[s]}.`, 'which-game', { len: { [s]: [need, 13] } });
  }

  // My own suit again. Answering partner's double, or bidding over partner's forcing bid, it need not be longer than shown.
  if (mySuits.has(s) && !pardSuits.has(s)) {
    if (L >= 6) return general(`To play: slam in ${SYMBOL[s]}.`, 'rkcb-1430-and-slam-tools-tier-1');
    const had = Math.max(...ours.filter((r) => r.seat === me).map((r) => r.shows?.len?.[s]?.[0] ?? 5));
    // Partner raised it (e.g. after Lebensohl): game in the suit we now share.
    if (GAME(call) && pardLast && isBid(pardLast.call) && pardLast.call[1] === s) return general(`To play: game in ${SYMBOL[s]}, the suit partner raised.`, 'which-game', { len: { [s]: [had, 13] } });
    if (GAME(call)) return general(`To play: game in my ${SYMBOL[s]}, a long, strong suit.`, 'which-game', { len: { [s]: [6, 13] } });
    if (answering) return general(`Answer to partner's double: back to my ${SYMBOL[s]} (${had}+ cards), the best of the suits. Not forcing.`, 'takeout-doubles', { len: { [s]: [had, 13] } });
    if (forced) return general(`Rebid of my ${SYMBOL[s]} over partner's forcing bid: nothing better to show (${had}+ cards).`, 'openers-rebids-tier-0', { len: { [s]: [had, 13] } });
    const n = Math.max(6, had);
    return general(`Rebid of my ${SYMBOL[s]}: ${n}+ cards${theyActedLast ? ', competing for the part-score' : ''}. Not forcing.`, theyActedLast ? 'competing-at-the-3-level' : 'openers-rebids-tier-0', { len: { [s]: [n, 13] } });
  }

  // Back to an agreed suit (both of us have shown it).
  if (agreed === s) {
    if (L >= 6) return general(`To play: slam in ${SYMBOL[s]}.`, 'rkcb-1430-and-slam-tools-tier-1');
    if (L === 5 && isMajor(s) && !theyActedLast) return general(`5${SYMBOL[s]}: slam invitation. Partner bids 6 with good trumps.`, 'rkcb-1430-and-slam-tools-tier-1');
    if (GAME(call)) return general(`To play: game in ${SYMBOL[s]}.`, 'which-game');
    if (theyActedLast) return general(`Competing in our ${SYMBOL[s]} fit (Law of Total Tricks); not a game try.`, 'competing-at-the-3-level');
    return general(`Back to our ${SYMBOL[s]}: no extra values, stops below game.`, 'which-game');
  }

  // A new suit.
  if (answering && !agreed && !GAME(call)) {
    return general(`Answer to partner's double: my best unbid suit, usually 4+ ${SYMBOL[s]}${jump ? ', with some values (a jump)' : ''}. Not forcing.`, 'takeout-doubles', { ...(jump && { hcp: [9, 37] }), len: { [s]: [isMajor(s) ? 4 : 3, 13] } });
  }
  if (agreed && L >= 4 && !GAME(call)) return general(`Control bid: a slam try in ${SYMBOL[agreed]}, with first- or second-round control of ${SYMBOL[s]}.`, 'control-bids-cue-bids');
  if (agreed) return general(`Game try in ${SYMBOL[agreed]}: values in ${SYMBOL[s]} (also tells partner what to lead if they buy the contract).`, 'competing-at-the-3-level');
  if (L >= 6) return general(`To play: slam in ${SYMBOL[s]}.`, 'rkcb-1430-and-slam-tools-tier-1', { len: { [s]: [6, 13] } });
  if (GAME(call)) return general(`To play: a long ${SYMBOL[s]} suit.`, 'which-game', { len: { [s]: [6, 13] } });
  if (jump) return general(`Jump in a new suit: a long ${SYMBOL[s]} suit (6+).`, competitive ? where : 'which-game', { len: { [s]: [6, 13] } });
  const iOpened = opened && opened.seat === me;
  if (iOpened && !jump && L <= 3 && !GAME(call)) {
    return general(`Natural: a second suit, 4+ ${SYMBOL[s]} (the opening suit is longer)${competitive ? ', competing' : ''}.`, competitive ? 'competitive-bidding-tier-0' : 'openers-rebids-tier-0', { len: { [s]: [4, 13] } });
  }
  const len = L === 1 ? 4 : 5;
  // After their opening, double-then-suit shows a hand too strong to overcall. After ours, a double that showed values
  // (over their two-suiter) then a suit is natural and forcing; after a negative double the suit is a plain new suit.
  if (iDoubled && !mySuits.size && !weOpened) return general(`Natural: 5+ ${SYMBOL[s]} and a strong hand (doubled first, then bid a suit: 17+).`, 'takeout-doubles', { hcp: [17, 37], len: { [s]: [5, 13] } });
  if (iDoubled && !mySuits.size && ours.some((r) => r.seat === me && r.call === 'X' && /^Values/.test(r.meaning ?? ''))) {
    return general(`Natural: 5+ ${SYMBOL[s]}, 10+ (the double showed the values). Forcing.`, 'their-two-suiters', { hcp: [10, 37], len: { [s]: [5, 13] }, force: 'round' });
  }
  if (competitive && weOpened && !iActed && me !== opened.seat) {
    return L === 1
      ? general(`Free bid: 4+ ${SYMBOL[s]}, 6+ HCP, forcing.`, where, { hcp: [6, 37], len: { [s]: [4, 13] }, force: 'round' })
      : general(`Free bid: 5+ ${SYMBOL[s]}, ${L === 2 ? '10' : '12'}+ HCP, forcing one round.`, where, { hcp: [L === 2 ? 10 : 12, 37], len: { [s]: [5, 13] }, force: 'round' });
  }
  if (competitive && !weOpened && pardActed && !iActed) return general(`New suit: natural, 5+ ${SYMBOL[s]}, not forcing.`, where, { len: { [s]: [5, 13] } });
  return general(`Natural: ${len}+ ${SYMBOL[s]}${competitive && L >= 3 ? `, with values to bid at the ${L}-level` : ''}.`, competitive ? 'competitive-bidding-tier-0' : 'which-game', { len: { [s]: [len, 13] } });
}
