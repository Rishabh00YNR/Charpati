// Pause test against a room server: node server/test/pause.check.mjs [host]
// Everyone leaves mid-game -> the game pauses (no moves); one player returns -> it carries on.
const HOST = process.argv[2] || 'ws://127.0.0.1:1999';
const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = msg => { console.error('FAIL:', msg); process.exit(1); };
function connect(token) {
  return new Promise(res => {
    const p = { view: null, token };
    p.ws = new WebSocket(`${HOST}/parties/room/${code}${token ? `?token=${token}` : ''}`);
    p.ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'view') p.view = m.view; if (m.t === 'seat') p.token = m.token; };
    p.ws.onopen = () => res(p);
    p.send = m => p.ws.send(JSON.stringify(m));
  });
}
async function until(test, what, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { if (test()) return; await sleep(50); } fail(`timed out waiting for: ${what}`); }

const players = [];
for (const name of ['Ritesh', 'Chirag', 'Arnav']) { const p = await connect(); p.send({ t: 'join', name }); players.push(p); await sleep(250); }
await until(() => players.every(p => p.token && p.view?.seats.length === 3), 'seated');
players[0].send({ t: 'start' });
await until(() => players.every(p => p.view.phase === 'memorize'), 'memorise');
players.forEach(p => p.send({ t: 'ready' }));
await until(() => players.every(p => p.view.phase === 'play'), 'play');

players.forEach(p => p.ws.close());
const watcher = await connect();
await until(() => watcher.view?.pausedUntil, 'paused after everyone left');
const deck = watcher.view.deckCount;
if (watcher.view.seats.some(s => s.connected)) fail('seats still marked connected');
await sleep(1500);
if (watcher.view.deckCount !== deck || watcher.view.phase !== 'play') fail('the game moved while paused');
const endsIn = Math.round((watcher.view.pausedUntil - Date.now()) / 1000);

const back = await connect(players[1].token);
await until(() => watcher.view && watcher.view.pausedUntil === null, 'resumed when a player came back');
if (!watcher.view.seats[1].connected) fail('returning player not marked connected');
console.log(`Pause check passed: room ${code} paused when everyone left (would end in ~${endsIn}s) and carried on when Chirag came back.`);
back.ws.close(); watcher.ws.close();
process.exit(0);
