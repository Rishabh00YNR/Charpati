// Stress test for the game engine: node shared/engine.check.mjs
// Plays hundreds of random games (with missed turns and bots) and checks the rules after every step.
import { newGame, join, apply, tick, nextWake, viewFor, isPower, HAND, GEMS } from './engine.ts';

function rngFrom(seed) { // mulberry32: repeatable randomness
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const fail = msg => { throw new Error(msg); };
const stats = { games: 0, turns: 0, timeouts: 0, bots: 0, powers: 0, rejected: 0 };

function checkInvariants(g) {
  const inHands = g.seats.reduce((a, s) => a + s.cards.length, 0);
  const count = inHands + g.deck.length + g.discard.length + (g.drawn ? 1 : 0);
  if (g.phase !== 'lobby' && count !== 52) fail(`card count ${count}`);
  for (const s of g.seats) {
    if (g.phase !== 'lobby' && s.cards.length !== HAND) fail('hand size');
    if (s.cards.some(isPower)) fail('power card in a hand');
  }
  const tokens = g.seats.map(s => s.token);
  for (const viewer of [...g.seats.keys(), null]) {
    const v = viewFor(g, viewer);
    const json = JSON.stringify(v);
    if (tokens.some(t => json.includes(t))) fail('a seat token leaked into a view');
    v.seats.forEach((sv, i) => {
      const allowed = g.phase === 'end'
        || (g.phase === 'memorize' && viewer === i && !g.seats[i].ready)
        || (g.phase === 'play' && g.peek && viewer === g.cur && g.peek.target === i);
      if (!allowed && sv.cards.some(c => c !== null)) fail(`viewer ${viewer} saw seat ${i}'s cards in ${g.phase}`);
    });
    if (v.drawn && (viewer !== g.cur)) fail('drawn card shown to someone else');
  }
}

for (let n = 0; n < 300; n++) {
  const rng = rngFrom(1000 + n), g = newGame();
  let now = 1_000_000;
  const players = 3 + (n % 3);
  for (let i = 0; i < players; i++) { const r = join(g, `P${i}`, GEMS[(i + n) % 5], rng); if ('error' in r) fail(r.error); }
  if (apply(g, 1, { t: 'start' }, now, rng) === null) fail('a non-host could start');
  if (apply(g, 0, { t: 'start' }, now, rng) !== null) fail('host could not start');
  checkInvariants(g);
  // Memorise: everyone rearranges a little; one player never presses ready, so the timer finishes it.
  g.seats.forEach((s, i) => {
    if (apply(g, i, { t: 'arrange', a: 0, b: 3 }, now, rng)) fail('arrange failed');
    if (i !== players - 1) apply(g, i, { t: 'ready' }, now, rng);
  });
  if (g.phase !== 'memorize') fail('play started before everyone was ready');
  now = nextWake(g); tick(g, now, rng); checkInvariants(g);
  if (g.phase !== 'play') fail('memorise timer did not start the game');
  const lazy = n % players; // this seat stops playing, so it should time out 3 times and get a bot

  let guard = 0;
  while (g.phase === 'play' && guard++ < 2000) {
    const cur = g.cur, me = g.seats[cur];
    if (apply(g, (cur + 1) % players, { t: 'draw' }, now, rng) === null) fail('played out of turn');
    if (me.bot || cur === lazy) {
      now = nextWake(g);
      const before = me.bot;
      tick(g, now, rng);
      if (!before && me.bot) stats.bots++;
      if (!before) stats.timeouts++;
      checkInvariants(g);
      continue;
    }
    const act = m => { const err = apply(g, cur, m, now, rng); if (err) { stats.rejected++; fail(`${m.t} rejected: ${err}`); } checkInvariants(g); };
    act({ t: 'draw' });
    const other = (cur + 1 + Math.floor(rng() * (players - 1))) % players;
    switch (g.step) {
      case 'choose': act(rng() < 0.6 ? { t: 'place', i: Math.floor(rng() * HAND) } : { t: 'throw' }); break;
      case 'p7': stats.powers++; act({ t: 'swap7', mine: Math.floor(rng() * HAND), seat: other, i: Math.floor(rng() * HAND) }); break;
      case 'pQ': stats.powers++; act({ t: 'shuffleQ', seat: other }); break;
      case 'pK': stats.powers++; act({ t: 'look' }); act({ t: 'done' }); break;
      case 'pJ': stats.powers++; act({ t: 'peekJ', seat: other }); act({ t: 'done' }); break;
    }
    stats.turns++;
    now += 2000;
  }
  if (g.phase !== 'end') fail(`game ${n} never ended (phase ${g.phase})`);
  if (!g.seats[lazy].bot) fail('the player who stopped playing never got a bot');
  const v = viewFor(g, 0);
  if (!v.winners?.length || v.seats.some(s => s.total === null || s.cards.some(c => !c))) fail('end view incomplete');
  // Rematch keeps the room and seats.
  if (apply(g, 0, { t: 'rematch' }, now, rng) !== null || g.phase !== 'memorize' || g.round !== 2) fail('rematch failed');
  checkInvariants(g);
  stats.games++;
}
console.log('All checks passed.', stats);
