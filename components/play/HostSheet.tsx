'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { TIMER, type Move, type View } from '@/shared/engine';
import { GEM_COLOR } from '@/lib/rooms';

// The host's panel: turn timer, rename or remove a player, end the game now, start a new game.
// Anything that removes someone or ends the game needs a second tap.
export default function HostSheet({ view, send, onClose }: { view: View; send: (m: Move) => void; onClose: () => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null); // a bot being renamed
  const twice = (key: string, act: () => void) => {
    if (confirm === key) { act(); setConfirm(null); } else setConfirm(key);
  };
  const inGame = view.phase === 'memorize' || view.phase === 'play';
  const others = view.seats.map((s, i) => ({ s, i })).filter(({ i }) => i !== view.you);

  function saveName(e: FormEvent, seat: number) {
    e.preventDefault();
    if (editing && editing.name.trim()) send({ t: 'renameBot', seat, id: editing.id, name: editing.name });
    setEditing(null);
  }

  return (
    <>
      <div className="pl-sheet-bg" onClick={onClose} />
      <div className="pl-sheet" role="dialog" aria-modal="true" aria-labelledby="host-h">
        <h2 id="host-h">Host controls</h2>

        <div className="pl-host-row">
          <span>Turn timer</span>
          <div className="pl-stepper">
            <button type="button" onClick={() => send({ t: 'timer', sec: view.timerSec - TIMER.step })} disabled={view.timerSec <= TIMER.min} aria-label="Less time">−</button>
            <b>{view.timerSec}s</b>
            <button type="button" onClick={() => send({ t: 'timer', sec: view.timerSec + TIMER.step })} disabled={view.timerSec >= TIMER.max} aria-label="More time">+</button>
          </div>
        </div>
        {inGame && <p>A new time applies from the next turn.</p>}

        <div className="pl-host-list" aria-label="Players">
          {others.length === 0 && <p>Nobody else has sat down yet.</p>}
          {others.map(({ s, i }) => {
            const key = `kick:${s.id}`;
            if (editing?.id === s.id) {
              return (
                <form key={s.id} className="pl-host-player" onSubmit={e => saveName(e, i)}>
                  <span className="dot" style={{ ['--gem' as string]: GEM_COLOR[s.gem] } as CSSProperties} />
                  <input className="pl-host-input" autoFocus maxLength={12} value={editing.name} onChange={e => setEditing({ id: s.id, name: e.target.value })} aria-label={`New name for ${s.name}`} />
                  <button type="submit" className="btn sm">Save</button>
                </form>
              );
            }
            return (
              <div key={s.id} className="pl-host-player">
                <span className="dot" style={{ ['--gem' as string]: GEM_COLOR[s.gem] } as CSSProperties} />
                <span className="nm">{s.name}</span>
                <span className="st">{s.kicked ? 'Removed' : s.robot ? 'Bot' : s.bot ? 'Bot playing' : s.connected ? 'Here' : 'Away'}</span>
                {s.robot && !s.kicked && (
                  <button type="button" className="btn ghost sm" onClick={() => { setEditing({ id: s.id, name: s.name }); setConfirm(null); }}>Rename</button>
                )}
                {!s.kicked && (
                  <button type="button" className={`btn ghost sm${confirm === key ? ' warn' : ''}`} onClick={() => twice(key, () => send({ t: 'kick', seat: i, id: s.id }))}>
                    {confirm === key ? 'Tap again' : 'Remove'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {view.phase === 'lobby' && view.seats.length < view.limit && (
          <button type="button" className="btn ghost big" onClick={() => send({ t: 'addBot' })}>+ Add a bot</button>
        )}
        {inGame && others.length > 0 && <p>Removing someone mid-game hands their cards to a bot until the game ends.</p>}

        {inGame && (
          <button type="button" className={`btn ghost big${confirm === 'end' ? ' warn' : ''}`} onClick={() => twice('end', () => { send({ t: 'endGame' }); onClose(); })}>
            {confirm === 'end' ? 'Tap again to end the game now' : 'End this game now'}
          </button>
        )}
        {view.phase === 'end' && <button type="button" className="btn big" onClick={() => { send({ t: 'rematch' }); onClose(); }}>Start a new game</button>}
        <button type="button" className="btn big" onClick={onClose}>Done</button>
      </div>
    </>
  );
}
