# panels

One module per card on the Pocket Explorer page. A panel finds its elements by id, wires its buttons,
and shows state. It does not decide multi-step flows; `main.js` does that.

| File | Card | Creates |
| --- | --- | --- |
| `key-guide-tabs.js` | 00 — Get your session key | `setupKeyGuideTabs()` |
| `connection-panel.js` | 01 — Connection | `createConnectionPanel({ onFind, onFindAnyDevice, onDisconnect, onAuthenticate, onClaim })` |
| `device-info-panel.js` | 02 — Device information | `createDeviceInfoPanel({ connection })` |
| `gatt-explorer-panel.js` | 03 — GATT explorer | `createGattExplorerPanel({ connection, onReconnect })` |
| `recordings-panel.js` | 04 — Recordings | `createRecordingsPanel({ library, onDownload, onTranscribe })` |
| `diagnostics-panel.js` | 05 — Diagnostics | `setupDiagnosticsPanel()` |

Card 06 lives in `../transcription/`.

## The pattern

Every `create…Panel` returns an object with a `render(state)` method plus whatever the rest of the app
needs from it (e.g. `sessionKey()`, `exploreServices()`, `showTransferStatus(text)`).

```js
const panel = createRecordingsPanel({
  library,
  onDownload: recording => { /* … */ },
  onTranscribe: recording => { /* … */ },
});

panel.render({ connected: true, commandChannelReady: true, authenticated: true, connecting: false });
panel.showTransferStatus('Receiving 2048 / 9000 bytes');
```

`state` is built in one place, `refreshControls()` in `main.js`:

| Field | True when |
| --- | --- |
| `connected` | The Bluetooth link is up |
| `commandChannelReady` | Connected and the Pocket command + reply channels opened |
| `authenticated` | The Pocket accepted the session key |
| `connecting` | A connect flow is in progress (disables the find buttons) |

## Adding a panel

1. Add the card's HTML to `app/index.html` with ids for its controls.
2. Create `panels/<name>-panel.js` exporting `create<Name>Panel(deps)` that returns `{ render(state) }`.
3. Create it in `main.js` and call its `render` from `refreshControls()`.
