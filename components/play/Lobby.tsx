'use client';

// Before the cards are dealt: simple step-by-step screens instead of the game table.
// The host goes Invite → Seats → Start. A friend with the link takes a seat and waits.

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { GEMS, MAX_SEATS, MIN_SEATS, type Gem, type Move, type SeatView, type View } from '@/shared/engine';
import { GEM_COLOR } from '@/lib/rooms';

type Props = {
  code: string;
  view: View;
  send: (m: Move) => void;
  inviteUrl: string;
  onShare: () => void;
  onCopy: () => void;
  onLeave: () => void;
  defaultName: string;
  defaultGem: Gem;
  onSit: (name: string, gem: Gem) => void;
};

const GEM_NAME: Record<Gem, string> = { topaz: 'Topaz', ruby: 'Ruby', sapphire: 'Sapphire', emerald: 'Emerald', amethyst: 'Amethyst' };
const PACES = [{ sec: 60, name: 'Relaxed' }, { sec: 30, name: 'Normal' }, { sec: 15, name: 'Quick' }];

export default function Lobby(p: Props) {
  const { view } = p;
  const [watching, setWatching] = useState(false);
  if (view.you !== null && view.you === view.host) return <HostFlow {...p} />;
  if (view.you !== null) return <Waiting {...p} />;
  if (watching || view.seats.length >= MAX_SEATS) return <Watching {...p} onSeat={view.seats.length < MAX_SEATS ? () => setWatching(false) : undefined} />;
  return <GuestJoin {...p} onWatch={() => setWatching(true)} />;
}

// ---- Pieces shared by the screens ------------------------------------------------------------
const Page = ({ children, label }: { children: ReactNode; label: string }) => <main className="fl-page" aria-label={label}>{children}</main>;

function Av({ seat, size = 44, glow = false }: { seat?: SeatView; size?: number; glow?: boolean }) {
  const st = { ['--s' as string]: `${size}px`, ['--gem' as string]: seat ? GEM_COLOR[seat.gem] : 'transparent' } as CSSProperties;
  if (!seat) return <span className="fl-av open" style={st} aria-hidden="true" />;
  return <span className={`fl-av${glow ? ' glow' : ''}`} style={st} aria-hidden="true">{seat.name[0]?.toUpperCase()}</span>;
}

const Diamond = () => <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0L10 5L5 10L0 5Z" fill="#C9A04F" /></svg>;
const Icon = ({ d, size = 18, w = 1.9 }: { d: string; size?: number; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const I = {
  back: 'M15 6l-6 6 6 6',
  next: 'M5 12h14M13 6l6 6-6 6',
  share: 'M12 3v12M8 7l4-4 4 4M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  copy: 'M9 9h10v10H9zM15 9V5H5v10h4',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  pen: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5v.5',
  cards: 'M4 7.5l7-1.5 2.6 12-7 1.5zM13 5.5l6.5 1.2-2.2 12',
};

function Steps({ at }: { at: number }) {
  return (
    <div className="fl-steps" aria-label={`Step ${at + 1} of 3`}>
      {['INVITE', 'SEATS', 'START'].map((s, i) => (
        <div key={s} className={`fl-step${i < at ? ' done' : i === at ? ' now' : ''}`}>
          <span className="pip">{i < at ? <Icon d={I.check} size={13} w={3} /> : i + 1}</span>
          <span className="lab">{s}</span>
        </div>
      ))}
    </div>
  );
}

function Top({ back, onBack, children, right }: { back?: string; onBack?: () => void; children?: ReactNode; right?: ReactNode }) {
  const b = back
    ? <a className="fl-back" href={back} aria-label="Back"><Icon d={I.back} size={20} w={2} /></a>
    : onBack ? <button type="button" className="fl-back" onClick={onBack} aria-label="Back"><Icon d={I.back} size={20} w={2} /></button> : <span />;
  return <div className="fl-top">{b}<div className="mid">{children}</div><div className="end">{right}</div></div>;
}

const CodeChip = ({ code, compact = false }: { code: string; compact?: boolean }) => (
  <span className="fl-chip" aria-label={`Table ${code}`}>{!compact && <small>TABLE</small>}{code}</span>
);

function Seg({ label, options, value, onPick }: { label: string; options: { value: number; top: string; sub: string }[]; value: number; onPick: (v: number) => void }) {
  return (
    <div className="fl-seg" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onPick(o.value)}>
          <b>{o.top}</b><small>{o.sub}</small>
        </button>
      ))}
    </div>
  );
}

function SeatsStrip({ seats, you, host, fresh }: { seats: SeatView[]; you: number | null; host: number; fresh?: string | null }) {
  return (
    <div className="fl-strip">
      {Array.from({ length: MAX_SEATS }, (_, i) => {
        const s = seats[i];
        return (
          <div key={i} className="slot">
            <Av seat={s} glow={!!s && (i === you || s.name === fresh)} />
            <span className={`nm${s ? '' : ' open'}${i === you ? ' me' : ''}`}>{s ? (i === you ? 'You' : s.name) : 'Open'}</span>
            {s && i === host && i !== you && <span className="tag gold">HOST</span>}
            {s?.robot && <span className="tag bot">BOT</span>}
          </div>
        );
      })}
    </div>
  );
}

// A little felt table with everyone in their seat, you at the bottom.
function TablePreview({ seats, you }: { seats: SeatView[]; you: number }) {
  const n = seats.length;
  return (
    <div className="fl-mini" aria-label={`${n} players at the table`}>
      <div className="felt" />
      <div className="mfan" aria-hidden="true"><span /><span /><span /></div>
      <span className="cap">4 CARDS EACH</span>
      {seats.map((s, i) => {
        const j = (i - you + n) % n, a = ((90 + (j * 360) / n) * Math.PI) / 180;
        const x = 175 + 136 * Math.cos(a), y = 84 + 60 * Math.sin(a);
        return (
          <div key={s.id} className="seat" style={{ left: x, top: y }}>
            <Av seat={s} size={36} />
            <span className="pill">{i === you ? 'You' : s.robot ? `${s.name} · bot` : s.name}</span>
          </div>
        );
      })}
    </div>
  );
}

const TIPS = [
  { t: 'Remember your four', b: 'You see your four cards once, then they go face down. Keep them in your head.' },
  { t: 'Swap or throw', b: 'On your turn, draw a card. Swap it with one of yours, or throw it away.' },
  { t: 'Power cards', b: '7 swaps blind, J peeks at a player, Q shuffles a player, K shows you your own cards. You must use them.' },
  { t: 'Lowest total wins', b: 'When the draw pile runs out, everyone shows their cards. Ace counts as 1. Lowest total wins.' },
];
function Tips() {
  const [i, setI] = useState(0);
  return (
    <div className="fl-card fl-tip">
      <div className="in">
        <div className="row"><span className="kick">HOW TO PLAY</span><span className="cnt">{i + 1} of {TIPS.length}</span></div>
        <h2>{TIPS[i].t}</h2>
        <p>{TIPS[i].b}</p>
        <div className="row">
          <div className="dots" aria-hidden="true">{TIPS.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}</div>
          <div className="tnav">
            <button type="button" className="fl-round" onClick={() => setI((i + TIPS.length - 1) % TIPS.length)} aria-label="Previous tip"><Icon d={I.back} /></button>
            <button type="button" className="fl-round gold" onClick={() => setI((i + 1) % TIPS.length)} aria-label="Next tip"><Icon d="M9 6l6 6-6 6" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColourPicker({ value, onPick, takenBy }: { value: Gem; onPick: (g: Gem) => void; takenBy: Partial<Record<Gem, string>> }) {
  return (
    <div className="fl-gems" role="radiogroup" aria-label="Your colour">
      {GEMS.map(g => {
        const owner = takenBy[g];
        return (
          <button key={g} type="button" role="radio" aria-checked={value === g} className={value === g ? 'on' : ''} disabled={!!owner} onClick={() => onPick(g)}
            aria-label={owner ? `${GEM_NAME[g]}, taken by ${owner}` : GEM_NAME[g]} style={{ ['--gem' as string]: GEM_COLOR[g] } as CSSProperties}>
            <span className="dot" /><span className="nm">{owner ? 'Taken' : GEM_NAME[g]}</span>
          </button>
        );
      })}
    </div>
  );
}

// Who just sat down, for a few seconds.
function useFreshArrival(seats: SeatView[]) {
  const [fresh, setFresh] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(seats.map(s => s.id));
    if (seen.current) {
      const s = seats.find(x => !seen.current!.has(x.id) && !x.robot);
      if (s) {
        setFresh(s.name);
        const t = setTimeout(() => setFresh(null), 6000);
        seen.current = ids;
        return () => clearTimeout(t);
      }
    }
    seen.current = ids;
  }, [seats]);
  return fresh;
}

// ---- The host: Invite → Seats → Start ----------------------------------------------------------
type Step = 'invite' | 'seats' | 'start';

function HostFlow({ code, view, send, inviteUrl, onShare, onCopy }: Props) {
  const key = `charpati:step:${code}`;
  const [step, setStepState] = useState<Step>(() => {
    try { const s = sessionStorage.getItem(key); if (s === 'invite' || s === 'seats' || s === 'start') return s; } catch { /* ignore */ }
    return 'invite';
  });
  const setStep = (s: Step) => { setStepState(s); try { sessionStorage.setItem(key, s); } catch { /* ignore */ } window.scrollTo(0, 0); };
  const you = view.you!;
  const me = view.seats[you];
  const fresh = useFreshArrival(view.seats);
  const n = view.seats.length;
  const need = Math.max(0, MIN_SEATS - n);

  if (step === 'invite') {
    return (
      <Page label="Invite your friends">
        <Top back="/play"><Steps at={0} /></Top>
        <h1 className="fl-h1">Invite your friends</h1>
        <p className="fl-sub">Send the link. They tap it and take a seat.</p>
        <InviteCard code={code} host={me?.name ?? 'Your'} url={inviteUrl} />
        <button type="button" className="btn big fl-cta" onClick={onShare}><Icon d={I.share} size={20} w={2.2} />Send invite link</button>
        <div className="fl-two">
          <button type="button" className="btn ghost" onClick={onCopy}><Icon d={I.copy} />Copy link</button>
          <QrButton url={inviteUrl} />
        </div>
        <section className="fl-panel" aria-label="At the table">
          <div className="fl-row">
            <span className="fl-caps">AT THE TABLE · {n} OF {MAX_SEATS}</span>
            {fresh && <span className="fl-live"><i />{fresh} just joined</span>}
          </div>
          <SeatsStrip seats={view.seats} you={you} host={view.host} fresh={fresh} />
        </section>
        <button type="button" className="btn big outline fl-cta" onClick={() => setStep('seats')}>Next: fill the seats<Icon d={I.next} size={18} w={2.2} /></button>
      </Page>
    );
  }

  if (step === 'seats') {
    return (
      <Page label="Who's playing">
        <Top onBack={() => setStep('invite')} right={<CodeChip code={code} compact />}><Steps at={1} /></Top>
        <h1 className="fl-h1">Who’s playing?</h1>
        <p className="fl-sub">Friends fill seats as they join. Add bots for the rest.</p>
        <div className="fl-row" style={{ marginTop: 18 }}>
          <span className="fl-caps">SEATS</span>
          <span className="fl-count">{n} of {MAX_SEATS} taken</span>
        </div>
        <div className="fl-seats">
          {Array.from({ length: MAX_SEATS }, (_, i) => <SeatRow key={view.seats[i]?.id ?? `open${i}`} i={i} seat={view.seats[i]} you={you} send={send} canAdd={n < MAX_SEATS} />)}
        </div>
        <div className="fl-note">
          <span className={need ? 'i' : 'ok'}><Icon d={need ? I.info : I.check} size={18} w={2.2} /></span>
          <div>
            <b>{need ? `Add ${need} more to start` : `${n} players is enough to start`}</b>
            <span>Bots only know their own cards, just like you.</span>
          </div>
        </div>
        <button type="button" className="btn big fl-cta" onClick={() => setStep('start')}>Next: pick the pace<Icon d={I.next} size={18} w={2.2} /></button>
      </Page>
    );
  }

  return (
    <Page label="Ready to deal">
      <Top onBack={() => setStep('seats')} right={<CodeChip code={code} compact />}><Steps at={2} /></Top>
      <h1 className="fl-h1">Ready to deal?</h1>
      <p className="fl-sub">Pick the pace, then deal the cards.</p>
      <span className="fl-caps fl-gap">TIME PER TURN</span>
      <Seg label="Time per turn" value={view.timerSec} onPick={sec => send({ t: 'timer', sec })}
        options={PACES.map(x => ({ value: x.sec, top: `${x.sec}s`, sub: x.name }))} />
      <p className="fl-hint"><Icon d={I.info} size={16} w={2} />Run out of time and the turn is skipped. Miss 3 in a row and a bot plays for you.</p>
      <span className="fl-caps fl-gap">YOUR TABLE</span>
      <TablePreview seats={view.seats} you={you} />
      <button type="button" className="btn big fl-cta" onClick={() => send({ t: 'start', fill: need > 0 })}>
        <Icon d={I.cards} size={20} w={2} />{need ? `Add ${need} bot${need > 1 ? 's' : ''} and deal` : 'Deal the cards'}
      </button>
      <p className="fl-foot">Everyone gets 45 seconds to memorise their cards.</p>
    </Page>
  );
}

function InviteCard({ code, host, url }: { code: string; host: string; url: string }) {
  return (
    <div className="fl-card">
      <div className="in center">
        <span className="kick"><Diamond />{host.toUpperCase()}’S TABLE<Diamond /></span>
        <span className="code">{code}</span>
        <span className="url">{url.replace(/^https?:\/\//, '')}</span>
      </div>
    </div>
  );
}

function QrButton({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const [svg, setSvg] = useState('');
  useEffect(() => {
    if (!open || svg) return;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1C1A16', light: '#F5EFE0' } }).then(setSvg).catch(() => setSvg(''));
  }, [open, svg, url]);
  return (
    <>
      <button type="button" className="btn ghost" onClick={() => setOpen(true)}><Icon d={I.qr} />QR code</button>
      {open && (
        <>
          <div className="pl-sheet-bg fixed" onClick={() => setOpen(false)} />
          <div className="fl-qr" role="dialog" aria-modal="true" aria-label="QR code for the invite">
            <h2>Scan to join</h2>
            <p>Friends in the same room can point their phone camera here.</p>
            {/* The QR image is made on this phone from the invite link. */}
            <div className="img" dangerouslySetInnerHTML={{ __html: svg }} />
            <button type="button" className="btn big" onClick={() => setOpen(false)}>Done</button>
          </div>
        </>
      )}
    </>
  );
}

function SeatRow({ i, seat, you, send, canAdd }: { i: number; seat?: SeatView; you: number; send: (m: Move) => void; canAdd: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (!confirm) return; const t = setTimeout(() => setConfirm(false), 3000); return () => clearTimeout(t); }, [confirm]);
  if (!seat) {
    return (
      <div className="fl-seat open">
        <span className="no">{i + 1}</span>
        <Av size={40} />
        <div className="who"><b>Open seat</b><small>Waiting for a friend</small></div>
        {canAdd && <button type="button" className="fl-mini-btn bot" onClick={() => send({ t: 'addBot' })}><Icon d={I.plus} size={14} w={2.4} />Add bot</button>}
      </div>
    );
  }
  if (editing !== null) {
    const save = (e: FormEvent) => { e.preventDefault(); if (editing.trim()) send({ t: 'renameBot', seat: i, id: seat.id, name: editing }); setEditing(null); };
    return (
      <form className={`fl-seat${seat.robot ? ' bot' : ''}`} onSubmit={save}>
        <span className="no">{i + 1}</span>
        <Av seat={seat} size={40} />
        <input className="fl-input sm" autoFocus maxLength={12} value={editing} onChange={e => setEditing(e.target.value)} aria-label={`New name for ${seat.name}`} />
        <button type="submit" className="fl-mini-btn gold">Save</button>
      </form>
    );
  }
  const isMe = i === you;
  return (
    <div className={`fl-seat${seat.robot ? ' bot' : ''}`}>
      <span className="no">{i + 1}</span>
      <span className="avw"><Av seat={seat} size={40} />{seat.robot && <span className="badge">BOT</span>}</span>
      <div className="who"><b>{seat.name}</b><small>{isMe ? 'You' : seat.robot ? 'Bot' : seat.connected ? 'Joined' : 'Away'}</small></div>
      {isMe && <span className="fl-host">HOST</span>}
      {seat.robot && (
        <>
          <button type="button" className="fl-icon-btn" onClick={() => setEditing(seat.name)} aria-label={`Rename ${seat.name}`}><Icon d={I.pen} size={16} /></button>
          <button type="button" className="fl-icon-btn" onClick={() => send({ t: 'kick', seat: i, id: seat.id })} aria-label={`Remove ${seat.name}`}><Icon d={I.x} size={16} w={2} /></button>
        </>
      )}
      {!isMe && !seat.robot && (
        <button type="button" className={`fl-mini-btn${confirm ? ' warn' : ''}`} onClick={() => (confirm ? send({ t: 'kick', seat: i, id: seat.id }) : setConfirm(true))}>{confirm ? 'Tap again' : 'Remove'}</button>
      )}
    </div>
  );
}

// ---- A friend with the invite link ------------------------------------------------------------
function GuestJoin({ code, view, defaultName, defaultGem, onSit, onWatch }: Props & { onWatch: () => void }) {
  const [name, setName] = useState(defaultName);
  const takenBy: Partial<Record<Gem, string>> = {};
  view.seats.forEach(s => { takenBy[s.gem] = s.name; });
  const firstFree = GEMS.find(g => !takenBy[g]) ?? 'topaz';
  const [gem, setGem] = useState<Gem>(takenBy[defaultGem] ? firstFree : defaultGem);
  useEffect(() => { if (takenBy[gem]) setGem(firstFree); }, [view.seats.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [err, setErr] = useState('');
  const host = view.seats[view.host];
  const hostName = host?.name ?? 'Your friend';

  function sit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr('Type your name first.');
    onSit(name.trim(), gem);
  }

  return (
    <Page label="Take a seat">
      <div className="fl-top brand"><span className="brand">Charpati</span><a className="fl-link" href="/#play">How to play</a></div>
      <div className="fl-card">
        <div className="in center">
          <span className="kick"><Diamond />YOU’RE INVITED<Diamond /></span>
          <span className="title">{hostName}’s table</span>
          <div className="fl-stack">
            <span className="avs">{view.seats.map(s => <Av key={s.id} seat={s} size={32} />)}</span>
            <span>{view.seats.length} of {MAX_SEATS} seats taken</span>
          </div>
          <span className="url">Table {code}</span>
        </div>
      </div>
      <form onSubmit={sit} className="fl-form">
        <h1 className="fl-h1 sm">Take a seat</h1>
        <p className="fl-sub">Pick a name and a colour. {hostName} deals when everyone is in.</p>
        <label className="fl-caps fl-gap" htmlFor="guest-name">YOUR NAME</label>
        <input id="guest-name" className="fl-input" maxLength={12} autoComplete="nickname" value={name} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="e.g. Komal" />
        <span className="fl-caps fl-gap">YOUR COLOUR</span>
        <ColourPicker value={gem} onPick={setGem} takenBy={takenBy} />
        {err && <p className="fl-err" role="alert">{err}</p>}
        <button type="submit" className="btn big fl-cta">Take my seat</button>
        <button type="button" className="fl-textbtn" onClick={onWatch}>Just watch this game</button>
      </form>
    </Page>
  );
}

// ---- Seated and waiting for the host --------------------------------------------------------
function Waiting({ code, view, onLeave }: Props) {
  const me = view.seats[view.you!];
  const hostName = view.seats[view.host]?.name ?? 'The host';
  return (
    <Page label="Waiting for the deal">
      <div className="fl-top brand">
        <span className="brand">Charpati</span>
        <div className="end"><CodeChip code={code} /><button type="button" className="fl-pill-btn" onClick={onLeave}>Leave</button></div>
      </div>
      <div className="fl-hero">
        <span className="fl-me"><Av seat={me} size={72} glow /><span className="tick"><Icon d={I.check} size={15} w={3.2} /></span></span>
        <h1 className="fl-h1">You’re in, {me?.name}!</h1>
        <p className="fl-sub dots">Waiting for {hostName} to deal<i /><i /><i /></p>
      </div>
      <section className="fl-panel"><SeatsStrip seats={view.seats} you={view.you} host={view.host} /></section>
      <span className="fl-caps fl-gap">WHILE YOU WAIT</span>
      <Tips />
    </Page>
  );
}

function Watching({ code, view, onSeat }: Props & { onSeat?: () => void }) {
  const hostName = view.seats[view.host]?.name ?? 'The host';
  const full = view.seats.length >= MAX_SEATS;
  return (
    <Page label="Watching">
      <div className="fl-top brand"><span className="brand">Charpati</span><div className="end"><CodeChip code={code} /></div></div>
      <div className="fl-hero">
        <h1 className="fl-h1">{full ? 'This table is full' : 'You’re watching'}</h1>
        <p className="fl-sub dots">{hostName} will deal soon<i /><i /><i /></p>
      </div>
      <section className="fl-panel"><SeatsStrip seats={view.seats} you={null} host={view.host} /></section>
      {onSeat && <button type="button" className="btn big fl-cta" onClick={onSeat}>Take a seat instead</button>}
      {full && <a className="btn big ghost fl-cta" href="/play">Make your own table</a>}
      <span className="fl-caps fl-gap">WHILE YOU WAIT</span>
      <Tips />
    </Page>
  );
}
