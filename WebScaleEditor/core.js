// Pure logic for the Helical scale editor. No DOM.
//
// Loaded two different ways, deliberately as a *classic* script (not an ES
// module) so it works in both:
//   - Browser: a plain <script src="core.js"> tag exposes window.HelicalCore.
//     ES-module imports are CORS-blocked when index.html is opened from disk
//     (file://), so the editor avoids them entirely.
//   - Node: require('./core.js') returns the same API, used by tests.js.
(function (root) {
  'use strict';

  const VERSION = '0.1.0';

  function parseScaleFile(text) {
    const errors = [];
    const warnings = [];

    let lines = text.split('\n').map(line => line.replace(/\s+$/, ''));
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

    if (lines.length !== 16) {
      errors.push(`Expected 16 lines, got ${lines.length}`);
      return { slots: null, errors, warnings };
    }

    const slots = [];
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const toks = lines[i].trim().split(/\s+/).filter(t => t.length > 0);

      if (toks.length < 7) {
        errors.push(`line ${lineNum}: too few values (expected at least 7, got ${toks.length})`);
        continue;
      }

      const nums = [];
      let lineHadError = false;
      for (const tok of toks) {
        const n = parseInt(tok, 10);
        if (!Number.isFinite(n) || String(n) !== tok) {
          errors.push(`line ${lineNum}: non-numeric token "${tok}"`);
          lineHadError = true;
          break;
        }
        nums.push(n);
      }
      if (lineHadError) continue;

      for (let c = 0; c < 6; c++) {
        if (nums[c] < 0 || nums[c] > 255) {
          warnings.push(`line ${lineNum}: LED channel value ${nums[c]} is outside 0-255`);
        }
      }
      if (nums[6] !== 0 && nums[6] !== 1) {
        warnings.push(`line ${lineNum}: rootEmphasize flag ${nums[6]} is not 0 or 1`);
      }

      slots.push({
        led1: { r: nums[0], g: nums[1], b: nums[2] },
        led2: { r: nums[3], g: nums[4], b: nums[5] },
        rootEmphasize: nums[6] !== 0,
        notes: new Set(nums.slice(7).filter(n => n >= 0)),
      });
    }

    if (errors.length > 0) {
      return { slots: null, errors, warnings };
    }
    return { slots, errors, warnings };
  }

  function serializeScaleFile(slots) {
    if (!Array.isArray(slots) || slots.length !== 16) {
      throw new Error(`serializeScaleFile expects 16 slots, got ${slots && slots.length}`);
    }
    return slots.map(s => {
      const sorted = [...s.notes].sort((a, b) => a - b);
      const parts = [
        s.led1.r, s.led1.g, s.led1.b,
        s.led2.r, s.led2.g, s.led2.b,
        s.rootEmphasize ? 1 : 0,
        ...sorted,
      ];
      return parts.join(' ');
    }).join('\n') + '\n';
  }

  function validateSlot(slot) {
    const out = [];
    if (slot.notes.size === 0) {
      out.push('Scale is empty');
    }
    if (slot.rootEmphasize && slot.notes.size > 0) {
      const hasUpper = [...slot.notes].some(n => n >= 12);
      if (!hasUpper) {
        out.push('Root Emphasize is on but no notes above the first octave — this will produce silence');
      }
    }
    const oor = [...slot.notes].filter(n => n >= 48).sort((a, b) => a - b);
    if (oor.length > 0) {
      out.push(`Notes outside the editor's 4-octave range (>=48): ${oor.join(', ')}`);
    }
    return out;
  }

  function deepCloneSlots(slots) {
    return slots.map(s => ({
      led1: { ...s.led1 },
      led2: { ...s.led2 },
      rootEmphasize: s.rootEmphasize,
      notes: new Set(s.notes),
    }));
  }

  function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }

  function slotsEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i], y = b[i];
      if (x.led1.r !== y.led1.r || x.led1.g !== y.led1.g || x.led1.b !== y.led1.b) return false;
      if (x.led2.r !== y.led2.r || x.led2.g !== y.led2.g || x.led2.b !== y.led2.b) return false;
      if (x.rootEmphasize !== y.rootEmphasize) return false;
      if (!setsEqual(x.notes, y.notes)) return false;
    }
    return true;
  }

  function createDefaultSlots() {
    return Array.from({ length: 16 }, () => ({
      led1: { r: 0, g: 0, b: 0 },
      led2: { r: 0, g: 0, b: 0 },
      rootEmphasize: false,
      notes: new Set(),
    }));
  }

  function applyToSlot(slots, sourceSlot, targetIndex, { notes, colors }) {
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= slots.length) {
      throw new Error(`applyToSlot: targetIndex ${targetIndex} out of range`);
    }
    const current = slots[targetIndex];
    const next = {
      led1: colors ? { ...sourceSlot.led1 } : { ...current.led1 },
      led2: colors ? { ...sourceSlot.led2 } : { ...current.led2 },
      rootEmphasize: notes ? sourceSlot.rootEmphasize : current.rootEmphasize,
      notes: notes ? new Set(sourceSlot.notes) : new Set(current.notes),
    };
    const out = slots.slice();
    out[targetIndex] = next;
    return out;
  }

  function clearSlot(slots, targetIndex) {
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= slots.length) {
      throw new Error(`clearSlot: targetIndex ${targetIndex} out of range`);
    }
    const current = slots[targetIndex];
    const next = {
      led1: { ...current.led1 },
      led2: { ...current.led2 },
      rootEmphasize: current.rootEmphasize,
      notes: new Set(),
    };
    const out = slots.slice();
    out[targetIndex] = next;
    return out;
  }

  const FACTORY_FILE_TEXT = `\
127 0 0 127 0 51 1 0 7 12 14 16 17 19 21 23
0 102 0 127 0 51 1 0 7 12 14 16 18 19 21 23
0 0 127 127 0 51 1 0 7 12 14 16 17 19 21 22
127 127 51 127 0 51 1 0 7 12 14 16 19 21
0 0 127 51 102 127 1 0 7 12 14 15 17 19 20 22
102 0 0 51 102 127 1 0 7 12 14 15 17 19 21 22
0 152 0 51 102 127 1 0 7 12 13 15 17 19 20 22
127 127 51 51 102 127 1 0 7 12 15 17 19 22
0 127 51 127 127 0 0 0 2 4 6 8 10
127 127 51 127 127 51 0 0 1 2 3 4 5 6 7 8 9 10 11
127 127 51 152 0 0 1 0 7 12 16 19 23
51 51 127 0 152 0 1 2 9 12 14 17 21
51 51 127 0 0 127 1 4 11 14 16 19 23
127 127 51 127 127 0 1 5 12 16 17 21
127 127 0 0 127 102 1 7 14 17 19 23
51 51 127 127 0 102 1 9 12 16 19 21`;

  const FACTORY_PRESET_NAMES = [
    'Major(R)', 'Lydian(R)', 'Mixolydian(R)', 'Major Pentatonic(R)',
    'Natural Minor(R)', 'Dorian(R)', 'Phrygian(R)', 'Minor Pentatonic(R)',
    'Whole tone', 'Chromatic',
    'I M7(R)', 'II m7(R)', 'III m7(R)', 'IV M7(R)',
    'V 7(R)', 'VI m7(R)',
  ];

  const _parsedFactory = parseScaleFile(FACTORY_FILE_TEXT);
  if (_parsedFactory.errors.length > 0) {
    throw new Error('FACTORY_FILE_TEXT failed to parse: ' + _parsedFactory.errors.join('; '));
  }

  const FACTORY_PRESETS = _parsedFactory.slots.map((slot, i) => ({
    name: FACTORY_PRESET_NAMES[i],
    slot,
  }));

  const api = {
    VERSION,
    parseScaleFile,
    serializeScaleFile,
    validateSlot,
    deepCloneSlots,
    slotsEqual,
    createDefaultSlots,
    applyToSlot,
    clearSlot,
    FACTORY_PRESETS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;        // Node (CommonJS) — used by tests.js
  } else {
    root.HelicalCore = api;      // Browser global — used by app.js
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
