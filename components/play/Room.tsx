'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import PartySocket from 'partysocket';
import type { Fx, Gem, Move, View } from '@/shared/engine';
import { ROOMS_HOST, clearSeatToken, isCode, loadProfile, loadSeatToken, saveProfile, saveSeatToken } from '@/lib/rooms';
import { STAGE, layoutKind, type Layout } from './layout';
import Table from './Table';
import Lobby from './Lobby';
import HostSheet from './HostSheet';

type ServerMessage = { t: 'view'; view: View; now: number } | { t: 'seat'; token: string } | { t: 'kicked' } | { t: 'error'; msg: string };
// Arriving from the Play screen: sit straight down (and for practice, add the bots and deal).
type Auto = { go: 'host' } | { go: 'bots' } | { go: 'solo'; bots: number; sec: number };

export default function Room({ code }: { code: string }) {
  const router = useRouter();
  const valid = isCode(code);
  const [view, setView] = useState<View | null>(null);
  const [online, setOnline] = useState(false);
  const [skew, setSkew] = useState(0); // room clock minus this phone's clock
  const [clock, setClock] = useState(() => Date.now());
  const [fx, setFx] = useState<{ list: Fx[]; key: number }>({ list: [], key: 0 });
  const [toast, setToast] = useState('');
  const [kind, setKind] = useState<Layout['kind']>('phone');
  const [scale, setScale] = useState(1);
  const [profile, setProfile] = useState<{ name: string; gem: Gem }>({ name: '', gem: 'topaz' });
  const [hostOpen, setHostOpen] = useState(false);
  // 'sent' = waiting for the seat to arrive.
  const [auto, setAuto] = useState<Auto | 'sent' | null>(null);
  const sock = useRef<PartySocket | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }, []);

  // Pick the tall or the wide table for this screen, and scale it to fit.
  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const k = layoutKind(w, h), s = STAGE[k];
      setKind(k);
      setScale(Math.min(w / s.W, h / s.H, s.max) || 1);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const p = loadProfile();
    if (p) setProfile(p);
    const q = new URLSearchParams(window.location.search), go = q.get('go');
    if (p && (go === 'host' || go === 'bots')) setAuto({ go });
    // Practice: up to 4 bots on a phone, up to 7 on a laptop (a big table).
    const most = layoutKind(window.innerWidth, window.innerHeight) === 'desktop' ? 7 : 4;
    if (p && go === 'solo') setAuto({ go: 'solo', bots: Math.min(most, Math.max(2, Number(q.get('bots')) || 2)), sec: Number(q.get('t')) || 30 });
    if (go) window.history.replaceState(null, '', window.location.pathname); // a reload or a shared link shouldn't repeat it
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
      } else if (m.t === 'kicked') {
        clearSeatToken(code);
        showToast('The host removed you from this table. You can keep watching.');
      } else if (m.t === 'error') {
        showToast(m.msg);
        setAuto(a => (a === 'sent' ? null : a)); // couldn't sit down: show the seat form instead
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

  const send = useCallback((m: Move) => { sock.current?.send(JSON.stringify(m)); }, []);

  useEffect(() => {
    if (!auto || !view) return;
    if (auto === 'sent') { if (view.you !== null) setAuto(null); return; }
    const p = loadProfile();
    if (view.you !== null || view.phase !== 'lobby' || !p) { setAuto(null); return; }
    // The room handles messages in order, so these arrive after the join, with this phone as host.
    send({ t: 'join', name: p.name, gem: p.gem, wide: kind === 'desktop' });
    if (auto.go === 'bots') { send({ t: 'addBot' }); send({ t: 'addBot' }); }
    if (auto.go === 'solo') {
      if (auto.bots > 4) send({ t: 'size', size: 'big' });
      for (let i = 0; i < auto.bots; i++) send({ t: 'addBot' });
      send({ t: 'timer', sec: auto.sec });
      send({ t: 'start' });
    }
    setAuto('sent');
  }, [auto, view, send, kind]);

  const inviteUrl = typeof window === 'undefined' ? `/play/${code}` : `${window.location.origin}/play/${code}`;
  async function copy() {
    try { await navigator.clipboard.writeText(inviteUrl); showToast('Invite link copied. Paste it to your friends.'); }
    catch { showToast(`Share this link: ${inviteUrl}`); }
  }
  async function share() {
    const text = `Join my Charpati table! Table code ${code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Charpati', text, url: inviteUrl }); return; }
      await copy();
    } catch { /* the share sheet was closed */ }
  }
  function leave() {
    send({ t: 'leave' });
    clearSeatToken(code);
    router.push('/play');
  }
  function sit(name: string, gem: Gem) {
    saveProfile({ name, gem });
    setProfile({ name, gem });
    send({ t: 'join', name, gem, wide: kind === 'desktop' });
  }

  const isHost = !!view && view.you !== null && view.you === view.host && view.phase !== 'closed';
  const toastEl = toast && <div className="pl-toast fixed" role="alert">{toast}</div>;

  if (!valid || !view || auto === 'sent' || (auto && view.phase === 'lobby' && view.you === null)) {
    return (
      <main className="fl-page center" aria-live="polite">
        <span className="fl-word sm">Charpati</span>
        {!valid
          ? <><p className="fl-sub">That table code doesn’t look right. Codes are 4 letters or numbers, like KQ7X.</p><a className="btn big fl-cta" href="/play">Back to Play</a></>
          : <p className="fl-sub dots">{view ? 'Setting up your table' : `Connecting to table ${code}`}<i /><i /><i /></p>}
        {toastEl}
      </main>
    );
  }

  // A big table (6 to 8) is drawn for wide screens only.
  if (view.size === 'big' && kind === 'phone' && view.phase !== 'closed') {
    const seated = view.you !== null;
    return (
      <main className="fl-page center" aria-live="polite">
        <span className="fl-word sm">Charpati</span>
        <h1 className="fl-h1 sm">{seated ? 'Make your window wider' : 'This is a big table'}</h1>
        <p className="fl-sub">{seated
          ? 'Tables of 6 to 8 players need a laptop or desktop screen. Widen this window to keep playing.'
          : 'Tables of 6 to 8 players are for laptops and desktops. Open this link on a computer to join or watch.'}</p>
        {!seated && <button type="button" className="btn big fl-cta" onClick={copy}>Copy the link</button>}
        {!seated && <a className="btn big ghost fl-cta" href="/play">Make your own table</a>}
        {toastEl}
      </main>
    );
  }

  if (view.phase === 'lobby') {
    return (
      <>
        <Lobby code={code} view={view} send={send} inviteUrl={inviteUrl} onShare={share} onCopy={copy} onLeave={leave}
          defaultName={profile.name} defaultGem={profile.gem} onSit={sit} wide={kind === 'desktop'} />
        {!online && <div className="pl-status fixed" role="status">Reconnecting…</div>}
        {toastEl}
      </>
    );
  }

  const s = STAGE[kind];
  return (
    <div className="pl-app">
      <div className={`pl-stage k-${kind}`} style={{ width: s.W, height: s.H, ['--s' as string]: scale } as CSSProperties}>
        <Table code={code} view={view} send={send} now={clock + skew} fx={fx} kind={kind} onShare={share} onHostPanel={() => setHostOpen(true)} />
        {!online && <div className="pl-status" role="status">Reconnecting…</div>}
        {hostOpen && isHost && <HostSheet view={view} send={send} onClose={() => setHostOpen(false)} />}
        {toast && <div className="pl-toast" role="alert">{toast}</div>}
      </div>
    </div>
  );
}
