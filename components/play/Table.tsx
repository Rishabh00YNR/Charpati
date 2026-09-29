'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { CardBack, CardFace, PowerCard, type PowerRank } from '@/components/Card';
import { POWERS, points, type Card, type Fx, type Move, type View } from '@/shared/engine';
import { GEM_COLOR } from '@/lib/rooms';
import { desktopLayout, hOf, phoneLayout, type Box, type Layout } from './layout';
import { Flights, useTableMotion } from './motion';

// A card at a spot on the table: a button when it can be tapped.
function At({ box, children, onTap, cls = '', label, style, lift = 0, hide = false, glow }: {
  box: Box; children: ReactNode; onTap?: () => void; cls?: string; label?: string; style?: CSSProperties; lift?: number; hide?: boolean; glow?: string;
}) {
  const s: CSSProperties = {
    left: box.x, top: box.y - lift, width: box.w, height: hOf(box), rotate: box.r ? `${box.r}deg` : undefined, borderRadius: box.w * 0.072,
    visibility: hide ? 'hidden' : undefined, ...(glow ? { ['--gc' as string]: glow } : null), ...style,
  };
  const c = `pl-c ${cls}${glow ? ' fxglow' : ''}`;
  return onTap
    ? <button type="button" className={c} style={s} onClick={onTap} aria-label={label}>{children}</button>
    : <div className={c} style={s} role={label ? 'img' : undefined} aria-label={label}>{children}</div>;
}
const face = (c: Card | null, w: number) => (c ? <CardFace rank={c.r} suit={c.s} w={w} /> : <CardBack w={w} />);
const isPow = (c: Card) => c.r in POWERS;

// The room's log is shared text; say "your" and "You" to the person it's about.
function personal(t: string, me: string | undefined) {
  if (!me) return t;
  const n = me.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = t.replace(new RegExp(`(^|\\s)${n}'s\\b`, 'g'), '$1your');
  if (new RegExp(`^${n} `).test(out)) {
    out = out
      .replace(new RegExp(`^${n} is `), 'You are ').replace(new RegExp(`^${n} was `), 'You were ')
      .replace(new RegExp(`^${n} goes `), 'You go ').replace(new RegExp(`^${n} `), 'You ')
      .replace(/\btheir (own )?card/g, 'your $1card').replace(/\bfor them\b/, 'for you');
  }
  return out;
}

export type TableProps = {
  code: string;
  view: View;
  send: (m: Move) => void;
  now: number; // the room's clock
  fx: { list: Fx[]; key: number };
  kind: Layout['kind'];
  onShare: () => void;
  onHostPanel: () => void;
};

export default function Table({ code, view, send, now, fx, kind, onShare, onHostPanel }: TableProps) {
  const { seats, phase, you, cur, step, peek } = view;
  const n = seats.length, base = you ?? 0, me = you !== null ? seats[you] : null;
  const myTurn = phase === 'play' && you === cur && !me?.bot;
  const hostName = seats[view.host]?.name ?? 'The host';
  const isHost = you !== null && you === view.host && phase !== 'closed';
  const L = useMemo(() => (kind === 'desktop' ? desktopLayout(n - 1) : phoneLayout(n - 1)), [kind, n]);
  const opp = useMemo(() => Array.from({ length: Math.max(0, n - 1) }, (_, k) => (base + 1 + k) % n), [n, base]);
  const gem = (s: number) => GEM_COLOR[seats[s]?.gem ?? 'topaz'];

  // What this player has picked on screen; cleared whenever the turn moves on.
  const [memSel, setMemSel] = useState<number | null>(null);
  const [mine, setMine] = useState<number | null>(null);
  const [other, setOther] = useState<[number, number] | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const turnKey = `${phase}:${cur}:${step}:${view.round}`;
  useEffect(() => { setMine(null); setOther(null); setTarget(null); setMemSel(null); }, [turnKey]);

  const cardBox = (s: number, i: number): Box | null => (s === base ? L.hand[i] : L.seats[opp.indexOf(s)]?.cards[i]) ?? null;
  const heldBox = (s: number): Box | null => (s === base ? L.mine : L.seats[opp.indexOf(s)]?.held) ?? null;
  const motion = useTableMotion({ view, fx, you, cardBox, heldBox, draw: L.draw, discard: L.discard, gem });
  const hidden = (k: string) => motion.hidden.has(k);

  const secsLeft = view.deadline ? Math.max(0, Math.ceil((view.deadline - now) / 1000)) : null;
  const ringLeft = view.deadline ? Math.min(1, Math.max(0, (view.deadline - now) / (view.timerSec * 1000))) : 0;
  const winners = new Set(view.winners ?? []);
  const nameOf = (p: number) => seats[p]?.name ?? '';
  const pickSeat = myTurn && (step === 'pQ' || (step === 'pJ' && !peek));
  const tapOthers = myTurn && step === 'p7';
  const last = view.log[view.log.length - 1];
  const lastMove = last ? personal(last.t, me?.name) : '';
  const lastGem = last && last.seat !== null && seats[last.seat] ? GEM_COLOR[seats[last.seat].gem] : 'var(--gold)';
  const desk = L.kind === 'desktop';

  const ring = (x: number, y: number, size: number) => (
    <span className={`pl-ring${secsLeft !== null && secsLeft <= 5 ? ' low' : ''}`} style={{ left: x, top: y, ['--rs' as string]: `${size + 14}px`, ['--left' as string]: ringLeft } as CSSProperties} />
  );

  // ---- The other players ----
  const seatEls = opp.map((p, k) => {
    const s = seats[p], spot = L.seats[k];
    if (!s || !spot) return null;
    const turn = phase === 'play' && cur === p;
    const peekHere = !!peek && peek.target === p && you === cur && phase === 'play';
    const matCls = ['pl-mat', turn ? 'turn' : '', peekHere ? 'peek' : '', pickSeat ? (target === p ? 'picked' : 'pick') : ''].join(' ');
    const matStyle = { left: spot.mat.x, top: spot.mat.y, width: spot.mat.w, height: spot.mat.h, ['--gem' as string]: gem(p) } as CSSProperties;
    const status = s.kicked ? ['REMOVED', 'away'] : s.bot ? ['BOT', 'bot'] : !s.connected ? ['AWAY', 'away'] : phase === 'memorize' && s.ready ? ['READY', ''] : null;
    const tagStyle: CSSProperties = desk
      ? (spot.name.side === 'right' ? { left: spot.name.x, top: spot.name.y + 14, transform: 'none' } : { left: spot.name.x, top: spot.name.y + 24 })
      : { left: spot.mat.x + spot.mat.w - 10, top: spot.mat.y + spot.mat.h / 2 - 8, transform: 'translateX(-100%)' };
    return (
      <div key={s.id}>
        {pickSeat
          ? <button type="button" className={matCls} style={matStyle} onClick={() => setTarget(target === p ? null : p)} aria-label={`Choose ${s.name}`} />
          : <div className={matCls} style={matStyle} />}
        {turn && view.deadline && !s.bot && ring(spot.av.x, spot.av.y, spot.av.s)}
        <div className={['pl-av', !s.connected && !s.bot ? 'away' : '', winners.has(p) ? 'win' : ''].join(' ')} style={{ left: spot.av.x, top: spot.av.y, ['--s' as string]: `${spot.av.s}px`, ['--gem' as string]: gem(p) } as CSSProperties} aria-hidden="true">
          {s.name[0]?.toUpperCase()}
          {winners.has(p) && <span className="pl-crown" />}
        </div>
        <span className={`pl-pill${spot.name.side === 'right' ? ' right' : ''}`} style={{ left: spot.name.x, top: spot.name.y - 9 }}>{s.name}</span>
        {status && <span className={`pl-tag ${status[1]}`} style={tagStyle}>{status[0]}</span>}
        {phase === 'end' && <span className={`pl-score${winners.has(p) ? ' best' : ''}`} style={{ left: spot.av.x + spot.av.s / 2 - 8, top: spot.av.y - spot.av.s / 2 - 8 }}>{s.total}</span>}
        {s.cards.map((c, i) => {
          const box = spot.cards[i], key = `${p}:${i}`;
          const sel = !!other && other[0] === p && other[1] === i;
          const onTap = tapOthers ? () => setOther(sel ? null : [p, i]) : pickSeat ? () => setTarget(target === p ? null : p) : undefined;
          return (
            <At key={i} box={box} cls={tapOthers ? (sel ? 'sel' : 'can') : ''} onTap={onTap} hide={hidden(key)} glow={motion.glows.get(key)} lift={sel ? 8 : 0}
              label={`${s.name}'s card ${i + 1}${c ? `: ${c.r}${c.s}` : ''}`}>
              {face(c, box.w)}
              {!c && <span className={`pl-pos${box.w < 56 ? ' xs' : ''}`}>{i + 1}</span>}
            </At>
          );
        })}
      </div>
    );
  });

  // ---- Your hand ----
  const hand = seats[base];
  const canArrange = phase === 'memorize' && you !== null && !me?.ready;
  const peekMine = !!peek && peek.target === base && you === cur && phase === 'play';
  const handEls = hand && hand.cards.map((c, i) => {
    const box = L.hand[i], key = `${base}:${i}`;
    const pickable = myTurn && (step === 'choose' || step === 'p7');
    const sel = canArrange ? memSel === i : pickable && mine === i;
    const onTap = canArrange
      ? () => { if (memSel === null) setMemSel(i); else if (memSel === i) setMemSel(null); else { send({ t: 'arrange', a: memSel, b: i }); setMemSel(null); } }
      : pickable ? () => setMine(mine === i ? null : i) : undefined;
    const changed = you !== null && motion.marks.has(i) && phase === 'play';
    return (
      <At key={i} box={box} cls={[onTap ? (sel ? 'sel' : 'can') : '', peekMine ? 'peekglow' : ''].join(' ')} onTap={onTap} lift={sel ? 14 : 0} hide={hidden(key)} glow={motion.glows.get(key)}
        label={`Your card ${i + 1}${c ? `: ${c.r}${c.s}` : ', face down'}${changed ? ', changed since you last saw it' : ''}`}>
        {face(c, box.w)}
        <span className="pl-pos">{i + 1}</span>
        {changed && <span className="pl-changed" aria-hidden="true">?</span>}
      </At>
    );
  });

  // ---- The middle of the table ----
  let center: ReactNode = null;
  if (phase === 'memorize') {
    center = (
      <div className="pl-center-box" style={{ left: L.center.x, top: L.center.y, width: L.center.w, height: L.center.h }}>
        <span className="count">{secsLeft ?? ''}</span>
        <span className="small">{me && !me.ready ? 'Memorise your four cards' : 'Waiting for everyone to memorise'}</span>
      </div>
    );
  } else if (phase === 'end') {
    const rows = seats.map(s => ({ name: s.name, sum: s.total ?? 0 }));
    const best = Math.min(...rows.map(r => r.sum));
    const top = rows.filter(r => r.sum === best);
    const rest = rows.filter(r => r.sum !== best).sort((a, b) => a.sum - b.sum).map(r => `${r.name} ${r.sum}`).join(' · ');
    center = view.endReason === 'abandoned'
      ? (
        <div className="pl-center-box banner" role="status" style={{ left: L.center.x, top: L.center.y, width: L.center.w, height: L.center.h }}>
          <b>Game ended</b>
          <span>Everyone left or stopped playing, so there’s no winner this time.</span>
        </div>
      ) : (
        <div className="pl-center-box banner" role="status" style={{ left: L.center.x, top: L.center.y, width: L.center.w, height: L.center.h }}>
          <b>{top.length === 1 ? `${personal(`${top[0].name} wins!`, me?.name).replace(/^You wins/, 'You win')}` : `${top.map(r => r.name).join(' & ')} tie!`}</b>
          <span>Lowest total: {best} point{best === 1 ? '' : 's'}</span>
          {rest && <small>{rest}</small>}
          {view.endReason === 'host' && <small>The host ended this game early.</small>}
        </div>
      );
  } else {
    const canDraw = myTurn && step === 'draw';
    const disc = hidden('discard') ? motion.under : view.discardTop;
    const dw = L.draw.w;
    center = (
      <>
        {view.deckCount > 2 && <At box={{ ...L.draw, x: L.draw.x + 6, y: L.draw.y + 6 }} style={{ opacity: 0.5 }}><CardBack w={dw} /></At>}
        {view.deckCount > 1 && <At box={{ ...L.draw, x: L.draw.x + 3, y: L.draw.y + 3 }} style={{ opacity: 0.8 }}><CardBack w={dw} /></At>}
        {view.deckCount > 0 && <At box={L.draw} cls={canDraw ? 'glow' : ''} onTap={canDraw ? () => send({ t: 'draw' }) : undefined} label={canDraw ? 'Draw a card' : 'Draw pile'}><CardBack w={dw} /></At>}
        <span className={`pl-label${canDraw ? ' hi' : ''}`} style={{ left: L.draw.x + dw / 2, top: L.pileLabelY }}>{view.deckCount} LEFT</span>
        {disc
          ? <At box={L.discard} glow={motion.glows.get('discard')} label={`Thrown away: ${disc.r}${disc.s}`}><CardFace rank={disc.r} suit={disc.s} w={L.discard.w} /></At>
          : <span className="pl-empty" style={{ left: L.discard.x, top: L.discard.y, width: L.discard.w, height: hOf(L.discard) }} />}
        <span className="pl-label" style={{ left: L.discard.x + L.discard.w / 2, top: L.pileLabelY }}>THROWN</span>
      </>
    );
  }

  // ---- The card being decided on: yours face up, anyone else's face down by their seat ----
  let held: ReactNode = null;
  if (phase === 'play' && view.hasDrawn && !hidden('held')) {
    const d = view.drawn;
    if (cur === you && d) {
      held = (
        <>
          <At box={L.mine} cls="held" label={`You drew the ${d.r}${d.s}`}>{isPow(d) ? <PowerCard rank={d.r as PowerRank} suit={d.s} w={L.mine.w} /> : <CardFace rank={d.r} suit={d.s} w={L.mine.w} />}</At>
          <span className="pl-label hi" style={{ left: L.mineLabel.x, top: L.mineLabel.y }}>{isPow(d) ? `${d.r} · ${POWERS[d.r as PowerRank].name.toUpperCase()}` : `YOU DREW · WORTH ${points(d)}`}</span>
        </>
      );
    } else {
      const spot = L.seats[opp.indexOf(cur)];
      const box = cur === base ? L.mine : spot?.held;
      if (box) {
        const lab = cur === base ? L.mineLabel : spot.heldLabel;
        held = (
          <>
            <At box={box} cls="held other" style={{ ['--gem' as string]: gem(cur) } as CSSProperties} label={`${nameOf(cur)} drew a card`}><CardBack w={box.w} /></At>
            <span className="pl-label hi" style={{ left: lab.x, top: lab.y }}>{desk ? 'DECIDING' : `${nameOf(cur).toUpperCase()} IS DECIDING`}</span>
          </>
        );
      }
    }
  }

  // ---- Your seat plate ----
  const plateChip = (() => {
    if (you === null) return <span className="pl-chip soft">WATCHING</span>;
    if (phase === 'end') return <span className={`pl-score${winners.has(base) ? ' best' : ''}`} style={{ position: 'relative' }}>{me?.total}</span>;
    if (phase === 'memorize') return <span className={`pl-chip${me?.ready ? '' : ' soft'}`}>{me?.ready ? 'READY' : 'MEMORISE'}</span>;
    if (me?.bot) return <span className="pl-chip soft">BOT PLAYING</span>;
    if (myTurn) return <span className={`pl-chip${secsLeft !== null && secsLeft <= 5 ? ' low' : ''}`}>YOUR TURN {secsLeft !== null ? `· ${secsLeft}s` : ''}</span>;
    return <span className="pl-chip soft">WAITING</span>;
  })();
  const plate = hand && (
    <div className="pl-plate" style={{ left: L.plate.x, top: L.plate.y, width: L.plate.w }}>
      <span className="pl-av-wrap">
        {myTurn && view.deadline && ring(18, 18, 36)}
        <span className={`pl-av${winners.has(base) ? ' win' : ''}`} style={{ ['--gem' as string]: gem(base) } as CSSProperties}>{hand.name[0]?.toUpperCase()}{winners.has(base) && <span className="pl-crown" />}</span>
      </span>
      <span className="nm">{you === null ? `${hand.name}’s seat` : hand.name}</span>
      {plateChip}
    </div>
  );

  // ---- What to do now ----
  const B = (text: string, onClick: () => void, opts: { ghost?: boolean; off?: boolean } = {}) =>
    <button type="button" className={`btn${opts.ghost ? ' ghost' : ''}`} onClick={onClick} disabled={opts.off}>{text}</button>;
  let tag = '', msg: ReactNode = '', soft = false, btns: ReactNode = null, sub = '';
  if (you === null) {
    msg = 'This game has already started. You’re watching.';
    soft = true;
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
    if (isHost) { btns = B('Play again', () => send({ t: 'rematch' })); msg = 'Same room, same seats, a fresh deal.'; soft = true; }
    else { msg = `Waiting for ${hostName} to start a rematch.`; soft = true; }
  } else if (me?.bot) {
    msg = 'You missed a few turns, so a bot is playing for you.';
    btns = B('Take my seat back', () => send({ t: 'takeBack' }));
  } else if (!myTurn) {
    msg = view.hasDrawn ? `${nameOf(cur)} drew a card and is deciding…` : `${nameOf(cur)}’s turn.`;
    soft = true;
    sub = lastMove;
  } else if (step === 'draw') {
    msg = 'Your turn! Tap the glowing pile to draw. Only you see the card.';
    btns = B('Draw a card', () => send({ t: 'draw' }));
  } else if (step === 'choose' && view.drawn) {
    msg = <>You drew <b>{view.drawn.r}{view.drawn.s}</b>, worth {points(view.drawn)}. Tap one of your cards to swap it in, or throw this one away.</>;
    btns = <>{B(mine === null ? 'Swap it in' : `Swap with card ${mine + 1}`, () => mine !== null && send({ t: 'place', i: mine }), { off: mine === null })}{B('Throw it away', () => send({ t: 'throw' }), { ghost: true })}</>;
  } else if (step === 'p7') {
    msg = <><b>Use your 7:</b> {mine === null ? 'tap one of your cards first.' : !other ? 'now tap one card of another player.' : `your card ${mine + 1} and ${nameOf(other[0])}'s card ${other[1] + 1}. Nobody looks.`}</>;
    btns = B('Swap the two cards', () => mine !== null && other && send({ t: 'swap7', mine, seat: other[0], i: other[1] }), { off: mine === null || !other });
  } else if (step === 'pK') {
    msg = <><b>Use your K:</b> {peek ? 'these are your cards. You can’t move them, so remember them.' : 'look at all four of your cards.'}</>;
    btns = peek ? B('Done, hide them', () => send({ t: 'done' })) : B('Show my cards', () => send({ t: 'look' }));
  } else if (step === 'pQ') {
    msg = <><b>Use your Q:</b> {target === null ? 'tap a player to mix up their cards.' : `${nameOf(target)} won’t know which card is where.`}</>;
    btns = B(target === null ? 'Shuffle' : `Shuffle ${nameOf(target)}'s cards`, () => target !== null && send({ t: 'shuffleQ', seat: target }), { off: target === null });
  } else if (step === 'pJ') {
    msg = <><b>Use your J:</b> {peek ? `only you can see ${nameOf(peek.target)}’s cards. Remember what you can.` : target === null ? 'tap a player to see their cards.' : `only you will see ${nameOf(target)}'s cards.`}</>;
    btns = peek ? B('Done, hide them', () => send({ t: 'done' })) : B(target === null ? 'Look' : `Look at ${nameOf(target)}'s cards`, () => target !== null && send({ t: 'peekJ', seat: target }), { off: target === null });
  }
  const showTicker = !!L.ticker && !!lastMove && phase === 'play';
  if (showTicker) sub = '';

  if (phase === 'closed') {
    return (
      <div className={`pl-table k-${L.kind}`}>
        <div className="pl-felt" style={{ left: L.felt.x, top: L.felt.y, width: L.felt.w, height: L.felt.h, borderRadius: L.felt.radius, ['--rin' as string]: `${Math.max(8, L.felt.radius - 16)}px` } as CSSProperties} />
        <div className="pl-center-box banner" role="status" style={{ left: L.center.x, top: L.center.y, width: L.center.w, height: L.center.h }}>
          <b>Room closed</b>
          <span>Nobody played for 30 minutes, so this room closed.</span>
        </div>
        <div className="pl-btns" style={{ top: L.btnsY }}><a className="btn" href="/play">Make a new table</a></div>
      </div>
    );
  }

  return (
    <div className={`pl-table k-${L.kind}`}>
      <div className="pl-top">
        <span className="brand">Charpati</span>
        {desk && showTicker && (
          <div className="pl-ticker top" role="status"><i style={{ ['--gem' as string]: lastGem } as CSSProperties} /><span>{lastMove}</span></div>
        )}
        <div className="pl-top-right">
          {isHost && <button type="button" className="pl-host-btn" onClick={onHostPanel} aria-label="Host controls">HOST</button>}
          <button type="button" className="pl-code" onClick={onShare} aria-label={`Room ${code}. Share the invite`}><small>ROOM</small>{code}</button>
        </div>
      </div>

      <div className="pl-felt" style={{ left: L.felt.x, top: L.felt.y, width: L.felt.w, height: L.felt.h, borderRadius: L.felt.radius, ['--rin' as string]: `${Math.max(8, L.felt.radius - 16)}px` } as CSSProperties} />
      {!desk && showTicker && L.ticker && (
        <div className="pl-ticker" role="status" style={{ left: L.ticker.x, top: L.ticker.y, width: L.ticker.w }}><i style={{ ['--gem' as string]: lastGem } as CSSProperties} /><span>{lastMove}</span></div>
      )}
      {seatEls}
      {center}
      {handEls}
      {held}
      <Flights flights={motion.flights} landed={motion.landed} />
      {motion.stamp && <div key={motion.stamp.key} className="pl-stamp" style={{ top: L.stampY }} aria-hidden="true">{motion.stamp.text}</div>}
      {view.pausedUntil && <div className="pl-status" role="status">PAUSED</div>}
      {plate}
      <div className="pl-bar" style={{ top: L.barY }} aria-live="polite">
        {tag && <span className="ptag">{tag}</span>}
        <p className={soft ? 'soft' : ''}>{msg}</p>
        {sub && <small className="sub">{sub}</small>}
      </div>
      {btns && <div className="pl-btns" style={{ top: L.btnsY }}>{btns}</div>}
    </div>
  );
}
