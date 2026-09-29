// Bots the host adds, over the network: node server/test/bots.check.mjs [host]
const HOST = process.argv[2] || 'ws://127.0.0.1:1999';
const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = msg => { console.error('FAIL:', msg); process.exit(1); };
async function until(test, what, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { if (test()) return; await sleep(40); } fail(`timed out waiting for: ${what}`); }

const me = { view: null, token: null };
me.ws = new WebSocket(`${HOST}/parties/room/${code}`);
me.ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'view') me.view = m.view; if (m.t === 'seat') me.token = m.token; };
await new Promise(r => (me.ws.onopen = r));
const send = m => me.ws.send(JSON.stringify(m));
send({ t: 'join', name: 'Ritesh' });
await until(() => me.token && me.view?.you === 0, 'seated');

send({ t: 'addBot' }); send({ t: 'addBot' });
await until(() => me.view.seats.length === 3 && me.view.seats.slice(1).every(s => s.robot && s.bot), 'two bots seated');
send({ t: 'start' });
await until(() => me.view.phase === 'memorize', 'memorise');
send({ t: 'ready' });
await until(() => me.view.phase === 'play', 'play');

// Play my turns by drawing and throwing (or using the power); the bots play theirs.
const bot = new Set();
const end = Date.now() + 5 * 60_000;
let acted = '';
while (me.view.phase === 'play' && Date.now() < end) {
  const v = me.view;
  if (v.cur !== 0) { bot.add(v.cur); await sleep(100); continue; }
  const key = `${v.deckCount}:${v.step}:${!!v.peek}`;
  if (key !== acted) {
    acted = key;
    if (v.step === 'draw') send({ t: 'draw' });
    else if (v.step === 'choose') send({ t: 'throw' });
    else if (v.step === 'pK') send(v.peek ? { t: 'done' } : { t: 'look' });
    else if (v.step === 'pJ') send(v.peek ? { t: 'done' } : { t: 'peekJ', seat: 1 });
    else if (v.step === 'pQ') send({ t: 'shuffleQ', seat: 1 });
    else if (v.step === 'p7') send({ t: 'swap7', mine: 0, seat: 2, i: 0 });
  }
  await sleep(60);
}
if (me.view.phase !== 'end' || me.view.endReason !== 'deck' || !me.view.winners?.length) fail(`game did not finish: ${me.view.phase}/${me.view.endReason}`);
if (bot.size !== 2) fail('both bots should have taken turns');
send({ t: 'rematch' });
await until(() => me.view.phase === 'memorize' && me.view.seats.filter(s => s.robot).length === 2, 'rematch keeps the bots');
console.log(`Bots check passed: room ${code}. One player plus two bots played a whole game; the bots stayed for the rematch.`);
me.ws.close();
process.exit(0);
