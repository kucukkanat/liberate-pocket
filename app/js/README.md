# Pocket Explorer JavaScript

Plain ES modules, no build step. `app/index.html` loads `main.js` with `<script type="module">`.

## Map

```
main.js                 Entry point: creates everything and runs the multi-step flows
│                       (connect, authenticate, claim).
├── pocket/             Talking to the Pocket over Bluetooth. No DOM.
├── panels/             One module per card on the page. Shows state, handles clicks.
├── transcription/      On-device speech-to-text with Edgewise.
└── shared/             DOM helpers, the diagnostic log, key storage.
```

Each folder has its own README with usage examples.

## How the pieces fit

```
             clicks                         commands (APP&…)
  panels/  ─────────►  main.js  ─────────►  pocket/  ─────────►  Pocket (BLE)
     ▲                                         │
     └──────────── replies / state ◄───────────┘   replies (MCU&…), MP3 bytes
```

1. A panel reports a click to `main.js` (or, for simple actions, calls `pocket/` directly).
2. `pocket/connection.js` writes the command and waits for the matching reply.
3. Modules that care about a reply type subscribe with `connection.onReply(...)`:
   the device-info panel shows `BAT`/`FW`/…, the recording library collects `DIRS`/`F`,
   the downloader handles `U`/`OFF`.
4. After anything that changes the connection state, `main.js` calls `refreshControls()`,
   which passes `{ connected, commandChannelReady, authenticated, connecting }` to every panel's `render()`.

## Where to start reading

- Want the user flow? Read `main.js` top to bottom.
- Want the protocol? Read `pocket/commands.js`, then `pocket/README.md`.
- Want to change a card on the page? Find its file in `panels/` (named after the card).

## Running locally

Serve the repository root with any static server (`python3 -m http.server 8000`) and open
`http://localhost:8000/app/`. ES modules do not load from `file://`.
Web Bluetooth needs Chrome or Edge on `https://` or `localhost`.
