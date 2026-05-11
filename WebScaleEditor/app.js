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
function renderToolbar() {
  els.btnUndo.disabled = state.undoStack.length === 0;
  els.btnRedo.disabled = state.redoStack.length === 0;

  const undoTop = state.undoStack[state.undoStack.length - 1];
  els.btnUndo.title = undoTop
    ? (state.savedSnapshot && slotsEqual(undoTop.snapshot, state.savedSnapshot)
        ? 'Undo to last saved state'
        : `Undo: ${undoTop.reason}`)
    : 'Nothing to undo';

  const redoTop = state.redoStack[state.redoStack.length - 1];
  els.btnRedo.title = redoTop
    ? (state.savedSnapshot && slotsEqual(redoTop.snapshot, state.savedSnapshot)
        ? 'Redo to last saved state'
        : `Redo: ${redoTop.reason}`)
    : 'Nothing to redo';

  // "Return to saved" indicator
  const undoLeadsToSaved = undoTop && state.savedSnapshot && slotsEqual(undoTop.snapshot, state.savedSnapshot);
  const redoLeadsToSaved = redoTop && state.savedSnapshot && slotsEqual(redoTop.snapshot, state.savedSnapshot);
  els.btnUndo.classList.toggle('saved-hint', !!undoLeadsToSaved);
  els.btnRedo.classList.toggle('saved-hint', !!redoLeadsToSaved);
}
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

els.btnUndo.addEventListener('click', () => {
  if (state.undoStack.length === 0) return;
  const entry = state.undoStack.pop();
  state.redoStack.push({ snapshot: deepCloneSlots(state.slots), reason: entry.reason });
  state.slots = entry.snapshot;
  renderAll();
});
els.btnRedo.addEventListener('click', () => {
  if (state.redoStack.length === 0) return;
  const entry = state.redoStack.pop();
  state.undoStack.push({ snapshot: deepCloneSlots(state.slots), reason: entry.reason });
  state.slots = entry.snapshot;
  renderAll();
});

window.addEventListener('beforeunload', (e) => {
  if (isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

let dialogState = null;   // active dialog session

function openDialog(opts) {
  dialogState = {
    selectedIndex: -1,
    opts,
  };
  els.dialogTitle.textContent = opts.title;
  els.dialogLead.textContent = opts.lead;
  els.dialogCbNotesLabel.textContent = opts.cbNotesLabel;
  els.dialogCbColorsLabel.textContent = opts.cbColorsLabel;
  els.dialogCbNotes.checked = true;
  els.dialogCbColors.checked = true;

  // Build picker.
  els.dialogPicker.innerHTML = '';
  opts.pickerEntries.forEach((entry, i) => {
    const p = document.createElement('button');
    p.type = 'button';
    p.className = 'dialog-pill' + (entry.disabled ? ' self' : '');
    p.style.background = slotGradient(entry.slot);
    p.style.backgroundOrigin = 'border-box';
    p.style.backgroundRepeat = 'no-repeat';
    p.textContent = entry.label || String(i).padStart(2, '0');
    if (entry.disabled) {
      p.disabled = true;
    } else {
      p.addEventListener('click', () => {
        dialogState.selectedIndex = i;
        for (const child of els.dialogPicker.children) {
          child.classList.toggle('selected', child === p);
        }
        refreshDialog();
      });
    }
    els.dialogPicker.appendChild(p);
  });

  refreshDialog();
  els.dialogBackdrop.hidden = false;
}

function refreshDialog() {
  const { selectedIndex, opts } = dialogState;
  const flags = { notes: els.dialogCbNotes.checked, colors: els.dialogCbColors.checked };
  const warning = (selectedIndex >= 0)
    ? (opts.onSelectionChange ? opts.onSelectionChange(selectedIndex, flags) : '')
    : '';
  els.dialogWarning.hidden = !warning;
  els.dialogWarning.textContent = warning;
  els.dialogConfirm.disabled = !(selectedIndex >= 0 && (flags.notes || flags.colors));
}

function closeDialog() {
  els.dialogBackdrop.hidden = true;
  dialogState = null;
}

els.dialogCbNotes.addEventListener('change', () => dialogState && refreshDialog());
els.dialogCbColors.addEventListener('change', () => dialogState && refreshDialog());
els.dialogCancel.addEventListener('click', closeDialog);
els.dialogConfirm.addEventListener('click', () => {
  if (!dialogState || dialogState.selectedIndex < 0) return;
  const { selectedIndex, opts } = dialogState;
  const flags = { notes: els.dialogCbNotes.checked, colors: els.dialogCbColors.checked };
  if (opts.onConfirm(selectedIndex, flags) !== false) closeDialog();
});

// Close on backdrop click or Escape.
els.dialogBackdrop.addEventListener('click', (e) => {
  if (e.target === els.dialogBackdrop) closeDialog();
});
window.addEventListener('keydown', (e) => {
  if (!els.dialogBackdrop.hidden && e.key === 'Escape') closeDialog();
});

function flashSlotPill(index) {
  // Find the pill in the strip by its child index after a render.
  const pill = els.slotStrip.children[index];
  if (!pill) return;
  pill.classList.remove('flash');
  // Force a reflow so the animation re-runs even if class was just removed.
  // eslint-disable-next-line no-unused-expressions
  pill.offsetWidth;
  pill.classList.add('flash');
}

function describeReplacement(targetSlot, flags) {
  const bits = [];
  if (flags.notes && targetSlot.notes.size > 0) {
    bits.push(`${targetSlot.notes.size} note${targetSlot.notes.size === 1 ? '' : 's'}`);
  }
  if (flags.colors) {
    const hasColor = targetSlot.led1.r || targetSlot.led1.g || targetSlot.led1.b ||
                     targetSlot.led2.r || targetSlot.led2.g || targetSlot.led2.b;
    if (hasColor) bits.push('LED colors');
  }
  if (bits.length === 0) return '';
  return `⚠ Existing ${bits.join(' and ')} will be replaced.`;
}

els.btnCopy.addEventListener('click', () => {
  const sourceIdx = state.currentSlotIndex;
  const sourceSlot = state.slots[sourceIdx];
  openDialog({
    title: `Copy slot ${sourceIdx} to…`,
    lead: 'Pick a destination slot, then choose what to copy.',
    cbNotesLabel: 'Copy notes (includes the Root Emphasize flag)',
    cbColorsLabel: 'Copy LED colors',
    pickerEntries: state.slots.map((s, i) => ({
      label: String(i).padStart(2, '0'),
      slot: s,
      disabled: i === sourceIdx,
    })),
    onSelectionChange(targetIdx, flags) {
      return describeReplacement(state.slots[targetIdx], flags);
    },
    onConfirm(targetIdx, flags) {
      commit(`copy slot ${sourceIdx} to slot ${targetIdx}`);
      state.slots = applyToSlot(state.slots, sourceSlot, targetIdx, flags);
      renderAll();
      flashSlotPill(targetIdx);
      return true;
    },
  });
});

els.btnPreset.addEventListener('click', () => {
  const targetIdx = state.currentSlotIndex;
  openDialog({
    title: `Apply preset to slot ${targetIdx}…`,
    lead: 'Pick a factory preset, then choose what to apply.',
    cbNotesLabel: 'Apply notes (includes the Root Emphasize flag)',
    cbColorsLabel: 'Apply LED colors',
    pickerEntries: FACTORY_PRESETS.map(p => ({
      label: p.name,
      slot: p.slot,
      disabled: false,
    })),
    onSelectionChange(_presetIdx, flags) {
      return describeReplacement(state.slots[targetIdx], flags);
    },
    onConfirm(presetIdx, flags) {
      commit(`apply preset "${FACTORY_PRESETS[presetIdx].name}" to slot ${targetIdx}`);
      state.slots = applyToSlot(state.slots, FACTORY_PRESETS[presetIdx].slot, targetIdx, flags);
      renderAll();
      flashSlotPill(targetIdx);
      return true;
    },
  });
});

window.addEventListener('keydown', (e) => {
  // Skip when typing in a form field.
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    // Allow Ctrl/Cmd-S even in inputs.
    if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) return;
  }
  // Don't interfere when a dialog is open (it handles its own Escape).
  if (!els.dialogBackdrop.hidden) return;

  const mod = e.ctrlKey || e.metaKey;

  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    els.btnUndo.click();
  } else if (mod && (e.key.toLowerCase() === 'z' && e.shiftKey || e.key.toLowerCase() === 'y')) {
    e.preventDefault();
    els.btnRedo.click();
  } else if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault();
    els.btnSave.click();
  } else if (e.key === 'ArrowLeft' && !mod) {
    e.preventDefault();
    state.currentSlotIndex = (state.currentSlotIndex + 15) % 16;
    renderAll();
  } else if (e.key === 'ArrowRight' && !mod) {
    e.preventDefault();
    state.currentSlotIndex = (state.currentSlotIndex + 1) % 16;
    renderAll();
  }
});
