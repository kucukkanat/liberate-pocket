# pocket

Everything about talking to a Pocket recorder over Web Bluetooth. Nothing here touches the page:
each class takes a `log(message)` function and exposes listeners instead.

| File | What it does |
| --- | --- |
| `connection.js` | `PocketConnection`: pick a device, connect, open the command/reply/audio channels, `send` and `request` |
| `commands.js` | One function per Pocket command (`authenticate`, `listDateFolders`, `setClock`, …) |
| `recording-library.js` | `RecordingLibrary`: lists date folders and recordings, keeps the result |
| `recording-downloader.js` | `RecordingDownloader`: streams one recording's MP3 and returns a `Blob` |
| `replies.js` | Splits a notification into replies and parses `MCU&TYPE&field&field` |
| `reply-waiter.js` | `ReplyWaiter`: "resolve with the next reply starting with X, or time out" |
| `session-key.js` | `generateSessionKey()` and `SESSION_KEY_LENGTH` (16) |
| `uuids.js` | Service/characteristic UUIDs, `expandUuid`, `parseServiceUuidList` |

## Usage

```js
import { PocketConnection } from './pocket/connection.js';
import { authenticate, requestDeviceInfo } from './pocket/commands.js';
import { RecordingLibrary } from './pocket/recording-library.js';
import { RecordingDownloader } from './pocket/recording-downloader.js';

const pocket = new PocketConnection({ log: console.log });
const library = new RecordingLibrary(pocket);
const downloader = new RecordingDownloader(pocket, { onStatus: console.log });

pocket.onReply(reply => console.log(reply.type, reply.fields)); // every MCU&… reply
pocket.onDisconnect(() => console.log('gone'));

await pocket.connect();                         // must run from a click (browser rule)
if (await authenticate(pocket, 'K7Q2M9XR4T1BZ8WA')) {
  await library.loadEverything();               // all recordings + set the clock
  const [newest] = library.sortedRecordings();  // { date, name, seconds }
  const mp3 = await downloader.download(newest); // Blob, audio/mpeg
}
```

Lower level, for a command without a helper:

```js
const reply = await pocket.request('APP&BAT', 'MCU&BAT&'); // → { type: 'BAT', fields: ['87'], text, isFromDevice }
await pocket.send('APP&STE');                               // fire and forget
```

## The protocol in one table

Commands are UTF-8 text written to the command characteristic. Replies arrive as notifications on the
reply characteristic; one notification can hold several replies back to back.

| Command | Reply | Meaning |
| --- | --- | --- |
| `APP&SK&<key>` | `MCU&SK&OK` / `MCU&SK&ERR` | Authenticate. A freshly reset Pocket accepts and binds to the first key. |
| `APP&BAT` | `MCU&BAT&<percent>` | Battery |
| `APP&FW` | `MCU&FW&<version>` | Firmware |
| `APP&WF` | `MCU&WF&<version>` | Wi-Fi firmware |
| `APP&SPACE` | `MCU&SPA&<used>&<total>` | Storage in MB |
| `APP&STE` | `MCU&STE&<state>` | Device state |
| `APP&LIST_DIRS` | `MCU&DIRS&<date>` …, then `MCU&DIRS_SUM&<n>` | Date folders |
| `APP&LIST&<date>` | `MCU&F&<date>&<name>&<seconds>` …, then `MCU&LIST&<n>` | Recordings on a date |
| `APP&T&<yyyymmddhhmmss>` | `MCU&T&…` | Set clock (UTC) |
| `APP&U&<date>&<name>` | `MCU&U&<bytes>`, MP3 bytes on the audio characteristic, maybe `MCU&OFF` | Download |

The app never sends delete commands.

## Channels

| Characteristic | Role |
| --- | --- |
| `001120a2-…` command | We write commands. If missing, commands go to the reply characteristic instead. |
| `001120a3-…` reply | Pocket notifies replies. Required. |
| `001120a1-…` audio | Pocket notifies MP3 bytes. Optional; without it downloads are disabled. |
