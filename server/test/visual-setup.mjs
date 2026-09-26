// Seats three players in a fresh room for a visual check, then moves the game along on a schedule.
// Prints the room code and Ritesh's seat pass so a browser can open the room as Ritesh.
const HOST = 'ws://127.0.0.1:1999';
const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function phone(name, gem) {
  return new Promise(res => {
    const p = { name, token: null, view: null };
    p.ws = new WebSocket(`${HOST}/parties/room/${code}`);
    p.ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'seat') p.token = m.token; if (m.t === 'view') p.view = m.view; };
    p.ws.onopen = () => { p.ws.send(JSON.stringify({ t: 'join', name, gem })); res(p); };
    p.send = m => p.ws.send(JSON.stringify(m));
  });
}
const ritesh = await phone('Ritesh', 'emerald');
await sleep(300);
const chirag = await phone('Chirag', 'amethyst');
await sleep(300);
const arnav = await phone('Arnav', 'ruby');
await sleep(600);
ritesh.send({ t: 'timer', sec: 120 });
await sleep(200);
ritesh.send({ t: 'start' });
await sleep(400);
chirag.send({ t: 'ready' });
arnav.send({ t: 'ready' });
await sleep(300);
console.log(`READY code=${code} token=${ritesh.token}`);
ritesh.ws.close(); // the browser takes over Ritesh's seat
await sleep(Number(process.argv[2] || 25000));
// Ritesh (in the browser) hasn't pressed ready; mark ready from a second connection with his pass.
const again = new WebSocket(`${HOST}/parties/room/${code}?token=${ritesh.token}`);
again.onopen = () => again.send(JSON.stringify({ t: 'ready' }));
console.log('PLAY');
await sleep(Number(process.argv[3] || 30000));
process.exit(0);
