// "06 — Transcribe on this device": model picker, model download, file drop, live transcript and exports.

import { byId, createElement, downloadBlob } from '../shared/dom.js';
import { log } from '../shared/log.js';
import { decodeToMono16k, SAMPLE_RATE } from './decode-audio.js';
import { formatClock, formatMegabytes, toSrt } from './format.js';
import { MODELS, SpeechEngine } from './speech-engine.js';

// A model counts as downloaded once 90% of its bytes are cached (sizes vary slightly between releases).
const DOWNLOADED_THRESHOLD = 0.9;

export function createTranscriptionPanel() {
  const ui = {
    section: byId('stt'),
    modelSelect: byId('sttModel'),
    languageField: byId('langWrap'),
    languageSelect: byId('sttLang'),
    info: byId('sttInfo'),
    downloadButton: byId('sttDownload'),
    removeButton: byId('sttRemove'),
    loadProgress: byId('sttLoad'),
    fileInput: byId('sttFile'),
    dropZone: byId('sttDrop'),
    runArea: byId('sttRun'),
    status: byId('sttStatus'),
    progress: byId('sttProgress'),
    cancelButton: byId('sttCancel'),
    transcript: byId('sttOut'),
    exportButtons: [byId('sttCopy'), byId('sttTxt'), byId('sttSrt')],
  };

  let engine = null;            // set once Edgewise has loaded
  let running = null;           // AbortController of the transcription in progress
  let result = null;            // last finished transcription: { text, segments, info }
  let exportName = 'transcript';

  const selectedModel = () => ui.modelSelect.value;

  // ---- Model management -------------------------------------------------

  async function loadEngine() {
    try {
      engine = await SpeechEngine.load({
        onWorkerError: message => {
          log(`Speech worker failed to start: ${message}`);
          ui.info.textContent = 'The speech worker failed to start. Reload the page and try again.';
        },
      });
      for (const model of MODELS) {
        const size = formatMegabytes(engine.variantFor(model.id).bytes);
        ui.modelSelect.append(new Option(`${model.label} · ${size} · ${model.note}`, model.id));
      }
      await showModelInfo();
    } catch (error) {
      ui.info.textContent = `Could not load Edgewise: ${error.message}`;
      log(`Edgewise: ${error.message}`);
    }
  }

  async function showModelInfo() {
    const id = selectedModel();
    const model = engine.model(id);
    const variant = engine.variantFor(id);
    const cachedBytes = await engine.cachedBytes(id);
    const isDownloaded = cachedBytes > variant.bytes * DOWNLOADED_THRESHOLD;
    const hardware = variant.devices.includes('webgpu') ? 'WebGPU (graphics card)' : 'WebAssembly (CPU)';
    const size = isDownloaded ? 'Downloaded' : `Download about ${formatMegabytes(variant.bytes)}`;

    ui.languageField.hidden = !engine.isMultilingual(id);
    ui.info.textContent = `${size} · runs on ${hardware} · ${model.params} parameters · ${model.license.toUpperCase()} licence`;
    ui.downloadButton.textContent = isDownloaded ? 'Model ready' : 'Download model';
    ui.downloadButton.disabled = isDownloaded;
    ui.removeButton.hidden = !cachedBytes;
  }

  /** A fresh handler per download/run: shows combined progress over all model files. */
  function createLoadProgressHandler() {
    const files = new Map();
    return event => {
      if (event.type === 'download') {
        files.set(event.file, event);
        let loaded = 0;
        let total = 0;
        for (const file of files.values()) {
          loaded += file.loaded;
          total += file.total || 0;
        }
        ui.loadProgress.hidden = false;
        ui.loadProgress.value = total ? loaded / total : 0;
        ui.info.textContent = `Downloading ${formatMegabytes(loaded)}${total ? ` of ${formatMegabytes(total)}` : ''}…`;
      } else if (event.type === 'compile') {
        ui.info.textContent = 'Preparing the model…';
      } else if (event.type === 'ready') {
        ui.loadProgress.hidden = true;
        log(`Speech model ready: ${event.model} on ${event.device} (${event.dtype})`);
      }
    };
  }

  ui.modelSelect.onchange = showModelInfo;

  ui.downloadButton.onclick = async () => {
    ui.downloadButton.disabled = true;
    try {
      await engine.download(selectedModel(), createLoadProgressHandler());
    } catch (error) {
      log(`Model download: ${error.message}`);
      ui.info.textContent = `Download failed: ${error.message}`;
    } finally {
      ui.loadProgress.hidden = true;
      await showModelInfo();
    }
  };

  ui.removeButton.onclick = async () => {
    const id = selectedModel();
    if (!confirm(`Remove the downloaded ${id} files from this browser?`)) return;
    const removed = await engine.remove(id);
    log(`Removed ${removed} cached file(s) for ${id}`);
    await showModelInfo();
  };

  // ---- Transcript display ------------------------------------------------

  function appendSegments(segments) {
    ui.transcript.querySelector('.live')?.remove();
    ui.transcript.querySelector('.muted')?.remove();
    for (const segment of segments) {
      ui.transcript.append(
        createElement('div', { className: 'seg' }, [
          createElement('time', { text: formatClock(segment.start) }),
          createElement('span', { text: segment.text }),
        ]),
      );
    }
    ui.transcript.scrollTop = ui.transcript.scrollHeight;
  }

  /** Text the model has produced but not yet finalised into a segment. */
  function showLiveText(text) {
    let line = ui.transcript.querySelector('.live');
    if (!line) {
      line = createElement('p', { className: 'live' });
      ui.transcript.append(line);
    }
    line.textContent = text;
    ui.transcript.scrollTop = ui.transcript.scrollHeight;
  }

  // ---- Transcription -----------------------------------------------------

  /** Transcribe an audio Blob or File. `name` titles the exported files. */
  async function transcribe(blob, name) {
    if (running) return log('A transcription is already running');
    if (!engine) return log('Edgewise is still loading');

    exportName = name.replace(/\.[^.]+$/, '');
    result = null;
    ui.section.scrollIntoView({ behavior: 'smooth' });
    ui.runArea.hidden = false;
    ui.transcript.replaceChildren();
    ui.exportButtons.forEach(button => (button.disabled = true));

    running = new AbortController();
    ui.cancelButton.hidden = false;
    const startedAt = performance.now();
    const elapsedSeconds = () => (performance.now() - startedAt) / 1000;

    try {
      ui.status.textContent = `Decoding ${name}…`;
      const audio = await decodeToMono16k(blob);
      const audioSeconds = audio.length / SAMPLE_RATE;
      const modelId = selectedModel();
      log(`Transcribing ${name} (${formatClock(audioSeconds)}) with ${modelId}`);

      ui.status.textContent = `Loading ${modelId}…`;
      ui.progress.value = 0;

      let liveText = '';
      const run = engine.transcribe({
        modelId,
        audio,
        sampleRate: SAMPLE_RATE,
        language: ui.languageSelect.value,
        signal: running.signal,
        onProgress: createLoadProgressHandler(),
        onSegment: (segments, { done, total }) => {
          liveText = '';
          appendSegments(segments);
          const secondsLeft = (elapsedSeconds() / done) * (total - done);
          ui.progress.value = done / total;
          ui.status.textContent = `Window ${done} of ${total} · ${Math.round((done / total) * 100)}% · about ${formatClock(secondsLeft)} left`;
        },
      });

      for await (const text of run) {
        liveText += text;
        showLiveText(liveText);
      }
      result = await run;
      ui.transcript.querySelector('.live')?.remove();

      const took = elapsedSeconds();
      ui.progress.value = 1;
      ui.status.textContent = `Done · ${formatClock(audioSeconds)} of audio in ${formatClock(took)} (${(audioSeconds / took).toFixed(1)}× real time) on ${result.info.device}`;
      if (!result.text) appendSegments([{ start: 0, text: '(no speech found)' }]);
      ui.exportButtons.forEach(button => (button.disabled = !result.text));
      await showModelInfo(); // the run may have downloaded the model
    } catch (error) {
      ui.status.textContent = error.name === 'AbortError' ? 'Cancelled' : `Failed: ${error.message}`;
      log(`Transcription: ${error.message}`);
    } finally {
      running = null;
      ui.cancelButton.hidden = true;
    }
  }

  ui.cancelButton.onclick = () => running?.abort();

  // ---- Input: file picker and drag & drop --------------------------------

  ui.fileInput.onchange = event => {
    const file = event.target.files?.[0];
    if (file) transcribe(file, file.name);
    event.target.value = ''; // allow picking the same file again
  };

  ui.dropZone.ondragover = event => {
    event.preventDefault();
    ui.dropZone.classList.add('over');
  };
  ui.dropZone.ondragleave = () => ui.dropZone.classList.remove('over');
  ui.dropZone.ondrop = event => {
    event.preventDefault();
    ui.dropZone.classList.remove('over');
    const file = event.dataTransfer?.files?.[0];
    if (file) transcribe(file, file.name);
  };

  // ---- Export ------------------------------------------------------------

  const [copyButton, txtButton, srtButton] = ui.exportButtons;
  copyButton.onclick = () => result && navigator.clipboard.writeText(result.text);
  txtButton.onclick = () => result && downloadBlob(new Blob([result.text], { type: 'text/plain' }), `${exportName}.txt`);
  srtButton.onclick = () => result && downloadBlob(new Blob([toSrt(result.segments)], { type: 'application/x-subrip' }), `${exportName}.srt`);

  loadEngine();
  return { transcribe };
}
