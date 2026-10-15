// "00 — Get your session key": switch between the A–E guide tabs.
// Each tab's aria-controls attribute names the panel it shows.

export function setupKeyGuideTabs() {
  const tabs = [...document.querySelectorAll('[role=tab]')];
  for (const tab of tabs) {
    tab.onclick = () => {
      for (const other of tabs) {
        const isSelected = other === tab;
        other.setAttribute('aria-selected', isSelected);
        document.getElementById(other.getAttribute('aria-controls')).hidden = !isSelected;
      }
    };
  }
}
