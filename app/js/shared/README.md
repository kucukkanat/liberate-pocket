# shared

Tiny helpers used by the rest of the app. No Pocket or Bluetooth knowledge lives here.

| File | What it does |
| --- | --- |
| `dom.js` | `byId(id)`, `createElement(tag, options, children)`, `downloadBlob(blob, filename)` |
| `log.js` | `log(message)` appends a timestamped line to the Diagnostics panel |
| `key-storage.js` | `loadSavedKey()`, `saveKey(key)`, `forgetSavedKey()` backed by `localStorage` |

## Usage

```js
import { byId, createElement, downloadBlob } from '../shared/dom.js';
import { log } from '../shared/log.js';
import { loadSavedKey, saveKey } from '../shared/key-storage.js';

const button = createElement('button', {
  text: 'Save',
  className: 'secondary',
  testId: 'save-button',
  onClick: () => downloadBlob(new Blob(['hi']), 'hello.txt'),
});
byId('controls').append(button);

log('Saved a file');            // "12:00:01 Saved a file" in the log panel
saveKey('K7Q2M9XR4T1BZ8WA');
loadSavedKey();                 // → 'K7Q2M9XR4T1BZ8WA' ('' if storage is blocked)
```

`log` expects an element with `id="log"` on the page.
