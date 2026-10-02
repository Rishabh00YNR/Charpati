'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BOT_NAMES, GEMS, type Gem } from '@/shared/engine';
import { GEM_COLOR, cleanCode, isCode, loadProfile, newCode, roomInfo, saveProfile, type Profile } from '@/lib/rooms';
import { layoutKind } from './layout';

// The Play screen: choose how to play, then one short step. Steps live in the address (#name,
// #solo, #join) so the phone's back button works.
type Step = 'home' | 'name' | 'solo' | 'join';
type After = 'friends' | 'solo' | null;

const GEM_NAME: Record<Gem, string> = { topaz: 'Topaz', ruby: 'Ruby', sapphire: 'Sapphire', emerald: 'Emerald', amethyst: 'Amethyst', turquoise: 'Turquoise', rose: 'Rose', pearl: 'Pearl' };
const PACES = [{ sec: 60, name: 'Relaxed' }, { sec: 30, name: 'Normal' }, { sec: 15, name: 'Quick' }];
const stepFromHash = (): Step => {
  const h = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
  return h === 'name' || h === 'solo' || h === 'join' ? h : 'home';
};

const Icon = ({ d, size = 20, w = 1.9 }: { d: string; size?: number; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const BACK = 'M15 6l-6 6 6 6';

export default function PlayHome() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('home');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [after, setAfter] = useState<After>(null);
  const [name, setName] = useState('');
  const [gem, setGem] = useState<Gem>('topaz');
  const [bots, setBots] = useState(2);
  const [pace, setPace] = useState(30);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wide, setWide] = useState(false); // laptops and desktops can play at bigger tables

  useEffect(() => {
    const p = loadProfile();
    if (p) { setProfile(p); setName(p.name); setGem(p.gem); }
    const sync = () => { setStep(stepFromHash()); setErr(''); window.scrollTo(0, 0); };
    sync();
    const size = () => setWide(layoutKind(window.innerWidth, window.innerHeight) === 'desktop');
    size();
    window.addEventListener('hashchange', sync);
    window.addEventListener('resize', size);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('resize', size); };
  }, []);

  const go = (s: Step) => {
    if (s === 'home') window.history.pushState(null, '', window.location.pathname);
    else window.location.hash = s;
    setStep(s);
    setErr('');
    window.scrollTo(0, 0);
  };
  const back = () => (window.history.length > 1 && step !== 'home' ? window.history.back() : go('home'));

  const createTable = () => router.push(`/play/${newCode()}?go=host`);
  const startSolo = () => router.push(`/play/${newCode()}?go=solo&bots=${bots}&t=${pace}`);

  function choose(a: 'friends' | 'solo' | 'join') {
    if (a === 'join') return go('join');
    if (!profile) { setAfter(a); return go('name'); }
    if (a === 'friends') createTable(); else go('solo');
  }

  function saveName(e: FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) return setErr('Type your name first.');
    const p = { name: nm, gem };
    saveProfile(p);
    setProfile(p);
    if (after === 'friends') return createTable();
    if (after === 'solo') { setAfter(null); return go('solo'); }
    back();
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    const c = cleanCode(code);
    if (!isCode(c)) return setErr('Table codes are 4 letters or numbers, like KQ7X.');
    setBusy(true);
    const info = await roomInfo(c);
    setBusy(false);
    if (!info) return setErr('Can’t reach the game server right now. Check your connection and try again.');
    if (info.phase === 'lobby' && info.players === 0) return setErr(`There’s no table called ${c}. Check the code with your friend.`);
    if (info.phase === 'closed') return setErr(`Table ${c} has closed. Make a new table instead.`);
    if (info.size === 'big' && !wide) return setErr(`Table ${c} is a big table for laptops and desktops. Open the link on a computer to join.`);
    router.push(`/play/${c}`);
  }

  // ---- Your name, the first time (or when you tap Change) ----
  if (step === 'name') {
    return (
      <main className="fl-page" aria-label="Your name">
        <div className="fl-top"><button type="button" className="fl-back" onClick={back} aria-label="Back"><Icon d={BACK} /></button></div>
        <form onSubmit={saveName} className="fl-form">
          <h1 className="fl-h1">What should we call you?</h1>
          <p className="fl-sub">Friends see this name and colour at the table. We remember it for next time.</p>
          <div className="fl-preview">
            <span className="fl-av big" style={{ ['--s' as string]: '80px', ['--gem' as string]: GEM_COLOR[gem] } as CSSProperties}>{(name.trim()[0] ?? '?').toUpperCase()}</span>
            <span className="pill">{name.trim() || 'Your name'}</span>
          </div>
          <label className="fl-caps fl-gap" htmlFor="pl-name">YOUR NAME</label>
          <input id="pl-name" className="fl-input" maxLength={12} autoComplete="nickname" autoFocus value={name} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="e.g. Ritesh" />
          <span className="fl-caps fl-gap">YOUR COLOUR</span>
          <div className="fl-gems" role="radiogroup" aria-label="Your colour">
            {GEMS.map(g => (
              <button key={g} type="button" role="radio" aria-checked={gem === g} className={gem === g ? 'on' : ''} onClick={() => setGem(g)} style={{ ['--gem' as string]: GEM_COLOR[g] } as CSSProperties}>
                <span className="dot" /><span className="nm">{GEM_NAME[g]}</span>
              </button>
            ))}
          </div>
          {err && <p className="fl-err" role="alert">{err}</p>}
          <button type="submit" className="btn big fl-cta">Continue</button>
        </form>
      </main>
    );
  }

  // ---- Practise with bots ----
  if (step === 'solo') {
    const names = BOT_NAMES.slice(0, bots);
    return (
      <main className="fl-page" aria-label="Practise with bots">
        <div className="fl-top"><button type="button" className="fl-back" onClick={back} aria-label="Back"><Icon d={BACK} /></button></div>
        <h1 className="fl-h1">Practise with bots</h1>
        <p className="fl-sub">Just you against the computer. No invites, no waiting.</p>
        <span className="fl-caps fl-gap">HOW MANY BOTS?</span>
        <div className="fl-seg" role="radiogroup" aria-label="Number of bots">
          {(wide ? [2, 3, 4, 5, 6, 7] : [2, 3, 4]).map(b => (
            <button key={b} type="button" role="radio" aria-checked={bots === b} className={bots === b ? 'on' : ''} onClick={() => setBots(b)}><b>{b}</b><small>bots</small></button>
          ))}
        </div>
        <div className="fl-who">
          <span className="avs">
            <span className="fl-av" style={{ ['--s' as string]: '30px', ['--gem' as string]: GEM_COLOR[profile?.gem ?? 'topaz'] } as CSSProperties}>{(profile?.name[0] ?? 'Y').toUpperCase()}</span>
            {names.map((b, i) => <span key={b} className="fl-av" style={{ ['--s' as string]: '30px', ['--gem' as string]: GEM_COLOR[GEMS.filter(g => g !== (profile?.gem ?? 'topaz'))[i]] } as CSSProperties}>{b[0]}</span>)}
          </span>
          <span>You, {names.slice(0, -1).join(', ')} and {names[names.length - 1]}</span>
        </div>
        <span className="fl-caps fl-gap">TIME PER TURN</span>
        <div className="fl-seg" role="radiogroup" aria-label="Time per turn">
          {PACES.map(p => (
            <button key={p.sec} type="button" role="radio" aria-checked={pace === p.sec} className={pace === p.sec ? 'on' : ''} onClick={() => setPace(p.sec)}><b>{p.sec}s</b><small>{p.name}</small></button>
          ))}
        </div>
        <p className="fl-hint"><Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5v.5" size={16} w={2} />Bots only know their own cards, just like you.</p>
        <button type="button" className="btn big fl-cta" onClick={startSolo}><Icon d="M4 7.5l7-1.5 2.6 12-7 1.5zM13 5.5l6.5 1.2-2.2 12" />Deal the cards</button>
        <p className="fl-foot">You get 45 seconds to memorise your cards.</p>
      </main>
    );
  }

  // ---- Join with a code ----
  if (step === 'join') {
    return (
      <main className="fl-page" aria-label="Join a table">
        <div className="fl-top"><button type="button" className="fl-back" onClick={back} aria-label="Back"><Icon d={BACK} /></button></div>
        <form onSubmit={join} className="fl-form">
          <h1 className="fl-h1">Join a table</h1>
          <p className="fl-sub">Type the code your friend sent you. It’s 4 letters or numbers.</p>
          <label className="fl-caps fl-gap" htmlFor="pl-code">TABLE CODE</label>
          <input id="pl-code" className="fl-input code" inputMode="text" autoCapitalize="characters" autoComplete="off" autoFocus value={code} onChange={e => { setCode(cleanCode(e.target.value)); setErr(''); }} placeholder="KQ7X" />
          {err && <p className="fl-err" role="alert">{err}</p>}
          <button type="submit" className="btn big fl-cta" disabled={busy}>{busy ? 'Checking…' : 'Join table'}</button>
        </form>
      </main>
    );
  }

  // ---- How do you want to play? ----
  return (
    <main className="fl-page" aria-label="Play Charpati">
      <div className="fl-fan" aria-hidden="true"><span /><span /><span /><span /></div>
      <h1 className="fl-word">Charpati</h1>
      <p className="fl-tag">The four-card memory game</p>
      {profile && (
        <div className="fl-me-chip">
          <span className="fl-av" style={{ ['--s' as string]: '32px', ['--gem' as string]: GEM_COLOR[profile.gem] } as CSSProperties}>{profile.name[0]?.toUpperCase()}</span>
          <span>Playing as <b>{profile.name}</b></span>
          <button type="button" onClick={() => { setAfter(null); go('name'); }}>Change</button>
        </div>
      )}
      <h2 className="fl-h2">How do you want to play?</h2>
      <div className="fl-tiles">
        <button type="button" className="fl-tile main" onClick={() => choose('friends')}>
          <span className="ic gold"><Icon d="M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M16.5 11.6a2.6 2.6 0 1 0 0-5.2M15.6 14.2c2.5.2 4.3 1.9 4.9 4.8" size={24} /></span>
          <span className="tx"><b>Play with friends</b><small>Make a table and send the link</small></span>
          <Icon d="M9 6l6 6-6 6" />
        </button>
        <button type="button" className="fl-tile" onClick={() => choose('solo')}>
          <span className="ic violet"><Icon d="M7 8h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3zM12 4.5V8M9.5 13v.1M14.5 13v.1M2.5 12.5v3M21.5 12.5v3" size={24} /></span>
          <span className="tx"><b>Practise with bots</b><small>Play right now against the computer</small></span>
          <Icon d="M9 6l6 6-6 6" />
        </button>
        <button type="button" className="fl-tile" onClick={() => choose('join')}>
          <span className="ic"><Icon d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M4 12h11M11 8l4 4-4 4" size={24} /></span>
          <span className="tx"><b>Join a table</b><small>Type the code a friend sent you</small></span>
          <Icon d="M9 6l6 6-6 6" />
        </button>
      </div>
      <div className="fl-row fl-bottom">
        <a className="fl-link" href="/#play">How to play</a>
        <span className="fl-small">{wide ? '3 to 8 players' : '3 to 5 players'} · 10 min</span>
      </div>
    </main>
  );
}
