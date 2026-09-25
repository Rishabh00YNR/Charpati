import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT_CARD, FONT_DISPLAY, GOLD_TEXT } from './theme';
import { useLayout } from './layout';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const ease = (f: number, from: number, to: number, a = 0, b = 1) =>
  interpolate(f, [from, to], [a, b], { ...clamp, easing: Easing.bezier(0.3, 0.7, 0.2, 1) });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// The purple card room, with gold dust drifting up through it. Runs under every scene.
export function Room() {
  const f = useCurrentFrame();
  const L = useLayout(), span = L.H + 180;
  const dots = Array.from({ length: 70 }, (_, i) => {
    const x = random(`x${i}`) * L.W;
    const y = (random(`y${i}`) * span - f * (0.4 + random(`s${i}`) * 0.9)) % span;
    const size = 2 + random(`r${i}`) * 4;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(f / 18 + i));
    return <span key={i} style={{ position: 'absolute', left: x, top: y < 0 ? y + span : y, width: size, height: size, borderRadius: '50%', background: i % 4 === 0 ? '#C39BFF' : C.goldHi, opacity: 0.5 * tw, boxShadow: `0 0 ${size * 3}px ${i % 4 === 0 ? '#C39BFF' : C.gold}` }} />;
  });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(110% 70% at 50% 42%, ${C.lift} 0%, ${C.room} 55%, ${C.deep} 100%)` }}>
      {dots}
    </AbsoluteFill>
  );
}

// Fades a scene in and out, so scenes pass through the dark room.
export function Scene({ dur, children }: { dur: number; children: ReactNode }) {
  const f = useCurrentFrame();
  const o = Math.min(ease(f, 0, 9), 1 - ease(f, dur - 9, dur));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

export function Rays({ cx, cy, size = 1300, opacity = 1 }: { cx: number; cy: number; size?: number; opacity?: number }) {
  const f = useCurrentFrame();
  return (
    <div style={{
      position: 'absolute', left: cx - size / 2, top: cy - size / 2, width: size, height: size, borderRadius: '50%', opacity,
      background: 'repeating-conic-gradient(from 0deg, rgba(241,220,158,.24) 0deg 5deg, rgba(241,220,158,0) 5deg 15deg)',
      WebkitMaskImage: 'radial-gradient(circle, #000 14%, transparent 66%)', maskImage: 'radial-gradient(circle, #000 14%, transparent 66%)',
      transform: `rotate(${f * 0.35}deg)`,
    }} />
  );
}

// The purple felt table with its gold rail, seen from a low angle.
export function Felt({ opacity = 1 }: { opacity?: number }) {
  const { cx, felt } = useLayout();
  return (
    <div style={{
      position: 'absolute', left: cx - felt.w / 2, top: felt.cy - felt.h / 2, width: felt.w, height: felt.h, borderRadius: '50%', opacity,
      backgroundColor: C.felt, backgroundImage: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,.12), rgba(0,0,0,.5) 80%)',
      boxShadow: `0 0 0 8px #3B2A12, 0 0 0 16px ${C.brass}, 0 0 0 19px #5E4318, 0 60px 90px rgba(0,0,0,.6), inset 0 0 90px rgba(0,0,0,.55)`,
    }} />
  );
}

// A line of on-screen text. Lines rise in at `from` and fade out at `until`; they double as subtitles.
export function Caption({ lines, y: yIn, size: sizeIn, bottom = false }: { lines: { text: string; from: number; until?: number }[]; y?: number; size?: number; bottom?: boolean }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();
  const y = yIn ?? (bottom ? L.capBottom : L.capTop);
  const size = sizeIn ?? (bottom ? L.capSizeSmall : L.capSize);
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: y, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center' }}>
      {lines.map(l => {
        const s = spring({ frame: f - l.from, fps, config: { damping: 16, mass: 0.7 } });
        const out = l.until === undefined ? 0 : ease(f, l.until, l.until + 8);
        if (f < l.from || out >= 1) return null;
        return (
          <div key={l.text} style={{ fontFamily: FONT_CARD, fontWeight: 700, fontSize: size, lineHeight: 1.12, color: C.goldHi, opacity: s * (1 - out), transform: `translateY(${(1 - s) * 50 - out * 20}px)`, textShadow: '0 4px 0 #3B2A12, 0 0 40px rgba(230,195,111,.35)' }}>
            {l.text}
          </div>
        );
      })}
    </div>
  );
}

// A power's name slamming onto the screen.
export function Stamp({ text, from, until }: { text: string; from: number; until?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { power } = useLayout();
  const y = power.stampY, size = power.stampSize;
  const out = until === undefined ? 0 : ease(f, until, until + 12);
  if (f < from || out >= 1) return null;
  const s = spring({ frame: f - from, fps, config: { damping: 11, mass: 0.6, stiffness: 160 } });
  const scale = lerp(2.6, 1, s) - out * 0.15;
  return (
    <div style={{ position: 'absolute', left: power.cx - 600, width: 1200, top: y, textAlign: 'center', transform: `rotate(-7deg) scale(${scale})`, opacity: Math.min(1, s * 1.6) * (1 - out) }}>
      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: size, lineHeight: 1, background: GOLD_TEXT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 6px 0 #3B2A12) drop-shadow(0 0 40px rgba(230,195,111,.7))' }}>
        {text}
      </span>
    </div>
  );
}

export function Crown({ x, y, w = 180, style }: { x: number; y: number; w?: number; style?: CSSProperties }) {
  return <Img src={staticFile('cards/crown.svg')} style={{ position: 'absolute', left: x - w / 2, top: y, width: w, filter: 'drop-shadow(0 0 30px rgba(230,195,111,.6))', ...style }} />;
}

// The win: a gold shockwave and sparks bursting out from (cx, cy), then gold glitter drifting down.
export function GoldBurst({ from, cx, cy }: { from: number; cx: number; cy: number }) {
  const f = useCurrentFrame() - from;
  const { W } = useLayout();
  if (f < 0) return null;
  const ring = ease(f, 0, 26);
  return (
    <>
      {[0, 8].map(d => {
        const r = ease(f, d, d + 30);
        return <div key={d} style={{ position: 'absolute', left: cx, top: cy, width: 900, height: 900, marginLeft: -450, marginTop: -450, borderRadius: '50%', border: `${6 - d / 2}px solid ${C.gold}`, boxShadow: `0 0 40px ${C.gold}, inset 0 0 40px ${C.gold}`, transform: `scale(${0.05 + r * 0.95})`, opacity: (1 - r) * 0.8 }} />;
      })}
      <div style={{ position: 'absolute', left: cx - 260, top: cy - 260, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,246,214,.9), rgba(230,195,111,.35) 35%, transparent 70%)', opacity: (1 - ring) * 0.9, transform: `scale(${0.4 + ring})` }} />
      {Array.from({ length: 48 }, (_, i) => {
        const ang = random(`ba${i}`) * Math.PI * 2;
        const dist = ease(f, 0, 34 + random(`bt${i}`) * 16, 0, 260 + random(`bd${i}`) * 420);
        const size = 6 + random(`bs${i}`) * 12;
        const o = 1 - ease(f, 20, 50 + random(`bo${i}`) * 20);
        return <span key={`s${i}`} style={{ position: 'absolute', left: cx + Math.cos(ang) * dist - size / 2, top: cy + Math.sin(ang) * dist * 0.8 - size / 2, width: size, height: size, rotate: '45deg', background: i % 5 === 0 ? '#FFF6D6' : C.gold, boxShadow: `0 0 ${size * 2}px ${C.gold}`, opacity: o }} />;
      })}
      {Array.from({ length: 40 }, (_, i) => {
        const t = f - 12 - random(`gd${i}`) * 30;
        if (t < 0) return null;
        const x = random(`gx${i}`) * W + Math.sin(t / 12 + i) * 24;
        const y = -40 + t * (5 + random(`gs${i}`) * 5);
        const size = 4 + random(`gz${i}`) * 6;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t / 5 + i));
        return <span key={`g${i}`} style={{ position: 'absolute', left: x, top: y, width: size, height: size, rotate: '45deg', background: C.goldHi, boxShadow: `0 0 ${size * 3}px ${C.gold}`, opacity: tw }} />;
      })}
    </>
  );
}
