// Turn any audio file the browser can play into what speech models expect: 16 kHz mono samples.
// Workers cannot decode audio, so this runs on the page. An OfflineAudioContext at 16 kHz also resamples.

export const SAMPLE_RATE = 16000;

/** Resolves with a Float32Array of 16 kHz mono samples. */
export async function decodeToMono16k(blob) {
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const buffer = await context.decodeAudioData(await blob.arrayBuffer());
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);

  // Average all channels into one.
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < samples.length; i++) mono[i] += samples[i] / buffer.numberOfChannels;
  }
  return mono;
}
