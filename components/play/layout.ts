// Where everything sits on the table. The table is drawn on one of two fixed stages that are
// scaled to fit the screen: a tall one for phones and a wide one for laptops and desktops.

export type Box = { x: number; y: number; w: number; r?: number }; // a card: top-left corner, width, tilt
export const hOf = (b: Box) => Math.round(b.w * 1.4);

export type SeatSpot = {
  mat: { x: number; y: number; w: number; h: number }; // the band behind this player's cards
  av: { x: number; y: number; s: number }; // avatar centre and size
  name: { x: number; y: number; side: 'below' | 'right' };
  cards: Box[];
  held: Box; // where the card they drew sits while they decide
  heldLabel: { x: number; y: number };
};

export type Layout = {
  kind: 'phone' | 'desktop';
  W: number;
  H: number;
  felt: { x: number; y: number; w: number; h: number; radius: number };
  seats: SeatSpot[]; // the other players, in turn order after you
  hand: Box[]; // your four cards
  mine: Box; // the card you drew, while you decide
  mineLabel: { x: number; y: number };
  draw: Box;
  discard: Box;
  pileLabelY: number;
  center: { x: number; y: number; w: number; h: number }; // countdowns and banners
  ticker: { x: number; y: number; w: number } | null; // the last move, when there's room for it
  plate: { x: number; y: number; w: number };
  barY: number;
  btnsY: number;
  stampY: number;
};

const four = <T,>(f: (i: number) => T) => [0, 1, 2, 3].map(f);

// ---- Phones: each other player gets a row across the table, all four cards in one line -----
// Fewer players, bigger cards.
const PHONE: Record<number, { rowH: number; cw: number; pile: number; hand: number; gap: number; ticker: boolean; top: number }> = {
  1: { rowH: 104, cw: 60, pile: 66, hand: 72, gap: 6, ticker: true, top: 86 },
  2: { rowH: 92, cw: 56, pile: 64, hand: 70, gap: 6, ticker: true, top: 86 },
  3: { rowH: 82, cw: 52, pile: 58, hand: 64, gap: 6, ticker: false, top: 84 },
  4: { rowH: 72, cw: 46, pile: 54, hand: 60, gap: 5, ticker: false, top: 82 },
};

export function phoneLayout(others: number): Layout {
  const p = PHONE[Math.min(4, Math.max(1, others))];
  const W = 390, H = 772;
  const ch = Math.round(p.cw * 1.4);
  const rows = Array.from({ length: others }, (_, k) => p.top + k * (p.rowH + p.gap));
  let y = others ? rows[others - 1] + p.rowH : p.top;
  let ticker: Layout['ticker'] = null;
  if (p.ticker) { ticker = { x: 40, y: y + 12, w: 310 }; y += 12 + 44; }

  const centerTop = y + 12;
  const ph = Math.round(p.pile * 1.4);
  const draw: Box = { x: 56, y: centerTop, w: p.pile };
  const discard: Box = { x: 56 + p.pile + 18, y: centerTop, w: p.pile, r: 6 };
  const hw = p.pile + 6;
  const held: Box = { x: W - 56 - hw, y: centerTop - 4, w: hw, r: -4 };
  const heldLabel = { x: held.x + hw / 2, y: centerTop + ph + 8 };
  const pileLabelY = centerTop + ph + 8;

  const handTop = pileLabelY + 12 + (others >= 4 ? 16 : 22);
  const hg = p.hand >= 70 ? 10 : 8, hx0 = (W - (4 * p.hand + 3 * hg)) / 2;
  const rot = [-6, -2, 2, 6], lift = [7, 0, 0, 7];
  const hand = four(i => ({ x: hx0 + i * (p.hand + hg), y: handTop + lift[i], w: p.hand, r: rot[i] }));
  const feltBottom = handTop + 7 + Math.round(p.hand * 1.4) + 8;

  const seats: SeatSpot[] = rows.map(ry => {
    const cx = 30 + 6 + 60 + 10;
    return {
      mat: { x: 30, y: ry, w: 330, h: p.rowH },
      av: { x: 66, y: ry + p.rowH / 2 - 10, s: p.rowH >= 90 ? 40 : 36 },
      name: { x: 66, y: ry + p.rowH / 2 + 20, side: 'below' },
      cards: four(i => ({ x: cx + i * (p.cw + 6), y: ry + (p.rowH - ch) / 2, w: p.cw })),
      held,
      heldLabel,
    };
  });

  return {
    kind: 'phone', W, H,
    felt: { x: 18, y: 72, w: 354, h: feltBottom - 72, radius: 38 },
    seats, hand,
    mine: held, mineLabel: heldLabel,
    draw, discard, pileLabelY,
    center: { x: 40, y: centerTop - 6, w: 310, h: ph + 24 },
    ticker,
    plate: { x: 70, y: feltBottom + 10, w: 250 },
    barY: feltBottom + 66,
    btnsY: feltBottom + 112,
    stampY: centerTop - 30,
  };
}

// ---- Desktops: a wide table. Profiles sit outside the rail, only cards are on the felt ------
const row = (x: number, y: number) => four(i => ({ x: x + i * 72, y, w: 64 }));
const DESK: Record<'TL' | 'T' | 'TR' | 'L' | 'R', SeatSpot> = {
  TL: { mat: { x: 366, y: 166, w: 292, h: 102 }, av: { x: 512, y: 108, s: 48 }, name: { x: 546, y: 108, side: 'right' }, cards: row(372, 172), held: { x: 668, y: 172, w: 64, r: 4 }, heldLabel: { x: 700, y: 272 } },
  T: { mat: { x: 574, y: 166, w: 292, h: 102 }, av: { x: 720, y: 108, s: 48 }, name: { x: 754, y: 108, side: 'right' }, cards: row(580, 172), held: { x: 876, y: 172, w: 64, r: 4 }, heldLabel: { x: 908, y: 272 } },
  TR: { mat: { x: 782, y: 166, w: 292, h: 102 }, av: { x: 928, y: 108, s: 48 }, name: { x: 962, y: 108, side: 'right' }, cards: row(788, 172), held: { x: 708, y: 172, w: 64, r: -4 }, heldLabel: { x: 740, y: 272 } },
  L: { mat: { x: 206, y: 298, w: 292, h: 102 }, av: { x: 124, y: 349, s: 48 }, name: { x: 124, y: 383, side: 'below' }, cards: row(212, 304), held: { x: 508, y: 304, w: 64, r: 4 }, heldLabel: { x: 540, y: 404 } },
  R: { mat: { x: 942, y: 298, w: 292, h: 102 }, av: { x: 1316, y: 349, s: 48 }, name: { x: 1316, y: 383, side: 'below' }, cards: row(948, 304), held: { x: 868, y: 304, w: 64, r: -4 }, heldLabel: { x: 900, y: 404 } },
};
const DESK_ORDER: Record<number, (keyof typeof DESK)[]> = { 1: ['T'], 2: ['TL', 'TR'], 3: ['L', 'T', 'R'], 4: ['L', 'TL', 'TR', 'R'] };

export function desktopLayout(others: number): Layout {
  const slots = DESK_ORDER[Math.min(4, Math.max(1, others))].slice(0, others);
  return {
    kind: 'desktop', W: 1440, H: 900,
    felt: { x: 170, y: 150, w: 1100, h: 540, radius: 270 },
    seats: slots.map(s => DESK[s]),
    hand: [{ x: 433, y: 506, w: 92, r: -4 }, { x: 543, y: 500, w: 92, r: -1.3 }, { x: 653, y: 500, w: 92, r: 1.3 }, { x: 763, y: 506, w: 92, r: 4 }],
    mine: { x: 903, y: 488, w: 104, r: 3 },
    mineLabel: { x: 955, y: 456 },
    draw: { x: 628, y: 293, w: 80 },
    discard: { x: 732, y: 293, w: 80, r: 6 },
    pileLabelY: 422,
    center: { x: 548, y: 282, w: 344, h: 170 },
    ticker: { x: 720, y: 22, w: 600 },
    plate: { x: 570, y: 714, w: 300 },
    barY: 780,
    btnsY: 818,
    stampY: 230,
  };
}

// Laptops and wider screens get the wide table; phones and tablets held upright get the tall one.
export const layoutKind = (w: number, h: number): Layout['kind'] => (w >= 960 && w / h >= 1.2 ? 'desktop' : 'phone');
export const STAGE = { phone: { W: 390, H: 772, max: 1.6 }, desktop: { W: 1440, H: 900, max: 1.5 } } as const;
