// Charpati rules, run by the room server. Plain functions over plain data (no network, no clock of
// its own), so the same code runs on Cloudflare and in tests. Phones never receive a Game: only
// viewFor(game, seat), which leaves out every card that player isn't allowed to see.

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type Card = { r: Rank; s: Suit };
export type Gem = 'topaz' | 'ruby' | 'sapphire' | 'emerald' | 'amethyst';
export type PowerRank = '7' | 'K' | 'Q' | 'J';

export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
export const GEMS: Gem[] = ['topaz', 'ruby', 'sapphire', 'emerald', 'amethyst'];
export const HAND = 4;
export const MIN_SEATS = 3;
export const MAX_SEATS = 5;
export const TIMER = { min: 15, max: 120, step: 5, default: 30 }; // seconds per turn; the host can change it
export const MEMO_SEC = 45; // time everyone gets to memorise their cards
export const MISSES_FOR_BOT = 3; // missed turns in a row before a bot takes the seat
// Bots take their time so everyone can follow: 3 to 5 seconds after their turn starts (so the last
// move has finished moving on everyone's screen) before they draw, then a moment to think.
export const BOT_WAIT_MS = { min: 3000, max: 5000 };
export const BOT_DECIDE_MS = 2200;
const botWait = (g: Game) => BOT_WAIT_MS.min + ((g.deck.length * 7 + g.cur * 3) % 5) * ((BOT_WAIT_MS.max - BOT_WAIT_MS.min) / 4);
// When nobody is really playing (every seat is disconnected or run by a bot) the game pauses, and ends
// after this long unless someone comes back. Short enough to stop bots playing an empty table,
// long enough that a phone locking for a moment doesn't end the game.
export const IDLE_END_MS = 2 * 60 * 1000;
// A lobby or results screen that nobody touches for this long closes, even with tabs left open.
export const ROOM_IDLE_CLOSE_MS = 30 * 60 * 1000;

export const POWERS: Record<PowerRank, { name: string; text: string }> = {
  '7': { name: 'Swap', text: "Swap one of your cards with one of another player's cards. Nobody looks." },
  K: { name: 'Look', text: 'Look at all your own cards. You can’t move them.' },
  Q: { name: 'Shuffle', text: 'Mix up another player’s cards.' },
  J: { name: 'Peek', text: 'Look at all of one other player’s cards.' },
};
export const isPower = (c: Card): c is Card & { r: PowerRank } => c.r in POWERS;
// Power cards never reach a hand (they're kept out of the deal and thrown away after use), so only A-10 count.
export const points = (c: Card) => (c.r === 'A' ? 1 : Number(c.r));
export const total = (cards: Card[]) => cards.reduce((a, c) => a + points(c), 0);
export const label = (c: Card) => c.r + c.s;

export type Seat = {
  id: string; // public
  token: string; // secret: only this player's phone knows it; used to rejoin the same seat
  name: string;
  gem: Gem;
  cards: Card[];
  connected: boolean;
  ready: boolean; // finished memorising
  misses: number; // turns in a row that ran out of time
  bot: boolean;
  kicked?: boolean; // removed by the host mid-game: a bot plays out their cards; dropped before the next game
  robot?: boolean; // a bot the host added to fill a seat (never a person); stays for rematches
};
// Names for bots the host adds. Up to 12 characters, like player names.
export const BOT_NAMES = ['Alex', 'Sam', 'Max', 'Leo', 'Mia', 'Zoe'];
export type Step = 'draw' | 'choose' | 'p7' | 'pK' | 'pQ' | 'pJ';
export type LogEntry = { t: string; seat: number | null };
// What just happened, so phones can animate it. Cleared after every broadcast.
export type Fx =
  | { k: 'deal' }
  | { k: 'draw'; seat: number }
  | { k: 'power'; seat: number; r: PowerRank }
  | { k: 'place'; seat: number; i: number }
  | { k: 'throw'; seat: number }
  | { k: 'swap'; a: [number, number]; b: [number, number] }
  | { k: 'shuffle'; seat: number }
  | { k: 'end' };

export type Game = {
  phase: 'lobby' | 'memorize' | 'play' | 'end' | 'closed';
  seats: Seat[];
  deck: Card[];
  discard: Card[];
  starter: number;
  cur: number;
  step: Step;
  drawn: Card | null;
  peek: { target: number } | null; // a K or J look in progress: whose cards the current player is looking at
  timerSec: number;
  deadline: number | null; // ms timestamp when the current turn (or memorising) runs out
  botAt: number | null; // when the bot playing the current seat acts next
  idleSince: number | null; // set while nobody is really playing: the game is paused
  endReason: 'deck' | 'abandoned' | 'host' | null; // why the last game ended
  lastActivity: number; // when someone last did something (for closing forgotten lobbies and results screens)
  round: number;
  log: LogEntry[];
  fx: Fx[];
};

export type Move =
  | { t: 'join'; name: string; gem?: Gem }
  | { t: 'leave' }
  | { t: 'gem'; gem: Gem }
  | { t: 'timer'; sec: number }
  | { t: 'start'; fill?: boolean } // fill: seat bots until there are enough players, then start
  | { t: 'arrange'; a: number; b: number }
  | { t: 'ready' }
  | { t: 'draw' }
  | { t: 'place'; i: number }
  | { t: 'throw' }
  | { t: 'swap7'; mine: number; seat: number; i: number }
  | { t: 'shuffleQ'; seat: number }
  | { t: 'look' }
  | { t: 'peekJ'; seat: number }
  | { t: 'done' }
  | { t: 'takeBack' }
  | { t: 'rematch' }
  // Host only
  | { t: 'kick'; seat: number; id?: string } // id guards against removing the wrong person if seats just shifted
  | { t: 'addBot' }
  | { t: 'renameBot'; seat: number; id: string; name: string }
  | { t: 'endGame' };

export type Rng = () => number; // [0, 1)

function shuffleInPlace<T>(a: T[], rng: Rng): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const randomId = (rng: Rng, n = 24) => Array.from({ length: n }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(rng() * 32)]).join('');

export function newGame(): Game {
  return {
    phase: 'lobby', seats: [], deck: [], discard: [], starter: 0, cur: 0, step: 'draw', drawn: null, peek: null,
    timerSec: TIMER.default, deadline: null, botAt: null, idleSince: null, endReason: null, lastActivity: 0, round: 0, log: [], fx: [],
  };
}

const waiting = (g: Game) => (g.phase === 'lobby' || g.phase === 'end') && g.seats.length > 0;

function closeRoom(g: Game) {
  g.phase = 'closed';
  g.deadline = null;
  g.botAt = null;
  g.idleSince = null;
  log(g, 'Nobody played for 30 minutes, so this room closed.');
}

// ---- Pausing when nobody is playing ---------------------------------------------------------
const inGame = (g: Game) => g.phase === 'memorize' || g.phase === 'play';
const nobodyPlaying = (g: Game) => g.seats.every(s => s.bot || !s.connected);

// Call after anything that changes who is connected or who is a bot.
function updateIdle(g: Game, now: number) {
  if (!inGame(g)) { g.idleSince = null; return; }
  if (nobodyPlaying(g)) {
    if (g.idleSince === null) {
      g.idleSince = now;
      log(g, 'Nobody is playing right now, so the game is paused.');
    }
  } else if (g.idleSince !== null) {
    // Someone is back: carry on with fresh time on the clock.
    g.idleSince = null;
    log(g, 'Someone is back. The game carries on.');
    if (g.phase === 'play') {
      g.deadline = now + g.timerSec * 1000;
      g.botAt = g.seats[g.cur].bot ? now + botWait(g) : null;
    } else {
      g.deadline = now + MEMO_SEC * 1000;
    }
  }
}

// The room server tells the engine when a phone connects or goes away.
export function setConnected(g: Game, seat: number, connected: boolean, now: number) {
  const s = g.seats[seat];
  if (!s || s.connected === connected) return;
  s.connected = connected;
  updateIdle(g, now);
}

function endAbandoned(g: Game, now: number) {
  g.phase = 'end';
  g.endReason = 'abandoned';
  g.lastActivity = now;
  g.deadline = null;
  g.botAt = null;
  g.idleSince = null;
  g.drawn = null;
  g.peek = null;
  g.fx.push({ k: 'end' });
  log(g, 'Everyone left or stopped playing, so the game ended.');
}

// The host is the first player still connected; they start the game, set the timer and call rematches.
export const hostIndex = (g: Game) => g.seats.findIndex(s => s.connected);

function log(g: Game, t: string, seat: number | null = null) {
  g.log.push({ t, seat });
  if (g.log.length > 60) g.log.shift();
}

export function join(g: Game, rawName: string, gem: Gem | undefined, rng: Rng, now: number): { seat: number; token: string } | { error: string } {
  if (g.phase === 'closed') return { error: 'This room has closed. Create a new room.' };
  if (g.phase !== 'lobby') return { error: 'This game has already started.' };
  g.lastActivity = now;
  if (g.seats.length >= MAX_SEATS) return { error: 'This table is full (5 players).' };
  const name = cleanName(g, rawName, `Player ${g.seats.length + 1}`);
  const used = new Set(g.seats.map(s => s.gem));
  const pick = gem && !used.has(gem) ? gem : GEMS.find(x => !used.has(x))!;
  const seat: Seat = { id: randomId(rng, 8), token: randomId(rng), name, gem: pick, cards: [], connected: true, ready: false, misses: 0, bot: false };
  g.seats.push(seat);
  log(g, `${name} sat down.`, g.seats.length - 1);
  return { seat: g.seats.length - 1, token: seat.token };
}

// Up to 12 characters, and never the same as someone else at the table ("Sam" becomes "Sam 2").
function cleanName(g: Game, raw: unknown, fallback: string, except = -1) {
  let name = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 12) || fallback;
  const taken = new Set(g.seats.filter((_, i) => i !== except).map(s => s.name.toLowerCase()));
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${name.replace(/ \d+$/, '')} ${n}`;
  return name;
}

// A bot the host adds to fill a seat. Nobody holds its seat pass, so no phone can ever play as it.
function seatBot(g: Game, rng: Rng) {
  const names = new Set(g.seats.map(s => s.name.toLowerCase()));
  const used = new Set(g.seats.map(s => s.gem));
  const name = BOT_NAMES.find(x => !names.has(x.toLowerCase())) ?? cleanName(g, 'Bot', 'Bot');
  g.seats.push({ id: randomId(rng, 8), token: randomId(rng), name, gem: GEMS.find(x => !used.has(x))!, cards: [], connected: false, ready: true, misses: 0, bot: true, robot: true });
  log(g, `${name} joined the table.`, g.seats.length - 1);
}

function deal(g: Game, now: number, rng: Rng) {
  // Nobody is dealt a power card: all 16 of them go into the draw pile.
  const all: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) all.push({ r, s });
  shuffleInPlace(all, rng);
  const plain = all.filter(c => !isPower(c));
  for (const seat of g.seats) {
    seat.cards = plain.splice(0, HAND);
    seat.ready = seat.bot; // bots don't need time to memorise
    seat.misses = 0;
  }
  g.deck = shuffleInPlace(plain.concat(all.filter(isPower)), rng);
  g.discard = [];
  g.phase = 'memorize';
  g.round++;
  g.drawn = null;
  g.peek = null;
  g.botAt = null;
  g.idleSince = null;
  g.endReason = null;
  g.deadline = now + MEMO_SEC * 1000;
  g.fx.push({ k: 'deal' });
  log(g, `Round ${g.round}: everyone has four cards. Remember them.`);
  maybeStartPlay(g, now);
}

function maybeStartPlay(g: Game, now: number) {
  if (g.phase !== 'memorize' || !g.seats.every(s => s.ready)) return;
  g.phase = 'play';
  g.cur = g.starter;
  log(g, `${g.seats[g.cur].name} goes first.`, g.cur);
  startTurn(g, now);
}

function startTurn(g: Game, now: number) {
  g.step = 'draw';
  g.drawn = null;
  g.peek = null;
  g.deadline = now + g.timerSec * 1000;
  g.botAt = g.seats[g.cur].bot ? now + botWait(g) : null;
}

function endTurn(g: Game, now: number) {
  g.drawn = null;
  g.peek = null;
  if (!g.deck.length) {
    g.phase = 'end';
    g.endReason = 'deck';
    g.lastActivity = now;
    g.deadline = null;
    g.botAt = null;
    g.fx.push({ k: 'end' });
    const best = Math.min(...g.seats.map(s => total(s.cards)));
    const won = g.seats.filter(s => total(s.cards) === best).map(s => s.name);
    log(g, `The draw pile is empty. ${won.join(' and ')} ${won.length > 1 ? 'tie' : 'wins'} with ${best}.`);
    return;
  }
  g.cur = (g.cur + 1) % g.seats.length;
  startTurn(g, now);
}

// ---- The moves a player can send ------------------------------------------------------------
// Returns an error message for the player, or null when the move was applied.
export function apply(g: Game, seat: number, m: Move, now: number, rng: Rng): string | null {
  if (g.phase === 'closed') return 'This room has closed. Create a new room.';
  const err = applyMove(g, seat, m, now, rng);
  if (err === null) {
    g.lastActivity = now;
    updateIdle(g, now);
  }
  return err;
}

function applyMove(g: Game, seat: number, m: Move, now: number, rng: Rng): string | null {
  const me = g.seats[seat];
  if (!me) return 'You are not seated at this table.';
  const host = seat === hostIndex(g);

  switch (m.t) {
    case 'leave':
      if (g.phase !== 'lobby') return 'You can only leave before the game starts.';
      log(g, `${me.name} left the table.`);
      g.seats.splice(seat, 1);
      return null;
    case 'gem':
      if (g.phase !== 'lobby') return 'Colours are chosen before the game.';
      if (!GEMS.includes(m.gem)) return 'Unknown colour.';
      if (g.seats.some((s, i) => i !== seat && s.gem === m.gem)) return 'Someone already has that colour.';
      me.gem = m.gem;
      return null;
    case 'timer':
      // Any time; a change applies from the next turn.
      if (!host) return 'Only the host can change the timer.';
      g.timerSec = Math.min(TIMER.max, Math.max(TIMER.min, Math.round(Number(m.sec) / TIMER.step) * TIMER.step || TIMER.default));
      return null;
    case 'kick': {
      if (!host) return 'Only the host can remove players.';
      const t = m.seat;
      if (!Number.isInteger(t) || t < 0 || t >= g.seats.length) return 'Pick a player.';
      if (t === seat) return 'You can’t remove yourself. Leave the table instead.';
      const them = g.seats[t];
      if (m.id && them.id !== m.id) return 'The table just changed. Try again.';
      if (g.phase === 'lobby') {
        g.seats.splice(t, 1);
        log(g, `${them.name} was removed by the host.`);
        return null;
      }
      if (them.kicked) return null;
      // Mid-game their cards stay on the table: a bot plays them out, and their seat pass stops working.
      them.kicked = true;
      them.bot = true;
      them.ready = true;
      them.connected = false;
      them.token = randomId(rng);
      log(g, `${them.name} was removed by the host. A bot plays their cards for the rest of this game.`);
      if (g.phase === 'play' && g.cur === t) g.botAt = now + botWait(g);
      maybeStartPlay(g, now);
      return null;
    }
    case 'addBot':
      if (!host) return 'Only the host can add bots.';
      if (g.phase !== 'lobby') return 'Bots can only join before the game starts.';
      if (g.seats.length >= MAX_SEATS) return 'This table is full (5 players).';
      seatBot(g, rng);
      return null;
    case 'renameBot': {
      if (!host) return 'Only the host can rename bots.';
      const bot = g.seats[m.seat];
      if (!bot || bot.id !== m.id) return 'The table just changed. Try again.';
      if (!bot.robot) return 'You can only rename bots.';
      bot.name = cleanName(g, m.name, bot.name, m.seat);
      return null;
    }
    case 'endGame':
      if (!host) return 'Only the host can end the game.';
      if (g.phase !== 'memorize' && g.phase !== 'play') return 'There’s no game running.';
      if (g.drawn) g.discard.push(g.drawn);
      g.phase = 'end';
      g.endReason = 'host';
      g.lastActivity = now;
      g.drawn = null;
      g.peek = null;
      g.deadline = null;
      g.botAt = null;
      g.fx.push({ k: 'end' });
      {
        const best = Math.min(...g.seats.map(s => total(s.cards)));
        const won = g.seats.filter(s => total(s.cards) === best).map(s => s.name);
        log(g, `${me.name} ended the game. ${won.join(' and ')} ${won.length > 1 ? 'tie' : 'wins'} with ${best}.`, seat);
      }
      return null;
    case 'start':
      if (!host) return 'Only the host can start the game.';
      if (g.phase !== 'lobby') return 'The game has already started.';
      if (m.fill) while (g.seats.length < MIN_SEATS) seatBot(g, rng);
      if (g.seats.length < MIN_SEATS) return `You need at least ${MIN_SEATS} players.`;
      g.starter = 0;
      deal(g, now, rng);
      return null;
    case 'rematch':
      if (!host) return 'Only the host can start a new game.';
      if (g.phase !== 'end') return 'Finish this game first.';
      // Players the host removed don't come back for the next game.
      g.seats = g.seats.filter(s => !s.kicked);
      if (g.seats.length < MIN_SEATS) {
        g.phase = 'lobby';
        g.endReason = null;
        g.deck = [];
        g.discard = [];
        for (const s of g.seats) { s.cards = []; s.ready = !!s.robot; s.bot = !!s.robot; s.misses = 0; }
        log(g, `Not enough players for a new game. Invite more friends, then start.`);
        return null;
      }
      g.starter = (g.starter + 1) % g.seats.length;
      deal(g, now, rng);
      return null;
    case 'takeBack':
      if (me.kicked) return 'The host removed you from this game.';
      if (!me.bot) return null;
      me.bot = false;
      me.misses = 0;
      log(g, `${me.name} is back and playing again.`, seat);
      if (g.phase === 'play' && g.cur === seat) { g.botAt = null; g.deadline = now + g.timerSec * 1000; }
      return null;
    case 'arrange': {
      if (g.phase !== 'memorize' || me.ready) return 'You can only rearrange while memorising.';
      const { a, b } = m;
      if (![a, b].every(x => Number.isInteger(x) && x >= 0 && x < HAND)) return 'Pick two of your cards.';
      [me.cards[a], me.cards[b]] = [me.cards[b], me.cards[a]];
      return null;
    }
    case 'ready':
      if (g.phase !== 'memorize') return null;
      me.ready = true;
      maybeStartPlay(g, now);
      return null;
  }

  // Everything below is a turn move.
  if (g.phase !== 'play') return 'The game isn’t being played right now.';
  if (g.cur !== seat) return 'It isn’t your turn.';
  if (me.bot) return 'A bot is playing your seat. Take it back first.';
  return turnMove(g, m, now, rng);
}

function otherSeat(g: Game, s: unknown) {
  return Number.isInteger(s) && (s as number) >= 0 && (s as number) < g.seats.length && s !== g.cur;
}

function turnMove(g: Game, m: Move, now: number, rng: Rng): string | null {
  const me = g.seats[g.cur], cur = g.cur;
  switch (m.t) {
    case 'draw': {
      if (g.step !== 'draw') return 'You already drew a card.';
      const c = g.deck.pop();
      if (!c) return 'The draw pile is empty.';
      g.drawn = c;
      me.misses = 0;
      if (isPower(c)) {
        g.step = ('p' + c.r) as Step;
        g.fx.push({ k: 'power', seat: cur, r: c.r });
        log(g, `${me.name} drew a ${c.r}: ${POWERS[c.r].name}!`, cur);
      } else {
        g.step = 'choose';
        g.fx.push({ k: 'draw', seat: cur });
      }
      return null;
    }
    case 'place': {
      if (g.step !== 'choose' || !g.drawn) return 'Draw a card first.';
      if (!Number.isInteger(m.i) || m.i < 0 || m.i >= HAND) return 'Pick one of your cards.';
      const old = me.cards[m.i];
      me.cards[m.i] = g.drawn;
      g.discard.push(old);
      g.fx.push({ k: 'place', seat: cur, i: m.i });
      log(g, `${me.name} swapped the drawn card into card ${m.i + 1} and threw away ${label(old)}.`, cur);
      endTurn(g, now);
      return null;
    }
    case 'throw':
      if (g.step !== 'choose' || !g.drawn) return 'Draw a card first.';
      g.discard.push(g.drawn);
      g.fx.push({ k: 'throw', seat: cur });
      log(g, `${me.name} threw away ${label(g.drawn)}.`, cur);
      endTurn(g, now);
      return null;
    case 'swap7': {
      if (g.step !== 'p7') return 'That needs a 7.';
      if (!Number.isInteger(m.mine) || m.mine < 0 || m.mine >= HAND || !otherSeat(g, m.seat) || !Number.isInteger(m.i) || m.i < 0 || m.i >= HAND) return 'Pick one of your cards and one of another player’s.';
      const them = g.seats[m.seat];
      [me.cards[m.mine], them.cards[m.i]] = [them.cards[m.i], me.cards[m.mine]];
      g.discard.push(g.drawn!);
      g.fx.push({ k: 'swap', a: [cur, m.mine], b: [m.seat, m.i] }, { k: 'throw', seat: cur }); // then the 7 goes on the pile
      log(g, `${me.name} played a 7 and swapped their card ${m.mine + 1} with ${them.name}'s card ${m.i + 1}. Nobody looked.`, cur);
      endTurn(g, now);
      return null;
    }
    case 'shuffleQ': {
      if (g.step !== 'pQ') return 'That needs a Queen.';
      if (!otherSeat(g, m.seat)) return 'Pick another player.';
      const them = g.seats[m.seat];
      shuffleInPlace(them.cards, rng);
      g.discard.push(g.drawn!);
      g.fx.push({ k: 'shuffle', seat: m.seat }, { k: 'throw', seat: cur }); // then the Q goes on the pile
      log(g, `${me.name} played a Q and shuffled ${them.name}'s cards.`, cur);
      endTurn(g, now);
      return null;
    }
    case 'look':
      if (g.step !== 'pK') return 'That needs a King.';
      g.peek = { target: cur };
      return null;
    case 'peekJ':
      if (g.step !== 'pJ') return 'That needs a Jack.';
      if (g.peek) return 'You are already looking.';
      if (!otherSeat(g, m.seat)) return 'Pick another player.';
      g.peek = { target: m.seat };
      return null;
    case 'done': {
      if ((g.step !== 'pK' && g.step !== 'pJ') || !g.peek) return 'Nothing to finish.';
      const who = g.peek.target;
      g.discard.push(g.drawn!);
      g.fx.push({ k: 'throw', seat: cur });
      log(g, g.step === 'pK' ? `${me.name} played a K and looked at their own cards.` : `${me.name} played a J and looked at ${g.seats[who].name}'s cards.`, cur);
      endTurn(g, now);
      return null;
    }
  }
  return 'Unknown move.';
}

// ---- Time: turn timers and bots ------------------------------------------------------------
// Call whenever the clock passes nextWake(g). Returns true if anything changed.
export function tick(g: Game, now: number, rng: Rng): boolean {
  // Paused because nobody is playing: nothing moves, and the game ends if nobody comes back.
  if (inGame(g) && g.idleSince !== null) {
    if (now < g.idleSince + IDLE_END_MS) return false;
    endAbandoned(g, now);
    return true;
  }
  // A lobby or results screen that nobody has touched for 30 minutes closes.
  if (waiting(g)) {
    if (now < g.lastActivity + ROOM_IDLE_CLOSE_MS) return false;
    closeRoom(g);
    return true;
  }
  if (g.phase === 'memorize' && g.deadline !== null && now >= g.deadline) {
    for (const s of g.seats) s.ready = true;
    log(g, 'Time is up for memorising.');
    maybeStartPlay(g, now);
    return true;
  }
  if (g.phase !== 'play') return false;
  const me = g.seats[g.cur];
  if (me.bot) {
    if (g.botAt === null || now < g.botAt) return false;
    botAct(g, now, rng);
    if (g.phase === 'play' && g.seats[g.cur] === me && me.bot) g.botAt = now + BOT_DECIDE_MS; // same turn: a moment to think
    return true;
  }
  if (g.deadline === null || now < g.deadline) return false;
  // Out of time: the turn is skipped (a drawn card is thrown away), so the game never gets stuck.
  me.misses++;
  if (g.drawn) {
    g.discard.push(g.drawn);
    g.fx.push({ k: 'throw', seat: g.cur });
    log(g, `${me.name} ran out of time and threw away ${label(g.drawn)}.`, g.cur);
  } else {
    log(g, `${me.name} ran out of time.`, g.cur);
  }
  if (me.misses >= MISSES_FOR_BOT) {
    me.bot = true;
    log(g, `${me.name} missed ${MISSES_FOR_BOT} turns in a row, so a bot is playing for them.`, g.cur);
  }
  endTurn(g, now);
  updateIdle(g, now); // that may have been the last person still playing
  return true;
}

export function nextWake(g: Game): number | null {
  if (inGame(g) && g.idleSince !== null) return g.idleSince + IDLE_END_MS;
  if (waiting(g)) return g.lastActivity + ROOM_IDLE_CLOSE_MS;
  const times = [g.deadline, g.botAt].filter((x): x is number => x !== null);
  return times.length ? Math.min(...times) : null;
}

// A simple, fair bot: it remembers its own cards (as a careful player would) and plays sensibly.
function botAct(g: Game, now: number, rng: Rng) {
  const me = g.seats[g.cur];
  const others = g.seats.map((_, i) => i).filter(i => i !== g.cur);
  const pickOther = () => others[Math.floor(rng() * others.length)];
  const highest = () => me.cards.reduce((best, c, i) => (points(c) > points(me.cards[best]) ? i : best), 0);
  switch (g.step) {
    case 'draw':
      turnMove(g, { t: 'draw' }, now, rng);
      return;
    case 'choose': {
      const hi = highest();
      turnMove(g, points(g.drawn!) < points(me.cards[hi]) ? { t: 'place', i: hi } : { t: 'throw' }, now, rng);
      return;
    }
    case 'p7':
      turnMove(g, { t: 'swap7', mine: highest(), seat: pickOther(), i: Math.floor(rng() * HAND) }, now, rng);
      return;
    case 'pQ':
      turnMove(g, { t: 'shuffleQ', seat: pickOther() }, now, rng);
      return;
    case 'pK':
      g.peek = { target: g.cur };
      turnMove(g, { t: 'done' }, now, rng);
      return;
    case 'pJ':
      g.peek = { target: pickOther() };
      turnMove(g, { t: 'done' }, now, rng);
      return;
  }
}

// ---- What one phone is allowed to see -----------------------------------------------------
export type SeatView = {
  id: string; name: string; gem: Gem; connected: boolean; bot: boolean; ready: boolean;
  kicked: boolean; // removed by the host; a bot is finishing their cards
  robot: boolean; // a bot the host added, not a person
  cards: (Card | null)[]; // null = face down to you
  total: number | null; // only at the end
};
export type View = {
  phase: Game['phase'];
  you: number | null; // your seat, or null when watching
  host: number;
  seats: SeatView[];
  deckCount: number;
  discardTop: Card | null;
  cur: number;
  step: Step;
  hasDrawn: boolean;
  drawn: Card | null; // only the player whose turn it is sees the drawn card
  peek: { target: number } | null; // everyone knows who is looking at whose cards, not what they see
  timerSec: number;
  deadline: number | null;
  round: number;
  winners: number[] | null; // null while playing, and when a game ended because everyone left
  endReason: Game['endReason'];
  pausedUntil: number | null; // set while nobody is playing: the game ends at this time unless someone returns
  log: LogEntry[];
  fx: Fx[];
};

export function viewFor(g: Game, you: number | null): View {
  const end = g.phase === 'end';
  const best = end ? Math.min(...g.seats.map(s => total(s.cards))) : 0;
  const seats: SeatView[] = g.seats.map((s, i) => {
    const mineWhileMemorising = g.phase === 'memorize' && you === i && !s.ready;
    const peeking = g.phase === 'play' && g.peek !== null && you === g.cur && g.peek.target === i;
    const show = end || mineWhileMemorising || peeking;
    return {
      id: s.id, name: s.name, gem: s.gem, connected: s.connected, bot: s.bot, ready: s.ready, kicked: !!s.kicked, robot: !!s.robot,
      cards: s.cards.map(c => (show ? { ...c } : null)),
      total: end ? total(s.cards) : null,
    };
  });
  return {
    phase: g.phase, you, host: hostIndex(g), seats,
    deckCount: g.deck.length,
    discardTop: g.discard.length ? { ...g.discard[g.discard.length - 1] } : null,
    cur: g.cur, step: g.step,
    hasDrawn: g.drawn !== null,
    drawn: g.drawn && you === g.cur && g.phase === 'play' ? { ...g.drawn } : null,
    peek: g.peek ? { ...g.peek } : null,
    timerSec: g.timerSec, deadline: g.deadline, round: g.round,
    winners: end && g.endReason !== 'abandoned' ? g.seats.map((s, i) => (total(s.cards) === best ? i : -1)).filter(i => i >= 0) : null,
    endReason: g.endReason,
    pausedUntil: inGame(g) && g.idleSince !== null ? g.idleSince + IDLE_END_MS : null,
    log: g.log.slice(-20),
    fx: g.fx.slice(),
  };
}
