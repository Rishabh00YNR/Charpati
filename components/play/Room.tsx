'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import PartySocket from 'partysocket';
import { GEMS, type Fx, type Gem, type Move, type View } from '@/shared/engine';
import { GEM_COLOR, ROOMS_HOST, clearSeatToken, isCode, loadProfile, loadSeatToken, saveProfile, saveSeatToken } from '@/lib/rooms';
import Table from './Table';

type ServerMessage = { t: 'view'; view: View; now: number } | { t: 'seat'; token: string } | { t: 'error'; msg: string };

export default function Room({ code }: { code: string }) {
  const router = useRouter();
  const valid = isCode(code);
  const [view, setView] = useState<View | null>(null);
  const [online, setOnline] = useState(false);
  const [skew, setSkew] = useState(0); // room clock minus this phone's clock
  const [clock, setClock] = useState(() => Date.now());
  const [fx, setFx] = useState<{ list: Fx[]; key: number }>({ list: [], key: 0 });
  const [toast, setToast] = useState('');
  const [scale, setScale] = useState(1);
  const [name, setName] = useState('');
  const [gem, setGem] = useState<Gem>('topaz');
  const sock = useRef<PartySocket | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }, []);

  // Fit the 390 x 772 stage to the screen (as big as fits, capped so it doesn't get huge on a laptop).
  useEffect(() => {
    const fit = () => {
      const el = document.querySelector('.pl-app');
      if (el) setScale(Math.min(el.clientWidth / 390, el.clientHeight / 772, 1.6) || 1);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const p = loadProfile();
    if (p) { setName(p.name); setGem(p.gem); }
  }, []);

  // Connect to the room. PartySocket reconnects by itself, sending this phone's seat pass each time.
  useEffect(() => {
    if (!valid) return;
    const ws = new PartySocket({ host: ROOMS_HOST, party: 'room', room: code, query: () => ({ token: loadSeatToken(code) ?? '' }) });
    ws.addEventListener('open', () => setOnline(true));
    ws.addEventListener('close', () => setOnline(false));
    ws.addEventListener('message', (e: MessageEvent) => {
      let m: ServerMessage;
      try { m = JSON.parse(String(e.data)); } catch { return; }
      if (m.t === 'view') {
        setView(m.view);
        setSkew(m.now - Date.now());
        setClock(Date.now());
        if (m.view.fx.length) setFx(f => ({ list: m.view.fx, key: f.key + 1 }));
      } else if (m.t === 'seat') {
        saveSeatToken(code, m.token);
      } else if (m.t === 'error') {
        showToast(m.msg);
      }
    });
    sock.current = ws;
    return () => { ws.close(); sock.current = null; };
  }, [code, valid, showToast]);

  // A ticking clock for the countdowns, only while a timer is running.
  useEffect(() => {
    if (!view?.deadline && !view?.pausedUntil) return;
    const t = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(t);
  }, [view?.deadline, view?.pausedUntil]);

  // If the colour this phone remembers is taken, offer the first free one.
  const taken = new Set(view?.seats.map(s => s.gem) ?? []);
  useEffect(() => {
    if (view && view.you === null && taken.has(gem)) {
      const free = GEMS.find(g => !taken.has(g));
      if (free) setGem(free);
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((m: Move) => { sock.current?.send(JSON.stringify(m)); }, []);

  async function share() {
    const url = `${window.location.origin}/play/${code}`;
    const text = `Join my Charpati table! Room code ${code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Charpati', text, url }); return; }
      await navigator.clipboard.writeText(`${text}: ${url}`);
      showToast('Invite link copied. Paste it to your friends.');
    } catch { /* the share sheet was closed */ }
  }

  function leave() {
    send({ t: 'leave' });
    clearSeatToken(code);
    router.push('/play');
  }

  function sit(e: FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) return showToast('Type your name first.');
    saveProfile({ name: nm, gem });
    send({ t: 'join', name: nm, gem });
  }

  const needsSeat = !!view && view.you === null && view.phase === 'lobby' && view.seats.length < 5;

  return (
    <div className="pl-app">
      <div className="pl-stage" style={{ ['--s' as string]: scale } as CSSProperties}>
        <div className="pl-top">
          <span className="brand">Charpati</span>
          {valid && <button type="button" className="pl-code" onClick={share} aria-label={`Room ${code}. Share the invite`}><small>ROOM</small>{code}</button>}
        </div>

        {!valid ? (
          <div className="pl-center" style={{ top: 330 }}>
            <span className="small">That room code doesn’t look right. Codes are 4 letters or numbers, like KQ7X.</span>
            <a className="btn" href="/play">Back to Play</a>
          </div>
        ) : !view ? (
          <div className="pl-center" style={{ top: 380 }}><span className="small">Connecting to room {code}…</span></div>
        ) : (
          <Table code={code} view={view} send={send} now={clock + skew} fx={fx} onShare={share} onLeave={leave} />
        )}

        {view && !online && <div className="pl-status" role="status">Reconnecting…</div>}
        {toast && <div className="pl-toast" role="alert">{toast}</div>}

        {needsSeat && (
          <>
            <div className="pl-sheet-bg" />
            <form className="pl-sheet" onSubmit={sit} aria-labelledby="sit-h">
              <h2 id="sit-h">Take a seat</h2>
              <p>Room {code} · {view!.seats.length} of 5 seated</p>
              <label className="pl-field" htmlFor="sit-name">
                Your name
                <input id="sit-name" maxLength={12} autoComplete="nickname" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Komal" />
              </label>
              <div className="pl-field">
                Your colour
                <div className="pl-gems">
                  {GEMS.map(g => (
                    <button key={g} type="button" className={`pl-gem${gem === g ? ' on' : ''}`} style={{ ['--gem' as string]: GEM_COLOR[g] } as CSSProperties} disabled={taken.has(g)} onClick={() => setGem(g)} aria-label={g} aria-pressed={gem === g} />
                  ))}
                </div>
              </div>
              <button type="submit" className="btn big">Sit down</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
