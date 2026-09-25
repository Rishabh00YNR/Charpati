import type { CSSProperties } from 'react';

export type Suit = '♠' | '♥' | '♦' | '♣';
export type PowerRank = '7' | 'K' | 'Q' | 'J';

const SUIT_NAME: Record<Suit, string> = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const isRed = (s: Suit) => s === '♥' || s === '♦';
const glyph = (s: Suit) => s + '︎'; // keep suits as text, not emoji

// The same powers as the game. `short` is the line printed on the card itself.
export const POWERS: Record<PowerRank, { name: string; icon: string; short: string; text: string }> = {
  '7': { name: 'Swap', icon: 'swap', short: 'Blind swap with a player', text: "Swap one of your cards with anyone's. Nobody looks, not even you." },
  K: { name: 'Look', icon: 'look', short: 'See all your own cards', text: 'See all four of your own cards again. You still can’t move them.' },
  Q: { name: 'Shuffle', icon: 'shuffle', short: "Mix up someone's cards", text: 'Mix up another player’s cards. Everything they remembered is gone.' },
  J: { name: 'Peek', icon: 'peek', short: "See someone's cards", text: 'Look at all of one player’s cards. Now you know something they don’t.' },
};

type Base = { w: number; className?: string; style?: CSSProperties };
const box = (w: number, style?: CSSProperties) => ({ '--cw': `${w}px`, ...style }) as CSSProperties;

export function CardBack({ w, named = false, className = '', style }: Base & { named?: boolean }) {
  return <div className={`card back${named ? ' named' : ''} ${className}`} style={box(w, style)} role="img" aria-label="A face-down card" />;
}

export function CardFace({ rank, suit, w, className = '', style }: Base & { rank: string; suit: Suit }) {
  return (
    <div className={`card face${isRed(suit) ? ' red' : ''} ${className}`} style={box(w, style)} role="img" aria-label={`${rank} of ${SUIT_NAME[suit]}`}>
      <span className="cs-rank" aria-hidden="true">
        {rank}
        <small>{glyph(suit)}</small>
      </span>
      <span className="cs-pip" aria-hidden="true">{glyph(suit)}</span>
    </div>
  );
}

export function PowerCard({ rank, suit, w, className = '', style }: Base & { rank: PowerRank; suit: Suit }) {
  const p = POWERS[rank];
  return (
    <div className={`card lg${isRed(suit) ? ' red' : ''} ${className}`} style={box(w, style)} role="img" aria-label={`${rank} of ${SUIT_NAME[suit]}, the ${p.name} power`}>
      <span className="cf-rank" aria-hidden="true">{rank}</span>
      <span className="cf-art" aria-hidden="true">
        <span className={`cf-icon i-${p.icon}`} />
        <span className="cf-suit">{glyph(suit)}</span>
      </span>
      <span className="cf-name" aria-hidden="true">{p.name}</span>
      <span className="cf-text" aria-hidden="true">{p.short}</span>
    </div>
  );
}
