// The diagnostic log shown in "05 — Diagnostics". Every module reports progress and errors here.

export function log(message) {
  const output = document.getElementById('log');
  output.textContent += `\n${new Date().toLocaleTimeString()} ${message}`;
  output.scrollTop = output.scrollHeight;
}
