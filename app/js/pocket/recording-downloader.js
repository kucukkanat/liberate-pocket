// RecordingDownloader: fetch one recording's MP3 over Bluetooth.
//
// How a transfer works:
//   1. We send APP&U&<date>&<name>.
//   2. The Pocket replies MCU&U&<size in bytes>.
//   3. MP3 bytes arrive as audio notifications.
//   4. The Pocket may send MCU&OFF when it stops sending.
// The transfer succeeds once exactly <size> bytes have arrived.
//
// Only one transfer can run at a time. Finished downloads are kept, so a recording crosses Bluetooth once.

import { startAudioTransfer } from './commands.js';

export class RecordingDownloader {
  #active = null;          // the transfer currently streaming in
  #downloads = new Map();  // 'date/name' → Promise<Blob>

  /** onStatus(text) receives short progress messages for the page. */
  constructor(connection, { onStatus = () => {} } = {}) {
    this.connection = connection;
    this.log = connection.log;
    this.onStatus = onStatus;
    connection.onReply(reply => this.#handleReply(reply));
    connection.onAudioChunk(chunk => this.#handleChunk(chunk));
    connection.onDisconnect(() => this.#fail(new Error('Disconnected')));
  }

  /** Resolves with the recording as an audio/mpeg Blob. */
  download(recording) {
    const id = `${recording.date}/${recording.name}`;
    if (this.#downloads.has(id)) return this.#downloads.get(id);
    if (this.#active) return Promise.reject(new Error('A transfer is already running'));
    if (!this.connection.hasAudioChannel) return Promise.reject(new Error('No MP3 characteristic available'));

    const download = new Promise((resolve, reject) => {
      this.#active = { name: recording.name, expectedBytes: 0, receivedBytes: 0, chunks: [], deviceStopped: false, resolve, reject };
    });
    this.#downloads.set(id, download);
    download.catch(() => this.#downloads.delete(id)); // a failed download can be retried

    this.onStatus(`Starting ${recording.name}`);
    startAudioTransfer(this.connection, recording).catch(error => this.#fail(error));
    return download;
  }

  #handleReply({ type, fields }) {
    const transfer = this.#active;
    if (!transfer) return;

    if (type === 'U' && /^\d+$/.test(fields[0] || '')) {
      transfer.expectedBytes = Number(fields[0]);
      this.log(`Expected MP3 bytes: ${transfer.expectedBytes}`);
    }
    if (type === 'OFF') {
      transfer.deviceStopped = true;
      this.#finishIfComplete();
    }
  }

  #handleChunk(chunk) {
    const transfer = this.#active;
    if (!transfer) return;

    transfer.chunks.push(chunk);
    transfer.receivedBytes += chunk.length;
    this.onStatus(`Receiving ${transfer.receivedBytes} / ${transfer.expectedBytes || '?'} bytes`);
    if (transfer.expectedBytes && transfer.receivedBytes >= transfer.expectedBytes) this.#finishIfComplete();
  }

  #finishIfComplete() {
    const transfer = this.#active;
    if (!transfer) return;
    const { expectedBytes, receivedBytes } = transfer;

    if (!expectedBytes) {
      if (transfer.deviceStopped) this.#fail(new Error('The Pocket ended the transfer before sending its size'));
      return; // otherwise keep waiting for the size
    }
    if (receivedBytes < expectedBytes) {
      if (transfer.deviceStopped) this.#fail(new Error(`Transfer ended early at ${receivedBytes} of ${expectedBytes} bytes`));
      return; // otherwise keep waiting for data
    }
    if (receivedBytes > expectedBytes) {
      this.#fail(new Error(`Transfer size mismatch: ${receivedBytes} of ${expectedBytes} bytes`));
      return;
    }

    this.#active = null;
    const blob = new Blob(transfer.chunks, { type: 'audio/mpeg' });
    this.onStatus(`Received ${transfer.name}.mp3 (${receivedBytes} bytes)`);
    this.log(`MP3 transfer complete: ${transfer.name}`);
    transfer.resolve(blob);
  }

  #fail(error) {
    const transfer = this.#active;
    this.#active = null;
    transfer?.reject(error);
  }
}
