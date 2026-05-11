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

// --- Renderers (filled in by later tasks) ------------------------------

function renderSlotStrip() { /* Task 16 */ }
function renderPiano()     { /* Task 17 */ }
function renderLedEditor() { /* Task 19 */ }
function renderValidation(){ /* Task 21 */ }
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
