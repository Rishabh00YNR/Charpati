'use client';

// Card movement on the table. The room sends a short list of what just happened (fx) with each
// update; here each one becomes cards flying from where they were to where they are now, so
// everyone can follow a swap, a shuffle or a card going onto the pile. While a card is in the air
// the real card at its destination stays hidden, and it glows for a moment once it lands.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CardBack, CardFace, PowerCard, type PowerRank } from '@/components/Card';
import { POWERS, type Card, type Fx, type View } from '@/shared/engine';
import { hOf, type Box } from './layout';

export type Face = { back: true } | { card: Card; art?: boolean }; // art: draw a power card with its picture
const BACK: Face = { back: true };
const faceOf = (c: Card | null | undefined, art = false): Face => (c ? { card: c, art } : BACK);
const isPowerCard = (c: Card) => c.r === '7' || c.r === 'J' || c.r === 'Q' || c.r === 'K';

export function faceEl(f: Face, w: number) {
  if ('back' in f) return <CardBack w={w} />;
  return f.art && isPowerCard(f.card)
    ? <PowerCard rank={f.card.r as PowerRank} suit={f.card.s} w={w} />
    : <CardFace rank={f.card.r} suit={f.card.s} w={w} />;
}

export type Flight = {
  id: number;
  from: Box;
  to: Box;
  a: Face; // what the card shows as it leaves
  b?: Face; // what it shows after flipping over on the way
  delay: number;
  dur: number;
  arc: number; // how far it swings to one side, in px
  gather?: { x: number; y: number }; // a shuffle: the cards bunch up here first
  hide: string[]; // real cards kept hidden until this one lands
  glow?: { key: string; color: string };
};

type Ctx = {
  view: View;
  fx: { list: Fx[]; key: number };
  you: number | null;
  cardBox: (seat: number, i: number) => Box | null;
  heldBox: (seat: number) => Box | null;
  draw: Box;
  discard: Box;
  gem: (seat: number) => string;
};

const GLOW_MS = 2600;

export function useTableMotion(ctx: Ctx) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [hidden, setHidden] = useState<Map<string, number>>(() => new Map());
  const [glows, setGlows] = useState<Map<string, string>>(() => new Map());
  const [under, setUnder] = useState<Card | null>(null); // the pile's previous top card, while a card flies onto it
  const [stamp, setStamp] = useState<{ text: string; key: number } | null>(null);
  const [marks, setMarks] = useState<Map<number, number>>(() => new Map()); // your changed cards -> when they changed
  const prev = useRef<View | null>(null);
  const nextId = useRef(1);
  const myTurns = useRef(0); // how many of your turns have started
  const lastCur = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const addGlow = useCallback((key: string, color: string) => {
    setGlows(g => new Map(g).set(key, color));
    later(GLOW_MS, () => setGlows(g => { const n = new Map(g); n.delete(key); return n; }));
  }, []);

  // Plan the flights for a new batch of fx. Runs before the browser paints, so the real cards are
  // hidden before anyone sees them jump.
  useLayoutEffect(() => {
    const { view, fx, you, cardBox, heldBox, draw, discard, gem } = ctx;
    const before = prev.current;
    if (!fx.list.length) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const plan: Flight[] = [];
    const add = (f: Omit<Flight, 'id'>) => plan.push({ ...f, id: nextId.current++ });
    let seq = 0; // later moves in the same batch wait for the earlier ones
    let stampText: string | null = null, stampDelay = 0, buzz = false;
    const marked: number[] = [], unmarked: number[] = [];
    let resetMarks = false;
    const mover = before?.cur ?? view.cur;

    for (const f of fx.list) {
      switch (f.k) {
        case 'deal': {
          resetMarks = true;
          const n = view.seats.length;
          const hand = view.seats[0]?.cards.length ?? 4;
          for (let r = 0; r < hand; r++) for (let s = 0; s < n; s++) {
            const to = cardBox(s, r);
            const c = view.seats[s]?.cards[r];
            if (to) add({ from: draw, to, a: BACK, b: c ? faceOf(c) : undefined, delay: (r * n + s) * 70, dur: 420, arc: 0, hide: [`${s}:${r}`] });
          }
          break;
        }
        case 'draw':
        case 'power': {
          const to = heldBox(f.seat);
          const mine = f.seat === you && view.drawn;
          if (to) add({ from: draw, to, a: BACK, b: mine ? faceOf(view.drawn, true) : undefined, delay: seq, dur: 460, arc: -26, hide: ['held'] });
          if (f.k === 'power') { stampText = `${POWERS[f.r].name}!`; stampDelay = seq + 420; }
          break;
        }
        case 'place': {
          const slot = cardBox(f.seat, f.i), from = heldBox(f.seat);
          if (!slot || !from) break;
          // The old card goes onto the pile face up, the new one slides into its place.
          add({ from: slot, to: discard, a: BACK, b: faceOf(view.discardTop), delay: seq, dur: 540, arc: -36, hide: ['discard'] });
          const seen = f.seat === you ? before?.drawn : null;
          add({ from, to: slot, a: faceOf(seen, true), b: seen ? BACK : undefined, delay: seq + 120, dur: 560, arc: 30, hide: [`${f.seat}:${f.i}`], glow: { key: `${f.seat}:${f.i}`, color: gem(f.seat) } });
          if (f.seat === you) unmarked.push(f.i); // you've seen the card you put there
          seq += 560;
          break;
        }
        case 'throw': {
          const from = heldBox(f.seat);
          if (!from) break;
          const seen = f.seat === you ? before?.drawn : null;
          add({ from, to: discard, a: seen ? faceOf(seen) : BACK, b: seen ? undefined : faceOf(view.discardTop), delay: seq, dur: 500, arc: -30, hide: ['discard'], glow: { key: 'discard', color: gem(f.seat) } });
          seq += 420;
          break;
        }
        case 'swap': {
          const A = cardBox(f.a[0], f.a[1]), B = cardBox(f.b[0], f.b[1]);
          if (!A || !B) break;
          const color = gem(f.a[0]);
          const ka = `${f.a[0]}:${f.a[1]}`, kb = `${f.b[0]}:${f.b[1]}`;
          // Both cards lift and cross on curved paths, then glow where they land.
          add({ from: A, to: B, a: BACK, delay: seq, dur: 820, arc: 46, hide: [kb], glow: { key: kb, color } });
          add({ from: B, to: A, a: BACK, delay: seq, dur: 820, arc: 46, hide: [ka], glow: { key: ka, color } });
          if (f.a[0] === you) marked.push(f.a[1]);
          if (f.b[0] === you) { marked.push(f.b[1]); if (f.a[0] !== you) buzz = true; }
          seq += 700;
          break;
        }
        case 'shuffle': {
          const count = view.seats[f.seat]?.cards.length ?? 4;
          const boxes = Array.from({ length: count }, (_, i) => cardBox(f.seat, i));
          if (boxes.some(b => !b)) break;
          const bs = boxes as Box[];
          const cx = bs.reduce((a, b) => a + b.x + b.w / 2, 0) / count, cy = bs.reduce((a, b) => a + b.y + hOf(b) / 2, 0) / count;
          const to = bs.map((_, i) => (i + 2) % count); // any order will do: the cards are face down
          const color = gem(mover);
          bs.forEach((from, i) => add({ from, to: bs[to[i]], a: BACK, delay: seq + i * 35, dur: 1000, arc: 0, gather: { x: cx, y: cy }, hide: [`${f.seat}:${to[i]}`], glow: { key: `${f.seat}:${to[i]}`, color } }));
          if (f.seat === you) { marked.push(...bs.map((_, i) => i)); if (mover !== you) buzz = true; }
          seq += 860;
          break;
        }
        case 'end': {
          resetMarks = true;
          view.seats.forEach((s, si) => s.cards.forEach((c, i) => {
            const box = cardBox(si, i);
            if (box && c) add({ from: box, to: box, a: BACK, b: faceOf(c), delay: seq + 300 + si * 260 + i * 70, dur: 440, arc: 0, hide: [`${si}:${i}`] });
          }));
          break;
        }
      }
    }

    if (resetMarks) setMarks(new Map());
    if (marked.length || unmarked.length) {
      setMarks(m => {
        const n = new Map(m);
        unmarked.forEach(i => n.delete(i));
        marked.forEach(i => n.set(i, myTurns.current));
        return n;
      });
    }
    if (buzz) { try { navigator.vibrate?.(90); } catch { /* not supported */ } }
    if (stampText) {
      const text = stampText;
      later(reduce ? 0 : stampDelay, () => setStamp({ text, key: Date.now() }));
      later((reduce ? 0 : stampDelay) + 2300, () => setStamp(null));
    }

    if (reduce) {
      // No flying: just show where things changed.
      plan.forEach(f => f.glow && addGlow(f.glow.key, f.glow.color));
      return;
    }
    if (!plan.length) return;
    if (plan.some(f => f.hide.includes('discard'))) setUnder(before?.discardTop ?? null);
    setHidden(h => {
      const n = new Map(h);
      plan.forEach(f => f.hide.forEach(k => n.set(k, (n.get(k) ?? 0) + 1)));
      return n;
    });
    setFlights(fs => [...fs, ...plan]);
  }, [ctx.fx.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember this view for the next batch, and keep the "changed" marks on your cards up to date.
  useLayoutEffect(() => {
    const { view, you } = ctx;
    prev.current = view;
    if (view.phase !== 'play' || you === null) { lastCur.current = view.cur; return; }
    const was = lastCur.current;
    lastCur.current = view.cur;
    if (view.cur === you && was !== you) myTurns.current++;
    // A mark stays until the end of your next turn, so you still see it while you play.
    if (was === you && view.cur !== you) setMarks(m => new Map([...m].filter(([, t]) => t >= myTurns.current)));
    // A King shows you all your own cards again.
    if (view.peek && view.peek.target === you && view.cur === you) setMarks(m => (m.size ? new Map() : m));
  }, [ctx.view]); // eslint-disable-line react-hooks/exhaustive-deps

  const landed = useCallback((f: Flight) => {
    setFlights(fs => fs.filter(x => x.id !== f.id));
    setHidden(h => {
      const n = new Map(h);
      f.hide.forEach(k => { const c = (n.get(k) ?? 1) - 1; if (c > 0) n.set(k, c); else n.delete(k); });
      return n;
    });
    if (f.glow) addGlow(f.glow.key, f.glow.color);
  }, [addGlow]);

  return { flights, landed, hidden, glows, under: hidden.has('discard') ? under : null, stamp, marks };
}

export function Flights({ flights, landed }: { flights: Flight[]; landed: (f: Flight) => void }) {
  return <>{flights.map(f => <FlyCard key={f.id} f={f} landed={landed} />)}</>;
}

function FlyCard({ f, landed }: { f: Flight; landed: (f: Flight) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const faceA = useRef<HTMLDivElement>(null);
  const faceB = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const th = hOf(f.to);
    // Everything is relative to where the card ends up.
    const dx = f.from.x + f.from.w / 2 - (f.to.x + f.to.w / 2);
    const dy = f.from.y + hOf(f.from) / 2 - (f.to.y + th / 2);
    const s0 = f.from.w / f.to.w, r0 = f.from.r ?? 0, r1 = f.to.r ?? 0;
    const flip = !!f.b;
    const T = (x: number, y: number, r: number, sx: number, sy = sx) => `translate(${x}px, ${y}px) rotate(${r}deg) scale(${sx}, ${sy})`;
    let frames: Keyframe[];
    if (f.gather) {
      const gx = f.gather.x - (f.to.x + f.to.w / 2), gy = f.gather.y - (f.to.y + th / 2), j = f.id % 2 ? 8 : -8;
      frames = [
        { transform: T(dx, dy, r0, s0), offset: 0 },
        { transform: T(gx, gy, j, 1.06), offset: 0.3 },
        { transform: T(gx + j, gy - 6, -j, 1.1), offset: 0.45 },
        { transform: T(gx - j, gy + 3, j * 0.6, 1.1), offset: 0.6 },
        { transform: T(0, 0, r1, 1), offset: 1 },
      ];
    } else {
      const len = Math.hypot(dx, dy);
      const nx = len ? -dy / len : 0, ny = len ? dx / len : 0;
      const lift = len > 4 ? 1.14 : 1.05;
      const sm = ((s0 + 1) / 2) * lift;
      frames = [
        { transform: T(dx, dy, r0, s0), offset: 0 },
        { transform: T(dx / 2 + nx * f.arc, dy / 2 + ny * f.arc, (r0 + r1) / 2 + Math.sign(f.arc) * 8, flip ? 0.03 : sm, sm), offset: 0.5 },
        { transform: T(0, 0, r1, 1), offset: 1 },
      ];
    }
    const opts: KeyframeAnimationOptions = { duration: f.dur, delay: f.delay, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'both' };
    const anims = [el.animate(frames, opts)];
    if (flip && faceA.current && faceB.current) {
      anims.push(faceA.current.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.501 }, { opacity: 0 }], opts));
      anims.push(faceB.current.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.501 }, { opacity: 1 }], opts));
    }
    anims[0].onfinish = () => landed(f);
    return () => anims.forEach(a => a.cancel());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={box} className="pl-fly" style={{ left: f.to.x, top: f.to.y, width: f.to.w, height: hOf(f.to) }} aria-hidden="true">
      <div ref={faceA} className="pl-fly-face">{faceEl(f.a, f.to.w)}</div>
      {f.b && <div ref={faceB} className="pl-fly-face">{faceEl(f.b, f.to.w)}</div>}
    </div>
  );
}
