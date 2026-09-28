'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { CardBack, CardFace, PowerCard, type PowerRank } from '@/components/Card';
import { GEMS, MIN_SEATS, POWERS, TIMER, points, type Card, type Fx, type Move, type View } from '@/shared/engine';
import { GEM_COLOR } from '@/lib/rooms';

// ---- Layout on the 390 x 844 stage (the same as the pass-and-play game) ----------------------
type Slot = 'B' | 'L' | 'TL' | 'T' | 'TR' | 'R';
const SLOTS: Record<number, Slot[]> = { 3: ['B', 'TL', 'TR'], 4: ['B', 'L', 'T', 'R'], 5: ['B', 'L', 'TL', 'TR', 'R'] };
const LOBBY_SLOTS: Slot[] = ['B', 'L', 'TL', 'TR', 'R']; // seats fill up in this order while people join
const SEATS: Record<Exclude<Slot, 'B'>, { ax: number; ay: number; gx: number; gy: number; side?: boolean }> = {
  L: { ax: 40, ay: 300, gx: 72, gy: 265, side: true },
  TL: { ax: 118, ay: 95, gx: 89, gy: 142 },
  T: { ax: 195, ay: 95, gx: 166, gy: 142 },
  TR: { ax: 272, ay: 95, gx: 243, gy: 142 },
  R: { ax: 350, ay: 300, gx: 259, gy: 265, side: true },
};
const HANDPOS = [{ x: 63, y: 452, r: -7 }, { x: 131, y: 444, r: -2.5 }, { x: 199, y: 444, r: 2.5 }, { x: 267, y: 452, r: 7 }];
type Rect = { x: number; y: number; w: number; r?: number };
const DRAW: Rect = { x: 134, y: 326, w: 54 };
const DISC: Rect = { x: 204, y: 326, w: 54, r: 6 };
const PILE_LABEL_Y = DRAW.y + 84; // just under the piles, clear of your hand below
const SPOT: Rect = { x: 125, y: 236, w: 140, r: -4 };
const SPOT_SM: Rect = { x: 143, y: 261, w: 104, r: -3 }; // smaller while picking cards for a 7, so side seats stay visible
const mini = (s: { gx: number; gy: number }, i: number): Rect => ({ x: s.gx + (i % 2) * 31, y: s.gy + Math.floor(i / 2) * 42, w: 28 });

// A card at a spot on the table: a button when it can be tapped.
function At({ rect, children, onTap, cls = '', label, style }: { rect: Rect; children: ReactNode; onTap?: () => void; cls?: string; label?: string; style?: CSSProperties }) {
  const s: CSSProperties = { left: rect.x, top: rect.y, width: rect.w, height: rect.w * 1.4, rotate: rect.r ? `${rect.r}deg` : undefined, borderRadius: rect.w * 0.072, ...style };
  return onTap
    ? <button type="button" className={`pl-c ${cls}`} style={s} onClick={onTap} aria-label={label}>{children}</button>
    : <div className={`pl-c ${cls}`} style={s} role={label ? 'img' : undefined} aria-label={label}>{children}</div>;
}
const face = (c: Card | null, w: number) => (c ? <CardFace rank={c.r} suit={c.s} w={w} /> : <CardBack w={w} />);

export type TableProps = {
  code: string;
  view: View;
  send: (m: Move) => void;
  now: number; // the room's clock
  fx: { list: Fx[]; key: number };
  onShare: () => void;
  onLeave: () => void;
};

export default function Table({ code, view, send, now, fx, onShare, onLeave }: TableProps) {
  const { seats, phase, you, cur, step, peek } = view;
  const n = seats.length, base = you ?? 0, me = you !== null ? seats[you] : null;
  const myTurn = phase === 'play' && you === cur && !me?.bot;
  const hostName = seats[view.host]?.name ?? 'The host';
  const isHost = you !== null && you === view.host;

  // What this player has picked on screen; cleared whenever the turn moves on.
  const [memSel, setMemSel] = useState<number | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [other, setOther] = useState<[number, number] | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const turnKey = `${phase}:${cur}:${step}:${view.round}`;
  useEffect(() => { setMine(null); setOther(null); setTarget(null); setMemSel(null); }, [turnKey]);

  // Short-lived highlights for what just happened (a swap, a shuffle, a power card).
  const [flash, setFlash] = useState<{ cards: Set<string>; shuffled: number | null; stamp: string | null }>({ cards: new Set(), shuffled: null, stamp: null });
  useEffect(() => {
    if (!fx.list.length) return;
    const cards = new Set<string>();
    let shuffled: number | null = null, stamp: string | null = null;
    for (const f of fx.list) {
      if (f.k === 'place') cards.add(`${f.seat}:${f.i}`);
      if (f.k === 'swap') { cards.add(f.a.join(':')); cards.add(f.b.join(':')); }
      if (f.k === 'shuffle') shuffled = f.seat;
      if (f.k === 'power') stamp = `${POWERS[f.r].name}!`;
    }
    setFlash({ cards, shuffled, stamp });
    const t = setTimeout(() => setFlash({ cards: new Set(), shuffled: null, stamp: null }), 2300);
    return () => clearTimeout(t);
  }, [fx.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const slotOf = (p: number): Slot => (phase === 'lobby' || !SLOTS[n] ? LOBBY_SLOTS : SLOTS[n])[(p - base + n) % n];
  const secsLeft = view.deadline ? Math.max(0, Math.ceil((view.deadline - now) / 1000)) : null;
  const winners = new Set(view.winners ?? []);
  const nameOf = (p: number) => seats[p]?.name ?? '';

  const pickSeat = myTurn && (step === 'pQ' || (step === 'pJ' && !peek));
  const tapOthers = myTurn && step === 'p7';

  // ---- Other players around the rail ----
  const others = useMemo(() => seats.map((_, p) => p).filter(p => p !== base), [seats, base]);
  const seatEls = others.map(p => {
    const s = seats[p], slot = slotOf(p);
    if (slot === 'B') return null;
    const pos = SEATS[slot];
    const tag = (text: string, cls = '') =>
      pos.side ? <span className={`pl-tag ${cls}`} style={{ left: pos.ax, top: pos.ay + 47 }}>{text}</span>
        : <span className={`pl-tag ${cls}`} style={{ left: pos.ax + 48, top: pos.ay - 9 }}>{text}</span>;
    const turn = phase === 'play' && cur === p;
    const avCls = ['pl-av', !s.connected && !s.bot ? 'away' : '', pickSeat ? (target === p ? 'picked' : 'pick') : '', winners.has(p) ? 'win' : ''].join(' ');
    const avStyle = { left: pos.ax, top: pos.ay, ['--gem' as string]: GEM_COLOR[s.gem] } as CSSProperties;
    return (
      <div key={s.id}>
        {turn && view.deadline && secsLeft !== null && !s.bot && (
          <span className={`pl-ring${secsLeft <= 5 ? ' low' : ''}`} style={{ left: pos.ax, top: pos.ay, ['--left' as string]: Math.min(1, (view.deadline - now) / (view.timerSec * 1000)) } as CSSProperties} />
        )}
        {pickSeat
          ? <button type="button" className={avCls} style={avStyle} onClick={() => setTarget(target === p ? null : p)} aria-label={`Choose ${s.name}`}>{s.name[0]?.toUpperCase()}</button>
          : <div className={avCls} style={avStyle} aria-hidden="true">{s.name[0]?.toUpperCase()}{winners.has(p) && <span className="pl-crown" />}</div>}
        <span className="pl-pill" style={{ left: pos.ax, top: pos.ay + 27 }}>{s.name}</span>
        {phase === 'lobby' && p === view.host && tag('HOST')}
        {s.bot && phase !== 'lobby' && tag('BOT', 'bot')}
        {!s.bot && !s.connected && tag('AWAY', 'away')}
        {phase === 'memorize' && s.ready && s.connected && !s.bot && tag('READY')}
        {phase === 'end' && <span className={`pl-score${winners.has(p) ? ' best' : ''}`} style={{ left: pos.ax + 18, top: pos.ay + 7 }}>{s.total}</span>}
        {phase !== 'lobby' && s.cards.map((c, i) => {
          const r = mini(pos, i), sel = !!other && other[0] === p && other[1] === i;
          const cls = [tapOthers ? (sel ? 'sel' : 'can') : '', flash.cards.has(`${p}:${i}`) ? 'flash' : '', flash.shuffled === p ? 'riffle' : ''].join(' ');
          const riffle = flash.shuffled === p ? { ['--dx' as string]: `${i % 2 ? -15 : 15}px`, ['--dy' as string]: `${i < 2 ? 21 : -21}px`, ['--rt' as string]: `${i % 2 ? 12 : -12}deg` } as CSSProperties : undefined;
          const onTap = tapOthers ? () => setOther(sel ? null : [p, i]) : pickSeat ? () => setTarget(target === p ? null : p) : undefined;
          return (
            <At key={i} rect={r} cls={cls} onTap={onTap} label={`${s.name}'s card ${i + 1}${c ? `: ${c.r}${c.s}` : ''}`} style={riffle}>
              {face(c, 28)}
              {!c && <span className="pl-pos xs">{i + 1}</span>}
            </At>
          );
        })}
      </div>
    );
  });

  // ---- Your hand at the bottom ----
  const hand = seats[base];
  const canArrange = phase === 'memorize' && you !== null && !me?.ready;
  const handEls = phase === 'lobby' || !hand ? null : hand.cards.map((c, i) => {
    const h = HANDPOS[i];
    const pickable = myTurn && (step === 'choose' || step === 'p7');
    const sel = canArrange ? memSel === i : pickable && mine === i;
    const onTap = canArrange
      ? () => { if (memSel === null) setMemSel(i); else if (memSel === i) setMemSel(null); else { send({ t: 'arrange', a: memSel, b: i }); setMemSel(null); } }
      : pickable ? () => setMine(mine === i ? null : i) : undefined;
    const cls = [onTap ? (sel ? 'sel' : 'can') : '', flash.cards.has(`${base}:${i}`) ? 'flash' : '', flash.shuffled === base ? 'riffle' : ''].join(' ');
    return (
      <At key={i} rect={{ x: h.x, y: h.y - (sel ? 14 : 0), w: 60, r: h.r }} cls={cls} onTap={onTap} label={`Your card ${i + 1}${c ? `: ${c.r}${c.s}` : ', face down'}`}>
        {face(c, 60)}
        <span className="pl-pos">{i + 1}</span>
      </At>
    );
  });

  // ---- The middle of the table ----
  let center: ReactNode = null;
  if (phase === 'lobby') {
    center = (
      <div className="pl-center" style={{ top: 300 }}>
        <span className="small">ROOM CODE</span>
        <button type="button" className="big" onClick={onShare} style={{ background: 'none', border: 0, cursor: 'pointer' }} aria-label={`Room code ${code}. Tap to share it.`}>{code}</button>
        <span className="small">{n} of 5 seated. Share the code with your friends.</span>
      </div>
    );
  } else if (phase === 'memorize') {
    center = (
      <div className="pl-center" style={{ top: 330 }}>
        <span className="count">{secsLeft ?? ''}</span>
        <span className="small">{me && !me.ready ? 'Memorise your four cards' : 'Waiting for everyone to memorise'}</span>
      </div>
    );
  } else if (phase === 'end' && view.endReason === 'abandoned') {
    center = (
      <div className="pl-banner" role="status">
        <b>Game ended</b>
        <span>Everyone left or stopped playing, so there’s no winner this time.</span>
      </div>
    );
  } else if (phase === 'end') {
    const rows = seats.map(s => ({ name: s.name, sum: s.total ?? 0 }));
    const best = Math.min(...rows.map(r => r.sum));
    const top = rows.filter(r => r.sum === best);
    const rest = rows.filter(r => r.sum !== best).sort((a, b) => a.sum - b.sum).map(r => `${r.name} ${r.sum}`).join(' · ');
    center = (
      <div className="pl-banner" role="status">
        <b>{top.length === 1 ? `${top[0].name} wins!` : `${top.map(r => r.name).join(' & ')} tie!`}</b>
        <span>Lowest total: {best} point{best === 1 ? '' : 's'}</span>
        {rest && <small>{rest}</small>}
      </div>
    );
  } else if (myTurn && step === 'pJ' && peek) {
    const t = seats[peek.target];
    center = (
      <div className="pl-peek" role="region" aria-label={`${t.name}'s cards`}>
        <h3>{t.name}’s cards</h3>
        {t.cards.map((c, i) => <At key={i} rect={{ x: 32 + i * 66, y: 50, w: 56 }} label={`Card ${i + 1}`}>{face(c, 56)}<span className="pl-pos">{i + 1}</span></At>)}
        <p>Only you can see these.</p>
      </div>
    );
  } else if (view.hasDrawn) {
    const d = view.drawn;
    const isPow = !!d && d.r in POWERS;
    const rect = step === 'p7' ? SPOT_SM : SPOT;
    center = (
      <>
        {isPow && <div className="pl-rays" />}
        {d
          ? <At rect={rect} label={`You drew the ${d.r}${d.s}`} style={{ filter: 'drop-shadow(0 0 26px rgba(230,195,111,.45))' }}>
              {isPow ? <PowerCard rank={d.r as PowerRank} suit={d.s} w={rect.w} /> : <CardFace rank={d.r} suit={d.s} w={rect.w} />}
            </At>
          : <>
              <At rect={{ x: 168, y: 300, w: 54 }} label={`${nameOf(cur)} drew a card`}><CardBack w={54} /></At>
              <span className="pl-label hi" style={{ left: 195, top: 385 }}>{nameOf(cur).toUpperCase()} IS DECIDING</span>
            </>}
      </>
    );
  } else {
    const canDraw = myTurn && step === 'draw';
    const last = view.log[view.log.length - 1];
    center = (
      <>
        {view.deckCount > 2 && <At rect={{ ...DRAW, x: DRAW.x + 6, y: DRAW.y + 6 }} style={{ opacity: 0.5 }}><CardBack w={54} /></At>}
        {view.deckCount > 1 && <At rect={{ ...DRAW, x: DRAW.x + 3, y: DRAW.y + 3 }} style={{ opacity: 0.8 }}><CardBack w={54} /></At>}
        {view.deckCount > 0 && <At rect={DRAW} cls={canDraw ? 'glow' : ''} onTap={canDraw ? () => send({ t: 'draw' }) : undefined} label={canDraw ? 'Draw a card' : 'Draw pile'}><CardBack w={54} /></At>}
        <span className={`pl-label${canDraw ? ' hi' : ''}`} style={{ left: DRAW.x + 27, top: PILE_LABEL_Y }}>{view.deckCount} LEFT</span>
        {view.discardTop ? <At rect={DISC} label={`Thrown away: ${view.discardTop.r}${view.discardTop.s}`}><CardFace rank={view.discardTop.r} suit={view.discardTop.s} w={54} /></At>
          : <span className="pl-empty" style={{ left: DISC.x, top: DISC.y, width: 54, height: 76 }} />}
        <span className="pl-label" style={{ left: DISC.x + 27, top: PILE_LABEL_Y }}>THROWN</span>
        {last && (
          <div className="pl-ticker" role="status">
            <i style={{ ['--gem' as string]: last.seat !== null && seats[last.seat] ? GEM_COLOR[seats[last.seat].gem] : 'var(--gold)' } as CSSProperties} />
            <span>{last.t}</span>
          </div>
        )}
      </>
    );
  }

  // ---- Your seat plate ----
  const plateChip = (() => {
    if (you === null) return <span className="pl-chip soft">WATCHING</span>;
    if (phase === 'end') return <span className={`pl-score${winners.has(base) ? ' best' : ''}`} style={{ position: 'relative' }}>{me?.total}</span>;
    if (phase === 'lobby') return <span className="pl-chip soft">{isHost ? 'HOST' : 'SEATED'}</span>;
    if (phase === 'memorize') return <span className={`pl-chip${me?.ready ? '' : ' soft'}`}>{me?.ready ? 'READY' : 'MEMORISE'}</span>;
    if (me?.bot) return <span className="pl-chip soft">BOT PLAYING</span>;
    if (myTurn) return <span className={`pl-chip${secsLeft !== null && secsLeft <= 5 ? ' low' : ''}`}>YOUR TURN {secsLeft !== null ? `· ${secsLeft}s` : ''}</span>;
    return <span className="pl-chip soft">WAITING</span>;
  })();
  const plate = hand && (
    <div className="pl-plate">
      <span className={`pl-av${winners.has(base) ? ' win' : ''}`} style={{ ['--gem' as string]: GEM_COLOR[hand.gem] } as CSSProperties}>{hand.name[0]?.toUpperCase()}{winners.has(base) && <span className="pl-crown" />}</span>
      <span className="nm">{hand.name}</span>
      {plateChip}
    </div>
  );

  // ---- What to do now ----
  const B = (text: string, onClick: () => void, opts: { ghost?: boolean; off?: boolean } = {}) =>
    <button type="button" className={`btn${opts.ghost ? ' ghost' : ''}`} onClick={onClick} disabled={opts.off}>{text}</button>;
  const timerStepper = (
    <div className="pl-stepper">
      Turn timer
      <button type="button" onClick={() => send({ t: 'timer', sec: view.timerSec - TIMER.step })} disabled={view.timerSec <= TIMER.min} aria-label="Less time">−</button>
      <b>{view.timerSec}s</b>
      <button type="button" onClick={() => send({ t: 'timer', sec: view.timerSec + TIMER.step })} disabled={view.timerSec >= TIMER.max} aria-label="More time">+</button>
    </div>
  );
  let tag = '', msg: ReactNode = '', soft = false, extra: ReactNode = null, btns: ReactNode = null;
  if (you === null) {
    msg = phase === 'lobby' ? 'This table is full. You’re watching.' : 'This game has already started. You’re watching.';
    soft = true;
  } else if (phase === 'lobby') {
    extra = (
      <div className="pl-gems" aria-label="Your colour">
        {GEMS.map(g => {
          const taken = seats.some((s, i) => i !== you && s.gem === g);
          return <button key={g} type="button" className={`pl-gem${me?.gem === g ? ' on' : ''}`} style={{ ['--gem' as string]: GEM_COLOR[g] } as CSSProperties} disabled={taken} onClick={() => send({ t: 'gem', gem: g })} aria-label={g} aria-pressed={me?.gem === g} />;
        })}
      </div>
    );
    if (isHost) {
      msg = n < MIN_SEATS ? `Waiting for friends: you need at least ${MIN_SEATS} players.` : 'Everyone here? Start when you’re ready.';
      extra = <>{extra}{timerStepper}</>;
      btns = <>{B('Share invite', onShare, { ghost: true })}{B('Start the game', () => send({ t: 'start' }), { off: n < MIN_SEATS })}</>;
    } else {
      msg = `Waiting for ${hostName} to start. Turn timer: ${view.timerSec}s.`;
      soft = true;
      btns = <>{B('Leave table', onLeave, { ghost: true })}{B('Share invite', onShare)}</>;
    }
  } else if (view.pausedUntil) {
    // Only people who aren't really playing (a bot has their seat) can be here while it's paused.
    const left = Math.max(0, Math.ceil((view.pausedUntil - now) / 1000));
    msg = `Paused: nobody is playing. The game ends in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} unless someone comes back.`;
    soft = true;
    if (me?.bot) btns = B('Take my seat back', () => send({ t: 'takeBack' }));
  } else if (phase === 'memorize') {
    if (!me?.ready) { msg = 'Tap two cards to swap their places, then remember them.'; btns = B('I’ve got them, hide my cards', () => send({ t: 'ready' })); }
    else { msg = 'Waiting for everyone to memorise…'; soft = true; }
  } else if (phase === 'end') {
    if (isHost) { extra = timerStepper; btns = B('Play again', () => send({ t: 'rematch' })); msg = 'Same room, same seats, a fresh deal.'; soft = true; }
    else { msg = `Waiting for ${hostName} to start a rematch.`; soft = true; }
  } else if (me?.bot) {
    msg = 'You missed a few turns, so a bot is playing for you.';
    btns = B('Take my seat back', () => send({ t: 'takeBack' }));
  } else if (!myTurn) {
    msg = view.hasDrawn ? `${nameOf(cur)} drew a card and is deciding…` : `${nameOf(cur)}’s turn.`;
    soft = true;
  } else if (step === 'draw') {
    msg = 'Your turn! Tap the glowing pile to draw. Only you see the card.';
    btns = B('Draw a card', () => send({ t: 'draw' }));
  } else if (step === 'choose' && view.drawn) {
    msg = <>You drew <b>{view.drawn.r}{view.drawn.s}</b>, worth {points(view.drawn)}. Tap one of your cards to swap it in, or throw this one away.</>;
    btns = <>{B(mine === null ? 'Swap it in' : `Swap with card ${mine + 1}`, () => mine !== null && send({ t: 'place', i: mine }), { off: mine === null })}{B('Throw it away', () => send({ t: 'throw' }), { ghost: true })}</>;
  } else if (step === 'p7') {
    tag = '7 · SWAP · YOU MUST USE IT';
    msg = mine === null ? 'Tap one of your cards first.' : !other ? 'Now tap one card of another player.' : `Your card ${mine + 1} and ${nameOf(other[0])}'s card ${other[1] + 1}. Nobody looks.`;
    btns = B('Swap the two cards', () => mine !== null && other && send({ t: 'swap7', mine, seat: other[0], i: other[1] }), { off: mine === null || !other });
  } else if (step === 'pK') {
    tag = 'K · LOOK · YOU MUST USE IT';
    msg = peek ? 'These are your cards. You can’t move them, so remember them.' : 'You get to look at all four of your cards.';
    btns = peek ? B('Done, hide them', () => send({ t: 'done' })) : B('Show my cards', () => send({ t: 'look' }));
  } else if (step === 'pQ') {
    tag = 'Q · SHUFFLE · YOU MUST USE IT';
    msg = target === null ? 'Tap a player to mix up their cards.' : `${nameOf(target)} won’t know which card is where.`;
    btns = B(target === null ? 'Shuffle' : `Shuffle ${nameOf(target)}'s cards`, () => target !== null && send({ t: 'shuffleQ', seat: target }), { off: target === null });
  } else if (step === 'pJ') {
    tag = 'J · PEEK · YOU MUST USE IT';
    msg = peek ? 'Remember what you can, then hide them.' : target === null ? 'Tap a player to see their cards.' : `Only you will see ${nameOf(target)}'s cards.`;
    btns = peek ? B('Done, hide them', () => send({ t: 'done' })) : B(target === null ? 'Look' : `Look at ${nameOf(target)}'s cards`, () => target !== null && send({ t: 'peekJ', seat: target }), { off: target === null });
  }

  if (phase === 'closed') {
    return (
      <>
        <div className="pl-felt" />
        <div className="pl-center" style={{ top: 320 }} role="status">
          <span className="big" style={{ fontSize: 32, letterSpacing: '.02em' }}>Room closed</span>
          <span className="small">Nobody played for 30 minutes, so this room closed.</span>
        </div>
        <div className="pl-btns"><a className="btn" href="/play">Create a new room</a></div>
      </>
    );
  }

  return (
    <>
      <div className="pl-felt" />
      {seatEls}
      {view.pausedUntil && <div className="pl-status" role="status">PAUSED</div>}
      {center}
      {handEls}
      {phase === 'lobby' && extra && <div className="pl-extra" style={{ top: 412 }}>{extra}</div>}
      {plate}
      {flash.stamp && <div className="pl-stamp" aria-hidden="true">{flash.stamp}</div>}
      <div className="pl-bar" aria-live="polite">
        {tag && <span className="ptag">{tag}</span>}
        <p className={soft ? 'soft' : ''}>{msg}</p>
        {phase !== 'lobby' && extra}
      </div>
      {btns && <div className="pl-btns">{btns}</div>}
    </>
  );
}
