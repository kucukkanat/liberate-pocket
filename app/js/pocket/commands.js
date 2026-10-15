// The Pocket's text protocol: every command is "APP&<NAME>[&args]", every reply is "MCU&<NAME>[&fields]".
// Each function here sends one command over a PocketConnection.

const LIST_DATES_TIMEOUT_MS = 13_000;

/** The session key must never appear in the log. */
export function redactCommand(command) {
  return command.startsWith('APP&SK&') ? 'APP&SK&[REDACTED]' : command;
}

/**
 * Send the session key. Returns true when the Pocket accepts it.
 * A freshly reset Pocket binds to the first key it receives, so this is also how a Pocket is claimed.
 */
export async function authenticate(connection, key) {
  const reply = await connection.request(`APP&SK&${key}`, 'MCU&SK&');
  const result = reply.fields[0];
  connection.isAuthenticated = result === 'OK';
  if (result === 'ERR') {
    connection.log('Session key rejected. This Pocket is bound to another key (e.g. the vendor app). Use that key, or hardware-reset the Pocket and claim it.');
  }
  return connection.isAuthenticated;
}

/** Ask for battery, firmware, Wi-Fi firmware, storage and state. Listen to replies to read the answers. */
export async function requestDeviceInfo(connection) {
  const queries = [
    ['APP&BAT', 'MCU&BAT&'],
    ['APP&FW', 'MCU&FW&'],
    ['APP&WF', 'MCU&WF&'],
    ['APP&SPACE', 'MCU&SPA&'],
    ['APP&STE', 'MCU&STE&'],
  ];
  for (const [command, replyPrefix] of queries) {
    try {
      await connection.request(command, replyPrefix);
    } catch (error) {
      connection.log(`${command}: ${error.message}`);
    }
  }
}

/** The Pocket answers with one MCU&DIRS&<date> per date folder, then MCU&DIRS_SUM&. */
export function listDateFolders(connection) {
  return connection.request('APP&LIST_DIRS', 'MCU&DIRS_SUM&', LIST_DATES_TIMEOUT_MS);
}

/** The Pocket answers with one MCU&F&<date>&<name>&<seconds> per recording, then MCU&LIST&<count>. */
export function listRecordingsForDate(connection, date) {
  return connection.request(`APP&LIST&${date}`, 'MCU&LIST&');
}

/** Set the device clock (UTC, like the vendor app) so new recordings get sensible names. */
export function setClock(connection, date = new Date()) {
  const yyyymmddhhmmss = date.toISOString().replace(/\D/g, '').slice(0, 14);
  return connection.request(`APP&T&${yyyymmddhhmmss}`, 'MCU&T&');
}

/** Start streaming one recording. MP3 bytes then arrive as audio notifications. */
export function startAudioTransfer(connection, recording) {
  return connection.send(`APP&U&${recording.date}&${recording.name}`);
}
