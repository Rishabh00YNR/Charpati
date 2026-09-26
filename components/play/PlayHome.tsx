'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { GEMS, type Gem } from '@/shared/engine';
import { GEM_COLOR, cleanCode, isCode, loadProfile, newCode, roomInfo, saveProfile } from '@/lib/rooms';

export default function PlayHome() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [gem, setGem] = useState<Gem>('topaz');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    if (p) { setName(p.name); setGem(p.gem); }
  }, []);

  const remember = () => saveProfile({ name: name.trim(), gem });

  function create() {
    if (!name.trim()) return setErr('Type your name first.');
    remember();
    router.push(`/play/${newCode()}`);
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    const c = cleanCode(code);
    if (!name.trim()) return setErr('Type your name first.');
    if (!isCode(c)) return setErr('Room codes are 4 letters or numbers, like KQ7X.');
    setBusy(true);
    const info = await roomInfo(c);
    setBusy(false);
    if (!info) return setErr('Can’t reach the game server right now. Check your connection and try again.');
    if (info.phase === 'lobby' && info.players === 0) return setErr(`There’s no room called ${c}. Check the code with your friend.`);
    remember();
    router.push(`/play/${c}`);
  }

  return (
    <main className="pl-home">
      <h1>Charpati</h1>
      <p className="lead">Play with 3 to 5 friends, each on your own phone.</p>

      <section className="pl-panel" aria-labelledby="you-h">
        <h2 id="you-h">You</h2>
        <label className="pl-field" htmlFor="pl-name">
          Your name
          <input id="pl-name" maxLength={12} autoComplete="nickname" value={name} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="e.g. Ritesh" />
        </label>
        <div className="pl-field">
          Your colour
          <div className="pl-gems">
            {GEMS.map(g => (
              <button key={g} type="button" className={`pl-gem${gem === g ? ' on' : ''}`} style={{ ['--gem' as string]: GEM_COLOR[g] }} onClick={() => setGem(g)} aria-label={g} aria-pressed={gem === g} />
            ))}
          </div>
        </div>
      </section>

      <section className="pl-panel" aria-labelledby="new-h">
        <h2 id="new-h">Start a new room</h2>
        <button type="button" className="btn big" onClick={create}>Create a room</button>
      </section>

      <p className="pl-or">OR</p>

      <form className="pl-panel" onSubmit={join} aria-labelledby="join-h">
        <h2 id="join-h">Join a friend</h2>
        <label className="pl-field" htmlFor="pl-code">
          Room code
          <input id="pl-code" inputMode="text" autoCapitalize="characters" autoComplete="off" value={code} onChange={e => { setCode(cleanCode(e.target.value)); setErr(''); }} placeholder="KQ7X" />
        </label>
        <button type="submit" className="btn ghost big" disabled={busy}>{busy ? 'Checking…' : 'Join room'}</button>
      </form>

      <p className="pl-err" role="alert">{err}</p>
    </main>
  );
}
