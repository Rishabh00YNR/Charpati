// End-to-end test against a running room server: node server/test/online.check.mjs [host]
// Three phones play a full game over WebSockets; one drops and rejoins; a spectator watches.
const HOST = process.argv[2] || 'ws://127.0.0.1:1999';
const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const url = token => `${HOST}/parties/room/${code}${token ? `?token=${token}` : ''}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = msg => { console.error('FAIL:', msg); process.exit(1); };

function phone(name) {
  const p = { name, view: null, token: null, errors: [], ws: null, updates: 0 };
  p.open = token => new Promise(res => {
    p.ws = new WebSocket(url(token));
    p.ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.t === 'view') { p.view = m.view; p.updates++; }
      if (m.t === 'seat') p.token = m.token;
      if (m.t === 'error') p.errors.push(m.msg);
    };
    p.ws.onopen = () => res();
  });
  p.send = move => p.ws.send(JSON.stringify(move));
  return p;
}
async function until(test, what, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (test()) return; await sleep(20); }
  fail(`timed out waiting for: ${what}`);
}

const phones = [phone('Ritesh'), phone('Chirag'), phone('Arnav')];
for (const p of phones) { await p.open(); p.send({ t: 'join', name: p.name }); }
await until(() => phones.every(p => p.token && p.view?.seats.length === 3), 'everyone seated');
phones.forEach(p => { if (p.view.you === null) fail(`${p.name} has no seat`); });

phones[1].send({ t: 'start' });
await until(() => phones[1].errors.length, 'non-host start refused');
phones[0].send({ t: 'start' });
await until(() => phones.every(p => p.view.phase === 'memorize'), 'memorise phase');

// Each phone sees only its own four cards while memorising.
for (const p of phones) {
  p.view.seats.forEach((s, i) => {
    const visible = s.cards.filter(Boolean).length;
    if (i === p.view.you && visible !== 4) fail(`${p.name} can't see own cards`);
    if (i !== p.view.you && visible !== 0) fail(`${p.name} can see seat ${i}'s cards`);
  });
}
phones.forEach(p => p.send({ t: 'arrange', a: 0, b: 1 }));
phones.forEach(p => p.send({ t: 'ready' }));
await until(() => phones.every(p => p.view.phase === 'play'), 'play phase');

const watcher = phone('Watcher');
await watcher.open();
await until(() => watcher.view, 'watcher view');
if (watcher.view.you !== null || watcher.view.seats.some(s => s.cards.some(Boolean))) fail('spectator saw hidden cards');

let turns = 0, dropped = false;
while (phones[0].view.phase === 'play' && turns < 200) {
  const cur = phones[0].view.cur, p = phones.find(x => x.view.you === cur), other = (cur + 1) % 3;
  const before = p.updates;
  p.send({ t: 'draw' });
  await until(() => p.updates > before && p.view.hasDrawn, `${p.name} drew`);
  // Only the player whose turn it is sees the drawn card.
  if (!p.view.drawn) fail('player cannot see their drawn card');
  phones.filter(x => x !== p).forEach(x => { if (x.view.drawn) fail(`${x.name} saw someone else's drawn card`); });
  const step = p.view.step;
  if (step === 'choose') p.send(turns % 2 ? { t: 'throw' } : { t: 'place', i: turns % 4 });
  else if (step === 'p7') p.send({ t: 'swap7', mine: 0, seat: other, i: 1 });
  else if (step === 'pQ') p.send({ t: 'shuffleQ', seat: other });
  else if (step === 'pK' || step === 'pJ') {
    p.send(step === 'pK' ? { t: 'look' } : { t: 'peekJ', seat: other });
    const target = step === 'pK' ? cur : other;
    await until(() => p.view.peek, 'peek shown');
    if (p.view.seats[target].cards.filter(Boolean).length !== 4) fail('peeker cannot see the cards');
    phones.filter(x => x !== p).forEach(x => { if (x.view.seats[target].cards.some(Boolean)) fail(`${x.name} saw a private peek`); });
    p.send({ t: 'done' });
  }
  await until(() => phones[0].view.phase !== 'play' || phones[0].view.cur !== cur, 'turn passed');
  turns++;
  if (turns === 5 && !dropped) {
    // A phone locks and comes back: it must get the same seat back.
    dropped = true;
    const b = phones[1], seat = b.view.you;
    b.ws.close();
    await until(() => phones[0].view.seats[seat].connected === false, 'drop noticed');
    b.view = null;
    await b.open(b.token);
    await until(() => b.view, 'rejoined');
    if (b.view.you !== seat) fail('rejoined a different seat');
    await until(() => phones[0].view.seats[seat].connected, 'reconnect noticed');
  }
}
await until(() => phones.every(p => p.view.phase === 'end'), 'game end');
for (const p of [...phones, watcher]) if (p.view.seats.some(s => s.cards.some(c => !c)) || !p.view.winners?.length) fail('end view incomplete');

phones[0].send({ t: 'rematch' });
await until(() => phones.every(p => p.view.phase === 'memorize' && p.view.round === 2), 'rematch');

console.log(`Online check passed: room ${code}, ${turns} turns over the network, reconnect OK, spectator OK, rematch OK.`);
phones.forEach(p => p.ws.close());
watcher.ws.close();
process.exit(0);
