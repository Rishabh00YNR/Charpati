import { Server, routePartykitRequest, type Connection, type ConnectionContext, type WSMessage } from 'partyserver';
import { apply, join, newGame, nextWake, setConnected, tick, viewFor, type Game, type Move } from '../../shared/engine';

// A phone's connection remembers its seat pass (token); null means it's only watching.
type ConnState = { token: string | null };
// Messages the room sends to a phone.
export type ServerMessage =
  | { t: 'view'; view: ReturnType<typeof viewFor>; now: number } // now: the room's clock, so phones can show accurate countdowns
  | { t: 'seat'; token: string }
  | { t: 'error'; msg: string };

const EMPTY_ROOM_TTL_MS = 6 * 60 * 60 * 1000; // an empty, finished room is deleted after 6 hours
const CODE = /^[A-HJ-NP-Z2-9]{4,6}$/; // room codes avoid look-alikes (no I, O, 0, 1)
const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

// One Durable Object per room code. It owns the deck and every hand; phones only get viewFor().
export class Room extends Server<Env> {
  static options = { hibernate: true };
  game: Game = newGame();

  async onStart() {
    const saved = await this.ctx.storage.get<Game>('game');
    // Rooms saved by an older version lack newer fields; fill them in (activity counts from now).
    this.game = saved ? { ...newGame(), ...saved, lastActivity: (saved as Partial<Game>).lastActivity ?? Date.now() } : newGame();
  }

  // Lets the join screen ask whether a room exists and has space.
  onRequest(): Response {
    const g = this.game;
    return Response.json({ phase: g.phase, players: g.seats.length, open: g.phase === 'lobby' && g.seats.length < 5 }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  onConnect(conn: Connection<ConnState>, ctx: ConnectionContext) {
    const token = new URL(ctx.request.url).searchParams.get('token');
    const seat = token ? this.game.seats.findIndex(s => s.token === token) : -1;
    conn.setState({ token: seat >= 0 ? token : null });
    if (seat >= 0) setConnected(this.game, seat, true, Date.now());
    this.commit();
  }

  onMessage(conn: Connection<ConnState>, raw: WSMessage) {
    let move: Move;
    try { move = JSON.parse(String(raw)); } catch { return; }
    if (!move || typeof move.t !== 'string') return;
    if (move.t === 'join') {
      if (this.seatOf(conn) !== null) return;
      const r = join(this.game, move.name, move.gem, rng, Date.now());
      if ('error' in r) return this.send(conn, { t: 'error', msg: r.error });
      conn.setState({ token: r.token });
      this.send(conn, { t: 'seat', token: r.token });
      return this.commit();
    }
    const seat = this.seatOf(conn);
    if (seat === null) return this.send(conn, { t: 'error', msg: 'Take a seat to play.' });
    const err = apply(this.game, seat, move, Date.now(), rng);
    if (err) return this.send(conn, { t: 'error', msg: err });
    if (move.t === 'leave') conn.setState({ token: null });
    this.commit();
  }

  onClose(conn: Connection<ConnState>) {
    const seat = this.seatOf(conn);
    // Another tab of the same player may still be open.
    const stillHere = [...this.getConnections<ConnState>()].some(c => c !== conn && c.state?.token && c.state.token === conn.state?.token);
    if (seat !== null && !stillHere) {
      setConnected(this.game, seat, false, Date.now());
      this.commit();
    }
  }

  async onAlarm() {
    const now = Date.now();
    const wake = nextWake(this.game);
    if (wake === null) {
      // No timers running: this was the clean-up alarm for an empty room.
      if (![...this.getConnections()].length) {
        await this.ctx.storage.deleteAll();
        this.game = newGame();
      }
      return;
    }
    let changed = false;
    for (let i = 0; i < 25 && (nextWake(this.game) ?? Infinity) <= now; i++) changed = tick(this.game, now, rng) || changed;
    if (changed) this.commit();
    else this.schedule();
  }

  private seatOf(conn: Connection<ConnState>): number | null {
    const token = conn.state?.token;
    if (!token) return null;
    const i = this.game.seats.findIndex(s => s.token === token);
    return i >= 0 ? i : null;
  }

  // Send every phone its own view, then save the game and set the next alarm.
  private commit() {
    const now = Date.now();
    for (const c of this.getConnections<ConnState>()) this.send(c, { t: 'view', view: viewFor(this.game, this.seatOf(c)), now });
    this.game.fx = [];
    this.ctx.storage.put('game', this.game);
    this.schedule();
  }

  private schedule() {
    const wake = nextWake(this.game);
    const empty = ![...this.getConnections()].length;
    if (wake !== null) this.ctx.storage.setAlarm(wake);
    else if (empty) this.ctx.storage.setAlarm(Date.now() + EMPTY_ROOM_TTL_MS);
    else this.ctx.storage.deleteAlarm();
  }

  private send(conn: Connection, msg: ServerMessage) {
    try { conn.send(JSON.stringify(msg)); } catch { /* the phone just went away */ }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/parties\/room\/([^/]+)/);
    if (m && !CODE.test(m[1])) return new Response('Unknown room code', { status: 400 });
    return (await routePartykitRequest(request, env)) ?? new Response('Charpati rooms', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
