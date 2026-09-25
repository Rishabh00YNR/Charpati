import { AbsoluteFill, Html5Audio, Sequence, staticFile } from 'remotion';
import { Room, Scene } from './bits';
import { Deal, Finale, Open, Powers, Reveal, Shuffle, Swap } from './scenes';
import { LayoutContext } from './layout';
import { C, LANDSCAPE, PORTRAIT, SCENES, SCENE_FRAMES } from './theme';

const PARTS = [Open, Deal, Swap, Shuffle, Powers, Reveal, Finale];
const STARTS = SCENE_FRAMES.map((_, i) => SCENE_FRAMES.slice(0, i).reduce((a, b) => a + b, 0));

export type TrailerProps = {
  // An audio file in trailer/public, e.g. "voiceover.mp3". Empty = no sound.
  voiceover: string;
  // Optional background music in trailer/public, played quietly under the voiceover.
  music: string;
  // true = 1920x1080 layout, false = 1080x1920
  landscape: boolean;
};

export function Trailer({ voiceover, music, landscape }: TrailerProps) {
  return (
    <LayoutContext.Provider value={landscape ? LANDSCAPE : PORTRAIT}>
    <AbsoluteFill style={{ backgroundColor: C.deep }}>
      <Room />
      {PARTS.map((Part, i) => (
        <Sequence key={SCENES[i].id} name={SCENES[i].id} from={STARTS[i]} durationInFrames={SCENE_FRAMES[i]}>
          <Scene dur={SCENE_FRAMES[i]}>
            <Part dur={SCENE_FRAMES[i]} />
          </Scene>
        </Sequence>
      ))}
      {music ? <Html5Audio src={staticFile(music)} volume={0.25} /> : null}
      {voiceover ? <Html5Audio src={staticFile(voiceover)} /> : null}
    </AbsoluteFill>
    </LayoutContext.Provider>
  );
}
