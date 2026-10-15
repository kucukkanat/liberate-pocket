// SpeechEngine: a thin wrapper around the Edgewise library, which runs speech-to-text models in the browser.
// Models run in a Web Worker so the page stays responsive.

// Edgewise's browser bundle, served by its docs site and rebuilt on every Edgewise release.
const EDGEWISE_URL = 'https://kucukkanat.github.io/edgewise/lib/index.js';

/** Models offered in the dropdown, in display order. */
export const MODELS = [
  { id: 'moonshine-base', label: 'Moonshine Base', note: 'English · best accuracy for its size' },
  { id: 'whisper-base', label: 'Whisper Base', note: '99 languages · segment timestamps' },
  { id: 'whisper-small', label: 'Whisper Small', note: '99 languages · most accurate, larger' },
  { id: 'moonshine-tiny', label: 'Moonshine Tiny', note: 'English · fastest, least accurate' },
];

export class SpeechEngine {
  #edgewise;
  #capabilities;
  #worker = null;
  #onWorkerError;

  /** Download Edgewise and detect what this browser supports (WebGPU or not). */
  static async load({ onWorkerError = () => {} } = {}) {
    const edgewise = (await import(EDGEWISE_URL)).default;
    const capabilities = await edgewise.capabilities();
    return new SpeechEngine(edgewise, capabilities, onWorkerError);
  }

  constructor(edgewise, capabilities, onWorkerError) {
    this.#edgewise = edgewise;
    this.#capabilities = capabilities;
    this.#onWorkerError = onWorkerError;
  }

  /** Registry entry: { params, license, config: { multilingual }, variants, source } */
  model(id) {
    return this.#edgewise.registry.get(id);
  }

  isMultilingual(id) {
    return Boolean(this.model(id).config?.multilingual);
  }

  /** The variant that will actually download: WebGPU when the browser has it, otherwise CPU. */
  variantFor(id) {
    const variants = this.model(id).variants;
    const gpuVariant = this.#capabilities.webgpu && variants.find(v => v.devices.includes('webgpu'));
    const cpuVariant = variants.find(v => !v.devices.includes('webgpu'));
    return gpuVariant || cpuVariant || variants[0];
  }

  /** Bytes of this model already in the browser cache. */
  async cachedBytes(id) {
    try {
      const repo = this.model(id).source.repo;
      const files = await this.#edgewise.cache.list();
      return files.filter(file => file.key.includes(repo)).reduce((sum, file) => sum + file.bytes, 0);
    } catch {
      return 0;
    }
  }

  /** Download and prepare a model. onProgress receives Edgewise load events. */
  async download(id, onProgress) {
    await this.#edgewise.persist?.();
    await this.#getWorker().preload([id], { allowPreview: true, onProgress });
  }

  /** Delete a model's cached files. Returns how many files were removed. */
  async remove(id) {
    await this.#worker?.unload?.();
    return this.#edgewise.cache.delete(id);
  }

  /**
   * Start transcribing 16 kHz mono audio.
   * The result is async-iterable (text as it is produced) and awaitable (final { text, segments, info }).
   */
  transcribe({ modelId, audio, sampleRate, language, signal, onProgress, onSegment }) {
    return this.#getWorker().generate({
      model: modelId,
      input: { type: 'audio', audio, sampleRate },
      timestamps: 'segment',
      allowPreview: true,
      signal,
      onProgress,
      onSegment,
      ...(this.isMultilingual(modelId) ? { language } : {}),
    });
  }

  // A Blob worker has no base URL, so the bundle URL must be absolute.
  // If the worker fails to start, report it instead of waiting forever.
  #getWorker() {
    if (this.#worker) return this.#worker;

    const bundleUrl = new URL(EDGEWISE_URL, location.href).href;
    const source = `import ew from '${bundleUrl}';ew.worker.serveWorker();`;
    const rawWorker = new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })), { type: 'module' });
    rawWorker.onerror = event => {
      this.#worker?.terminate?.();
      this.#worker = null;
      this.#onWorkerError(event.message || 'unknown error');
    };

    this.#worker = this.#edgewise.worker.connectWorker(rawWorker);
    this.#worker.configure({ allowPreview: true });
    return this.#worker;
  }
}
