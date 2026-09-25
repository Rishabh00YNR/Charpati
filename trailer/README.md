# Charpati trailer

A 30-second vertical trailer (1080×1920, 30 fps) made with [Remotion](https://www.remotion.dev), in the same purple, gold and card style as the game and the website. It lives in its own folder with its own packages, so it never affects the website build.

```bash
npm install
npm run studio   # preview and scrub the trailer in the browser
npm run render   # writes out/charpati-trailer.mp4
```

## The scenes

| Time | Scene | On screen |
|---|---|---|
| 0–3s | open | One gold card spins in: "You get one look." |
| 3–8s | deal | Four cards land on the table, turn over (A♠ 5♥ 8♦ 3♣), then hide: "Four cards. Remember them." |
| 8–13s | swap | The 7 arrives with light rays and a SWAP! stamp; one card is swapped away blind |
| 13–17s | shuffle | The Queen: your cards are gathered, mixed and dealt back: "Where is your Ace now?" |
| 17–21s | powers | 7, K, Q and J fan in: "Sixteen power cards. Every one must be played." |
| 21–26s | reveal | Cards flip, the total counts up to 9, a crown drops, confetti: "Lowest total wins." |
| 26–30s | finale | Charpati, "Four cards. Hidden. Lowest total wins.", COMING SOON |

The on-screen lines double as subtitles, so the trailer still works with the sound off.

## Suggested voiceover (about 70 words)

Record one line per scene, leaving a short breath between them:

1. (0–3s) "You get one look."
2. (3–8s) "Four cards. Remember them, because they're about to go face down."
3. (8–13s) "Then your friends start playing. A seven swaps your card, blind."
4. (13–17s) "A queen shuffles everything you thought you knew."
5. (17–21s) "Sixteen power cards. Every one must be played."
6. (21–26s) "When the deck runs out, everyone flips. Lowest total wins."
7. (26–30s) "Charpati. Coming soon."

## Adding the voiceover and music

1. Put the files in `public/`, e.g. `public/voiceover.mp3` and `public/music.mp3`.
2. In `src/Root.tsx`, set `defaultProps` to `{ voiceover: 'voiceover.mp3', music: 'music.mp3' }`. Music plays at a quarter volume under the voice.
3. If the recording runs longer or shorter, change the seconds in `SCENES` in `src/theme.ts`. Every scene and the total length follow.
4. `npm run render` again.
