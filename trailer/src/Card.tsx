import type { CSSProperties, ReactNode } from 'react';
import { Img, staticFile } from 'remotion';
import { C, FONT_CARD, FONT_UI } from './theme';

export type Suit = '♠' | '♥' | '♦' | '♣';
export type PowerRank = '7' | 'K' | 'Q' | 'J';

export const POWERS: Record<PowerRank, { name: string; icon: string; short: string }> = {
  '7': { name: 'Swap', icon: 'swap', short: 'Blind swap with a player' },
  K: { name: 'Look', icon: 'look', short: 'See all your own cards' },
  Q: { name: 'Shuffle', icon: 'shuffle', short: "Mix up someone's cards" },
  J: { name: 'Peek', icon: 'peek', short: "See someone's cards" },
};

const isRed = (s: Suit) => s === '♥' || s === '♦';
const glyph = (s: Suit) => s + '︎'; // keep suits as text, not emoji
const art = (name: string) => (
  <Img src={staticFile(`cards/${name}.svg`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
);
const frameStyle = (w: number, style?: CSSProperties): CSSProperties => ({
  position: 'relative', flex: 'none', width: w, height: w * 1.4, borderRadius: w * 0.072,
  boxShadow: '0 1px 0 rgba(0,0,0,.35), 0 28px 44px -20px rgba(0,0,0,.9)',
  ...style,
});

type Base = { w: number; style?: CSSProperties };

export function Back({ w, named = false, style }: Base & { named?: boolean }) {
  return <div style={frameStyle(w, style)}>{art(named ? 'back-named' : 'back')}</div>;
}

export function Face({ w, rank, suit, style }: Base & { rank: string; suit: Suit }) {
  const ink = isRed(suit) ? C.red : '#231F1A';
  return (
    <div style={{ ...frameStyle(w, style), color: ink }}>
      {art('face')}
      <div style={{ position: 'absolute', top: '8%', left: '12%', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: FONT_CARD, fontWeight: 700, fontSize: w * 0.26, lineHeight: 0.9 }}>
        {rank}
        <span style={{ marginTop: w * 0.02, fontFamily: FONT_UI, fontSize: w * 0.18, lineHeight: 1 }}>{glyph(suit)}</span>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '16%', fontSize: w * 0.48, lineHeight: 1 }}>{glyph(suit)}</div>
    </div>
  );
}

// The full trading-card face of a power card: rank medallion, picture, name banner, text box.
export function Power({ w, rank, suit, style }: Base & { rank: PowerRank; suit: Suit }) {
  const p = POWERS[rank];
  return (
    <div style={{ ...frameStyle(w, style), boxShadow: '0 30px 60px -24px rgba(0,0,0,.9)' }}>
      {art('face-lg')}
      <span style={{ position: 'absolute', left: '18.4%', top: '13.7%', transform: 'translate(-50%, -50%)', fontFamily: FONT_CARD, fontWeight: 700, fontSize: w * 0.15, lineHeight: 1, color: C.goldHi }}>{rank}</span>
      <div style={{ position: 'absolute', left: '11.2%', top: '8.6%', width: '77.6%', height: '50.9%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Img src={staticFile(`cards/icon-${p.icon}.svg`)} style={{ width: '46%', filter: `drop-shadow(0 0 ${w * 0.05}px rgba(230,195,111,.55))` }} />
        <span style={{ position: 'absolute', right: '7%', bottom: '5%', fontSize: w * 0.11, lineHeight: 1, color: isRed(suit) ? '#E8503F' : C.goldHi }}>{glyph(suit)}</span>
      </div>
      <span style={{ position: 'absolute', left: '50%', top: '64.9%', transform: 'translate(-50%, -50%)', width: '72%', textAlign: 'center', whiteSpace: 'nowrap', fontFamily: FONT_CARD, fontWeight: 700, fontSize: w * 0.078, letterSpacing: '.08em', textTransform: 'uppercase', color: C.goldHi }}>{p.name}</span>
      <span style={{ position: 'absolute', left: '12%', top: '71.7%', width: '76%', height: '17.4%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5%', textAlign: 'center', fontFamily: FONT_UI, fontWeight: 600, fontSize: w * 0.066, lineHeight: 1.25, color: '#3A3024' }}>{p.short}</span>
    </div>
  );
}

// A card turning over: angle 0 shows the back, 180 shows the face.
export function Flip({ angle, back, face, style }: { angle: number; back: ReactNode; face: ReactNode; style?: CSSProperties }) {
  const a = ((angle % 360) + 360) % 360;
  const showFace = a > 90 && a < 270;
  return (
    <div style={{ ...style, transform: `${style?.transform ?? ''} perspective(1800px) rotateY(${showFace ? a - 180 : a}deg)` }}>
      {showFace ? face : back}
    </div>
  );
}
