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

## Online rooms (`/play`)

Friends each play on their own phone: create a room, share the code or link, and play at the same table.

- `shared/engine.ts`: the rules, run only on the room server. It holds the deck and every hand, checks every move, runs the turn timer (the host sets 15–120 s), and hands a seat to a bot after 3 missed turns. `viewFor()` builds what one player may see; hidden cards never leave the server.
- `server/`: the room server, one Cloudflare Durable Object per room code (PartyServer). Live at `charpati-rooms.charpati-rooms.workers.dev`.
- `app/play/`, `components/play/`, `lib/rooms.ts`: the create/join page and the room screen.

```bash
node shared/engine.check.mjs                    # stress-test the rules (hundreds of random games)
cd server && npm install && npm run dev         # local room server on 127.0.0.1:1999
node server/test/online.check.mjs               # full game over the network against the local server
cd server && npm run deploy                     # deploy the room server (needs `npx wrangler login` once)
```

The website talks to the live room server in production and to the local one during `npm run dev`; `NEXT_PUBLIC_ROOMS_HOST` overrides both.

## Game (pass-the-phone)

`game/index.html` is the original one-phone version: one self-contained HTML file. It isn't part of the website build; open it directly in a browser.
