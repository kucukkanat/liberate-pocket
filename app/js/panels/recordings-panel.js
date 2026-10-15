// "04 — Recordings": list buttons, the recordings table and the transfer status line.

import { byId, createElement } from '../shared/dom.js';
import { log } from '../shared/log.js';

export function createRecordingsPanel({ library, onDownload, onTranscribe }) {
  const dateInput = byId('date');

  library.onChange(renderTable);
  library.onDateFound(date => {
    dateInput.value = date;
  });

  byId('dates').onclick = () => library.listAllDates();
  byId('recent').onclick = () => library.scanRecentDays(14);
  byId('list').onclick = async () => {
    try {
      await library.listDate(dateInput.value);
    } catch (error) {
      log(`List recordings: ${error.message}`);
    }
  };

  function renderTable() {
    const rows = library.sortedRecordings().map(recording => {
      const length = Number.isFinite(recording.seconds) ? `${recording.seconds} s` : '—';
      const actions = createElement('td', { className: 'row-actions' }, [
        createElement('button', {
          text: 'Download MP3',
          className: 'secondary',
          testId: `download-${recording.name}`,
          onClick: () => onDownload(recording),
        }),
        createElement('button', {
          text: 'Transcribe',
          testId: `transcribe-${recording.name}`,
          onClick: () => onTranscribe(recording),
        }),
      ]);
      return createElement('tr', {}, [
        createElement('td', { text: recording.date }),
        createElement('td', { text: recording.name }),
        createElement('td', { text: length }),
        actions,
      ]);
    });
    byId('files').replaceChildren(...rows);
  }

  return {
    showTransferStatus(text) {
      byId('transfer').textContent = text;
    },

    render({ authenticated }) {
      for (const id of ['dates', 'recent', 'list']) byId(id).disabled = !authenticated;
    },
  };
}
