'use client';

import { useEffect, useRef, useState } from 'react';
import { CardBack, CardFace, type Suit } from './Card';

type PlayCard = { r: string; s: Suit; v: number };
type Phase = 'peek' | 'swap' | 'guess' | 'result';

// Only plain cards: power cards never sit in a hand. Four different values, so one card is clearly lowest.
const RANKS: [string, number][] = [['A', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['8', 8], ['9', 9], ['10', 10]];
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const PEEK_MS = 1400;
const SWAPS = 3;
const SWAP_MS = 800;

function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const dealFour = (): PlayCard[] =>
  shuffled(RANKS).slice(0, 4).map(([r, v]) => ({ r, v, s: SUITS[Math.floor(Math.random() * SUITS.length)] }));
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export default function PeekGame() {
  // Dealt after mounting, so the server and the browser render the same four face-down cards.
  const [cards, setCards] = useState<PlayCard[] | null>(null);
  const [pos, setPos] = useState([0, 1, 2, 3]); // pos[card] = the slot it sits in
  const [peeked, setPeeked] = useState([false, false, false, false]);
  const [showing, setShowing] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('peek');
  const [lift, setLift] = useState<[number, number] | null>(null);
  const [swapNo, setSwapNo] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    setCards(dealFour());
    return () => { alive.current = false; };
  }, []);

  const peekCount = peeked.filter(Boolean).length;
  const lowest = cards ? cards.reduce((best, c, i) => (c.v < cards[best].v ? i : best), 0) : -1;

  function tap(i: number) {
    if (phase === 'peek') {
      if (peeked[i] || showing !== null) return;
      setShowing(i);
      setPeeked(p => p.map((v, k) => v || k === i));
      setTimeout(() => { if (alive.current) setShowing(null); }, PEEK_MS);
    } else if (phase === 'guess') {
      setPicked(i);
      setPhase('result');
    }
  }

  async function startSwaps() {
    if (phase !== 'peek' || showing !== null) return;
    setPhase('swap');
    for (let k = 0; k < SWAPS; k++) {
      const [a, b] = shuffled([0, 1, 2, 3]);
      setSwapNo(k + 1);
      setLift([a, b]);
      setPos(p => { const n = [...p]; [n[a], n[b]] = [n[b], n[a]]; return n; });
      await sleep(SWAP_MS);
      if (!alive.current) return;
      setLift(null);
      await sleep(260);
      if (!alive.current) return;
    }
    setPhase('guess');
  }

  function again() {
    setCards(dealFour());
    setPos([0, 1, 2, 3]);
    setPeeked([false, false, false, false]);
    setShowing(null);
    setPicked(null);
    setSwapNo(0);
    setPhase('peek');
  }

  const low = cards && lowest >= 0 ? cards[lowest] : null;
  let message = '';
  if (phase === 'peek') message = peekCount === 0 ? 'Tap each card to peek. You get one look at each.' : `Peeked at ${peekCount} of 4. Remember where your lowest card is.`;
  else if (phase === 'swap') message = `Keep your eyes on them… swap ${swapNo} of ${SWAPS}`;
  else if (phase === 'guess') message = 'Where is your lowest card now? Tap it.';
  else if (low) message = picked === lowest
    ? `Sharp! That was your lowest card, the ${low.r}${low.s}.`
    : `Not quite. Your lowest was the ${low.r}${low.s}. Welcome to Charpati.`;

  const interactive = phase === 'peek' || phase === 'guess';

  return (
    <div className="pk">
      <div className="pk-table">
        {[0, 1, 2, 3].map(i => {
          const c = cards?.[i];
          const faceUp = !!c && (showing === i || phase === 'result');
          const cls = [
            'pk-card',
            lift && lift[0] === i ? 'up' : '',
            lift && lift[1] === i ? 'down' : '',
            phase === 'result' && i === lowest ? 'lowest' : '',
            phase === 'result' && i === picked && i !== lowest ? 'missed' : '',
            phase === 'peek' && peeked[i] && showing !== i ? 'seen' : '',
          ].filter(Boolean).join(' ');
          const face = faceUp && c
            ? <CardFace key="f" rank={c.r} suit={c.s} w={0} className="flip" style={{ width: 'var(--pcw)', height: 'calc(var(--pcw) * 1.4)', ['--cw' as string]: 'var(--pcw)' }} />
            : <CardBack key="b" w={0} style={{ width: 'var(--pcw)', height: 'calc(var(--pcw) * 1.4)', ['--cw' as string]: 'var(--pcw)' }} />;
          return interactive ? (
            <button key={i} type="button" className={cls} style={{ ['--slot' as string]: pos[i] }} onClick={() => tap(i)}
              disabled={phase === 'peek' && (peeked[i] || showing !== null)}
              aria-label={phase === 'peek' ? `Peek at the card in place ${pos[i] + 1}` : `Choose the card in place ${pos[i] + 1}`}>
              {face}
            </button>
          ) : (
            <div key={i} className={cls} style={{ ['--slot' as string]: pos[i] }}>{face}</div>
          );
        })}
      </div>
      <p className="pk-msg" role="status" aria-live="polite">{message}</p>
      <div className="pk-actions">
        {phase === 'peek' && (
          <button type="button" className="btn" onClick={startSwaps} disabled={peekCount === 0 || showing !== null}>
            {peekCount === 4 ? 'Got them. Start the swaps' : 'Start the swaps'}
          </button>
        )}
        {phase === 'result' && <button type="button" className="btn" onClick={again}>Deal again</button>}
      </div>
    </div>
  );
}
