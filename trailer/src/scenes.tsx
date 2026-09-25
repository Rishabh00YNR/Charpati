import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Back, Face, Flip, Power, type PowerRank, type Suit } from './Card';
import { Caption, Crown, Felt, GoldBurst, Rays, Stamp, ease, lerp } from './bits';
import { useLayout } from './layout';
import { C, FONT_CARD, FONT_DISPLAY, FONT_UI, rowX } from './theme';

type P = { dur: number };
const abs = (x: number, y: number, transform = '') => ({ position: 'absolute' as const, left: x, top: y, transform });
const tilt = (i: number) => (i - 1.5) * 2.2; // the row of four fans very slightly

// 1. One gold card spins out of the dark.
export function Open(_: P) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout(), { w, cy, capY } = L.open;
  const s = spring({ frame: f - 3, fps, config: { damping: 13, mass: 0.9 } });
  return (
    <>
      <Rays cx={L.cx} cy={cy} opacity={ease(f, 0, 30)} />
      <div style={abs(L.cx - w / 2, cy - w * 0.7, `perspective(1800px) rotateY(${(1 - s) * 540}deg) scale(${lerp(0.35, 1, s)}) translateY(${Math.sin(f / 14) * 10}px)`)}>
        <Back w={w} named style={{ filter: 'drop-shadow(0 0 50px rgba(230,195,111,.45))' }} />
      </div>
      <Caption lines={[{ text: 'You get one look.', from: 28 }]} y={capY} size={L.capSize * 1.12} />
    </>
  );
}

// 2. Four cards are dealt, turn over for a moment, then hide again.
const DEALT: { r: string; s: Suit }[] = [{ r: 'A', s: '♠' }, { r: '5', s: '♥' }, { r: '8', s: '♦' }, { r: '3', s: '♣' }];
export function Deal(_: P) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();
  return (
    <>
      <Felt />
      {DEALT.map((c, i) => {
        const s = spring({ frame: f - 6 - i * 6, fps, config: { damping: 15, mass: 0.7 } });
        const x = lerp(L.cx - L.cw / 2, rowX(L, i), s), y = lerp(-420, L.rowY, s), r = lerp(-40 + i * 25, tilt(i), s);
        const angle = ease(f, 50 + i * 5, 62 + i * 5, 0, 180) - ease(f, 112 + i * 4, 124 + i * 4, 0, 180);
        return <Flip key={i} angle={angle} back={<Back w={L.cw} />} face={<Face w={L.cw} rank={c.r} suit={c.s} />} style={abs(x, y, `rotate(${r}deg)`)} />;
      })}
      <Caption lines={[{ text: 'Four cards.', from: 8 }, { text: 'Remember them.', from: 58 }]} />
    </>
  );
}

// A power card arriving with light rays behind it.
function PowerEntrance({ rank, suit, shrink = 0, from = 0, leaveAt }: { rank: PowerRank; suit: Suit; shrink?: number; from?: number; leaveAt: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { cx, cy, w: full } = useLayout().power;
  const w = full - shrink;
  const s = spring({ frame: f - from, fps, config: { damping: 12, mass: 0.7 } });
  const gone = ease(f, leaveAt, leaveAt + 14);
  return (
    <>
      <Rays cx={cx} cy={cy} size={1100} opacity={s * (1 - gone)} />
      <div style={{ ...abs(cx - w / 2, cy - w * 0.7, `translateY(${(1 - s) * -900 - gone * 260}px) rotate(${lerp(-16, -4, s)}deg) scale(${1 - gone * 0.4})`), opacity: 1 - gone, filter: 'drop-shadow(0 0 40px rgba(230,195,111,.5))' }}>
        <Power w={w} rank={rank} suit={suit} />
      </div>
    </>
  );
}

// 3. A 7: one of your cards is swapped away without anyone looking.
export function Swap(_: P) {
  const f = useCurrentFrame();
  const L = useLayout();
  const out = ease(f, 58, 86), inn = ease(f, 70, 98), x1 = rowX(L, 1);
  return (
    <>
      <Felt />
      {[0, 1, 2, 3].map(i => i === 1 ? null : <Back key={i} w={L.cw} style={abs(rowX(L, i), L.rowY, `rotate(${tilt(i)}deg)`)} />)}
      <Back w={L.cw} style={{ ...abs(lerp(x1, L.W + 100, out), lerp(L.rowY, L.rowY - 760, out), `rotate(${lerp(tilt(1), 50, out)}deg)`), filter: out > 0 ? 'drop-shadow(0 0 30px rgba(230,195,111,.7))' : undefined }} />
      {inn > 0 && <Back w={L.cw} style={{ ...abs(lerp(-320, x1, inn), lerp(L.rowY - 720, L.rowY, inn), `rotate(${lerp(-50, tilt(1), inn)}deg)`), filter: inn < 1 ? 'drop-shadow(0 0 30px rgba(230,195,111,.7))' : undefined }} />}
      <PowerEntrance rank="7" suit="♥" leaveAt={52} />
      <Stamp text="Swap!" from={12} until={56} />
      <Caption lines={[{ text: 'Then someone plays a 7.', from: 8, until: 86 }, { text: 'Swapped. Nobody looked.', from: 92 }]} bottom />
    </>
  );
}

// 4. A Queen: your four cards are gathered up, mixed, and dealt back out.
const ORDER = [2, 0, 3, 1];
export function Shuffle(_: P) {
  const f = useCurrentFrame();
  const L = useLayout();
  const gather = ease(f, 22, 40), spread = ease(f, 74, 94);
  const shake = interpolate(f, [40, 48, 66, 74], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <>
      <Felt />
      {[0, 1, 2, 3].map(i => {
        const home = L.cx - L.cw / 2 + (i - 1.5) * 8;
        const jitter = Math.sin((f - 40) * 0.95 + i * 1.7) * 34 * shake;
        const x = lerp(lerp(rowX(L, i), home, gather), rowX(L, ORDER[i]), spread) + jitter;
        const r = lerp(lerp(tilt(i), (i - 1.5) * 6, gather), tilt(ORDER[i]), spread) + Math.sin((f - 40) * 0.8 + i) * 9 * shake;
        const lift = -Math.sin(Math.PI * gather) * 60 * (1 - spread) - shake * 24;
        return <Back key={i} w={L.cw} style={abs(x, L.rowY + lift, `rotate(${r}deg)`)} />;
      })}
      <PowerEntrance rank="Q" suit="♦" shrink={40} leaveAt={34} />
      <Stamp text="Shuffle!" from={8} until={40} />
      <Caption lines={[{ text: 'A Queen shuffles everything.', from: 6, until: 70 }, { text: 'Where is your Ace now?', from: 76 }]} bottom />
    </>
  );
}

// 5. All four powers fan in.
const FAN: { r: PowerRank; s: Suit }[] = [{ r: '7', s: '♥' }, { r: 'K', s: '♠' }, { r: 'Q', s: '♦' }, { r: 'J', s: '♣' }];
export function Powers(_: P) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout(), { w, top, spread, raysCy } = L.fan;
  return (
    <>
      <Rays cx={L.cx} cy={raysCy} size={1400} opacity={ease(f, 0, 20)} />
      {FAN.map((c, i) => {
        const s = spring({ frame: f - 4 - i * 9, fps, config: { damping: 13, mass: 0.8 } });
        return (
          <div key={c.r} style={{ ...abs(L.cx + (i - 1.5) * spread - w / 2, top, `translateY(${(1 - s) * 1100}px) rotate(${(i - 1.5) * 12 * s}deg)`), transformOrigin: '50% 120%' }}>
            <Power w={w} rank={c.r} suit={c.s} />
          </div>
        );
      })}
      <Caption lines={[{ text: 'Sixteen power cards.', from: 6 }, { text: 'Every one must be played.', from: 46 }]} size={L.capSize - 6} />
    </>
  );
}

// 6. The reveal: cards flip, the total counts up, the crown drops, gold bursts out.
const FINAL: { r: string; s: Suit; v: number }[] = [{ r: 'A', s: '♠', v: 1 }, { r: '2', s: '♥', v: 2 }, { r: '2', s: '♣', v: 2 }, { r: '4', s: '♦', v: 4 }];
export function Reveal(_: P) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout();
  const sum = FINAL.reduce((a, c) => a + c.v, 0);
  const shown = Math.round(ease(f, 44, 78, 0, sum));
  const numIn = spring({ frame: f - 40, fps, config: { damping: 14 } });
  const crown = spring({ frame: f - 84, fps, config: { damping: 9, mass: 0.8 } });
  const k = L.cw / 210; // scale the counter and crown with the cards
  return (
    <>
      <Felt />
      {FINAL.map((c, i) => (
        <Flip key={i} angle={ease(f, 10 + i * 7, 24 + i * 7, 0, 180)} back={<Back w={L.cw} />} face={<Face w={L.cw} rank={c.r} suit={c.s} />} style={abs(rowX(L, i), L.rowY, `rotate(${tilt(i)}deg)`)} />
      ))}
      <div style={{ ...abs(0, L.numY), width: L.W, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 22, opacity: numIn, transform: `scale(${lerp(0.6, 1, numIn)})` }}>
        <span style={{ fontFamily: FONT_CARD, fontWeight: 700, fontSize: 170 * k, lineHeight: 1, color: C.goldHi, textShadow: '0 6px 0 #3B2A12, 0 0 50px rgba(230,195,111,.5)' }}>{shown}</span>
        <span style={{ fontFamily: FONT_UI, fontWeight: 800, fontSize: 48 * k, color: C.muted, letterSpacing: '.08em' }}>POINTS</span>
      </div>
      {f >= 84 && <Crown x={L.cx} y={lerp(-300, L.rowY - 200 * k, crown)} w={200 * k} style={{ transform: `rotate(${lerp(-30, -6, crown)}deg)` }} />}
      <GoldBurst from={86} cx={L.cx} cy={L.rowY + L.cw * 0.7} />
      <Caption lines={[{ text: 'When the deck runs out, everyone flips.', from: 4, until: 80 }, { text: 'Lowest total wins.', from: 86 }]} size={L.capSize - 6} />
    </>
  );
}

// 7. The name, and the promise.
export function Finale(_: P) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = useLayout(), F = L.finale, k = F.wordSize / 176;
  const fan = spring({ frame: f, fps, config: { damping: 14, mass: 0.8 } });
  const word = spring({ frame: f - 8, fps, config: { damping: 14 } });
  const tag = spring({ frame: f - 26, fps, config: { damping: 16 } });
  const soon = spring({ frame: f - 44, fps, config: { damping: 10, mass: 0.7 } });
  const who = spring({ frame: f - 60, fps, config: { damping: 16 } });
  const shine = interpolate(f, [16, 80], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <>
      <Rays cx={L.cx} cy={F.raysCy} size={1300} />
      {[-21, -8, 5].map((deg, i) => (
        <div key={i} style={{ ...abs(L.cx - F.fanW / 2 + (i - 1) * F.fanW * 0.375, F.fanTop, `rotate(${deg * fan}deg) translateY(${(1 - fan) * 300}px)`), transformOrigin: '50% 110%', opacity: fan }}>
          <Back w={F.fanW} named />
        </div>
      ))}
      <div style={{ ...abs(L.cx - F.powerW / 2 + F.fanW * 0.625, F.fanTop - 20, `rotate(${17 * fan}deg) translateY(${(1 - fan) * 300 + Math.sin(f / 12) * 8}px)`), transformOrigin: '50% 110%', opacity: fan, filter: 'drop-shadow(0 0 40px rgba(230,195,111,.5))' }}>
        <Power w={F.powerW} rank="7" suit="♥" />
      </div>
      <div style={{ ...abs(0, F.wordY), width: L.W, textAlign: 'center', opacity: word, transform: `scale(${lerp(0.8, 1, word)})` }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: F.wordSize, lineHeight: 1, background: 'linear-gradient(100deg, #A87A2E 0%, #F1D58A 30%, #FFF6D6 45%, #E2B95F 60%, #A87A2E 100%)', backgroundSize: '220% 100%', backgroundPosition: `${shine}% 0`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 6px 0 #3B2A12) drop-shadow(0 0 50px rgba(230,195,111,.4))' }}>
          Charpati
        </span>
      </div>
      <div style={{ ...abs(60, F.tagY), width: L.W - 120, textAlign: 'center', fontFamily: FONT_CARD, fontWeight: 700, fontSize: 50 * k, lineHeight: 1.2, color: C.ivory, opacity: tag, transform: `translateY(${(1 - tag) * 30}px)` }}>
        Four cards. Hidden. Lowest total wins.
      </div>
      <div style={{ ...abs(0, F.soonY), width: L.W, display: 'flex', justifyContent: 'center', opacity: Math.min(1, soon * 1.4) }}>
        <span style={{ transform: `scale(${lerp(1.6, 1, soon)})`, padding: `${26 * k}px ${64 * k}px`, borderRadius: 999, border: `4px solid ${C.gold}`, background: 'rgba(14,9,24,.8)', boxShadow: `0 0 ${40 + Math.sin(f / 8) * 14}px rgba(230,195,111,.45)`, fontFamily: FONT_UI, fontWeight: 800, fontSize: 52 * k, letterSpacing: '.18em', color: C.goldHi }}>
          COMING SOON
        </span>
      </div>
      <div style={{ ...abs(0, F.whoY), width: L.W, textAlign: 'center', fontFamily: FONT_UI, fontWeight: 600, fontSize: 40 * k, color: C.muted, opacity: who }}>
        For 3 to 5 friends
      </div>
    </>
  );
}
