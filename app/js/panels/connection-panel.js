// "01 — Connection": find/disconnect buttons, session key field, Authenticate and Claim.
// The panel only shows state and reports clicks; main.js decides what a click does.

import { byId } from '../shared/dom.js';
import { forgetSavedKey, loadSavedKey } from '../shared/key-storage.js';

export function createConnectionPanel({ onFind, onFindAnyDevice, onDisconnect, onAuthenticate, onClaim }) {
  const keyInput = byId('key');
  const rememberCheckbox = byId('remember');

  byId('connect').onclick = () => onFind();
  byId('scanAll').onclick = () => onFindAnyDevice();
  byId('disconnect').onclick = () => onDisconnect();
  byId('auth').onclick = () => onAuthenticate();
  byId('claim').onclick = () => onClaim();
  rememberCheckbox.onchange = () => {
    if (!rememberCheckbox.checked) forgetSavedKey();
  };

  keyInput.value = loadSavedKey();
  rememberCheckbox.checked = Boolean(keyInput.value);

  return {
    sessionKey: () => keyInput.value,
    shouldRememberKey: () => rememberCheckbox.checked,

    /** Show a freshly generated key in plain text so the user can copy it. */
    showGeneratedKey(key) {
      keyInput.value = key;
      keyInput.type = 'text';
    },

    markKeyRemembered() {
      rememberCheckbox.checked = true;
    },

    showDeviceName(name) {
      byId('name').textContent = name;
    },

    render({ connected, commandChannelReady, authenticated, connecting }) {
      byId('status').textContent = statusLabel({ connected, commandChannelReady, authenticated });
      byId('connect').disabled = connected || connecting;
      byId('scanAll').disabled = connected || connecting;
      byId('disconnect').disabled = !connected;
      byId('auth').disabled = !commandChannelReady;
      byId('claim').disabled = !commandChannelReady;
      byId('proto').textContent = protocolHint({ connected, commandChannelReady });
    },
  };
}

function statusLabel({ connected, commandChannelReady, authenticated }) {
  if (!connected) return 'DISCONNECTED';
  if (authenticated) return 'CONNECTED / AUTHENTICATED';
  if (commandChannelReady) return 'CONNECTED / AUTH REQUIRED';
  return 'CONNECTED / GATT ONLY';
}

function protocolHint({ connected, commandChannelReady }) {
  if (!connected) return 'Click Find Pocket first. Authenticate and Claim unlock once the Pocket is connected.';
  if (commandChannelReady) return 'Pocket command channel available. Authenticate to browse recordings.';
  return 'Connected, but the Pocket command channel could not be opened, so Authenticate and Claim stay disabled. See 05 — Diagnostics for the failing step, then Disconnect and Find Pocket again.';
}
