import { Composition } from 'remotion';
import { Trailer } from './Trailer';
import { FPS, TOTAL_FRAMES } from './theme';

// Set voiceover/music to file names in public/ (e.g. 'voiceover.mp3') once they exist.
const SOUND = { voiceover: '', music: '' };

export function RemotionRoot() {
  return (
    <>
      {/* Vertical 1080x1920 for Reels, Shorts and WhatsApp status */}
      <Composition id="Trailer" component={Trailer} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ ...SOUND, landscape: false }} />
      {/* Landscape 1920x1080 for YouTube, the website and presentations */}
      <Composition id="TrailerLandscape" component={Trailer} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ ...SOUND, landscape: true }} />
    </>
  );
}
