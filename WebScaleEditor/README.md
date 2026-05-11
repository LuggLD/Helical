# Helical Web Scale Editor

A browser-based editor for the Helical eurorack module's `scale.txt` SD-card file. Works on any modern browser (Chrome, Firefox, Safari, Edge) with no install required.

## Usage

1. Open `index.html` in any modern browser, or visit a hosted copy (see "Hosting" below).
2. Click **📂 Load** and pick your `scale.txt` (typically copied from the SD card). The editor will load all 16 slots.
3. Click any slot in the strip below the toolbar to edit it.
4. Click piano keys to toggle notes. Use the LED color pickers to set the slot's two colors. Toggle Root Emphasize as needed.
5. **⎘ Copy to…** copies the current slot's notes and/or LED colors to another slot.
6. **📚 Apply preset…** drops in one of the 16 factory scales (Major, Lydian, Whole tone, etc.).
7. **↶ Undo / ↷ Redo** revert and replay changes. When undoing once would return you to the last saved/loaded state, the Undo button has a green outline.
8. Click **💾 Save** to download an updated `scale.txt`. Copy it back to your SD card to use it on the module.

## Keyboard shortcuts

- **Ctrl/⌘ + Z** — Undo
- **Ctrl/⌘ + Shift + Z** (or **Ctrl/⌘ + Y**) — Redo
- **Ctrl/⌘ + S** — Save
- **← / →** — Previous / next slot

## Hosting

If you'd like a public link instead of opening the file locally, host this folder on any static web host (GitHub Pages, Netlify, Cloudflare Pages, etc.). The editor is one HTML file plus a few JS/CSS files — no build step, no server-side code.

If the parent repo has GitHub Pages enabled, the editor is automatically available at `<org>.github.io/Helical/WebScaleEditor/`.

## For developers

The editor is two ES modules:

- `core.js` — pure logic (parser, serializer, validation, state operations). No DOM.
- `app.js` — DOM wiring. Imports `core.js`.

Plus `index.html`, `style.css`, and `tests.js`.

### Running the test suite

Requires Node 18 or newer (no other dependencies, no `npm install`):

```bash
node --test WebScaleEditor/tests.js
```

The tests cover the pure functions in `core.js` — parsing, serializing, validation, and state operations — including a round-trip against the factory `scale.txt`.

### Manual UI test plan

Run after any change to `app.js`, `index.html`, or `style.css`:

- [ ] Open `index.html`. 16 black slot pills, empty piano, dirty indicator hidden.
- [ ] Load `../factoryPreset/scale.txt`. All 16 pills get gradients; slot 0 (Major(R)) shows its notes on the piano with the warm root tint on semitones 0/12/24/36.
- [ ] Click a piano key — note toggles, dirty indicator appears, Undo button enables.
- [ ] Switch slots via ←/→ — editor reflects the new slot, no state leaks between slots.
- [ ] Pick LED colors — slot pill gradient updates immediately; gradient-preview swatch in the LED row updates.
- [ ] Apply preset "Whole tone" to an empty slot — notes + colors land, current slot's pill flashes.
- [ ] Uncheck "Copy LED colors" before applying — only notes change.
- [ ] Copy slot 00 to slot 11 with both checkboxes — the warning lists what will be replaced; on confirm, slot 11 flashes.
- [ ] Click Save — `scale.txt` downloads. Diff it against the original; should differ only in whatever you changed (and possibly a trailing newline on the last line).
- [ ] Make a change, refresh the page — browser warns about unsaved changes.
