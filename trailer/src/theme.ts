import { loadFont as loadCinzel } from '@remotion/google-fonts/Cinzel';
import { loadFont as loadCinzelDecorative } from '@remotion/google-fonts/CinzelDecorative';
import { loadFont as loadFigtree } from '@remotion/google-fonts/Figtree';

export const FONT_CARD = loadCinzel('normal', { weights: ['700'], subsets: ['latin'] }).fontFamily;
export const FONT_DISPLAY = loadCinzelDecorative('normal', { weights: ['700'], subsets: ['latin'] }).fontFamily;
export const FONT_UI = loadFigtree('normal', { weights: ['600', '800'], subsets: ['latin'] }).fontFamily;

// Same palette as the game and the website.
export const C = {
  room: '#150E22',
  deep: '#0A0612',
  lift: '#2A1D40',
  felt: '#3A2F52',
  ivory: '#F5EFE0',
  ink: '#1C1A16',
  red: '#A3261C',
  gold: '#E6C36F',
  goldHi: '#F1DC9E',
  brass: '#C9A04F',
  muted: '#B7AACB',
};
export const GOLD_TEXT = 'linear-gradient(180deg, #FCEFC0 0%, #E2B95F 45%, #A87A2E 72%, #F1D58A 100%)';

// Scene lengths in seconds, in order. Re-time these to fit the voiceover; the video length follows.
export const FPS = 30;
export const SCENES = [
  { id: 'open', seconds: 3 },
  { id: 'deal', seconds: 5 },
  { id: 'swap', seconds: 5 },
  { id: 'shuffle', seconds: 4 },
  { id: 'powers', seconds: 4 },
  { id: 'reveal', seconds: 5 },
  { id: 'finale', seconds: 4 },
] as const;
export const SCENE_FRAMES = SCENES.map(s => Math.round(s.seconds * FPS));
export const TOTAL_FRAMES = SCENE_FRAMES.reduce((a, b) => a + b, 0);

// Where things sit in each shape of video. Scenes read these instead of fixed numbers.
export type Layout = {
  W: number; H: number; cx: number;
  cw: number; rowY: number; rowGap: number;
  felt: { cy: number; w: number; h: number };
  capTop: number; capBottom: number; capSize: number; capSizeSmall: number;
  open: { cy: number; w: number; capY: number };
  power: { cx: number; cy: number; w: number; stampY: number; stampSize: number };
  fan: { top: number; w: number; spread: number; raysCy: number };
  numY: number;
  finale: { raysCy: number; fanTop: number; fanW: number; powerW: number; wordY: number; wordSize: number; tagY: number; soonY: number; whoY: number };
};

export const PORTRAIT: Layout = {
  W: 1080, H: 1920, cx: 540,
  cw: 210, rowY: 880, rowGap: 30,
  felt: { cy: 1020, w: 1020, h: 600 },
  capTop: 470, capBottom: 1370, capSize: 86, capSizeSmall: 76,
  open: { cy: 1000, w: 380, capY: 560 },
  power: { cx: 540, cy: 600, w: 300, stampY: 250, stampSize: 150 },
  fan: { top: 790, w: 290, spread: 175, raysCy: 1050 },
  numY: 1370,
  finale: { raysCy: 640, fanTop: 380, fanW: 240, powerW: 260, wordY: 1000, wordSize: 176, tagY: 1236, soonY: 1392, whoY: 1590 },
};

export const LANDSCAPE: Layout = {
  W: 1920, H: 1080, cx: 960,
  cw: 190, rowY: 470, rowGap: 40,
  felt: { cy: 610, w: 1300, h: 520 },
  capTop: 100, capBottom: 915, capSize: 72, capSizeSmall: 64,
  open: { cy: 590, w: 320, capY: 150 },
  power: { cx: 290, cy: 560, w: 280, stampY: 150, stampSize: 120 },
  fan: { top: 370, w: 260, spread: 190, raysCy: 620 },
  numY: 900,
  finale: { raysCy: 280, fanTop: 70, fanW: 190, powerW: 210, wordY: 400, wordSize: 150, tagY: 600, soonY: 720, whoY: 900 },
};

// x of card i in the row of four, centred.
export const rowX = (L: Layout, i: number) => L.cx - (4 * L.cw + 3 * L.rowGap) / 2 + i * (L.cw + L.rowGap);
