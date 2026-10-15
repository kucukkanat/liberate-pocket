// Lets a caller wait for "the next reply that starts with X", with a timeout.

export class ReplyWaiter {
  #pending = [];

  /** Resolves with the first reply text starting with `prefix`; rejects after `timeoutMs`. */
  waitFor(prefix, timeoutMs) {
    return new Promise((resolve, reject) => {
      const entry = { prefix, resolve, reject };
      entry.timer = setTimeout(() => {
        this.#remove(entry);
        reject(new Error('Timed out waiting for reply'));
      }, timeoutMs);
      this.#pending.push(entry);
    });
  }

  /** Feed every incoming reply here. */
  handle(text) {
    for (const entry of [...this.#pending]) {
      if (!text.startsWith(entry.prefix)) continue;
      clearTimeout(entry.timer);
      this.#remove(entry);
      entry.resolve(text);
    }
  }

  /** Fail everyone still waiting, e.g. when the device disconnects. */
  rejectAll(error) {
    for (const entry of this.#pending.splice(0)) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
  }

  #remove(entry) {
    const index = this.#pending.indexOf(entry);
    if (index !== -1) this.#pending.splice(index, 1);
  }
}
