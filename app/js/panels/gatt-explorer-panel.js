// "03 — GATT explorer": a table of every service and characteristic the browser may access,
// with Read and Listen buttons for poking at them.

import { APP_MANAGED_CHARACTERISTICS, parseServiceUuidList } from '../pocket/uuids.js';
import { byId, createElement } from '../shared/dom.js';
import { log } from '../shared/log.js';

const PROPERTY_NAMES = ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'];

export function createGattExplorerPanel({ connection, onReconnect }) {
  byId('reconnect').onclick = () => onReconnect();
  byId('explore').onclick = () => exploreServices();

  /** Fill the table. Never throws; problems go to the log. */
  async function exploreServices() {
    const server = connection.gattServer;
    if (!server?.connected) return;

    const table = byId('gatt');
    table.replaceChildren();
    try {
      for (const service of await server.getPrimaryServices()) {
        try {
          for (const characteristic of await service.getCharacteristics()) {
            table.append(characteristicRow(service, characteristic));
          }
        } catch (error) {
          log(`Inspect ${service.uuid}: ${error.message}`);
        }
      }
      log('GATT enumeration completed');
    } catch (error) {
      log(`GATT enumeration failed: ${error.message}`);
    }
  }

  return {
    exploreServices,

    /** UUIDs typed into the "Additional service UUIDs" field. Throws on an invalid one. */
    extraServiceUuids: () => parseServiceUuidList(byId('uuids').value),

    render({ connected, connecting }) {
      byId('reconnect').disabled = connected || connecting;
      byId('explore').disabled = !connected;
    },
  };
}

function characteristicRow(service, characteristic) {
  const properties = PROPERTY_NAMES.filter(name => characteristic.properties[name]).join(', ');
  const actions = createElement('td');
  if (characteristic.properties.read) actions.append(readButton(characteristic));
  if (characteristic.properties.notify && !APP_MANAGED_CHARACTERISTICS.includes(characteristic.uuid)) {
    actions.append(listenButton(characteristic));
  }

  return createElement('tr', {}, [
    createElement('td', { text: service.uuid }),
    createElement('td', { text: characteristic.uuid }),
    createElement('td', { text: properties }),
    actions,
  ]);
}

function readButton(characteristic) {
  return createElement('button', {
    text: 'Read',
    className: 'secondary',
    onClick: async () => {
      try {
        const bytes = toBytes(await characteristic.readValue());
        log(`READ ${characteristic.uuid}: ${toHex(bytes)} | ${new TextDecoder().decode(bytes)}`);
      } catch (error) {
        log(`Read error: ${error.message}`);
      }
    },
  });
}

function listenButton(characteristic) {
  const button = createElement('button', {
    text: 'Listen',
    className: 'secondary',
    onClick: async () => {
      try {
        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', event => {
          log(`NOTIFY ${characteristic.uuid}: ${toHex(toBytes(event.target.value))}`);
        });
        button.disabled = true;
        button.textContent = 'Listening';
      } catch (error) {
        log(`Notify error: ${error.message}`);
      }
    },
  });
  return button;
}

const toBytes = dataView => new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
const toHex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join(' ');
