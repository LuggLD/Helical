# Helical Web Scale Editor — Design

- **Status:** Approved, ready for implementation planning
- **Branch:** `web-scale-editor`
- **Date:** 2026-05-10

## Goal

Replace the Max-based Helical scale editor with a portable, zero-install web app. The Max editor (`ScaleEditor/HelicalScaleEditor2.0.mxf`) requires Max 9 (paid) or the bundled `.app` (macOS only), and offers minimal slot navigation. The new editor lives in any modern browser, requires no install for end users, and improves the editing UX with a visible slot strip, copy/paste, undo/redo, factory presets, and validation.

## File format reference

The on-disk file is `scale.txt`, one slot per line, 16 lines total.

Confirmed by inspecting the raw bytes of `factoryPreset/scale.txt` on disk and via `curl` from the GitHub `main` branch (both 657 bytes, byte-identical):

- **LF newlines only** (no CRLF)
- **15 newlines for 16 lines** — last line has no trailing newline
- **Last line ends with a trailing space** (artifact of the Max editor; harmless)
- **Space-separated integers** within each line, no commas or labels

Per-line layout:

```
LED1_R LED1_G LED1_B LED2_R LED2_G LED2_B rootEmphasize note1 note2 ...
```

- LED RGB values are **0–255** (verified by the Max editor's input fields and by factory values like `152` and `255` that exceed the originally-assumed 0–127 range).
- `rootEmphasize` is `0` or `1`.
- `note*` are non-negative integers representing semitone offsets from the root. Factory file's highest is 23 (octave 2). The firmware accepts higher values.

## Architecture

Static single-page web app, no build step, no runtime dependencies.

```
WebScaleEditor/
├── index.html      — markup, structure, file picker input
├── style.css       — all visual styling
├── core.js         — pure logic (ES module): parsing, serializing, validation, state operations
├── app.js          — DOM glue (ES module): event handlers, rendering. Imports core.js.
├── tests.js        — node --test suite, imports core.js
└── README.md       — usage instructions, manual test plan, how to host
```

End-user flow: open `index.html` directly in any modern browser. `file://` URLs work for everything we need (file picker, download). Optionally host the folder on GitHub Pages — it becomes live at `<org>.github.io/Helical/WebScaleEditor/` with no extra config.

The repo `README.md`'s `# Scale Editing` section gains a single-line link to the editor.

Node 18+ is required *only for developers* who want to run the test suite. The brainstorming server's node dependency goes away when this design phase ends.

## State model

```js
state = {
  slots: [                          // always exactly 16
    {
      led1: { r, g, b },            // each 0–255
      led2: { r, g, b },
      rootEmphasize: false,
      notes: Set<number>            // semitone offsets, expected range 0–47
    },
    // ... 15 more
  ],
  currentSlotIndex: 0,
  undoStack: [],                    // capped at 100, each entry is a deep clone of `slots` + a short reason string
  redoStack: [],
  savedSnapshot: <deep clone of slots at last load/save>
}
```

- `notes` as a `Set` gives O(1) toggling and prevents duplicates. Serialized as a sorted ascending list.
- No slot names are stored — they only exist in the README and as labels on the factory presets dropdown. The file format does not carry names; we do not add them.
- Deep-clone snapshots for undo/redo. With 16 slots × tiny data, this is trivially fast and correct, no diff-based history needed.
- **`dirty` is derived**, not stored: `dirty = !deepEqual(state.slots, state.savedSnapshot)`. On Load and Save, `savedSnapshot` is replaced with a fresh clone of `slots`. As a consequence, undoing back to the saved state auto-clears the dirty flag — no special case needed.

## UI components

Top-to-bottom layout, all on one page:

### Toolbar

Five buttons:

- **📂 Load** — opens file picker (`<input type="file" accept=".txt,text/plain">`). If `dirty`, confirms before discarding changes.
- **💾 Save** — serializes state, triggers download as `scale.txt`. Updates `savedSnapshot`.
- **↶ Undo** / **↷ Redo** — disabled when respective stack is empty. Tooltip shows the action's reason (e.g. "Undo: toggle note 7 in slot 03"). When the next undo (or redo) would restore the saved state, a small "return to saved" indicator (e.g. a green dot on the icon) is shown and the tooltip becomes "Undo to last saved state".
- **⎘ Copy to…** — opens the copy-to dialog (see below).
- **📚 Apply preset…** — opens the preset dialog (see below).

### Slot strip

A horizontal row of 16 pills below the toolbar. Each pill:

- 42×52 px rounded rectangle
- Background: vertical gradient with the slot's LED1 color at top and LED2 at bottom: `linear-gradient(180deg, LED1, LED2)`
- **Critical CSS detail:** also set `background-origin: border-box; background-repeat: no-repeat;`. Without this, the default `background-origin: padding-box` + `background-repeat: repeat` causes a tiled gradient that leaks 2px of the *opposite-end* color into the transparent-border area at the top and bottom of each pill. This was verified in mockup A/B testing during brainstorming.
- Slot number overlaid in white with a dark text-shadow halo for legibility against any color combo.
- Active slot indicator: white inner border + bright box-shadow ring (background gradient remains visible — the colors are what the user is curating).
- Hover tooltip: `Slot N · M notes`.
- Click switches `currentSlotIndex`.

### Piano keyboard (main editor)

4 octaves of clickable keys, semitones 0–47.

- **Layout via CSS grid**: 28 white keys with `grid-template-columns: repeat(28, 1fr)`. Each white key is exactly 100/28 ≈ 3.571% of the keyboard width.
- **20 black keys** absolutely positioned at white-key boundaries. Each black key is 2.3% wide, half-width-offset from its boundary, yielding consistent ~1.27% gaps between adjacent blacks (C♯/D♯, F♯/G♯/A♯, etc.).
- Black-key vertical extent: 62% of keyboard height.
- **Root highlighting**: semitones 0, 12, 24, 36 styled distinctly (warm "root" tint) regardless of selected state.
- **Selected state colors must differ between white and black keys** so highlighted black keys don't visually disappear against highlighted whites. (Final palette in implementation, but the constraint is fixed.)
- Click any key to toggle that semitone in `currentSlot.notes`. One undo entry per toggle.
- **No drag-paint in v1** — click-to-toggle only. Eliminates the "did I drag or click" ambiguity at low implementation cost.
- An octave ruler below the keyboard labels Octaves 0–3.

### LED editor

Below the piano, one row:

- **LED 1**: `<input type="color">` + a swatch. Value flows directly as `rgb(r,g,b)` with each channel 0–255 (matches the file format).
- **LED 2**: same.
- **Gradient preview**: a horizontal strip rendering the LED1→LED2 gradient, mirroring how the module's two LEDs visually blend on the hardware.
- **Root Emphasize**: a checkbox.
- **Clear**: button that wipes notes for the current slot only (LED colors and root-emphasize preserved). Confirms before wiping if notes are present.

### Validation strip

Below the LED row. Either shows `✓ OK` or one or more inline warnings:

- `⚠ scale is empty` — slot has no notes
- `⚠ root emphasize is on but no notes above the first octave` — would produce silence on the lowest octave when emphasized
- `⚠ N notes are above the editor's range (≥ 48)` — only possible after loading a file that uses higher notes; surfaces invisible state without truncating it

All warnings are advisory. Save is never blocked by them. File-level errors during Load (line count, malformed line) are surfaced as a separate banner *above* the slot strip and prevent the load from taking effect.

### Dialogs (copy-to, apply-preset)

Two dialogs share a common shape:

**Copy to…**

- Title: `Copy slot N to…`
- Target picker: 8-column grid of mini gradient pills, one per slot. Source slot is shown grayed and not selectable. Selected target gets the same white-ring treatment as the active slot in the main strip.
- Two checkboxes, both default ON:
  - **Copy notes** *(includes the Root Emphasize flag)*
  - **Copy LED colors**
- Dynamic warning text below the checkboxes: describes what will be replaced in the target (notes count, LED colors, or both) based on the current checkbox state and the target slot's existing contents. Omitted if nothing would be overwritten.
- Confirm button is disabled until a target is selected AND ≥1 checkbox is on.
- On confirm: applies the changes, stays on the current slot, briefly **flashes the target pill in the main strip** with a 3-pulse white ring (~220 ms per pulse, ~660 ms total). One undo entry covers the whole operation.

**Apply preset…**

- Same dialog shape as copy-to. The picker contains **16 preset entries** (sources); the destination is implicit — always the current slot.
- The 16 presets are hardcoded as `FACTORY_PRESETS` in `core.js`, built by parsing `factoryPreset/scale.txt` at design time and pasting the result into the source. Each entry carries the human-readable name from the README (`"Major(R)"`, `"Lydian(R)"`, …) and is displayed in the picker alongside its gradient.
- Two checkboxes, both default ON: `Apply notes` (includes Root Emphasize flag) / `Apply LED colors`.
- Same dynamic warning behavior as copy-to: text below the checkboxes describes what would be replaced in the current slot based on checkbox state and current slot contents. Omitted if nothing would be overwritten.
- No source-grayed affordance (all 16 presets are always selectable; the user is picking, not preventing self-copy).
- On confirm: applies to current slot, flashes the *current* slot's pill in the main strip.

### Keyboard shortcuts

- **Ctrl/⌘ Z** — undo
- **Ctrl/⌘ Shift Z** — redo
- **Ctrl/⌘ S** — save (intercept browser default)
- **←/→** — previous/next slot

### Dirty guard

`beforeunload` listener warns the user if they try to close the tab with unsaved changes.

## File I/O

### Parser — `parseScaleFile(text) → { slots, errors }`

Pure function. Steps:

1. Split on `\n`, trim trailing whitespace from each line, drop trailing empty line(s).
2. If line count ≠ 16 → return `errors: ['Expected 16 lines, got N']`, no `slots`.
3. For each line `i`:
   - Split on `/\s+/`, filter out empties.
   - Need ≥ 7 tokens, else `errors.push('Line N: too few values')`.
   - Each token → `parseInt(tok, 10)`. NaN → `errors.push('Line N: non-numeric token "X"')`.
   - First 6: build `led1` + `led2`. Clamp to 0–255 with a soft-warn if out of range (don't reject; factory uses up to 255).
   - 7th: 0 or 1 → `rootEmphasize`. Other values → warn, treat truthy as on.
   - Remaining: notes. Each ≥ 0. Notes > 47 are loaded into state (so we never silently truncate) and flagged via the per-slot validator.
4. If hard errors (count mismatch, non-numeric, too-few-values), abort the load and surface the errors. Current state is untouched.
5. On success, replace state, reset undo/redo stacks, update `savedSnapshot`.

### Serializer — `serializeScaleFile(slots) → string`

Pure function. Each slot becomes one line:

```
led1.r led1.g led1.b led2.r led2.g led2.b rootEmphasizeFlag note_1 note_2 …
```

- Notes emitted sorted ascending regardless of Set iteration order
- Single-space separators
- LF line endings
- **All 16 lines newline-terminated**, including the last — slight deviation from the factory file's "no newline on last line, trailing space instead", but the firmware almost certainly parses both equivalently (Daisy is permissive about whitespace). If this turns out to be wrong in practice, swap the final `\n` for ` ` to match the factory exactly. Verifying this in hardware is part of v1 acceptance.

### Save (browser side)

```js
const text = serializeScaleFile(state.slots);
const blob = new Blob([text], { type: 'text/plain' });
const url = URL.createObjectURL(blob);
const a = Object.assign(document.createElement('a'), { href: url, download: 'scale.txt' });
a.click();
URL.revokeObjectURL(url);
state.savedSnapshot = deepClone(state.slots);  // clears dirty
```

### Load (browser side)

```js
<input type="file" accept=".txt,text/plain">  →  file.text()  →  parseScaleFile(...)
```

On success, replace state and reset undo/redo. On failure, render the error banner; do not touch state.

### Deliberately out of scope

- **Drag-and-drop loading** — file picker is enough for v1.
- **File System Access API** — Chromium-only, adds a second code path, save downloads work fine.
- **Autosave** — explicit Save click only; users moving SD cards expect explicit "I'm done" moments.

## Testing

### Runner

`node --test tests.js`. Node 18+ ships with both the runner and `node:assert`, zero external dependencies. No `package.json`, no `node_modules`.

The `core.js` / `app.js` split exists specifically to make every interesting unit testable without DOM emulation: anything imported into `tests.js` from `core.js` is a pure function.

### Coverage

**Parser**:
- Factory `scale.txt` parses to 16 slots with spot-checked LED colors, notes, root-emphasize flags
- Round-trip: `parseScaleFile(serializeScaleFile(parseScaleFile(factory))).slots` deep-equals the first parse
- Wrong line count → `errors` populated, no `slots`
- Line with <7 tokens → reports line number
- Non-numeric token → reports it verbatim
- Trailing whitespace, trailing space on last line, missing trailing newline → all accepted

**Serializer**:
- Handcrafted slot → exact expected string
- Notes always sorted ascending regardless of input order
- Empty `notes` → line with only the 7 header values
- All 16 lines newline-terminated

**Validator**:
- Empty scale → empty-scale warning
- Root-emphasize on + no notes ≥ 12 → silence warning
- Notes > 47 → out-of-range warning listing the offending values
- Normal slot → empty warnings array

**State operations**:
- `applyPreset(state, presetIndex, slotIndex, { notes, colors })` with each of the 4 checkbox combos → exact expected `slots[slotIndex]`
- `copySlot(state, from, to, { notes, colors })` → ditto
- `clearSlot(state, idx)` → notes empty, colors and rootEmphasize preserved
- Undo: mutate → snapshot → mutate → undo → deep-equals the snapshot

### Out of scope for v1

UI / DOM interactions. Adding Playwright / Puppeteer would re-introduce the npm dependency cliff we're avoiding. The README's manual test plan covers the high-value UI flows:

- Load factory `scale.txt` → 16 slots appear with correct gradients and notes
- Click a piano key → note toggles, undo button enables
- Apply preset with both checkboxes → notes + colors update; uncheck one → only the other changes
- Copy to a non-empty slot → confirmation; on confirm, target flashes
- Save → diff downloaded file against a known-good fixture
- Refresh dirty page → browser warns

Playwright can be bolted on later if the project grows enough to justify it.

## Distribution

- Editor folder: `WebScaleEditor/` at the repo root, sibling to the existing `ScaleEditor/`.
- Main repo `README.md`'s `# Scale Editing` section gets a new line linking to the new editor; the existing Max-editor link is retained for users on Max.
- If/when GitHub Pages is enabled for the repo, no additional config is needed — the editor becomes live automatically.

## Out of scope for v1 (deferred)

- **Play preview / Web MIDI** — would let users audition a scale; large feature, deserves its own design.
- **`settings.txt` and `midiSettings.txt` editing** — separate file formats; expanding scope risks delaying v1.
- **Drag-paint** on the piano keyboard.
- **Slot names** persisted in the file (would change the file format).
- **Hardware verification of newline-on-last-line vs. trailing-space** — pending real-device test; cheap to flip if needed.
