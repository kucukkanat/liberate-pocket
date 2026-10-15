// PocketConnection: the Bluetooth link to one Pocket.
//
// It finds and connects the device, opens the three Pocket channels
// (commands out, replies in, MP3 audio in), and lets you send commands and wait for replies.
// It knows nothing about the page: progress goes to the `log` function you pass in.

import { redactCommand } from './commands.js';
import { ReplyWaiter } from './reply-waiter.js';
import { parseReply, splitNotification } from './replies.js';
import {
  AUDIO_CHARACTERISTIC,
  BATTERY_LEVEL_CHARACTERISTIC,
  BATTERY_SERVICE,
  COMMAND_CHARACTERISTIC,
  DEFAULT_OPTIONAL_SERVICES,
  POCKET_NAME_PREFIX,
  POCKET_SERVICE,
  REPLY_CHARACTERISTIC,
} from './uuids.js';

const DEFAULT_REPLY_TIMEOUT_MS = 9000;

export class PocketConnection {
  /** Set by authenticate() in commands.js; cleared on disconnect. */
  isAuthenticated = false;

  #device = null;
  #server = null;
  #commandChannel = null;
  #replyChannel = null;
  #audioChannel = null;
  #replyWaiter = new ReplyWaiter();
  #listeners = { reply: new Set(), audioChunk: new Set(), disconnect: new Set() };

  constructor({ log = () => {} } = {}) {
    this.log = log;
  }

  get isConnected() {
    return Boolean(this.#server?.connected);
  }

  /** True when we can both send commands and receive replies. */
  get hasCommandChannel() {
    return this.isConnected && Boolean(this.#commandChannel && this.#replyChannel);
  }

  get hasAudioChannel() {
    return Boolean(this.#audioChannel);
  }

  get deviceName() {
    return this.#device?.name || 'Unnamed device';
  }

  /** The raw GATT server, for the GATT explorer. */
  get gattServer() {
    return this.#server;
  }

  /** listener({ text, type, fields }) for every MCU&… reply. */
  onReply(listener) {
    this.#listeners.reply.add(listener);
  }

  /** listener(Uint8Array) for every chunk of MP3 data. */
  onAudioChunk(listener) {
    this.#listeners.audioChunk.add(listener);
  }

  onDisconnect(listener) {
    this.#listeners.disconnect.add(listener);
  }

  /** Show the browser's device picker, connect, and open the Pocket channels. */
  async connect({ showAllDevices = false, extraServiceUuids = [] } = {}) {
    if (!navigator.bluetooth) throw new Error('Web Bluetooth unavailable. Use desktop Chrome/Edge with HTTPS.');

    const device = await navigator.bluetooth.requestDevice(buildDevicePickerOptions(showAllDevices, extraServiceUuids));
    this.#device = device;
    // Picking the same device again must not register the handler twice.
    device.removeEventListener('gattserverdisconnected', this.#handleDisconnect);
    device.addEventListener('gattserverdisconnected', this.#handleDisconnect);

    this.#server = await device.gatt.connect();
    this.log(`Connected to ${device.name || 'unnamed'}`);
    await this.#openPocketChannels();
  }

  disconnect() {
    this.#device?.gatt?.disconnect();
  }

  /** Standard Bluetooth battery level, readable without a session key. */
  async readBatteryLevel() {
    const service = await this.#server.getPrimaryService(BATTERY_SERVICE);
    const characteristic = await service.getCharacteristic(BATTERY_LEVEL_CHARACTERISTIC);
    const value = await characteristic.readValue();
    return value.getUint8(0);
  }

  /** Write one command. Does not wait for an answer. */
  async send(command) {
    const channel = this.#commandChannel;
    if (!channel) throw new Error('Command characteristic unavailable');

    const bytes = new TextEncoder().encode(command);
    this.log(`→ ${redactCommand(command)}`);
    if (channel.properties.write && channel.writeValueWithResponse) await channel.writeValueWithResponse(bytes);
    else if (channel.writeValueWithoutResponse) await channel.writeValueWithoutResponse(bytes);
    else throw new Error('Cannot write to command characteristic');
  }

  /** Send a command and resolve with the first reply starting with `replyPrefix`. */
  async request(command, replyPrefix, timeoutMs = DEFAULT_REPLY_TIMEOUT_MS) {
    const reply = this.#replyWaiter.waitFor(replyPrefix, timeoutMs);
    await this.send(command);
    return parseReply(await reply);
  }

  // Each step fails on its own so one bad characteristic (e.g. audio) doesn't take the command channel down with it.
  async #openPocketChannels() {
    let service;
    try {
      service = await this.#server.getPrimaryService(POCKET_SERVICE);
    } catch (error) {
      this.log(`Pocket service ${POCKET_SERVICE} not found (${error.message}). Close the vendor app, make sure you picked a ${POCKET_NAME_PREFIX} device, then reconnect.`);
      return;
    }

    const findCharacteristic = async (uuid, label) => {
      try {
        return await service.getCharacteristic(uuid);
      } catch (error) {
        this.log(`${label} characteristic missing: ${error.message}`);
        return null;
      }
    };

    // 1. Replies. Without them no command can be confirmed, so stop here if they fail.
    const replyChannel = await findCharacteristic(REPLY_CHARACTERISTIC, 'Reply');
    if (!replyChannel) return;
    try {
      await replyChannel.startNotifications();
      replyChannel.addEventListener('characteristicvaluechanged', this.#handleReplyNotification);
    } catch (error) {
      this.log(`Reply notifications failed: ${error.message}`);
      return;
    }
    this.#replyChannel = replyChannel;

    // 2. Commands. The device also takes commands on the reply characteristic (pocket-libre writes there), so fall back to it.
    this.#commandChannel = (await findCharacteristic(COMMAND_CHARACTERISTIC, 'Command')) ?? replyChannel;

    // 3. Audio. Optional: without it everything works except MP3 downloads.
    const audioChannel = await findCharacteristic(AUDIO_CHARACTERISTIC, 'Audio');
    if (audioChannel) {
      try {
        await audioChannel.startNotifications();
        audioChannel.addEventListener('characteristicvaluechanged', this.#handleAudioNotification);
        this.#audioChannel = audioChannel;
      } catch (error) {
        this.log(`Audio notifications failed, MP3 downloads disabled: ${error.message}`);
      }
    }

    this.log(`Pocket protocol ready${this.#audioChannel ? ': commands, replies and MP3 notifications' : ' without MP3 downloads'}`);
  }

  #handleReplyNotification = event => {
    for (const text of splitNotification(event.target.value)) {
      this.log(`← ${text}`);
      this.#replyWaiter.handle(text);
      const reply = parseReply(text);
      if (reply.isFromDevice) this.#listeners.reply.forEach(listener => listener(reply));
    }
  };

  #handleAudioNotification = event => {
    const value = event.target.value;
    // Copy: the browser may reuse the underlying buffer for the next notification.
    const chunk = new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
    this.#listeners.audioChunk.forEach(listener => listener(chunk));
  };

  #handleDisconnect = () => {
    this.#server = null;
    this.#commandChannel = this.#replyChannel = this.#audioChannel = null;
    this.isAuthenticated = false;
    this.#replyWaiter.rejectAll(new Error('Disconnected'));
    this.#listeners.disconnect.forEach(listener => listener());
    this.log('Disconnected');
  };
}

function buildDevicePickerOptions(showAllDevices, extraServiceUuids) {
  const optionalServices = [...new Set([...DEFAULT_OPTIONAL_SERVICES, ...extraServiceUuids])];
  return showAllDevices
    ? { acceptAllDevices: true, optionalServices }
    : { filters: [{ namePrefix: POCKET_NAME_PREFIX }], optionalServices };
}
