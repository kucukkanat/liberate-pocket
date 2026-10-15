// "05 — Diagnostics": Clear and Copy buttons for the log. Writing to the log lives in shared/log.js.

import { byId } from '../shared/dom.js';

export function setupDiagnosticsPanel() {
  byId('clear').onclick = () => {
    byId('log').textContent = '';
  };
  byId('copy').onclick = () => navigator.clipboard.writeText(byId('log').textContent);
}
