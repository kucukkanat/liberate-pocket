// Pocket Explorer entry point.
//
// Creates the Pocket objects and the page panels, then wires them together.
// The multi-step flows that touch several panels (connect, authenticate, claim) live here;
// everything else lives in the panel or module it belongs to.

import { setupDiagnosticsPanel } from './panels/diagnostics-panel.js';
import { createConnectionPanel } from './panels/connection-panel.js';
import { createDeviceInfoPanel } from './panels/device-info-panel.js';
import { createGattExplorerPanel } from './panels/gatt-explorer-panel.js';
import { setupKeyGuideTabs } from './panels/key-guide-tabs.js';
import { createRecordingsPanel } from './panels/recordings-panel.js';
import { authenticate } from './pocket/commands.js';
import { PocketConnection } from './pocket/connection.js';
import { RecordingDownloader } from './pocket/recording-downloader.js';
import { RecordingLibrary } from './pocket/recording-library.js';
import { generateSessionKey, SESSION_KEY_LENGTH } from './pocket/session-key.js';
import { downloadBlob } from './shared/dom.js';
import { saveKey } from './shared/key-storage.js';
import { log } from './shared/log.js';
import { createTranscriptionPanel } from './transcription/transcription-panel.js';

const CLAIM_WARNING =
  'Claim this Pocket with a new key?\n\n' +
  'Only works right after a hardware reset (triple-click side button, then hold until red blinking stops; LED pulses blue). ' +
  'Afterwards the vendor app can no longer connect until you reset again. Save the key shown.';

// ---- Pocket ---------------------------------------------------------------

const pocket = new PocketConnection({ log });
const library = new RecordingLibrary(pocket);
const downloader = new RecordingDownloader(pocket, {
  onStatus: text => recordingsPanel.showTransferStatus(text),
});
let isConnecting = false;

// ---- Panels ---------------------------------------------------------------

setupKeyGuideTabs();
setupDiagnosticsPanel();

const connectionPanel = createConnectionPanel({
  onFind: () => connect(),
  onFindAnyDevice: () => connect({ showAllDevices: true }),
  onDisconnect: () => pocket.disconnect(),
  onAuthenticate: () => authenticateWithEnteredKey(),
  onClaim: () => claimResetPocket(),
});
const deviceInfoPanel = createDeviceInfoPanel({ connection: pocket });
const gattExplorerPanel = createGattExplorerPanel({
  connection: pocket,
  onReconnect: () => reconnectWithExtraServices(),
});
const transcriptionPanel = createTranscriptionPanel();
const recordingsPanel = createRecordingsPanel({
  library,
  onDownload: async recording => {
    try {
      downloadBlob(await downloader.download(recording), `${recording.name}.mp3`);
    } catch (error) {
      log(`Download error: ${error.message}`);
    }
  },
  onTranscribe: async recording => {
    try {
      transcriptionPanel.transcribe(await downloader.download(recording), recording.name);
    } catch (error) {
      log(`Transcribe error: ${error.message}`);
    }
  },
});

/** Enable/disable every control to match the connection state. Call after anything changes it. */
function refreshControls() {
  const state = {
    connected: pocket.isConnected,
    commandChannelReady: pocket.hasCommandChannel,
    authenticated: pocket.isAuthenticated,
    connecting: isConnecting,
  };
  connectionPanel.render(state);
  deviceInfoPanel.render(state);
  gattExplorerPanel.render(state);
  recordingsPanel.render(state);
}

pocket.onDisconnect(refreshControls);
refreshControls();

// ---- Flows ----------------------------------------------------------------

/** Pick a device, connect, show what we can, and authenticate if a key is already entered. */
async function connect({ showAllDevices = false } = {}) {
  isConnecting = true;
  refreshControls();
  try {
    await pocket.connect({ showAllDevices, extraServiceUuids: gattExplorerPanel.extraServiceUuids() });
    connectionPanel.showDeviceName(pocket.deviceName);
    await deviceInfoPanel.showBatteryWithoutKey();
    await gattExplorerPanel.exploreServices();
    if (pocket.hasCommandChannel && connectionPanel.sessionKey().length === SESSION_KEY_LENGTH) {
      await authenticateWithEnteredKey();
    }
  } catch (error) {
    log(`Connection: ${error.name}: ${error.message}`);
  } finally {
    isConnecting = false;
    refreshControls();
  }
}

/** New service UUIDs only take effect on a fresh connection, so disconnect first if needed. */
function reconnectWithExtraServices() {
  if (pocket.isConnected) {
    pocket.disconnect();
    log('Disconnected. Click Find Pocket to reconnect using updated UUIDs.');
  } else {
    connect();
  }
}

/** Send the key from the key field; on success load the recordings. */
async function authenticateWithEnteredKey() {
  const key = connectionPanel.sessionKey();
  if (key.length !== SESSION_KEY_LENGTH) {
    log(`Session key must be ${SESSION_KEY_LENGTH} characters`);
    return;
  }

  try {
    await authenticate(pocket, key);
  } catch (error) {
    log(`Authentication: ${error.message}`);
    return;
  } finally {
    refreshControls();
  }

  if (!pocket.isAuthenticated) return;
  if (connectionPanel.shouldRememberKey()) saveKey(key);
  await library.loadEverything();
}

// A hardware-reset Pocket binds to the first APP&SK& key it receives; this is how the vendor app pairs too.
async function claimResetPocket() {
  if (!confirm(CLAIM_WARNING)) return;

  const key = generateSessionKey();
  connectionPanel.showGeneratedKey(key);
  try {
    await authenticate(pocket, key);
  } catch (error) {
    log(`Claim: ${error.message}`);
    return;
  } finally {
    refreshControls();
  }

  if (!pocket.isAuthenticated) {
    log('Claim refused: the Pocket was not freshly reset.');
    return;
  }
  saveKey(key);
  connectionPanel.markKeyRemembered();
  log('Claimed. Key saved in this browser and shown in the key field. Copy it somewhere safe. The Pocket drops the link right after pairing: click Find Pocket again.');
}
