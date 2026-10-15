// RecordingLibrary: which recordings are on the Pocket.
//
// It sends list commands and collects the MCU&DIRS and MCU&F replies into a list you can render.

import { listDateFolders, listRecordingsForDate, setClock } from './commands.js';

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const ONE_DAY_MS = 86_400_000;

export class RecordingLibrary {
  /** Date folders the Pocket reported, e.g. '2026-10-15'. */
  dates = new Set();

  #recordings = new Map(); // 'date/name' → { date, name, seconds }
  #listeners = { change: new Set(), dateFound: new Set() };

  constructor(connection) {
    this.connection = connection;
    this.log = connection.log;
    connection.onReply(reply => this.#handleReply(reply));
  }

  get count() {
    return this.#recordings.size;
  }

  /** Newest first (names are timestamps). */
  sortedRecordings() {
    return [...this.#recordings.values()].sort((a, b) => b.name.localeCompare(a.name));
  }

  /** listener() whenever the list of recordings changes. */
  onChange(listener) {
    this.#listeners.change.add(listener);
  }

  /** listener(date) for each date folder the Pocket reports. */
  onDateFound(listener) {
    this.#listeners.dateFound.add(listener);
  }

  /** Everything a freshly authenticated session needs: all recordings, then a correct clock. */
  async loadEverything() {
    // After a reset the device clock can be anywhere, so ask for every date folder instead of guessing recent days.
    await this.listAllDates();
    if (!this.count) {
      this.log('No dates reported; scanning recent days instead');
      await this.scanRecentDays(7);
    }
    try {
      await setClock(this.connection);
    } catch (error) {
      this.log(`Set clock: ${error.message}`);
    }
  }

  /** Ask for every date folder, then list each one. */
  async listAllDates() {
    this.dates.clear();
    try {
      await listDateFolders(this.connection);
    } catch (error) {
      this.log(`List dates: ${error.message}`);
    }
    this.log(`Dates on device: ${[...this.dates].join(', ') || 'none'}`);

    for (const date of this.dates) {
      try {
        await this.listDate(date);
      } catch (error) {
        this.log(`List ${date}: ${error.message}`);
      }
    }
    this.log(`Found ${this.count} recording(s)`);
  }

  /** List one YYYY-MM-DD date, replacing what we knew about it. */
  async listDate(date) {
    if (!DATE_FORMAT.test(date)) throw new Error('Choose a YYYY-MM-DD date');

    for (const [id, recording] of this.#recordings) {
      if (recording.date === date) this.#recordings.delete(id);
    }
    this.#notifyChange();

    await listRecordingsForDate(this.connection, date);
    this.log(`Listed ${date}`);
  }

  /** List each of the last `days` days, plus two days ahead in case the device clock runs fast. */
  async scanRecentDays(days) {
    for (let daysAgo = -2; daysAgo < days && this.connection.isConnected; daysAgo++) {
      const date = new Date(Date.now() - daysAgo * ONE_DAY_MS).toISOString().slice(0, 10);
      try {
        await this.listDate(date);
      } catch (error) {
        this.log(`Scan ${date}: ${error.message}`);
      }
    }
    this.log(`Scan finished: ${this.count} recording(s)`);
  }

  #handleReply({ type, fields }) {
    if (type === 'DIRS' && fields[0]) {
      const date = fields[0];
      this.dates.add(date);
      this.#listeners.dateFound.forEach(listener => listener(date));
    }
    if (type === 'F' && fields.length >= 3) {
      const [date, name, seconds] = fields;
      this.#recordings.set(`${date}/${name}`, { date, name, seconds: Number(seconds) });
      this.#notifyChange();
    }
    if (type === 'LIST') {
      this.log(`List finished: ${Number(fields[0])} file(s) reported`);
    }
  }

  #notifyChange() {
    this.#listeners.change.forEach(listener => listener());
  }
}
