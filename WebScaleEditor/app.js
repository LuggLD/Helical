import {
  createDefaultSlots,
  deepCloneSlots,
  slotsEqual,
  validateSlot,
  FACTORY_PRESETS,
  parseScaleFile,
  serializeScaleFile,
  applyToSlot,
  clearSlot,
} from './core.js';

// --- State -------------------------------------------------------------

const state = {
  slots: createDefaultSlots(),
  currentSlotIndex: 0,
  undoStack: [],          // { snapshot, reason }
  redoStack: [],
  savedSnapshot: null,    // set by Load/Save; null means "never loaded/saved"
};
state.savedSnapshot = deepCloneSlots(state.slots);

// --- DOM refs ----------------------------------------------------------

const $ = (id) => document.getElementById(id);
const els = {
  dirty:      $('dirty-indicator'),
  errorBanner:$('error-banner'),
  btnLoad:    $('btn-load'),
  btnSave:    $('btn-save'),
  btnUndo:    $('btn-undo'),
  btnRedo:    $('btn-redo'),
  btnCopy:    $('btn-copy'),
  btnPreset:  $('btn-preset'),
  btnClear:   $('btn-clear'),
  fileInput:  $('file-input'),
  slotStrip:  $('slot-strip'),
  editorTitle:$('editor-title'),
  piano:      $('piano'),
  led1:       $('led1-input'),
  led2:       $('led2-input'),
  ledPreview: $('led-preview'),
  rootEmph:   $('root-emphasize-input'),
  validation: $('validation-strip'),
  dialogBackdrop: $('dialog-backdrop'),
  dialog:         $('dialog'),
  dialogTitle:    $('dialog-title'),
  dialogLead:     $('dialog-lead'),
  dialogPicker:   $('dialog-picker'),
  dialogCbNotes:  $('dialog-cb-notes'),
  dialogCbColors: $('dialog-cb-colors'),
  dialogCbNotesLabel:  $('dialog-cb-notes-label'),
  dialogCbColorsLabel: $('dialog-cb-colors-label'),
  dialogWarning: $('dialog-warning'),
  dialogCancel:  $('dialog-cancel'),
  dialogConfirm: $('dialog-confirm'),
};

// --- Helpers -----------------------------------------------------------

function isDirty() {
  return !slotsEqual(state.slots, state.savedSnapshot);
}

function rgbToHex(c) {
  const cl = (n) => Math.max(0, Math.min(255, n));
  return '#' + [cl(c.r), cl(c.g), cl(c.b)]
    .map(x => x.toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex) {
  const m = hex.match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}
function rgbCss(c) { return `rgb(${c.r}, ${c.g}, ${c.b})`; }
function slotGradient(s) {
  return `linear-gradient(180deg, ${rgbCss(s.led1)}, ${rgbCss(s.led2)})`;
}

const UNDO_LIMIT = 100;

function commit(reason) {
  state.undoStack.push({ snapshot: deepCloneSlots(state.slots), reason });
  if (state.undoStack.length > UNDO_LIMIT) state.undoStack.shift();
  state.redoStack.length = 0;
}

// --- Renderers (filled in by later tasks) ------------------------------

function renderSlotStrip() {
  els.slotStrip.innerHTML = '';
  for (let i = 0; i < state.slots.length; i++) {
    const s = state.slots[i];
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'slot-pill' + (i === state.currentSlotIndex ? ' active' : '');
    pill.style.background = slotGradient(s);
    pill.style.backgroundOrigin = 'border-box';
    pill.style.backgroundRepeat = 'no-repeat';
    pill.textContent = String(i).padStart(2, '0');
    pill.title = `Slot ${i} · ${s.notes.size} note${s.notes.size === 1 ? '' : 's'}`;
    pill.addEventListener('click', () => {
      state.currentSlotIndex = i;
      renderAll();
    });
    els.slotStrip.appendChild(pill);
  }
}
const WHITE_SEMITONES_PER_OCTAVE = [0, 2, 4, 5, 7, 9, 11];
const BLACK_KEY_OFFSETS = [
  // [white boundary within octave (1..6), semitone offset within octave]
  [1, 1], [2, 3], [4, 6], [5, 8], [6, 10],
];
const BLACK_WIDTH_PCT = 2.3;
const BLACK_HALF_PCT = BLACK_WIDTH_PCT / 2;

function isRootSemitone(n) { return n % 12 === 0; }

function renderPiano() {
  els.piano.innerHTML = '';
  const slot = state.slots[state.currentSlotIndex];

  // White keys, 28 of them.
  for (let oct = 0; oct < 4; oct++) {
    for (let i = 0; i < WHITE_SEMITONES_PER_OCTAVE.length; i++) {
      const n = WHITE_SEMITONES_PER_OCTAVE[i] + 12 * oct;
      const k = document.createElement('div');
      k.className = 'pk-white'
        + (slot.notes.has(n) ? ' on' : '')
        + (isRootSemitone(n) ? ' root' : '');
      k.textContent = String(n);
      k.dataset.note = String(n);
      k.addEventListener('click', () => togglePianoNote(n));
      els.piano.appendChild(k);
    }
  }

  // Black keys, 20 of them, absolutely positioned.
  for (let oct = 0; oct < 4; oct++) {
    const whiteBase = oct * 7;
    for (const [boundaryWithinOct, semWithinOct] of BLACK_KEY_OFFSETS) {
      const boundaryN = whiteBase + boundaryWithinOct;
      const semitone = 12 * oct + semWithinOct;
      const leftPct = (boundaryN * 100 / 28) - BLACK_HALF_PCT;
      const k = document.createElement('div');
      k.className = 'pk-black' + (slot.notes.has(semitone) ? ' on' : '');
      k.style.left = leftPct.toFixed(3) + '%';
      k.textContent = String(semitone);
      k.dataset.note = String(semitone);
      k.addEventListener('click', () => togglePianoNote(semitone));
      els.piano.appendChild(k);
    }
  }
}

// Stub — implemented in Task 18.
function togglePianoNote(n) {
  const slot = state.slots[state.currentSlotIndex];
  commit(`toggle note ${n} in slot ${state.currentSlotIndex}`);
  // Replace slot with a new object so undo snapshots remain correct.
  const newSlot = {
    led1: { ...slot.led1 }, led2: { ...slot.led2 },
    rootEmphasize: slot.rootEmphasize,
    notes: new Set(slot.notes),
  };
  if (newSlot.notes.has(n)) newSlot.notes.delete(n);
  else newSlot.notes.add(n);
  state.slots[state.currentSlotIndex] = newSlot;
  renderAll();
}
function renderLedEditor() {
  const slot = state.slots[state.currentSlotIndex];
  els.led1.value = rgbToHex(slot.led1);
  els.led2.value = rgbToHex(slot.led2);
  els.rootEmph.checked = slot.rootEmphasize;
  els.ledPreview.style.background = slotGradient(slot);
}
function renderValidation() {
  const slot = state.slots[state.currentSlotIndex];
  const warns = validateSlot(slot);
  els.validation.innerHTML = '';
  if (warns.length === 0) {
    const ok = document.createElement('span');
    ok.className = 'ok';
    ok.textContent = '✓ OK';
    els.validation.appendChild(ok);
  } else {
    for (const w of warns) {
      const div = document.createElement('div');
      div.className = 'warn';
      div.textContent = '⚠ ' + w;
      els.validation.appendChild(div);
    }
  }
}
function renderToolbar()   { /* Task 24+27 */ }
function renderDirty() {
  els.dirty.hidden = !isDirty();
}
function renderAll() {
  renderSlotStrip();
  renderPiano();
  renderLedEditor();
  renderValidation();
  renderToolbar();
  renderDirty();
  els.editorTitle.textContent = `Slot ${String(state.currentSlotIndex).padStart(2, '0')}`;
}

renderAll();
console.log('[WebScaleEditor] booted, 16 default slots');

// Use 'change' (fires once on picker dismiss), NOT 'input' (fires while
// dragging — would flood the undo stack).
els.led1.addEventListener('change', (e) => {
  commit('change LED 1 color');
  const slot = state.slots[state.currentSlotIndex];
  state.slots[state.currentSlotIndex] = { ...slot, led1: hexToRgb(e.target.value) };
  renderAll();
});
els.led2.addEventListener('change', (e) => {
  commit('change LED 2 color');
  const slot = state.slots[state.currentSlotIndex];
  state.slots[state.currentSlotIndex] = { ...slot, led2: hexToRgb(e.target.value) };
  renderAll();
});
els.rootEmph.addEventListener('change', (e) => {
  commit('toggle root emphasize');
  const slot = state.slots[state.currentSlotIndex];
  state.slots[state.currentSlotIndex] = { ...slot, rootEmphasize: e.target.checked };
  renderAll();
});

els.btnClear.addEventListener('click', () => {
  const slot = state.slots[state.currentSlotIndex];
  if (slot.notes.size > 0) {
    const ok = confirm(`Clear all ${slot.notes.size} note${slot.notes.size === 1 ? '' : 's'} from slot ${state.currentSlotIndex}? (LED colors and Root Emphasize will be preserved.)`);
    if (!ok) return;
  }
  commit(`clear notes in slot ${state.currentSlotIndex}`);
  state.slots = clearSlot(state.slots, state.currentSlotIndex);
  renderAll();
});

els.btnSave.addEventListener('click', () => {
  const text = serializeScaleFile(state.slots);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'scale.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  state.savedSnapshot = deepCloneSlots(state.slots);
  renderAll();
});

function showErrorBanner(messages) {
  els.errorBanner.hidden = false;
  els.errorBanner.textContent = messages.join('\n');
}
function clearErrorBanner() {
  els.errorBanner.hidden = true;
  els.errorBanner.textContent = '';
}

els.btnLoad.addEventListener('click', () => {
  if (isDirty()) {
    const ok = confirm('You have unsaved changes. Discard them and load a new file?');
    if (!ok) return;
  }
  els.fileInput.value = '';
  els.fileInput.click();
});

els.fileInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const { slots, errors } = parseScaleFile(text);
  if (errors.length > 0 || !slots) {
    showErrorBanner(['Could not load file:', ...errors]);
    return;
  }
  clearErrorBanner();
  state.slots = slots;
  state.savedSnapshot = deepCloneSlots(slots);
  state.undoStack.length = 0;
  state.redoStack.length = 0;
  state.currentSlotIndex = 0;
  renderAll();
});
