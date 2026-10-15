// Bluetooth identifiers the app needs.

const BLUETOOTH_BASE_SUFFIX = '-0000-1000-8000-00805f9b34fb';
const FULL_UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

/** Turn a short id ('180f' or '0000180f') into a full 128-bit UUID. Full UUIDs are only lower-cased. */
export function expandUuid(id) {
  const lower = id.toLowerCase();
  if (lower.length === 4) return `0000${lower}${BLUETOOTH_BASE_SUFFIX}`;
  if (lower.length === 8) return `${lower}${BLUETOOTH_BASE_SUFFIX}`;
  return lower;
}

/** Parse "180a, 0000ffd0-…" from a text field into full UUIDs. Throws on the first invalid entry. */
export function parseServiceUuidList(text) {
  const uuids = text
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(expandUuid);
  for (const uuid of uuids) {
    if (!FULL_UUID.test(uuid)) throw new Error(`Invalid UUID: ${uuid}`);
  }
  return uuids;
}

// The Pocket's own services use vendor 128-bit UUIDs, not the Bluetooth base UUID that expandUuid() applies.
const pocketUuid = prefix => `${prefix}-2233-4455-6677-889912345678`;
const vendorUuid = prefix => `${prefix}-f69a-11e8-8eb2-f2801f1b9fd1`;

/** Only devices whose name starts with this are offered by "Find Pocket". */
export const POCKET_NAME_PREFIX = 'PKT01';

export const POCKET_SERVICE = pocketUuid('001120a0');
export const AUDIO_CHARACTERISTIC = pocketUuid('001120a1');   // notifies MP3 bytes during a download
export const COMMAND_CHARACTERISTIC = pocketUuid('001120a2'); // we write APP&… commands here
export const REPLY_CHARACTERISTIC = pocketUuid('001120a3');   // notifies MCU&… replies

export const BATTERY_SERVICE = expandUuid('180f');
export const BATTERY_LEVEL_CHARACTERISTIC = expandUuid('2a19');

/** Services the browser may access. Web Bluetooth hides any service not listed when connecting. */
export const DEFAULT_OPTIONAL_SERVICES = [
  POCKET_SERVICE,
  vendorUuid('e49a3001'),
  vendorUuid('e49a25f8'),
  ...['ffd0', '180f', '180a', '1800', '1801'].map(expandUuid),
];

/** Characteristics the GATT explorer must not subscribe to: the app already owns them. */
export const APP_MANAGED_CHARACTERISTICS = [REPLY_CHARACTERISTIC, AUDIO_CHARACTERISTIC, expandUuid('ffd2')];
