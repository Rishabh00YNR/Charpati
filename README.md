# Charpati

Four cards. Hidden. Lowest total wins. This repo holds the playable game and its one-page coming-soon website.

## Website

One-page showcase for Charpati, ending in "Coming soon". Next.js (App Router), no other dependencies.

```bash
npm install
npm run dev     # http://localhost:3100
npm run build   # production build
npm start       # serve the build on http://localhost:3100
```

- `app/page.tsx`: every section of the page, top to bottom
- `app/globals.css`: colours, type and motion (same purple, gold and card style as the game)
- `components/PeekGame.tsx`: the "one-look test" mini-game (peek, watch three swaps, find your lowest card)
- `components/TablePhone.tsx`: a still of the real table screen inside a phone
- `components/ShareButton.tsx`: shares the page, or copies the link where sharing isn't available
- `public/cards/`: the card artwork (SVG)

To put it online, import this repo in Vercel. No settings or environment variables are needed.

## Game

`game/index.html` is the playable game: one self-contained HTML file, pass-the-phone for 3 to 5 players for now. It isn't part of the website build; open it directly in a browser.
