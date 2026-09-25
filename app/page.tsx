import { CardBack, CardFace, PowerCard, POWERS, type PowerRank, type Suit } from '@/components/Card';
import PeekGame from '@/components/PeekGame';
import TablePhone from '@/components/TablePhone';
import ShareButton from '@/components/ShareButton';

const POWER_CARDS: { rank: PowerRank; suit: Suit }[] = [
  { rank: '7', suit: '♥' },
  { rank: 'K', suit: '♠' },
  { rank: 'Q', suit: '♦' },
  { rank: 'J', suit: '♣' },
];

export default function Home() {
  return (
    <>
      <header className="nav">
        <a className="brand" href="#top">Charpati</a>
        <nav aria-label="Sections">
          <a href="#play">How it plays</a>
          <a href="#powers">Powers</a>
          <a className="nav-cta" href="#soon">Coming soon</a>
        </nav>
      </header>

      <main>
        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="eyebrow">A new card game · 3 to 5 players</p>
            <h1 className="wordmark">Charpati</h1>
            <p className="hero-line">Four cards. Hidden. Lowest total wins.</p>
            <p className="hero-sub">
              Char patti means four cards. You see yours once, then they go face down. Remember them, swap them, guard
              them, and hope nobody plays a Queen on you.
            </p>
            <div className="hero-ctas">
              <a className="btn big" href="#peek">Take the one-look test</a>
              <a className="btn ghost big" href="#soon">Coming soon</a>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="rays" />
            <div className="hero-felt" />
            <div className="fan">
              <CardBack named w={150} className="fan-1" />
              <CardBack named w={150} className="fan-2" />
              <CardBack named w={150} className="fan-3" />
              <PowerCard rank="7" suit="♥" w={170} className="fan-4" />
            </div>
          </div>
        </section>

        <section className="section" id="peek">
          <div className="head">
            <p className="eyebrow">The one-look test</p>
            <h2>You get one look. Then it gets tricky.</h2>
            <p>Peek at each card once. Watch the swaps. Then find your lowest card. That is Charpati in twenty seconds.</p>
          </div>
          <PeekGame />
        </section>

        <section className="section" id="play">
          <div className="head">
            <p className="eyebrow">How a round goes</p>
            <h2>Easy to learn. Hard to forget.</h2>
          </div>
          <ol className="steps">
            <li className="step">
              <div className="step-art">
                {[0, 1, 2, 3].map(i => <CardBack key={i} w={40} />)}
              </div>
              <span className="step-no">1</span>
              <h3>Deal</h3>
              <p>Everyone gets four cards. Look once, put them in any order, remember them. Then they go face down.</p>
            </li>
            <li className="step">
              <div className="step-art">
                <CardBack w={46} />
                <span className="arrow" />
                <CardFace rank="3" suit="♥" w={46} />
              </div>
              <span className="step-no">2</span>
              <h3>Draw</h3>
              <p>On your turn, draw from the pile. Swap it for one of your hidden cards, or throw it away.</p>
            </li>
            <li className="step">
              <div className="step-art">
                <PowerCard rank="Q" suit="♠" w={62} />
              </div>
              <span className="step-no">3</span>
              <h3>Powers</h3>
              <p>Draw a 7, J, Q or K and you must use its power. This is where friendships get tested.</p>
            </li>
            <li className="step">
              <div className="step-art">
                <span className="crown" />
                <CardFace rank="A" suit="♠" w={40} />
                <CardFace rank="2" suit="♦" w={40} />
              </div>
              <span className="step-no">4</span>
              <h3>Reveal</h3>
              <p>When the pile runs out, everyone flips. The lowest total takes the round.</p>
            </li>
          </ol>
        </section>

        <section className="section" id="powers">
          <div className="head">
            <p className="eyebrow">The power cards</p>
            <h2>Sixteen cards that change everything</h2>
            <p>Every 7, King, Queen and Jack waits in the draw pile. Draw one and you have to play it.</p>
          </div>
          <ul className="powers">
            {POWER_CARDS.map(p => (
              <li key={p.rank} className="power">
                <PowerCard rank={p.rank} suit={p.suit} w={176} />
                <h3>{p.rank} · {POWERS[p.rank].name}</h3>
                <p>{POWERS[p.rank].text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="section score">
          <div className="head">
            <p className="eyebrow">Scoring</p>
            <h2>Every point counts</h2>
            <p>Ace is 1. Two to Ten count as marked. Power cards never stay in a hand, so they never count.</p>
          </div>
          <div className="hands">
            <figure className="hand win">
              <span className="crown" aria-hidden="true" />
              <div className="hand-cards">
                {(['♠', '♥', '♦', '♣'] as Suit[]).map(s => <CardFace key={s} rank="A" suit={s} w={64} />)}
              </div>
              <figcaption><b>4</b> points. Wins.</figcaption>
            </figure>
            <span className="vs" aria-hidden="true">vs</span>
            <figure className="hand">
              <div className="hand-cards">
                {(['♠', '♥', '♦', '♣'] as Suit[]).map(s => <CardFace key={s} rank="2" suit={s} w={64} />)}
              </div>
              <figcaption><b>8</b> points. So close.</figcaption>
            </figure>
          </div>
        </section>

        <section className="section table">
          <div className="table-copy">
            <p className="eyebrow">Made for your phone</p>
            <h2>Pull up a chair</h2>
            <ul className="ticks">
              <li>You always sit at the bottom, with your four cards in front of you.</li>
              <li>Your friends sit around the gold rail. The next player is always on your left.</li>
              <li>Every power gets its moment: light rays, a stamp, and cards that fly across the table.</li>
              <li>Soon: play together from anywhere, each on your own phone.</li>
            </ul>
          </div>
          <TablePhone />
        </section>

        <section className="soon" id="soon">
          <div className="deck" aria-hidden="true">
            {[0, 1, 2, 3, 4].map(i => <CardBack key={i} named w={110} className={`deck-${i}`} />)}
          </div>
          <p className="eyebrow">The table is being set</p>
          <h2 className="soon-title">Coming soon</h2>
          <p className="soon-sub">Charpati is almost dealt. Find three or four friends who think they have a good memory.</p>
          <ShareButton />
          <ul className="facts">
            <li>3 to 5 players</li>
            <li>One 52-card deck</li>
            <li>16 power cards</li>
            <li>Lowest total wins</li>
          </ul>
        </section>
      </main>

      <footer className="foot">
        <span className="brand">Charpati</span>
        <span>© 2026 Charpati. Four cards, one look.</span>
      </footer>
    </>
  );
}
