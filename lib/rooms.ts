import type { Gem } from '@/shared/engine';

// Where the room server lives: the deployed Cloudflare worker in production, and `npm run dev` in
// server/ while developing. NEXT_PUBLIC_ROOMS_HOST overrides both.
export const ROOMS_HOST =
  process.env.NEXT_PUBLIC_ROOMS_HOST ||
  (process.env.NODE_ENV === 'production' ? 'charpati-rooms.charpati-rooms.workers.dev' : '127.0.0.1:1999');
const local = /^(127\.|localhost)/.test(ROOMS_HOST);
export const roomsHttp = `${local ? 'http' : 'https'}://${ROOMS_HOST}`;

// Room codes skip look-alike characters (no I, O, 0 or 1), so they're easy to read out.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), n => CODE_CHARS[n % CODE_CHARS.length]).join('');
export const cleanCode = (s: string) => s.toUpperCase().split('').filter(c => CODE_CHARS.includes(c)).join('').slice(0, 6);
export const isCode = (s: string) => /^[A-HJ-NP-Z2-9]{4,6}$/.test(s);

export type RoomInfo = { phase: 'lobby' | 'memorize' | 'play' | 'end'; players: number; open: boolean };
export async function roomInfo(code: string): Promise<RoomInfo | null> {
  try {
    const res = await fetch(`${roomsHttp}/parties/room/${code}`, { cache: 'no-store' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Saved on this phone only. The seat pass lets a phone that locked or lost signal rejoin its own seat.
export type Profile = { name: string; gem: Gem };
const read = <T,>(key: string): T | null => { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };
export const loadProfile = () => read<Profile>('charpati:profile');
export const saveProfile = (p: Profile) => write('charpati:profile', p);
export const loadSeatToken = (code: string) => read<string>(`charpati:seat:${code}`);
export const saveSeatToken = (code: string, token: string) => write(`charpati:seat:${code}`, token);
export const clearSeatToken = (code: string) => { try { localStorage.removeItem(`charpati:seat:${code}`); } catch { /* ignore */ } };

export const GEM_COLOR: Record<Gem, string> = { topaz: '#F0B53A', ruby: '#E8503F', sapphire: '#4F8DF5', emerald: '#3FBF8A', amethyst: '#C39BFF' };
