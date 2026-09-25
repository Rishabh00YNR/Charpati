import type { CSSProperties } from 'react';
import { CardBack, CardFace } from './Card';

// A still of the real game screen, laid out on the game's own 390 x 844 stage and scaled into a phone.
const GEMS = { topaz: '#F0B53A', ruby: '#E8503F', sapphire: '#4F8DF5', emerald: '#3FBF8A', amethyst: '#C39BFF' };
const SEATS = [
  { name: 'Karan', gem: GEMS.emerald, ax: 40, ay: 300, gx: 72, gy: 265, next: true },
  { name: 'Dev', gem: GEMS.amethyst, ax: 118, ay: 95, gx: 89, gy: 142 },
  { name: 'Asha', gem: GEMS.ruby, ax: 272, ay: 95, gx: 243, gy: 142 },
  { name: 'Ravi', gem: GEMS.sapphire, ax: 350, ay: 300, gx: 259, gy: 265 },
];
const HAND = [{ x: 63, y: 524, r: -7 }, { x: 131, y: 516, r: -2.5 }, { x: 199, y: 516, r: 2.5 }, { x: 267, y: 524, r: 7 }];
const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({ position: 'absolute', left: x, top: y, ...extra });

export default function TablePhone() {
  return (
    <div className="phone" role="img" aria-label="The Charpati table on a phone: you sit at the bottom with four face-down cards, four friends sit around a purple table, and the draw pile glows because it is your turn.">
      <div className="phone-screen">
        <div className="stage" aria-hidden="true">
          <span className="st-brand" style={at(16, 26)}>Charpati</span>
          <div className="st-felt" />
          {SEATS.map(s => (
            <div key={s.name}>
              <span className="st-av" style={at(s.ax, s.ay, { ['--gem' as string]: s.gem })}>{s.name[0]}</span>
              <span className="st-pill" style={at(s.ax, s.ay + 27)}>{s.name}</span>
              {s.next && <span className="st-tag" style={at(s.ax, s.ay + 47)}>NEXT</span>}
              {[0, 1, 2, 3].map(i => (
                <CardBack key={i} w={28} style={at(s.gx + (i % 2) * 31, s.gy + Math.floor(i / 2) * 42)} />
              ))}
            </div>
          ))}
          <div className="st-ticker" style={at(50, 232)}><i style={{ background: GEMS.sapphire }} />Ravi swapped card 3 and threw away 9♠&#xFE0E;</div>
          <CardBack w={54} style={at(140, 364, { opacity: 0.5 })} />
          <CardBack w={54} style={at(137, 361, { opacity: 0.8 })} />
          <CardBack w={54} className="st-glow" style={at(134, 358)} />
          <CardFace rank="9" suit="♠" w={54} style={at(204, 358, { rotate: '6deg' })} />
          <span className="st-label" style={at(161, 448, { color: '#F1DC9E' })}>23 LEFT</span>
          <span className="st-label" style={at(231, 448)}>THROWN</span>
          {HAND.map((h, i) => (
            <div key={i} style={at(h.x, h.y, { rotate: `${h.r}deg` })}>
              <CardBack w={60} />
              <span className="st-pos">{i + 1}</span>
            </div>
          ))}
          <div className="st-plate" style={at(70, 648)}>
            <span className="st-av in" style={{ ['--gem' as string]: GEMS.topaz }}>M</span>
            <b>Meera</b>
            <span className="st-chip">YOUR TURN</span>
          </div>
          <p className="st-msg" style={at(20, 712)}>Tap the glowing pile to draw. Only you see the card.</p>
          <span className="st-btn" style={at(20, 770)}>Draw a card</span>
        </div>
      </div>
    </div>
  );
}
