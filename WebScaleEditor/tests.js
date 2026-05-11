import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, parseScaleFile, serializeScaleFile, validateSlot, deepCloneSlots, slotsEqual, createDefaultSlots, applyToSlot } from './core.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FACTORY = readFileSync(join(__dirname, '../factoryPreset/scale.txt'), 'utf8');

test('core.js loads as an ES module', () => {
  assert.equal(typeof VERSION, 'string');
});

test('parseScaleFile parses factory file to 16 slots with no errors', () => {
  const { slots, errors } = parseScaleFile(FACTORY);
  assert.equal(errors.length, 0);
  assert.equal(slots.length, 16);
});

test('parseScaleFile correctly parses slot 0 of factory file', () => {
  const { slots } = parseScaleFile(FACTORY);
  const s0 = slots[0];
  assert.deepEqual(s0.led1, { r: 127, g: 0, b: 0 });
  assert.deepEqual(s0.led2, { r: 127, g: 0, b: 51 });
  assert.equal(s0.rootEmphasize, true);
  assert.deepEqual([...s0.notes].sort((a,b) => a-b), [0,7,12,14,16,17,19,21,23]);
});

test('parseScaleFile correctly parses slot 8 of factory file (Whole tone — rootEmphasize off)', () => {
  const { slots } = parseScaleFile(FACTORY);
  const s8 = slots[8];
  assert.equal(s8.rootEmphasize, false);
  assert.deepEqual([...s8.notes].sort((a,b) => a-b), [0,2,4,6,8,10]);
});

test('parseScaleFile rejects wrong line count', () => {
  const { slots, errors } = parseScaleFile('1 2 3 4 5 6 1\n');
  assert.equal(slots, null);
  assert.match(errors[0], /Expected 16 lines, got 1/);
});

test('parseScaleFile rejects a line with too few tokens', () => {
  const tooShort = '1 2 3\n' + ('1 2 3 4 5 6 1 0\n'.repeat(15));
  const { slots, errors } = parseScaleFile(tooShort);
  assert.equal(slots, null);
  assert.ok(errors.some(e => /line 1.*too few/i.test(e)));
});

test('parseScaleFile rejects a non-numeric token', () => {
  const bad = '1 2 3 4 5 6 abc 0 7\n' + ('1 2 3 4 5 6 1 0\n'.repeat(15));
  const { slots, errors } = parseScaleFile(bad);
  assert.equal(slots, null);
  assert.ok(errors.some(e => /line 1.*abc/.test(e)));
});

test('parseScaleFile tolerates missing trailing newline', () => {
  const noTrailing = FACTORY.replace(/[\s\n]+$/, '');
  const { errors } = parseScaleFile(noTrailing);
  assert.equal(errors.length, 0);
});

test('parseScaleFile tolerates trailing space on the last line (factory behavior)', () => {
  const { errors } = parseScaleFile(FACTORY);
  assert.equal(errors.length, 0);
});

test('parseScaleFile soft-warns on LED value > 255 (loads it anyway)', () => {
  const oneBad = '300 0 0 0 0 0 0 7\n' + ('1 2 3 4 5 6 1 0\n'.repeat(15));
  const { slots, warnings } = parseScaleFile(oneBad);
  assert.equal(slots.length, 16);
  assert.equal(slots[0].led1.r, 300);
  assert.ok(warnings.some(w => /line 1.*LED/i.test(w)));
});

test('serializeScaleFile produces one line per slot, LF terminated', () => {
  const slot = {
    led1: { r: 127, g: 0, b: 0 },
    led2: { r: 127, g: 0, b: 51 },
    rootEmphasize: true,
    notes: new Set([12, 7, 0, 14, 16, 17, 19, 21, 23]),
  };
  const slots = Array.from({ length: 16 }, () => slot);
  const out = serializeScaleFile(slots);
  const lines = out.split('\n');
  assert.equal(lines.length, 17);
  assert.equal(lines[16], '');
  assert.equal(lines[0], '127 0 0 127 0 51 1 0 7 12 14 16 17 19 21 23');
});

test('serializeScaleFile emits notes sorted ascending', () => {
  const slot = {
    led1: { r: 0, g: 0, b: 0 }, led2: { r: 0, g: 0, b: 0 },
    rootEmphasize: false, notes: new Set([23, 7, 0, 12]),
  };
  const out = serializeScaleFile(Array.from({ length: 16 }, () => slot));
  assert.equal(out.split('\n')[0], '0 0 0 0 0 0 0 0 7 12 23');
});

test('serializeScaleFile handles empty notes set', () => {
  const slot = {
    led1: { r: 1, g: 2, b: 3 }, led2: { r: 4, g: 5, b: 6 },
    rootEmphasize: true, notes: new Set(),
  };
  const out = serializeScaleFile(Array.from({ length: 16 }, () => slot));
  assert.equal(out.split('\n')[0], '1 2 3 4 5 6 1');
});

test('parse → serialize → parse round-trips on factory file', () => {
  const first = parseScaleFile(FACTORY);
  const text = serializeScaleFile(first.slots);
  const second = parseScaleFile(text);
  assert.equal(second.errors.length, 0);
  assert.equal(second.slots.length, 16);
  for (let i = 0; i < 16; i++) {
    assert.deepEqual(second.slots[i].led1, first.slots[i].led1, `slot ${i} led1`);
    assert.deepEqual(second.slots[i].led2, first.slots[i].led2, `slot ${i} led2`);
    assert.equal(second.slots[i].rootEmphasize, first.slots[i].rootEmphasize, `slot ${i} rootEmphasize`);
    assert.deepEqual(
      [...second.slots[i].notes].sort((a,b)=>a-b),
      [...first.slots[i].notes].sort((a,b)=>a-b),
      `slot ${i} notes`
    );
  }
});

test('validateSlot returns no warnings for a normal slot', () => {
  const slot = {
    led1: { r: 127, g: 0, b: 0 }, led2: { r: 127, g: 0, b: 51 },
    rootEmphasize: true, notes: new Set([0, 7, 12, 14, 16, 17, 19, 21, 23]),
  };
  assert.deepEqual(validateSlot(slot), []);
});

test('validateSlot warns on empty notes', () => {
  const slot = {
    led1: { r: 0, g: 0, b: 0 }, led2: { r: 0, g: 0, b: 0 },
    rootEmphasize: false, notes: new Set(),
  };
  assert.ok(validateSlot(slot).some(w => /empty/i.test(w)));
});

test('validateSlot warns when root emphasize on + no notes >= 12', () => {
  const slot = {
    led1: { r: 0, g: 0, b: 0 }, led2: { r: 0, g: 0, b: 0 },
    rootEmphasize: true, notes: new Set([0, 2, 4, 7]),
  };
  assert.ok(validateSlot(slot).some(w => /first octave/i.test(w) || /silence/i.test(w)));
});

test('validateSlot does NOT warn about emphasize-silence when rootEmphasize off', () => {
  const slot = {
    led1: { r: 0, g: 0, b: 0 }, led2: { r: 0, g: 0, b: 0 },
    rootEmphasize: false, notes: new Set([0, 2, 4, 7]),
  };
  assert.equal(validateSlot(slot).length, 0);
});

test('validateSlot warns about notes >= 48', () => {
  const slot = {
    led1: { r: 0, g: 0, b: 0 }, led2: { r: 0, g: 0, b: 0 },
    rootEmphasize: false, notes: new Set([0, 7, 48, 60]),
  };
  const w = validateSlot(slot);
  assert.ok(w.some(s => /48/.test(s) && /60/.test(s)));
});

test('deepCloneSlots produces an independent copy including the notes Set', () => {
  const orig = parseScaleFile(FACTORY).slots;
  const copy = deepCloneSlots(orig);
  assert.notEqual(copy, orig);
  assert.notEqual(copy[0], orig[0]);
  assert.notEqual(copy[0].notes, orig[0].notes);
  copy[0].notes.add(99);
  assert.equal(orig[0].notes.has(99), false);
});

test('slotsEqual returns true for identical clones', () => {
  const a = parseScaleFile(FACTORY).slots;
  const b = deepCloneSlots(a);
  assert.equal(slotsEqual(a, b), true);
});

test('slotsEqual returns false when a note differs', () => {
  const a = parseScaleFile(FACTORY).slots;
  const b = deepCloneSlots(a);
  b[3].notes.add(99);
  assert.equal(slotsEqual(a, b), false);
});

test('slotsEqual returns false when an LED color differs', () => {
  const a = parseScaleFile(FACTORY).slots;
  const b = deepCloneSlots(a);
  b[5].led1.r = (b[5].led1.r + 1) % 256;
  assert.equal(slotsEqual(a, b), false);
});

test('slotsEqual returns false when rootEmphasize differs', () => {
  const a = parseScaleFile(FACTORY).slots;
  const b = deepCloneSlots(a);
  b[7].rootEmphasize = !b[7].rootEmphasize;
  assert.equal(slotsEqual(a, b), false);
});

test('createDefaultSlots returns 16 slots', () => {
  assert.equal(createDefaultSlots().length, 16);
});

test('createDefaultSlots has all LEDs off, no notes, no emphasis', () => {
  const slots = createDefaultSlots();
  for (const s of slots) {
    assert.deepEqual(s.led1, { r: 0, g: 0, b: 0 });
    assert.deepEqual(s.led2, { r: 0, g: 0, b: 0 });
    assert.equal(s.rootEmphasize, false);
    assert.equal(s.notes.size, 0);
  }
});

test('createDefaultSlots returns independent objects', () => {
  const slots = createDefaultSlots();
  slots[0].led1.r = 200;
  slots[0].notes.add(5);
  assert.equal(slots[1].led1.r, 0);
  assert.equal(slots[1].notes.size, 0);
});

const SAMPLE_SOURCE = {
  led1: { r: 50, g: 100, b: 150 },
  led2: { r: 200, g: 0, b: 100 },
  rootEmphasize: true,
  notes: new Set([0, 5, 10]),
};

test('applyToSlot with both flags replaces everything in target', () => {
  const slots = createDefaultSlots();
  const out = applyToSlot(slots, SAMPLE_SOURCE, 3, { notes: true, colors: true });
  assert.deepEqual(out[3].led1, SAMPLE_SOURCE.led1);
  assert.deepEqual(out[3].led2, SAMPLE_SOURCE.led2);
  assert.equal(out[3].rootEmphasize, true);
  assert.deepEqual([...out[3].notes].sort(), [0, 10, 5]);
});

test('applyToSlot with notes:true colors:false leaves target LEDs untouched', () => {
  const slots = createDefaultSlots();
  slots[3].led1 = { r: 1, g: 2, b: 3 };
  const out = applyToSlot(slots, SAMPLE_SOURCE, 3, { notes: true, colors: false });
  assert.deepEqual(out[3].led1, { r: 1, g: 2, b: 3 });
  assert.equal(out[3].rootEmphasize, true);
  assert.equal(out[3].notes.size, 3);
});

test('applyToSlot with notes:false colors:true leaves target notes untouched', () => {
  const slots = createDefaultSlots();
  slots[3].notes = new Set([99]);
  slots[3].rootEmphasize = false;
  const out = applyToSlot(slots, SAMPLE_SOURCE, 3, { notes: false, colors: true });
  assert.deepEqual([...out[3].notes], [99]);
  assert.equal(out[3].rootEmphasize, false);
  assert.deepEqual(out[3].led1, SAMPLE_SOURCE.led1);
});

test('applyToSlot returns a new array; original is unchanged', () => {
  const slots = createDefaultSlots();
  const out = applyToSlot(slots, SAMPLE_SOURCE, 3, { notes: true, colors: true });
  assert.notEqual(out, slots);
  assert.equal(slots[3].notes.size, 0);
});

test('applyToSlot returns the same slot reference for non-targets', () => {
  const slots = createDefaultSlots();
  const out = applyToSlot(slots, SAMPLE_SOURCE, 3, { notes: true, colors: true });
  assert.equal(out[0], slots[0]);
  assert.equal(out[5], slots[5]);
});

test('applyToSlot throws if target index is out of range', () => {
  const slots = createDefaultSlots();
  assert.throws(() => applyToSlot(slots, SAMPLE_SOURCE, -1, { notes: true, colors: true }));
  assert.throws(() => applyToSlot(slots, SAMPLE_SOURCE, 16, { notes: true, colors: true }));
});

test('applyToSlot with neither flag is a no-op (returns slots unchanged structurally)', () => {
  const slots = createDefaultSlots();
  const out = applyToSlot(slots, SAMPLE_SOURCE, 3, { notes: false, colors: false });
  assert.deepEqual([...out[3].notes], []);
  assert.deepEqual(out[3].led1, { r: 0, g: 0, b: 0 });
});
