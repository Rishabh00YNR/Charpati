'use client';

import { useState, type CSSProperties } from 'react';
import { TIMER, type Move, type View } from '@/shared/engine';
import { GEM_COLOR } from '@/lib/rooms';

// The host's panel: turn timer, remove a player, end the game now, start a new game.
// Anything that removes someone or ends the game needs a second tap.
export default function HostSheet({ view, send, onClose }: { view: View; send: (m: Move) => void; onClose: () => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const twice = (key: string, act: () => void) => {
    if (confirm === key) { act(); setConfirm(null); } else setConfirm(key);
  };
  const inGame = view.phase === 'memorize' || view.phase === 'play';
  const others = view.seats.map((s, i) => ({ s, i })).filter(({ i }) => i !== view.you);

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
            return (
              <div key={s.id} className="pl-host-player">
                <span className="dot" style={{ ['--gem' as string]: GEM_COLOR[s.gem] } as CSSProperties} />
                <span className="nm">{s.name}</span>
                <span className="st">{s.kicked ? 'Removed' : s.bot ? 'Bot playing' : s.connected ? 'Here' : 'Away'}</span>
                {!s.kicked && (
                  <button type="button" className={`btn ghost sm${confirm === key ? ' warn' : ''}`} onClick={() => twice(key, () => send({ t: 'kick', seat: i, id: s.id }))}>
                    {confirm === key ? 'Tap again' : 'Remove'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
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
