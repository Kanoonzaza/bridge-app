// The pool: every question a pair answers when they build their convention card. Data only.
// A slot is one question; each option is one answer with its own rules (tagged `opt: '<slot>:<option>'`).
// Options are listed SAYC default first. `ready: false` until the option's rules are written:
// the Card tab shows it as "coming soon". Text slots (`text: true`) are printed on the card and have no rules.
// See docs/superpowers/plans/2026-11-15-convention-pool.md, section 1.

export const GROUPS = [
  ['base', 'System'],
  ['majors', 'Major openings'],
  ['minors', 'Minor openings'],
  ['notrump', 'Notrump'],
  ['twos', 'Two-level openings'],
  ['rebids', 'Later rounds'],
  ['slam', 'Slam bidding'],
  ['competitive', 'Competitive bidding'],
  ['defence', 'Leads and signals'],
];

const o = (id, title, line, extra = {}) => ({ id, title, line, ready: true, ...extra });
const soon = (id, title, line, extra = {}) => o(id, title, line, { ...extra, ready: false });

export const SLOTS = [
  { id: 'base', group: 'base', title: 'Base system', options: [
    soon('sayc', 'Standard American (SAYC)', '2-over-1 = 10+, forcing one round · 1NT response 6–10, not forcing'),
    o('2/1', '2/1 Game Forcing', '2-over-1 = game forcing, 12+ · 1NT response forcing, 6–12', { notes: '21-game-forcing-tier-0' }),
  ] },

  { id: 'jump-shift', group: 'majors', title: 'Jump shift response', options: [
    o('strong', 'Strong', '17+, game forcing, slam interest'),
    o('weak', 'Weak', 'Unpassed hand: 6-card suit, 2–5 HCP', { notes: 'raising-partners-major-tier-0' }),
  ] },
  { id: 'splinters', group: 'majors', title: 'Splinter raises', options: [
    o('off', 'Off', 'Double jumps in a new suit are natural'),
    o('on', 'Splinters', '4+ trumps, singleton or void, 10–14, game forcing', { notes: 'raising-partners-major-tier-0' }),
  ] },
  { id: 'passed-2c', group: 'majors', title: 'Passed hand: 2♣ over partner\'s 1♥ / 1♠', options: [
    o('natural', 'Natural', '2♣ = clubs, 10–11, not forcing · passed limit raise = 3M with 3+ trumps'),
    o('drury', 'Drury', '2♣ = 3+ support, 10–11 (a limit raise) · opener\'s 2♦ = full opening', { notes: 'drury-tier-1' }),
  ] },
  { id: 'passed-jump', group: 'majors', title: 'Passed hand: jump shift', options: [
    o('none', 'No special meaning', 'Read as natural'),
    o('fit', 'Fit-showing', 'Good 5-card suit, 4+ support, 10–11', { notes: 'passed-hand-jump-shifts' }),
  ] },
  { id: 'major-raise', group: 'majors', title: 'Jump raise of 1♥ / 1♠', options: [
    o('limit', 'Limit raise', '3♥ / 3♠ = 10–12, invitational', { notes: 'raising-partners-major-tier-0' }),
    soon('bergen', 'Bergen raises', '3♣ = 7–9, 4 trumps · 3♦ = 10–12, 4 trumps · 3M = preemptive'),
  ] },

  { id: 'minor-raise', group: 'minors', title: 'Raises of 1♣ / 1♦', options: [
    o('standard', 'Standard', '2m = 6–10 · 3m = 10–12, invitational'),
    o('inverted', 'Inverted', '2m = 10+, forcing · 3m = weak, preemptive', { notes: 'inverted-minor-raises-tier-1' }),
  ] },
  { id: 'minor-2nt', group: 'minors', title: '2NT over 1♣ / 1♦', options: [
    o('forcing', '13–15, game forcing', '3NT = 16–18'),
    o('invite', '11–12, invitational', '3NT = 13–15', { notes: 'responding-to-1-1-tier-0' }),
  ] },

  { id: 'smolen', group: 'notrump', title: 'Smolen', options: [
    o('off', 'Off', '1NT–2♣–2♦–3♥ / 3♠ = 5 cards in the bid major, game forcing'),
    o('on', 'Smolen', '1NT–2♣–2♦–3♥ / 3♠ = 4 cards in the bid major, 5 in the other', { notes: 'smolen-tier-2' }),
  ] },
  { id: 'texas', group: 'notrump', title: 'Texas transfers', options: [
    o('off', 'Off', 'Game hands with a 6-card major transfer, then bid game · 4♥ / 4♠ = to play'),
    o('on', 'Texas', '4♦ / 4♥ = transfer to 4♥ / 4♠, sign-off', { notes: '1nt-opening-and-responses-tier-0' }),
  ] },
  { id: 'nt-2s', group: 'notrump', title: '2♠ over 1NT', options: [
    o('puppet', 'Puppet to 3♣', 'Weak with a long minor, or both minors with slam interest', { notes: '1nt-opening-and-responses-tier-0' }),
    soon('four-suit', 'Four-suit transfers', '2♠ = clubs · 2NT = diamonds'),
  ] },
  { id: 'nt-interference', group: 'notrump', title: 'They bid over our 1NT', options: [
    o('natural', 'Natural', '2-level suit = to play · 3-level suit = game forcing · 2NT = invitational · cue-bid = Stayman · double = penalty'),
    o('lebensohl', 'Lebensohl', '2NT = relay to 3♣ · direct 3-level = forcing · slow = stopper', { notes: 'lebensohl-tier-2' }),
  ] },

  { id: 'weak-two-ask', group: 'twos', title: '2NT over our weak two', options: [
    soon('feature', 'Feature ask', 'Rebid = minimum · new suit = maximum with an ace or king there'),
    o('ogust', 'Ogust', '3♣ = bad hand, bad suit … 3NT = AKQ', { notes: 'weak-twos-and-ogust-tier-0' }),
  ] },

  { id: 'checkback', group: 'rebids', title: 'Responder\'s ask after opener\'s 1NT rebid', options: [
    soon('none', 'Natural', 'New suits to play · 2NT invitational'),
    soon('nmf', 'New Minor Forcing', 'The unbid minor = artificial, 11+, forcing'),
    o('xyz', 'XYZ', '2♣ = relay to 2♦ · 2♦ = artificial game force', { notes: 'xyz-tier-1' }),
  ] },
  { id: 'fourth-suit', group: 'rebids', title: 'Fourth suit', options: [
    soon('round', 'Forcing one round', '11+'),
    o('gf', 'Game forcing', 'Artificial, forcing to game', { notes: 'fourth-suit-forcing-tier-1' }),
  ] },

  { id: 'keycard', group: 'slam', title: '4NT', options: [
    soon('blackwood', 'Blackwood', '5♣ = 0 or 4 aces · 5♦ = 1 · 5♥ = 2 · 5♠ = 3 · over interference DOPI'),
    o('rkcb-1430', 'RKCB 1430', '5♣ = 1 or 4 · 5♦ = 0 or 3 · 5♥ = 2 without the queen · 5♠ = 2 with', { notes: 'rkcb-1430-and-slam-tools-tier-1' }),
    soon('rkcb-0314', 'RKCB 0314', '5♣ = 0 or 3 · 5♦ = 1 or 4 · 5♥ / 5♠ as 1430'),
  ] },

  { id: 'nt-defence', group: 'competitive', title: 'Defence to their 1NT', options: [
    soon('natural', 'Natural', 'Double = penalty · 2-level suits natural · 2NT = minors'),
    o('dont', 'DONT', 'X = one suit · 2♣ / 2♦ = that suit and a higher one · 2♥ = majors · 2♠ = spades', { notes: 'dont-against-their-1nt-tier-1' }),
    soon('cappelletti', 'Cappelletti', '2♣ = one suit · 2♦ = majors · 2♥ / 2♠ = that major and a minor'),
    soon('landy', 'Landy', '2♣ = majors · other suits natural'),
  ] },
  { id: 'support-doubles', group: 'competitive', title: 'Support doubles and redoubles', options: [
    soon('off', 'Off', 'Raises show 4 trumps · double = extra values'),
    o('on', 'Support doubles', 'X / XX = exactly 3-card support for responder\'s major', { notes: 'support-doubles-and-redoubles-tier-2' }),
  ] },
  { id: 'responsive', group: 'competitive', title: 'Responsive doubles', options: [
    o('off', 'Off', 'Double of their raise = penalty'),
    o('on', 'Responsive doubles', 'Double of their raise = takeout, the unbid suits', { notes: 'responsive-doubles' }),
  ] },
  { id: 'weak-two-defence', group: 'competitive', title: '4♣ / 4♦ over their weak two', options: [
    o('natural', 'Natural', 'A jump to 4♣ / 4♦ = a long, strong minor'),
    o('leaping', 'Leaping Michaels', 'That minor and the other major, 5-5, game values', { notes: 'leaping-michaels' }),
  ] },
  { id: 'slam-doubles', group: 'competitive', title: 'Doubles of their slams and artificial bids', options: [
    o('penalty', 'Penalty', 'Plain penalty doubles'),
    o('lead', 'Lead-directing and Lightner', 'Double of an artificial bid = lead this suit · double of a slam = unusual lead', { notes: 'lead-directing-doubles' }),
  ] },

  { id: 'leads', group: 'defence', title: 'Opening leads', text: true, options: [
    o('standard', 'Standard', 'A from A-K · top of sequences · 4th best from length · top of a doubleton'),
    o('ka', 'K from A-K', 'K from A-K · otherwise standard'),
    o('third-fifth', '3rd and 5th', '3rd from even, 5th from odd · top of sequences'),
  ] },
  { id: 'signals', group: 'defence', title: 'Signals', text: true, options: [
    o('standard', 'Standard', 'High = encourage · high-low = even count'),
    o('upside', 'Upside-down', 'Low = encourage · low-high = even count'),
  ] },
  { id: 'discards', group: 'defence', title: 'First discard', text: true, options: [
    o('standard', 'Standard', 'High = encourage'),
    o('upside', 'Upside-down', 'Low = encourage'),
    o('lavinthal', 'Lavinthal', 'Suit preference between the other two suits'),
    o('odd-even', 'Odd-even', 'Odd = encourage · even = suit preference'),
  ] },
];

export const slot = (id) => SLOTS.find((s) => s.id === id) ?? null;
export const option = (slotId, optId) => slot(slotId)?.options.find((x) => x.id === optId) ?? null;
// 'passed-2c:drury' -> ['passed-2c', 'drury']
export const splitOpt = (opt) => {
  const i = opt.indexOf(':');
  return [opt.slice(0, i), opt.slice(i + 1)];
};
export const isOpt = (opt) => typeof opt === 'string' && opt.includes(':') && Boolean(option(...splitOpt(opt)));
