// Turning raw reply notifications into structured replies.
//
// A reply looks like "MCU&BAT&87": source, type, then fields, separated by "&".

/**
 * Split one notification into reply strings.
 * Replies carry no terminator and one notification may hold several back to back
 * (e.g. MCU&F&…MCU&F&…MCU&LIST&2), so split on each MCU& prefix.
 */
export function splitNotification(dataView) {
  const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
  return new TextDecoder()
    .decode(bytes)
    .replace(/\0/g, '')
    .split(/(?=MCU&)/)
    .map(text => text.trim())
    .filter(Boolean);
}

/** "MCU&F&2026-10-15&120000&42" → { text, isFromDevice: true, type: 'F', fields: ['2026-10-15', '120000', '42'] } */
export function parseReply(text) {
  const [source, type, ...fields] = text.split('&');
  return { text, isFromDevice: source === 'MCU', type, fields };
}
