# transcription

Speech-to-text that runs entirely in the browser, using [Edgewise](https://kucukkanat.github.io/edgewise/).
Models download once, are cached by the browser, and run in a Web Worker (WebGPU when available, otherwise WebAssembly).

| File | What it does |
| --- | --- |
| `transcription-panel.js` | Card 06 on the page. `createTranscriptionPanel()` returns `{ transcribe(blob, name) }` |
| `speech-engine.js` | `SpeechEngine`: loads Edgewise, picks model variants, downloads/removes models, runs transcription. `MODELS` lists the dropdown entries. |
| `decode-audio.js` | `decodeToMono16k(blob)` → `Float32Array` at `SAMPLE_RATE` (16 kHz) |
| `format.js` | `formatMegabytes`, `formatClock`, `formatSrtTimestamp`, `toSrt` |

## Usage

From the page (what `main.js` does for the Transcribe button):

```js
import { createTranscriptionPanel } from './transcription/transcription-panel.js';

const transcription = createTranscriptionPanel();
transcription.transcribe(mp3Blob, '20261015120000'); // shows progress and the transcript in card 06
```

Without the panel:

```js
import { SpeechEngine } from './transcription/speech-engine.js';
import { decodeToMono16k, SAMPLE_RATE } from './transcription/decode-audio.js';
import { toSrt } from './transcription/format.js';

const engine = await SpeechEngine.load();
const audio = await decodeToMono16k(file);
const run = engine.transcribe({ modelId: 'whisper-base', audio, sampleRate: SAMPLE_RATE, language: 'auto' });

for await (const text of run) console.log('partial:', text); // optional: stream text as it arrives
const result = await run;                                    // { text, segments: [{ start, end, text }], info }
const subtitles = toSrt(result.segments);
```

Pass `signal` (from an `AbortController`) to cancel, `onSegment(segments, { done, total })` for progress
and `onProgress(event)` for model download events.

## Adding a model

Add an entry to `MODELS` in `speech-engine.js`. The `id` must exist in the Edgewise registry.
