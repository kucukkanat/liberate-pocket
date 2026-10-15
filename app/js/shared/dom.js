// Small DOM helpers shared by every panel.

export const byId = id => document.getElementById(id);

/**
 * Create an element in one call.
 * createElement('button', { text: 'Read', className: 'secondary', onClick: read })
 */
export function createElement(tag, { text, className, testId, onClick } = {}, children = []) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  if (testId) element.dataset.testid = testId;
  if (onClick) element.onclick = onClick;
  element.append(...children);
  return element;
}

/** Make the browser save `blob` as a file called `filename`. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Give the browser time to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
