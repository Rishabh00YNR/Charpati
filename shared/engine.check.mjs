// Stress test for the game engine: node shared/engine.check.mjs
// Plays hundreds of random games (with missed turns and bots) and checks the rules after every step.
import { newGame, join, apply, tick, nextWake, viewFor, setConnected, isPower, HAND, GEMS, IDLE_END_MS, ROOM_IDLE_CLOSE_MS } from './engine.ts';

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
  for (let i = 0; i < players; i++) { const r = join(g, `P${i}`, GEMS[(i + n) % 5], rng, now); if ('error' in r) fail(r.error); }
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
// ---- Nobody playing: pause, resume, end -------------------------------------------------
function started(players, seed) {
  const rng = rngFrom(seed), g = newGame();
  let now = 5_000_000;
  for (let i = 0; i < players; i++) join(g, `Q${i}`, undefined, rng, now);
  apply(g, 0, { t: 'start' }, now, rng);
  g.seats.forEach((_, i) => apply(g, i, { t: 'ready' }, now, rng));
  if (g.phase !== 'play') fail('scenario did not start');
  return { g, rng, now };
}
{
  // Everyone's phone goes away mid-game: the game pauses, nothing moves, and it ends after the grace period.
  let { g, rng, now } = started(4, 7);
  const deckBefore = g.deck.length;
  g.seats.forEach((_, i) => setConnected(g, i, false, now));
  if (g.idleSince === null || viewFor(g, null).pausedUntil === null) fail('game did not pause when everyone left');
  if (tick(g, now + IDLE_END_MS - 1000, rng) || g.deck.length !== deckBefore) fail('the game moved while paused');
  // Someone comes back in time: play carries on with fresh time on the clock.
  setConnected(g, 2, true, now + 60_000);
  if (g.idleSince !== null || g.deadline !== now + 60_000 + g.timerSec * 1000) fail('game did not resume with fresh time');
  // They leave again and nobody returns: the game ends with no winner.
  now += 90_000;
  setConnected(g, 2, false, now);
  if (nextWake(g) !== now + IDLE_END_MS) fail('no alarm for ending the paused game');
  tick(g, now + IDLE_END_MS, rng);
  if (g.phase !== 'end' || g.endReason !== 'abandoned' || viewFor(g, 0).winners !== null) fail('abandoned game did not end without a winner');
  checkInvariants(g);
  stats.abandoned = (stats.abandoned || 0) + 1;
}
{
  // Everyone keeps the tab open but stops playing: each seat gets a bot, then the game ends instead of bots playing it out.
  let { g, rng, now } = started(3, 11);
  let guard = 0;
  while (g.phase === 'play' && guard++ < 500) { now = nextWake(g); tick(g, now, rng); checkInvariants(g); }
  if (g.phase !== 'end' || g.endReason !== 'abandoned') fail(`idle tabs: game should end as abandoned, got ${g.phase}/${g.endReason}`);
  if (g.deck.length === 0) fail('bots played the whole game on an idle table');
  stats.idleTabs = guard;
}
{
  // A lobby with tabs left open closes after 30 minutes with no activity; activity resets the clock.
  const rng = rngFrom(3), g = newGame();
  let now = 9_000_000;
  for (let i = 0; i < 3; i++) join(g, `L${i}`, undefined, rng, now);
  if (nextWake(g) !== now + ROOM_IDLE_CLOSE_MS) fail('no close alarm for an idle lobby');
  apply(g, 0, { t: 'timer', sec: 45 }, now + 20 * 60_000, rng); // activity 20 min in
  if (tick(g, now + ROOM_IDLE_CLOSE_MS, rng)) fail('lobby closed although someone was active');
  tick(g, now + 20 * 60_000 + ROOM_IDLE_CLOSE_MS, rng);
  if (g.phase !== 'closed') fail('idle lobby did not close');
  if (apply(g, 0, { t: 'start' }, now, rng) === null) fail('a closed room accepted a move');
  if (!('error' in join(g, 'Late', undefined, rng, now))) fail('a closed room accepted a new player');
  if (nextWake(g) !== null) fail('a closed room still has an alarm');
}
{
  // The results screen closes the same way.
  let { g, rng, now } = started(3, 5);
  g.deck.length = 0; // last card gone: the next turn ends the game
  apply(g, g.cur, { t: 'draw' }, now, rng); // nothing to draw
  g.deck.push({ r: '2', s: '♠' });
  apply(g, g.cur, { t: 'draw' }, now, rng);
  if (g.step === 'choose') apply(g, g.cur, { t: 'throw' }, now, rng);
  if (g.phase !== 'end') fail('game did not end on an empty deck');
  tick(g, now + ROOM_IDLE_CLOSE_MS, rng);
  if (g.phase !== 'closed') fail('idle results screen did not close');
}
// ---- Host controls ------------------------------------------------------------------------
{
  // Lobby: the host frees a seat; nobody else can remove players; the host can't remove themself.
  const rng = rngFrom(21), g = newGame(), now = 12_000_000;
  for (let i = 0; i < 4; i++) join(g, `H${i}`, undefined, rng, now);
  if (apply(g, 1, { t: 'kick', seat: 2 }, now, rng) === null) fail('a non-host removed a player');
  if (apply(g, 0, { t: 'kick', seat: 0 }, now, rng) === null) fail('the host removed themself');
  if (apply(g, 0, { t: 'kick', seat: 3 }, now, rng) !== null || g.seats.length !== 3) fail('lobby kick failed');
}
{
  // Mid-game: the removed player's cards stay, a bot plays them, their seat pass stops working.
  let { g, rng, now } = started(4, 31);
  const victim = (g.cur + 1) % 4, oldToken = g.seats[victim].token;
  const hostSeat = g.seats.findIndex(s => s.connected);
  if (apply(g, hostSeat, { t: 'kick', seat: victim }, now, rng) !== null) fail('mid-game kick failed');
  const v = g.seats[victim];
  if (!v.kicked || !v.bot || v.token === oldToken || v.cards.length !== HAND) fail('kicked seat not handed to a bot');
  if (apply(g, victim, { t: 'takeBack' }, now, rng) === null) fail('a removed player took their seat back');
  if (!viewFor(g, 0).seats[victim].kicked) fail('view does not show the removed player');
  checkInvariants(g);
  // The host changes the timer mid-game; it applies from the next turn.
  if (apply(g, hostSeat, { t: 'timer', sec: 60 }, now, rng) !== null || g.timerSec !== 60) fail('mid-game timer change failed');
  // The host ends the game now: cards shown, lowest total wins.
  if (g.step === 'draw') apply(g, g.cur, { t: 'draw' }, now, rng); // a drawn card must not vanish
  if (apply(g, (hostSeat + 1) % 4, { t: 'endGame' }, now, rng) === null) fail('a non-host ended the game');
  if (apply(g, hostSeat, { t: 'endGame' }, now, rng) !== null || g.phase !== 'end' || g.endReason !== 'host') fail('host could not end the game');
  const ev = viewFor(g, 1);
  if (!ev.winners?.length || ev.seats.some(s => s.cards.some(c => !c))) fail('host-ended game did not reveal and score');
  checkInvariants(g);
  // New game: the removed player is gone; 3 remain, so a new deal starts.
  if (apply(g, hostSeat, { t: 'rematch' }, now, rng) !== null || g.seats.length !== 3 || g.phase !== 'memorize') fail('new game did not drop the removed player');
  checkInvariants(g);
}
{
  // If removing players leaves fewer than 3, a new game goes back to the lobby to invite more.
  let { g, rng, now } = started(3, 41);
  apply(g, 0, { t: 'kick', seat: 2 }, now, rng);
  apply(g, 0, { t: 'endGame' }, now, rng);
  if (apply(g, 0, { t: 'rematch' }, now, rng) !== null || g.phase !== 'lobby' || g.seats.length !== 2) fail('short table did not return to the lobby');
  checkInvariants(g);
}
console.log('All checks passed.', stats);
