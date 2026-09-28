// Host controls over the network: node server/test/host.check.mjs [host]
const HOST = process.argv[2] || 'ws://127.0.0.1:1999';
const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = msg => { console.error('FAIL:', msg); process.exit(1); };
function phone(name) {
  return new Promise(res => {
    const p = { name, view: null, token: null, kicked: false, errors: [] };
    p.ws = new WebSocket(`${HOST}/parties/room/${code}`);
    p.ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'view') p.view = m.view; if (m.t === 'seat') p.token = m.token; if (m.t === 'kicked') p.kicked = true; if (m.t === 'error') p.errors.push(m.msg); };
    p.ws.onopen = () => { p.ws.send(JSON.stringify({ t: 'join', name })); res(p); };
    p.send = m => p.ws.send(JSON.stringify(m));
  });
}
async function until(test, what, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { if (test()) return; await sleep(40); } fail(`timed out waiting for: ${what}`); }
const seatOf = (p, name) => p.view.seats.findIndex(s => s.name === name);

const ps = [];
for (const n of ['Ritesh', 'Chirag', 'Arnav', 'Komal', 'Meera']) { ps.push(await phone(n)); await sleep(200); }
const [host, , , komal, meera] = ps;
await until(() => ps.every(p => p.token && p.view?.seats.length === 5), 'five seated');

// Lobby: remove Meera.
ps[1].send({ t: 'kick', seat: seatOf(ps[1], 'Meera') });
await until(() => ps[1].errors.length, 'non-host kick refused');
const mi = seatOf(host, 'Meera');
host.send({ t: 'kick', seat: mi, id: host.view.seats[mi].id });
await until(() => meera.kicked && meera.view.you === null && host.view.seats.length === 4, 'Meera removed from the lobby');

host.send({ t: 'start' });
await until(() => host.view.phase === 'memorize', 'memorise');
ps.slice(0, 4).forEach(p => p.send({ t: 'ready' }));
await until(() => host.view.phase === 'play', 'play');

// Mid-game: remove Komal; a bot takes her cards and her phone becomes a watcher.
const ki = seatOf(host, 'Komal');
host.send({ t: 'kick', seat: ki, id: host.view.seats[ki].id });
await until(() => komal.kicked && komal.view.you === null && host.view.seats[ki].kicked && host.view.seats[ki].bot, 'Komal removed mid-game');
if (komal.view.seats.some(s => s.cards.some(Boolean))) fail('removed player can still see cards');

host.send({ t: 'timer', sec: 60 });
await until(() => host.view.timerSec === 60, 'timer changed mid-game');

host.send({ t: 'endGame' });
await until(() => ps.slice(0, 3).every(p => p.view.phase === 'end') && host.view.endReason === 'host' && host.view.winners?.length, 'host ended the game');

host.send({ t: 'rematch' });
await until(() => host.view.phase === 'memorize' && host.view.seats.length === 3 && !host.view.seats.some(s => s.name === 'Komal'), 'new game without Komal');
console.log(`Host check passed: room ${code}. Remove in lobby, remove mid-game (bot took over), timer change, end now, new game without the removed player.`);
ps.forEach(p => p.ws.close());
process.exit(0);
