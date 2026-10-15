// "02 — Device information": battery, firmware, storage and state.
// Values are filled from Pocket replies, whether we asked for them or the device sent them on its own.

import { requestDeviceInfo } from '../pocket/commands.js';
import { byId } from '../shared/dom.js';
import { log } from '../shared/log.js';

// Reply type → which element shows it and how.
const FIELDS = {
  BAT: { elementId: 'battery', format: fields => `${fields[0]}%` },
  FW: { elementId: 'firmware', format: fields => fields.join('&') },
  WF: { elementId: 'wifi', format: fields => fields.join('&') },
  SPA: { elementId: 'storage', format: fields => `${fields.join(' / ')} MB` },
  STE: { elementId: 'state', format: fields => fields.join('&') },
};

export function createDeviceInfoPanel({ connection }) {
  connection.onReply(({ type, fields }) => {
    const field = FIELDS[type];
    if (field) byId(field.elementId).textContent = field.format(fields);
  });

  byId('info').onclick = () => requestDeviceInfo(connection);

  return {
    /** Battery through standard Bluetooth: works before authentication. Never throws. */
    async showBatteryWithoutKey() {
      try {
        byId('battery').textContent = `${await connection.readBatteryLevel()}%`;
        log('Battery characteristic read successful');
      } catch (error) {
        log(`Battery read: ${error.message}`);
      }
    },

    render({ authenticated }) {
      byId('info').disabled = !authenticated;
    },
  };
}
